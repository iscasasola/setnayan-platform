/**
 * WHAT THE FROZEN-PRICE LINE IN A CHAT THREAD IS ALLOWED TO SAY.
 *
 * 🔴 THE DEFECT THIS REPLACES. `chat-amendment-card.tsx` rendered a single
 * hardcoded sentence — "🔒 Deal locked — price frozen." — the instant
 * `proposal_amendments.locked_at` was stamped, with NO role test and NO
 * knowledge of the handshake. Under PR-H (live since 2026-08-29, owner
 * confirmed) the couple pressing Lock only ASKS: the row stays `considering`
 * with a 48-hour fuse and the supplier's yes is what books it. So BOTH people
 * were told a deal was locked at the moment nothing was booked, and the
 * supplier was told it by the very card sitting above their unanswered request.
 *
 * ⚖ THE DATABASE IS RIGHT AND ONLY THE WORDS WERE WRONG. Nothing here changes
 * the handshake, the freeze, or who books. The price freeze is REAL in every
 * branch — it is the number the two of them agreed, and `vendor_agree_to_lock`
 * books off it — so every line below still says the price is frozen. What
 * changes is that a BOOKING is only claimed where there is one.
 *
 * 🔑 THE SAFE DEFAULT IS THE VAGUE ONE. A caller that supplies no handshake
 * (an off-platform supplier with no booking row, the flag off, or a mount site
 * somebody forgot to wire) gets "price agreed and frozen" — true in every case
 * — never "deal locked". A missed wiring degrades to less detail, never to a
 * lie. `lock-freeze-copy.test.ts` pins that, and a source guard pins that every
 * <ChatMessageStream> mount passes the handshake.
 */
import { lockRequestFuseLabel, type LockRequestState } from '@/lib/lock-request-state';

export type LockFreezeTone =
  /** A real booking exists. */
  | 'booked'
  /** No price was ever saved with this Deal — nothing is frozen. */
  | 'unpriced'
  /** Asked; nobody is booked yet. */
  | 'waiting'
  /** The ask is over and nothing was booked. */
  | 'closed'
  /** The price is frozen and we make no claim about a booking. */
  | 'frozen';

export type LockFreezeLine = { tone: LockFreezeTone; text: string };

/**
 * The handshake state of the booking behind a chat thread, as the CARD reads
 * it. It lives here rather than in `thread-lock-handshake.server.ts` because
 * that module imports `server-only`, and the card is a client component — a
 * type import from there drags the server module into the browser bundle.
 */
export type ThreadLockHandshake = {
  state: LockRequestState;
  expiresAt: string | null;
};

export type LockFreezeInput = {
  /** Derived by `lockRequestStateOf`, or null/undefined when unknown. */
  state?: LockRequestState | null;
  /** The materialized deadline (`event_vendors.lock_request_expires_at`). */
  expiresAt?: string | null;
  viewerRole: 'couple' | 'vendor';
  /** The OTHER party's display label, as the thread already resolves it. */
  counterpartyLabel?: string | null;
  /**
   * Was a price actually saved with this Deal? REQUIRED, on purpose: every
   * sentence below except the unpriced one opens with "Price agreed and frozen
   * at this amount", and a Deal struck before any formal quote has no amount.
   * Before 2026-09-10 such a Deal could still be "locked" with a NULL price and
   * the card then claimed a frozen amount that did not exist. The caller knows
   * (it computed the total); it must say so.
   */
  priceFrozen: boolean;
  now?: Date;
};

const FROZEN = 'Price agreed and frozen at this amount.';

/**
 * The one sentence under an accepted, locked amendment. Never returns the
 * booked copy unless a booking actually exists.
 */
export function lockFreezeLine(input: LockFreezeInput): LockFreezeLine {
  const {
    state,
    viewerRole,
    expiresAt = null,
    counterpartyLabel,
    priceFrozen,
    now = new Date(),
  } = input;
  const them = counterpartyLabel?.trim() || (viewerRole === 'couple' ? 'the supplier' : 'the couple');

  // ── NO PRICE WAS SAVED. Say nothing is frozen — in EVERY state. The booking
  // state is the thread's, not this Deal's: a supplier booked some other way
  // does not give this Deal a price. The sentence is true whatever the handshake
  // says, and tells each side the one thing that would fix it.
  if (!priceFrozen) {
    return {
      tone: 'unpriced',
      text:
        viewerRole === 'couple'
          ? `No price was saved with this deal, so nothing is frozen here. Ask ${them} to send their quote.`
          : 'No price was saved with this deal, so nothing is frozen here. Send your proposal so the couple can lock a price.',
    };
  }

  if (state === 'locked') {
    return { tone: 'booked', text: 'Deal locked — price frozen.' };
  }

  if (state === 'requested') {
    const fuse = lockRequestFuseLabel(expiresAt, now);
    const body =
      viewerRole === 'couple'
        ? `${FROZEN} ${them} has been asked to take this booking — nothing is booked until they say yes.`
        : `${FROZEN} ${them} has asked you to take this booking — answer it on your Today page.`;
    return { tone: 'waiting', text: fuse ? `${body} ${sentenceCase(fuse)}.` : body };
  }

  if (state === 'declined') {
    return {
      tone: 'closed',
      text:
        viewerRole === 'couple'
          ? `${FROZEN} ${them} turned the booking down, so nothing is booked — you can pick someone else.`
          : `${FROZEN} You turned this booking down, so nothing is booked.`,
    };
  }

  if (state === 'expired') {
    return {
      tone: 'closed',
      text:
        viewerRole === 'couple'
          ? `${FROZEN} The booking request closed before it was answered, so nothing is booked — you can ask again.`
          : `${FROZEN} This booking request closed before it was answered, so nothing is booked.`,
    };
  }

  if (state === 'cancelled') {
    return {
      tone: 'closed',
      text: `${FROZEN} The booking request is no longer open, so nothing is booked.`,
    };
  }

  // 'none', null, undefined — no booking row to speak for (off-platform
  // supplier, handshake off, or an unwired caller). Say only what is certainly
  // true.
  return { tone: 'frozen', text: FROZEN };
}

function sentenceCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
