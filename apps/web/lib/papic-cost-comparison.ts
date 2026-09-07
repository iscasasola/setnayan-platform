/**
 * apps/web/lib/papic-cost-comparison.ts
 *
 * "WHAT THIS WOULD OTHERWISE COST YOU" — the market-cost comparison on the
 * public `/papic` page (WHAT_IS_LEFT_2026-08-17.md §6 item 13).
 *
 * ── THE PHOTOGRAPHER SIDE IS A STATED MARKET ASSUMPTION, TYPED ONCE ─────────
 * Relayed to engineering 2026-09-08, attributed to the owner: *"a single
 * photographer walking around inside a venue would cost around 8000 and can
 * only accommodate 100 photos in an hour... in a 4 hour event that is 400
 * photos."*
 *
 * ⚠ THIS COULD NOT BE CONFIRMED AS A STANDING DECISION-LOG ROW AT BUILD TIME.
 * `DECISION_LOG.md`'s last entry as of this PR is dated 2026-09-07; no
 * 2026-09-08 row existed naming this figure when this file was written. The
 * three numbers below are recorded as a MARKET ASSUMPTION relayed for this
 * feature, not as a verified owner-locked price the way every other figure on
 * this page is. Flagged in the PR description and changelog fragment for
 * owner confirmation — if the assumption is wrong, correct it HERE, the one
 * place it is typed, and nowhere else.
 *
 * That is also why these three constants are the only Papic-page numbers that
 * are NOT read from an admin-owned table: there is no `platform_retail_
 * catalog_v2` row for "a photographer's day rate" to read live, because it is
 * not a Setnayan price at all.
 *
 * ── THE PAPIC SIDE IS NEVER TYPED ────────────────────────────────────────
 * `resolvePapicComparisonRung` picks the rung to compare against out of the
 * SAME `rungs` array `resolvePapicAnchor()` already resolved from the live
 * catalog (`platform_retail_catalog_v2` + `papic_pass_tiers`) — no second
 * fetch, no second source of truth. It is the smallest rung whose credit
 * count is at least the photographer's assumed shot count, or — if every rung
 * falls short — the single largest rung available. That is the identical
 * "smallest rung that clears a want" rule `_papic-dial.tsx`'s own `idealIdx`
 * already uses for its per-guest recommendation; this module does not invent
 * a second nearest-match idea.
 *
 * If no rung can be priced at all (a degraded catalog read), the comparison
 * resolves to `null` and the caller omits the section — the same "fails
 * quiet" rule the rest of this page's cost block follows.
 */

/** ₱8,000 — a single photographer's assumed day rate for the comparison. */
export const COMPARISON_PHOTOGRAPHER_DAY_RATE_PHP = 8_000;

/** ~100 photographs an hour — the assumed capture rate for one photographer. */
export const COMPARISON_PHOTOGRAPHER_SHOTS_PER_HOUR = 100;

/** A typical reception, for this comparison's purposes: four hours. */
export const COMPARISON_EVENT_HOURS = 4;

/** Derived, never re-typed: 100 × 4 = 400. */
export const COMPARISON_PHOTOGRAPHER_SHOTS =
  COMPARISON_PHOTOGRAPHER_SHOTS_PER_HOUR * COMPARISON_EVENT_HOURS;

/** The minimal shape this module needs out of a priced Papic rung. */
export type PapicComparisonRung = {
  /** Credits the rung buys. */
  bought: number;
  /** Peso price of the rung, from the ACTIVE customer catalog. */
  peso: number;
};

export type PapicCostComparison = {
  /** The photographer's assumed total photo count for one event. */
  photographerShots: number;
  photographerPeso: number;
  photographerPesoPerShot: number;
  /** The Papic rung actually compared against — may not equal photographerShots. */
  papicShots: number;
  papicPeso: number;
  papicPesoPerShot: number;
  /**
   * How many times cheaper Papic is, per credit, against the photographer
   * assumption. Floored rather than rounded — this page must never overstate
   * a saving, and a floor never can.
   */
  timesCheaper: number;
  /** True only when the matched rung's credit count equals the assumption exactly. */
  exactMatch: boolean;
};

/**
 * The rung to compare against: the smallest priced rung whose credit count is
 * at least `targetShots`, or — if every rung falls short — the single largest
 * rung available. `null` when nothing is priced at all.
 */
export function resolvePapicComparisonRung(
  rungs: readonly PapicComparisonRung[],
  targetShots: number,
): PapicComparisonRung | null {
  const priced = rungs.filter((r) => r.bought > 0 && Number.isFinite(r.peso) && r.peso > 0);
  if (priced.length === 0) return null;
  const sorted = [...priced].sort((a, b) => a.bought - b.bought);
  return sorted.find((r) => r.bought >= targetShots) ?? sorted[sorted.length - 1]!;
}

/**
 * The full comparison, or `null` when no rung can be priced (the catalog read
 * degraded) — the caller must omit the section rather than render a zero.
 */
export function buildPapicCostComparison(
  rungs: readonly PapicComparisonRung[],
): PapicCostComparison | null {
  const rung = resolvePapicComparisonRung(rungs, COMPARISON_PHOTOGRAPHER_SHOTS);
  if (rung === null) return null;

  const photographerPeso = COMPARISON_PHOTOGRAPHER_DAY_RATE_PHP;
  const photographerShots = COMPARISON_PHOTOGRAPHER_SHOTS;
  const photographerPesoPerShot = photographerPeso / photographerShots;
  const papicPesoPerShot = rung.peso / rung.bought;

  return {
    photographerShots,
    photographerPeso,
    photographerPesoPerShot,
    papicShots: rung.bought,
    papicPeso: rung.peso,
    papicPesoPerShot,
    timesCheaper:
      papicPesoPerShot > 0 ? Math.floor(photographerPesoPerShot / papicPesoPerShot) : 0,
    exactMatch: rung.bought === photographerShots,
  };
}
