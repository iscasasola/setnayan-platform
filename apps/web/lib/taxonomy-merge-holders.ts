/**
 * taxonomy-merge-holders.ts — WHO HOLDS A CANONICAL TRADE KEY.
 *
 * A "trade" (canonical service) is a LEAF of the taxonomy — `pabati`,
 * `sorbetes_cart`, `day_of_coordinator`. Merging trade A into trade B has to
 * move EVERY row that stored A, and the database will not help:
 *
 *   🚨 The three shop-side holders — `vendor_coverages.canonical_service`,
 *   `vendor_services.category` and `vendor_profiles.services[]` — carry NO
 *   foreign key to the taxonomy. Nothing refuses a dangling key and nothing
 *   reports one. Only two columns anywhere hold a RESTRICT FK to
 *   `canonical_service_schemas` (see RESTRICT_FK_HOLDERS below).
 *
 * 🔑 WHY THIS FILE EXISTS AS DATA RATHER THAN AS WRITES INSIDE THE ACTION.
 * The brief for this build named THREE holders from memory. Enumerating the
 * columns out of production found TEN. A merge written from a remembered list
 * silently strands whatever the list forgot, and the symptom is an absence — a
 * shop holding a key that resolves to nothing, on a screen that looks fine.
 * So the list is declared ONCE, here, the merge iterates it, and
 * `taxonomy-merge-holders.test.ts` fails when a column exists that appears in
 * neither list. The guard, not anybody's memory, is what keeps this complete.
 *
 * @see apps/web/app/admin/taxonomy/actions.ts — `mergeCanonicalService`
 */

/** How a trade key sits in a column. */
export type HolderShape =
  /** One key per row: a plain `TEXT` column. */
  | 'scalar'
  /** Many keys per row: a `TEXT[]`. The update is array surgery, and a row can
   *  end up holding the destination TWICE — it must be de-duplicated. */
  | 'array';

export type CanonicalKeyHolder = {
  table: string;
  column: string;
  shape: HolderShape;
  /** Why this column holds a trade key — measured, not assumed. */
  note: string;
};

/**
 * Every column that stores a canonical trade key and MUST be moved by a merge.
 * Enumerated out of production by the column (`information_schema.columns` +
 * each column's declaration and its writer), 2026-08-28.
 */
export const CANONICAL_KEY_HOLDERS: readonly CanonicalKeyHolder[] = [
  {
    table: 'vendor_coverages',
    column: 'canonical_service',
    shape: 'scalar',
    note: 'A shop’s declared coverage — the trade it says it works in.',
  },
  {
    table: 'vendor_profiles',
    column: 'services',
    shape: 'array',
    note: 'Denormalised mirror of coverage. THE column /explore filters on (.contains). A TEXT[]: dedupe after the swap.',
  },
  {
    table: 'vendor_services',
    column: 'category',
    shape: 'scalar',
    note: 'A service card’s kind. Holds a canonical leaf since PR #4942.',
  },
  {
    table: 'vendor_packages',
    column: 'primary_canonical_service',
    shape: 'scalar',
    note: 'The trade a package is primarily sold under.',
  },
  {
    table: 'vendor_package_items',
    column: 'canonical_service',
    shape: 'scalar',
    note: 'Each line item inside a package names its own trade.',
  },
  {
    table: 'vendor_service_links',
    column: 'linked_canonical_service',
    shape: 'scalar',
    note: 'A card’s "also offered" cross-links.',
  },
  {
    table: 'vendor_service_attributes',
    column: 'canonical_service',
    shape: 'scalar',
    note: 'RESTRICT FK to canonical_service_schemas — blocks a leaf delete, so it MUST move first.',
  },
  {
    table: 'vendor_screen_name_sequences',
    column: 'canonical_service',
    shape: 'scalar',
    note: 'Part of the PRIMARY KEY (city, canonical_service) — a blind UPDATE can collide. See the action’s PK note.',
  },
  {
    table: 'event_vendor_preferences',
    column: 'canonical_service',
    shape: 'scalar',
    note: 'RESTRICT FK to canonical_service_schemas — couple-side, blocks a leaf delete, so it MUST move first.',
  },
  {
    table: 'budget_allocation_decisions',
    column: 'canonical_service',
    shape: 'scalar',
    note: 'A couple’s per-trade budget decision.',
  },
  {
    table: 'thread_service_interests',
    column: 'category_key',
    shape: 'scalar',
    note: 'Interest chips on a couple→vendor thread; rendered via displayServiceLabel (canonical → label).',
  },
  {
    table: 'vendor_schedule_pool_categories',
    column: 'category_key',
    shape: 'scalar',
    note: 'Which trades share a calendar. Fed from the shop’s own catalog keys.',
  },
] as const;

/**
 * Columns that hold a trade key and are DELIBERATELY NOT MOVED, each with the
 * reason. Recorded as data so the completeness guard can tell "considered and
 * ruled out" from "never noticed" — the distinction a bare omission destroys.
 */
export const HISTORICAL_HOLDERS: readonly CanonicalKeyHolder[] = [
  {
    table: 'vendor_service_price_history',
    column: 'category',
    shape: 'scalar',
    note: 'APPEND-ONLY LOG. A trigger copies NEW.category off vendor_services at the moment a price changed. It records what was true THEN; rewriting it would falsify history, so a merge leaves it alone and the dangling-key report skips it.',
  },
] as const;

/**
 * The only two columns in the database with a RESTRICT foreign key to
 * `canonical_service_schemas.canonical_service` (read out of prod by the
 * object, 2026-08-28). Both are in CANONICAL_KEY_HOLDERS above; they are named
 * again here because they are the two that will REFUSE rather than silently
 * strand — they must be moved before any attempt to remove a leaf row.
 *
 * ⚠ `event_vendors.category_key` also holds a RESTRICT FK, and it is NOT one of
 * these: its own column comment says it is a TILE id (`service_categories.id`,
 * tier 2), not a trade key. It does not constrain a trade merge.
 */
export const RESTRICT_FK_HOLDERS: readonly string[] = [
  'vendor_service_attributes.canonical_service',
  'event_vendor_preferences.canonical_service',
] as const;

/** `table.column` for every holder a merge moves. */
export function holderIds(): string[] {
  return CANONICAL_KEY_HOLDERS.map((h) => `${h.table}.${h.column}`);
}
