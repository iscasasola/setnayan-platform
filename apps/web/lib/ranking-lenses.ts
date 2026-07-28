/**
 * ranking-lenses.ts — the bench's NAMED WEIGHT VECTORS (Explore_Replan §15).
 *
 * There is exactly ONE scorer on this platform — `lib/compat-score.ts`. A
 * "lens" is not a second scorer and not a bespoke comparator: it is a named
 * weight vector handed to `computeCompatScore`, plus the copy the couple reads
 * and the rule that decides whether the lens can honestly be offered at all.
 *
 * ── WHAT SHIPS: all FIVE lenses (owner-approved 2026-07-27).
 *   • Best matches            — the default; `COMPAT_WEIGHTS` unchanged.
 *   • Nearest to your venue   — distance 0.45.
 *   • Fits your budget        — budgetFit 0.40.
 *   • New here                — freshness 0.25 AND reviews dropped to 0.06.
 *   • In demand right now     — demandPressure 0.22, inquiry-backed only.
 *
 * ── HOW THE LAST THREE BECAME HONEST (PR #3839, merged; read it before
 *    changing anything here). An earlier draft of this module shipped only the
 *    first two and documented the other three as blocked. That was true of the
 *    INPUTS available at the time, not of the lenses:
 *
 *   • "Fits your budget" was called data-dark. It still ranks distance-from-
 *     over-budget rather than value — `priceFitScore` (`lib/smart-sort.ts`)
 *     returns a FLAT 1.0 for every vendor at or under budget, so a ₱30k and an
 *     ₱89k photographer tie EXACTLY. That is a copy constraint, not a blocker:
 *     the lens orders honestly, and `FORBIDDEN_LENS_COPY` below makes the
 *     value language it would invite un-shippable.
 *   • "New here" needed a freshness anchor and now has one:
 *     `MIN(vendor_tier_history.created_at) WHERE to_state = 'verified'`. That
 *     table is an append-only audit of state TRANSITIONS, so a renewal writes
 *     no row and cannot reset the anchor — honest by construction, and no new
 *     column (CLAUDE.md rule 3: a flag/filter flip beats new schema).
 *     `vendor_profiles.last_verified_at` is overwritten by every renewal and is
 *     unpopulated in prod; `vendor_verifications.approved_at` has zero rows.
 *   • "In demand right now" counted SAVES. It now counts INQUIRIES —
 *     `countInquiringCouples` (`lib/same-date-demand.ts`) joins on
 *     `chat_threads` existence, so a saved-but-never-contacted vendor
 *     contributes ZERO. It is floored at `MIN_DEMAND_COUPLE_COUNT` = 3 and is
 *     exact-date only, with no month/year fallback invented.
 *
 * ── WHAT IS STILL NOT BUILT, and gates the flag rather than this module:
 *   PR #3839 recorded that the §15.4 privacy legs (b) OPT-OUT and (d) DPO
 *   SIGN-OFF do NOT exist. Transparency (a) and the min-N floor (c) do. The
 *   flag must not be flipped until (b) and (d) land. This module inherits that
 *   gate; it does not lift it.
 *
 * INVARIANT: every vector sums to 1.000, asserted PER MEMBER in the sibling
 * test, and `COMPAT_WEIGHTS` is asserted unchanged so existing callers are
 * byte-for-byte identical. Pure + framework-free so all of it is trivially
 * unit-testable.
 */

import {
  COMPAT_WEIGHTS,
  MIN_DEMAND_COUPLE_COUNT,
  type CompatDimension,
  type CompatInputs,
  type CompatWeights,
} from '@/lib/compat-score';

/** The five lens keys. `'fit'` stays the key for "Best matches" so the
 *  flag-OFF bench, the persisted preference and every existing `BenchSort`
 *  consumer keep working unchanged — only the LABEL differs under the flag. */
export type LensKey = 'fit' | 'near' | 'budget' | 'new' | 'demand';

export type RankingLens = {
  key: LensKey;
  /** What the couple reads on the chip. */
  label: string;
  weights: CompatWeights;
  /**
   * The dimension this lens is ABOUT. A lens must not appear when its driving
   * input is missing across the bench — a sort that silently no-ops is worse
   * than no sort (§15.2). `null` = always offerable (the default lens degrades
   * to a defensible order even at zero resolved inputs).
   */
  requires: CompatDimension | null;
  /** TRUE ⇒ this lens cannot discriminate over these candidates and must not
   *  be offered. Reads the SAME resolved `CompatInputs` the scorer reads, so
   *  the gate and the ranking can never disagree about what data exists. */
  hideWhen: (candidates: readonly CompatInputs[]) => boolean;
  /**
   * Honest copy for the DISABLED chip when `hideWhen` is true.
   *
   * `null` means REMOVE the chip entirely rather than disable it — reserved for
   * the case where any disabled-state wording would itself be a claim. See
   * `demand` below.
   */
  unavailableReason: string | null;
};

// ── The vectors ────────────────────────────────────────────────────────────
// Each is written out in full rather than spread-and-patched from
// COMPAT_WEIGHTS, so a reader can check the sum by eye and a diff shows the
// whole vector. Every one sums to exactly 1.000.

/**
 * "Nearest to your venue" — least travel, least logistics cost, lowest day-of
 * risk.
 *
 * This is NOT a raw km sort. `distanceSub` is a continuous half-life decay, so
 * 2 km and 19 km genuinely differ (the §13.4 binarisation defect); raising its
 * weight to 0.45 lets proximity LEAD while style / budget / reviews still shade
 * the order rather than being switched off.
 */
export const NEAREST_WEIGHTS: CompatWeights = {
  refinement: 0.15,
  budgetFit: 0.13,
  distance: 0.45,
  reviews: 0.1,
  dateHeadroom: 0.06,
  faithFit: 0.05,
  trust: 0.06,
  demandPressure: 0,
  freshness: 0,
};

/**
 * "Fits your budget" — will not blow the budget set for this category.
 *
 * ⛔ READ THIS BEFORE WRITING ANY COPY FOR THIS LENS. `priceFitScore` returns a
 * flat 1.0 for EVERY vendor at or under budget, so every in-budget vendor ties
 * on the driving dimension and the order among them is decided by the other
 * six. What this lens genuinely ranks is DISTANCE FROM OVER-BUDGET — it sinks
 * the vendors who would break the budget. It does NOT rank value, and it cannot:
 * a ₱30k and an ₱89k photographer are indistinguishable to `budgetFitRatio`.
 * "Best value" / "cheapest" / "most for your money" are therefore unbackable
 * and are enforced-forbidden below.
 */
export const BUDGET_WEIGHTS: CompatWeights = {
  refinement: 0.18,
  budgetFit: 0.4,
  distance: 0.13,
  reviews: 0.12,
  dateHeadroom: 0.05,
  faithFit: 0.06,
  trust: 0.06,
  demandPressure: 0,
  freshness: 0,
};

/**
 * "New here" — recently joined and matches the brief.
 *
 * NOTE THE SECOND NUMBER, it is the whole lens: `reviews` drops from 0.18 to
 * **0.06**. At full weight a newcomer sits at the Bayesian prior (~0.6) while
 * every established rival scores above it, so a freshness lift of 0.25 is
 * simply out-ranked and the lens returns Best-matches order — a chip that
 * changes nothing. LOWERING REVIEWS *IS* THE LENS; raising freshness alone is
 * not. Anyone "tidying" reviews back up has silently deleted the feature.
 *
 * This is the only pro-newcomer mechanism on the bench, and the only lens that
 * behaves well in an empty marketplace.
 */
export const NEW_HERE_WEIGHTS: CompatWeights = {
  refinement: 0.22,
  budgetFit: 0.16,
  distance: 0.14,
  reviews: 0.06,
  dateHeadroom: 0.05,
  faithFit: 0.06,
  trust: 0.06,
  demandPressure: 0,
  freshness: 0.25,
};

/**
 * "In demand right now" — other couples have INQUIRED with this vendor for the
 * couple's exact date.
 *
 * Three constraints are load-bearing, all enforced upstream in
 * `lib/same-date-demand.ts` and again inside `demandSub`:
 * INQUIRY-BACKED (thread existence, never a save) · FLOORED AT 3 · EXACT DATE
 * ONLY (no fabricated month/year fallback).
 *
 * The weight is deliberately modest (0.22, below `Nearest`'s 0.45). Demand is
 * a fact about other people, not about this couple's fit, so it may shade the
 * order — it must never dominate it.
 */
export const DEMAND_WEIGHTS: CompatWeights = {
  refinement: 0.2,
  budgetFit: 0.15,
  distance: 0.13,
  reviews: 0.12,
  dateHeadroom: 0.06,
  faithFit: 0.06,
  trust: 0.06,
  demandPressure: 0.22,
  freshness: 0,
};

// ── The visibility gate (§15.2) ────────────────────────────────────────────

/** A lens needs a rail worth re-ordering before it can claim to re-order it. */
export const LENS_MIN_CANDIDATES = 3;
/** …and at least two MEASURED vendors, or there is nothing to put in order. */
export const LENS_MIN_RESOLVED_INPUTS = 2;

/**
 * The driving input for one lens on one candidate, or `null` when unresolved.
 *
 * `demandPressure` re-applies the privacy floor rather than trusting it: a
 * count below `MIN_DEMAND_COUPLE_COUNT` is NOT a resolved input, so it can
 * neither light up the chip nor be counted toward the two-measurable minimum.
 * The server already refuses to serialise one; this is the second gate.
 */
function drivingInput(dim: CompatDimension, c: CompatInputs): number | null {
  switch (dim) {
    case 'distance':
      return c.distanceKm ?? null;
    case 'budgetFit':
      return c.budgetFitRatio ?? null;
    case 'freshness':
      return c.freshnessRatio ?? null;
    case 'demandPressure': {
      const n = c.demandCoupleCount;
      return n != null && Number.isFinite(n) && n >= MIN_DEMAND_COUPLE_COUNT ? n : null;
    }
    default:
      return null;
  }
}

/**
 * §15.2 · a lens that cannot discriminate must not appear.
 *
 *   show(lens) := candidates >= 3
 *              && candidates with a non-null driving input >= 2
 *
 * With one measurable vendor there is nothing to order; with none the chip
 * would reorder nothing at all and read as broken. The default lens has no
 * driving input and is always offerable.
 *
 * This is not theoretical: prod measured 2026-07-27 has one unverified
 * `coming_soon` vendor profile and zero services, packages, reviews or stats.
 * Today only "Best matches" shows. That is correct behaviour for an empty
 * marketplace, not a bug — build for it.
 */
function gateOn(dim: CompatDimension) {
  return (candidates: readonly CompatInputs[]): boolean => {
    if (candidates.length < LENS_MIN_CANDIDATES) return true;
    let resolved = 0;
    for (const c of candidates) {
      if (drivingInput(dim, c) != null) resolved += 1;
      if (resolved >= LENS_MIN_RESOLVED_INPUTS) return false;
    }
    return true;
  };
}

export const LENSES: Record<LensKey, RankingLens> = {
  fit: {
    key: 'fit',
    label: 'Best matches',
    // The default vector, byte-identical to what every other caller uses. NOT a
    // copy — the same object, so the two can never drift apart.
    weights: COMPAT_WEIGHTS,
    requires: null,
    hideWhen: () => false,
    unavailableReason: null,
  },
  near: {
    key: 'near',
    label: 'Nearest to your venue',
    weights: NEAREST_WEIGHTS,
    requires: 'distance',
    hideWhen: gateOn('distance'),
    // §13.2 — distance is measured from `events.venue_latitude/longitude`. No
    // anchor ⇒ every distance is null ⇒ the lens is meaningless. Say so, and
    // say what would fix it.
    unavailableReason: 'Add your venue to sort by distance.',
  },
  budget: {
    key: 'budget',
    label: 'Fits your budget',
    weights: BUDGET_WEIGHTS,
    requires: 'budgetFit',
    hideWhen: gateOn('budgetFit'),
    unavailableReason: 'Set a budget for this category to sort by budget fit.',
  },
  new: {
    key: 'new',
    label: 'New here',
    weights: NEW_HERE_WEIGHTS,
    requires: 'freshness',
    hideWhen: gateOn('freshness'),
    unavailableReason: 'No recently joined vendors here yet.',
  },
  demand: {
    key: 'demand',
    label: 'In demand right now',
    weights: DEMAND_WEIGHTS,
    requires: 'demandPressure',
    hideWhen: gateOn('demandPressure'),
    // DELIBERATELY null — this is the one lens whose chip is REMOVED rather
    // than disabled. Every honest disabled-state wording either implies a
    // scarcity concept nothing measures, or discloses the absence of other
    // couples' activity on this couple's date. Below the floor the lens
    // renders NOTHING AT ALL, chip included. That is the §15.3 requirement,
    // not a styling choice.
    unavailableReason: null,
  },
};

/** Chip order in the segmented control. Default first, then the three that
 *  answer a specific question, then the one about other people. */
export const LENS_ORDER: readonly LensKey[] = ['fit', 'near', 'budget', 'new', 'demand'] as const;

export function isLensKey(key: string): key is LensKey {
  return key === 'fit' || key === 'near' || key === 'budget' || key === 'new' || key === 'demand';
}

export function lensWeights(key: LensKey): CompatWeights {
  return LENSES[key].weights;
}

/** Sum of a weight vector — the CI-checkable half of the sum-to-one invariant. */
export function weightSum(weights: CompatWeights): number {
  return (Object.keys(COMPAT_WEIGHTS) as CompatDimension[]).reduce(
    (total, dim) => total + weights[dim],
    0,
  );
}

/** Whether a lens can honestly be offered for this rail. */
export function isLensAvailable(key: LensKey, candidates: readonly CompatInputs[]): boolean {
  return !LENSES[key].hideWhen(candidates);
}

/**
 * The chips to render, in order, each already resolved to available / disabled
 * / absent. Returning "absent" as an EXCLUSION from this list (rather than a
 * flag on it) is what makes it impossible to render a demand chip by accident.
 */
export function visibleLenses(
  candidates: readonly CompatInputs[],
): { key: LensKey; label: string; disabled: boolean; reason: string | null }[] {
  const out: { key: LensKey; label: string; disabled: boolean; reason: string | null }[] = [];
  for (const key of LENS_ORDER) {
    const lens = LENSES[key];
    const hidden = lens.hideWhen(candidates);
    if (hidden && lens.unavailableReason == null) continue;
    out.push({
      key,
      label: lens.label,
      disabled: hidden,
      reason: hidden ? lens.unavailableReason : null,
    });
  }
  return out;
}

// ── The freshness anchor → ratio (§15.1) ───────────────────────────────────

/** How long a vendor counts as "new". Past it, freshness is UNKNOWN (NEUTRAL),
 *  not zero — being established is not a defect. */
export const FRESHNESS_WINDOW_DAYS = 90;

const MS_PER_DAY = 86_400_000;

/**
 * `firstVerifiedAt` → the 0–1 `freshnessRatio` the scorer consumes.
 *
 *   1.0 on the day of first verification, decaying linearly to 0 at
 *   `FRESHNESS_WINDOW_DAYS`, then `null`.
 *
 * Returns `null` — never 0 — for every uncertain case: no anchor, an
 * unparseable stamp, a future stamp (clock skew), or an established vendor.
 * `null` resolves to NEUTRAL in `compatSubScores`, so the failure mode is
 * "no head-start", never "penalised". An absent anchor can never make an
 * established vendor falsely read "New on Setnayan".
 */
export function freshnessRatioFrom(
  firstVerifiedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!firstVerifiedAt) return null;
  const t = Date.parse(firstVerifiedAt);
  if (!Number.isFinite(t)) return null;
  const ageDays = (nowMs - t) / MS_PER_DAY;
  if (ageDays < 0) return null;
  if (ageDays > FRESHNESS_WINDOW_DAYS) return null;
  return 1 - ageDays / FRESHNESS_WINDOW_DAYS;
}

// ── Honesty guardrails (§15.4) ─────────────────────────────────────────────

/**
 * Vocabulary no LENS may ever render — a CI-checkable version of the §15.4
 * "must NEVER say" column.
 *
 * SCOPE: lens labels and lens reason pills ONLY. It is deliberately NOT applied
 * to the two PLAIN SORTS ("Lowest price", "Top rated"), and that distinction is
 * the entire reason they are modelled as plain sorts rather than lenses. "Top
 * rated" is an honest description of a comparator the couple asked for; the
 * same words inside a RECOMMENDATION would be Setnayan vouching for the
 * vendor, which it has no basis to do.
 *
 * Each entry names the lens whose temptation it blocks and why the claim is
 * unbackable — so a future author who hits one of these knows what data would
 * have to exist first, rather than reaching for a synonym.
 */
export const FORBIDDEN_LENS_COPY: readonly { re: RegExp; lens: string; why: string }[] = [
  // "Fits your budget" — priceFitScore ties every in-budget vendor at 1.0, so
  // the data cannot rank value at any price point.
  { re: /\bbest value\b/i, lens: 'budget', why: 'priceFitScore ties every in-budget vendor' },
  { re: /\bcheapest\b/i, lens: 'budget', why: 'the lens ranks budget fit, not price' },
  { re: /\bmost for your money\b/i, lens: 'budget', why: 'no value signal exists' },
  { re: /\bbest (?:price|deal|rate)\b/i, lens: 'budget', why: 'no value signal exists' },
  { re: /\bgreat value\b/i, lens: 'budget', why: 'no value signal exists' },

  // "In demand right now" — there is no capacity counter.
  // `vendor_schedule_pool_bookings` has no cross-couple SELECT policy, and soft
  // holds never consume capacity, so every one of these is invented.
  { re: /\bonly\b[^.!?]{0,30}\bleft\b/i, lens: 'demand', why: 'no capacity counter exists' },
  { re: /\b(?:slots?|spots?|seats?|places?)\s+left\b/i, lens: 'demand', why: 'no capacity counter' },
  { re: /\bbooking fast\b/i, lens: 'demand', why: 'no booking-rate signal exists' },
  { re: /\b(?:almost|nearly)\s+gone\b/i, lens: 'demand', why: 'no capacity counter exists' },
  { re: /\block it in\b/i, lens: 'demand', why: 'urgency Setnayan cannot substantiate' },
  { re: /\b(?:selling|going|filling)\s+fast\b/i, lens: 'demand', why: 'no booking-rate signal' },
  { re: /\blast chance\b/i, lens: 'demand', why: 'urgency Setnayan cannot substantiate' },
  { re: /\bhurry\b/i, lens: 'demand', why: 'urgency Setnayan cannot substantiate' },
  { re: /\bact (?:now|fast)\b/i, lens: 'demand', why: 'urgency Setnayan cannot substantiate' },

  // "New here" — the anchor is the AGE OF A TIMESTAMP. It says when a vendor
  // joined and nothing whatsoever about how good they are.
  { re: /\bvetted\b/i, lens: 'new', why: 'freshness measures age, not quality' },
  { re: /\bhand-?picked\b/i, lens: 'new', why: 'freshness measures age, not quality' },
  { re: /\bcurated\b/i, lens: 'new', why: 'freshness measures age, not quality' },
  { re: /\bendorsed\b/i, lens: 'new', why: 'Setnayan endorses no vendor' },
  { re: /\brising star\b/i, lens: 'new', why: 'implies a trajectory nothing measures' },

  // "Best matches" — it matches the couple's stated brief. It does not rank
  // vendors in the abstract, and Setnayan recommends none of them.
  { re: /\bbest vendors?\b/i, lens: 'fit', why: 'the score is fit-to-brief, not quality' },
  { re: /\btop[- ]rated\b/i, lens: 'fit', why: 'a plain-sort claim, never a recommendation' },
  { re: /\brecommended by setnayan\b/i, lens: 'fit', why: 'Setnayan recommends no vendor' },
  { re: /\bsetnayan recommends\b/i, lens: 'fit', why: 'Setnayan recommends no vendor' },
];

/**
 * The first forbidden phrase in `text`, or `null` when it is clean. Used by the
 * unit suite to sweep every string a lens can render; also safe to call at a
 * render boundary if a future surface takes lens copy from data.
 */
export function findForbiddenLensCopy(text: string): string | null {
  for (const entry of FORBIDDEN_LENS_COPY) {
    const hit = entry.re.exec(text);
    if (hit) return hit[0];
  }
  return null;
}
