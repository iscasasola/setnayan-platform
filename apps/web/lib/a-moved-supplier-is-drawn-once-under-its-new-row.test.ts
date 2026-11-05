/**
 * A MOVED SUPPLIER IS DRAWN ONCE, UNDER ITS NEW ROW — its money in that row's
 * bucket, and "also covers" never naming the row it now lives in.
 *
 * Owner 2026-10-20, asked "Do you want a 'Move to another category' option for
 * suppliers?" → *"okay"*. The case: Dunkin' Donuts, typed in under Everything
 * else, is really a Food Truck.
 *
 * 🔑 WHY THIS IS NOT "WRITE THE NEW CATEGORY". `event_vendors.category` is an
 * enum, and 48 of the 80 rows have no label of their own — Food Truck stores
 * `misc`, which draws as Everything else. A move that rewrote `category` alone
 * would put Dunkin' straight back where it started and report success. The
 * row is carried in `category_key` (`homeTileForRow`), and this file proves the
 * whole loop by EXECUTING it: the plan the server action writes
 * (`planSupplierMove`) → the Suppliers page's own builder
 * (`buildShortlistFolders`) → the Budget's own bucketer (`bucketForVendor`).
 *
 * Properties, over EVERY row the page can draw:
 *   1. the card is drawn exactly once as its own card, under the new row, and
 *      not under the old one;
 *   2. its money buckets exactly where a supplier ADDED under that row would;
 *   3. "also covers" loses the new home, and the old home is not added to it;
 *      the other ticks survive, as linked copies with no money;
 *   4. Undo (move back + the removed ticks) puts the card back as it was;
 *   5. a `category_key` that contradicts the category, or names a row the page
 *      does not draw, is never taken as the home — a pick cannot vanish;
 *   6. the server action writes the plan in ONE update, reads it back
 *      (a zero-row update is not a move), refuses a supplier with a shop, and
 *      keeps a pending claim link's category in step.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildShortlistFolders,
  categoryForTile,
  coverKeyForTile,
  homeTileForRow,
  linkedTilesForRow,
  tileForCover,
} from '@/lib/shortlist-taxonomy';
import { moveConfirmLine, planSupplierMove, type SupplierMovePlan } from '@/lib/move-supplier-category';
import { WEDDING_TILES_BY_PARENT } from '@/lib/taxonomy';
import { bucketForVendor } from '@/lib/budget-truth';
import type { EventVendorRowInput } from '@/lib/wedding-plan-groups';

const ALL_TILES = Object.values(WEDDING_TILES_BY_PARENT).flat() as string[];
const OLD_HOME = 'everything_else';
const OTHER = 'massage_chair';

/** The owner's card: Dunkin' under Everything else, also ticked as a Massage Chair and a Food Truck. */
function dunkin(extraCovers: string[] = []): EventVendorRowInput {
  return {
    vendor_id: 'v-dunkin',
    vendor_name: "Dunkin' Donuts",
    category: 'misc' as never,
    status: 'considering',
    manual_vendor_id: 'm-dunkin',
    total_cost_php: 18_000,
    category_key: null,
    covers_plan_groups: [coverKeyForTile(OTHER), coverKeyForTile('food_truck'), ...extraCovers],
  };
}

function moved(row: EventVendorRowInput, plan: SupplierMovePlan): EventVendorRowInput {
  return {
    ...row,
    category: plan.category,
    category_key: plan.category_key,
    covers_plan_groups: plan.covers,
  };
}

/** Every card the page draws for this supplier: [tile, own-or-linked]. */
function cards(row: EventVendorRowInput): Array<[string, 'own' | 'linked', number | null]> {
  const folders = buildShortlistFolders({ vendorRows: [row], eventType: 'wedding', faithSet: new Set(), eventId: 'e' });
  const out: Array<[string, 'own' | 'linked', number | null]> = [];
  for (const f of folders) {
    for (const t of f.tiles) {
      for (const v of t.vendors) {
        if (v.vendorId === row.vendor_id) out.push([t.tile, v.includedWith == null ? 'own' : 'linked', v.totalCostPhp]);
      }
    }
  }
  return out;
}

const plan = (row: EventVendorRowInput, to: string, restore: string[] = []): SupplierMovePlan => {
  const p = planSupplierMove(row, to, restore);
  assert.ok(!('refused' in p), `moving to ${to} was refused`);
  return p as SupplierMovePlan;
};

test('the walk is not vacuous', () => {
  assert.ok(ALL_TILES.length >= 60, `only ${ALL_TILES.length} rows`);
  assert.ok(ALL_TILES.includes('food_truck') && ALL_TILES.includes(OLD_HOME));
  // The reason category_key exists here: many rows have no enum label.
  const unnamed = ALL_TILES.filter((t) => homeTileForRow({ category: categoryForTile(t as never) }) !== t);
  assert.ok(unnamed.includes('food_truck'), 'Food Truck now has an enum label — re-read why category_key is written');
  assert.ok(unnamed.length >= 10, `only ${unnamed.length} rows need category_key`);
  // Before: the owner's card is under Everything else.
  assert.deepEqual(cards(dunkin()).filter((c) => c[1] === 'own').map((c) => c[0]), [OLD_HOME]);
});

test('1–3 · after a move to ANY row: drawn once there, not at the old home, money in that row’s bucket, covers without its home', () => {
  let checked = 0;
  for (const to of ALL_TILES) {
    if (to === OLD_HOME) continue;
    // A budget-cost row carries its OWN group in covers (`budget/cost-actions.ts`);
    // after a move that key would name the OLD home and draw the card there again.
    const before = dunkin([coverKeyForTile(OLD_HOME)]);
    const p = plan(before, to);
    const after = moved(before, p);
    const drawn = cards(after);

    // 1 · exactly one own card, under the new row; none at the old home.
    const own = drawn.filter((c) => c[1] === 'own');
    assert.deepEqual(own.map((c) => c[0]), [to], `${to}: own card drawn under ${own.map((c) => c[0]).join(', ') || 'nothing'}`);
    assert.equal(own[0]![2], 18_000, `${to}: the price did not travel with the card`);
    assert.ok(!drawn.some((c) => c[0] === OLD_HOME), `${to}: still drawn under Everything else`);
    assert.equal(new Set(drawn.map((c) => c[0])).size, drawn.length, `${to}: drawn twice under one row`);

    // 2 · the money, exactly where a supplier added under that row would be.
    const born = { category: categoryForTile(to as never), covers_plan_groups: [] as string[] };
    assert.equal(
      bucketForVendor({ category: after.category, covers_plan_groups: after.covers_plan_groups ?? [] }),
      bucketForVendor(born),
      `${to}: the money is not in the new row's bucket`,
    );

    // 3 · also covers: never its own home, never the old home; the others stay as no-money copies.
    assert.ok(!p.covers.some((k) => tileForCover(k) === to), `${to}: also-covers still names the new home`);
    assert.ok(!p.covers.some((k) => tileForCover(k) === OLD_HOME), `${to}: the old home was added to also-covers`);
    assert.ok(!linkedTilesForRow(after).includes(to as never), `${to}: linked to itself`);
    for (const c of drawn.filter((d) => d[1] === 'linked')) assert.equal(c[2], null, `${to}: a linked copy carries money`);
    if (to !== OTHER) {
      assert.ok(drawn.some((c) => c[0] === OTHER && c[1] === 'linked'), `${to}: the Massage Chair tick was lost`);
    }
    checked += 1;
  }
  assert.ok(checked >= 60, `only ${checked} moves checked`);
});

test('the owner’s case, by name: Dunkin’ under Food Truck as its own row, not “included with”', () => {
  const p = plan(dunkin(), 'food_truck');
  assert.equal(p.category, 'misc', 'Food Truck has no enum label — the category stays misc');
  assert.equal(p.category_key, 'food_truck');
  assert.deepEqual(p.removedCovers, [coverKeyForTile('food_truck')], 'the Food Truck tick was not taken off');
  const drawn = cards(moved(dunkin(), p));
  assert.deepEqual(drawn.filter((c) => c[0] === 'food_truck'), [['food_truck', 'own', 18_000]]);
});

test('4 · Undo puts the card back where it was, ticks included', () => {
  for (const to of ['food_truck', 'cake', 'dj', 'catering']) {
    const before = dunkin();
    const p = plan(before, to);
    const back = plan(moved(before, p), p.from!, p.removedCovers);
    const restored = moved(moved(before, p), back);
    assert.deepEqual(cards(restored), cards(before), `${to}: Undo did not restore the drawing`);
    assert.equal(
      bucketForVendor({ category: restored.category, covers_plan_groups: restored.covers_plan_groups ?? [] }),
      bucketForVendor({ category: before.category, covers_plan_groups: before.covers_plan_groups ?? [] }),
      `${to}: Undo did not restore the money`,
    );
  }
});

test('a move to the row it is already in is refused, not written', () => {
  assert.deepEqual(planSupplierMove(dunkin(), OLD_HOME), { refused: 'same_row' });
  const p = plan(dunkin(), 'food_truck');
  assert.deepEqual(planSupplierMove(moved(dunkin(), p), 'food_truck'), { refused: 'same_row' });
});

test('5 · a category_key that contradicts the category, or names an undrawn row, is never the home', () => {
  // Contradicts: says Food Truck (misc) on a caterer row → the caterer row wins, and the money agrees.
  assert.equal(homeTileForRow({ category: 'catering', category_key: 'food_truck' }), 'catering');
  // Undrawn: a key the taxonomy does not draw falls back to the category's row, so the pick stays visible.
  const ghost = { ...dunkin(), category_key: 'no_such_row' };
  assert.deepEqual(cards(ghost).filter((c) => c[1] === 'own').map((c) => c[0]), [OLD_HOME]);
});

test('6 · the action writes the plan in one read-back update, refuses a supplier with a shop, keeps the claim link in step', () => {
  const src = readFileSync(
    join(process.cwd(), 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const start = src.indexOf('export async function moveSupplierToCategory');
  assert.ok(start >= 0, 'moveSupplierToCategory is gone');
  const end = src.indexOf('\nexport ', start + 10);
  const body = src.slice(start, end < 0 ? undefined : end);

  assert.match(body, /planSupplierMove\(/, 'the action no longer runs the shared plan');
  const update = body.match(/\.from\('event_vendors'\)\s*\.update\(\{([^}]*)\}\)([\s\S]*?);/);
  assert.ok(update, 'no event_vendors update in the action');
  for (const col of ['category', 'category_key', 'covers_plan_groups']) {
    assert.match(update![1]!, new RegExp(`\\b${col}:\\s*plan\\.`), `the update does not write ${col} from the plan`);
  }
  assert.equal((body.match(/\.from\('event_vendors'\)\s*\.update\(/g) ?? []).length, 1, 'the move is split across updates');
  assert.match(update![2]!, /\.is\('marketplace_vendor_id', null\)/, 'the update can touch a supplier with a shop');
  assert.match(update![2]!, /\.select\(/, 'the update is not read back — a zero-row update would say "Moved"');
  assert.match(body, /if \(row\.marketplace_vendor_id\)\s*\{\s*return \{ ok: false/, 'a supplier with a shop is not refused');
  assert.match(
    body,
    /\.from\('vendor_invites'\)\s*\.update\(\{ service_category: plan\.category \}\)[\s\S]{0,120}\.in\('status', \['pending', 'claimed'\]\)/,
    'a pending (or claimed, waiting for Approve) claim link keeps the old category',
  );
});

test('7 · the confirm line says what moves — and, for a supplier waiting for Approve, what Approve will give', () => {
  const base = { name: "Dunkin' Donuts", fromLabel: 'Everything else', toLabel: 'Food Truck', toTile: 'food_truck' };
  assert.equal(
    moveConfirmLine(base),
    "Dunkin' Donuts moves from Everything else to Food Truck. Its price and payments move with it.",
  );
  // #6709: Approve gives what this category gets, so a waiting claim is told.
  assert.match(moveConfirmLine({ ...base, claimAsk: true }), /When you approve them, they see what a booked food truck sees\.$/);
  // Into the coordinator trade, Approve gives the couple's own access — said in those words.
  assert.match(
    moveConfirmLine({ ...base, toLabel: 'Coordinator', toTile: 'coordinator', claimAsk: true }),
    /When you approve them, they get the same access as you\.$/,
  );
});
