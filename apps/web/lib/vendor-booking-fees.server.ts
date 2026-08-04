import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { isBookingFeeEnabled } from '@/lib/booking-fee-gate';
import type { OrderRow } from '@/lib/orders';
import {
  VENDOR_BOOKING_FEE_SERVICE_KEY_LIKE,
  vendorBookingFeePayPath,
  classifyFeeOrderBucket,
  isFeeOrderPayable,
  bookingFeeNotificationCopy,
} from '@/lib/vendor-booking-fees';

/**
 * Vendor Booking-Fee SURFACING — the DB-touching half (fetch + notification
 * sweep). Composes the pure predicates in lib/vendor-booking-fees.ts. READ-ONLY
 * w.r.t. the fee itself: it never opens a charge, mints an order, or mutates the
 * fee-charge tables (that path is a parallel lane). It only reads the vendor's
 * own fee orders and lazily materialises an in-app + email notification for the
 * ones that are still due.
 */

const FEE_ORDER_SELECT =
  'order_id,public_id,event_id,user_id,service_key,description,requested_total_php,confirmed_total_php,status,reference_code,admin_notes,created_at,updated_at';

/**
 * The caller's OWN booking-fee orders, newest first. Uses the CALLER-scoped
 * client so RLS (orders_owner_read · user_id = auth.uid()) guarantees a vendor
 * can only ever read their OWN fee orders — never another vendor's — even though
 * the fee order carries the couple's event_id. Fail-soft to [] on any error so a
 * surfacing read never crashes the vendor dashboard.
 */
export async function fetchVendorFeeOrders(
  supabase: SupabaseClient,
  userId: string,
): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(FEE_ORDER_SELECT)
    .eq('user_id', userId)
    .like('service_key', VENDOR_BOOKING_FEE_SERVICE_KEY_LIKE)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as OrderRow[];
}

/** Count of the caller's DUE (payable) fee orders — drives the doorway gate. */
export async function countDueVendorFeeOrders(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const orders = await fetchVendorFeeOrders(supabase, userId);
  return orders.filter((o) => isFeeOrderPayable(o.status)).length;
}

/** Split the caller's fee orders into the three surfacing buckets. */
export function bucketFeeOrders(orders: OrderRow[]): {
  due: OrderRow[];
  settled: OrderRow[];
  closed: OrderRow[];
} {
  const due: OrderRow[] = [];
  const settled: OrderRow[] = [];
  const closed: OrderRow[] = [];
  for (const o of orders) {
    const bucket = classifyFeeOrderBucket(o.status);
    if (bucket === 'due') due.push(o);
    else if (bucket === 'settled') settled.push(o);
    else closed.push(o);
  }
  return { due, settled, closed };
}

/**
 * CRON-FREE lazy notification sweep — the house pattern (mirrors
 * runLoginGhostingCheck / sweepGuardNotifications): fired post-response via
 * after() from the vendor dashboard layout. Because we must NOT hook the
 * fee-charge create path (parallel lane), the notification is DERIVED from the
 * existence of an unpaid fee order rather than emitted at create time.
 *
 * IDEMPOTENT by construction: for each due fee order it checks whether a
 * notification already deep-links to that order's pay page (related_url) and
 * only emits for the ones that don't — so it can run on every render without
 * ever double-notifying. Uses the service-role client for the read/insert (the
 * notifications table is written service-side by emitNotification anyway).
 *
 * Flag-gated: a NO-OP unless NEXT_PUBLIC_BOOKING_FEE_ENABLED is on, so when the
 * fee system is dark nothing is surfaced. Fully fail-soft — a hiccup here never
 * affects the page that already rendered.
 *
 * Reuses the EXISTING notification pattern: emitNotification drops the in-app
 * row AND (because we pass the transactional `order_quoted` type, which is on
 * the email allowlist) sends the branded email — no new notification type, no
 * migration.
 */
export async function maybeSweepVendorBookingFeeNotifications(
  userId: string,
): Promise<void> {
  if (!isBookingFeeEnabled()) return;
  try {
    const admin = createAdminClient();

    // The vendor's own DUE fee orders (service-role read, but explicitly scoped
    // by user_id so it stays this vendor's rows only).
    const { data: orderRows, error: oErr } = await admin
      .from('orders')
      .select('order_id,event_id,requested_total_php,confirmed_total_php,status,service_key')
      .eq('user_id', userId)
      .like('service_key', VENDOR_BOOKING_FEE_SERVICE_KEY_LIKE)
      .in('status', ['submitted', 'awaiting_payment']);
    if (oErr || !orderRows || orderRows.length === 0) return;

    const dueOrders = (orderRows as Array<{
      order_id: string;
      event_id: string | null;
      requested_total_php: number | null;
      confirmed_total_php: number | null;
      status: string;
      service_key: string | null;
    }>).filter((o) => isFeeOrderPayable(o.status as OrderRow['status']));
    if (dueOrders.length === 0) return;

    // Which of those already have a notification (idempotency key = the pay-page
    // related_url). One query for all candidate URLs.
    const payUrls = dueOrders.map((o) => vendorBookingFeePayPath(o.order_id));
    const { data: existing } = await admin
      .from('notifications')
      .select('related_url')
      .eq('user_id', userId)
      .in('related_url', payUrls);
    const alreadyNotified = new Set(
      ((existing ?? []) as Array<{ related_url: string | null }>)
        .map((r) => r.related_url)
        .filter((u): u is string => typeof u === 'string'),
    );

    // Resolve event display names in one batch for the copy.
    const eventIds = Array.from(
      new Set(dueOrders.map((o) => o.event_id).filter((id): id is string => !!id)),
    );
    const nameByEvent = new Map<string, string | null>();
    if (eventIds.length > 0) {
      const { data: events } = await admin
        .from('events')
        .select('event_id,display_name')
        .in('event_id', eventIds);
      for (const e of (events ?? []) as Array<{ event_id: string; display_name: string | null }>) {
        nameByEvent.set(e.event_id, e.display_name);
      }
    }

    for (const o of dueOrders) {
      const payUrl = vendorBookingFeePayPath(o.order_id);
      if (alreadyNotified.has(payUrl)) continue;
      const amountPhp = Number(o.confirmed_total_php ?? o.requested_total_php ?? 0);
      const { title, body } = bookingFeeNotificationCopy({
        amountPhp,
        eventName: o.event_id ? nameByEvent.get(o.event_id) : null,
      });
      // order_quoted = the transactional "you have an order to pay" type: amber
      // (action-needed) tone + on the email allowlist. The recipient is the fee
      // order's OWNER (this vendor's user_id), so the deep-link + email reach the
      // right person. Custom title/body carry the fee-specific wording.
      await emitNotification({
        userId,
        type: 'order_quoted',
        title,
        body,
        relatedUrl: payUrl,
      });
    }
  } catch {
    // Fail-soft: the vendor still sees the fee in the Booking fees hub even if
    // the notification sweep hiccups.
  }
}
