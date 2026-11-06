/**
 * lib/one-press-one-order.ts — a second press of a buy button never makes a
 * second bill.
 *
 * ── THE FAULT (measured 2026-10-13, Papic end-to-end tester) ────────────────
 * "Continue to payment" on the Papic credits card showed no pressed state, and
 * every press minted a NEW unpaid order: two presses, two orders, two
 * reference codes, one couple who meant to buy once. The button half is fixed
 * where the button is (it locks and says "Opening payment…"). This is the
 * SERVER half, because a lock in the browser cannot cover the cases that never
 * reach it: a tap before the page's script has loaded posts the form natively,
 * a back-button resubmit, a second tab, a script.
 *
 * ── THE RULE, AND WHY IT IS THIS NARROW ─────────────────────────────────────
 * Two orders are TWINS when they are the same purchase by the same person on
 * the same event: same `event_id`, `user_id`, `service_key`,
 * `requested_total_php` and `description`, still `submitted`, with no payment
 * logged against it yet, made within {@link TWIN_ORDER_WINDOW_MS}.
 *
 * It extends the repo's existing anti-duplicate rule — "one open order per
 * (buyer, SKU)" in `app/papic/buy/actions.ts` (`hasOpenGuestOrder`) and the
 * photo-challenge pending-order guard — with two differences, both on purpose:
 *
 *   · It REUSES rather than refuses. The person pressing twice wants to pay for
 *     the thing they chose; the honest answer to the second press is the bill
 *     the first one made, not an error.
 *   · It is bounded in TIME and by "no payment logged". A couple who bought 100
 *     credits yesterday and wants 100 more today is making a second purchase,
 *     and so is one who already sent the money for the first: neither may be
 *     folded into the old bill. Ten minutes covers every double press, retry
 *     and resubmit, and nothing a person does on purpose.
 *
 * ── TWO CALLS, BOTH NEEDED ──────────────────────────────────────────────────
 *   1. {@link openTwinReference} — BEFORE minting. A second press that arrives
 *      after the first finished lands on the first bill and mints nothing.
 *   2. {@link keepFirstTwin} — straight AFTER minting, before any side effect
 *      (cameras, snapshots, guest rows). Two presses that arrive TOGETHER both
 *      pass step 1, because neither order exists yet when the other looks. Each
 *      then reads the twins that DO exist; the earliest (created_at, then
 *      order_id — the same answer from both sides) survives, and the later one
 *      cancels itself and sends its buyer to the survivor. Whatever the timing,
 *      exactly one stays open.
 *
 * ⚠ FAILS OPEN, DELIBERATELY. If either read errors, the purchase goes ahead
 * as it always did. A duplicate bill is an annoyance an admin can cancel; a buy
 * button that refuses because a dedupe read hiccupped loses a sale and tells
 * the buyer nothing true.
 *
 * Not `server-only`: it touches no client of its own (the caller passes them),
 * and the pure half is unit-tested in node.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** How long after a press a twin still counts as "the same press". */
export const TWIN_ORDER_WINDOW_MS = 10 * 60 * 1000;

/** The purchase, exactly as the action is about to write it. */
export type OrderTwinKey = {
  eventId: string;
  userId: string;
  serviceKey: string;
  amountPhp: number;
  description: string;
};

export type TwinRow = {
  order_id: string;
  reference_code: string;
  created_at: string;
  status: string;
  description: string | null;
  requested_total_php: number | string | null;
  payments?: ReadonlyArray<unknown> | null;
};

const TWIN_SELECT =
  'order_id, reference_code, created_at, status, description, requested_total_php, payments(payment_id)';

/**
 * PURE. The twin that should survive — the earliest open one — or null.
 *
 * Re-checks every condition the query already filtered on, so the rule lives
 * in ONE testable place and a loosened query cannot widen it silently.
 */
export function firstOpenTwin(
  rows: readonly TwinRow[],
  key: Pick<OrderTwinKey, 'amountPhp' | 'description'>,
  nowMs: number,
): TwinRow | null {
  const since = nowMs - TWIN_ORDER_WINDOW_MS;
  const open = rows.filter((r) => {
    if (r.status !== 'submitted') return false;
    if ((r.description ?? '') !== key.description) return false;
    if (Number(r.requested_total_php) !== key.amountPhp) return false;
    if (Array.isArray(r.payments) && r.payments.length > 0) return false;
    const t = Date.parse(r.created_at);
    return Number.isFinite(t) && t >= since;
  });
  if (open.length === 0) return null;
  return [...open].sort((a, b) => {
    const d = Date.parse(a.created_at) - Date.parse(b.created_at);
    if (d !== 0) return d;
    return a.order_id < b.order_id ? -1 : a.order_id > b.order_id ? 1 : 0;
  })[0]!;
}

/** null on a read error — the caller must treat that as "no twin" (fail open). */
async function readTwins(
  db: SupabaseClient,
  key: OrderTwinKey,
  nowMs: number,
): Promise<TwinRow[] | null> {
  if (!key.eventId || !key.userId || !key.serviceKey) return null;
  const { data, error } = await db
    .from('orders')
    .select(TWIN_SELECT)
    .eq('event_id', key.eventId)
    .eq('user_id', key.userId)
    .eq('service_key', key.serviceKey)
    .eq('status', 'submitted')
    .eq('description', key.description)
    .gte('created_at', new Date(nowMs - TWIN_ORDER_WINDOW_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(20);
  if (error || !Array.isArray(data)) {
    if (error) console.error('[one-press-one-order] twin read failed:', error.message);
    return null;
  }
  return data as unknown as TwinRow[];
}

/**
 * BEFORE minting: the reference of an open twin this press should land on, or
 * null to mint as normal.
 */
export async function openTwinReference(
  db: SupabaseClient,
  key: OrderTwinKey,
  nowMs: number = Date.now(),
): Promise<string | null> {
  const rows = await readTwins(db, key, nowMs);
  if (!rows) return null;
  return firstOpenTwin(rows, key, nowMs)?.reference_code ?? null;
}

/**
 * AFTER minting, before any side effect: which bill this press should land on.
 *
 * Returns `{ keptMine: true }` when the order just minted is the survivor (the
 * usual case — there is no twin). Returns `{ keptMine: false, reference }`
 * when an EARLIER twin exists: the just-minted order has been cancelled, and
 * the caller must stop and send the buyer to `reference` without provisioning
 * anything against its own order.
 */
export async function keepFirstTwin(
  reader: SupabaseClient,
  writer: SupabaseClient,
  key: OrderTwinKey,
  mine: { orderId: string; referenceCode: string },
  nowMs: number = Date.now(),
): Promise<{ keptMine: true } | { keptMine: false; reference: string }> {
  const rows = await readTwins(reader, key, nowMs);
  if (!rows) return { keptMine: true };
  const first = firstOpenTwin(rows, key, nowMs);
  if (!first || first.order_id === mine.orderId) return { keptMine: true };

  // The status guard makes this a no-op on anything already paid or settled,
  // and the read-back tells a refusal apart from a cancel (Supabase does not
  // throw). If the cancel did not land, keep this order rather than send the
  // buyer to a bill while leaving theirs live behind them.
  const { data, error } = await writer
    .from('orders')
    .update({ status: 'cancelled', updated_at: new Date(nowMs).toISOString() })
    .eq('order_id', mine.orderId)
    .eq('status', 'submitted')
    .select('order_id');
  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) console.error('[one-press-one-order] twin cancel failed:', error.message);
    return { keptMine: true };
  }
  return { keptMine: false, reference: first.reference_code };
}
