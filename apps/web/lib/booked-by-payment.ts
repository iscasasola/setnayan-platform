/**
 * booked-by-payment.ts — A SUPPLIER THE COUPLE ADDED BY HAND, WITH A RECORDED
 * PAYMENT, IS BOOKED. The one resolver.
 *
 * Owner, 2026-10-20 (DECISION_LOG "A CLAIMED SUPPLIER ARRIVES BOOKED IF PAID…"):
 * *"if the manual input has payment already, it is technically booked
 * already."* ⇒ its status reads Booked, before and after the supplier claims
 * the couple's link; with no payment it stays as the couple filed it.
 *
 * ── DERIVED, NEVER BACKFILLED ─────────────────────────────────────────────
 * Nothing rewrites a stored `event_vendors.status`. Every couple read that
 * draws a supplier's standing (Suppliers page · Budget · Home · the schedule)
 * passes its rows through `withBookedByPayment` at the LOAD, so the ~25 places
 * downstream that ask "is the status in the booked set?" all get the same
 * answer from the same rows — one decision, not 25 edits that can drift.
 * The stored value is kept on the row as `stored_status` for anyone who must
 * write against it. (The one write: when the couple APPROVES a claimed
 * supplier's access, `answer_claim_access_request` lets the stored status
 * catch up, so the server's booked-supplier reads serve its category.)
 *
 * ── WHO COUNTS AS "ADDED BY HAND" ─────────────────────────────────────────
 * A row with no shop (`marketplace_vendor_id` null), or a row carrying the
 * couple's own contact card (`manual_vendor_id`) — which a claim keeps when the
 * record links to, or merges onto, the shop's row. A supplier the couple found
 * on Setnayan is booked only through the lock handshake (the supplier agrees),
 * so a payment alone never books it.
 *
 * ── WHICH PAYMENTS COUNT ──────────────────────────────────────────────────
 * Any `event_vendor_payments` row the supplier has not refused
 * (`payment_refused_at`). A refused payment is a payment the supplier says
 * never reached them.
 *
 * PURE — no I/O. `the-claim-books-asks-and-schedules.test.ts` holds the wiring.
 */

/** The statuses that mean "a real booking". Mirrors `CONFIRMED_VENDOR_STATUSES` (lib/events.ts). */
const BOOKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
/** The status a hand-added, paid supplier reads as — the first booked rung. */
export const BOOKED_BY_PAYMENT_STATUS = 'contracted' as const;

export type BookedByPaymentRow = {
  vendor_id: string;
  status: string | null;
  marketplace_vendor_id?: string | null;
  manual_vendor_id?: string | null;
};

export type PaymentFact = {
  vendor_id: string;
  payment_refused_at?: string | null;
};

/** Hand-added: no shop yet, or the row still carries the couple's own contact card. */
export function isHandAdded(row: Pick<BookedByPaymentRow, 'marketplace_vendor_id' | 'manual_vendor_id'>): boolean {
  return !row.marketplace_vendor_id || !!row.manual_vendor_id;
}

/** The suppliers with at least one payment the supplier has not refused. */
export function paidSupplierIds(payments: ReadonlyArray<PaymentFact>): Set<string> {
  const ids = new Set<string>();
  for (const p of payments) if (p.vendor_id && !p.payment_refused_at) ids.add(p.vendor_id);
  return ids;
}

/** Is this supplier booked — by its status, or (hand-added) by a recorded payment? */
export function isBookedSupplier(row: BookedByPaymentRow, paid: ReadonlySet<string>): boolean {
  if (row.status && BOOKED.has(row.status)) return true;
  return isHandAdded(row) && paid.has(row.vendor_id);
}

/** True only when the PAYMENT is what makes it booked (the stored status is not a booking). */
export function bookedByPaymentOnly(row: BookedByPaymentRow, paid: ReadonlySet<string>): boolean {
  return !(row.status && BOOKED.has(row.status)) && isBookedSupplier(row, paid);
}

/**
 * THE LOAD-TIME PASS. Returns the same rows, each paid hand-added supplier's
 * `status` read as booked and the stored value kept on `stored_status`.
 * Rows that are not affected come back unchanged (same object).
 */
export function withBookedByPayment<T extends BookedByPaymentRow>(
  rows: ReadonlyArray<T>,
  payments: ReadonlyArray<PaymentFact> | ReadonlySet<string>,
): Array<T & { stored_status?: T['status'] }> {
  const paid = payments instanceof Set ? (payments as ReadonlySet<string>) : paidSupplierIds(payments as ReadonlyArray<PaymentFact>);
  return rows.map((r) =>
    bookedByPaymentOnly(r, paid) ? { ...r, status: BOOKED_BY_PAYMENT_STATUS as unknown as T['status'], stored_status: r.status } : r,
  );
}

/** The one word the schedule (and any small label) uses for a supplier's standing. */
export type SupplierStandingWord = 'Booked' | 'Shortlisted';
export function supplierStandingWord(row: BookedByPaymentRow, paid: ReadonlySet<string>): SupplierStandingWord {
  return isBookedSupplier(row, paid) ? 'Booked' : 'Shortlisted';
}

/**
 * The same payments, read INSIDE an `event_vendors` select (one round trip):
 * `select(\`…, ${BOOKED_BY_PAYMENT_EMBED}\`)` then `withEmbeddedPayments(rows)`.
 */
export const BOOKED_BY_PAYMENT_EMBED = 'vendor_payments:event_vendor_payments(payment_refused_at)';

export function withEmbeddedPayments<
  T extends BookedByPaymentRow & { vendor_payments?: ReadonlyArray<{ payment_refused_at?: string | null }> | null },
>(rows: ReadonlyArray<T>): Array<T & { stored_status?: T['status'] }> {
  const paid = new Set<string>();
  for (const r of rows) if ((r.vendor_payments ?? []).some((p) => !p.payment_refused_at)) paid.add(r.vendor_id);
  return withBookedByPayment(rows, paid);
}
