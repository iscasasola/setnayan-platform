/**
 * 🔌 THE ONE ADAPTER (J4 · the supplier badge page, controller 15 Nov 2026). Everything the badge page reads from the
 * jobs running beside it — J0's ladder (#7753, `lib/badge-tiers.ts`), J2's seals, J3's card badges, J5's graphs — comes
 * through THIS file and nowhere else, so when each lands the merge is a one-line change here and no page file moves.
 *
 * ⏳ UNTIL #7753 MERGES, the five badges' keys, steps and tier names are MIRRORED here, word for word from that branch
 * (owner 15 Nov: "these five shop badges … are the only badges"; DECISION_LOG 4b8cc3a3 · bc148e4e · 50566f42 ·
 * 219fb192). They are not a second source: `badge-sources.test.ts` reads `lib/badge-tiers.ts` and FAILS the day it
 * exports the same names with different values — and when it does, the body below becomes
 * `export { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, shopBadgeTier, TIER_KEYS, tierName } from '@/lib/badge-tiers';`.
 *
 * PURE: no I/O.
 */

export type ShopBadgeKey = 'completed_bookings' | 'five_star_reviews' | 'gifts_given' | 'trusted_by' | 'invites';
export type TierKey = 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5' | 'tier6' | 'tier7';

/** The five badges, in the order the page shows them. */
export const SHOP_BADGE_KEYS: readonly ShopBadgeKey[] = ['completed_bookings', 'five_star_reviews', 'gifts_given', 'trusted_by', 'invites'];

/** Each badge's own seven steps, Bronze first (lifetime counts — they never reset). */
export const SHOP_BADGE_STEPS: Readonly<Record<ShopBadgeKey, readonly number[]>> = {
  completed_bookings: [5, 25, 50, 100, 250, 500, 1000],
  five_star_reviews: [50, 250, 500, 1000, 2500, 5000, 10000],
  gifts_given: [150, 750, 1500, 3000, 5000, 10000, 20000],
  trusted_by: [1, 5, 10, 25, 50, 100, 250],
  invites: [1, 5, 10, 25, 50, 100, 250],
};

/** The seven tiers in order, Bronze first. */
export const TIER_KEYS: readonly TierKey[] = ['tier1', 'tier2', 'tier3', 'tier4', 'tier5', 'tier6', 'tier7'];

const TIER_NAMES: Readonly<Record<TierKey, string>> = {
  tier1: 'Bronze',
  tier2: 'Silver',
  tier3: 'Gold',
  tier4: 'Ruby',
  tier5: 'Emerald',
  tier6: 'Diamond',
  tier7: 'Black Diamond',
};

/** A tier's name by key ("Gold"). */
export function tierName(key: TierKey): string {
  return TIER_NAMES[key];
}

/** The highest tier a count has reached on one badge's own ladder; null below Bronze or for an unread count. */
export function shopBadgeTier(badge: ShopBadgeKey, count: number | null | undefined): TierKey | null {
  if (count == null || !Number.isFinite(count)) return null;
  const steps = SHOP_BADGE_STEPS[badge];
  let reached = -1;
  steps.forEach((s, i) => {
    if (count >= s) reached = i;
  });
  return reached < 0 ? null : TIER_KEYS[reached]!;
}
