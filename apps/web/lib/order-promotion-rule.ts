/**
 * order-promotion-rule.ts — WHICH orders may be promoted to `paid`, and which
 * may receive a customer's payment at all.
 *
 * ── THE DEFECT, measured 2026-09-22 (CTRL-B1 build 2) ───────────────────────
 * `approvePayment` promoted with `.update({ status: 'paid' }).eq('order_id', …)`
 * and **no condition on the status it was leaving**. The order was read for the
 * notification without `status` in the SELECT, so the code could not have
 * checked even if it wanted to. The customer-side submit had no status guard
 * either — it selected `order_id, event_id` and nothing more.
 *
 * So a payment could be logged and approved against a `cancelled`, `refunded`
 * or already-`paid` order. Promotion re-runs `activateOrderSku`: it re-activates
 * the SKU, re-schedules payouts, re-issues a receipt, and (since 2026-09-11)
 * re-grants Papic credits and the couple's gift.
 *
 * ── WHY A SEPARATE PURE MODULE ─────────────────────────────────────────────
 * Both doors are `'use server'` files. A guard cannot import them, so a guard
 * over them can only ever GREP — and a grep proves the string is present, not
 * that the rule is right. The decision lives here, pure and total, so its tests
 * EXECUTE it, and each door is left with one call it cannot get subtly wrong.
 *
 * ── FAIL CLOSED ────────────────────────────────────────────────────────────
 * An allowlist, not a denylist, for the same reason `CANCELLABLE_ORDER_STATUSES`
 * is one: `order_status` gains values over time, and a denylist makes every new
 * one promotable by default. An unrecognised status is refused.
 */

/**
 * The live `order_status` enum, measured against production 2026-09-22:
 * `draft · submitted · awaiting_payment · paid · fulfilled · cancelled ·
 *  refunded · lapsed`.
 *
 * Kept here so a test can assert this list still matches the database — a rule
 * written against a vocabulary that has since grown is the quiet way this fails.
 */
export const ORDER_STATUSES = [
  'draft',
  'submitted',
  'awaiting_payment',
  'paid',
  'fulfilled',
  'cancelled',
  'refunded',
  'lapsed',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * The states an order may be promoted to `paid` FROM — money has been asked
 * for, and has not yet settled.
 *
 * ⚠ `lapsed` is deliberately NOT here. A late payment on a lapsed order is a
 * real case, but it is a decision about whether the offer still stands (price,
 * availability, the SKU's window) and it belongs to a person, not to a
 * checkbox. An admin who wants it can move the order back to
 * `awaiting_payment` first, which leaves a trail. Named rather than assumed.
 *
 * ⚠ `paid` is not here either, which makes re-approval a NO-OP rather than a
 * second activation. That is the whole point: activation grants things.
 */
export const PROMOTABLE_ORDER_STATUSES = [
  'draft',
  'submitted',
  'awaiting_payment',
] as const satisfies readonly OrderStatus[];

/** May this order be promoted to `paid`? Total — an unknown status is `false`. */
export function canPromoteOrderToPaid(status: string | null | undefined): boolean {
  if (typeof status !== 'string') return false;
  return (PROMOTABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * May a customer log a payment against this order?
 *
 * Wider than promotion on purpose, and the difference is deliberate: a customer
 * paying the balance on an order an admin has already marked `paid` is a real,
 * harmless thing (overpayment is reconciled, never silently discarded — see
 * `resolveEventMoney`, which enforces `committed + overpaid === paid + stillOwed`).
 * What a customer must never do is attach money to an order that is CLOSED —
 * `cancelled`, `refunded` or `lapsed` — because nothing downstream will ever
 * look at it again and the money becomes invisible.
 */
export const PAYABLE_ORDER_STATUSES = [
  'draft',
  'submitted',
  'awaiting_payment',
  'paid',
] as const satisfies readonly OrderStatus[];

/** May a customer log a payment against this order? Total — unknown is `false`. */
export function canLogPaymentAgainstOrder(status: string | null | undefined): boolean {
  if (typeof status !== 'string') return false;
  return (PAYABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * The sentence an admin sees when a promote is refused. Names the status,
 * because "could not promote" with no reason is what sends someone to the
 * database.
 */
export function promotionRefusedReason(status: string | null | undefined): string {
  const seen = typeof status === 'string' && status.length > 0 ? status : 'unknown';
  return (
    `This order is “${seen}”, so it was not marked paid — the payment is still recorded. ` +
    `Only an order that is ${PROMOTABLE_ORDER_STATUSES.join(', ')} can be promoted; ` +
    `promoting a settled or closed order would re-run activation and re-grant what it already gave.`
  );
}
