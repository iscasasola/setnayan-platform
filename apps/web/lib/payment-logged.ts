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
 * 🧾 AW-4 (admin walk 14 Nov 2026): a bill's own placeholder row is NOT waiting once its order is already paid.
 *
 * Measured in prod: order `S89O-05E8XMMPF4` was `paid` with its logged payment `matched` and a receipt issued, while
 * the bill's placeholder row (pending, no reference, no screenshot) still sat `pending` — so Payments listed it as
 * "Pending review" and Work counted it as one of "2 waiting". The placeholder exists only so an unpaid bill is seen
 * and can be matched; once the order is paid there is nothing left to match it to. A LOGGED pending row on a paid
 * order still waits — that is a real second transfer (a double payment) and needs a person.
 *
 * Order statuses that are only ever reached after the money arrived. PURE.
 */
export const ORDER_STATUSES_ALREADY_PAID: readonly string[] = ['paid', 'fulfilled', 'refunded', 'lapsed'];

export function isPlaceholderOnPaidOrder(
  p: PaymentEvidence,
  orderStatus: string | null | undefined,
): boolean {
  return (
    p.status === 'pending' &&
    !paymentWasLogged(p) &&
    typeof orderStatus === 'string' &&
    ORDER_STATUSES_ALREADY_PAID.includes(orderStatus)
  );
}

/** Is this payment row still waiting on an admin? Pending, and not a placeholder on an already-paid order. PURE. */
export function paymentStillWaiting(p: PaymentEvidence, orderStatus: string | null | undefined): boolean {
  return p.status === 'pending' && !isPlaceholderOnPaidOrder(p, orderStatus);
}

/**
 * 🧾 AW-5 (admin walk 14 Nov 2026): what a pending row IS, in the words both Payments and Fees owed use. A placeholder
 * is a bill nobody has paid against — "Billed — nothing sent yet" — never "Pending review", which told an admin a
 * supplier had sent money when they had sent nothing. PURE.
 */
export const NOTHING_SENT_WORDS = 'Billed — nothing sent yet';

/**
 * 🧾 RW-46/47 (walk 13 Nov 2026): the admin sees only the payment the supplier (or couple) actually logged. A bill's
 * own placeholder row (pending, no reference, no screenshot — `paymentWasLogged`) is dropped from the queue whenever
 * the same order has a logged row, so it is never approvable beside the real one. A placeholder ALONE stays: it is how
 * an unpaid bill is seen, and a bank alert can still match it.
 */
export function hidePlaceholdersBesideLogged<
  T extends PaymentEvidence & { order_id: string; status: string; order?: { status?: string | null } | null },
>(rows: readonly T[]): T[] {
  const logged = new Set(rows.filter((r) => paymentWasLogged(r) && r.status !== 'matched').map((r) => r.order_id));
  const matchedOrder = new Set(rows.filter((r) => r.status === 'matched').map((r) => r.order_id));
  return rows.filter(
    (r) =>
      // AW-4: a placeholder on an order already paid is not waiting, even when its matched sibling is not in this read.
      !isPlaceholderOnPaidOrder(r, r.order?.status) &&
      (paymentWasLogged(r) || !(logged.has(r.order_id) || matchedOrder.has(r.order_id))),
  );
}
