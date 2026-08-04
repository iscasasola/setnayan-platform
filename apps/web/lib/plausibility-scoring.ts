// NOTE: deliberately NOT 'server-only'. This module holds the PURE, I/O-free
// price-plausibility scorer + its constants/labels/types so the Node test runner
// (`tsx --test`, `pnpm test:unit`) can import it directly (mirrors the
// ghost-listing-scoring.ts / review-fraud split). The server-only I/O that feeds
// this — scanForUnderDeclaredLocks — lives in lib/plausibility-scanner.ts.

/**
 * Price-Under-Declaration Plausibility scorer — deterministic scoring of ONE
 * couple-confirmed locked booking (`event_vendors` row, status ≥ 'contracted',
 * `total_cost_php` > 0, NOT `excluded_from_market_median`) for the "the declared
 * price is implausibly low" signal. NO LLM, ₱0/run (Setnayan AI Rule 1).
 *
 * WHY THIS EXISTS (the second layer)
 * ----------------------------------
 * Couple-confirmation stays the load-bearing anchor on a lock's declared price —
 * the couple agreed to it, so it is real. This scanner is a CHEAP SECOND layer
 * that catches the *lazy liar*: a vendor who under-declares a lock to drag their
 * verified median down (see verified-median.ts — a lower verified price floods
 * them with leads whose budget they can't serve, but a vendor optimizing for
 * "look cheap in search" may still try it). It never penalizes; it only shrinks
 * the admin triage queue by surfacing the handful of locks worth a human glance.
 *
 * THREE DETERMINISTIC TIERS (each a pure `{ fired, severity }` sub-score)
 * ---------------------------------------------------------------------
 *   1. INCLUSION FLOOR (self-referential) — the lock's price vs the SUM of the
 *      vendor's OWN declared inclusion "worth ₱" (vendor_service_inclusions).
 *      Fires when the lock can't plausibly cover even a conservative fraction of
 *      what the vendor themselves says is included. ⚠ DATA GAP: worth_php is a
 *      vendor-stated MARKETING value, not an audited cost — so the trigger ratio
 *      is deliberately harsh (a large fraction below) to discount puffery.
 *   2. CATEGORY×LOCATION MEDIAN (cross-vendor) — the lock vs the published
 *      market band (market_price_bands low/median/high) for its category×region.
 *      ⚠ COMPETITION-LAW: this is the ONLY cross-vendor tier, and it is CAPPED so
 *      it can NEVER cross the flag threshold on its own — it can only CORROBORATE
 *      a self-referential signal. We never flag a vendor merely for being cheaper
 *      than peers, and this signal is INTERNAL-only (no couple/vendor "below
 *      market" copy anywhere).
 *   3. SELF-CONSISTENCY (self-referential) — the lock vs the VENDOR'S OWN
 *      verified median across their OTHER locks (verified-median.ts). Strongest +
 *      cheapest. A uniformly-cheap-but-honest vendor's locks all cluster, so none
 *      is an outlier vs their own norm → never fires. Only a single anomalously
 *      cheap lock among otherwise-normal locks fires.
 *
 * HOW HONEST BUDGET VENDORS ARE PROTECTED (the core design guarantee)
 * ------------------------------------------------------------------
 *   · Tiers 1 & 3 are SELF-referential — a vendor is only ever compared to their
 *     OWN promise (inclusions) or their OWN typical price (median). A cheap
 *     vendor whose every lock is ₱X is internally consistent → no flag.
 *   · Tier 2 (the only "you're cheaper than others" tier) is CAPPED below the
 *     flag threshold (TIER2_WEIGHT · 100 < FLAG_THRESHOLD), so it can NEVER flag
 *     a vendor on its own. It only nudges a lock that a self-referential tier has
 *     already independently flagged.
 *   · Everything is detect-and-review: a human dismisses false positives and a
 *     dismissed flag stays dismissed. NO automated penalty, ever.
 */

// ── Owner-tunable thresholds (first-pass defaults) ──────────────────────────

/**
 * TIER 1 · Inclusion floor. Fires when the lock is below this fraction of the
 * summed declared inclusion worth. 0.33 = "the price is under a THIRD of what
 * the vendor says is included" — harsh on purpose because worth_php is stated
 * marketing value, not audited cost, so mild "value" puffery must not trip it.
 */
export const TIER1_INCLUSION_RATIO = 0.33;
/** Weight applied to tier-1 severity in the combined score. */
export const TIER1_WEIGHT = 0.6;

/**
 * TIER 2 · Category×location band. Fires when the lock is below this fraction of
 * the market band's LOW (not the median — we only flag EXTREME outliers below
 * the entire observed band, never merely "below average"). 0.5 = under half the
 * cheapest observed peer price.
 */
export const TIER2_BAND_LOW_RATIO = 0.5;
/**
 * Weight applied to tier-2 severity. CAPPED so tier-2-alone maxes at
 * TIER2_WEIGHT·100 = 35 < FLAG_THRESHOLD (50): tier 2 can never flag on its own.
 * This is the competition-law / anti-conformity guard.
 */
export const TIER2_WEIGHT = 0.35;

/**
 * TIER 3 · Self-consistency. Fires when the lock is below this fraction of the
 * vendor's OWN verified median (over their OTHER locks). 0.4 = "under 40% of
 * their own typical price" — a >60% discount on a genuine paid booking is the
 * implausible-under-declaration signal. A legit 50%-off booking (ratio 0.5)
 * does NOT fire.
 */
export const TIER3_SELF_RATIO = 0.4;
/** Weight applied to tier-3 severity. 1.0 — a strong self-inconsistency alone is
 *  actionable (the vendor vs themselves, not conformity). */
export const TIER3_WEIGHT = 1.0;

/** Combined 0..100 score at/above which the lock is flagged into the queue. */
export const FLAG_THRESHOLD = 50;

// ── Types ───────────────────────────────────────────────────────────────────

/** A single tier's deterministic outcome. */
export type TierScore = {
  /** Did this tier's trigger condition fire? */
  fired: boolean;
  /**
   * 0..100 severity IF fired (how far below the reference, in %), else 0.
   * severity = round((1 - lock/ref) * 100), clamped 0..100.
   */
  severity: number;
  /** Weighted contribution to the combined score (severity · weight). */
  weighted: number;
  /** The reference figure this tier compared against (whole PHP), or null when
   *  the tier had no data to evaluate (e.g. no inclusions, no band, thin median). */
  refPhp: number | null;
  /** True when this tier had no data to evaluate — distinct from fired=false with
   *  data (which means "evaluated, plausible"). Never contributes to the score. */
  noData: boolean;
};

/** Non-PII evidence persisted alongside a flag (RA 10173-safe: only the lock's
 *  own figures + this vendor's own aggregates — no couple identity, no peer
 *  prices, no cross-vendor per-row data). */
export type PlausibilityDetail = {
  score: number;
  lock_price_php: number;
  fired_tiers: PlausibilityTierKey[];
  tiers: {
    inclusion_floor: TierScore;
    category_median: TierScore;
    self_consistency: TierScore;
  };
};

export type PlausibilityTierKey =
  | 'inclusion_floor'
  | 'category_median'
  | 'self_consistency';

export type PlausibilityScore = {
  /** Combined 0..100 (higher = more implausible). */
  score: number;
  /** True when score >= FLAG_THRESHOLD → belongs in the admin queue. */
  flagged: boolean;
  /** Machine label = the strongest weighted tier that fired (or 'plausible'). */
  reason: PlausibilityTierKey | 'plausible';
  detail: PlausibilityDetail;
};

// ── Inputs (all I/O-derived numbers passed in; the module never fetches) ─────

export type PlausibilityInputs = {
  /** The couple-confirmed declared price of the lock under test (whole PHP). */
  lockPricePhp: number;
  /**
   * TIER 1 · Sum of this vendor's declared inclusion worth (Σ worth_php over the
   * matched listing's vendor_service_inclusions with a stated worth), or null
   * when the lock resolves to no structured inclusions with a worth (the data
   * gap → tier 1 has no data, never fires).
   */
  inclusionWorthPhp: number | null;
  /**
   * TIER 2 · The market band LOW for this lock's category×region (whole PHP), or
   * null when there is no band above the min-N floor (the founder-only reality →
   * tier 2 has no data). INTERNAL admin context only.
   */
  bandLowPhp: number | null;
  /**
   * TIER 3 · This vendor's OWN verified median across their OTHER locks (whole
   * PHP), or null when < MIN_MEDIAN_SAMPLE qualifying other locks (not
   * established → tier 3 has no data, never fires). The subject lock is excluded
   * from its own reference so a genuinely-low lock can't mask itself.
   */
  ownMedianPhp: number | null;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Score one tier: fires when `lock / ref < triggerRatio` (ref must be a positive
 * finite number and lock a non-negative finite number). Severity is how far
 * BELOW the full reference the lock sits, in percent — independent of the
 * trigger ratio, so a lock at 20% of ref always scores 80 whichever tier asks.
 * A null/non-positive ref → noData (never fires, never scores). Pure + exported
 * for unit tests.
 */
export function scoreTier(
  lockPricePhp: number,
  refPhp: number | null,
  triggerRatio: number,
  weight: number,
): TierScore {
  const noRef = refPhp == null || !Number.isFinite(refPhp) || refPhp <= 0;
  const badLock = !Number.isFinite(lockPricePhp) || lockPricePhp < 0;
  if (noRef || badLock) {
    return { fired: false, severity: 0, weighted: 0, refPhp: refPhp ?? null, noData: true };
  }
  const ref = refPhp as number;
  const ratio = lockPricePhp / ref;
  const fired = ratio < triggerRatio;
  if (!fired) {
    return { fired: false, severity: 0, weighted: 0, refPhp: ref, noData: false };
  }
  const severity = clamp(Math.round((1 - ratio) * 100), 0, 100);
  return { fired: true, severity, weighted: severity * weight, refPhp: ref, noData: false };
}

/**
 * Combine the three deterministic tiers into a 0..100 plausibility score + a
 * flag decision. Pure + deterministic — every I/O-derived number is passed in.
 *
 * COMBINED = clamp(round(tier1.weighted + tier2.weighted + tier3.weighted)).
 * FLAGGED  = score >= FLAG_THRESHOLD.
 *
 * The weights are chosen so:
 *   · Tier 2 alone (cross-vendor) maxes at 35 < 50 → NEVER flags on its own.
 *   · Tier 3 alone (self, weight 1.0) crosses 50 at severity 50 (ratio 0.5) — but
 *     its trigger is ratio < 0.4, so the lightest tier-3 fire is severity 60 → it
 *     flags (a >60% discount off the vendor's own median is actionable alone).
 *   · Tier 1 alone crosses only when very severe (severity ≥ 84 → weighted ≥ 50).
 */
export function scorePlausibility(inputs: PlausibilityInputs): PlausibilityScore {
  const { lockPricePhp, inclusionWorthPhp, bandLowPhp, ownMedianPhp } = inputs;

  const inclusion_floor = scoreTier(
    lockPricePhp,
    inclusionWorthPhp,
    TIER1_INCLUSION_RATIO,
    TIER1_WEIGHT,
  );
  const category_median = scoreTier(
    lockPricePhp,
    bandLowPhp,
    TIER2_BAND_LOW_RATIO,
    TIER2_WEIGHT,
  );
  const self_consistency = scoreTier(
    lockPricePhp,
    ownMedianPhp,
    TIER3_SELF_RATIO,
    TIER3_WEIGHT,
  );

  const score = clamp(
    Math.round(
      inclusion_floor.weighted + category_median.weighted + self_consistency.weighted,
    ),
    0,
    100,
  );

  const firedList: [PlausibilityTierKey, TierScore][] = [
    ['self_consistency', self_consistency],
    ['inclusion_floor', inclusion_floor],
    ['category_median', category_median],
  ];
  const fired_tiers = firedList.filter(([, t]) => t.fired).map(([k]) => k);

  // Primary reason = the strongest WEIGHTED tier that fired (self-consistency
  // wins ties — it's the most defensible signal).
  const strongest = [...firedList]
    .filter(([, t]) => t.fired)
    .sort((a, b) => b[1].weighted - a[1].weighted)[0];
  const flagged = score >= FLAG_THRESHOLD;
  const reason: PlausibilityTierKey | 'plausible' =
    flagged && strongest ? strongest[0] : 'plausible';

  const detail: PlausibilityDetail = {
    score,
    lock_price_php: lockPricePhp,
    fired_tiers,
    tiers: { inclusion_floor, category_median, self_consistency },
  };

  return { score, flagged, reason, detail };
}

/**
 * Human copy for each tier reason. INTERNAL admin-facing ONLY — deliberately
 * phrased as an internal-consistency question, never a "this vendor is cheap"
 * verdict, and NEVER rendered to a couple or vendor (competition-law guard).
 */
export const PLAUSIBILITY_REASON_LABEL: Record<string, string> = {
  self_consistency:
    'This lock is far below this vendor’s own verified median — a large outlier vs their own typical declared price.',
  inclusion_floor:
    'This lock is far below the summed worth of what the vendor says is included — the declared price may not cover the stated inclusions.',
  category_median:
    'Internal signal only: this lock sits well below the market band for its category and area (corroborating context — never surfaced to couples or vendors).',
  plausible: 'Within plausible range — no under-declaration signal.',
};
