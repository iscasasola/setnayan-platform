/**
 * 🧾 RW-37 (walk 13 Nov 2026): IS THIS PAYMENT ROW A PAYMENT ANYBODY LOGGED?
 *
 * Minting a bill (the booking fee, a team seat, an add-on, …) also writes a `payments` row on purpose — a PLACEHOLDER,
 * `status = 'pending'`, no reference and no screenshot, so the bill lands in /admin/payments and the approve → settle
 * bridge has a row to flip when the money arrives (`collectBookingFeeAtLock`, `ai-addon-actions`, …). Read as a payment,
 * that row told a supplier who had paid nothing "₱1,337.50 · manual · PAID 2026-11-13 · PENDING REVIEW".
 *
 * A pending row with neither a reference nor a screenshot is that placeholder: NOT a payment. A row an admin matched
 * IS money received, whatever it carries (a bank alert can match a placeholder). PURE.
 */
export type PaymentEvidence = {
  status?: string | null;
  reference_number?: string | null;
  screenshot_url?: string | null;
};

export function paymentWasLogged(p: PaymentEvidence): boolean {
  if (p.status === 'matched') return true;
  return Boolean((p.reference_number ?? '').trim() || (p.screenshot_url ?? '').trim());
}

/**
 * 🧾 RW-46/47 (walk 13 Nov 2026): the admin sees only the payment the supplier (or couple) actually logged. A bill's
 * own placeholder row (pending, no reference, no screenshot — `paymentWasLogged`) is dropped from the queue whenever
 * the same order has a logged row, so it is never approvable beside the real one. A placeholder ALONE stays: it is how
 * an unpaid bill is seen, and a bank alert can still match it.
 */
export function hidePlaceholdersBesideLogged<T extends PaymentEvidence & { order_id: string; status: string }>(
  rows: readonly T[],
): T[] {
  const logged = new Set(rows.filter((r) => paymentWasLogged(r) && r.status !== 'matched').map((r) => r.order_id));
  const matchedOrder = new Set(rows.filter((r) => r.status === 'matched').map((r) => r.order_id));
  return rows.filter((r) => paymentWasLogged(r) || !(logged.has(r.order_id) || matchedOrder.has(r.order_id)));
}
