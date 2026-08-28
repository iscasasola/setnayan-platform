/**
 * THE PEOPLE OF THIS CELEBRATION — one rule, for every surface that asks.
 *
 * 🔴 WHY THIS MODULE EXISTS. `who-can-see-your-story.ts` answers a story kept
 * to `'event'` with `return viewer.belongsToEvent`, so that one boolean IS the
 * gate on a couple's restricted story. The on-screen story DERIVED it; the
 * print keepsake at `/{slug}/print` passed the literal `true`, so on a PUBLIC
 * or UNLISTED celebration an anonymous stranger could print, in full, the story
 * the couple had restricted to the people of the day — the same words the page
 * beside it correctly refused them.
 *
 * 🔑 A LITERAL IS NOT AN ANSWER. The docblock that justified it claimed the
 * route's earlier gates had already established membership. They had not:
 * `canViewSlugEvent` opens with `if (openToStrangers(visibility)) return true`,
 * which admits strangers OUTRIGHT and establishes nothing about belonging, and
 * `robots: noindex` is not access control.
 *
 * ⚖ THE RULE IS KEPT PURE, AND IN ITS OWN MODULE, for the reason `host-scope.ts`
 * is: the surfaces that need it are `server-only`, so only a module with no
 * server imports can be pinned by a unit test. Each surface resolves its own two
 * FACTS — it is the only one that knows how — and they share this one rule, so
 * the print sheet and the screen cannot drift apart into two opinions about who
 * belongs to somebody's wedding.
 *
 * ⚠ DELIBERATELY NOT WIDER THAN THE SCREEN. A signed-in SEAT-HOLDER with no
 * live guest cookie is not admitted here, because the on-screen story does not
 * admit them either. That gap is real and is NAMED, not silently closed: making
 * print more generous than the page it prints would be the same class of
 * divergence this module exists to end, in the other direction.
 */

/** What each surface must resolve for itself. Both facts, or the answer is no. */
export type BelongingFacts = {
  /** A redeemed invitation for THIS celebration, on this device. */
  holdsGuestPass: boolean;
  /** A supplier this celebration booked, signed in to the account that owns it. */
  isBookedSupplier: boolean;
};

/** A caller that establishes nothing gets the safest answer: a stranger. */
export const NOBODY: BelongingFacts = { holdsGuestPass: false, isBookedSupplier: false };

/**
 * Is this viewer one of the day's people?
 *
 * Total and fail-closed by construction — there is no arm that can answer
 * `true` without a fact having been established.
 */
export function belongsToThisEvent(facts: BelongingFacts = NOBODY): boolean {
  return facts.holdsGuestPass || facts.isBookedSupplier;
}
