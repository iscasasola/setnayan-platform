/**
 * tile-merge-holders.ts — WHO HOLDS A CATEGORY (TIER-2 TILE) ID.
 *
 * The tile-side twin of `taxonomy-merge-holders.ts` (which lists who holds a
 * TRADE key). Merging category A into category B — `merge_service_category()`,
 * migration 20271316823071 — has to move every row that stored A. The list is
 * declared ONCE, here, and `a-category-can-be-merged.test.ts` fails when:
 *   · a holder registered here is not moved by the SQL function, or
 *   · a column that looks tile-keyed (an FK to service_categories, or a column
 *     named like a tile) appears in NEITHER list below.
 *
 * 🔑 HOW THIS LIST WAS MADE (2026-11-06, read-only against production):
 *   1. every FOREIGN KEY that references `service_categories` — 12 columns;
 *   2. every text / text[] column in `public` whose stored values intersect the
 *      tier-2 ids. That sweep is NOISY on purpose: 25 trade keys and 11
 *      plan-group ids are spelled exactly like a tile (`dj`, `catering`,
 *      `live_band`, `ceremony_venue`…), so a value match proves nothing. Each
 *      hit was classified by its declaration and its writer, and the ones that
 *      are NOT tile ids are recorded in NOT_TILE_HOLDERS with the reason — so
 *      "considered and ruled out" stays distinguishable from "never noticed".
 *
 * ⚠ `event_vendors.category_key` IS a tile id (its column comment says so and it
 * holds a RESTRICT FK) — the cale-ice rows. `event_vendors.category` is the
 * legacy VendorCategory enum and is NOT.
 */

/** How a tile id sits in a column. */
export type TileHolderShape =
  /** One id per row. */
  | 'scalar'
  /** Many ids per row (`TEXT[]`): swap + de-duplicate. */
  | 'array';

export type TileHolder = {
  table: string;
  column: string;
  shape: TileHolderShape;
  /**
   * The other columns of a UNIQUE / PRIMARY KEY that also includes this one.
   * Non-empty ⇒ the merge must drop the colliding SOURCE row before updating,
   * or it throws 23505 the moment one owner holds both tiles.
   */
  uniqueWith: readonly string[];
  /** Why this column holds a tile id — measured, not assumed. */
  note: string;
};

/** Every column that stores a tile id and MUST be moved by a category merge. */
export const TILE_KEY_HOLDERS: readonly TileHolder[] = [
  {
    table: 'canonical_service_taxonomy',
    column: 'tile_id',
    shape: 'scalar',
    uniqueWith: [],
    note: 'Which category a trade lives in (FK, SET NULL). Moved with the denormalised folder_id.',
  },
  {
    table: 'canonical_service_taxonomy',
    column: 'secondary_tiles',
    shape: 'array',
    uniqueWith: [],
    note: 'Other categories a trade also shows under. TEXT[] — swap, dedupe, drop the row’s own tile.',
  },
  {
    table: 'onboarding_refinements',
    column: 'tile_id',
    shape: 'scalar',
    uniqueWith: [],
    note: '“What couples choose” cards anchored to a category (FK, RESTRICT).',
  },
  {
    table: 'event_vendors',
    column: 'category_key',
    shape: 'scalar',
    uniqueWith: [],
    note: 'THE event holder — a couple’s supplier filed under a category (FK, RESTRICT). cale-ice holds 10.',
  },
  {
    table: 'event_category_decisions',
    column: 'tile',
    shape: 'scalar',
    uniqueWith: ['event_id'],
    note: 'A couple’s “not needed / covered” decision at tile grain. Partial UNIQUE (event_id, tile).',
  },
  {
    table: 'event_bench_arrangement',
    column: 'tile',
    shape: 'scalar',
    uniqueWith: ['event_id', 'vendor_id'],
    note: 'The couple’s own order of a shortlist rail. PK (event_id, tile, vendor_id).',
  },
  {
    table: 'event_type_profiles',
    column: 'team_first',
    shape: 'array',
    uniqueWith: [],
    note: 'Ordered first supplier suggestions per event type (service_categories ids). Order is kept.',
  },
  {
    table: 'inspiration_part_categories',
    column: 'category_id',
    shape: 'scalar',
    uniqueWith: ['slot_key'],
    note: 'Which categories an inspiration part feeds (FK, RESTRICT). PK (slot_key, category_id).',
  },
  {
    table: 'inspiration_parts',
    column: 'home_category_id',
    shape: 'scalar',
    uniqueWith: [],
    note: 'An inspiration part’s home category (FK, RESTRICT).',
  },
  {
    table: 'vendor_service_recommendations',
    column: 'tile_id',
    shape: 'scalar',
    uniqueWith: ['service_code'],
    note: 'Setnayan add-ons recommended under a category (FK, CASCADE — a hard delete DESTROYED these).',
  },
  {
    table: 'vendor_recommendation_optins',
    column: 'tile_id',
    shape: 'scalar',
    uniqueWith: ['vendor_profile_id', 'service_code'],
    note: 'A supplier’s opt-in to recommend an add-on in a category (FK, CASCADE).',
  },
  {
    table: 'vendor_recommendation_feedback',
    column: 'tile_id',
    shape: 'scalar',
    uniqueWith: ['vendor_profile_id', 'feedback_type', 'service_code'],
    note: 'A supplier’s feedback on a recommendation in a category (FK, CASCADE).',
  },
  {
    table: 'taxonomy_category_requests',
    column: 'tile_id',
    shape: 'scalar',
    uniqueWith: [],
    note: 'A supplier’s “add my category” request, resolved to a tile (FK, SET NULL).',
  },
  {
    table: 'taxonomy_category_request_drafts',
    column: 'suggested_tile_id',
    shape: 'scalar',
    uniqueWith: [],
    note: 'The suggested tile on a request draft (FK, SET NULL).',
  },
] as const;

/**
 * Columns that reference `service_categories` (or are spelled like a tile) but
 * are DELIBERATELY NOT MOVED by a category merge, each with the reason.
 */
export const NOT_TILE_HOLDERS: readonly { table: string; column: string; note: string }[] = [
  {
    table: 'service_categories',
    column: 'merged_into_category_id',
    note: 'The forwarding pointer itself. Not moved — RE-CHAINED: anything pointing at the source is pointed at the destination.',
  },
  {
    table: 'service_categories',
    column: 'parent_id',
    note: 'Tier-3 children of a tile. None exist; the merge REFUSES a source that has any, as the shipped delete did.',
  },
  {
    table: 'canonical_service_taxonomy',
    column: 'folder_id',
    note: 'A trade’s tier-1 FOLDER, not a tile. Re-derived from the destination tile’s parent in the same UPDATE as tile_id.',
  },
  {
    table: 'event_vendors',
    column: 'category',
    note: 'Legacy VendorCategory ENUM (band_dj, planner_coordinator…), a different vocabulary. Left alone by design.',
  },
  {
    table: 'event_vendors',
    column: 'covers_plan_groups',
    note: 'PLAN-GROUP ids (lib/wedding-plan-groups.ts). 11 are spelled like a tile; they are not tiles.',
  },
  {
    table: 'event_vendors',
    column: 'hard_single_group',
    note: 'PLAN-GROUP id (coordinator, host_mc) — plan-group vocabulary, not a tile.',
  },
  {
    table: 'event_category_decisions',
    column: 'plan_group_id',
    note: 'PLAN-GROUP grain of the same table; the tile grain is `tile`, which IS moved.',
  },
  {
    table: 'events',
    column: 'tracked_categories',
    note: 'PlanGroupIds the couple tracks (column comment). Plan-group vocabulary, not tiles.',
  },
  {
    table: 'event_floor_plan',
    column: 'ghost_booths_dismissed',
    note: 'VendorCategory keys (seating lab reads them as VendorCategory[]). Not tiles.',
  },
  {
    table: 'thread_service_interests',
    column: 'category_key',
    note: 'A TRADE / couple-category key — moved by merge_canonical_service (lib/taxonomy-merge-holders.ts), not here.',
  },
  {
    table: 'vendor_schedule_pool_categories',
    column: 'category_key',
    note: 'A TRADE key — moved by merge_canonical_service, not here.',
  },
] as const;

/** `table.column` for every holder a category merge moves. */
export function tileHolderIds(): string[] {
  return TILE_KEY_HOLDERS.map((h) => `${h.table}.${h.column}`);
}
