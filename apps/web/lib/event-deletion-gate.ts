/**
 * event-deletion-gate.ts — the two decisions behind removing a celebration,
 * separated from the I/O so they can actually be tested.
 *
 * They live here rather than in `delete-actions.ts` because a `'use server'`
 * module may only export async functions — a pure helper exported from one is a
 * build error, and the usual workaround (make it async) would hide these behind
 * a network round trip in the test.
 */

/** Order states that mean money has actually moved. A refund still moved money. */
export const SETTLED_ORDER_STATUSES = [
  'paid',
  'fulfilled',
  'refunded',
] as const;

/** Supplier states that mean really booked, not merely being considered. */
export const BOOKED_VENDOR_STATUSES = [
  'contracted',
  'deposit_paid',
  'delivered',
  'complete',
] as const;

/**
 * May this event be self-deleted, given how many settled orders it has?
 *
 * 🔒 IT FAILS CLOSED, AND THAT ASYMMETRY IS THE WHOLE POINT.
 * `null` means the count could not be read. Every OTHER number on the
 * confirmation screen degrades to "we couldn't check" and still lets the person
 * decide — because those are their own guests and their own photographs. This
 * one refuses instead: a paid service is a receipt, a BIR record and a support
 * case, and it is not theirs alone to destroy. An unmeasured queue is not a
 * clear one — the same rule the admin work list learned after filing an
 * unmeasured queue under "everything is clear".
 *
 * Returns TRUE when deletion must be refused.
 */
export function deletionIsBlocked(settledOrders: number | null): boolean {
  return settledOrders === null || settledOrders > 0;
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
