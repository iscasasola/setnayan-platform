/**
 * service-reach.ts — what a shop is told, on its own card, about the reach its
 * declared price is earning.
 *
 * THE CLAIM IS DERIVED FROM THE SEARCH ITSELF, not written a second time. The
 * couple's category search prices a card with `paxAdjustedStartsAtPhp`
 * (lib/smart-sort) and feeds the result to `priceFitScore`; a card that function
 * cannot price comes back null, which the compat score reads as a NEUTRAL fit.
 * So this module asks the search's own question — "can this card be priced for a
 * couple?" — and says out loud what the answer costs the shop. If the search
 * ever changes how it prices a card, this claim changes with it instead of
 * quietly becoming a lie.
 *
 * ⛔ REACH IS NEVER THE SIZE OF THE PRICE. A ₱200,000 card and a ₱20,000 card
 * both have full reach; they simply reach different couples. The moment a bigger
 * number earns more reach we are selling placement, which the shop redesign
 * ruled out in terms. `reachLevel` has exactly two values for exactly that
 * reason — there is no ladder to climb.
 *
 * ⚠ AND "LIMITED" IS NOT "NOBODY". A priceless card is never removed from a
 * couple's results — `priceFitScore(null, …)` returns the neutral 0.5 and the
 * search fails open on every budget read. What a priceless card loses is the
 * ability to WIN on budget, and the figure a couple would otherwise see. Copy
 * here says exactly that; anything stronger would be an untrue threat.
 */

import { paxAdjustedStartsAtPhp, type ServicePricingRow } from './smart-sort';

export type ReachLevel = 'full' | 'limited';

export type ServiceReach = {
  level: ReachLevel;
  /** The card's own floor in PHP for a couple whose guest count we don't know
   *  yet — null when the card carries no usable price at all. */
  startsAtPhp: number | null;
  /** Short chip a shop reads at a glance. */
  label: string;
  /** One sentence explaining what that reach means, in the shop's own terms. */
  note: string;
};

const FULL_NOTE =
  'Couples searching within their budget can be matched to this card, and they see what it starts at.';
const LIMITED_NOTE =
  'It still appears in searches — but with no price we can’t tell which couples it suits, and they see no figure.';

/**
 * The reach one service card is earning. Pass the card's pricing columns as they
 * come back from `vendor_services`.
 */
export function serviceReach(svc: ServicePricingRow | null | undefined): ServiceReach {
  const { startsAtPhp } = paxAdjustedStartsAtPhp(svc, null);
  if (startsAtPhp == null) {
    return {
      level: 'limited',
      startsAtPhp: null,
      label: 'Limited reach — add a price',
      note: LIMITED_NOTE,
    };
  }
  return { level: 'full', startsAtPhp, label: 'Full reach', note: FULL_NOTE };
}

/**
 * How many of a shop's cards are reaching everyone they could. Used for the one
 * honest line above the list ("1 of 2 cards is reaching everyone it could").
 * Returns null when the shop has no cards, so the caller renders nothing rather
 * than "0 of 0".
 */
export function reachTally(
  services: ReadonlyArray<ServicePricingRow | null | undefined>,
): { full: number; total: number } | null {
  if (services.length === 0) return null;
  let full = 0;
  for (const s of services) if (serviceReach(s).level === 'full') full += 1;
  return { full, total: services.length };
}
