/**
 * 🏅🎁 BADGE REWARDS — THE ONE TABLE (owner 2026-11-05, DECISION_LOG "BADGE REWARDS — WHAT EACH BADGE GIVES, WHERE IT
 * LANDS, AND THE NEXT ONE SHOWN"; the aim behind every reward, same day: *"our goal is that the suppliers and
 * coordinators give as much inapp service as they can to the guest so we get automatic sales"*).
 *
 * The badge page and the granting BOTH read `BADGE_REWARDS` — so what a row promises is what is paid.
 *
 *   ⚖ ONE LADDER FOR EVERY BADGE (owner 2026-11-15, DECISION_LOG "SUPPLIER BADGES, SEALS AND REWARDS — THE OWNER'S
 *   RULINGS OF 15 NOV", verbatim: *"bronze - papic 150 · silver - papic 150 · gold - papic 1000 · ruby - papic 3000 ·
 *   emerald - event plus · diamond - event pro · black diamond - event ultra"*). A ladder's step pays by its TIER — its
 *   position on that badge's own ladder (`tierKeyAt`, `lib/badge-tiers.ts`): first step Bronze, second Silver …
 *   (`TIER_REWARDS`). ⚠ This SUPERSEDES the 8 Nov per-step table (Events 10/50 → Event Plus, 100 → 2 × Event Plus,
 *   500 → Event Pro, 1,000+ → a free booking fee; Reviews → Papic 150 each; Booked Loop → Event Plus each …). Each step
 *   still pays ONCE, under the SAME key — a step already paid under the 8 Nov table is never paid again, and a free
 *   booking fee already earned stays (no new one is earned).
 *   Laddered: Events on Setnayan · Reviews · 1st Pick · Booked Loop · Branches · Service cards · Inspiration box ·
 *             Trusted by (1·5·10·25·50·100·250, owner 15 Nov: *"Keep it"*).
 *   Once (unchanged): Verified · first booking · first review · first 5★ review · first Booked Loop · first 1st Pick →
 *            Papic 150 each (the first booking also 4 weeks 3D Booth; Papic Challenges for a Free or Verified shop —
 *            badge-upgrades). Verified also 4 weeks Papic Challenges.
 *   Monthly awards (unchanged), once per award per month: Most Booked / Top Pick → Event Plus (+ one 4-week upgrade of
 *                                             choice) · Rising → Event Plus
 *   No reward: Years in business · Rating · Plan / Founding / Member since · Yearly awards.
 *   Each step pays once, never expires, a regained rank does not pay twice, and sits outside the 40% gift limit.
 *
 * 💎 BLACK DIAMOND GIVES THE REAL EVENT ULTRA (owner 15 Nov, "Event ultra"). The plan approved 13 Nov
 * (`EVENT_ULTRA_SKU`, lib/event-ultra.ts) lands in the shop's gift stock as one 'event_ultra' unlock, goes on a quote
 * like Event Pro, and at the couple's first payment unlocks EVENT_ULTRA on their event with the catalogue row's included
 * Papic credits (migration 20271348181787). It is earned only — a shop cannot buy it (`shopGiftBuyable`).
 *
 * 🔑 NO PRICE AND NO PACK SIZE LIVES HERE. "Papic 150" is the SMALLEST Papic pack on the live catalogue
 * (`alwaysAllowedPack`, `lib/shop-gifts.ts`); "Papic 1000" and "Papic 3000" are the catalogue packs NAMED by their
 * product code (`PAPIC_PACK_CODE` — the same codes `lib/iap/products.ts` sells; a code is an identity, not a size).
 * Their credits and titles are read when a reward is granted or drawn, never typed; a pack the catalogue does not hold
 * pays nothing until it does. A reward is a COUNT of packs / unlocks / free fees.
 *
 * 🔑 EXACTLY ONCE: every reward has a KEY naming its badge and its step or period (`rewardKey`). The database holds
 * the key UNIQUE per shop (`shop_badge_rewards_once`), so a re-run, or a badge lost and earned again, never pays twice.
 *
 * 🔑 MEASURED OR NOT AT ALL: `measured: false` badges have no counter in the code yet. Their rows and their rewards
 * are drawn (owner: "wire the reward table and the UI for them anyway"), and NOTHING is granted for them — the facts
 * that would count them are not in `BadgeRewardFacts`, so no count can be faked.
 *
 * PURE — no I/O, no clock, no `server-only`. Reads and grants: `lib/badge-rewards.server.ts`.
 */

import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { stepName, type ShopBadge, type TrackerRow } from '@/lib/shop-badges';
import { SHOP_BADGE_STEPS, TIER_KEYS, tierKeyAt, tierName, type ShopBadgeKey, type TierKey } from '@/lib/badge-tiers';
import type { SpotlightAwardType } from '@/lib/spotlight-awards';
import { upgradeLineFor, type BadgeUpgradeRow } from '@/lib/badge-upgrades';

/**
 * What a reward is: gift-stock packs / unlocks (Papic · Event Plus · Event Pro · Event Ultra), or a free booking fee.
 */
export type BadgeRewardKind = 'papic' | 'event_plus' | 'event_pro' | 'event_ultra' | 'fee_waiver';

/** The kinds the grant door lands (`shop_badge_rewards_reward_kind_allowed`) — every kind, Event Ultra since 15 Nov. */
export const GRANTABLE_KINDS: ReadonlySet<BadgeRewardKind> = new Set([
  'papic',
  'event_plus',
  'event_pro',
  'event_ultra',
  'fee_waiver',
]);

/** Which Papic pack a Papic reward is: the smallest on the catalogue, or a pack named by its code. */
export type PapicPack = 'smallest' | 'papic_1000' | 'papic_3000';

/**
 * The two bigger packs, by their catalogue code — the codes `lib/iap/products.ts` sells as "Papic 1000" / "Papic
 * 3000" (`PAPIC_PACKS`). Identities, never sizes: the credits and the title are read from the catalogue
 * (`fetchShopPapicPacks`). Guarded against drift by `badge-rewards.test.ts`.
 */
export const PAPIC_PACK_CODE: Readonly<Record<Exclude<PapicPack, 'smallest'>, string>> = {
  papic_1000: 'PAPIC_GUEST_1K',
  papic_3000: 'PAPIC_GUEST',
};

/** A reward: how many of one kind ("2 × Papic 150" = { papic, 2 }); a Papic reward may name a bigger pack. */
export type BadgeReward = { kind: BadgeRewardKind; units: number; pack?: PapicPack };

const papic = (units = 1): BadgeReward => ({ kind: 'papic', units });
const papicPack = (pack: Exclude<PapicPack, 'smallest'>): BadgeReward => ({ kind: 'papic', units: 1, pack });
const plus = (units = 1): BadgeReward => ({ kind: 'event_plus', units });
const pro = (units = 1): BadgeReward => ({ kind: 'event_pro', units });
const ultra = (): BadgeReward => ({ kind: 'event_ultra', units: 1 });

/** ⚖ THE OWNER'S ONE LADDER (2026-11-15) — what each tier pays, on every laddered badge. */
export const TIER_REWARDS: Readonly<Record<TierKey, BadgeReward>> = {
  tier1: papic(1), // Bronze — Papic 150
  tier2: papic(1), // Silver — Papic 150
  tier3: papicPack('papic_1000'), // Gold — Papic 1000
  tier4: papicPack('papic_3000'), // Ruby — Papic 3000
  tier5: plus(1), // Emerald — Event Plus
  tier6: pro(1), // Diamond — Event Pro
  tier7: ultra(), // Black Diamond — the real Event Ultra (owner 15 Nov)
};

/** A badge's own steps, each paying its tier's reward from the one ladder. */
function tierLadder(steps: readonly number[]): RewardStep[] {
  return steps.map((step, i) => ({ step, tier: tierKeyAt(i), reward: TIER_REWARDS[tierKeyAt(i)] }));
}

/** The badges that pay a reward. */
export type RewardBadge =
  | 'completed_bookings'
  | 'five_star_reviews'
  | 'gifts_given'
  | 'invites'
  | 'verified'
  | 'first_booking'
  | 'first_review'
  | 'first_five_star'
  | 'first_loop'
  | 'first_first_pick'
  | 'events'
  | 'reviews'
  | 'first_pick'
  | 'booked_loop'
  | 'branches'
  | 'service_cards'
  | 'inspiration'
  | 'trusted_by'
  | 'award';

/** One step of a counted badge, its tier on that badge's ladder, and what reaching it pays (null = nothing). */
export type RewardStep = { step: number; tier?: TierKey; reward: BadgeReward | null };

type Base = {
  badge: RewardBadge;
  title: string;
  /** False ⇒ no counter exists in the code yet: drawn, never granted. */
  measured: boolean;
  /**
   * 🗄 RETIRED AS A BADGE (owner 15 Nov, 4b8cc3a3 "the badges we created will be the only badges we have", and the
   * retired-ladders row): NOTHING new is ever granted for it; what it already paid stays paid and keeps reading as
   * what it was (3cbf12c1). Kept in the table only for that.
   */
  retired?: boolean;
};

export type BadgeRewardRule =
  | (Base & { shape: 'once'; reward: BadgeReward })
  | (Base & { shape: 'ladder'; unit: readonly [singular: string, plural: string]; steps: readonly RewardStep[] })
  | (Base & { shape: 'period'; rewards: Readonly<Record<SpotlightAwardType, BadgeReward>> });

/**
 * Reviews' steps — the spec's list (`SUPPLIER_BADGES_AND_AWARDS_2026-11-03.md` §B). ⚖ Owner ruled 2026-11-05 (on the
 * draft PR): these steps, each paying Papic 150.
 */
export const REVIEW_STEPS: readonly number[] = [5, 10, 25, 50, 100, 250, 500];

/** 1st Pick and Booked Loop share the spec's ladder (§B). */
const LOOP_LADDER: readonly number[] = [1, 5, 10, 25, 50, 100, 250];

/** Service cards' steps (spec §B, owner approved the ladder 8 Nov): cards across services. */
export const SERVICE_CARD_STEPS: readonly number[] = [3, 6, 10, 20];

/** Inspiration box's steps (spec §B, approved 8 Nov): approved inspiration photos. */
export const INSPIRATION_STEPS: readonly number[] = [10, 25, 50, 100, 250];

/** Branches' steps (spec §B, approved 8 Nov). */
export const BRANCH_STEPS: readonly number[] = [2, 3, 5, 10];

/** Trusted by — clients who booked the shop on a second completed event (owner 15 Nov, 50566f42). */
export const TRUSTED_BY_STEPS: readonly number[] = SHOP_BADGE_STEPS.trusted_by;

const firstOnce = (badge: RewardBadge, title: string, measured: boolean): BadgeRewardRule => ({
  badge,
  title,
  measured,
  retired: true,
  shape: 'once',
  reward: papic(1),
});

/** One of the five tiered shop badges: its own steps (lib/badge-tiers.ts), each paying its tier from the one ladder. */
const shopLadder = (
  badge: ShopBadgeKey,
  title: string,
  unit: readonly [string, string],
  measured: boolean,
): BadgeRewardRule => ({ badge, title, measured, shape: 'ladder', unit, steps: tierLadder(SHOP_BADGE_STEPS[badge]) });

export const BADGE_REWARDS: Readonly<Record<RewardBadge, BadgeRewardRule>> = {
  /** Bookings whose event happened and was delivered (`vendor_public_completed_events_stats`). */
  completed_bookings: shopLadder('completed_bookings', 'Completed bookings', ['completed booking', 'completed bookings'], true),
  /** 5★ reviews under the trusted-review rule (`shop_trusted_five_star_count`). */
  five_star_reviews: shopLadder('five_star_reviews', 'Five-star reviews', ['five-star review', 'five-star reviews'], true),
  /** Gift points for gifts given on completed events (`shop_gift_points`, lib/gift-points.ts). */
  gifts_given: shopLadder('gifts_given', 'Gifts given', ['gift point', 'gift points'], true),
  /**
   * Suppliers the shop imported onto Setnayan, each counted once, at the imported supplier's first COMPLETED event
   * (owner 15 Nov, DECISION_LOG "BADGE OPEN ITEMS RULED" (3): "successful booking" = the event is completed — the same
   * test as Completed bookings). ⚠ NOT COUNTED YET: nothing records one supplier importing another — the import door
   * and its address are unbuilt and unruled (`/[slug]/invite` is the couple's guest invitation; `vendor_invites` is the
   * couple's invite; `vendor_partnerships` needs both shops to exist already). Ships showing "Not counted yet"; the
   * door's build supplies `BadgeRewardFacts.invites`.
   */
  invites: shopLadder('invites', 'Invites', ['supplier you added', 'suppliers you added'], false),
  verified: { badge: 'verified', title: 'SETNAYAN Verified', measured: true, shape: 'once', reward: papic(1) },
  first_booking: firstOnce('first_booking', 'First booking', true),
  first_review: firstOnce('first_review', 'First review', true),
  /** MEASURED since 2026-11-15: `shop_trusted_five_star_count` — 5★ reviews under the trusted-review rule. */
  first_five_star: firstOnce('first_five_star', 'First 5★ review', true),
  /** ⚖ THE ONE BUILD (spec §9 #11): counted since C2's `shop_booked_loop_count` — the first family who came back. */
  first_loop: firstOnce('first_loop', 'First Booked Loop', true),
  first_first_pick: firstOnce('first_first_pick', 'First 1st Pick', false),
  events: {
    badge: 'events',
    retired: true,
    title: 'Milestone · events on Setnayan',
    measured: true,
    shape: 'ladder',
    unit: ['event', 'events'],
    steps: tierLadder(MILESTONE_THRESHOLDS),
  },
  reviews: {
    badge: 'reviews',
    retired: true,
    title: 'Reviews',
    measured: true,
    shape: 'ladder',
    unit: ['review', 'reviews'],
    steps: tierLadder(REVIEW_STEPS),
  },
  first_pick: {
    badge: 'first_pick',
    retired: true,
    title: '1st Pick',
    measured: false,
    shape: 'ladder',
    unit: ['booking', 'bookings'],
    steps: tierLadder(LOOP_LADDER),
  },
  /**
   * The Booked Loop climbs the one tier ladder (owner 2026-11-15; was Event Plus at every step, 5 Nov). MEASURED since
   * THE ONE BUILD (spec §9 #11): C2's `shop_booked_loop_count(vendor)` — families who booked the shop on 2+ events
   * (`lib/shop-booked-loops.server.ts`); an unread count pays nothing and the badge is hidden.
   */
  booked_loop: {
    badge: 'booked_loop',
    retired: true,
    title: 'Booked Loop',
    measured: true,
    shape: 'ladder',
    unit: ['family who came back', 'families who came back'],
    steps: tierLadder(LOOP_LADDER),
  },
  branches: {
    badge: 'branches',
    retired: true,
    title: 'Branches',
    measured: true,
    shape: 'ladder',
    unit: ['branch', 'branches'],
    steps: tierLadder(BRANCH_STEPS),
  },
  service_cards: {
    badge: 'service_cards',
    retired: true,
    title: 'Service cards',
    measured: true,
    shape: 'ladder',
    unit: ['card', 'cards'],
    steps: tierLadder(SERVICE_CARD_STEPS),
  },
  inspiration: {
    badge: 'inspiration',
    retired: true,
    title: 'Inspiration box',
    measured: true,
    shape: 'ladder',
    unit: ['photo', 'photos'],
    steps: tierLadder(INSPIRATION_STEPS),
  },
  /**
   * Clients who booked the shop on a second completed event — each client once, at the second booking (50566f42).
   * Counted by `shop_booked_loop_count` (lib/shop-booked-loops.server.ts), which the ruling names as exactly this count.
   */
  trusted_by: shopLadder('trusted_by', 'Trusted by', ['client who came back', 'clients who came back'], true),
  award: {
    badge: 'award',
    title: 'Monthly awards',
    measured: true,
    shape: 'period',
    rewards: { most_booked: plus(1), top_pick: plus(1), rising: plus(1) },
  },
};

/** Badges the owner ruled pay NOTHING (so a row for them says nothing about rewards). */
export const NO_REWARD_BADGES: readonly string[] = ['years', 'rating', 'plan', 'founding', 'member_since', 'yearly_award'];

/**
 * Plan gifts (DECISION_LOG 2026-11-04 "ULTRA = ₱5,990…"): Pro 2 × Papic 150 and Ultra 6 × Papic 150 every 4 weeks.
 * ⚖ NOT GRANTED HERE — owner ruled 2026-11-05: build them later, as their OWN kind. Plan gifts lapse at the end of
 * each 4 weeks (4 Nov ruling); badge rewards never expire. Kept apart so neither rule breaks the other. The numbers sit
 * here so they have one home.
 * 🚫 NEVER FOR A PLAN GIVEN AS A VERIFICATION REWARD (owner 12 Nov 2026: *"We only give the service but not the gifts,
 * just for the verified and the founders verified"*). The Ultra weeks a verification grants carry Ultra's TOOLS only —
 * whoever builds the payer must skip a shop whose current plan is that reward (`readVerificationRewardPlanUntil`,
 * `lib/verification-plan-reward.server.ts`; `VERIFICATION_REWARD_CARRIES_PLAN_GIFTS`).
 */
export const PLAN_PERIOD_GIFTS: Readonly<Record<'pro' | 'enterprise', BadgeReward>> = { pro: papic(2), enterprise: papic(6) };

/* ── keys ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

/** The exactly-once key: `verified` · `first_review` · `events:50` · `branches:2` · `award:rising:2026-11-01`. */
export function rewardKey(badge: RewardBadge, part?: string | number): string {
  return part === undefined ? badge : `${badge}:${part}`;
}

/* ── what a shop is owed ──────────────────────────────────────────────────────────────────────────────────────── */

/**
 * What the shop's badges measure today. `null` = the read failed or the badge has no counter: NOTHING is granted for
 * it (never a zero, never a guess). 1st Pick, Booked Loop, and the firsts that hang off them (first loop, first 1st
 * Pick) are deliberately absent — no counter exists for them in the code.
 */
export type BadgeRewardFacts = {
  verified: boolean | null;
  /** The public completed-events count (`vendor_public_completed_events_stats`) — the milestone's own number. */
  completedEvents: number | null;
  /** Trusted reviews from booked couples (`vendor_trusted_review_stats`). */
  trustedReviews: number | null;
  /** The shop holds at least one Setnayan-sourced booking (`booking_fee_ledger` attribution 'sourced'). */
  firstSourcedBooking: boolean | null;
  /** Paid, live branches (`fetchPublicVendorBranches`) — the Branches ladder counts them. */
  branchIds: readonly string[] | null;
  /** Live service cards across the shop's services (`vendor_services` active, not link-only). */
  serviceCards: number | null;
  /** Approved, live inspiration photos (`moodboard_library_assets` supplier_gallery — the shop page's own predicates). */
  inspirationPhotos: number | null;
  /** Every Spotlight Award the shop has been given (`vendor_spotlight_awards`). */
  awards: ReadonlyArray<{ type: SpotlightAwardType; periodMonth: string }> | null;
  /**
   * 🔁 Families who booked the shop again (`shop_booked_loop_count`, C2 — THE ONE BUILD spec §9 #11). Absent or null
   * = not read: nothing is granted and the Booked Loop badge is hidden (never "not yet reached").
   */
  bookedLoops?: number | null;
  /** ⭐ 5★ reviews under the trusted-review rule (`shop_trusted_five_star_count`). Absent or null = unread. */
  fiveStarReviews?: number | null;
  /**
   * ✅ Completed bookings — the shop's delivered/complete bookings WITHOUT imports (`shop_completed_bookings_count`;
   * owner 16 Nov: imports never count toward a booking badge). Absent/null = unread. Not `completedEvents`, the public
   * completed-events number other screens show.
   */
  completedBookings?: number | null;
  /**
   * 🛡 Trusted by — clients who booked the shop a second time, imports counted (`shop_trusted_by_count`, 50566f42;
   * the 16 Nov rows rule imports out of Completed bookings only), from the 18 Dec 2026 cut-off. Absent/null = unread.
   */
  trustedBy?: number | null;
  /** 🎁 Gift points for gifts given on completed events, never a gift paid from badge-reward stock (`shop_gift_points`). Absent/null = unread. */
  giftPoints?: number | null;
  /** 🤝 Suppliers the shop added who have a completed booking. Always absent today: no counter exists (Not counted yet). */
  invites?: number | null;
};

export type OwedReward = { key: string; badge: RewardBadge; reward: BadgeReward; note: string; tier?: TierKey; step?: number };

const COUNT = new Intl.NumberFormat('en-PH');

/**
 * 🔑 A TIERED SHOP BADGE PAYS EACH TIER ONCE, EVER (owner 15 Nov, 3cbf12c1) — keyed by the TIER, never the step:
 * `completed_bookings:tier3`. So a step number moved later can never pay a tier twice.
 */
export function tierRewardKey(badge: ShopBadgeKey, tier: TierKey): string {
  return rewardKey(badge, tier);
}

/**
 * 🗄 OLD PAYMENTS ALL COUNT (3cbf12c1): a reward paid under an old key blocks the tier it was told it earned on the
 * badge that took over its count — `events:<step>` (the old Events ladder) → Completed bookings, `reviews:<step>` →
 * Five-star reviews — by the step's position on its OLD ladder (both frozen ladders, not the new steps). The
 * step-keyed `trusted_by:<step>` of this PR's first slice never reached production, so it maps to nothing. A retired badge with no successor (Booked Loop, 1st Pick, Branches, Service
 * cards, Inspiration box, the Firsts) blocks nothing: what it paid stays paid (the retired-ladders row).
 */
const LEGACY_LADDERS: ReadonlyArray<{ prefix: string; successor: ShopBadgeKey; steps: readonly number[] }> = [
  { prefix: 'events', successor: 'completed_bookings', steps: MILESTONE_THRESHOLDS },
  { prefix: 'reviews', successor: 'five_star_reviews', steps: REVIEW_STEPS },
];

/** Every (badge, tier) a shop's existing reward keys have already paid — new keys and legacy keys alike. */
export function paidTiers(keys: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const key of keys) {
    const [head, part] = key.split(':');
    if (!head || !part) continue;
    if ((TIER_KEYS as readonly string[]).includes(part)) {
      out.add(`${head}:${part}`);
      continue;
    }
    const legacy = LEGACY_LADDERS.find((l) => l.prefix === head);
    const step = Number(part);
    if (!legacy || !Number.isFinite(step)) continue;
    const i = legacy.steps.indexOf(step);
    if (i >= 0) out.add(`${legacy.successor}:${tierKeyAt(i)}`);
  }
  return out;
}

const SHOP_BADGE_FACT: Readonly<Record<ShopBadgeKey, (f: BadgeRewardFacts) => number | null>> = {
  completed_bookings: (f) => f.completedBookings ?? null,
  five_star_reviews: (f) => f.fiveStarReviews ?? null,
  gifts_given: (f) => f.giftPoints ?? null,
  trusted_by: (f) => f.trustedBy ?? null,
  invites: (f) => f.invites ?? null,
};

/** One tiered shop badge's owed rewards: every tier its count has reached, keyed by tier. Unread or unmeasured = none. */
function shopBadgeOwed(badge: ShopBadgeKey, f: BadgeRewardFacts): OwedReward[] {
  const rule = BADGE_REWARDS[badge];
  const count = SHOP_BADGE_FACT[badge](f);
  if (rule.shape !== 'ladder' || !rule.measured || count === null || !Number.isFinite(count)) return [];
  return rule.steps
    .filter((s) => s.reward && s.tier && s.step <= count)
    .map((s) => ({
      key: tierRewardKey(badge, s.tier!),
      badge,
      reward: s.reward!,
      tier: s.tier,
      step: s.step,
      note: `Badge reward · ${rule.title} · ${tierName(s.tier!)}`,
    }));
}

/**
 * Every reward the shop's MEASURED badges have earned, each with its exactly-once key. Granted already or not.
 * Since 15 Nov (4b8cc3a3) only the approved set pays: Setnayan Verified (a seal with its gift) · the five tiered shop
 * badges · and the monthly awards, which stay as they are until the seals replace them (J2). A retired badge pays
 * nothing new. Filter what is already paid with `notYetPaid`.
 */
export function rewardsOwed(f: BadgeRewardFacts): OwedReward[] {
  const out: OwedReward[] = [];
  if (f.verified === true) out.push({ key: rewardKey('verified'), badge: 'verified', reward: papic(1), note: 'Badge reward · SETNAYAN Verified' });
  for (const badge of ['completed_bookings', 'five_star_reviews', 'gifts_given', 'trusted_by', 'invites'] as const) {
    out.push(...shopBadgeOwed(badge, f));
  }
  const award = BADGE_REWARDS.award;
  if (award.shape === 'period') {
    const seen = new Set<string>();
    for (const a of f.awards ?? []) {
      const reward = award.rewards[a.type];
      const key = rewardKey('award', `${a.type}:${a.periodMonth.slice(0, 10)}`);
      if (!reward || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, badge: 'award', reward, note: `Badge reward · ${AWARD_WORD[a.type]} · ${a.periodMonth.slice(0, 7)}` });
    }
  }
  return out;
}

/** What of `owed` is still unpaid, given the shop's existing reward keys: never a key twice, never a tier twice. */
export function notYetPaid(owed: readonly OwedReward[], existingKeys: Iterable<string>): OwedReward[] {
  const keys = new Set(existingKeys);
  const tiers = paidTiers(keys);
  return owed.filter((o) => !keys.has(o.key) && !(o.tier && tiers.has(`${o.badge}:${o.tier}`)));
}

const AWARD_WORD: Record<SpotlightAwardType, string> = { top_pick: 'Top Pick', most_booked: 'Most Booked', rising: 'Rising' };

/* ── words ────────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The products' names as the catalogue titles them: the smallest Papic pack, Event Plus, Event Pro — and (2026-11-15)
 * the two bigger Papic packs, Event Ultra, and every live Papic pack's title by its credits (`papicByCredits`), so a
 * reward already granted reads as the pack it actually was. The optional ones fall back to product words.
 */
export type RewardNames = Readonly<Record<'papic' | 'event_plus' | 'event_pro', string>> & {
  readonly papic_1000?: string;
  readonly papic_3000?: string;
  readonly event_ultra?: string;
  readonly papicByCredits?: Readonly<Record<number, string>>;
};

/** When the catalogue could not be read — product words, never a size or a price. */
export const FALLBACK_REWARD_NAMES: RewardNames = { papic: 'Papic pack', event_plus: 'Event Plus', event_pro: 'Event Pro', event_ultra: 'Event Ultra' };

/** The first Events step that pays a free booking fee — read from the table (0 since 15 Nov: no step earns one now). */
export const FIRST_FREE_FEE_STEP: number =
  MILESTONE_THRESHOLDS.find((s) => {
    const r = BADGE_REWARDS.events;
    return r.shape === 'ladder' && r.steps.find((x) => x.step === s)?.reward?.kind === 'fee_waiver';
  }) ?? 0;

/**
 * The free booking fee's row in the gifts list. Since 2026-11-15 no badge earns a NEW one (the one ladder replaced
 * 1,000+ events → free fee), but every one already earned still waits for its customer — so the row stays and says
 * only what it does.
 */
export const FREE_FEE_TITLE = 'Free booking fee';
export const FREE_FEE_SUBLINE =
  FIRST_FREE_FEE_STEP > 0 ? `Your next customer · from ${new Intl.NumberFormat('en-PH').format(FIRST_FREE_FEE_STEP)} events` : 'Your next customer';
export const FREE_FEE_LINE = `${FREE_FEE_TITLE} · ${FREE_FEE_SUBLINE.charAt(0).toLowerCase()}${FREE_FEE_SUBLINE.slice(1)}`;

/** Which badge a reward came from, as the gifts list reads it: "50 events · Silver" · "Most Booked · Nov 2026". */
export function rewardSourceWords(key: string): string {
  const [head, a, b] = key.split(':');
  if ((TIER_KEYS as readonly string[]).includes(a ?? '') && head && head in SHOP_BADGE_STEPS) {
    return `${BADGE_REWARDS[head as ShopBadgeKey].title} · ${tierName(a as TierKey)}`;
  }
  switch (head) {
    case 'verified':
      return 'SETNAYAN Verified';
    case 'first_booking':
      return 'First booking through Setnayan';
    case 'first_review':
      return 'First review';
    case 'first_five_star':
      return 'First 5★ review';
    case 'first_loop':
      return 'First Booked Loop';
    case 'first_first_pick':
      return 'First 1st Pick';
    case 'events': {
      const n = Number(a);
      return Number.isFinite(n) ? `${COUNT.format(n)} events${stepName(n) ? ` · ${stepName(n)}` : ''}` : 'Events on Setnayan';
    }
    case 'reviews':
      return `${COUNT.format(Number(a) || 0)} reviews`;
    case 'first_pick':
      return `1st Pick · ${COUNT.format(Number(a) || 0)}`;
    case 'booked_loop':
      return `Booked Loop · ${COUNT.format(Number(a) || 0)}`;
    case 'inspiration':
      return `Inspiration box · ${COUNT.format(Number(a) || 0)} photos`;
    case 'branches':
      return `Branches · ${COUNT.format(Number(a) || 0)}`;
    case 'service_cards':
      return `Service cards · ${COUNT.format(Number(a) || 0)}`;
    case 'trusted_by':
      return `Trusted by · ${COUNT.format(Number(a) || 0)}`;
    case 'award': {
      const word = AWARD_WORD[a as SpotlightAwardType] ?? 'Monthly award';
      const d = b ? new Date(`${b.slice(0, 10)}T00:00:00Z`) : null;
      const month = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-PH', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
      return month ? `${word} · ${month}` : word;
    }
    default:
      return 'Badge reward';
  }
}

/** A reward's product name: the pack it names, or — for a granted Papic reward — the pack its credits were. */
export function rewardName(r: BadgeReward & { creditsEach?: number | null }, names: RewardNames = FALLBACK_REWARD_NAMES): string {
  switch (r.kind) {
    case 'papic': {
      if (r.creditsEach && names.papicByCredits?.[r.creditsEach]) return names.papicByCredits[r.creditsEach]!;
      if (r.pack === 'papic_1000') return names.papic_1000 ?? FALLBACK_REWARD_NAMES.papic;
      if (r.pack === 'papic_3000') return names.papic_3000 ?? FALLBACK_REWARD_NAMES.papic;
      return names.papic;
    }
    case 'event_ultra':
      return names.event_ultra ?? 'Event Ultra';
    case 'fee_waiver':
      return 'Free booking fee';
    default:
      return names[r.kind];
  }
}

/** "Papic 150" · "Papic 1000" · "2 × Event Plus" · "Free booking fee · your next customer". */
export function rewardWords(r: BadgeReward & { creditsEach?: number | null }, names: RewardNames = FALLBACK_REWARD_NAMES): string {
  if (r.kind === 'fee_waiver') return 'Free booking fee · your next customer';
  const name = rewardName(r, names);
  return r.units > 1 ? `${r.units} × ${name}` : name;
}

/* ── the badge page lines ─────────────────────────────────────────────────────────────────────────────────────── */

/** A reward the shop was given, as the badge page and the gifts list read it. */
export type GrantedReward = {
  rewardId: string;
  key: string;
  badge: string;
  kind: BadgeRewardKind;
  units: number;
  grantedAt: string;
  revokedAt: string | null;
  /** A Papic reward: the credits ONE of its packs held when granted (stock_delta ÷ units) — which pack it was. */
  creditsEach?: number | null;
  /** A free booking fee: the booking it paid, when it did. */
  usedAt: string | null;
  usedOn: { coupleName: string | null; wouldHaveBeenPhp: number | null } | null;
  /** A free booking fee given back when its booking was cancelled before the day (owner 2026-11-05). */
  returnedAt?: string | null;
  /** The Setnayan gift the couple got with the badge-paid booking, in photos (owner 2026-11-05). */
  setnayanGiftCredits?: number | null;
};

/** (a) what the badge already gave · (b) the next step and its reward. Null = say nothing. */
export type RewardLine = { gave: string | null; next: string | null };

function gaveLine(granted: readonly GrantedReward[] | null, badge: RewardBadge, names: RewardNames, keyPrefix?: string): string | null {
  if (!granted) return null;
  const mine = granted
    .filter((g) => g.badge === badge && !g.revokedAt && (!keyPrefix || g.key.startsWith(keyPrefix)))
    .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
  const last = mine[0];
  if (!last) return null;
  return `Gave you: ${rewardWords({ kind: last.kind, units: last.units, creditsEach: last.creditsEach }, names)} · in your gifts`;
}

/**
 * The two reward lines for one badge, from the one table. Ladder badges name their next REWARDING step and how far
 * it is ("Next: 100 events · Gold · 4 to go → 2 × Event Plus"); an unmeasured ladder names its first reward with no
 * count; one-time badges name what they give when earned.
 */
export function rewardLineFor(
  badge: RewardBadge,
  count: number | null,
  earned: boolean | null,
  granted: readonly GrantedReward[] | null,
  names: RewardNames = FALLBACK_REWARD_NAMES,
): RewardLine {
  const rule = BADGE_REWARDS[badge];
  const gave = gaveLine(granted, badge, names);
  switch (rule.shape) {
    case 'once':
      return { gave, next: earned === true ? null : `When you earn it → ${rewardWords(rule.reward, names)}` };
    case 'period': {
      const r = rule.rewards;
      return {
        gave,
        next: `Most Booked or Top Pick → ${rewardWords(r.most_booked, names)} · Rising → ${rewardWords(r.rising, names)}`,
      };
    }
    case 'ladder': {
      const paying = rule.steps.filter((s) => s.reward);
      const unitOf = (n: number) => (n === 1 ? rule.unit[0] : rule.unit[1]);
      if (!rule.measured || count === null) {
        const first = paying[0];
        return { gave, next: first ? `First reward: ${COUNT.format(first.step)} ${unitOf(first.step)} → ${rewardWords(first.reward!, names)}` : null };
      }
      const next = paying.find((s) => s.step > count);
      if (!next) return { gave, next: null };
      const tier = badge === 'events' ? stepName(next.step) : next.tier ? tierName(next.tier) : null;
      return {
        gave,
        next: `Next: ${COUNT.format(next.step)} ${unitOf(next.step)}${tier ? ` · ${tier}` : ''} · ${COUNT.format(next.step - count)} to go → ${rewardWords(next.reward!, names)}`,
      };
    }
  }
}

/** The badge page's reward line for one current award (its own month): what it gave. */
export function awardGaveLine(
  type: SpotlightAwardType,
  periodMonth: string,
  granted: readonly GrantedReward[] | null,
  names: RewardNames = FALLBACK_REWARD_NAMES,
): string | null {
  if (!granted) return null;
  const key = rewardKey('award', `${type}:${periodMonth.slice(0, 10)}`);
  const g = granted.find((x) => x.key === key && !x.revokedAt);
  return g ? `Gave you: ${rewardWords({ kind: g.kind, units: g.units, creditsEach: g.creditsEach }, names)} · in your gifts` : null;
}

/* ── the gifts list ───────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The free booking fee's row: how many wait, and the history — earned when, used on which booking. Each entry is a
 * phone row: a short `title` ("₱0 fee · Maria & Juan") and one short `line` ("1,000 events · earned Oct 12 · used
 * Oct 20"); `sentence` is the whole of it in one line, for the ⓘ and a screen reader.
 */
export type FreeFeeSummary = {
  waiting: number;
  history: Array<{ rewardId: string; title: string; line: string; sentence: string; state: 'waiting' | 'used' | 'revoked' }>;
};

function shortDay(iso: string, year = false): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'Asia/Manila' });
}

export function freeFeeSummary(granted: readonly GrantedReward[]): FreeFeeSummary {
  const fees = granted.filter((g) => g.kind === 'fee_waiver').sort((a, b) => a.grantedAt.localeCompare(b.grantedAt));
  const history = fees.map((g) => {
    const step = Number(g.key.split(':')[1]);
    const from = Number.isFinite(step) && step > 0 ? `${COUNT.format(step)} events · ` : '';
    const earned = `${from}earned ${shortDay(g.grantedAt)}`;
    const earnedLong = `Earned ${shortDay(g.grantedAt, true)}${from ? ` · ${from.slice(0, -3)}` : ''}`;
    if (g.revokedAt) {
      return { rewardId: g.rewardId, title: FREE_FEE_TITLE, line: `${earned} · taken back`, sentence: `${earnedLong} · taken back by Setnayan`, state: 'revoked' as const };
    }
    if (g.usedAt) {
      const name = g.usedOn?.coupleName?.trim() || null;
      return {
        rewardId: g.rewardId,
        title: `${FREE_FEE_ZERO} fee · ${name ?? 'a booking'}`,
        line: `${earned} · used ${shortDay(g.usedAt)}`,
        sentence:
          `${earnedLong} · used ${shortDay(g.usedAt, true)}${name ? ` on ${name}` : ''} · ${FREE_FEE_ZERO} fee · Badge reward` +
          (g.setnayanGiftCredits && g.setnayanGiftCredits > 0
            ? ` · your couple still got the Setnayan gift, ${COUNT.format(g.setnayanGiftCredits)} Papic photos`
            : ''),
        state: 'used' as const,
      };
    }
    // Given back when its booking was cancelled before the day (owner 2026-11-05) — waiting again.
    const back = g.returnedAt ? ` · back ${shortDay(g.returnedAt)}` : '';
    return {
      rewardId: g.rewardId,
      title: FREE_FEE_TITLE,
      line: `${earned}${back}`,
      sentence: `${earnedLong}${g.returnedAt ? ` · given back ${shortDay(g.returnedAt, true)} when that booking was cancelled` : ''} · waiting for your next customer`,
      state: 'waiting' as const,
    };
  });
  return { waiting: history.filter((h) => h.state === 'waiting').length, history };
}

/** The fee a badge reward leaves: nothing. Formatted like every peso on the page. */
const FREE_FEE_ZERO = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(0);

/* ── the badge page: every tracker row with its reward ───────────────────────────────────────────────────────── */

export type TrackerRewardInput = {
  facts: BadgeRewardFacts;
  /** Null = the rewards could not be read: no "Gave you" line is drawn (never "nothing given"). */
  granted: readonly GrantedReward[] | null;
  names: RewardNames;
  /** The award rows' titles → their type (`AWARD_LABELS`, read on the server — this file stays pure). */
  awardTypeByTitle: Readonly<Record<string, SpotlightAwardType>>;
  /** 'YYYY-MM-01' — the month the current award rows belong to. */
  periodMonth: string;
  /** ⏱ The shop's badge upgrades (owner, 6 Nov). Null/absent = unread: the rows still say what each badge unlocks. */
  upgrades?: readonly BadgeUpgradeRow[] | null;
  /** The shop's plan — whether a first-booking upgrade reads as the 3D Booth (Supplier Plus and up) or Papic Challenges. */
  tier?: string | null;
};

/** Which tracker row carries which badge's upgrade line. */
const UPGRADE_ROW: ReadonlyArray<[(row: TrackerRow) => boolean, 'verified' | 'first_booking' | 'reviews' | 'award']> = [
  [(row) => row.kind === 'verified', 'verified'],
  [(row) => row.key === 'reward:first_booking', 'first_booking'],
  [(row) => row.key === 'reward:reviews', 'reviews'],
  [(row) => row.key === 'reward:award', 'award'],
];

function withUpgrade(row: TrackerRow, r: TrackerRewardInput): TrackerRow {
  const hit = UPGRADE_ROW.find(([is]) => is(row));
  if (!hit || !row.reward) return row;
  return { ...row, reward: { ...row.reward, upgrade: upgradeLineFor(hit[1], r.upgrades ?? null, r.tier ?? null) } };
}

function rewardBadge(key: string, glyph: string | null, label: string): ShopBadge {
  return { key: `reward:${key}`, kind: 'reward', glyph, line1: 'SETNAYAN', line2: label.toUpperCase(), label };
}

const NOT_COUNTED_LINE = 'Setnayan doesn’t count this one yet';

type CountedBadge = 'reviews' | 'branches' | 'service_cards' | 'inspiration' | 'booked_loop' | 'trusted_by';

function countedRow(
  badge: CountedBadge,
  title: string,
  glyph: string,
  count: number | null,
  words: readonly [string, string],
  r: TrackerRewardInput,
): TrackerRow {
  const reward = rewardLineFor(badge, count, null, r.granted, r.names);
  const b = rewardBadge(badge, count === null ? '—' : COUNT.format(count), title);
  if (count === null) {
    return { kind: 'reward', key: b.key, badge: b, title, line: `Your ${words[1]} couldn’t be counted just now`, state: 'unread', stateWord: 'Couldn’t load', reward };
  }
  const rule = BADGE_REWARDS[badge];
  const steps = rule.shape === 'ladder' ? rule.steps.map((s) => s.step) : [];
  const next = steps.find((s) => s > count);
  const line = `${COUNT.format(count)} ${count === 1 ? words[0] : words[1]}`;
  if (next === undefined) return { kind: 'reward', key: b.key, badge: { ...b, glyph }, title, line, state: 'earned', stateWord: 'Earned', bar: 100, reward };
  return {
    kind: 'reward',
    key: b.key,
    badge: b,
    title,
    line,
    state: 'to_go',
    stateWord: `${COUNT.format(next - count)} to go`,
    bar: Math.max(0, Math.min(100, (count / next) * 100)),
    reward,
  };
}

type UncountedBadge = 'first_pick' | 'first_first_pick';

function notCountedRow(badge: UncountedBadge, glyph: string, r: TrackerRewardInput): TrackerRow {
  const rule = BADGE_REWARDS[badge];
  const b = rewardBadge(badge, glyph, rule.title);
  return {
    kind: 'reward',
    key: b.key,
    badge: b,
    title: rule.title,
    line: NOT_COUNTED_LINE,
    state: 'not_counted',
    stateWord: 'Soon',
    reward: rewardLineFor(badge, null, null, r.granted, r.names),
  };
}

/** A one-time first: earned · not yet · unread — from one measured yes/no. */
function firstRow(
  badge: 'first_booking' | 'first_review' | 'first_five_star' | 'first_loop',
  glyph: string,
  earned: boolean | null,
  lines: { unread: string; earned: string; notYet: string },
  r: TrackerRewardInput,
): TrackerRow {
  const rule = BADGE_REWARDS[badge];
  const b = rewardBadge(badge, glyph, rule.title);
  const reward = rewardLineFor(badge, null, earned, r.granted, r.names);
  if (earned === null) return { kind: 'reward', key: b.key, badge: b, title: rule.title, line: lines.unread, state: 'unread', stateWord: 'Couldn’t load', reward };
  return earned
    ? { kind: 'reward', key: b.key, badge: b, title: rule.title, line: lines.earned, state: 'earned', stateWord: 'Earned', bar: 100, reward }
    : { kind: 'reward', key: b.key, badge: b, title: rule.title, line: lines.notYet, state: 'not_yet', stateWord: 'Not yet', reward };
}

/**
 * The tracker rows (`badgeTracker`) with their rewards, plus one row for every badge that pays a reward but has no
 * row yet — the measured ones with their count, the unmeasured ones saying so ("Soon"), never with a made-up count.
 * Rating and Years pay nothing and get no reward line.
 */
export function badgeRowsWithRewards(rows: readonly TrackerRow[], r: TrackerRewardInput): TrackerRow[] {
  const f = r.facts;
  const out: TrackerRow[] = [];
  for (const row of rows) {
    if (row.kind === 'verified') {
      out.push({ ...row, reward: rewardLineFor('verified', null, f.verified, r.granted, r.names) });
    } else if (row.kind === 'milestone') {
      out.push({ ...row, reward: rewardLineFor('events', f.completedEvents, null, r.granted, r.names) });
      out.push(...rewardOnlyRows(r));
    } else if (row.kind === 'award') {
      const type = r.awardTypeByTitle[row.title];
      out.push(type ? { ...row, reward: { gave: awardGaveLine(type, r.periodMonth, r.granted, r.names), next: null } } : row);
    } else {
      out.push(row);
    }
  }
  const awards = f.awards ?? [];
  const awardRule = BADGE_REWARDS.award;
  const ab = rewardBadge('award', '★', awardRule.title);
  out.push({
    kind: 'reward',
    key: ab.key,
    badge: ab,
    title: awardRule.title,
    line: f.awards === null ? 'Your awards couldn’t be read just now' : awards.length > 0 ? `${COUNT.format(awards.length)} won so far` : 'Given each month by Setnayan',
    state: f.awards === null ? 'unread' : awards.length > 0 ? 'earned' : 'not_yet',
    stateWord: f.awards === null ? 'Couldn’t load' : awards.length > 0 ? 'Earned' : 'Not yet',
    reward: rewardLineFor('award', null, null, r.granted, r.names),
  });
  return out.map((row) => withUpgrade(row, r));
}

function rewardOnlyRows(r: TrackerRewardInput): TrackerRow[] {
  const f = r.facts;
  const rows: TrackerRow[] = [];

  rows.push(
    firstRow('first_booking', '1st', f.firstSourcedBooking, {
      unread: 'Your bookings couldn’t be read just now',
      earned: 'Your first couple through Setnayan',
      notYet: 'Your first couple booked through Setnayan',
    }, r),
  );
  const reviews = f.trustedReviews !== null && Number.isFinite(f.trustedReviews) ? f.trustedReviews : null;
  rows.push(
    firstRow('first_review', '1st', reviews === null ? null : reviews >= 1, {
      unread: 'Your reviews couldn’t be read just now',
      earned: 'Your first review from a booked couple',
      notYet: 'Your first review from a booked couple',
    }, r),
  );
  const fives = f.fiveStarReviews ?? null;
  rows.push(
    firstRow('first_five_star', '5★', fives === null || !Number.isFinite(fives) ? null : fives >= 1, {
      unread: 'Your 5★ reviews couldn’t be counted just now',
      earned: 'Your first 5★ review from a booked couple',
      notYet: 'Your first 5★ review from a booked couple',
    }, r),
  );
  const loops = f.bookedLoops ?? null;
  rows.push(
    firstRow('first_loop', '↻', loops === null || !Number.isFinite(loops) ? null : loops >= 1, {
      unread: 'Your booked loops couldn’t be counted just now',
      earned: 'A family booked you again',
      notYet: 'The first family who books you again',
    }, r),
  );
  rows.push(notCountedRow('first_first_pick', '1st', r));

  rows.push(countedRow('reviews', BADGE_REWARDS.reviews.title, '★', f.trustedReviews, ['trusted review', 'trusted reviews'], r));
  rows.push(countedRow('service_cards', BADGE_REWARDS.service_cards.title, '▦', f.serviceCards, ['service card', 'service cards'], r));
  rows.push(countedRow('inspiration', BADGE_REWARDS.inspiration.title, '✦', f.inspirationPhotos, ['approved photo', 'approved photos'], r));
  rows.push(
    countedRow('branches', BADGE_REWARDS.branches.title, '⌂', f.branchIds === null ? null : new Set(f.branchIds).size, ['branch', 'branches'], r),
  );

  rows.push(notCountedRow('first_pick', '1st', r));
  rows.push(countedRow('booked_loop', BADGE_REWARDS.booked_loop.title, '↻', loops, ['family who came back', 'families who came back'], r));
  rows.push(
    countedRow('trusted_by', BADGE_REWARDS.trusted_by.title, '❖', f.trustedBy ?? null, ['supplier who recommends you', 'suppliers who recommend you'], r),
  );
  return rows;
}

/* ── award dates (owner 2026-11-15: "seal shows awarded on X") ───────────────────────────────────────────────── */

/**
 * One earned badge step as the badge UI draws it: the date it was AWARDED (the grant IS the earning — DECISION_LOG
 * 2026-11-15 (5)), the reward it gave, and whether the shop has pressed "Tap to claim". `rewardId` is the claim's
 * ref: `POST /api/unwrap {source:'badge_reward', ref: rewardId}` (`gift_moment_claim` — the first press is the claim,
 * a repeat answers the same claim; a claim moves nothing, the reward landed in the gift stock at the grant).
 */
export type BadgeAward = {
  rewardId: string;
  /** The exactly-once key: 'events:50' · 'trusted_by:5' · 'verified' · 'award:rising:2026-11-01'. */
  key: string;
  /** The badge family: 'events' · 'reviews' · 'trusted_by' · 'verified' · 'first_five_star' · 'award' … */
  badge: string;
  /** The ladder step reached (50 events), or null for a once-badge or an award. */
  step: number | null;
  /** The tier that step wears on ITS badge's ladder (tier1 … tier7), or null for a once-badge or an award. */
  tier: TierKey | null;
  /** "Gold" — the tier's name; null when there is no tier. */
  tierName: string | null;
  /** Which badge, in words: "50 events · Silver" · "Trusted by · 5" · "SETNAYAN Verified". */
  badgeLabel: string;
  /** What it gave, in words: "Papic 1000" · "Event Plus" · "Free booking fee · your next customer". */
  rewardLabel: string;
  kind: BadgeRewardKind;
  units: number;
  /** ISO — when it was awarded ("Awarded 12 Jan 2026"). */
  grantedAt: string;
  /** ISO — when the shop pressed Tap to claim; null = still waiting. */
  claimedAt: string | null;
};

/** The tier a reached step wears on its own badge's ladder. Null for a key that is not a ladder step. */
export function tierOfRewardKey(key: string): { step: number; tier: TierKey } | null {
  const [head, part] = key.split(':');
  const rule = (BADGE_REWARDS as Readonly<Record<string, BadgeRewardRule>>)[head ?? ''];
  if (!rule || rule.shape !== 'ladder') return null;
  // A tier-keyed reward (`completed_bookings:tier3`, 15 Nov): its tier, and the step that tier sits at.
  const byTier = rule.steps.find((s) => s.tier === part);
  if (byTier && byTier.tier) return { step: byTier.step, tier: byTier.tier };
  const step = Number(part);
  const i = rule.steps.findIndex((s) => s.step === step);
  return i < 0 ? null : { step, tier: rule.steps[i]!.tier ?? tierKeyAt(i) };
}

/** Shape a granted reward and its claim for the UI. Pure. */
export function badgeAwardOf(g: GrantedReward, claimedAt: string | null, names: RewardNames = FALLBACK_REWARD_NAMES): BadgeAward {
  const t = tierOfRewardKey(g.key);
  return {
    rewardId: g.rewardId,
    key: g.key,
    badge: g.badge,
    step: t?.step ?? null,
    tier: t?.tier ?? null,
    tierName: t ? tierName(t.tier) : null,
    badgeLabel: rewardSourceWords(g.key),
    rewardLabel: rewardWords({ kind: g.kind, units: g.units, creditsEach: g.creditsEach }, names),
    kind: g.kind,
    units: g.units,
    grantedAt: g.grantedAt,
    claimedAt,
  };
}
