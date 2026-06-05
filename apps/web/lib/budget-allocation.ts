/**
 * Budget Planner — median-anchored ALLOCATION engine.
 *
 * Design: `Budget_Planner_Allocation_Engine_2026-06-05.md` (spec corpus). The
 * COUNTERPART to `lib/budget.ts`: that module TRACKS what booked vendors actually
 * cost; this one RECOMMENDS what each service SHOULD cost — a ₱ target + shopping
 * range per service leaf, BEFORE the couple picks anyone.
 *
 * Pure + integration-agnostic (mirrors `lib/compat-score.ts`): the caller resolves
 * each leaf's market median from SOLO vendor prices, GATE-scoped to the couple's
 * market and pax-normalized (the same eligibility query the matcher runs); this
 * module only does the math. **No prices are invented here** — every number is
 * caller-supplied or a proportion of the couple's own budget.
 *
 * The spine: `weight_L = median(solo prices on L)` → `share = weight / Σweight` →
 * `₱target = share × budget`. One leaf = 100% (the owner's ₱1M base case), refined:
 *
 *  - FIXED-then-proportion — known Setnayan-SKU leaves (`fixedPhp`) carve off the
 *    top as exact lines; the proportion runs only over the estimated external pool.
 *  - CUSHION / slack-first — surplus over Σmedian parks as a visible **cushion**
 *    (we never inflate a leaf above its market median to fill the budget); a TIGHT
 *    budget compresses leaves proportionally. A couple PIN raising a leaf drains the
 *    cushion first, then proportionally drains the unpinned leaves — an emergent
 *    property of the slack-vs-tight branch, with no explicit ordering loop.
 *  - SOFT FLOOR — a leaf below its cheapest real solo price flags `belowFloor`
 *    (warn, never block). Feasibility `shortfallPhp` warns when the budget can't
 *    cover the cheapest viable version of everything.
 *  - BAND — `p25..p75` (or `median ± bandPct`) = the "₱X–₱Y to work in" range.
 *
 * It is a GUIDE, never a rule: the result is a set of defaults the couple overrides
 * via pins; nothing here blocks or clamps the couple's own number.
 *
 * `surplusMode` resolves the one design tension: `'park'` (default, the endorsed
 * cushion model — a lone/last service sits at its median, remainder = cushion) vs
 * `'distribute'` (the naive spine — unpinned leaves scale up to fill the budget, so
 * one leaf = 100%). Config knobs (`minSampleN` / confidence cutoffs / `bandPct` /
 * `surplusMode`) are admin-tunable — NOT prices. Owner-to-set per the design doc §10;
 * the defaults below are the starting recommendation.
 */

export type SurplusMode = 'park' | 'distribute';

export type AllocationConfig = {
  /** Below this many solo prices a leaf's median is "thin" → prefer an admin
   *  benchmark, and confidence is capped at 'low'. */
  minSampleN: number;
  /** ≥ this sample count → 'high' confidence. */
  highConfidenceN: number;
  /** ≥ this sample count → 'medium' confidence (else 'low'). */
  medConfidenceN: number;
  /** ± fraction for the shopping band when p25/p75 aren't supplied. */
  bandPct: number;
  /** How budget ABOVE the sum of medians is handled (see module header). */
  surplusMode: SurplusMode;
};

/** §2 starting recommendation. Thresholds + band are statistical knobs, not money. */
export const DEFAULT_ALLOCATION_CONFIG: AllocationConfig = {
  minSampleN: 3,
  highConfidenceN: 8,
  medConfidenceN: 3,
  bandPct: 0.15,
  surplusMode: 'park',
};

export type LeafConfidence = 'high' | 'medium' | 'low' | 'none';
export type LeafSource = 'fixed' | 'pinned' | 'median' | 'benchmark' | 'none';

export type LeafInput = {
  /** The service leaf (canonical_service) this row prices. */
  canonicalService: string;
  /** Median of SOLO prices for this leaf in the couple's market (caller computes
   *  via the GATE-scoped, pax-normalized query). Null = no market data. */
  medianPhp?: number | null;
  /** Interquartile bounds for the shopping band. Null → band falls back to ±bandPct. */
  p25Php?: number | null;
  p75Php?: number | null;
  /** Cheapest real solo price = the soft floor. Null → no floor known. */
  floorPhp?: number | null;
  /** Admin-seeded benchmark, used when the leaf is below minSampleN or has no median. */
  benchmarkPhp?: number | null;
  /** How many solo prices back the median (drives confidence + thin-data fallback). */
  sampleCount?: number | null;
  /** KNOWN fixed price (a Setnayan SKU) → carved out exact, never proportioned.
   *  Null = estimated/external leaf. */
  fixedPhp?: number | null;
  /** The couple's pin: an explicit ₱ target for this leaf. Null = unpinned (the
   *  engine fills the default). Ignored for fixed leaves. */
  pinnedAmountPhp?: number | null;
};

export type AllocationInput = {
  /** The couple's total budget in PHP. */
  budgetPhp: number;
  /** The service leaves the couple selected. */
  leaves: ReadonlyArray<LeafInput>;
  /** Per-call config overrides (else DEFAULT_ALLOCATION_CONFIG). */
  config?: Partial<AllocationConfig>;
};

export type LeafAllocation = {
  canonicalService: string;
  /** Recommended ₱ for this leaf (post-fixed, post-pin, post-cushion). */
  amountPhp: number;
  /** Share of total budget, basis points (0–10000). */
  shareBp: number;
  /** The "₱X–₱Y to work in" shopping range (market-derived, independent of tilt). */
  rangeLowPhp: number;
  rangeHighPhp: number;
  /** Where the number came from. */
  source: LeafSource;
  pinned: boolean;
  /** Data-density confidence (calibrates the UI: tight vs "rough estimate"). */
  confidence: LeafConfidence;
  /** True when amount fell below the leaf's cheapest real price — WARN, never block. */
  belowFloor: boolean;
};

export type AllocationResult = {
  leaves: LeafAllocation[];
  /** Visible buffer = budget − Σ amounts. Negative = over budget. */
  cushionPhp: number;
  /** cushionPhp < 0. */
  overBudget: boolean;
  /** max(0, Σ cheapest-viable − budget): the budget can't cover the floor of
   *  everything selected. Advisory shortfall, never a block. */
  shortfallPhp: number;
  totalAllocatedPhp: number;
};

function clampMinZeroInt(n: number | null | undefined): number {
  if (n == null || !Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function leafConfidence(sampleCount: number, cfg: AllocationConfig): LeafConfidence {
  if (sampleCount >= cfg.highConfidenceN) return 'high';
  if (sampleCount >= cfg.medConfidenceN) return 'medium';
  if (sampleCount >= 1) return 'low';
  return 'none';
}

/** The "typical cost" of an estimated leaf: a confident median, else an admin
 *  benchmark, else a thin median, else nothing (no data). */
function pickTypical(
  leaf: LeafInput,
  cfg: AllocationConfig,
): { php: number; source: LeafSource; confidence: LeafConfidence } {
  const n = leaf.sampleCount ?? 0;
  const hasMedian = leaf.medianPhp != null && leaf.medianPhp > 0;
  const hasBench = leaf.benchmarkPhp != null && leaf.benchmarkPhp > 0;
  if (hasMedian && n >= cfg.minSampleN) {
    return { php: Math.round(leaf.medianPhp as number), source: 'median', confidence: leafConfidence(n, cfg) };
  }
  if (hasBench) {
    return { php: Math.round(leaf.benchmarkPhp as number), source: 'benchmark', confidence: 'low' };
  }
  if (hasMedian) {
    // Thin median (below minSampleN, no benchmark) — better than nothing, but low-confidence.
    return { php: Math.round(leaf.medianPhp as number), source: 'median', confidence: 'low' };
  }
  return { php: 0, source: 'none', confidence: 'none' };
}

/** Market shopping band: p25..p75 when supplied, else median ± bandPct. */
function leafRange(typicalPhp: number, leaf: LeafInput, cfg: AllocationConfig): { low: number; high: number } {
  const low = leaf.p25Php != null ? Math.round(leaf.p25Php) : Math.round(typicalPhp * (1 - cfg.bandPct));
  const high = leaf.p75Php != null ? Math.round(leaf.p75Php) : Math.round(typicalPhp * (1 + cfg.bandPct));
  const lo = Math.max(0, low);
  return { low: lo, high: Math.max(lo, high) };
}

/**
 * Compute the recommended per-leaf ₱ allocation + shopping ranges + cushion for a
 * couple's budget and selected service leaves. Pure: same inputs → same output.
 */
export function computeBudgetAllocation(input: AllocationInput): AllocationResult {
  const cfg: AllocationConfig = { ...DEFAULT_ALLOCATION_CONFIG, ...(input.config ?? {}) };
  const budget = clampMinZeroInt(input.budgetPhp);

  const fixed = input.leaves.filter((l) => l.fixedPhp != null);
  const estimated = input.leaves.filter((l) => l.fixedPhp == null);

  const fixedPool = fixed.reduce((s, l) => s + clampMinZeroInt(l.fixedPhp), 0);

  // Typical cost per estimated leaf (median / benchmark / thin / none).
  const typicals = new Map<string, { php: number; source: LeafSource; confidence: LeafConfidence }>();
  for (const l of estimated) typicals.set(l.canonicalService, pickTypical(l, cfg));

  // Pins carve out before the proportional split (a pin is the couple's number).
  const pinnedPool = estimated.reduce(
    (s, l) => s + (l.pinnedAmountPhp != null ? clampMinZeroInt(l.pinnedAmountPhp) : 0),
    0,
  );
  const unpinned = estimated.filter((l) => l.pinnedAmountPhp == null);
  const sumTypicalUnpinned = unpinned.reduce((s, l) => s + (typicals.get(l.canonicalService)?.php ?? 0), 0);

  // What's left for the unpinned estimated leaves after fixed + pins.
  const availableForUnpinned = budget - fixedPool - pinnedPool;

  // Resolve each unpinned leaf's amount. The slack-vs-tight branch reproduces the
  // cushion / slack-first / proportional-drain mechanic with no ordering loop.
  const unpinnedAmount = new Map<string, number>();
  if (sumTypicalUnpinned <= 0) {
    // Nothing priceable to spread onto — all surplus is cushion.
    for (const l of unpinned) unpinnedAmount.set(l.canonicalService, 0);
  } else if (availableForUnpinned >= sumTypicalUnpinned) {
    if (cfg.surplusMode === 'distribute') {
      // Naive spine: scale up to fill the budget (one leaf → 100%).
      const factor = availableForUnpinned / sumTypicalUnpinned;
      for (const l of unpinned) {
        unpinnedAmount.set(l.canonicalService, Math.round((typicals.get(l.canonicalService)?.php ?? 0) * factor));
      }
    } else {
      // PARK (endorsed): each at its median, the rest becomes visible cushion.
      for (const l of unpinned) unpinnedAmount.set(l.canonicalService, typicals.get(l.canonicalService)?.php ?? 0);
    }
  } else {
    // TIGHT regime: compress proportionally (factor ≤ 1; 0 when over-committed).
    const factor = availableForUnpinned > 0 ? availableForUnpinned / sumTypicalUnpinned : 0;
    for (const l of unpinned) {
      unpinnedAmount.set(l.canonicalService, Math.round((typicals.get(l.canonicalService)?.php ?? 0) * factor));
    }
  }

  const leaves: LeafAllocation[] = [];

  // Fixed leaves — exact known prices, full confidence, zero-width range.
  for (const l of fixed) {
    const amt = clampMinZeroInt(l.fixedPhp);
    leaves.push({
      canonicalService: l.canonicalService,
      amountPhp: amt,
      shareBp: budget > 0 ? Math.round((amt / budget) * 10000) : 0,
      rangeLowPhp: amt,
      rangeHighPhp: amt,
      source: 'fixed',
      pinned: false,
      confidence: 'high',
      belowFloor: false,
    });
  }

  // Estimated leaves — pinned use the couple's number; unpinned use the resolved split.
  for (const l of estimated) {
    const t = typicals.get(l.canonicalService) ?? { php: 0, source: 'none' as LeafSource, confidence: 'none' as LeafConfidence };
    const pinned = l.pinnedAmountPhp != null;
    const amt = pinned ? clampMinZeroInt(l.pinnedAmountPhp) : (unpinnedAmount.get(l.canonicalService) ?? 0);
    const range = leafRange(t.php, l, cfg);
    const floor = l.floorPhp ?? null;
    // belowFloor only when we actually placed money under the cheapest real price;
    // amt === 0 means "no data / not funded", not a floor breach.
    const belowFloor = floor != null && amt > 0 && amt < Math.round(floor);
    leaves.push({
      canonicalService: l.canonicalService,
      amountPhp: amt,
      shareBp: budget > 0 ? Math.round((amt / budget) * 10000) : 0,
      rangeLowPhp: range.low,
      rangeHighPhp: range.high,
      source: pinned ? 'pinned' : t.source,
      pinned,
      confidence: t.confidence,
      belowFloor,
    });
  }

  const totalAllocatedPhp = leaves.reduce((s, l) => s + l.amountPhp, 0);
  const cushionPhp = budget - totalAllocatedPhp;

  // Feasibility: the cheapest viable version of EVERYTHING selected (floor, else typical).
  const minViable = input.leaves.reduce((s, l) => {
    if (l.fixedPhp != null) return s + clampMinZeroInt(l.fixedPhp);
    const t = typicals.get(l.canonicalService);
    const floor = l.floorPhp ?? t?.php ?? 0;
    return s + clampMinZeroInt(floor);
  }, 0);

  return {
    leaves,
    cushionPhp,
    overBudget: cushionPhp < 0,
    shortfallPhp: Math.max(0, minViable - budget),
    totalAllocatedPhp,
  };
}
