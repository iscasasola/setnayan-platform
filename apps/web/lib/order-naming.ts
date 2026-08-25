/**
 * order-naming — ONE order, ONE number, in everything a customer reads.
 *
 * 🔑 FOUND BY THE FIRST REAL PURCHASE (2026-08-25, ₱2,499 Setnayan AI).
 * A buyer's inbox held three notices about a single order, three minutes
 * apart, naming it three different ways:
 *
 *   9:04pm  "Setnayan order SN9B5605B1 — received"      ← reference_code
 *   9:07pm  "Order S89O-BSTY3J0STT marked paid"          ← public_id
 *   9:07pm  "Payment of ₱2,499 matched"                  ← named nothing
 *
 * Nothing in that inbox says those are the same purchase. The buyer's own
 * order page prints the reference code, and the checkout email establishes
 * it first, so THE REFERENCE CODE IS THE CUSTOMER-FACING NAME. `public_id`
 * is our internal handle: correct in admin screens, audit rows and logs,
 * and noise in a person's inbox.
 *
 * ⚠ NOT a cosmetic change. A buyer who writes in quoting "SN9B5605B1" is
 * quoting the only number they were given twice; support has to be able to
 * act on it.
 */

export type NameableOrder = {
  reference_code?: string | null;
  public_id?: string | null;
};

/**
 * The order's name for a CUSTOMER-facing notice.
 *
 * Falls back to `public_id` when a row somehow has no reference code (older
 * rows predate it), and returns null when it has neither — callers must then
 * write a subject that names no order at all rather than one with a hole in
 * it. 🪤 The bug this replaces was exactly that hole: `${order?.public_id ?? ''}`
 * renders "Order  marked paid" with a double space when the lookup misses.
 */
export function customerOrderName(order: NameableOrder | null | undefined): string | null {
  const ref = order?.reference_code?.trim();
  if (ref) return ref;
  const pub = order?.public_id?.trim();
  if (pub) return pub;
  return null;
}

/**
 * A subject line that names the order when we know it and stays a clean
 * sentence when we do not — never a stray "Order  " with nothing after it.
 *
 *   withOrderName('Marked paid', o)  →  "Order SN9B5605B1 marked paid"
 *   withOrderName('Marked paid', {}) →  "Marked paid"
 */
export function orderSubject(fallback: string, suffix: string, order: NameableOrder | null | undefined): string {
  const name = customerOrderName(order);
  return name ? `Order ${name} ${suffix}` : fallback;
}
