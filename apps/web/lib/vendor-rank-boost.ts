/**
 * Merit-first ranking with a CAPPED paid boost + labeled Featured slots.
 *
 * Canonical spec: `Vendor_Monetization_Model_LOCKED_2026-07-25.md` § 5
 * ("Ranking — marketplace integrity — do NOT pay-to-win"), owner-insisted:
 *
 *   • **Organic rank = merit for everyone including Free** — match to need,
 *     reviews, responsiveness, completed bookings, proximity.
 *     **A better free vendor is never buried.**
 *   • **Paid = a capped boost + clearly-labeled Featured/Sponsored slots** —
 *     it amplifies quality, never manufactures it, never buries a better vendor.
 *
 * ── The two mechanisms, and why each is safe ────────────────────────────────
 *
 * 1. CAPPED BOOST (organic list). A paying tier gets a small ADDITIVE bonus on
 *    the 0–100 merit score, hard-ceilinged at {@link MAX_TIER_BOOST_POINTS}.
 *    Because the bonus can never exceed that ceiling, the ordering obeys a
 *    provable invariant:
 *
 *        meritA - meritB > MAX_TIER_BOOST_POINTS  ⟹  A always outranks B,
 *
 *    for ANY tiers on A and B — including a Free A and an Enterprise B. That is
 *    the machine-checkable reading of "a better free vendor is never buried":
 *    money can only reshuffle inside a narrow band of near-equals, never leapfrog
 *    a materially better vendor. {@link canBoostOvertake} exposes the boundary,
 *    and the unit tests sweep every tier pair against it.
 *
 *    The boost is ADDITIVE, never multiplicative: a multiplier scales with merit,
 *    so a high-merit paid vendor would gain more absolute lift than a low-merit
 *    one and the "band" would widen without bound at the top of the list.
 *
 * 2. FEATURED SLOTS (separate, labeled). A tiny, fixed number of slots ABOVE the
 *    organic list, each of which MUST render an unambiguous "Sponsored" label
 *    ({@link FEATURED_LABEL} / {@link FEATURED_DISCLOSURE}). Because these sit
 *    outside merit order, they carry a QUALITY FLOOR so paid can never
 *    manufacture quality:
 *      · tier ≥ solo (Free is never featured — nothing was bought),
 *      · admin-VETTED verified (an unvetted or suspended profile can never buy
 *        the top of the page — see {@link FeaturableVendor.adminVerified}),
 *      · merit within {@link FEATURED_MERIT_FLOOR_DELTA} of the best organic
 *        merit in the same result set (a materially worse vendor cannot buy the
 *        top slot — the floor moves with the pool, so it can't be gamed by a
 *        weak category),
 *      · at most {@link FEATURED_SLOT_MAX_DEFAULT} slots, and never more than
 *        {@link FEATURED_SLOT_MAX_SHARE} of the visible page.
 *    A featured pick is REMOVED from the organic list (no double exposure): a
 *    paying vendor occupies one row, not two.
 *
 * ── The COMPOSED-ORDER invariant (the one that actually ships) ───────────────
 *
 * Mechanism 1's ceiling is worthless on its own: a surface renders
 * `[…featured, …organic]`, so a slot-holder physically sits above every organic
 * row no matter what the boost ceiling says. The invariant that matters is
 * therefore stated over the COMPOSED list produced by
 * {@link composeFeaturedOrder}, not over either sub-list:
 *
 *     meritA - meritB > MAX_TIER_BOOST_POINTS  ⟹  A precedes B in the
 *                                                 composed order,
 *
 * for ANY tiers and ANY featured/organic split. That holds because the featured
 * quality floor is CLAMPED to {@link MAX_TIER_BOOST_POINTS} — a slot-holder can
 * never be more than the boost ceiling below the best vendor in the pool, so
 * jumping the queue via a slot buys exactly as much as the boost does and no
 * more. Both the constant and the caller-supplied `meritFloorDelta` override are
 * clamped, so the coupling cannot be widened from a call site.
 *
 * ⚠ Raising {@link FEATURED_MERIT_FLOOR_DELTA} above
 * {@link MAX_TIER_BOOST_POINTS} re-opens the §5 violation this module exists to
 * close. It is written as a derived constant for that reason, and
 * `vendor-rank-boost.test.ts` sweeps the composed order over every tier pair.
 *
 * ── Purity contract ─────────────────────────────────────────────────────────
 * NO env reads, NO clock, NO I/O. `nowMs` and every signal are arguments so the
 * whole module runs under `tsx --test`. The env flag lives in the separate
 * `lib/vendor-rank-boost-flag.ts`.
 *
 * ── What this is NOT ────────────────────────────────────────────────────────
 * Not a searchability gate. Free vendors stay fully discoverable and fully
 * rankable. `VENDOR_TIER_SEARCH_GATE` (lib/vendor-search-gate.ts) hides Free
 * from search and contradicts § 5 — it is neither read nor extended here.
 */

import { asVendorTier, isTierAtLeast, tierRank, type VendorTier } from './vendor-tier-caps';

/** Merit scores live on a 0–100 scale. */
export const MERIT_SCORE_MAX = 100;

/**
 * Hard ceiling on the paid boost, in merit points. NOTHING in this module may
 * add more than this to a vendor's rank score — see the invariant in the file
 * header. Raising this number widens the band inside which money can reorder
 * near-equals, so it is a load-bearing, owner-visible constant.
 */
export const MAX_TIER_BOOST_POINTS = 6;

/**
 * Per-tier boost, in merit points. § 1 of the model grants Free "—", Solo
 * "small", Pro "bigger", Enterprise "top". Custom runs as Enterprise
 * (rank-derived everywhere else in the codebase, mirrored here).
 *
 * `verified` is a LEGACY trust state, not a paid plan — it buys nothing.
 */
export const TIER_BOOST_POINTS: Readonly<Record<VendorTier, number>> = {
  free: 0,
  verified: 0,
  solo: 2,
  pro: 4,
  enterprise: MAX_TIER_BOOST_POINTS,
  custom: MAX_TIER_BOOST_POINTS,
};

/**
 * The paid boost in merit points for a tier, clamped to
 * {@link MAX_TIER_BOOST_POINTS}. Unknown/null tiers normalize to `free` (0), so
 * a schema skew degrades to "no boost", never to "unbounded boost".
 */
export function tierBoostPoints(tier: string | null | undefined): number {
  const points = TIER_BOOST_POINTS[asVendorTier(tier)];
  return Math.min(points, MAX_TIER_BOOST_POINTS);
}

/**
 * A vendor's rank score = merit + capped tier boost.
 *
 * The merit input is clamped to 0–100 first so a caller passing a wild score
 * (NaN from a null column, a percentage over 100) cannot smuggle in extra lift.
 * NaN merit is treated as 0 — the least-favourable, fail-closed reading.
 */
export function boostedRankScore(
  meritScore: number,
  tier: string | null | undefined,
): number {
  const merit = clampMerit(meritScore);
  return merit + tierBoostPoints(tier);
}

/**
 * Could ANY paid boost let a vendor with `worseMerit` overtake one with
 * `betterMerit`? False ⟺ the better vendor is "materially better" and is
 * therefore un-buriable by money. Exported so the invariant is assertable from
 * tests and readable at call sites.
 */
export function canBoostOvertake(betterMerit: number, worseMerit: number): boolean {
  return clampMerit(betterMerit) - clampMerit(worseMerit) <= MAX_TIER_BOOST_POINTS;
}

function clampMerit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > MERIT_SCORE_MAX) return MERIT_SCORE_MAX;
  return value;
}

// ── Merit score ─────────────────────────────────────────────────────────────

/**
 * The five merit signals § 5 names, plus the organic badge bonus. Every field is
 * an ARGUMENT — no lookups happen in here.
 */
export type MeritSignals = {
  /**
   * "Match to need", 0–1 — how much of what the couple explicitly asked for
   * this vendor actually offers (facet/preference overlap ÷ facets selected).
   * `null` = unjudgeable (the couple selected nothing, or the vendor carries no
   * facet tags) → NEUTRAL half credit, never a penalty, so an untagged vendor is
   * not punished for missing data it was never asked for.
   *
   * ⚠ The neutral is a FLOOR, not an alternative. Earlier this term paid the
   * neutral half-credit for `null` and a hard 0 for "tagged but matched none",
   * which made DELETING your facet tags worth +5 merit — 83% of the entire paid
   * ceiling, for destroying the data the rest of search runs on. The floor makes
   * the term monotonically non-decreasing in honesty: tagging can only ever help
   * you or leave you where deleting would have.
   */
  matchToNeed?: number | null;
  /** Receipt-backed, arm's-length reviews (`vendor_trusted_review_stats`). */
  trustedReviewCount: number | null;
  /** Average rating over those trusted reviews, 0–5. */
  trustedAvgRating: number | null;
  /** VETTED completed events (`vendor_public_completed_events_stats`). */
  completedBookings: number | null;
  /**
   * Cleared the First-Look responsiveness SLA **under human power**.
   *
   * ⚠ MUST be the output of {@link organicRespondsFast}, never the raw
   * First-Look flag: the raw flag is derived from a timestamp the PAID
   * auto-reply bot stamps, which would make this weight purchasable.
   */
  respondsFast: boolean;
  /** km from the event anchor; null = unknown → neutral, never a penalty. */
  distanceKm: number | null;
  /**
   * Distance at which proximity credit reaches zero.
   *
   * ⚠ MUST be tier-independent. Do NOT pass the vendor's `serviceRadiusKm` —
   * that is derived from `tier_state` (lib/vendor-tier-caps), so it would hand
   * higher tiers a wider, UNCAPPED proximity credit and smuggle money into a
   * score whose whole job is to be blind to it. Pass a per-CATEGORY or
   * per-EVENT horizon, or leave it unset.
   */
  proximityHorizonKm?: number;
};

/**
 * Weights sum to 100, and map 1:1 onto the five signals § 5 names — "match to
 * need, reviews, responsiveness, completed bookings, proximity". Documented so
 * a reweight is a visible, reviewable diff.
 *
 * ⚠ EVERY weight here must be REACHABLE. A weight no call site can score is not
 * a conservative default, it is a silent rescale: it caps the real maximum below
 * 100 and quietly shrinks the paid ceiling this model is calibrated against
 * (6 points "out of 100" would really be 6 out of 90). An earlier draft carried
 * a 10-point `badges` slice that nothing ever passed; those points were folded
 * back into the two receipt-backed signals (reviews 30→35, bookings 15→20)
 * rather than left dead. If badges are wired later, take the points back out of
 * these two explicitly.
 */
export const MERIT_WEIGHTS = {
  /** Match to need — what the couple explicitly asked for. § 5 names it first. */
  matchToNeed: 10,
  /** Reviews — volume × quality, receipt-backed only. */
  reviews: 35,
  /** Completed bookings — proof of delivery, vetted only. */
  bookings: 20,
  /** Responsiveness — the couple's #1 complaint about PH vendors. */
  responsiveness: 15,
  /** Proximity to the event anchor. */
  proximity: 20,
} as const;

const REVIEW_COUNT_SATURATION = 25;
const BOOKING_SATURATION = 20;
const DEFAULT_PROXIMITY_HORIZON_KM = 60;

/**
 * Credit floor for the match-to-need term, as a share of its weight. Both the
 * "unjudgeable" case and the "judged and matched nothing" case land here, which
 * is what removes the incentive to delete facet tags.
 */
const MATCH_TO_NEED_NEUTRAL = 0.5;

/**
 * Merit score, 0–100. Pure, monotonic in every signal, and completely blind to
 * tier / ad spend / subscription state — nothing paid may enter this function.
 * That blindness is what makes the capped boost auditable: merit is computed
 * first, money is added afterwards and only up to the ceiling.
 *
 * An unknown signal is NEUTRAL-to-zero rather than a penalty, so a vendor with
 * sparse data ranks low on evidence, not on punishment.
 */
export function meritScore(signals: MeritSignals): number {
  // Unjudgeable match → half credit (neutral). Uniform across the pool when the
  // couple has selected nothing, so it never reorders in that case.
  //
  // The neutral is a FLOOR applied to the judgeable case too, so a vendor can
  // never improve its merit by DELETING its facet tags to become unjudgeable.
  // Untagged and worst-tagged score the same; any real match scores strictly
  // more. See MeritSignals.matchToNeed.
  const matchRatio =
    signals.matchToNeed == null || !Number.isFinite(signals.matchToNeed)
      ? MATCH_TO_NEED_NEUTRAL
      : Math.max(MATCH_TO_NEED_NEUTRAL, Math.min(1, Math.max(0, signals.matchToNeed)));
  const matchToNeed = MERIT_WEIGHTS.matchToNeed * matchRatio;

  const reviewCount = Math.max(0, signals.trustedReviewCount ?? 0);
  const avgRating = Math.min(5, Math.max(0, signals.trustedAvgRating ?? 0));
  // Volume saturates; quality scales it. Zero trusted reviews ⇒ zero credit.
  const volume = Math.min(1, reviewCount / REVIEW_COUNT_SATURATION);
  const quality = avgRating / 5;
  const reviews = MERIT_WEIGHTS.reviews * volume * quality;

  const bookings =
    MERIT_WEIGHTS.bookings *
    Math.min(1, Math.max(0, signals.completedBookings ?? 0) / BOOKING_SATURATION);

  const responsiveness = signals.respondsFast ? MERIT_WEIGHTS.responsiveness : 0;

  const horizon =
    signals.proximityHorizonKm && signals.proximityHorizonKm > 0
      ? signals.proximityHorizonKm
      : DEFAULT_PROXIMITY_HORIZON_KM;
  // Unknown distance → half credit (neutral): we neither reward nor punish a
  // vendor for an event that has no coordinates yet.
  const proximity =
    signals.distanceKm == null || !Number.isFinite(signals.distanceKm)
      ? MERIT_WEIGHTS.proximity * 0.5
      : MERIT_WEIGHTS.proximity *
        Math.min(1, Math.max(0, 1 - Math.max(0, signals.distanceKm) / horizon));

  return clampMerit(
    matchToNeed + reviews + bookings + responsiveness + proximity,
  );
}

// ── Organic ranking with the capped boost ───────────────────────────────────

export type RankableVendor = {
  /** Stable identity — used as the final, deterministic tie-break. */
  id: string;
  /** 0–100, from {@link meritScore} (or any other merit-only computation). */
  meritScore: number;
  /** `vendor_profiles.tier_state`. Unknown → treated as `free` (no boost). */
  tier: string | null | undefined;
};

/**
 * Sort a pool merit-first, applying the capped tier boost. Returns a NEW array;
 * the input is not mutated.
 *
 * Tie-breaks, in order: boosted score desc → RAW merit desc → id asc. Breaking a
 * tie on raw merit (not on tier) means that when a paid and an unpaid vendor end
 * up level, the one who EARNED the position wins — money never wins a coin-flip.
 */
export function rankWithCappedBoost<T extends RankableVendor>(
  vendors: readonly T[],
): T[] {
  return [...vendors].sort((a, b) => {
    const scoreDelta =
      boostedRankScore(b.meritScore, b.tier) - boostedRankScore(a.meritScore, a.tier);
    if (scoreDelta !== 0) return scoreDelta;
    const meritDelta = clampMerit(b.meritScore) - clampMerit(a.meritScore);
    if (meritDelta !== 0) return meritDelta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// ── Featured / Sponsored slots ──────────────────────────────────────────────

/** Copy for the chip. MUST be rendered on every featured row — never optional. */
export const FEATURED_LABEL = 'Sponsored';

/** Copy for the always-visible disclosure line under a featured row. */
export const FEATURED_DISCLOSURE =
  'Paid placement. Everywhere else on this page, vendors are ranked on merit.';

/** Hard cap on labeled slots per result page. */
export const FEATURED_SLOT_MAX_DEFAULT = 2;

/**
 * A featured block may never exceed this share of the visible results, so a
 * thin category can't become an all-ads page. Applied on top of the hard cap.
 */
export const FEATURED_SLOT_MAX_SHARE = 0.25;

/**
 * Quality floor: a featured candidate's merit must be within this many points
 * of the BEST merit in the same result set. Paid amplifies quality; it does not
 * manufacture it.
 *
 * ⚠ DERIVED FROM {@link MAX_TIER_BOOST_POINTS} ON PURPOSE — do not hard-code a
 * different number. A featured row renders ABOVE the whole organic list, so this
 * delta IS the amount of merit a slot lets a vendor jump. If it exceeded the
 * boost ceiling, buying a slot would bury a better free vendor by more than the
 * "6 points out of 100" the model promises — the exact §5 violation this module
 * closes. {@link partitionFeatured} additionally CLAMPS any caller override to
 * this ceiling, so the coupling can't be widened from a call site either.
 */
export const FEATURED_MERIT_FLOOR_DELTA = MAX_TIER_BOOST_POINTS;

/** Lowest tier that may occupy a featured slot. Free is never featured. */
export const FEATURED_MIN_TIER: VendorTier = 'solo';

export type FeaturableVendor = RankableVendor & {
  /**
   * ADMIN-VETTED verification, i.e. `verification_state === 'verified'` AND
   * `public_visibility === 'verified'` — BOTH columns, ANDed by the caller.
   *
   * ⚠ Named `adminVerified`, not `verified`, deliberately. A row's display
   * `verified` chip is driven by `public_visibility` alone; that column is the
   * admin's visibility FREEZE (a fraud suspension flips it), while
   * `verification_state` is the vetting decision itself. Featuring is the one
   * place where a vendor is put at the top of the page with our voice behind
   * it, so it requires both to be green — a suspension or a de-vetting must
   * remove the slot even if the other column lags.
   *
   * Both columns are also trigger-guarded against vendor self-writes
   * (`guard_vendor_profiles_entitlement`, migration `20271004444950`). This
   * field is the defence-in-depth half of that: even if a future column ever
   * became writable again, a slot needs two independent greens, not one.
   */
  adminVerified: boolean;
  /**
   * `vendor_profiles.tier_expires_at` as epoch ms — the LAPSE check, not the
   * entitlement itself. The model bundles Featured slots into the subscription
   * tier (no separate SKU), so `tier` is the entitlement and this only asks
   * "has the paid tier lapsed?".
   *
   * `null` = NO expiry recorded = still active. That is the live convention
   * (`lib/vendor-favorite-gate.ts`, and PROD REALITY: every real Pro row has
   * `tier_expires_at IS NULL`). A Free vendor is not let through by a null here
   * — the tier floor rejects it first. See {@link isFeaturedWindowActive}.
   */
  tierExpiresAtMs: number | null;
};

export type FeaturedPartitionOptions = {
  /** Caller-supplied clock. Purity contract: never read Date.now() in here. */
  nowMs: number;
  maxSlots?: number;
  meritFloorDelta?: number;
  maxShare?: number;
};

export type FeaturedPartition<T extends FeaturableVendor> = {
  /**
   * Rows to render ABOVE the organic list. EVERY one of these must render
   * {@link FEATURED_LABEL} + {@link FEATURED_DISCLOSURE}. If a surface cannot
   * render the label, it must not render the block.
   */
  featured: T[];
  /** Merit-first, capped-boost order. Featured picks are removed (no dupes). */
  organic: T[];
  /** Ids in `featured`, for cheap membership checks at the render site. */
  featuredIds: ReadonlySet<string>;
};

/**
 * Split a pool into labeled Featured slots + the merit-first organic list.
 *
 * Eligibility (ALL must hold): active paid window at `nowMs` · tier ≥
 * {@link FEATURED_MIN_TIER} · verified · merit ≥ (best organic merit −
 * `meritFloorDelta`). Slots go to the highest tier first, then the highest
 * merit — so the top slot is the best of the vendors who both paid AND qualify.
 *
 * The merit floor is measured against the best merit in the WHOLE pool
 * (including the candidates themselves), so a category where the paying vendors
 * genuinely are the best still fills its slots, while a weak paying vendor in a
 * strong category cannot buy its way over the top.
 *
 * With an empty/ineligible pool this returns `featured: []` and an organic list
 * identical to {@link rankWithCappedBoost} — the degenerate case is the safe one.
 */
export function partitionFeatured<T extends FeaturableVendor>(
  vendors: readonly T[],
  options: FeaturedPartitionOptions,
): FeaturedPartition<T> {
  const ranked = rankWithCappedBoost(vendors);
  const maxSlots = Math.max(0, options.maxSlots ?? FEATURED_SLOT_MAX_DEFAULT);
  // CLAMPED to the boost ceiling, never merely defaulted to it: a call site
  // passing `meritFloorDelta: 40` must not be able to re-open the composed-order
  // violation (a slot-holder jumping a materially better free vendor). Widening
  // the band is a change to MAX_TIER_BOOST_POINTS, which is owner-visible.
  const meritFloorDelta = Math.min(
    MAX_TIER_BOOST_POINTS,
    Math.max(0, options.meritFloorDelta ?? FEATURED_MERIT_FLOOR_DELTA),
  );
  const maxShare = Math.min(1, Math.max(0, options.maxShare ?? FEATURED_SLOT_MAX_SHARE));

  // Share cap: floor(), so a 3-result page gets 0 slots at 25% — a small page
  // stays entirely organic rather than becoming a third ads.
  const shareCap = Math.floor(ranked.length * maxShare);
  const slots = Math.min(maxSlots, shareCap);
  if (slots <= 0) {
    return { featured: [], organic: ranked, featuredIds: new Set() };
  }

  const bestMerit = ranked.reduce(
    (best, v) => Math.max(best, clampMerit(v.meritScore)),
    0,
  );
  const floor = bestMerit - meritFloorDelta;

  const eligible = ranked.filter(
    (v) =>
      isFeaturedWindowActive(v.tierExpiresAtMs, options.nowMs) &&
      isTierAtLeast(v.tier, FEATURED_MIN_TIER) &&
      v.adminVerified === true &&
      clampMerit(v.meritScore) >= floor,
  );

  const featured = [...eligible]
    .sort(
      (a, b) =>
        tierRank(b.tier) - tierRank(a.tier) ||
        clampMerit(b.meritScore) - clampMerit(a.meritScore) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, slots);

  const featuredIds = new Set(featured.map((v) => v.id));
  return {
    featured,
    organic: ranked.filter((v) => !featuredIds.has(v.id)),
    featuredIds,
  };
}

/**
 * The ONLY sanctioned way to flatten a {@link FeaturedPartition} into the order
 * a surface renders. Call sites must not hand-splice `[...featured, ...organic]`
 * themselves — going through this function is what makes the §5 composed-order
 * invariant a property of one testable place instead of a convention every
 * surface has to remember.
 *
 * Anything the surface floats ABOVE this (the relationship tier: vendors the
 * couple already works with) is out of scope by construction — that is earned
 * history, not money, and it displaces paid slots rather than being displaced
 * by them.
 *
 * Guaranteed (swept by `vendor-rank-boost.test.ts` over every tier pair):
 *
 *     merit(A) - merit(B) > MAX_TIER_BOOST_POINTS
 *       ⟹ A appears before B in the returned array,
 *
 * regardless of which of the two bought a slot.
 */
export function composeFeaturedOrder<T extends FeaturableVendor>(
  partition: FeaturedPartition<T>,
): T[] {
  return [...partition.featured, ...partition.organic];
}

/**
 * Responsiveness credit is only MERIT when a HUMAN earned it.
 *
 * `chat_threads.vendor_first_reply_at` is stamped by a trigger on any
 * `sender_role = 'vendor'` insert — including the auto-reply bot, which is
 * gated behind the paid Vendor AI add-on. Feeding that straight into
 * {@link MeritSignals.respondsFast} would make 15 of 100 merit points
 * PURCHASABLE for ₱1,500/28d — 2.5× the entire declared paid ceiling, inside
 * the one score whose whole job is to be blind to money.
 *
 * So the caller must prove the speed is organic. `botAssisted` = "this vendor
 * has at least one logged bot reply" (`vendor_bot_replies`).
 *
 * FAIL-CLOSED: a caller that cannot determine `botAssisted` must pass `true`.
 * Denying the credit to everyone is neutral (it reorders nothing); granting it
 * on an unknown is a purchase.
 *
 * Conservative on purpose: a vendor with one bot reply anywhere loses the
 * signal outright rather than having it prorated. Losing 15 organic points is a
 * cost the vendor chose when they switched a machine on; the alternative is a
 * partial credit we cannot attribute.
 */
export function organicRespondsFast(input: {
  respondsFast: boolean;
  botAssisted: boolean;
}): boolean {
  return input.respondsFast === true && input.botAssisted !== true;
}

/**
 * Has the vendor's paid tier LAPSED at `nowMs`?
 *
 *   null / undefined → no expiry recorded → ACTIVE (the live convention; every
 *                      real Pro row in prod carries `tier_expires_at IS NULL`)
 *   finite future    → ACTIVE
 *   finite past      → LAPSED
 *   NaN / Infinity   → LAPSED (fail-closed: a corrupt timestamp must not buy
 *                      a top-of-page slot)
 *
 * This is only the lapse check — the entitlement is the tier itself, and the
 * tier floor in {@link partitionFeatured} runs alongside it, so a Free vendor
 * with a null expiry is still never featured.
 */
export function isFeaturedWindowActive(
  tierExpiresAtMs: number | null | undefined,
  nowMs: number,
): boolean {
  if (tierExpiresAtMs == null) return true;
  if (!Number.isFinite(tierExpiresAtMs)) return false;
  return nowMs < tierExpiresAtMs;
}
