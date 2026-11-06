/**
 * a-category-can-be-merged.test.ts — the source guards for the category merge.
 *
 * The db test beside this one RUNS the function on a replayed schema. This one
 * reads the migration's TEXT and the readers, so a regression fails in seconds
 * without a database. Mirrors a-trade-can-be-merged.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TILE_KEY_HOLDERS, NOT_TILE_HOLDERS, tileHolderIds } from './tile-merge-holders';
import { resolveMergedTile, tileForwardMapFromRows } from './tile-merge-forward';
import { snapshotFromRows, type CategoryRow, type MapRow } from './taxonomy-snapshot';
import { validateVendorCategoryMapping } from './vendor-category-taxonomy';
import { homeTileForRow } from './shortlist-taxonomy';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const MIGRATION = path.join(
  REPO,
  'supabase/migrations/20271316823071_a_category_can_be_merged.sql',
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
const fnBody = sqlCode.slice(
  sqlCode.indexOf('CREATE OR REPLACE FUNCTION public.merge_service_category'),
  sqlCode.indexOf('COMMENT ON FUNCTION public.merge_service_category'),
);

// ── 1 · THE MERGE MOVES EVERY REGISTERED HOLDER ────────────────────────────
test('merge_service_category moves every holder in the tile registry', () => {
  assert.ok(fnBody.length > 1000, 'premise: the function body was found');
  assert.ok(TILE_KEY_HOLDERS.length >= 14, 'registry should not shrink silently');
  const missing: string[] = [];
  for (const h of TILE_KEY_HOLDERS) {
    const writes =
      h.shape === 'array'
        ? new RegExp(
            `UPDATE\\s+${h.table}\\b[\\s\\S]{0,40}?SET\\s+${h.column}\\s*=[\\s\\S]{0,700}?u\\.s\\s*=\\s*p_source\\s+THEN\\s+p_dest`,
            'i',
          )
        : new RegExp(`UPDATE\\s+${h.table}\\s+SET\\s+${h.column}\\s*=\\s*p_dest`, 'i');
    if (!writes.test(fnBody)) missing.push(`${h.table}.${h.column}`);
  }
  assert.deepEqual(missing, [], `holders the merge never moves: ${missing.join(', ')}`);
});

// ── 2 · EVERY HOLDER UNDER A UNIQUE DROPS THE COLLIDING SOURCE ROW FIRST ───
test('every holder under a UNIQUE / PK drops the colliding source row before updating', () => {
  const colliding = TILE_KEY_HOLDERS.filter((h) => h.uniqueWith.length > 0);
  assert.ok(colliding.length >= 6, 'premise: six holders sit under a UNIQUE including the tile');
  for (const h of colliding) {
    const del = new RegExp(
      `DELETE\\s+FROM\\s+${h.table}\\s+a\\s+WHERE\\s+a\\.${h.column}\\s*=\\s*p_source[\\s\\S]{0,400}?EXISTS`,
      'i',
    );
    assert.ok(del.test(fnBody), `${h.table}.${h.column} must drop the colliding source row first`);
    // …and every other column of the UNIQUE is matched in the collision probe.
    const delAt = fnBody.search(new RegExp(`DELETE\\s+FROM\\s+${h.table}\\b`, 'i'));
    const probe = fnBody.slice(delAt, delAt + 600);
    for (const other of h.uniqueWith) {
      assert.match(probe, new RegExp(`b\\.${other}\\b`), `${h.table}: the probe must match on ${other}`);
    }
    const updAt = fnBody.search(new RegExp(`UPDATE\\s+${h.table}\\s+SET\\s+${h.column}`, 'i'));
    assert.ok(delAt >= 0 && updAt > delAt, `${h.table}: delete must precede update`);
  }
});

// ── 3 · THE EVENT HOLDER IS IN THE REGISTRY — the cale-ice rows ────────────
test('event_vendors.category_key is moved, and the legacy enum is not', () => {
  const ids = tileHolderIds();
  assert.ok(ids.includes('event_vendors.category_key'));
  assert.ok(ids.includes('event_category_decisions.tile'));
  assert.ok(ids.includes('event_bench_arrangement.tile'));
  assert.doesNotMatch(fnBody, /UPDATE\s+event_vendors\s+SET\s+category\s*=/i, 'the legacy enum is a different vocabulary');
});

// ── 4 · THE SOURCE SURVIVES AS A TOMBSTONE ─────────────────────────────────
test('the merged category is tombstoned, never deleted', () => {
  assert.match(
    fnBody,
    /UPDATE\s+service_categories\s+SET\s+merged_into_category_id\s*=\s*p_dest,[\s\S]{0,200}?marketplace_hidden\s*=\s*TRUE[\s\S]{0,100}?status\s*=\s*'retired'/i,
  );
  assert.doesNotMatch(fnBody, /DELETE\s+FROM\s+service_categories/i, 'the forward dies with a deleted row');
  assert.match(fnBody, /WHERE\s+merged_into_category_id\s*=\s*p_source/i, 'existing forwards must be re-chained');
});

// ── 5 · VALIDATION ─────────────────────────────────────────────────────────
test('the merge validates both ends before it moves anything', () => {
  const firstUpdate = fnBody.search(/\bUPDATE\s+canonical_service_taxonomy/i);
  for (const msg of [
    'cannot be merged into itself',
    'source category % does not exist',
    'destination category % does not exist',
    'is not live',
    'has already been merged',
  ]) {
    const at = fnBody.indexOf(msg);
    assert.ok(at > 0 && at < firstUpdate, `"${msg}" must be checked before the first write`);
  }
});

// ── 6 · NOT REACHABLE BY A SIGNED-IN STRANGER ──────────────────────────────
test('merge_service_category is granted to service_role only', () => {
  assert.match(sqlCode, /REVOKE ALL ON FUNCTION public\.merge_service_category[\s\S]*?FROM anon/i);
  assert.match(sqlCode, /REVOKE ALL ON FUNCTION public\.merge_service_category[\s\S]*?FROM authenticated/i);
  assert.match(sqlCode, /GRANT EXECUTE ON FUNCTION public\.merge_service_category[\s\S]*?TO service_role/i);
  assert.doesNotMatch(sqlCode, /GRANT EXECUTE ON FUNCTION public\.merge_service_category[^;]*TO (anon|authenticated)\b/i);
  assert.match(fnBody, /SECURITY DEFINER\s+SET search_path = public, pg_temp/i);
});

// ── 7 · A WRITER NAMING AN OLD TILE LANDS ON THE REPLACEMENT ───────────────
test('event_vendors.category_key is forwarded on write', () => {
  assert.match(
    sqlCode,
    /CREATE TRIGGER event_vendors_forward_merged_tile\s+BEFORE INSERT OR UPDATE OF category_key ON public\.event_vendors/i,
  );
});

// ── 8 · THE REGISTRY IS INTERNALLY HONEST ──────────────────────────────────
test('the tile registry has no duplicates and every ruled-out column says why', () => {
  const ids = tileHolderIds();
  assert.equal(new Set(ids).size, ids.length, 'a holder is registered twice');
  for (const n of NOT_TILE_HOLDERS) {
    assert.ok(!ids.includes(`${n.table}.${n.column}`), `${n.table}.${n.column} is in both lists`);
    assert.ok(n.note.length > 30, `${n.table}.${n.column} needs a stated reason`);
  }
});

// ── 9 · THE FORWARD RESOLVES, AND IS NEVER A GATE ──────────────────────────
test('an old category id resolves to its replacement', () => {
  const map = tileForwardMapFromRows([
    { id: 'dj', merged_into_category_id: 'live_band' },
    { id: 'live_band', merged_into_category_id: null },
  ]);
  assert.equal(resolveMergedTile('dj', map), 'live_band');
  assert.equal(resolveMergedTile('live_band', map), 'live_band');
  assert.equal(resolveMergedTile('florist', map), 'florist', 'an unmerged id passes through');
  assert.equal(resolveMergedTile('dj', undefined), 'dj', 'no map = no opinion');
});

// ── 10 · THE SNAPSHOT DROPS A MERGED TILE FROM EVERY PICKER ────────────────
const cat = (id: string, tier: number, parent: string | null, extra: Partial<CategoryRow> = {}): CategoryRow => ({
  id,
  parent_id: parent,
  tier,
  label_en: id,
  label_short: null,
  slug: id.replace(/_/g, '-'),
  sort_order: 0,
  applicable_event_types: null,
  icon_name: null,
  sample_photo_r2_key: null,
  marketplace_hidden: false,
  ...extra,
});
const mapRow = (k: string, tile: string): MapRow => ({
  canonical_service: k,
  folder_id: 'program',
  tile_id: tile,
  phase: 'planning',
  faith: null,
  is_ph: false,
  is_setnayan: false,
  is_rental: false,
  dietary: null,
  is_tradition: false,
  marketplace_hidden: false,
  secondary_tiles: null,
});

test('a merged tile leaves tileOrder + tilesByParent but still resolves', () => {
  const tax = snapshotFromRows(
    [
      cat('program', 1, null),
      cat('live_band', 2, 'program'),
      cat('dj', 2, 'program', { merged_into_category_id: 'live_band', marketplace_hidden: true }),
    ],
    [mapRow('band_live_music', 'live_band')],
  );
  assert.ok(!tax.tileOrder.includes('dj' as never), 'a merged tile must leave the order every picker reads');
  assert.ok(!(tax.tilesByParent.program ?? []).includes('dj' as never));
  assert.equal(tax.tileForward?.dj, 'live_band');
  assert.equal(tax.tileLabel.dj, 'dj', 'its label stays so an old id still renders');
  assert.equal(tax.hiddenCategories.dj, true);
});

test('a couple-side category anchored on a MERGED tile is not reported as drift', () => {
  const rows: CategoryRow[] = [cat('program', 1, null), cat('live_band', 2, 'program')];
  const merged = snapshotFromRows(
    [...rows, cat('dj', 2, 'program', { merged_into_category_id: 'live_band' })],
    [mapRow('band_live_music', 'live_band')],
  );
  const deleted = snapshotFromRows(rows, [mapRow('band_live_music', 'live_band')]);
  const driftOn = (t: typeof merged) =>
    validateVendorCategoryMapping(t).find((d) => d.category === 'band_dj')?.missingTiles ?? [];
  assert.ok(!driftOn(merged).includes('dj' as never), 'dj forwards to live_band — band_dj is still anchored');
  assert.ok(driftOn(deleted).includes('dj' as never), 'control: a DELETED dj tile is still drift');
});

// ── 11 · THE READERS ARE WIRED ─────────────────────────────────────────────
test('the taxonomy read fetches the forward, and /explore?tile= follows it', () => {
  const db = fs.readFileSync(path.join(REPO, 'apps/web/lib/taxonomy-db.ts'), 'utf8');
  assert.match(db, /CATEGORY_COLS =\s*\n?\s*'[^']*merged_into_category_id'/);
  const explore = fs.readFileSync(path.join(REPO, 'apps/web/app/(shell)/explore/page.tsx'), 'utf8');
  assert.match(explore, /import \{ resolveMergedTile \} from '@\/lib\/tile-merge-forward'/);
  assert.match(explore, /resolveMergedTile\(\s*filters\.tile\s*,/);
});

test('the admin delete-with-destination calls the merge, not a hand-written re-point', () => {
  const src = fs.readFileSync(path.join(REPO, 'apps/web/app/admin/categories/actions.ts'), 'utf8');
  const at = src.indexOf('export async function deleteTileWithDestination');
  const body = src.slice(at, src.indexOf('\nexport ', at + 10));
  assert.match(body, /\.rpc\('merge_service_category'/);
  // The merge must run BEFORE the couple-link refusal: suppliers move with a merge.
  assert.ok(
    body.indexOf(".rpc('merge_service_category'") < body.indexOf('deletionWouldBreakCoupleLinks('),
    'a merge must not be refused for couple links — they move with it',
  );
  assert.doesNotMatch(body, /\.update\(\{\s*tile_id:\s*dest/, 'the hand-written re-point is gone');
});

// ── 12 · THE SUPPLIERS PAGE KEEPS A MOVED SUPPLIER ON ITS ROW (cale-ice) ───
// Measured in prod 2026-11-06: cale-ice stores `misc` + category_key for shoes,
// men's/women's attire and coffee. Without the forward, a merged key fails the
// "key refines the enum" check and the supplier falls to Everything else.
test('a supplier whose category moved stays on the destination row, not Everything else', () => {
  const forwards = {
    shoes_footwear: 'jewelleries_accessories',
    mens_attire: 'grooms_attire',
    coffee_espresso: 'mobile_bar',
    womens_attire: 'brides_attire',
    ceremony_venue: 'reception',
  };
  for (const key of ['jewelleries_accessories', 'grooms_attire', 'mobile_bar', 'brides_attire']) {
    assert.equal(homeTileForRow({ category: 'misc', category_key: key }, undefined, forwards), key, `misc/${key}`);
    // Control: without the forward map the same row falls to the enum's own home.
    assert.notEqual(homeTileForRow({ category: 'misc', category_key: key }), key, `control misc/${key}`);
  }
  // An enum whose own home tile merged away lands on the replacement.
  assert.equal(homeTileForRow({ category: 'religious_venue' }, undefined, forwards), 'reception');
  // A key that disagrees with the enum and was NOT merged is still ignored.
  assert.equal(
    homeTileForRow({ category: 'misc', category_key: 'photo_video' }, undefined, forwards),
    homeTileForRow({ category: 'misc' }),
  );
});

test('the Suppliers page passes the forward map to homeTileForRow', () => {
  const src = fs.readFileSync(path.join(REPO, 'apps/web/lib/shortlist-taxonomy.ts'), 'utf8');
  assert.match(src, /homeTileForRow\(v, isDrawnTile, tileForward\)/);
});
