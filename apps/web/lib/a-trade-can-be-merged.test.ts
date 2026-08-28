/**
 * a-trade-can-be-merged.test.ts — the guards for C0.
 *
 * Every assertion here has been MUTATION-CHECKED: the thing it guards was
 * broken and the count printed before → after, and each went red. A guard that
 * has never gone red is decoration, and this stream has already shipped three
 * of those in one day.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_KEY_HOLDERS,
  HISTORICAL_HOLDERS,
  RESTRICT_FK_HOLDERS,
  holderIds,
} from './taxonomy-merge-holders';
import {
  resolveMergedService,
  isMergedAway,
  forwardMapFromRows,
} from './service-merge-forward';
import { findDanglingKeys } from './dangling-trade-keys';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const MIGRATION = path.join(
  REPO,
  'supabase/migrations/20271176753752_a_trade_can_be_merged.sql',
);
const sql = fs.readFileSync(MIGRATION, 'utf8');

/** Strip `--` comments so a guard can never be satisfied by prose ABOUT the rule. */
function stripSqlComments(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      let inSingle = false;
      for (let i = 0; i < line.length; i += 1) {
        const c = line[i];
        if (c === "'") inSingle = !inSingle;
        if (!inSingle && c === '-' && line[i + 1] === '-') return line.slice(0, i);
      }
      return line;
    })
    .join('\n');
}
const sqlCode = stripSqlComments(sql);

// ── 1 · THE MERGE MOVES EVERY REGISTERED HOLDER ────────────────────────────
// The failure this exists to catch: somebody adds a thirteenth column that
// holds a trade key, registers it, and the SQL never learns to move it — so
// those rows are silently stranded. Derived from the registry, never a
// hand-typed list of table names.
test('merge_canonical_service moves every holder in the registry', () => {
  assert.ok(CANONICAL_KEY_HOLDERS.length >= 12, 'registry should not shrink silently');
  const missing: string[] = [];
  for (const h of CANONICAL_KEY_HOLDERS) {
    // Shape-aware on purpose. A scalar holder is swapped to the destination
    // outright; the TEXT[] holder is rebuilt element-by-element and collapsed,
    // so it can never read `services = p_dest`. Asserting one shape for both
    // would either miss the array or force the array to be written wrongly.
    const writes =
      h.shape === 'array'
        ? new RegExp(
            `UPDATE\\s+${h.table}\\b[\\s\\S]{0,600}?\\b${h.column}\\s*=[\\s\\S]{0,600}?array_agg\\(DISTINCT`,
            'i',
          )
        : new RegExp(
            `UPDATE\\s+${h.table}\\b[\\s\\S]{0,400}?\\b${h.column}\\s*=\\s*p_dest`,
            'i',
          );
    if (!writes.test(sqlCode)) missing.push(`${h.table}.${h.column}`);
  }
  assert.deepEqual(missing, [], `holders the merge never moves: ${missing.join(', ')}`);
});

// ── 2 · THE SIX COLLIDING HOLDERS DROP THE SOURCE ROW FIRST ────────────────
// Without this, a merge THROWS the moment one shop holds both trades — which
// is the ordinary case, not an edge case. Measured out of prod: each of these
// six sits under a UNIQUE constraint that includes the trade key.
test('every holder under a UNIQUE constraint deletes the colliding source row first', () => {
  const COLLIDING: [string, string][] = [
    ['vendor_coverages', 'canonical_service'],
    ['vendor_service_attributes', 'canonical_service'],
    ['event_vendor_preferences', 'canonical_service'],
    ['vendor_screen_name_sequences', 'canonical_service'],
    ['vendor_schedule_pool_categories', 'category_key'],
    ['vendor_service_links', 'linked_canonical_service'],
  ];
  for (const [table, column] of COLLIDING) {
    const del = new RegExp(
      `DELETE\\s+FROM\\s+${table}\\s+a\\s+WHERE\\s+a\\.${column}\\s*=\\s*p_source[\\s\\S]{0,300}?EXISTS`,
      'i',
    );
    assert.ok(
      del.test(sqlCode),
      `${table}.${column} must drop the colliding source row before updating`,
    );
    // …and the delete must come BEFORE the update on that same table.
    const delAt = sqlCode.search(new RegExp(`DELETE\\s+FROM\\s+${table}\\b`, 'i'));
    const updAt = sqlCode.search(new RegExp(`UPDATE\\s+${table}\\s+SET\\s+${column}`, 'i'));
    assert.ok(delAt >= 0 && updAt >= 0 && delAt < updAt, `${table}: delete must precede update`);
  }
});

// ── 3 · THE ARRAY HOLDER IS DE-DUPLICATED ──────────────────────────────────
// A shop that listed BOTH trades ends up holding the destination twice, which
// renders as a duplicate chip on its own public page.
test('vendor_profiles.services is de-duplicated, not just swapped', () => {
  const arr = CANONICAL_KEY_HOLDERS.find((h) => h.shape === 'array');
  assert.ok(arr, 'the TEXT[] holder must still be registered');
  assert.equal(arr!.table, 'vendor_profiles');
  assert.match(sqlCode, /array_agg\(DISTINCT/i, 'the array swap must collapse duplicates');
});

// ── 4 · THE SOURCE SURVIVES AS A TOMBSTONE ─────────────────────────────────
// Hard-deleting the merged trade kills the forward with it, and the old link
// goes straight back to an empty result.
test('the merged trade is tombstoned, never deleted', () => {
  assert.match(
    sqlCode,
    /UPDATE\s+canonical_service_taxonomy\s+SET\s+merged_into\s*=\s*p_dest[\s\S]{0,200}?marketplace_hidden\s*=\s*TRUE/i,
    'the source row must be kept, pointed at its replacement, and hidden',
  );
  assert.doesNotMatch(
    sqlCode,
    /DELETE\s+FROM\s+canonical_service_taxonomy/i,
    'a merge must never delete a trade row — the forward dies with it',
  );
});

// ── 5 · THE FUNCTION IS NOT REACHABLE BY A SIGNED-IN STRANGER ──────────────
test('merge_canonical_service is granted to service_role only', () => {
  assert.match(sqlCode, /REVOKE ALL ON FUNCTION public\.merge_canonical_service[\s\S]*?FROM anon/i);
  assert.match(
    sqlCode,
    /REVOKE ALL ON FUNCTION public\.merge_canonical_service[\s\S]*?FROM authenticated/i,
  );
  assert.match(sqlCode, /GRANT EXECUTE ON FUNCTION public\.merge_canonical_service[\s\S]*?TO service_role/i);
  assert.doesNotMatch(
    sqlCode,
    /GRANT EXECUTE ON FUNCTION public\.merge_canonical_service[\s\S]*?TO (anon|authenticated)\b/i,
  );
});

// ── 6 · THE FORWARD RESOLVES — and can never become a gate ─────────────────
test('an old trade key resolves to its replacement', () => {
  const map = forwardMapFromRows([
    { canonical_service: 'sorbetes_cart', merged_into: 'ice_cream_cart' },
    { canonical_service: 'ice_cream_cart', merged_into: null },
  ]);
  assert.equal(resolveMergedService('sorbetes_cart', map), 'ice_cream_cart');
  assert.equal(isMergedAway('sorbetes_cart', map), true);

  // A live trade is returned untouched.
  assert.equal(resolveMergedService('ice_cream_cart', map), 'ice_cream_cart');
  assert.equal(isMergedAway('ice_cream_cart', map), false);

  // 🔒 NEVER A GATE: a key we have no opinion about passes straight through.
  assert.equal(resolveMergedService('misc', map), 'misc');
  assert.equal(resolveMergedService('anything_at_all', {}), 'anything_at_all');
});

test('a forwarding chain resolves, and a cycle terminates instead of spinning', () => {
  const chain = forwardMapFromRows([
    { canonical_service: 'a', merged_into: 'b' },
    { canonical_service: 'b', merged_into: 'c' },
  ]);
  assert.equal(resolveMergedService('a', chain), 'c');

  // Hand-edited SQL could build a cycle; the marketplace must not hang on it.
  const cycle = forwardMapFromRows([
    { canonical_service: 'x', merged_into: 'y' },
    { canonical_service: 'y', merged_into: 'x' },
  ]);
  const got = resolveMergedService('x', cycle);
  assert.ok(got === 'x' || got === 'y', 'a cycle must terminate on a real key');

  // A self-pointer is ignored rather than looped on.
  assert.equal(resolveMergedService('z', forwardMapFromRows([
    { canonical_service: 'z', merged_into: 'z' },
  ])), 'z');
});

// ── 7 · THE READER IS ACTUALLY WIRED ───────────────────────────────────────
// 🔑 THE FAILURE THIS EXISTS FOR: slug forwarding in this repo was written and
// had NO READER FOR MONTHS while two screens promised it. A forwarding column
// nothing reads is indistinguishable from no forwarding, and it looks finished.
test('the marketplace actually reads the forward map', () => {
  const explore = fs.readFileSync(
    path.join(REPO, 'apps/web/app/(shell)/explore/page.tsx'),
    'utf8',
  );
  assert.match(explore, /import \{ resolveMergedService \} from '@\/lib\/service-merge-forward'/);
  assert.match(explore, /getServiceMergeForwards\(\)/);
  // It must resolve the CATEGORY filter specifically — importing it is not reading it.
  assert.match(
    explore,
    /resolveMergedService\(\s*filters\.category\s*,\s*mergeForwards\s*\)/,
    'the ?category= filter must be resolved through the forward map',
  );
});

// ── 8 · THE DANGLING-KEY REPORT ACTUALLY FIRES ─────────────────────────────
test('a shop-held key pointing at no live trade is reported', () => {
  const live = new Set(['ice_cream_cart', 'sorbetes_cart']);
  const found = findDanglingKeys(
    [
      { table: 'vendor_coverages', column: 'canonical_service', key: 'ice_cream_cart', rows: 3 },
      { table: 'vendor_profiles', column: 'services', key: 'trade_that_was_deleted', rows: 7 },
      { table: 'vendor_services', column: 'category', key: 'another_ghost', rows: 1 },
    ],
    live,
  );
  assert.equal(found.length, 2, 'both ghosts must be reported');
  assert.equal(found[0]!.key, 'trade_that_was_deleted');
  assert.equal(found[0]!.rows, 7, 'ordered by how many rows are affected');
  assert.ok(found.every((f) => f.key !== 'ice_cream_cart'), 'a live key is never reported');
});

test('a MERGED trade is not dangling — its row still resolves', () => {
  // The tombstone keeps the row, so it is in liveKeys and must NOT be flagged.
  const live = new Set(['ice_cream_cart', 'sorbetes_cart']);
  const found = findDanglingKeys(
    [{ table: 'vendor_coverages', column: 'canonical_service', key: 'sorbetes_cart', rows: 2 }],
    live,
  );
  assert.deepEqual(found, [], 'a merged-away trade still exists and still resolves');
});

test('the dangling report stays silent when the taxonomy read failed', () => {
  // An empty live set means the read failed. Calling all 288 trades dangling
  // would be a false alarm nobody reads a second time.
  const found = findDanglingKeys(
    [{ table: 'vendor_coverages', column: 'canonical_service', key: 'anything', rows: 9 }],
    new Set<string>(),
  );
  assert.deepEqual(found, [], 'no live keys = unmeasured, not "everything is broken"');
});

// ── 9 · THE REGISTRY IS INTERNALLY HONEST ──────────────────────────────────
test('the registry has no duplicates and the two FK holders are in it', () => {
  const ids = holderIds();
  assert.equal(new Set(ids).size, ids.length, 'a holder is registered twice');
  for (const fk of RESTRICT_FK_HOLDERS) {
    assert.ok(ids.includes(fk), `${fk} holds a RESTRICT FK and must be moved by the merge`);
  }
  // A column may be moved OR deliberately preserved — never both.
  const historical = HISTORICAL_HOLDERS.map((h) => `${h.table}.${h.column}`);
  for (const h of historical) {
    assert.ok(!ids.includes(h), `${h} is in both lists — decide which`);
  }
  // Every deliberate omission must carry its reason.
  for (const h of HISTORICAL_HOLDERS) {
    assert.ok(h.note.length > 40, `${h.table}.${h.column} needs a stated reason, not a bare entry`);
  }
});
