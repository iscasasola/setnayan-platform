/**
 * "ALSO COVERS" IS THE SUPPLIERS PAGE'S OWN ROWS — every row the page draws can
 * be ticked on a card, and a ticked row draws the card under it.
 *
 * Owner 2026-10-20, on a Dunkin' card filed under Everything else: *"how do i
 * connect the dunkin donuts to a food truck category?"* … *"we already have that
 * food truck category"* … *"we do not have the categories synced properly"*.
 * The card's dropdown listed the ~30 PLAN GROUPS; the Suppliers page draws the
 * TAXONOMY TILES. Every tile no plan group opens on — Food Truck, Food Cart,
 * Dessert, Massage Chair's neighbours — could not be reached from the card.
 *
 * Executed, not grepped: the list the picker is handed (`coverCatalogFromFolders`)
 * is built from the page's own `buildShortlistFolders`, and the bench placement
 * runs through the same builder. Properties, over EVERY tile and every event type:
 *   1. every row the Suppliers page can draw is offered, same name, folder, order;
 *   2. the key a ticked row is stored as reads back as THAT row (no collision);
 *   3. ticking it draws the card under that row, as "also covers", with no money;
 *   4. a stored plan-group key reads the same row it always did, and is kept
 *      byte-for-byte by the sheet;
 *   5. a row-only key never becomes a Budget line, on either side of the flag.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COVER_TILE_PREFIX,
  buildShortlistFolders,
  coverCatalogFromFolders,
  coverKeyForTile,
  coversByRow,
  linkedTilesForRow,
  planGroupsOfCovers,
  tileForCategory,
  tileForCover,
  tileForPlanGroup,
} from '@/lib/shortlist-taxonomy';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { MERGED_TILE_INTO, WEDDING_TILES_BY_PARENT, WEDDING_TILE_LABEL } from '@/lib/taxonomy';
import { EVENT_TYPE_BADGE } from '@/lib/event-vocabulary';
import { attributeCommitted } from '@/lib/checklist-budget-attribution';
import { bucketForVendor } from '@/lib/budget-truth';

const EVENT_TYPES = Object.keys(EVENT_TYPE_BADGE);
const ALL_TILES = Object.values(WEDDING_TILES_BY_PARENT).flat() as string[];
const PLAN_GROUP_IDS = new Set<string>(PLAN_GROUPS.map((g) => g.id as string));
/**
 * ⚖ TAXONOMY V2 (owner-approved 2026-11-06): the owner's Food Truck row FOLDED into "Food carts
 * & stations" (`food_cart`) — so his case now reads: the doughnut cart is ticked onto Food carts
 * & stations. The picker draws the 39 v2 categories plus the four hidden filing rows (43); the
 * old floor of 60 counted rows that no longer exist.
 */
const LIVE_ROWS = 43;

/** The owner's card: a doughnut cart the couple added under Everything else. */
const dunkin = (covers: string[]) => ({
  vendor_id: 'v-dunkin',
  vendor_name: "Dunkin' Donuts",
  category: 'misc',
  status: 'considering',
  manual_vendor_id: 'm-dunkin',
  total_cost_php: 18_000,
  covers_plan_groups: covers,
});

test('the walk is not vacuous', () => {
  assert.ok(EVENT_TYPES.length >= 5, `only ${EVENT_TYPES.length} event types`);
  assert.ok(ALL_TILES.length >= LIVE_ROWS, `only ${ALL_TILES.length} tiles`);
  for (const t of ['food_cart', 'massage_chair']) {
    assert.ok(ALL_TILES.includes(t), `${t} is not a tile any more — re-read the owner's case`);
  }
  // …and the rows he named that v2 folded land on the row they folded into.
  assert.equal(MERGED_TILE_INTO.food_truck, 'food_cart');
  assert.equal(MERGED_TILE_INTO.dessert, 'food_cart');
});

test('1 · every row the Suppliers page can draw is offered — same name, folder and order', () => {
  for (const eventType of EVENT_TYPES) {
    const folders = buildShortlistFolders({ vendorRows: [], eventType, faithSet: new Set(), eventId: 'e' });
    const catalog = coverCatalogFromFolders(folders);
    assert.deepEqual(
      catalog.map((f) => [f.label, f.options.map((o) => [o.tile, o.label])]),
      folders.map((f) => [f.label, f.tiles.map((t) => [t.tile, t.label])]),
      `${eventType}: the dropdown and the Suppliers page list different rows`,
    );
  }
  // The owner's rows, by name, on his event type.
  const wedding = coverCatalogFromFolders(
    buildShortlistFolders({ vendorRows: [], eventType: 'wedding', faithSet: new Set(), eventId: 'e' }),
  ).flatMap((f) => f.options.map((o) => o.label));
  for (const name of ['Food carts & stations', 'Pampering stations']) {
    assert.ok(wedding.includes(name), `"${name}" is a Suppliers-page row and is not offered`);
  }
});

test('2 · the key a ticked row is stored as reads back as THAT row — every tile', () => {
  const prefixed: string[] = [];
  for (const tile of ALL_TILES) {
    const key = coverKeyForTile(tile);
    assert.equal(tileForCover(key), tile, `${tile} is stored as "${key}", which reads back as ${tileForCover(key)}`);
    if (key.startsWith(COVER_TILE_PREFIX)) prefixed.push(tile);
    else assert.ok(PLAN_GROUP_IDS.has(key), `${tile}: a bare key "${key}" that is not a plan group`);
  }
  // A plan-group id that is ALSO a tile id the group does not open on: storing
  // that tile bare would read back as the wrong row. Listed EXACTLY, so a new
  // one is a visible diff rather than a silent mis-filing.
  const collisions = PLAN_GROUPS.filter(
    (g) => ALL_TILES.includes(g.id as string) && tileForPlanGroup(g.id) !== (g.id as string),
  ).map((g) => `${g.id}→${tileForPlanGroup(g.id)}`);
  assert.deepEqual(collisions, ['accommodation→reception']);
  assert.ok(prefixed.includes('accommodation'), 'Accommodation (the row) must not be stored as the plan group');
  assert.ok(prefixed.includes('food_cart'));
});

test('3 · ticking a row draws the card under it, as "also covers", with no second price — every tile', () => {
  const own = tileForCategory('misc' as never);
  let walked = 0;
  for (const tile of ALL_TILES) {
    if (tile === own) continue;
    const folders = buildShortlistFolders({
      vendorRows: [dunkin([coverKeyForTile(tile)])] as never,
      eventType: 'wedding',
      faithSet: new Set(),
      eventId: 'e',
    });
    const row = folders.flatMap((f) => f.tiles).find((t) => t.tile === tile);
    assert.ok(row, `${tile}: ticked on the card, but the Suppliers page drew no such row`);
    const copy = row.vendors.find((v) => v.vendorId === 'v-dunkin');
    assert.ok(copy, `${tile}: ticked on the card, but the card is not under that row`);
    assert.equal(copy.includedWith, WEDDING_TILE_LABEL[own as keyof typeof WEDDING_TILE_LABEL]);
    assert.equal(copy.totalCostPhp, null, `${tile}: the copy carries a price — a second bill`);
    walked += 1;
  }
  assert.ok(walked >= LIVE_ROWS - 1, `walked ${walked}`);
});

test('the owner’s Dunkin’ card: Food carts ticked → under Food carts & stations; home stays Everything else', () => {
  const key = coverKeyForTile('food_cart');
  assert.equal(key, 'tile:food_cart');
  assert.deepEqual(linkedTilesForRow(dunkin(['guest_booth', key]) as never), ['massage_chair', 'food_cart']);
  // A key stored BEFORE the fold (production held `tile:mocktail` ×2, `tile:stations` ×1) draws
  // under the row it folded into — never under a row the page no longer draws.
  assert.deepEqual(linkedTilesForRow(dunkin(['tile:food_truck', 'tile:mocktail']) as never), ['food_cart', 'mobile_bar']);
  const folders = buildShortlistFolders({
    vendorRows: [dunkin(['guest_booth', key])] as never,
    eventType: 'wedding',
    faithSet: new Set(),
    eventId: 'e',
  });
  const holding = folders
    .flatMap((f) => f.tiles)
    .filter((t) => t.vendors.some((v) => v.vendorId === 'v-dunkin'))
    .map((t) => t.tile);
  assert.deepEqual(holding.sort(), ['everything_else', 'food_cart', 'massage_chair']);
});

test('4 · a stored plan-group key reads the row it always did, and the sheet keeps it byte-for-byte', () => {
  for (const g of PLAN_GROUPS) {
    // A group that opens on a folded tile reads the row that tile folded into (taxonomy v2).
    const t = tileForPlanGroup(g.id);
    assert.equal(tileForCover(g.id), t ? (MERGED_TILE_INTO[t] ?? t) : null, `${g.id} moved rows`);
  }
  // Two legacy keys on one row, one key that names no row, and the own row.
  const { byTile, unplaced } = coversByRow(
    ['live_band', 'music_entertainment', 'not_a_group', 'catering', 'misc'],
    'catering',
  );
  assert.deepEqual([...byTile.entries()], [['live_band', ['live_band', 'music_entertainment']]]);
  assert.deepEqual(unplaced, ['not_a_group', 'misc']);
});

test('5 · a row-only key never becomes a Budget line — flag on or off', () => {
  assert.deepEqual(planGroupsOfCovers(['tile:food_truck', 'cake', 'cake', 'tile:accommodation', 7]), ['cake']);
  const committed = { ...dunkin(['tile:food_truck']), status: 'contracted' };
  const home = bucketForVendor({ covers_plan_groups: null, category: 'misc' } as never);
  assert.equal(bucketForVendor(committed as never), home, 'a row-only key moved the money');
  for (const enabled of [true, false]) {
    const { byGroup } = attributeCommitted({ enabled, vendors: [committed as never] });
    for (const bucket of byGroup.keys()) {
      assert.ok(!bucket.startsWith(COVER_TILE_PREFIX), `flag ${enabled}: "${bucket}" became a budget bucket`);
    }
  }
  // The flag-ON side lands the whole price on the card's own home.
  const on = attributeCommitted({ enabled: true, vendors: [committed as never] }).byGroup;
  assert.equal(on.get(home), 1_800_000);
});
