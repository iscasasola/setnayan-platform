/**
 * 🏅 SHOP › BADGES — THE APPROVED SHELF (owner 15 Nov 2026, DECISION_LOG "THE BADGES IN THE APPROVED PROTOTYPE ARE THE
 * ONLY BADGES"; art: `prototypes/supplier_badges_2026-11-15/badge-milestones_v84.html`, its 35 tier pictures shipped
 * as `public/badges/v84/<family>-<tier>.webp`). Owner 17 Nov, on live: *"old pop ups of badges"*.
 *
 * The row is exactly the five tiered badges — Completed bookings · Five-star reviews · Gifts given · Trusted by ·
 * Invites — plus Setnayan Verified. The retired tiles (Events ladder, Reviews 5…500, Service cards, Inspiration box,
 * Branches, Booked Loop, the Firsts, Rating, Business since, Monthly awards) are no longer drawn as badges; their
 * facts stay where the screen already shows them (the cover's ★ and events, Analytics, Promote › Gifts).
 *
 * Built ON the shipped engine, never beside it: the counts are the reward engine's own reads (`BadgeRewardFacts`,
 * `readBadgeRewardFacts`), the steps and tier names `lib/badge-tiers.ts`, the words the J4 page model
 * (`badge-page-model.ts`), the reward lines `rewardLineFor` (`lib/badge-rewards.ts`). No number is typed here.
 *
 * 🔑 HONEST: an unread count is "Couldn't load" — never "Not yet" and never 0. A badge with no counter says
 * "Not counted yet" (`BADGE_REWARDS[badge].measured === false`); Invites is counted since #7891.
 *
 * PURE — no I/O, no clock. 🔒 lib/shop-badge-shelf.test.ts
 */
import { BADGE_WORDS } from '@/app/vendor-dashboard/shop/_components/badges/badge-page-model';
import { BADGE_REWARDS, rewardLineFor, tierRewardKey, type BadgeRewardFacts, type GrantedReward, type RewardNames } from './badge-rewards';
import { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS, TIER_KEYS, shopBadgeTier, tierName, type ShopBadgeKey } from './badge-tiers';

/** The name the Verified tile wears on the shelf and in every list that names the shelf's badges. */
export const VERIFIED_TILE_TITLE = 'Setnayan Verified';

/**
 * 🧮 THE SHELF'S ONE BADGE LIST: what the badge row draws, in rank order — Setnayan Verified, then the five tiered
 * badges (`SHOP_BADGE_KEYS`). `shopBadgeShelf` builds its tiles from it, and every surface that counts or names the
 * Toolkit's badges (the Toolkit's own count, /for-suppliers' count and its "See all" sheet) reads THIS list, so the
 * two can never disagree (walk 24 Nov: the Toolkit said 6 badges, /for-suppliers 5). 🔒 lib/one-badge-list.test.ts
 */
export const SHELF_BADGE_KEYS: readonly ('verified' | ShopBadgeKey)[] = ['verified', ...SHOP_BADGE_KEYS];

export type ShelfFamily = 'calendar' | 'bubble' | 'giftbox' | 'shield' | 'invite';

/** Each badge's picture family in the approved art (v84 `FAMT`). */
export const SHELF_FAMILY: Readonly<Record<ShopBadgeKey, ShelfFamily>> = {
  completed_bookings: 'calendar',
  five_star_reviews: 'bubble',
  gifts_given: 'giftbox',
  trusted_by: 'shield',
  invites: 'invite',
};

/** The approved picture of one tier (1 = Bronze … 7 = Black Diamond). Static files: never in the JS bundle. */
export function badgeArtSrc(family: ShelfFamily, tier: number): string {
  return `/badges/v84/${family}-${Math.max(1, Math.min(7, Math.round(tier)))}.webp`;
}
/** The pictures' own size (px) — every v84 tier image is 300 × 286. */
export const BADGE_ART_W = 300;
export const BADGE_ART_H = 286;

/**
 * 📐 THE ART'S OWN BOX in each v84 picture (owner 18 Nov, on his phone: *"the badges are small and not centered
 * properly"*). Every picture is a 300 × 286 canvas, but the drawn badge sits LOW in it with a soft shadow under it, and
 * the lower tiers are far smaller than the canvas (Bronze is ~158 × 165). Drawn at the canvas size, a Bronze badge was
 * about half the Verified check, sat high-and-low off its ring's middle, and the lock covered its face.
 * MEASURED, not guessed: the bounding box of alpha > 60 in each file (the shadow's faint tail is left out), read with
 * PIL from `public/badges/v84/*.webp` on 18 Nov 2026 — `[x0, y0, x1, y1]`, tiers 1 → 7.
 * 🔒 lib/shop-badge-shelf.test.ts re-measures nothing at test time; it holds the shape (7 boxes per family, inside the
 * canvas). Re-measure if the art files ever change.
 */
type ArtBox = readonly [number, number, number, number];
const ART_BOX: Readonly<Record<ShelfFamily, readonly ArtBox[]>> = {
  calendar: [[71, 86, 229, 251], [59, 86, 241, 251], [45, 35, 255, 251], [31, 26, 269, 251], [17, 18, 282, 251], [5, 10, 300, 251], [0, 1, 300, 251]],
  bubble: [[71, 97, 229, 269], [59, 97, 241, 269], [45, 35, 255, 269], [31, 26, 269, 269], [17, 18, 282, 269], [5, 10, 300, 269], [0, 1, 300, 269]],
  giftbox: [[71, 94, 229, 248], [59, 94, 241, 248], [45, 35, 255, 248], [31, 26, 269, 248], [17, 18, 283, 248], [5, 10, 300, 248], [0, 1, 300, 248]],
  invite: [[71, 95, 229, 258], [59, 95, 241, 258], [45, 35, 255, 257], [31, 26, 269, 257], [17, 18, 282, 257], [5, 10, 300, 257], [0, 1, 300, 257]],
  shield: [[71, 91, 229, 253], [59, 91, 241, 253], [45, 35, 255, 252], [31, 26, 269, 252], [17, 18, 283, 252], [5, 10, 300, 252], [0, 1, 300, 253]],
};
export const BADGE_ART_BOX = ART_BOX;

/**
 * Where to put a v84 picture so its DRAWN badge fills a `box` × `box` square, centred both ways: the image's width and
 * its offset inside that square (px). null for a src that is not a v84 tier picture (the caller draws it as before).
 */
export function badgeArtFit(src: string, box: number): { width: number; left: number; top: number } | null {
  const m = /\/badges\/v84\/(calendar|bubble|giftbox|shield|invite)-([1-7])\.webp$/.exec(src);
  if (!m) return null;
  const [x0, y0, x1, y1] = ART_BOX[m[1] as ShelfFamily][Number(m[2]) - 1]!;
  const w = x1 - x0;
  const h = y1 - y0;
  const s = box / Math.max(w, h);
  const r = (n: number) => Math.round(n * 10) / 10;
  return { width: r(BADGE_ART_W * s), left: r((box - w * s) / 2 - x0 * s), top: r((box - h * s) / 2 - y0 * s) };
}

export const COULDNT_LOAD = 'Couldn’t load';
export const NOT_COUNTED_YET = 'Not counted yet';
export const VERIFIED_HOW = 'Send the three business papers; Setnayan checks the owner, the papers and the work.';

export type ShelfState = 'earned' | 'locked' | 'unread' | 'not_counted';

export type ShelfTile = {
  key: ShopBadgeKey | 'verified';
  title: string;
  state: ShelfState;
  /** Tiered badges: their family (the picture and the tap show). Verified: null (the blue check). */
  family: ShelfFamily | null;
  /** 1-based tier reached; null when not reached. */
  tier: number | null;
  tierName: string | null;
  /** The picture drawn: the tier reached, or Bronze (greyed, under a lock) before it. Null for Verified. */
  src: string | null;
  /** The line under the caption: "Gold" · "7 to go" · "Not yet" · "Couldn't load" · "Not counted yet". */
  sub: string;
  /** The closest goal's "N to go" is the one that stands out. */
  goal: boolean;
  /** The progress ring, 0–100 (toward the next tier; an earned top tier or Verified = 100). */
  pct: number;
  /** What it counts (the old sheet's first line). */
  how: string;
  /** "Now: 63 bookings" — the old sheet's Now line; null when unread / not counted / Verified. */
  now: string | null;
  /** "72% of the way to Ruby" — the old sheet's bar, in words; null at the top or when not counted. */
  progress: string | null;
  /** "Next goal: Ruby at 100 bookings — 37 to go" — null at the top. */
  next: string | null;
  /** The same goal, short: "Ruby at 100 bookings · 37 to go" — what the Shop header says (`shelfNextBadgeLine`). */
  nextShort: string | null;
  /** The reward lines (the old sheet's Reward box): what it gave, and the next reward. */
  reward: { gave: string | null; next: string | null };
  /** ISO time the tier reached was granted (from the shop's rewards), for "Awarded …"; null when unknown. */
  awardedAt: string | null;
  /** A door to act on it (Verified's papers). */
  door: { label: string; href: string } | null;
  /** Ring colour group. */
  ring: 'bookings' | 'reputation' | 'found';
};

export type ShelfInput = {
  /** The reward engine's counts; null = unread → every tiered badge says "Couldn't load". */
  counts: BadgeRewardFacts | null;
  /** Setnayan Verified: true / false, or null = unread. */
  verified: boolean | null;
  /** The shop's rewards (for "Awarded …" and "Gave you …"); null = unread → those lines are left out. */
  granted: readonly GrantedReward[] | null;
  names?: RewardNames;
};

const fmt = (n: number) => new Intl.NumberFormat('en-PH').format(n);

const COUNT_OF: Readonly<Record<ShopBadgeKey, (f: BadgeRewardFacts) => number | null | undefined>> = {
  completed_bookings: (f) => f.completedBookings,
  five_star_reviews: (f) => f.fiveStarReviews,
  gifts_given: (f) => f.giftPoints,
  trusted_by: (f) => f.trustedBy,
  invites: (f) => f.invites,
};

const RING_OF: Readonly<Record<ShopBadgeKey, ShelfTile['ring']>> = {
  completed_bookings: 'bookings',
  trusted_by: 'bookings',
  five_star_reviews: 'reputation',
  gifts_given: 'found',
  invites: 'found',
};

function grantedAt(granted: readonly GrantedReward[] | null, key: string): string | null {
  const g = granted?.find((r) => r.key === key && !r.revokedAt);
  return g?.grantedAt ?? null;
}

/** One tiered badge's tile. */
export function shelfBadge(badge: ShopBadgeKey, i: ShelfInput): ShelfTile {
  const words = BADGE_WORDS[badge];
  const family = SHELF_FAMILY[badge];
  const base = {
    key: badge,
    title: words.name,
    family,
    goal: false,
    how: words.counts,
    door: null,
    ring: RING_OF[badge],
  } as const;
  const measured = BADGE_REWARDS[badge].measured;
  const raw = i.counts ? COUNT_OF[badge](i.counts) : null;
  const firstReward = rewardLineFor(badge, null, null, i.granted, i.names);
  if (!measured) {
    return { ...base, state: 'not_counted', tier: null, tierName: null, src: badgeArtSrc(family, 1), sub: NOT_COUNTED_YET, pct: 0, now: null, progress: null, next: words.locked, nextShort: null, reward: firstReward, awardedAt: null };
  }
  if (raw == null || !Number.isFinite(raw)) {
    return { ...base, state: 'unread', tier: null, tierName: null, src: badgeArtSrc(family, 1), sub: COULDNT_LOAD, pct: 0, now: null, progress: null, next: null, nextShort: null, reward: firstReward, awardedAt: null };
  }
  const count = Math.max(0, Math.trunc(raw));
  const steps = SHOP_BADGE_STEPS[badge];
  const reached = shopBadgeTier(badge, count);
  const ri = reached ? TIER_KEYS.indexOf(reached) : -1;
  const nextStep = steps[ri + 1] ?? null;
  const nextTier = TIER_KEYS[ri + 1] ?? null;
  const from = ri >= 0 ? steps[ri]! : 0;
  const pct = nextStep === null ? 100 : Math.max(0, Math.min(100, Math.round(((count - from) / (nextStep - from)) * 100)));
  const unit = words.unit;
  const now = `Now: ${fmt(count)} ${unit(count)}`;
  const progress = nextStep !== null && nextTier ? `${pct}% of the way to ${tierName(nextTier)}` : null;
  // ONE goal, two lengths: the tile's sheet says `next`, the Shop header says `nextShort` — built from the same step.
  const goalAt = nextStep !== null && nextTier ? `${tierName(nextTier)} at ${fmt(nextStep)} ${unit(nextStep)}` : null;
  const goalToGo = nextStep !== null ? `${fmt(nextStep - count)} to go` : null;
  const next = goalAt && goalToGo ? `Next goal: ${goalAt} — ${goalToGo}` : null;
  const nextShort = goalAt && goalToGo ? `${goalAt} · ${goalToGo}` : null;
  const reward = rewardLineFor(badge, count, null, i.granted, i.names);
  if (!reached) {
    return { ...base, state: 'locked', tier: null, tierName: null, src: badgeArtSrc(family, 1), sub: 'Not yet', pct, now, progress, next, nextShort, reward, awardedAt: null };
  }
  const tier = ri + 1;
  return {
    ...base,
    state: 'earned',
    tier,
    tierName: tierName(reached),
    src: badgeArtSrc(family, tier),
    sub: tierName(reached),
    pct,
    now,
    progress,
    next,
    nextShort,
    reward,
    awardedAt: grantedAt(i.granted, tierRewardKey(badge, reached)),
  };
}

/** Setnayan Verified's tile — the blue check, no tiers. */
export function shelfVerified(i: ShelfInput): ShelfTile {
  const reward = rewardLineFor('verified', null, i.verified, i.granted, i.names);
  const base = { key: 'verified' as const, title: VERIFIED_TILE_TITLE, family: null, tier: null, tierName: null, src: null, goal: false, how: VERIFIED_HOW, now: null, progress: null, next: null, nextShort: null, reward, ring: 'found' as const };
  if (i.verified === null) return { ...base, state: 'unread', sub: COULDNT_LOAD, pct: 0, awardedAt: null, door: null };
  if (i.verified) return { ...base, state: 'earned', sub: 'Verified', pct: 100, awardedAt: grantedAt(i.granted, 'verified'), door: null };
  return { ...base, state: 'locked', sub: 'Not yet', pct: 0, awardedAt: null, door: { label: 'Send your documents', href: '/vendor-dashboard/profile#docs' } };
}

const BAND: Readonly<Record<ShelfState, number>> = { earned: 0, locked: 1, not_counted: 2, unread: 3 };

/**
 * The row: what is EARNED first, far left (Verified, then the badges in the prototype's order); then the badges IN
 * PROGRESS, the closest first — that one says "N to go" (Lane E, 9 Nov); then not counted and unread.
 * Owner 18 Nov, verbatim: *"the sequence is completed nearest to achieve the next badge and then the highest ranking of
 * them all"* — a tie goes by rank, lowest first (Verified, then the prototype's order). When the seals join this row
 * (Part B, drawn, not built) they come last, highest last, ending with No. 1. 🔒 lib/shop-badge-shelf.test.ts § 9.
 */
export function shopBadgeShelf(i: ShelfInput): ShelfTile[] {
  const tiles = SHELF_BADGE_KEYS.map((k) => (k === 'verified' ? shelfVerified(i) : shelfBadge(k, i)));
  const order = new Map(tiles.map((t, n) => [t.key, n]));
  const sorted = [...tiles].sort((a, b) => {
    const band = BAND[a.state] - BAND[b.state];
    if (band) return band;
    // Within "in progress" (locked with a count) the closest goal leads; Verified-not-yet sits after the counted ones.
    if (a.state === 'locked' && b.state === 'locked') return b.pct - a.pct || order.get(a.key)! - order.get(b.key)!;
    return order.get(a.key)! - order.get(b.key)!;
  });
  // The closest goal across the whole row — earned badges climbing to their next tier count too.
  const climbing = sorted.filter((t) => t.family && (t.state === 'earned' || t.state === 'locked') && t.next !== null);
  const best = climbing.reduce<ShelfTile | null>((m, t) => (!m || t.pct > m.pct ? t : m), null);
  return sorted.map((t) => {
    if (t !== best) return t;
    const toGo = /— (.+) to go$/.exec(t.next ?? '')?.[1];
    return toGo ? { ...t, goal: true, sub: `${toGo} to go` } : t;
  });
}

/**
 * 🔒 THE SHOP HEADER'S "NEXT BADGE" IS THE COMPLETED BOOKINGS TILE'S OWN GOAL (W1 F2, 18 Nov: the header said
 * "Next badge: 10 events · 10 to go" from the retired events ladder while the tile said "Bronze at 5 bookings · 5 to
 * go"). It reads the tile — never a ladder of its own — so the two cannot disagree.
 * "Next badge: Bronze at 5 bookings · 5 to go"; null when the row is unread, the count is unread, or at the top.
 * 🔒 lib/shop-badge-shelf.test.ts
 */
export function shelfNextBadgeLine(tiles: readonly ShelfTile[] | null): string | null {
  const t = tiles?.find((x) => x.key === 'completed_bookings');
  return t?.nextShort ? `Next badge: ${t.nextShort}` : null;
}

/** The full screen's caption lines, under "Tier · Title · Awarded …" — nothing of the old sheet is lost. */
export function shelfLines(t: ShelfTile): string[] {
  return [t.now, t.progress, t.next, t.reward.gave, t.reward.next, t.how].filter((l): l is string => typeof l === 'string' && l.length > 0);
}

/** "12 Jan 2026" from an ISO time, in Manila. Null for none or a bad date. */
export function awardedOnWords(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Manila' }).format(d);
}
