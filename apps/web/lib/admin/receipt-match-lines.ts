/**
 * receipt-match-lines.ts — one "Matches ✓" / "Doesn't match: <field> · <diff>" line per field read off a payment's
 * photo (admin reorg v7, Payments to confirm; DECISION_LOG 2026-11-17 "PAYMENTS: THE ADMIN VERIFIES THE MATCH AND
 * APPROVES — NOTHING AUTO-CONFIRMS", owner: *"payment flow is admin verifies and approves payment that they match"*).
 *
 * 🔑 A HELP LINE, NEVER A GATE. It reads the advisory row `payment_receipt_reads` already writes (reference_matches,
 * amount_matches, seen_references, seen_amounts) and says it per field. Nothing here confirms, and nothing calls an
 * action: the admin always presses Confirm themself (`lib/an-ai-may-not-approve-money.test.ts`).
 *
 * ⚖ NULL IS NOT FALSE. A field the reader could not answer says "Couldn't tell", never "Doesn't match" — that would be
 * an accusation about a person whose picture merely came out blurry (the migration's own rule).
 */
export type ReceiptReadForLines = {
  status: 'ok' | 'unreadable' | 'failed';
  reference_matches: boolean | null;
  amount_matches: boolean | null;
  seen_references: string[] | null;
  seen_amounts: number[] | null;
};

export type ReceiptMatchLine = { field: 'Reference' | 'Amount'; tone: 'match' | 'mismatch' | 'unknown'; text: string };

const peso = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

export function receiptMatchLines(read: ReceiptReadForLines | undefined): ReceiptMatchLine[] {
  if (!read || read.status !== 'ok') return [];
  const one = (
    field: ReceiptMatchLine['field'],
    verdict: boolean | null,
    seen: string[],
  ): ReceiptMatchLine => {
    if (verdict === true) return { field, tone: 'match', text: 'Matches ✓' };
    if (verdict === false) {
      const diff = seen.length > 0 ? `the photo shows ${seen.join(' · ')}` : 'not on the photo';
      return { field, tone: 'mismatch', text: `Doesn’t match: ${field.toLowerCase()} · ${diff}` };
    }
    return { field, tone: 'unknown', text: 'Couldn’t tell from the photo' };
  };
  return [
    one('Reference', read.reference_matches, read.seen_references ?? []),
    one('Amount', read.amount_matches, (read.seen_amounts ?? []).map(peso)),
  ];
}
