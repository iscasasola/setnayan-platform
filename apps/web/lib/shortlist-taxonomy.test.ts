/**
 * Unit suite for buildShortlistFolders' "Your plan" marking (2026-06-28) +
 * tile-level marketplace_hidden handling (2026-07-04).
 * The couple's onboarding picks (style_preferences.interested_categories, which
 * are taxonomy tile ids) flag the matching Shortlist tiles `planned` so the
 * Vendors surface can surface + act on them. Uses the wedding fallback taxonomy
 * (no taxonomy arg) so the test needs no DB.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShortlistFolders } from './shortlist-taxonomy';
import { fallbackSnapshot } from './taxonomy-snapshot';

const BASE = {
  vendorRows: [] as [],
  eventType: 'wedding' as string,
  faithSet: new Set<string>(),
  eventId: 'e1',
};

test('no plannedTiles → nothing is planned', () => {
  const folders = buildShortlistFolders(BASE);
  assert.ok(folders.length > 0, 'fallback taxonomy yields folders');
  assert.ok(
    folders.every((f) => f.plannedCount === 0 && f.tiles.every((t) => !t.planned)),
    'all tiles default planned=false',
  );
});

test('plannedTiles flags matching tiles + sets plannedCount', () => {
  const folders0 = buildShortlistFolders(BASE);
  const firstTile = folders0[0]!.tiles[0]!.tile;
  const marked = buildShortlistFolders({ ...BASE, plannedTiles: new Set([firstTile]) });

  const folder0 = marked[0]!;
  assert.equal(folder0.plannedCount, 1, 'one planned tile in the first folder');
  assert.equal(
    folder0.tiles.find((t) => t.tile === firstTile)!.planned,
    true,
    'the matching tile is planned',
  );
  const totalPlanned = marked.reduce((n, f) => n + f.plannedCount, 0);
  assert.equal(totalPlanned, 1, 'exactly one tile planned across all folders');
});

test('an unknown planned id flags nothing (harmless)', () => {
  const marked = buildShortlistFolders({
    ...BASE,
    plannedTiles: new Set(['not_a_real_tile_xyz']),
  });
  assert.equal(
    marked.reduce((n, f) => n + f.plannedCount, 0),
    0,
    'unmatched ids never flag a tile',
  );
});

test('tile-level marketplace_hidden drops an EMPTY tile from the Shortlist', () => {
  const taxonomy = { ...fallbackSnapshot(), hiddenCategories: { brides_attire: true as const } };
  const folders = buildShortlistFolders({ ...BASE, taxonomy });
  const allTiles = folders.flatMap((f) => f.tiles.map((t) => t.tile));
  assert.ok(
    !allTiles.includes('brides_attire' as never),
    'a hidden tile with no considered vendors never surfaces',
  );
});

test('tile-level marketplace_hidden still surfaces the tile when the couple already has a vendor there', () => {
  const taxonomy = { ...fallbackSnapshot(), hiddenCategories: { brides_attire: true as const } };
  const folders = buildShortlistFolders({
    ...BASE,
    taxonomy,
    vendorRows: [
      {
        vendor_id: 'v1',
        vendor_name: 'Couture Atelier',
        category: 'gown_designer',
        status: 'considering',
      },
    ] as never,
  });
  const tile = folders.flatMap((f) => f.tiles).find((t) => t.tile === 'brides_attire');
  assert.ok(tile, 'a hidden tile with an existing considered vendor still surfaces');
  assert.equal(tile!.vendors.length, 1, 'the couple\'s own vendor stays visible in the Shortlist');
});
