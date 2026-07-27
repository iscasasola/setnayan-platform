/**
 * ranking-lenses.ts — the bench's NAMED WEIGHT VECTORS (Explore_Replan §15).
 *
 * There is exactly ONE scorer on this platform — `lib/compat-score.ts`. A
 * "lens" is not a second scorer and not a bespoke comparator: it is a named
 * weight vector handed to `computeCompatScore`, plus the copy the couple reads
 * and the rule that decides whether the lens can honestly be offered at all.
 *
 * ── WHAT SHIPS (owner-scoped 2026-07-27): exactly TWO lenses.
 *   • Best matches           — the default; `COMPAT_WEIGHTS` unchanged.
 *   • Nearest to your venue  — distance raised to 0.45, the rest rebalanced.
 *
 * ── WHAT DOES NOT SHIP, and why it is not even stubbed here:
 *   • "Fits your budget"  — `priceFitScore` returns a flat 1.0 for EVERY vendor
 *     inside the budget (`lib/smart-sort.ts`), so every in-budget vendor ties.
 *     A lens that cannot order its own driving dimension is a label, not a
 *     recommendation. §15.4 additionally forbids the "best value / cheapest"
 *     copy such a lens would invite.
 *   • "New here"          — PR #3839 landed the anchor (`firstVerifiedAt`, from
 *     the append-only `vendor_tier_history`, so a renewal cannot relabel an
 *     established vendor "new"), but there is still no `freshness` DIMENSION in
 *     `COMPAT_WEIGHTS` to give it weight, and standing one up is the owner
 *     decision at §15.9-1. Not this PR.
 *   • "In demand right now" — ⛔ BLOCKED. PR #3839 re-sourced the count to
 *     inquiry-backed threads and floored it at n≥3, which fixes the INPUT (the
 *     shipped signal counted SAVES, the exact "manufactured scarcity, a
 *     fineable dark pattern" the 2026-06-02 ruling forbids) — but the LENS is
 *     still blocked on the owner's min-N ruling (§8.3 "don't show a 1" vs the
 *     2026-07-02 couple-aggregate min-N 25 + DPO gate) and there is still no
 *     cross-couple capacity read to back an "N left" claim. `demandPressure`
 *     therefore stays at weight 0 in every vector here. Do not add a vector
 *     that gives it weight without owner decisions §15.9-2 and §15.9-3.
 *
 * INVARIANT: every vector sums to 1.000, asserted per-member in the sibling
 * test. Pure + framework-free so it is trivially unit-testable.
 */

import { COMPAT_WEIGHTS, type CompatDimension, type CompatWeights } from '@/lib/compat-score';

/** The lens keys that ship. `'fit'` is kept as the key for "Best matches" so
 *  the flag-OFF bench, the persisted preference and every existing `BenchSort`
 *  consumer keep working unchanged — only the LABEL is new. */
export type LensKey = 'fit' | 'near';

export type RankingLens = {
  key: LensKey;
  /** What the bride reads on the chip. */
  label: string;
  weights: CompatWeights;
  /**
   * The dimension this lens is ABOUT. A lens must not appear when its driving
   * input is missing across the bench — a sort that silently no-ops is worse
   * than no sort (§15.2). `null` = always offerable (the default lens degrades
   * to a defensible order even at zero resolved inputs).
   */
  drivingDimension: CompatDimension | null;
  /** Honest copy for the disabled chip when `drivingDimension` has no data. */
  unavailableReason: string | null;
};

/**
 * "Nearest to your venue" — least travel, least logistics cost, lowest day-of
 * risk.
 *
 * This is NOT a raw km sort. `distanceSub` is a continuous half-life decay, so
 * 2 km and 19 km genuinely differ; raising its weight to 0.45 lets proximity
 * lead while style / budget / reviews still shade the order rather than being
 * switched off. The remaining six dims are scaled down proportionally-ish and
 * hand-rounded so the vector lands exactly on 1.000.
 */
export const NEAREST_WEIGHTS: CompatWeights = {
  refinement: 0.15,
  budgetFit: 0.13,
  distance: 0.45,
  reviews: 0.1,
  dateHeadroom: 0.06,
  faithFit: 0.05,
  trust: 0.06,
  // Inert here, exactly as in the global vector. The dimension exists (#3839
  // landed its honest, inquiry-backed, min-N-floored input) but the lens that
  // would give it weight is blocked — see the header. A proximity lens must
  // never smuggle scarcity into its order.
  demandPressure: 0,
};

export const LENSES: Record<LensKey, RankingLens> = {
  fit: {
    key: 'fit',
    label: 'Best matches',
    // The default vector, byte-identical to what every other caller uses.
    weights: COMPAT_WEIGHTS,
    drivingDimension: null,
    unavailableReason: null,
  },
  near: {
    key: 'near',
    label: 'Nearest to your venue',
    weights: NEAREST_WEIGHTS,
    drivingDimension: 'distance',
    // §13.2 — distance is measured from `events.venue_latitude/longitude`. No
    // anchor ⇒ every distance is null ⇒ the lens is meaningless. Say so.
    unavailableReason: 'Add your venue to sort by distance.',
  },
};

/** Chip order in the segmented control. Default first. */
export const LENS_ORDER: readonly LensKey[] = ['fit', 'near'] as const;

export function isLensKey(key: string): key is LensKey {
  return key === 'fit' || key === 'near';
}

export function lensWeights(key: LensKey): CompatWeights {
  return LENSES[key].weights;
}

/** Sum of a weight vector — the CI-checkable half of the sum-to-one invariant.
 *  Iterates the dimension list rather than naming fields, so a dimension added
 *  to `COMPAT_WEIGHTS` later is counted here automatically instead of being
 *  silently excluded from the invariant it is supposed to satisfy. */
export function weightSum(weights: CompatWeights): number {
  let total = 0;
  for (const dim of Object.keys(COMPAT_WEIGHTS) as CompatDimension[]) total += weights[dim];
  return total;
}

/**
 * The minimum shape a bench card must have for the visibility gate. Structural
 * on purpose — `ShortlistVendor` satisfies it without this module importing the
 * taxonomy.
 */
export type LensCandidate = { distanceKm: number | null };

/** The gate's thresholds, named so the test and the comment cannot drift. */
export const LENS_MIN_CANDIDATES = 3;
export const LENS_MIN_RESOLVED_INPUTS = 2;

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
 * Hidden ≠ removed: the caller renders the chip DISABLED carrying
 * `LENSES[key].unavailableReason`, so the couple learns what would switch it on.
 */
export function isLensAvailable(key: LensKey, candidates: readonly LensCandidate[]): boolean {
  const lens = LENSES[key];
  if (lens.drivingDimension == null) return true;
  if (candidates.length < LENS_MIN_CANDIDATES) return false;
  const resolved = candidates.reduce((n, c) => (c.distanceKm != null ? n + 1 : n), 0);
  return resolved >= LENS_MIN_RESOLVED_INPUTS;
}
