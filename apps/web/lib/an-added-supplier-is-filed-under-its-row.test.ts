/**
 * A SUPPLIER ADDED FROM A ROW IS FILED UNDER THAT ROW — drawn once there as its
 * own card, its money in that row's bucket, never merged with another row's.
 *
 * Owner 2026-10-20, verbatim: *"Yes fix that. We want them to be designated to
 * their category"*. The bug (found building #6712): "＋ Add your own" from the
 * Food Truck row filed the supplier under Everything else.
 *
 * 🔑 WHY. `event_vendors.category` is an enum and most rows have no label of
 * their own — Food Truck stores `misc`, which draws as Everything else. #6712
 * gave a MOVE the fix (`category_key`, read back by `homeTileForRow`); the ADD
 * still wrote the enum alone, and the walk's dropdown collapsed rows that share
 * one ("the first one names it"), so Food Truck and Mocktail were one entry.
 *
 * This file EXECUTES the loop over every row the page can draw:
 *   what the bench posts (`addOwnCategoriesFromRows` · the row's `category`)
 *   → what the server keeps (`categoryKeyForAdd`, the add actions' one check)
 *   → the Suppliers page's own builder (`buildShortlistFolders`)
 *   → the Budget's own bucketer (`bucketForVendor`).
 *
 * Properties:
 *   1. for EVERY row: the added supplier is drawn exactly once, as its own card,
 *      under that row — with its price — and nowhere else;
 *   2. its money sits in exactly the bucket #6712's move puts a supplier moved
 *      to that row (one rule for both), counted once;
 *   3. two rows that share an enum value never collapse: the dropdown has one
 *      entry per row, and one supplier added from each is drawn under its own;
 *   4. the top-level Everything else row, and an add from no row, write what
 *      they always wrote (no key); a contradicting or unknown row writes none;
 *   5. the claim link names the same category #6712's move keeps it at;
 *   6. every add path posts the row, and both add actions write the checked key.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildShortlistFolders,
  categoryForTile,
  categoryKeyForAdd,
  homeTileForRow,
  storageForRow,
} from '@/lib/shortlist-taxonomy';
import { planSupplierMove, type SupplierMovePlan } from '@/lib/move-supplier-category';
import { addOwnCategoriesFromRows } from '@/lib/add-your-own';
import { WEDDING_TILES_BY_PARENT } from '@/lib/taxonomy';
import { bucketForVendor } from '@/lib/budget-truth';
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';

const ALL_TILES = Object.values(WEDDING_TILES_BY_PARENT).flat() as string[];
const DRAWN = new Set(ALL_TILES);
const isTile = (t: string) => DRAWN.has(t);

/** The Suppliers page's own rows, as the bench holds them (`benchRows`). */
function benchRows() {
  const folders = buildShortlistFolders({ vendorRows: [], eventType: 'wedding', faithSet: new Set(), eventId: 'e' });
  return folders.flatMap((f) => f.tiles.map((t) => ({ t, group: f.label })));
}

/** What one add from `tile` stores — the bench's posted pair, through the server's check. */
function addedFrom(tile: string, id = `v-${tile}`): EventVendorRowInput {
  const row = benchRows().find((r) => r.t.tile === tile);
  assert.ok(row, `${tile} is not a row on the page`);
  const category = row!.t.category;
  return {
    vendor_id: id,
    vendor_name: `Own ${tile}`,
    category: category as never,
    status: 'considering',
    manual_vendor_id: `m-${id}`,
    total_cost_php: 12_000,
    category_key: categoryKeyForAdd(category, tile, isTile),
    covers_plan_groups: [],
  };
}

/** Every card the page draws for these rows: vendor → [tile, own|linked, price]. */
function cards(rows: EventVendorRowInput[]) {
  const folders = buildShortlistFolders({ vendorRows: rows, eventType: 'wedding', faithSet: new Set(), eventId: 'e' });
  const out = new Map<string, Array<[string, 'own' | 'linked', number | null]>>();
  for (const f of folders) {
    for (const t of f.tiles) {
      for (const v of t.vendors) {
        const list = out.get(v.vendorId) ?? [];
        list.push([t.tile, v.includedWith == null ? 'own' : 'linked', v.totalCostPhp]);
        out.set(v.vendorId, list);
      }
    }
  }
  return out;
}

test('the walk is not vacuous', () => {
  const rows = benchRows();
  assert.ok(rows.length >= 60, `only ${rows.length} rows on the page`);
  assert.ok(ALL_TILES.includes('food_truck') && ALL_TILES.includes('mocktail') && ALL_TILES.includes('everything_else'));
  // The reason this file exists: rows whose enum label alone draws them elsewhere.
  const unnamed = ALL_TILES.filter((t) => homeTileForRow({ category: categoryForTile(t as never) }) !== t);
  assert.ok(unnamed.includes('food_truck'), 'Food Truck now has an enum label — re-read why category_key is written');
  assert.ok(unnamed.length >= 10, `only ${unnamed.length} rows need category_key`);
  // Before the fix the add wrote the enum alone: Food Truck's supplier was drawn under Everything else.
  const enumOnly = { ...addedFrom('food_truck'), category_key: null };
  assert.deepEqual(cards([enumOnly]).get('v-food_truck')!.map((c) => c[0]), ['everything_else']);
});

test('1–2 · for EVERY row: an added supplier is drawn once, as its own card, there — money in the move’s bucket', () => {
  let checked = 0;
  for (const tile of ALL_TILES) {
    const row = addedFrom(tile);
    const drawn = cards([row]).get(row.vendor_id) ?? [];
    // 1 · exactly one card, its own, under the row it was added from, with its price.
    assert.deepEqual(drawn, [[tile, 'own', 12_000]], `${tile}: drawn as ${JSON.stringify(drawn)}`);
    // The pair the bench posts is the pair a move to this row writes — one storage rule.
    assert.equal(row.category, storageForRow(tile).category, `${tile}: the bench posts another category`);
    assert.equal(row.category_key ?? null, storageForRow(tile).category_key, `${tile}: the server kept another key`);

    // 2 · the money: the bucket #6712's move lands a supplier moved to this row in.
    const someone: EventVendorRowInput = { ...addedFrom(tile), category: (tile === 'cake' ? 'catering' : 'cake') as never, category_key: null };
    const p = planSupplierMove(someone, tile);
    if (!('refused' in p)) {
      const mv = p as SupplierMovePlan;
      assert.equal(
        bucketForVendor({ category: row.category, covers_plan_groups: row.covers_plan_groups ?? [] }),
        bucketForVendor({ category: mv.category, covers_plan_groups: mv.covers }),
        `${tile}: an add and a move put the money in different buckets`,
      );
    }
    // Counted once: no linked copy (which would carry no money) and no second own card.
    assert.equal(drawn.filter((c) => c[2] != null).length, 1, `${tile}: the price is drawn twice`);
    checked += 1;
  }
  assert.ok(checked >= 60, `only ${checked} rows checked`);
});

test('3 · rows sharing one enum value never collapse — one dropdown entry and one card per row', () => {
  const rows = benchRows();
  const entries = addOwnCategoriesFromRows(rows);
  assert.equal(entries.length, new Set(rows.map((r) => r.t.tile)).size, 'the dropdown dropped a row');
  assert.equal(new Set(entries.map((e) => e.tile)).size, entries.length, 'two dropdown entries for one row');

  const byCategory = new Map<string, string[]>();
  for (const r of rows) byCategory.set(r.t.category, [...(byCategory.get(r.t.category) ?? []), r.t.tile]);
  const shared = [...byCategory.values()].filter((tiles) => tiles.length > 1);
  assert.ok(shared.length >= 1, 'no two rows share a stored category — the merge case is not exercised');
  assert.ok(byCategory.get('misc')!.includes('food_truck') && byCategory.get('misc')!.includes('mocktail'));

  let pairs = 0;
  for (const tiles of shared) {
    // One supplier added from EACH row that shares this enum value, all on one event.
    const added = tiles.map((t) => addedFrom(t));
    const drawn = cards(added);
    for (const [i, t] of tiles.entries()) {
      assert.deepEqual(drawn.get(added[i]!.vendor_id), [[t, 'own', 12_000]], `${t}: merged with ${tiles.join('/')}`);
    }
    // Each entry posts its own row, never the first one sharing its category.
    for (const t of tiles) assert.equal(entries.find((e) => e.tile === t)?.tile, t);
    pairs += tiles.length;
  }
  assert.ok(pairs >= 4, `only ${pairs} shared-category rows checked`);
});

test('4 · Everything else, no row, a contradicting or unknown row: no key — today’s behaviour', () => {
  assert.equal(categoryKeyForAdd('misc', 'everything_else', isTile), null, 'Everything else must store as it always did');
  assert.equal(addedFrom('everything_else').category_key, null);
  assert.equal(categoryKeyForAdd('misc', null, isTile), null);
  assert.equal(categoryKeyForAdd('misc', '', isTile), null);
  assert.equal(categoryKeyForAdd('catering', 'food_truck', isTile), null, 'a key contradicting the category was kept');
  assert.equal(categoryKeyForAdd('misc', 'no_such_row', isTile), null, 'a row the page does not draw was kept');
  // A row the enum names stores byte-for-byte as before.
  assert.equal(categoryKeyForAdd('catering', 'catering', isTile), null);
});

test('5 · the claim link carries the category #6712’s move keeps it at', () => {
  // `createManualVendorInvite` snapshots `event_vendors.category`; the move
  // re-syncs `vendor_invites.service_category` to `plan.category`. Same value.
  for (const tile of ALL_TILES) {
    const someone: EventVendorRowInput = { ...addedFrom(tile), category: 'cake' as never, category_key: null };
    const p = planSupplierMove(someone, tile);
    if ('refused' in p) continue;
    assert.equal(addedFrom(tile).category, (p as SupplierMovePlan).category, `${tile}: an added supplier's link names another category`);
  }
  const src = readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/vendors/actions.ts'), 'utf8');
  const fn = src.slice(src.indexOf('export async function createManualVendorInvite'));
  assert.match(fn.slice(0, 3000), /serviceCategory: typeof row\.category === 'string' \? row\.category : null/, 'the link no longer snapshots the record’s category');
});

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
const body = (src: string, start: string) => {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `${start} is gone`);
  const end = src.indexOf('\nexport ', i + 10);
  return src.slice(i, end < 0 ? undefined : end);
};

test('6 · every add path posts the row, and both add actions write the checked key', () => {
  const actions = strip(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/vendors/actions.ts'), 'utf8'));
  // The one check, on the taxonomy the page draws.
  const check = body(actions, 'async function categoryKeyFromAdd');
  assert.match(check, /categoryKeyForAdd\(category, raw,/, 'the add no longer runs the shared check');
  assert.match(check, /getTaxonomy\(\)/, 'the add checks the row against nothing');
  // The manual add carries the row into the insert.
  const add = body(actions, 'export async function addManualSupplier');
  assert.match(add, /attachFd\.set\('category_key', rowKey\)/, 'addManualSupplier drops the row before the insert');
  const attach = body(actions, 'async function attachManualVendorToCategory');
  assert.match(attach, /const categoryKey = await categoryKeyFromAdd\(formData, categoryRaw\)/);
  assert.match(attach, /\.insert\(\{[^}]*\.\.\.\(categoryKey \? \{ category_key: categoryKey \} : \{\}\)/, 'the manual insert writes no category_key');
  const shop = body(actions, 'export async function attachMarketplaceVendorToCategory');
  assert.match(shop, /const categoryKey = await categoryKeyFromAdd\(formData, categoryRaw\);\s*if \(categoryKey\) insertPayload\.category_key = categoryKey;/, 'the shop attach writes no category_key');

  // The walk posts the row on both of its writes, and keys its dropdown on it.
  const walk = strip(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/_components/add-your-own-walk.tsx'), 'utf8'));
  assert.equal((walk.match(/if \(tile\) fd\.set\('category_key', tile\)/g) ?? []).length, 2, 'the walk’s add or ask drops the row');
  assert.match(walk, /options=\{categories\.map\(\(c\) => \(\{ key: addOwnKey\(c\)/, 'the dropdown is keyed on the category again — rows sharing one collapse');
  // The one-screen sheet (pre-replan bench) posts it too, on both of its branches.
  const modal = strip(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/_components/new-manual-vendor-modal.tsx'), 'utf8'));
  assert.match(modal, /linkFd\.set\('category_key', tile\)/, 'the sheet’s shop pick drops the row');
  assert.match(modal, /<input type="hidden" name="category_key" value=\{tile\} \/>/, 'the sheet’s own add drops the row');

  // The bench hands every add its row, and builds the dropdown one entry per row.
  const bench = strip(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8'));
  const opens = bench.match(/setManual\(\{[^}]*\}\)/g) ?? [];
  assert.ok(opens.length >= 4, `only ${opens.length} ways to open an add`);
  for (const o of opens) assert.match(o, /tile: [\w.]+\.tile/, `an add opens without its row: ${o}`);
  assert.match(bench, /categories=\{addOwnCategoriesFromRows\(benchRows\)\}/, 'the walk’s dropdown is not built one entry per row');
  assert.match(bench, /<AddYourOwnWalk[\s\S]{0,200}tile=\{manual\.tile\}/, 'the walk opens without its row');
  assert.match(bench, /<NewManualVendorModal\s+eventId=\{eventId\}\s+category=\{manual\.category\}\s+tile=\{manual\.tile\}/, 'the sheet opens without its row');
  // After the add, the page lands on the ROW it went under, not the first row sharing its category.
  assert.match(bench, /outcome\.tile\s*\?\s*benchRows\.find\(\(r\) => r\.t\.tile === outcome\.tile\)/);
});
