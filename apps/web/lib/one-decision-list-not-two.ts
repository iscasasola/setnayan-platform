/**
 * ONE DECISION LIST, NOT TWO — and the RSVP chase is not on it.
 *
 * Owner-approved 2026-09-22. The event Overview used to render its decisions
 * TWICE: the bento's "Needs you this week" tile printed the first three rows,
 * and the Decisions board a few hundred pixels below printed all of them,
 * grouped. Between the two sat "All N decisions ↗" — an anchor to a list
 * already on the same screen.
 *
 * Measured live the same day (event 044f7e64): "Lock your coordinator" rendered
 * three times on one page, "Papic Guest 500" three times. The council's own
 * de-dup rule already said the bento is STATUS and the board is ACT; a preview
 * of the board is the board, in the status slot.
 *
 * ── WHAT THIS FILE IS FOR ───────────────────────────────────────────────────
 * The preview is gone, which is a deletion and needs no helper. What DOES need
 * one is the row that stayed: the unanswered-RSVP chase.
 *
 * It is deliberately NOT a cockpit decision and deliberately NOT counted in
 * `openDecisionCount` — that number means "cockpit decisions + payments", and
 * widening a shipped number's definition is worse than the row is worth. So it
 * had no home on the board and would have been deleted along with the preview
 * if nobody noticed.
 *
 * 🔑 AND IT WAS NESTED IN THE WRONG BRANCH. The row lived inside
 * `flatDecisions.length > 0`, so an event with **no open decisions but
 * seventy-seven unanswered invitations** rendered "Nothing needs a decision
 * right now" and said nothing at all about the RSVPs. The gate below cannot
 * express that bug: it does not take the decision count as an input, because
 * the decision count was never part of the question.
 */

export type RsvpChaseInput = {
  /** True once the celebration is over — `lifecyclePhase === 'after'`. */
  eventHasHappened: boolean;
  /** Guests with no reply recorded yet. */
  pending: number;
  /**
   * Has ANY guest replied? The honesty gate.
   *
   * A roster nobody has invited yet must never be nagged that "141 haven't
   * replied" — before the first reply arrives, silence is the truthful state.
   * An explicit "invitations were sent" signal would be the better gate, but
   * `computeGuestStats` has none; this is the conservative substitute, and it
   * is named as one rather than dressed up as a measurement.
   */
  repliesStarted: boolean;
};

/**
 * Whether to show "N guests haven't replied yet".
 *
 * Three conditions, none of them about decisions:
 *  · the day has not passed — chasing a reply to a party that is over is the
 *    purest form of the complaint that started the After phase;
 *  · somebody is actually outstanding;
 *  · at least one person has already replied, so the list is live.
 */
export function shouldChaseRsvps(input: RsvpChaseInput): boolean {
  if (input.eventHasHappened) return false;
  if (!Number.isFinite(input.pending) || input.pending <= 0) return false;
  return input.repliesStarted;
}
