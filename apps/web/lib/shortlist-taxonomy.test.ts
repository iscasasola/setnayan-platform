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

// ── Fit-badges (2026-07-09) ────────────────────────────────────────────────
const findVendor = (folders: ReturnType<typeof buildShortlistFolders>, id: string) =>
  folders.flatMap((f) => f.tiles).flatMap((t) => t.vendors).find((v) => v.vendorId === id);

test('budget-fit: quote within remaining → fits; over → over; no budget → null', () => {
  const rows = [
    { vendor_id: 'cheap', vendor_name: 'Budget Blooms', category: 'florist', status: 'considering', total_cost_php: 30000 },
    { vendor_id: 'dear', vendor_name: 'Grand Florals', category: 'florist', status: 'considering', total_cost_php: 120000 },
  ] as never;
  const withBudget = buildShortlistFolders({ ...BASE, vendorRows: rows, totalBudgetPhp: 100000 });
  assert.equal(findVendor(withBudget, 'cheap')!.budgetFit, 'fits', '30k ≤ 100k remaining');
  assert.equal(findVendor(withBudget, 'dear')!.budgetFit, 'over', '120k > 100k remaining');
  assert.equal(findVendor(withBudget, 'cheap')!.budgetEstimated, false, 'a real quote is not an estimate');

  const noBudget = buildShortlistFolders({ ...BASE, vendorRows: rows });
  assert.equal(findVendor(noBudget, 'cheap')!.budgetFit, null, 'no total budget → no budget badge');
});

test('budget-fit: remaining nets out locked commitments; locked picks carry no badge', () => {
  const rows = [
    { vendor_id: 'locked', vendor_name: 'Booked Venue', category: 'venue', status: 'deposit_paid', total_cost_php: 70000 },
    { vendor_id: 'shopping', vendor_name: 'Caterer Co', category: 'catering', status: 'considering', total_cost_php: 40000 },
  ] as never;
  // 100k − 70k locked = 30k remaining; the 40k caterer no longer fits.
  const folders = buildShortlistFolders({ ...BASE, vendorRows: rows, totalBudgetPhp: 100000 });
  assert.equal(findVendor(folders, 'shopping')!.budgetFit, 'over', '40k > 30k remaining after the locked venue');
  assert.equal(findVendor(folders, 'locked')!.budgetFit, null, 'a locked pick never shows a budget badge');
});

test('budget-fit: falls back to the service starts-at price, flagged estimated', () => {
  const rows = [
    { vendor_id: 'noquote', vendor_name: 'Quiet Quartet', category: 'photographer', status: 'considering', total_cost_php: null },
  ] as never;
  const enrichmentByVendorId = new Map([['noquote', { starting_price_php: 15000 }]]);
  const folders = buildShortlistFolders({ ...BASE, vendorRows: rows, totalBudgetPhp: 100000, enrichmentByVendorId });
  const v = findVendor(folders, 'noquote')!;
  assert.equal(v.budgetFit, 'fits', 'starts-at 15k ≤ 100k → fits');
  assert.equal(v.budgetEstimated, true, 'basis was the starts-at anchor, not a quote');
});

test('reach: mirrors enrichment within_radius; unknown → null (never a false out-of-range)', () => {
  const rows = [
    { vendor_id: 'near', vendor_name: 'Local Lens', category: 'photographer', status: 'considering' },
    { vendor_id: 'far', vendor_name: 'Distant Studio', category: 'photographer', status: 'considering' },
    { vendor_id: 'unknown', vendor_name: 'Manual Add', category: 'photographer', status: 'considering' },
  ] as never;
  const enrichmentByVendorId = new Map([
    ['near', { within_radius: true, service_radius_km: 50 }],
    ['far', { within_radius: false, service_radius_km: 20 }],
    ['unknown', {}],
  ]);
  const folders = buildShortlistFolders({ ...BASE, vendorRows: rows, enrichmentByVendorId });
  assert.equal(findVendor(folders, 'near')!.reachesVenue, true);
  assert.equal(findVendor(folders, 'far')!.reachesVenue, false);
  assert.equal(findVendor(folders, 'far')!.serviceRadiusKm, 20);
  assert.equal(findVendor(folders, 'unknown')!.reachesVenue, null, 'no signal → hidden, not false');
});
