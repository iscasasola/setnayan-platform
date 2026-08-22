import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * Notification Foundation · Phase B (2026-06-19) — admin-side ORDER confirmation.
 *
 * When a couple submits an order (apply-then-pay), the row lands in the
 * /admin/payments reconciliation queue but, until now, no admin was notified —
 * the queue only refreshed if an admin happened to be looking at it. This
 * fans out an in-app notification to every admin/internal/team user so the
 * 24-hr reconciliation SLA actually starts on submit, not on the next time
 * someone opens the queue.
 *
 * Mirrors lib/subscription-purchase-notify.ts (notifyAdminsSubscriptionPending):
 * the same admin OR-filter (is_internal / is_team_member / account_type='admin')
 * and the same fail-soft try/catch. Uses its OWN type
 * `order_awaiting_reconciliation` (added 2026-06-24) — NOT the borrowed
 * `vendor_token_purchase_pending`. The tray renders the TYPE as its badge, so
 * the old reuse made a couple's PHP order read "TOKEN PURCHASE AWAITING
 * PAYMENT" (wrong — the customer token wallet is retired; couples pay PHP
 * direct). The dedicated type renders "Awaiting reconciliation". Deep-link
 * points at /admin/payments where the order sits.
 *
 * Best-effort: a failed notification never rolls back the order. We log and
 * continue.
 */

const peso = (n: number) =>
  '₱' + new Intl.NumberFormat('en-PH').format(Math.round(n));

export async function notifyAdminsOrderAwaitingReconciliation(args: {
  orderId: string;
  description: string;
  amountPhp: number;
  referenceCode: string;
}): Promise<void> {
  const { orderId, description, amountPhp, referenceCode } = args;
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    const label = description.trim().slice(0, 80) || 'A new order';

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'order_awaiting_reconciliation',
          title: `New order awaiting reconciliation · ${peso(amountPhp)}`,
          body: `${label} — ${peso(
            amountPhp,
          )} is awaiting payment confirmation. Reconcile once it lands. Ref ${referenceCode}.`,
          relatedUrl: '/admin/payments',
        }),
      ),
    );
  } catch (e) {
    console.error('[orders] admin awaiting-reconciliation notify failed:', e);
    void orderId;
  }
}

/**
 * The SECOND event, and the one that matters more.
 *
 * `notifyAdminsOrderAwaitingReconciliation` above fires when a couple SUBMITS
 * an order — before any money exists. This one fires when they come back and
 * say "I have paid, here is the proof", which is the moment real pesos have
 * left a real bank account and somebody is waiting for their purchase to switch
 * on. Until now that step notified NOBODY: `logPayment` wrote the row,
 * revalidated, and redirected.
 *
 * 🔑 THE DAILY OPS DIGEST IS NOT THIS. The digest is a next-morning summary of
 * what is waiting, and it only sends when a queue is non-empty and only around
 * 08:00 Manila. For "your customer has paid and is waiting", tomorrow is the
 * wrong answer. The digest is the safety net UNDER this notification, not a
 * substitute for it.
 *
 * Best-effort, exactly like its sibling: a failed notification must never roll
 * back a recorded payment.
 */
export async function notifyAdminsPaymentProofSubmitted(args: {
  orderId: string;
  eventId: string;
  amountPhp: number;
  channel: string;
}): Promise<void> {
  const { orderId, eventId, amountPhp, channel } = args;
  try {
    const admin = createAdminClient();
    const { data: admins } = await admin
      .from('users')
      .select('user_id')
      .or('is_internal.eq.true,is_team_member.eq.true,account_type.eq.admin');
    if (!admins?.length) return;

    const how = channel.trim().slice(0, 24) || 'a transfer';

    await Promise.all(
      admins.map((row) =>
        emitNotification({
          userId: row.user_id as string,
          type: 'order_awaiting_reconciliation',
          title: `Payment logged · ${peso(amountPhp)} — confirm it`,
          body: `A customer says they have paid ${peso(
            amountPhp,
          )} via ${how} and is waiting for it to be switched on. Check it against the account and confirm.`,
          relatedUrl: '/admin/payments',
        }),
      ),
    );
  } catch (e) {
    console.error('[orders] payment-proof notify failed:', e);
    void orderId;
    void eventId;
  }
}
