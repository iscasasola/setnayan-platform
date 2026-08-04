/**
 * COLUMN SURFACE of the date-selection marketplace-coverage reads.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * The two queries behind "pick a date that works for your vendors" spent their
 * whole production life erroring. `page.tsx` asked `vendor_profiles` for `id`
 * (the PK is `vendor_profile_id`) and filtered on `is_setnayan_service`, which
 * belongs to the `vendor_market_stats` VIEW, not the table. PostgREST fails the
 * WHOLE query on one unknown column (42703), a `?? []` turned that into "no
 * rows", and the page rendered a confident "0 of 0 categories available".
 * Fixed 2026-07-26; this module is the guard that keeps it fixed.
 *
 * The names live here, once, instead of inside free-text query strings, so that
 * `date-selection-vendor-pool.columns.test.ts` can check every one of them
 * against `supabase/migrations` — the same shape as
 * {@link PACKAGE_ITEM_OPTION_COLUMNS} in `./vendor-packages`, and for the same
 * reason: this repo has no generated Supabase types, so a column name in a
 * `.select()` / `.eq()` / `.or()` string is unchecked free text.
 *
 * ⚠ FILTER COLUMNS ARE LISTED TOO, AND THAT IS THE POINT. The repo's phantom-
 * column scanner (`lib/security/select-column-scan.ts`) reads `.select()` lists
 * ONLY — its own HONEST LIMITS block, limit 5, says so. It would have caught
 * `id`. It could never have caught `is_setnayan_service`, because that one was
 * in an `.or()` predicate. Half a bug caught is still a dead feature, so the
 * lists below cover both halves.
 */

/** `.select()` list for the marketplace vendor pool on `public.vendor_profiles`. */
export const VENDOR_POOL_SELECT = 'vendor_profile_id, services';

/**
 * Columns the pool query names in FILTER predicates (`.eq` / `.or` / `.not`).
 *
 * Invisible to the select-list scanner, and a phantom here is exactly as fatal:
 * PostgREST 42703s the whole query either way.
 */
export const VENDOR_POOL_FILTER_COLUMNS = ['public_visibility', 'is_demo', 'services'] as const;

/** `.select()` list for the calendar-block read on `public.vendor_calendar_blocks`. */
export const VENDOR_BLOCK_SELECT = 'vendor_profile_id, blocked_at, blocked_until';

/** Columns the calendar-block query names in FILTER predicates (`.lte` / `.gte`). */
export const VENDOR_BLOCK_FILTER_COLUMNS = ['blocked_at', 'blocked_until'] as const;

/**
 * The join key. Both reads must carry it and it must be the SAME name on both
 * sides: `marketplaceCoverage` compares `vendor_profiles.<key>` against a Set
 * built from `vendor_calendar_blocks.<key>`. The original `id` was wrong twice
 * over — a phantom column AND, had it existed, the wrong identifier to compare.
 */
export const VENDOR_POOL_JOIN_KEY = 'vendor_profile_id';
