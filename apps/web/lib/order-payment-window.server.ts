import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification } from '@/lib/notification-emit';
import { formatPhp } from '@/lib/orders';
import {
  PAYMENT_REMINDER_AFTER_DAYS,
  PAYMENT_WINDOW_DAYS,
  UNPAID_ORDER_STATUSES,
  isCustomerOrder,
  paymentDeadlineSentence,
  paymentWindowHasClosed,
  reminderIsDue,
} from './order-payment-window';

/**
 * The unpaid-order sweep — nudge at the halfway point, cancel at the deadline.
 *
 * 🕰 WHY THIS RUNS ON A PAGE VISIT AND NOT A SCHEDULE. This platform is
 * deliberately CRON-FREE; the shipped precedent is `sweepLapsedSubscriptions`,
 * which the admin payments page fires on render. This mirrors it exactly rather
 * than introducing a scheduler nobody else uses.
 *
 * ⚖ THE COST OF THAT CHOICE, STATED RATHER THAN HIDDEN: an order expires the
 * next time somebody opens a page that sweeps, not on the stroke of the
 * fifteenth day. It can only ever run LATE, never early — which is the
 * forgiving direction, and the only direction that is safe here, because the
 * expensive failure is money arriving against an order that has already
 * cancelled itself.
 *
 * 🔑 EVERY WRITE IS IDEMPOTENT AND RACE-SAFE. The reminder is guarded by
 * `payment_reminder_sent_at IS NULL` and the cancel by the status filter, both
 * inside the UPDATE's own WHERE — so two admins loading the page at once cannot
 * double-email a buyer or double-cancel an order. Same pattern approvePayment
 * and rejectPayment use.
 *
 * ⚠ FAILS QUIET, NEVER FATAL. This is called from page renders that must not
 * die because a sweep stumbled — a failed sweep leaves the order exactly as it
 * was, which is recoverable; a thrown sweep takes down the payments queue.
 */

type SweepResult = {
  /** Orders cancelled because their window closed. */
  expired: string[];
  /** Buyers nudged because they are halfway to the deadline. */
  reminded: string[];
  /** True when a read or write failed — the caller must NOT report "all clear". */
  degraded: boolean;
};

type OrderRow = {
  order_id: string;
  public_id: string | null;
  user_id: string | null;
  event_id: string | null;
  service_key: string | null;
  status: string;
  payment_due_at: string;
  payment_reminder_sent_at: string | null;
  requested_total_php: number | null;
  confirmed_total_php: number | null;
};

const SELECT =
  'order_id, public_id, user_id, event_id, service_key, status, payment_due_at, ' +
  'payment_reminder_sent_at, requested_total_php, confirmed_total_php';

/**
 * Where the buyer can go to act. NULL when the order has been detached from its
 * event — which is a real state, see the event-delete path. A notification with
 * no link is still worth sending: it names the amount and the reference.
 */
function orderUrl(row: OrderRow): string | null {
  return row.event_id ? `/dashboard/${row.event_id}/orders/${row.order_id}` : null;
}

function amountOf(row: OrderRow): string {
  const php = Number(row.confirmed_total_php ?? row.requested_total_php ?? 0);
  return formatPhp(php);
}

export async function sweepUnpaidOrderWindow(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<SweepResult> {
  const result: SweepResult = { expired: [], reminded: [], degraded: false };
  const nowIso = now.toISOString();

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(SELECT)
      .in('status', UNPAID_ORDER_STATUSES as unknown as string[]);

    // 🪤 SUPABASE RESOLVES WITH { error } — IT DOES NOT THROW. A try/catch around
    // this read can never fire, so the error is bound and checked by hand. An
    // unread error here would look exactly like "no orders are waiting".
    if (error) {
      console.error('[order-window] read failed:', error.message);
      return { ...result, degraded: true };
    }

    const rows = ((data ?? []) as unknown as OrderRow[]).filter((r) => isCustomerOrder(r.service_key));

    for (const row of rows) {
      // 1 · The window has closed → cancel, never delete.
      if (paymentWindowHasClosed(row.payment_due_at, now)) {
        const { data: cancelled, error: cancelErr } = await supabase
          .from('orders')
          .update({ status: 'cancelled', updated_at: nowIso })
          .eq('order_id', row.order_id)
          .in('status', UNPAID_ORDER_STATUSES as unknown as string[])
          .select('order_id')
          .maybeSingle();
        if (cancelErr) {
          console.error('[order-window] cancel failed:', cancelErr.message);
          result.degraded = true;
          continue;
        }
        if (!cancelled) continue; // another render got there first — not an error

        result.expired.push(row.order_id);
        if (row.user_id) {
          await emitNotification({
            userId: row.user_id,
            type: 'order_payment_expired',
            title: `Order ${row.public_id ?? ''} was cancelled — we didn't receive payment`.trim(),
            body:
              `We held this order for ${PAYMENT_WINDOW_DAYS} days and no payment reached us, ` +
              `so it has been cancelled. Nothing has been charged. If you have already sent ` +
              `${amountOf(row)}, reply to this and we will sort it out — and if you still want ` +
              `it, you can order it again in a moment.`,
            relatedUrl: orderUrl(row),
          });
        }
        continue;
      }

      // 2 · Halfway, and not yet nudged → one reminder, ever.
      if (row.payment_reminder_sent_at === null && reminderIsDue(row.payment_due_at, now)) {
        const { data: stamped, error: stampErr } = await supabase
          .from('orders')
          .update({ payment_reminder_sent_at: nowIso })
          .eq('order_id', row.order_id)
          .is('payment_reminder_sent_at', null)
          .select('order_id')
          .maybeSingle();
        if (stampErr) {
          console.error('[order-window] reminder stamp failed:', stampErr.message);
          result.degraded = true;
          continue;
        }
        // 🔑 THE STAMP IS TAKEN BEFORE THE EMAIL, AND THAT ORDER IS DELIBERATE.
        // If the stamp fails we send nothing; if the email fails the buyer has
        // lost one nudge. Sending first and stamping second risks emailing the
        // same person on every page load — and a customer who is emailed six
        // times stops reading us entirely.
        if (!stamped) continue;

        result.reminded.push(row.order_id);
        if (row.user_id) {
          await emitNotification({
            userId: row.user_id,
            type: 'order_payment_reminder',
            title: `Your order ${row.public_id ?? ''} is still waiting for payment`.trim(),
            body:
              `We haven't received ${amountOf(row)} yet. ` +
              `${paymentDeadlineSentence(row.payment_due_at)} ` +
              `If you have already sent it, ignore this — we may just not have matched it yet.`,
            relatedUrl: orderUrl(row),
          });
        }
      }
    }

    return result;
  } catch (e) {
    console.error('[order-window] sweep threw:', e);
    return { ...result, degraded: true };
  }
}
