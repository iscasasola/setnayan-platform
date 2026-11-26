/**
 * What a Disputes press did, said on the page (A8·E-1, A8·E-13).
 *
 * The settle and decide actions already answer with a flag in the address —
 * `?settled=ok|already|no_dispute|…` and `?fee_dispute=accepted|rejected|…` —
 * but the page read neither, so a refused or raced press just made the row
 * disappear and a success said nothing. Each known flag maps to one plain
 * sentence; an unknown flag says nothing rather than guessing. `fee_dispute=error`
 * is left to the booking-fee section, which already says it in place.
 */
export type OutcomeLine = { tone: 'ok' | 'warn'; text: string };

const SETTLED: Record<string, OutcomeLine> = {
  ok: { tone: 'ok', text: 'Settled. Both sides are told.' },
  resolved: { tone: 'ok', text: 'Resolved. The person who opened it is told.' },
  already: { tone: 'warn', text: 'Another admin settled this one first. Nothing more was changed.' },
  no_dispute: { tone: 'warn', text: 'There is no open dispute on that any more — it may have been sent again. Nothing was changed.' },
  not_found: { tone: 'warn', text: 'That dispute could not be found. Refresh the list.' },
  needs_notes: { tone: 'warn', text: 'Write what was decided and why, then press again. Nothing was changed.' },
  invalid: { tone: 'warn', text: 'Pick an outcome, then press again. Nothing was changed.' },
};

const FEE_DISPUTE: Record<string, OutcomeLine> = {
  accepted: { tone: 'ok', text: 'Accepted. The fee is waived and the supplier is told.' },
  rejected: { tone: 'ok', text: 'Rejected. The bill stays and the supplier is told.' },
  already: { tone: 'warn', text: 'That fee dispute was already decided. Nothing more was changed.' },
  no_dispute: { tone: 'warn', text: 'There is no open fee dispute on that any more. Nothing was changed.' },
  not_admin: { tone: 'warn', text: 'Only an admin can decide a fee dispute. Nothing was changed.' },
};

export function disputesOutcomeLine(settled?: string, feeDispute?: string): OutcomeLine | null {
  if (settled && Object.hasOwn(SETTLED, settled)) return SETTLED[settled] ?? null;
  if (feeDispute && Object.hasOwn(FEE_DISPUTE, feeDispute)) return FEE_DISPUTE[feeDispute] ?? null;
  return null;
}
