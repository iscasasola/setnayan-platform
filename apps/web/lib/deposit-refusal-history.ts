/**
 * deposit-refusal-history — how /admin/disputes words a deposit refusal that has
 * ENDED (FOLLOW-UPS A, 2026-09-11). The rows come from
 * `event_vendor_deposit_refusals`, written only by the database when a refusal
 * ends (migration 20271223918326). PURE.
 *
 * The list the page cares about most is `couple_resent`: a re-send takes a
 * dispute OFF the queue and puts the question back with the supplier. Before
 * this history existed that left no trace at all.
 */

export type RefusalClosure =
  | 'couple_resent'
  | 'supplier_confirmed'
  | 'setnayan_ruled_it_stands'
  | 'booking_deleted'
  | 'cleared_by_service';

export const REFUSAL_CLOSURE_LABEL: Record<RefusalClosure, string> = {
  couple_resent: 'the couple sent it again',
  supplier_confirmed: 'the supplier confirmed it after all',
  setnayan_ruled_it_stands: 'Setnayan ruled the payment stands',
  booking_deleted: 'the booking was removed',
  cleared_by_service: 'cleared by Setnayan tooling',
};

export type DepositRefusalHistoryRow = {
  refusal_id: string;
  event_vendor_id: string;
  vendor_name: string | null;
  refused_at: string;
  reason: string | null;
  dispute_outcome: string | null;
  dispute_note: string | null;
  closed_at: string;
  closed_by: string;
};

/** The history columns the page reads — one list, so the two reads agree. */
export const DEPOSIT_REFUSAL_HISTORY_COLUMNS =
  'refusal_id, event_vendor_id, vendor_name, refused_at, reason, dispute_outcome, dispute_note, closed_at, closed_by';

/** "the couple sent it again", or the raw value if the database grew a new one. */
export function closureLabel(closedBy: string): string {
  return (REFUSAL_CLOSURE_LABEL as Record<string, string>)[closedBy] ?? closedBy;
}

/** "Setnayan found it did not arrive — “no transfer”", or null when there was no ruling. */
export function rulingLine(row: Pick<DepositRefusalHistoryRow, 'dispute_outcome' | 'dispute_note'>): string | null {
  if (row.dispute_outcome !== 'payment_stands' && row.dispute_outcome !== 'not_received') return null;
  const verdict =
    row.dispute_outcome === 'payment_stands' ? 'Setnayan ruled the payment stands' : 'Setnayan found it did not arrive';
  const note = row.dispute_note?.trim();
  return note ? `${verdict} — “${note}”` : verdict;
}

/** Group history rows by booking, newest first within each. */
export function historyByBooking(rows: readonly DepositRefusalHistoryRow[]): Map<string, DepositRefusalHistoryRow[]> {
  const out = new Map<string, DepositRefusalHistoryRow[]>();
  for (const r of [...rows].sort((a, b) => (a.closed_at < b.closed_at ? 1 : a.closed_at > b.closed_at ? -1 : 0))) {
    const list = out.get(r.event_vendor_id) ?? [];
    list.push(r);
    out.set(r.event_vendor_id, list);
  }
  return out;
}
