/**
 * explore-in-plan.ts — the pure engine behind the ADAPTIVE CATEGORY SET on the
 * Explore bench (Explore Replan PR-C · `Explore_Replan_BUILD_SPEC_2026-07-27.md`
 * §3 PR-C · design §5.2 "the bench shows only the couple's in-plan categories;
 * each folder ends with a ＋ Add to your event chip pool; every non-locked
 * category has a Not needed? Remove control").
 *
 * Everything that can be decided without a DOM lives here so it is unit
 * testable and so the bench, the Coverage Strip and the folder pills can never
 * disagree about what "in plan" means.
 *
 * ── THE TWO SETS, AND WHY THEY ARE NOT ONE ─────────────────────────────────
 * `inPlan` is BENCH MEMBERSHIP: a tile in it renders as a category row, a tile
 * outside it renders as an "＋ Add to your event" chip. `coverage` is COVERAGE
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
  /**
   * THE STARTER RING (owner 2026-10-08, "which rows a wedding shows": *"go"*) —
   * what an event with NO plan of its own opens on: the "popular four" its
   * type books first (`popularTilesFor`, `lib/supplier-find.ts`). Given, an
   * unseeded event shows starter ∪ engaged instead of every tile, and the rest
   * wait under "＋ Add to your event". Omitted → the 2026-07-27 rule, unchanged
   * (every tile minus the removed ones).
   *
   * 🔑 It can only ever ADD rows to "engaged". A category that already holds one
   * of the couple's suppliers, or a booking, is in plan whatever this says.
   */
  starterTiles?: ReadonlySet<string>;
};

export type InPlanResolution = {
  /** TRUE when the couple has a real onboarding plan to seed from. */
  seeded: boolean;
  /** Bench rows. */
  inPlan: Set<string>;
  /** "＋ Add to your event" chips, in `allTiles` order. */
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
  } else if (input.starterTiles) {
    for (const t of input.starterTiles) if (known.has(t) && !excluded.has(t)) inPlan.add(t);
    for (const t of engaged) inPlan.add(t);
  } else {
    for (const t of all) if (!excluded.has(t)) inPlan.add(t);
  }
  for (const t of pinned) inPlan.add(t);

  // With a plan or a starter ring the bench IS the short list, so the count is
  // over all of it; the every-tile fallback keeps counting what is engaged.
  const coverage = seeded || input.starterTiles ? new Set(inPlan) : engaged;
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

/* ── "＋ ADD TO YOUR EVENT" — WHERE AN ADDED CATEGORY IS KEPT ────────────────
 *
 * Owner 2026-10-08: a category added under the ring must STAY on the event.
 * Until then nothing stored that choice — `event_category_decisions` knows
 * `excluded | deferred | complete`, and "＋ Add" only deleted an exclusion, so
 * a never-planned category was back in the pool on the next load.
 *
 * It is kept in the event's `style_preferences` blob (no migration), under ITS
 * OWN key rather than appended to the onboarding picks beside it:
 *
 *   `interested_categories` is read by four other features in the ONBOARDING
 *   PICKER's vocabulary (`PICK_TO_GROUP`) — the checklist's budget scope
 *   (`lib/checklist-budget.ts`), the checklist's suggestions, the brief sent to
 *   suppliers, and the onboarding auto-inquiry fan-out
 *   (`lib/pending-inquiries.ts`). A bench TILE id appended there would grow the
 *   checklist for the ~15 tiles that happen to share a picker key and do
 *   nothing for the rest, and could be swept into a still-pending fan-out that
 *   messages suppliers. None of that is what "show this category on my
 *   Suppliers page" means. A key nobody else reads changes exactly one thing.
 */
export const ADDED_CATEGORIES_KEY = 'added_categories';

/** A taxonomy tile id, as stored — never a label, never free text. */
const TILE_ID = /^[a-z0-9][a-z0-9_]{0,63}$/;
/** More tiles than the taxonomy holds is not a list of categories. */
const MAX_ADDED_CATEGORIES = 200;

/** The stored list, read defensively: strings that look like tile ids, once each. */
export function addedCategoriesOf(stylePreferences: unknown): string[] {
  const blob =
    stylePreferences && typeof stylePreferences === 'object' && !Array.isArray(stylePreferences)
      ? (stylePreferences as Record<string, unknown>)[ADDED_CATEGORIES_KEY]
      : null;
  if (!Array.isArray(blob)) return [];
  const out: string[] = [];
  for (const v of blob) {
    if (typeof v === 'string' && TILE_ID.test(v) && !out.includes(v)) out.push(v);
    if (out.length >= MAX_ADDED_CATEGORIES) break;
  }
  return out;
}

/**
 * The list with one tile added — or `null` when the tile is not a tile id (the
 * caller writes nothing). Idempotent: adding a tile twice keeps one.
 */
export function withAddedCategory(current: unknown, tile: string): string[] | null {
  if (!TILE_ID.test(tile)) return null;
  const list = addedCategoriesOf({ [ADDED_CATEGORIES_KEY]: current });
  if (list.includes(tile)) return list;
  return list.length >= MAX_ADDED_CATEGORIES ? list : [...list, tile];
}
