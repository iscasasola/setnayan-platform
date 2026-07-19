/**
 * Leaf-surfacing core — give every service "leaf" category a fair,
 * relevance-gated chance to become an option the couple sees, without spam or
 * pay-to-win. Pure algorithm layer (no DB, no I/O) so it is exhaustively
 * unit-testable; the DB fit-gate + checklist prompt integration wrap it in PR-4.
 *
 * Grounded in the marketplace-discovery research (2026-07-08):
 *  - relevance-retrieve → diversity re-rank (Airbnb "Learning to Rank Diversely")
 *  - cross-category complements, capped 2–3 (Amazon P-Companion)
 *  - only-when-it-fits gating (hide zero-result) — the caller pre-filters
 *  - amortized exposure floor over a rolling window (fairness) — `boostStarved`
 *  - organic fairness independent of paid promotion
 *
 * Spec: 02_Specifications/Adaptive_Checklist_Build_Plan_2026-07-08.md §4
 *
 * Inert until PR-4 wires it — no importers on landing.
 */

/** One candidate leaf category the couple could add. */
export type LeafCandidate = {
  /** Canonical service (leaf) key. */
  key: string;
  /** Parent/branch grouping used for cross-category diversity. */
  category: string;
  /**
   * Organic relevance in [0,1] — fit to the couple's constraints + quality.
   * Computed by the caller; MUST already exclude paid boosts so fairness stays
   * independent of promotion (research principle 6).
   */
  relevance: number;
  /**
   * How many times this leaf has been surfaced to this couple in the rolling
   * window. Drives the exposure floor: never-shown leaves get a small boost so
   * the long tail isn't permanently out-competed (research principle 5).
   */
  timesShown?: number;
};

export type SelectLeavesOptions = {
  /** Max suggestions per surface (research: cap 2–3). Default 3. */
  limit?: number;
  /**
   * MMR trade-off in [0,1]: 1 = pure relevance, 0 = pure diversity.
   * Default 0.7 — relevance-first with a real diversity pull.
   */
  lambda?: number;
  /**
   * Exposure-floor strength in [0,1]: relevance bonus a never-shown leaf gets
   * over one shown `expoScale` times. Default 0.15. Keeps fairness bounded so it
   * never overrides a clearly-better-fitting suggestion.
   */
  exposureWeight?: number;
  /** Shown-count at which the exposure bonus fully decays. Default 3. */
  exposureScale?: number;
};

/** Similarity used by the diversity term: same category = 1, else 0. */
function similarity(a: LeafCandidate, b: LeafCandidate): number {
  return a.category === b.category ? 1 : 0;
}

/** Bounded, decaying exposure bonus for under-shown leaves (amortized fairness). */
function exposureBonus(c: LeafCandidate, weight: number, scale: number): number {
  const shown = Math.max(0, c.timesShown ?? 0);
  const starvation = Math.max(0, 1 - shown / Math.max(1, scale)); // 1 → 0 as shown → scale
  return weight * starvation;
}

/**
 * Select up to `limit` leaf suggestions that are relevant AND diverse.
 *
 * Greedy maximal-marginal-relevance: each slot picks the candidate maximizing
 *   lambda·(relevance + exposureBonus) − (1−lambda)·maxSimilarityToAlreadyPicked
 * so redundant same-category leaves get pushed down and distinct categories rise
 * — the couple who already has a photographer sees "photo booth / mobile bar",
 * not three more photographers. Deterministic (stable tie-break by key), so it
 * is safe to render server-side and to unit-test.
 *
 * The caller is responsible for the "only-when-it-fits" gate: `candidates`
 * should already exclude leaves the couple has planned/excluded and leaves with
 * zero available in-date/in-budget/in-location vendors.
 */
export function selectDiverseLeaves(
  candidates: readonly LeafCandidate[],
  options: SelectLeavesOptions = {},
): LeafCandidate[] {
  const limit = Math.max(0, options.limit ?? 3);
  const lambda = clamp01(options.lambda ?? 0.7);
  const exposureWeight = clamp01(options.exposureWeight ?? 0.15);
  const exposureScale = Math.max(1, options.exposureScale ?? 3);
  if (limit === 0 || candidates.length === 0) return [];

  const remaining = [...candidates];
  const picked: LeafCandidate[] = [];

  while (picked.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i]!;
      const base = clamp01(c.relevance) + exposureBonus(c, exposureWeight, exposureScale);
      const maxSim = picked.reduce((m, p) => Math.max(m, similarity(c, p)), 0);
      const score = lambda * base - (1 - lambda) * maxSim;
      // Stable, deterministic tie-break: higher score wins; ties → lex/key order.
      if (score > bestScore || (score === bestScore && c.key < remaining[bestIdx]!.key)) {
        bestScore = score;
        bestIdx = i;
      }
    }
    picked.push(remaining.splice(bestIdx, 1)[0]!);
  }
  return picked;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
