/**
 * booking-ask-words.ts — THE WORDS FOR A BOOKING ASK, ON BOTH SIDES.
 *
 * Owner, 2026-10-10 (`SUPPLIER_CONNECTION_MAP_2026-10-10.md`, pair P2): the
 * couple's ask, the supplier's yes, a no, an ask that ran out and an ask taken
 * back must "all show on both pages in the same words". Until this file the
 * couple read "Asked to book · waiting for their yes" (Find) and nothing at all
 * once the supplier said no or the 48 hours ran out (map rows 14–15: the row
 * "simply disappears"), while the supplier read "They want to book you" and
 * "A booking window closed".
 *
 * ONE SENTENCE PER STATE, SPOKEN FROM EACH SIDE: the same opening, "Asked to
 * book", and the same outcome with the pronoun turned —
 *
 *   state       couple                                  supplier
 *   requested   Asked to book · waiting for their yes   Asked to book · waiting for your yes
 *   declined    Asked to book · they said no            Asked to book · you said no
 *   expired     Asked to book · no answer in 48 hours   Asked to book · you did not answer in 48 hours
 *   cancelled   Asked to book · you took it back        Asked to book · they took it back
 *   locked      Booked                                  Booked
 *
 * The state is `lockRequestStateOf` (`lib/lock-request-state.ts`) over the
 * row's own `(status, lock_request_state)` — the pair the supplier's answer
 * writes — so the two pages read ONE fact. The 48 is `LOCK_ANSWER_WINDOW_HOURS`,
 * the mirror the database test holds to the enforced window, never typed here.
 *
 * Guarded by `lib/booking-ask-words.test.ts` (the table, and that both pages
 * print these and no hand-typed copy of them).
 */
import { formatCount } from './format-number';
import { LOCK_ANSWER_WINDOW_HOURS, lockRequestStateOf, type LockRequestRow, type LockRequestState } from './lock-request-state';

export type AskViewer = 'couple' | 'supplier';
/** The ask states a sentence exists for. `none` has none: nobody asked. */
export type AskState = Exclude<LockRequestState, 'none'>;

const ASKED = 'Asked to book';
const HOURS = `${formatCount(LOCK_ANSWER_WINDOW_HOURS)} hours`;

const OUTCOME: Record<Exclude<AskState, 'locked'>, Record<AskViewer, string>> = {
  requested: { couple: 'waiting for their yes', supplier: 'waiting for your yes' },
  declined: { couple: 'they said no', supplier: 'you said no' },
  expired: { couple: `no answer in ${HOURS}`, supplier: `you did not answer in ${HOURS}` },
  cancelled: { couple: 'you took it back', supplier: 'they took it back' },
};

/** The one line for an ask in `state`, as `viewer` reads it. */
export function askLine(state: AskState, viewer: AskViewer): string {
  if (state === 'locked') return 'Booked';
  return `${ASKED} · ${OUTCOME[state][viewer]}`;
}

/** After a no, a lapse or a take-back the couple may simply ask again (the
 *  shipped rule — `lib/bench-card-actions.ts` offers Book again). */
export const ASK_AGAIN = 'you can ask again';

/** An ask that ENDED without a booking — the three the couple can ask again after. */
export type AskEnded = 'declined' | 'expired' | 'cancelled';

export function askEndedOf(state: LockRequestState | null | undefined): AskEnded | null {
  return state === 'declined' || state === 'expired' || state === 'cancelled' ? state : null;
}

/** The couple's line for an ask that ended: "Asked to book · they said no — you can ask again". */
export function coupleAskEndedLine(ended: AskEnded): string {
  return `${askLine(ended, 'couple')} — ${ASK_AGAIN}`;
}

/* ── THE SUPPLIER'S CUSTOMER CARD ─────────────────────────────────────────
 * The card's own `event_vendors` row (read with the service role, scoped to this
 * shop). While the ask is open the card answers it (Agree / Decline in place);
 * once it closed without a booking, the card says how — the line the couple's
 * Build and Find read for the same row. */

export type SupplierAskRow = LockRequestRow & {
  lock_declined_at?: string | null;
  lock_decline_reason?: string | null;
  lock_request_expires_at?: string | null;
  lock_request_cancelled_at?: string | null;
};

export type SupplierAskOutcome = {
  state: AskEnded;
  line: string;
  /** When it ended, as stored — null when the row carries no stamp. */
  at: string | null;
  /** The supplier's own reason, read back to them after a no. */
  words: string | null;
};

export function supplierAskOutcomeOf(row: SupplierAskRow | null | undefined, handshakeEnabled: boolean): SupplierAskOutcome | null {
  if (!row) return null;
  const ended = askEndedOf(lockRequestStateOf(row, handshakeEnabled));
  if (!ended) return null;
  const at =
    ended === 'declined'
      ? (row.lock_declined_at ?? null)
      : ended === 'expired'
        ? (row.lock_request_expires_at ?? null)
        : (row.lock_request_cancelled_at ?? null);
  const words = ended === 'declined' ? (row.lock_decline_reason?.trim() || null) : null;
  return { state: ended, line: askLine(ended, 'supplier'), at, words };
}
