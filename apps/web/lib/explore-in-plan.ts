/**
 * explore-in-plan.ts — the pure engine behind the ADAPTIVE CATEGORY SET on the
 * Explore bench (Explore Replan PR-C · `Explore_Replan_BUILD_SPEC_2026-07-27.md`
 * §3 PR-C · design §5.2 "the bench shows only the couple's in-plan categories;
 * each folder ends with a ＋ Add to your plan chip pool; every non-locked
 * category has a Not needed? Remove control").
 *
 * Everything that can be decided without a DOM lives here so it is unit
 * testable and so the bench, the Coverage Strip and the folder pills can never
 * disagree about what "in plan" means.
 *
 * ── THE TWO SETS, AND WHY THEY ARE NOT ONE ─────────────────────────────────
 * `inPlan` is BENCH MEMBERSHIP: a tile in it renders as a category row, a tile
 * outside it renders as an "＋ Add to your plan" chip. `coverage` is COVERAGE
 * STRIP membership — the tiles the strip draws and the denominator of
 * "Covered X of Y".
 *
 * They coincide whenever the couple actually HAS an onboarding plan
 * (`ShortlistTile.planned`, seeded from `style_preferences.interested_-
 * categories`). They must NOT coincide when they do not — and today weddings
 * never do: `plannedTiles` is deliberately `undefined` for `event_type =
 * 'wedding'` on the vendors page, because weddings carry their own plan-group
 * machinery. Seeding "in plan" from an empty plan would collapse a wedding
 * bench from ~53 rows to whatever handful they have already shortlisted and
 * bury the rest in a chip pool — a silent amputation of the shipped surface,
 * not an adaptive one. So:
 *
 *   · seeded (an onboarding plan exists) → inPlan = plan ∪ engaged, minus
 *     exclusions; coverage = inPlan. Exactly the design's §5.2 behaviour.
 *   · unseeded (no plan) → inPlan = EVERY tile minus the tiles the couple has
 *     explicitly removed. The bench keeps its full taxonomy, "Remove" still
 *     prunes it one tile at a time, and removed tiles still return via the
 *     chip pool. `coverage` falls back to the ENGAGED tiles (picks + locks +
 *     pins) so the strip stays a short, meaningful row instead of 53 icons.
 *
 * ── LOCKS ARE LOAD-BEARING ─────────────────────────────────────────────────
 * A tile holding a locked vendor is PINNED in plan no matter what any exclusion
 * row says. The server action refuses the removal in the first place (spec:
 * "a category with a locked vendor is NOT removable — unlock first, never
 * silently cancel a booking"), and this is the second, data-level guard: a
 * stale exclusion written before a lock can never hide a booking.
 */

/** What the resolver needs to know. All sets are tile ids. */
export type InPlanInput = {
  /** Every tile the bench could show, in display order. */
  allTiles: readonly string[];
  /** Tiles the couple chose at onboarding (`ShortlistTile.planned`). */
  plannedTiles: ReadonlySet<string>;
  /** Tiles that already hold at least one considered vendor. */
  tilesWithVendors: ReadonlySet<string>;
  /** Tiles that hold at least one LOCKED vendor. Never removable. */
  tilesWithLocks: ReadonlySet<string>;
  /** Tile-level `event_category_decisions.decision = 'excluded'` rows. */
  excludedTiles: ReadonlySet<string>;
  /**
   * Tiles that must stay on the bench regardless — today the deep-link target
   * (`?open=catering`), so a link into a removed category still lands on a row
   * instead of silently doing nothing.
   */
  pinnedTiles?: ReadonlySet<string>;
};

export type InPlanResolution = {
  /** TRUE when the couple has a real onboarding plan to seed from. */
  seeded: boolean;
  /** Bench rows. */
  inPlan: Set<string>;
  /** "＋ Add to your plan" chips, in `allTiles` order. */
  pool: string[];
  /** Coverage Strip membership + the "Covered X of Y" denominator. */
  coverage: Set<string>;
};

export function resolveInPlanTiles(input: InPlanInput): InPlanResolution {
  const all = input.allTiles;
  const known = new Set(all);
  const pinned = new Set<string>();
  for (const t of input.tilesWithLocks) if (known.has(t)) pinned.add(t);
  for (const t of input.pinnedTiles ?? []) if (known.has(t)) pinned.add(t);

  // An exclusion never outranks a lock (or a deep link).
  const excluded = new Set<string>();
  for (const t of input.excludedTiles) {
    if (known.has(t) && !pinned.has(t)) excluded.add(t);
  }

  // "Engaged" = the couple has actually done something here.
  const engaged = new Set<string>();
  for (const t of input.tilesWithVendors) if (known.has(t) && !excluded.has(t)) engaged.add(t);
  for (const t of pinned) engaged.add(t);

  const seeded = [...input.plannedTiles].some((t) => known.has(t));

  const inPlan = new Set<string>();
  if (seeded) {
    for (const t of input.plannedTiles) if (known.has(t) && !excluded.has(t)) inPlan.add(t);
    for (const t of engaged) inPlan.add(t);
  } else {
    for (const t of all) if (!excluded.has(t)) inPlan.add(t);
  }
  for (const t of pinned) inPlan.add(t);

  const coverage = seeded ? new Set(inPlan) : engaged;
  const pool = all.filter((t) => !inPlan.has(t));

  return { seeded, inPlan, pool, coverage };
}

/**
 * The removal guard, as a pure predicate so the client can hide the control and
 * the server action can refuse the write from the SAME rule. The server is the
 * enforcer — this being pure is what lets both call it.
 */
export function canRemoveTileFromPlan(t: { lockedCount: number }): boolean {
  return t.lockedCount === 0;
}
