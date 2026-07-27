/**
 * COLUMN-NAME GUARD for the date-selection marketplace-coverage reads.
 *
 * THE BUG THIS PINS
 * -----------------
 * `app/dashboard/[eventId]/date-selection/page.tsx` fetched its vendor pool as
 *
 *     .from('vendor_profiles')
 *       .select('id, services')                                     // ← phantom
 *       .or('is_setnayan_service.is.null,is_setnayan_service.eq.false')  // ← phantom
 *
 * `public.vendor_profiles` has neither column: the PK is `vendor_profile_id`,
 * and `is_setnayan_service` is a COMPUTED column of the `vendor_market_stats`
 * VIEW (migration 20260607020000). PostgREST fails the WHOLE query on one
 * unknown column (42703), supabase-js returns `{ data: null, error }`, and the
 * `?? []` downstream turned that into "no rows" — so "pick a date that works
 * for your vendors" rendered a confident "Marketplace available" while having
 * read nothing, in production, for its entire life. Fixed 2026-07-26.
 *
 * Shaped after `./vendor-packages.columns.test.ts`: the names are READ OUT OF
 * THE MIGRATIONS, never hard-coded a second time, because a second hard-coded
 * list drifts exactly the way the first one did. The parse itself is delegated
 * to `./security/migration-schema`, which that module's own docblock asks
 * consumers to reuse rather than grow a third subtly-different copy of.
 *
 * WHY FILTER COLUMNS ARE COVERED HERE AND NOT LEFT TO THE SCANNER
 * ---------------------------------------------------------------
 * `lib/security/select-column-scan.ts` already sweeps every `.from().select()`
 * in apps/web for phantom columns — it would have caught `id`. Its HONEST
 * LIMITS block, limit 5, states it checks SELECTS ONLY: `.eq()`, `.or()`,
 * `.not()`, `.in()` and `.order()` are invisible to it. So it could never have
 * caught `is_setnayan_service`, and catching half a 42703 still leaves a dead
 * feature. T2/T4 below close that half.
 *
 * ANTI-VACUITY: T5 proves the guard actually rejects the historical bad names
 * rather than passing because the parser returned nothing useful. A guard that
 * matches nothing converts "unexamined" into "verified".
 *
 * Pure module + migration reads: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readSchema } from './security/migration-schema';
import {
  VENDOR_BLOCK_FILTER_COLUMNS,
  VENDOR_BLOCK_SELECT,
  VENDOR_POOL_FILTER_COLUMNS,
  VENDOR_POOL_JOIN_KEY,
  VENDOR_POOL_SELECT,
} from './date-selection-vendor-pool';

const SCHEMA = readSchema();

/** Real column set of `public.<table>` per `supabase/migrations`. */
function columnsOf(table: string): Set<string> {
  const entry = SCHEMA.get(table);
  assert.ok(entry, `no CREATE TABLE for public.${table} found in supabase/migrations`);
  assert.ok(entry.cols.size > 0, `parsed 0 columns for ${table} — the parser is broken`);
  return entry.cols;
}

/** PostgREST select list → column names. These lists carry no casts or aliases. */
function parseSelect(list: string): string[] {
  const cols = list.split(',').map((s) => s.trim()).filter(Boolean);
  assert.ok(cols.length > 0, 'empty select list');
  return cols;
}

test('T1 · the vendor-pool select list only names real vendor_profiles columns', () => {
  const actual = columnsOf('vendor_profiles');
  for (const col of parseSelect(VENDOR_POOL_SELECT)) {
    assert.ok(
      actual.has(col),
      `VENDOR_POOL_SELECT asks vendor_profiles for "${col}", which PostgREST ` +
        'will reject with 42703 — failing the WHOLE query, not just that column.',
    );
  }
});

test('T2 · the vendor-pool FILTER columns are real too (the .or() the scanner cannot see)', () => {
  const actual = columnsOf('vendor_profiles');
  for (const col of VENDOR_POOL_FILTER_COLUMNS) {
    assert.ok(
      actual.has(col),
      `VENDOR_POOL_FILTER_COLUMNS names "${col}" in an .eq()/.or()/.not() ` +
        'predicate on vendor_profiles. A phantom column is exactly as fatal in ' +
        'a filter as in a select list, and the select-list scanner cannot see it.',
    );
  }
});

test('T3 · the calendar-block select list only names real vendor_calendar_blocks columns', () => {
  const actual = columnsOf('vendor_calendar_blocks');
  for (const col of parseSelect(VENDOR_BLOCK_SELECT)) {
    assert.ok(
      actual.has(col),
      `VENDOR_BLOCK_SELECT asks vendor_calendar_blocks for "${col}", which ` +
        'does not exist. An empty block list does not blank the coverage ' +
        'figure — it INFLATES it, marking every vendor free on every date.',
    );
  }
});

test('T4 · the calendar-block FILTER columns are real too', () => {
  const actual = columnsOf('vendor_calendar_blocks');
  for (const col of VENDOR_BLOCK_FILTER_COLUMNS) {
    assert.ok(
      actual.has(col),
      `VENDOR_BLOCK_FILTER_COLUMNS names "${col}" in a .lte()/.gte() predicate ` +
        'on vendor_calendar_blocks, and no migration declares it.',
    );
  }
});

test('T5 · the join key is one real column present on BOTH sides, and is not `id`', () => {
  const profiles = columnsOf('vendor_profiles');
  const blocks = columnsOf('vendor_calendar_blocks');

  // marketplaceCoverage compares vendor_profiles.<key> against a Set built from
  // vendor_calendar_blocks.<key>. The original `id` was wrong twice over: a
  // phantom column, AND the wrong identifier to compare had it existed.
  assert.ok(
    profiles.has(VENDOR_POOL_JOIN_KEY),
    `join key "${VENDOR_POOL_JOIN_KEY}" is not a column of vendor_profiles`,
  );
  assert.ok(
    blocks.has(VENDOR_POOL_JOIN_KEY),
    `join key "${VENDOR_POOL_JOIN_KEY}" is not a column of vendor_calendar_blocks — ` +
      'the coverage comparison would silently never match',
  );
  assert.ok(
    parseSelect(VENDOR_POOL_SELECT).includes(VENDOR_POOL_JOIN_KEY),
    'the pool select list must fetch the join key',
  );
  assert.ok(
    parseSelect(VENDOR_BLOCK_SELECT).includes(VENDOR_POOL_JOIN_KEY),
    'the block select list must fetch the join key',
  );
});

test('T6 · ANTI-VACUITY — the guard really does reject the two historical bad names', () => {
  const profiles = columnsOf('vendor_profiles');

  // If either of these ever becomes true the tests above stop being able to
  // fail on the exact regression they exist for, and this file needs revisiting
  // rather than trusting.
  assert.ok(
    !profiles.has('id'),
    'vendor_profiles now has an `id` column — T1/T5 can no longer catch the ' +
      'original bug. Re-derive this guard against the new shape.',
  );
  assert.ok(
    !profiles.has('is_setnayan_service'),
    'vendor_profiles now has `is_setnayan_service` (it was a vendor_market_stats ' +
      'VIEW column) — T2 can no longer catch the original bug. Revisit.',
  );

  // And prove the assertion the tests use is the one that would fire, rather
  // than trusting that a `has()` on a set we just built means anything.
  assert.throws(
    () => {
      for (const col of ['id', 'is_setnayan_service']) {
        assert.ok(profiles.has(col), `phantom column "${col}"`);
      }
    },
    /phantom column "id"/,
    'the membership check does not actually reject a phantom column',
  );
});
