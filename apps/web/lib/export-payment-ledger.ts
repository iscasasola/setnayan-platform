/**
 * export-payment-ledger — the couple's own payment ledger in their RA 10173
 * data export (2026-09-11). PURE: the projection, what is withheld and why, and
 * how a row is shaped for the file. The reads live in
 * app/api/profile/export/route.ts.
 *
 * WHAT IT IS. Every payment the couple logged against a supplier on an event
 * they OWN (member_type='couple'): the amount, when, how, the reference, their
 * own notes, whether the supplier confirmed it, and — since H4 — the supplier's
 * "it never reached me" and Setnayan's ruling, both of which the couple is
 * already shown. Each row names the supplier it was paid to, by business name,
 * because a ledger that only says `vendor_id` does not tell anyone whom they
 * paid.
 *
 * WHY IT WAS MISSING. The export's guardrail enforces only tables that carry a
 * subject column; the ledger joined that tier only when H4 added two actor
 * stamps, and was then classified as excluded with a note naming the gap.
 * The orchestrator ruled it in (2026-09-11).
 *
 * The receipt link is PRESIGNED and dies after RECEIPT_LINK_TTL_SECONDS; the
 * file says so per row, and keeps the durable storage key beside it, so an
 * export downloaded today and opened next month does not look broken.
 */

/** The ledger columns the subject receives. Split by the completeness test. */
export const LEDGER_EXPORT_SELECT =
  'payment_id, event_id, vendor_id, line_item_id, amount_php, paid_at, method, reference, notes, ' +
  'schedule_instance_seq, is_deposit_record, vendor_confirmed_at, payment_refused_at, ' +
  'payment_refusal_reason, payment_dispute_settled_at, payment_dispute_outcome, payment_dispute_note, ' +
  'proof_r2_key, created_at';

export const LEDGER_EXPORT_COLUMNS: readonly string[] = LEDGER_EXPORT_SELECT.split(',').map((c) => c.trim());

/**
 * Withheld from the subject, each with the reason. All three are OTHER PEOPLE's
 * account ids — a supplier's staff member, an admin — not facts about the
 * couple's payment. The facts those people recorded (confirmed when, refused
 * why, ruled what) ARE exported.
 */
export const LEDGER_EXPORT_OMITTED: Readonly<Record<string, string>> = {
  vendor_confirmed_by:
    'The account id of the supplier-side person who confirmed the payment — a third party’s identifier. The confirmation itself (vendor_confirmed_at) is exported.',
  payment_refused_by_user_id:
    'The account id of the supplier-side person who said the payment never arrived — a third party’s identifier. Their words and when (payment_refusal_reason, payment_refused_at) are exported.',
  payment_dispute_settled_by_user_id:
    'The account id of the Setnayan admin who ruled — staff identity, not the subject’s data. The ruling, its note and when are exported.',
};

/** The supplier each ledger row names. A narrow read — name and category only. */
export const LEDGER_SUPPLIER_SELECT = 'vendor_id, vendor_name, category';

/** How long a receipt link in the file stays usable. */
export const RECEIPT_LINK_TTL_SECONDS = 60 * 60 * 24;

export type LedgerExportRow = Record<string, unknown> & {
  payment_id?: string;
  vendor_id?: string;
  proof_r2_key?: string | null;
};
export type LedgerSupplierRow = { vendor_id?: string; vendor_name?: string | null; category?: string | null };
export type ReceiptLink = { url: string; expiresAt: string };

/**
 * The row as the subject reads it: every exported column, the supplier it was
 * paid to, and — when there is a receipt — a working link with its expiry. A
 * receipt the link could not be made for keeps its durable key and says why.
 */
export function shapeLedgerRows(
  rows: readonly LedgerExportRow[],
  suppliers: readonly LedgerSupplierRow[],
  receiptLinks: ReadonlyMap<string, ReceiptLink>,
): Array<Record<string, unknown>> {
  const byBooking = new Map(suppliers.filter((s) => s.vendor_id).map((s) => [s.vendor_id as string, s]));
  return rows.map((r) => {
    const supplier = r.vendor_id ? byBooking.get(r.vendor_id) : undefined;
    const link = r.payment_id ? receiptLinks.get(r.payment_id) : undefined;
    const hasReceipt = typeof r.proof_r2_key === 'string' && r.proof_r2_key.trim().length > 0;
    return {
      ...r,
      paid_to: supplier ? { business_name: supplier.vendor_name ?? null, category: supplier.category ?? null } : null,
      receipt_link: link?.url ?? null,
      receipt_link_expires_at: link?.expiresAt ?? null,
      ...(hasReceipt && !link
        ? { receipt_link_note: 'A link could not be made on this run; the receipt is kept at proof_r2_key.' }
        : {}),
    };
  });
}
