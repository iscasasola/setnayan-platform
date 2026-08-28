/**
 * What a celebration HOLDS — the one line of Papic arithmetic the public page
 * is most likely to get backwards.
 *
 * Owner, 2026-08-29, looking at the credit dial: *"50 credits. 50 pesos become
 * 150 credits because it has a free 50 credits already."*
 *
 * The free grant is not rung zero and it is not an alternative to buying. It is
 * ALWAYS present and it ALWAYS STACKS on a top-up. A surface that shows what
 * the money bought, rather than what the celebration ends up holding,
 * understates every rung by the size of the grant — silently, on the one screen
 * where being wrong costs a sale.
 *
 * 🔑 THIS LIVES IN ITS OWN PURE MODULE ON PURPOSE. It was first written inline
 * in the dial with a test that re-declared the same sum beside it — which
 * proved nothing: gutting the component would have left that test green. A rule
 * worth pinning has to be the rule the component actually runs.
 */

/** Credits the celebration holds: what was bought, plus the free grant. */
export function papicCreditsHeld(bought: number, freeGrant: number): number {
  const b = Number.isFinite(bought) && bought > 0 ? Math.floor(bought) : 0;
  const f = Number.isFinite(freeGrant) && freeGrant > 0 ? Math.floor(freeGrant) : 0;
  return b + f;
}

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
