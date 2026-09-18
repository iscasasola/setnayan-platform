/**
 * WHAT A QUOTE CARD MAY OFFER — the one rule the in-thread card renders from.
 *
 * ── THE DEFECT THIS CLOSES (owner, live, 2026-09-18) ────────────────────────
 * The quote card read "₱10,170 · Accepted" and STILL showed "Review & accept".
 * The label was chosen by WHO was looking (couple → accept, supplier → view)
 * and never by what the quote's status was. An accepted quote must not offer
 * accept again; a superseded one must not offer anything but its history.
 *
 * ── THE RULING THIS SERVES (owner, 2026-09-18, option a) ────────────────────
 * A supplier may send a new quote at any time; it SUPERSEDES the live one, the
 * old one stays in the thread as history, and the couple's acceptance resets
 * to pending. "One thread, one live quote." So only the LATEST card carries
 * actions; every earlier card is a history marker, whatever its status says.
 *
 * ── WHY A PURE FUNCTION ─────────────────────────────────────────────────────
 * The card lives in a client component with realtime state; a guard that
 * greps its JSX for a label finds *a* button, not *the* button (the oldest bug
 * in this repo's toolkit). This decision is executed in
 * `a-revised-quote-must-be-accepted-again.test.ts` across every status ×
 * viewer × latest combination, and the card is only allowed to draw what it
 * is handed.
 *
 * ⛔ Nothing here writes. `respond_vendor_proposal` still refuses to accept a
 * quote that is not sent/viewed, and `supersede_prior_vendor_proposals`
 * refuses to retire an accepted quote once the booking is confirmed or a lock
 * is pending. This decides what to SHOW; the database decides what may happen.
 */
import type { LockRequestState } from './lock-request-state';

export type QuoteCardViewer = 'couple' | 'vendor';

export type QuoteCardInput = {
  /** `vendor_proposals.status` as the card was told it. */
  status: string;
  /** Is this the newest quote message in the thread? Only the latest is live. */
  isLatest: boolean;
  viewer: QuoteCardViewer;
  /**
   * The booking handshake behind this (event × supplier) pair, when known.
   * ABSENT MEANS UNKNOWN, never "not requested" — a mount that omits it gets
   * the honest middle ("Accepted") rather than an offer to lock a booking that
   * may already be asked for.
   */
  handshake?: LockRequestState | null;
};

export type QuoteCardPrimary =
  /** The couple reviews the full proposal and may accept there. */
  | { kind: 'review_accept'; label: 'Review & accept' }
  /** Open the full proposal — no decision is offered. */
  | { kind: 'view'; label: 'View proposal' };

export type QuoteCardState = {
  /** The one button that opens `/proposals/<publicId>`. */
  primary: QuoteCardPrimary;
  /** Couple only, live quote only: the amendment builder ("Counter-offer"). */
  offerCounter: boolean;
  /** Supplier only, live quote only: "Update this quote" (a new, superseding quote). */
  offerRevise: boolean;
  /**
   * Couple only, live ACCEPTED quote, no lock asked yet: point at the one
   * action that books — asking the supplier to lock, on the workspace page.
   * The thread does not book; the workspace's gate chain (date, impact,
   * downpayment, slots) does, and it must not be duplicated here.
   */
  offerLock: boolean;
  /**
   * One short line under the price for a quote that is no longer pending:
   * "Accepted" · "Replaced by a newer quote" · the handshake state. Null when
   * the status line beside the price already says everything.
   */
  note: string | null;
  /** Draw the card muted — it is history, not the live offer. */
  history: boolean;
};

const CONFIRMED_HANDSHAKE: ReadonlySet<LockRequestState> = new Set(['locked', 'requested']);

export function quoteCardState(input: QuoteCardInput): QuoteCardState {
  const { status, isLatest, viewer, handshake = null } = input;
  const couple = viewer === 'couple';
  const view: QuoteCardPrimary = { kind: 'view', label: 'View proposal' };

  // ── HISTORY: anything that is not the live quote. A superseded row stays in
  // the thread so the trail of what changed is legible; an earlier row that
  // somehow still says 'sent' is not offered either — there is one live quote.
  if (status === 'superseded' || !isLatest) {
    return {
      primary: view,
      offerCounter: false,
      offerRevise: false,
      offerLock: false,
      note: status === 'superseded' ? 'Replaced by a newer quote' : null,
      history: true,
    };
  }

  // ── THE LIVE QUOTE, PENDING: the couple decides; the supplier may revise.
  if (status === 'sent' || status === 'viewed') {
    return {
      primary: couple ? { kind: 'review_accept', label: 'Review & accept' } : view,
      offerCounter: couple,
      offerRevise: !couple,
      offerLock: false,
      note: null,
      history: false,
    };
  }

  // ── THE LIVE QUOTE, ACCEPTED: no accept. What comes next depends on whether
  // the couple has already asked to lock.
  if (status === 'accepted') {
    const asked = handshake != null && CONFIRMED_HANDSHAKE.has(handshake);
    const note =
      handshake === 'locked'
        ? 'Accepted · booked'
        : handshake === 'requested'
          ? couple
            ? 'Accepted · you have asked them to lock'
            : 'Accepted · the couple has asked you to lock'
          : couple
            ? 'Accepted · nothing is booked until you lock'
            : 'Accepted · waiting for the couple to lock';
    return {
      primary: view,
      offerCounter: false,
      // A supplier may still revise an accepted quote — that is the ruling —
      // until the couple has asked to lock at it or the booking is real. The
      // database refuses those two cases; the card stops offering first.
      offerRevise: !couple && !asked,
      // Only offered when we KNOW no lock is asked: unknown (null) stays quiet.
      offerLock: couple && handshake === 'none',
      note,
      history: false,
    };
  }

  // ── declined · expired · anything unexpected: read-only.
  return {
    primary: view,
    offerCounter: false,
    offerRevise: false,
    offerLock: false,
    note: null,
    history: status === 'declined' || status === 'expired',
  };
}
