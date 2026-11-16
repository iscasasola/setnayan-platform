/**
 * 🏅 PUBLIC BADGES — THE ONE ADAPTER the public surfaces read badges through (badge build J6, 15 Nov 2026).
 *
 * The surfaces: the explore shop card (`explore/_components/vendor-card.tsx` + `vendor-badge-row.tsx`) and the full
 * service card (`v/[slug]/_components/service-details-sheet.tsx`). They draw badges ONLY from what this file hands them.
 *
 * ── THE ONLY BADGES (owner, DECISION_LOG 2026-11-15, specs 4b8cc3a3: "the badges we created will be the only badges
 *    we have"; drawn in specs `prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html`) ──────────────────────
 *   · five tiered SHOP badges — Completed bookings · Five-star reviews · Gifts given · Trusted by · Invites;
 *   · the SEALS — Setnayan Verified · Verified Partner · Most In-Demand · Top 10 Supplier · No. 1 Supplier of the Year;
 *   · six SERVICE-CARD medals, layout D, in the row's order (ruling 7fbff0cd item 5): Hot Booking · Quick Responder ·
 *     Trending Now · Rave Reviews · Generous Giver · Setnayan Verified — Verified LAST (it is the shop's, on each card).
 *   Retired as badges: the explore pills `new` · `couple_trusted` · `most_booking` · `top_pick` (Setnayan Verified stays).
 *
 * ── WHY ONE FILE ──────────────────────────────────────────────────────────────────────────────────────────────────────
 * Three jobs are building the facts in parallel — J0 (the ladders and tier steps), J2 (the seals engine), J3 (the
 * card-badge holds). Their helpers are not on main yet. When one lands, ITS reader is wired HERE and nowhere else, and
 * the surfaces change with no edit of their own. Until then a family with no source is EMPTY — never a fake badge, never
 * a guessed tier — and the gap is named in `PUBLIC_BADGE_GAPS`.
 *
 * Pure: no I/O, no React. Held by `lib/public-badges.test.ts`.
 */

/** The retired explore pills — the old `VendorBadge` keys (`lib/vendor-badges.ts`) that no longer draw. */
export const RETIRED_EXPLORE_PILLS = ['new', 'couple_trusted', 'most_booking', 'top_pick'] as const;

/** The five tiered shop badges, in the prototype's order (`FAMT` in badge-milestones_v86). */
export const SHOP_BADGE_FAMILIES = [
  { key: 'bookings', name: 'Completed bookings' },
  { key: 'five_star', name: 'Five-star reviews' },
  { key: 'gifts', name: 'Gifts given' },
  { key: 'trusted_by', name: 'Trusted by' },
  { key: 'invites', name: 'Invites' },
] as const;
export type ShopBadgeFamily = (typeof SHOP_BADGE_FAMILIES)[number]['key'];

/** The seals named in the ruling (4b8cc3a3). Setnayan Verified is the one with a source today. */
export const SEALS = [
  { key: 'verified', name: 'Setnayan Verified' },
  { key: 'partner', name: 'Verified Partner' },
  { key: 'in_demand', name: 'Most In-Demand' },
  { key: 'top10', name: 'Top 10 Supplier' },
  { key: 'no1', name: 'No. 1 Supplier of the Year' },
] as const;
export type SealKey = (typeof SEALS)[number]['key'];

/** The six card medals, in the row's order — Setnayan Verified LAST (ruling 7fbff0cd item 5). */
export const CARD_MEDALS = [
  { key: 'hot_booking', name: 'Hot Booking' },
  { key: 'quick_responder', name: 'Quick Responder' },
  { key: 'trending_now', name: 'Trending Now' },
  { key: 'rave_reviews', name: 'Rave Reviews' },
  { key: 'generous_giver', name: 'Generous Giver' },
  { key: 'verified', name: 'Setnayan Verified' },
] as const;
export type CardMedalKey = (typeof CARD_MEDALS)[number]['key'];

/** A tier a shop badge has reached: its name ("Gold") and the count behind it. */
export type ShopTierBadge = { family: ShopBadgeFamily; name: string; tier: string; count: number };
export type PublicSeal = { key: SealKey; name: string };
export type CardMedal = { key: CardMedalKey; name: string };

/** Everything a public surface may draw for one shop (and, on a service card, that card). */
export type PublicBadgeView = {
  /** The shop holds Setnayan Verified (`hasVerifiedBadge` — the one predicate). */
  verified: boolean;
  shopBadges: ShopTierBadge[];
  seals: PublicSeal[];
  /** Layout D's row, in its order; empty = no row. */
  cardMedals: CardMedal[];
};

/**
 * What each family is read from — and, until its job lands, the gap. Shown in the PR and kept here so nobody mistakes
 * an empty row for "this shop has none": it means "not counted yet".
 */
export const PUBLIC_BADGE_GAPS: Readonly<Record<string, string>> = {
  shopBadges: 'J0 — the five ladders and their tier steps (v86 steps; main still holds the retired Events ladder)',
  seals: 'J2 — the seals engine (shop_seals); only Setnayan Verified has a source today',
  cardMedals: 'J3 — the card-badge holds (service_card_badge_holds); only Setnayan Verified has a source today',
  sheetVerified: 'the shop page passes no verification to the service card yet (app/v/[slug] — F2 / J3 own its callers)',
};

/**
 * The facts the adapter turns into a view. `verified` is the only one with a source on main; the others are filled by
 * J0 / J2 / J3 readers when they land — absent means "not counted", and draws nothing.
 */
export type PublicBadgeSource = {
  verified: boolean;
  /** J0 — reached tiers, by family. */
  tiers?: readonly ShopTierBadge[] | null;
  /** J2 — seals the shop holds now (Setnayan Verified is added from `verified`, never from here). */
  seals?: readonly SealKey[] | null;
  /** J3 — card medals this card holds now (Setnayan Verified is added from `verified`, never from here). */
  cardMedals?: readonly CardMedalKey[] | null;
};

const FAMILY_ORDER = SHOP_BADGE_FAMILIES.map((f) => f.key);

/** Build the view. Order is the prototype's; a key it does not know is dropped (never drawn under a guessed name). */
export function publicBadgeView(src: PublicBadgeSource): PublicBadgeView {
  const sealKeys = new Set<SealKey>((src.seals ?? []).filter((k) => k !== 'verified'));
  if (src.verified) sealKeys.add('verified');
  const medalKeys = new Set<CardMedalKey>((src.cardMedals ?? []).filter((k) => k !== 'verified'));
  if (src.verified) medalKeys.add('verified');
  return {
    verified: src.verified,
    shopBadges: [...(src.tiers ?? [])]
      .filter((t) => FAMILY_ORDER.includes(t.family) && t.count > 0 && t.tier.trim() !== '')
      .sort((a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family)),
    seals: SEALS.filter((s) => sealKeys.has(s.key)).map((s) => ({ key: s.key, name: s.name })),
    cardMedals: CARD_MEDALS.filter((m) => medalKeys.has(m.key)).map((m) => ({ key: m.key, name: m.name })),
  };
}

/** The explore pills that still draw: Setnayan Verified alone (the rest retired, 4b8cc3a3). */
export function keptExplorePills<T extends string>(badges: readonly T[]): Array<T & 'verified'> {
  return badges.filter((b): b is T & 'verified' => b === 'verified');
}

/**
 * The name an explore card shows (ruling 7fbff0cd item 9: unverified shops show their REAL name; only the check and the
 * Verified seal are missing). The stored business name when there is one; the old placeholder only for a shop with no
 * name at all.
 */
export function publicShopName(businessName: string | null | undefined, placeholder: string): string {
  const real = (businessName ?? '').trim();
  return real.length > 0 ? real : placeholder;
}
