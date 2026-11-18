/**
 * 🏅 THE SUPPLIER BADGE PAGE, AS WORDS AND STATES (J4; owner 15 Nov 2026 — prototype
 * `prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html`, "The five badges" and "Locked, before they are
 * earned"; DECISION_LOG 4b8cc3a3 · 7fbff0cd).
 *
 *   · the five badges, exactly: Completed bookings · Five-star reviews · Gifts given · Trusted by · Invites;
 *   · seven tiers each, Bronze to Black Diamond, each badge on its OWN steps (`badge-sources.ts`);
 *   · an award fact names the STEP REACHED — "Gold · 50 bookings" — never the running count (63 completed reads
 *     "Gold · 50", not "63"): the count moves every week, the award does not;
 *   · a badge not yet earned shows LOCKED, with what it takes ("Bronze at 5 bookings"); only the shop sees it — the
 *     couples' pages never draw a locked badge;
 *   · a count that could not be read says so (`unread`), never "locked" and never zero;
 *   · the page SAYS what does not count (owner 16 Nov): imported bookings never count toward Completed bookings, and a
 *     gift a badge reward paid for never counts toward Gifts given. The counting itself is J0's (#7753) readers'.
 *
 * PURE — no I/O, no clock.
 */
import { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, TIER_KEYS, shopBadgeTier, tierName, type ShopBadgeKey, type TierKey } from './badge-sources';

/** The page's words for one badge — the prototype's, verbatim. */
export const BADGE_WORDS: Readonly<Record<ShopBadgeKey, { name: string; unit: (n: number) => string; counts: string; locked: string }>> = {
  completed_bookings: {
    name: 'Completed bookings',
    unit: (n) => (n === 1 ? 'booking' : 'bookings'),
    // Owner, 16 Nov (DECISION_LOG fd5814dc): imports never count — a booking that came in as an import is not one.
    counts: 'Counts a booking only once it is complete: the event happened and was delivered. One wedding is one booking. Bookings you import don’t count.',
    locked: 'Bronze at 5 bookings',
  },
  five_star_reviews: {
    name: 'Five-star reviews',
    unit: (n) => (n === 1 ? 'five-star review' : 'five-star reviews'),
    counts: 'Counts five-star reviews only; a four-star review does not count.',
    locked: 'Bronze at 50 five-star reviews',
  },
  gifts_given: {
    name: 'Gifts given',
    unit: (n) => (n === 1 ? 'point' : 'points'),
    // Owner, 16 Nov: a gift a badge reward paid for never counts (a reward must not earn the next reward); a gift the
    // shop paid for does — including the Setnayan gift on every own client (183dcf14 · ebcad7fd).
    counts: 'Counts gift points, and only once the event the gift was for is complete. Each gift is worth points by its kind. A gift your badge reward paid for doesn’t count.',
    locked: 'Bronze at 150 points',
  },
  trusted_by: {
    name: 'Trusted by',
    unit: (n) => (n === 1 ? 'client' : 'clients'),
    counts: 'Counts the clients who booked you a second time. Each client counts once, on the second booking.',
    locked: 'Bronze when 1 client books you a second time',
  },
  invites: {
    name: 'Invites',
    unit: (n) => (n === 1 ? 'supplier' : 'suppliers'),
    counts: 'Counts the suppliers you added onto Setnayan, once that supplier has a completed booking.',
    locked: 'Bronze when 1 supplier you added has a completed booking',
  },
};

const fmt = (n: number) => new Intl.NumberFormat('en-PH').format(n);

/** One badge as the page draws it. */
export type BadgePageCard =
  | { key: ShopBadgeKey; name: string; state: 'unread'; line: string }
  | { key: ShopBadgeKey; name: string; state: 'locked'; line: string }
  | {
      key: ShopBadgeKey;
      name: string;
      state: 'earned';
      tier: TierKey;
      /** The STEP REACHED, never the count: "Gold · 50 bookings". */
      line: string;
      /** What the next tier takes ("Ruby at 100 bookings"), or null at Black Diamond. */
      next: string | null;
    };

/** The step value a tier stands for on one badge's ladder. */
export function stepOf(badge: ShopBadgeKey, tier: TierKey): number {
  return SHOP_BADGE_STEPS[badge][TIER_KEYS.indexOf(tier)]!;
}

/** "Gold · 50 bookings" — the tier and the step it stands for; the running count is never part of it. */
export function awardFact(badge: ShopBadgeKey, tier: TierKey): string {
  const step = stepOf(badge, tier);
  return `${tierName(tier)} · ${fmt(step)} ${BADGE_WORDS[badge].unit(step)}`;
}

/** One badge's card from its count; `null` = the count could not be read. */
export function badgeCard(badge: ShopBadgeKey, count: number | null): BadgePageCard {
  const name = BADGE_WORDS[badge].name;
  if (count == null || !Number.isFinite(count)) return { key: badge, name, state: 'unread', line: 'Couldn’t read this count just now.' };
  const tier = shopBadgeTier(badge, count);
  if (!tier) return { key: badge, name, state: 'locked', line: BADGE_WORDS[badge].locked };
  const i = TIER_KEYS.indexOf(tier);
  const nextTier = TIER_KEYS[i + 1];
  return {
    key: badge,
    name,
    state: 'earned',
    tier,
    line: awardFact(badge, tier),
    next: nextTier ? `${tierName(nextTier)} at ${fmt(stepOf(badge, nextTier))} ${BADGE_WORDS[badge].unit(stepOf(badge, nextTier))}` : null,
  };
}

/** The five cards, in the page's order; `counts` missing a key = that count was not read. */
export function badgePage(counts: Partial<Record<ShopBadgeKey, number | null>>): BadgePageCard[] {
  return SHOP_BADGE_KEYS.map((k) => badgeCard(k, counts[k] ?? null));
}
