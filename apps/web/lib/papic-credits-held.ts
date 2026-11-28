/**
 * 🎁 `papicCreditsHeld(bought, freeGrant)` WAS HERE — what an event holds, bought plus the free first-event
 * grant. That grant is retired (owner 16 Nov 2026, DECISION_LOG "Free 50 Papic credits REMOVED"), so an
 * event holds what was bought and the helper had nothing left to add.
 */

/**
 * How many ten-second videos a credit balance is worth.
 *
 * ⚠ TAKES THE CLIP WEIGHT, NEVER A LITERAL. A hand-written divisor is what
 * shipped a ~2.9× capacity overstatement past a green suite for months: the
 * copy was a template literal, so the source carried no digits at all and every
 * literal-scanning guard was blind to it. The weight has already moved once.
 */
export function papicVideosAffordable(credits: number, creditsPerVideo: number): number {
  if (!Number.isFinite(creditsPerVideo) || creditsPerVideo <= 0) return 0;
  return Math.floor(Math.max(0, credits) / creditsPerVideo);
}
