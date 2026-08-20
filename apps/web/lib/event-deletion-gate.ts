/**
 * event-deletion-gate.ts — the two decisions behind removing a celebration,
 * separated from the I/O so they can actually be tested.
 *
 * They live here rather than in `delete-actions.ts` because a `'use server'`
 * module may only export async functions — a pure helper exported from one is a
 * build error, and the usual workaround (make it async) would hide these behind
 * a network round trip in the test.
 */

/**
 * Order states that mean money has actually moved. A refund still moved money.
 *
 * ⚠ `lapsed` IS IN THIS LIST AND IS NOT AN OVERSIGHT-LOOKING EXTRA. It is
 * reachable ONLY from `paid` — `lib/subscriptions.ts` is its sole writer and it
 * filters `.eq('status','paid')` — so a lapsed order is a PAID order whose
 * service later expired. Omitting it let a once-paid celebration, possibly
 * carrying a BIR receipt, be deleted by pressing a button.
 */
export const SETTLED_ORDER_STATUSES = [
  'paid',
  'fulfilled',
  'refunded',
  'lapsed',
] as const;

/**
 * 🚨 THE STATUS LIST ALONE IS NOT A GATE, BECAUSE THE COUPLE CAN CHANGE THE
 * STATUS. This is the hole that shipped with the first cut of this file.
 *
 * `cancelOrder` (app/dashboard/[eventId]/orders/actions.ts) writes
 * `status='cancelled'` with **no check on the status it is leaving**, and the
 * RLS guard behind it agrees: `orders_update_status_guard` is RESTRICTIVE with
 * `USING (user_id = auth.uid())` and a WITH CHECK that only constrains the NEW
 * value, which admits `'cancelled'`. So a couple with a PAID order could cancel
 * it — through the button or straight through PostgREST — and walk the event
 * past a gate that was looking only at the current status.
 *
 * 🔑 A GATE MUST KEY ON SOMETHING THE PERSON IT GATES CANNOT REWRITE. Payment
 * and receipt rows are that thing: a `payments` row means somebody logged a
 * transfer or uploaded a screenshot, and a `receipts` row is a BIR official
 * receipt with a sequential serial. Neither is reachable by flipping an enum on
 * the order, and both survive the cancellation.
 *
 * Same family as the repo's own "the row is yours, the field is not" sweep, and
 * the reason `vendor_agree_to_lock` asks a row's STATUS rather than trusting a
 * link's presence.
 */
export type MoneyEvidence = {
  /** Orders currently sitting in a settled state. */
  settledOrders: number | null;
  /** Payment rows against ANY of this event's orders, whatever their status. */
  paymentRows: number | null;
  /** BIR official receipts against ANY of this event's orders. */
  receiptRows: number | null;
};

/** Supplier states that mean really booked, not merely being considered. */
export const BOOKED_VENDOR_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

/**
 * May this event be self-deleted, given every trace of money against it?
 *
 * 🔒 IT FAILS CLOSED ON EVERY SIGNAL, AND THAT ASYMMETRY IS THE WHOLE POINT.
 * `null` on ANY of the three means that count could not be read, and the answer
 * to "we could not check whether they paid" is no. Every OTHER number on the
 * confirmation screen degrades to "we couldn't check" and still lets the person
 * decide — because those are their own guests and their own photographs. These
 * refuse instead: a paid service is a receipt, a BIR record and a support case,
 * and it is not theirs alone to destroy. An unmeasured queue is not a clear one.
 *
 * Returns TRUE when deletion must be refused.
 */
export function deletionIsBlocked(evidence: MoneyEvidence): boolean {
  const { settledOrders, paymentRows, receiptRows } = evidence;
  if (settledOrders === null || paymentRows === null || receiptRows === null) {
    return true;
  }
  return settledOrders > 0 || paymentRows > 0 || receiptRows > 0;
}

/**
 * Did the person type their celebration's name?
 *
 * Case- and whitespace-insensitive: this checks that somebody MEANT it, not
 * that they can reproduce capitalisation. "  cale & ice " is the same intent as
 * "Cale & Ice".
 *
 * An empty expected name can never be matched — otherwise an event with a blank
 * display name would delete on an empty box, which is the one input a stray
 * press produces.
 */
export function confirmationMatches(typed: string, eventName: string): boolean {
  const expected = eventName.trim().toLowerCase();
  if (expected.length === 0) return false;
  return typed.trim().toLowerCase() === expected;
}
