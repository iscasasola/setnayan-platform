/**
 * answers-desk.ts — the PURE rules behind the supplier's Answers Desk.
 *
 * THE DESK IS NOT A NEW PAGE. It is the "What's new" feed that already ships on
 * `/vendor-dashboard` (assembled in `vendor-overview.ts`, drawn in
 * `overview-sections.tsx`): one list across all of a supplier's celebrations,
 * oldest-waiting first, with the age on the row. What was missing is not the
 * list — it is what reaches it, and whether the answer can be given ON it.
 *
 * WHY THIS MODULE EXISTS SEPARATELY: `vendor-overview.ts` imports 'server-only',
 * and in this repo such a module cannot be imported by a `node:test` file at all
 * (Next aliases the package at build time; plain node throws MODULE_NOT_FOUND).
 * Every decision worth pinning therefore lives here, pure and testable — the
 * same split `vendor-overview-inquiry-card.ts` and seven other files already use.
 *
 * ── THE FOUR RULES ─────────────────────────────────────────────────────────
 *  1. A review joins at ANY rating. The shipped filter was `rating = 5 AND no
 *     reply`, so THE ONE REVIEW THAT MOST NEEDS AN ANSWER — a one-star — could
 *     never reach the desk. It was excluded by construction, and no count
 *     anywhere reported that it had been.
 *  2. A booking ask that has lapsed does not vanish. `vendor_agree_to_lock`
 *     expires LAZILY — only on the answer path — so a lapsed ask keeps
 *     `lock_request_state = 'pending'` forever, and the card kept saying "Last
 *     day to answer" (the day count floors at 0) about a question that could no
 *     longer be answered: pressing Agree returns `expired`. It becomes a closed
 *     line, in the same place, for a week.
 *  3. A meeting the couple proposed is time-boxed by the MEETING, not by a
 *     clock we chose. A tasting that already happened must not sit in a list
 *     ordered by who has waited longest.
 *  4. A message the shop did not send is a message somebody is waiting on. The
 *     desk's enquiry lane is pre-accept only, so a reply owed to a couple the
 *     shop has already booked appeared NOWHERE — while that is the exact thing
 *     we measure and publish as the shop's reply speed.
 *
 * ── FAILURE DIRECTION, CHOSEN ONCE ────────────────────────────────────────
 * Where a fact is missing or unparseable these rules fail toward SHOWING an
 * answerable row. A row that should not be there is noise; a row that is missing
 * is a couple waiting on somebody who was never told — which is the whole defect
 * this desk exists to close.
 */

/** A review reaches the desk when nobody has answered it — at any rating. */
export function reviewNeedsReply(review: {
  rating_overall: number | null;
  vendor_reply: string | null;
}): boolean {
  return !review.vendor_reply?.trim();
}

/**
 * How a review should be SPOKEN TO, in one place, so the card's colour and its
 * words can never disagree.
 *
 * The boundary is 4. A 4- or 5-star review is praise and its card is
 * decorative gold; anything at or below 3 — and anything whose rating we could
 * not read — is a shop's reputation asking for care, which is genuine status
 * and wears a warm semantic. This is the repo's own colour rule ("only genuine
 * status uses a warm semantic"), not a new one.
 */
export type ReviewTemper = 'praise' | 'criticism';

export function reviewTemper(rating: number | null): ReviewTemper {
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return 'criticism';
  return rating >= 4 ? 'praise' : 'criticism';
}

/**
 * How long a question whose window has CLOSED stays on the desk as one line —
 * the lapsed booking ask, and the meeting whose proposed time has passed.
 *
 * 🔑 A ROW THAT SIMPLY DISAPPEARS READS AS ONE YOU ANSWERED. The ask carries a
 * 7-day fuse; when it burns out the supplier needs to see that it burned out,
 * not to find the question gone.
 */
export const CLOSED_WINDOW_GRACE_DAYS = 7;

const DAY_MS = 86_400_000;

export type LockAskPhase =
  /** Still inside the window — the supplier can agree or turn it down. */
  | 'answerable'
  /** The window closed. One line saying so, in the same place, no buttons. */
  | 'lapsed'
  /** Long closed — off the desk entirely. */
  | 'dropped';

/**
 * @param expiresAt the MATERIALIZED deadline (`lock_request_expires_at`, stamped
 *   by the guard trigger on every transition into pending). Never a deadline
 *   recomputed here — the number shown must be the number enforced.
 */
export function lockAskPhase(expiresAt: string | null, now: number): LockAskPhase {
  if (!expiresAt) return 'answerable';
  const deadline = Date.parse(expiresAt);
  // An unreadable deadline is not a lapse. Refusing an answerable ask leaves a
  // couple blocked by a question the supplier is no longer shown.
  if (!Number.isFinite(deadline)) return 'answerable';
  if (now < deadline) return 'answerable';
  if (now < deadline + CLOSED_WINDOW_GRACE_DAYS * DAY_MS) return 'lapsed';
  return 'dropped';
}

export type MeetingAskPhase =
  /** The proposed time is still ahead — confirm it, or offer another. */
  | 'answerable'
  /** The time has been and gone. Shown as a closed line, out of the waited-longest order. */
  | 'passed'
  /** Long gone — off the desk entirely. */
  | 'dropped';

/**
 * A couple's meeting proposal is deadlined by the MEETING ITSELF — the fifth
 * time-box shape on this desk, and the only one we do not choose.
 *
 * A proposal carrying no time at all is answerable: `event_appointments`
 * permits a null `scheduled_at`, and such a row is a real ask ("can we meet?")
 * that nobody has answered. The card simply has nothing to confirm, so it
 * offers the way in rather than a button.
 *
 * 🔑 A PASSED PROPOSAL IS NOT DROPPED ON THE DAY IT PASSES, and it is not left
 * forever either. Nothing in the product flips a stale `proposed` row — the
 * couple's tasting request sits there indefinitely — so without a window the
 * desk would silently fill with meetings that already happened. It gets the same
 * one-week closed line the lapsed booking ask gets, sorted by the time that
 * passed rather than by when it was asked, so a dead ask can never claim the top
 * of a list ordered by who has waited longest.
 */
export function meetingAskPhase(scheduledAt: string | null, now: number): MeetingAskPhase {
  if (!scheduledAt) return 'answerable';
  const at = Date.parse(scheduledAt);
  if (!Number.isFinite(at)) return 'answerable';
  if (at > now) return 'answerable';
  if (now < at + CLOSED_WINDOW_GRACE_DAYS * DAY_MS) return 'passed';
  return 'dropped';
}

/**
 * Does the shop owe this conversation a reply?
 *
 * 🔑 ASKED OF THE LAST MESSAGE'S AUTHOR, NOT OF AN UNREAD MARKER. Reading a
 * message is not answering it, and the desk is a list of answers owed.
 *
 * Anything the SHOP did not send counts. `chat_sender_role` is
 * couple · vendor · coordinator today; a coordinator writes for the couple, and
 * a role added tomorrow would still be somebody waiting — so this asks the one
 * question that survives the enum growing.
 */
export function threadOwesReply(lastSenderRole: string | null): boolean {
  return lastSenderRole !== null && lastSenderRole !== 'vendor';
}

/**
 * THE ANSWERS THAT MUST NOT JOIN THE DESK YET — and why, in the supplier's
 * terms. Exported as data so the guard reads this list rather than a
 * hand-copied one, and so removing a row is a deliberate edit here.
 *
 * ⛔ Every one of these is a door onto nothing. A row would be a promise the
 * product cannot keep, which is worse than the absence: the supplier presses,
 * something says it worked, and nobody is helped.
 */
export const ANSWERS_THAT_DO_NOT_JOIN: ReadonlyArray<{
  readonly slug: string;
  readonly why: string;
}> = [
  {
    slug: 'waitlist_pick',
    why: 'Choosing a waiting couple does nothing at all today and reports success.',
  },
  {
    slug: 'crew_shift',
    why: 'A paid crew shift cannot be posted, seen or accepted by anyone who is not a Setnayan admin — the database refuses all three, silently.',
  },
  {
    slug: 'song_request',
    why: 'Nobody can ask for a song: both submit routines exist in the database with zero application callers.',
  },
  {
    slug: 'payment_claim',
    why: 'Somebody-says-they-paid-you has no "no" — the only possible answer is yes, and it cannot be taken back. It joins once the row carries the receipt and there is a second button (owner decision).',
  },
];
