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
