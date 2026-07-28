/**
 * THE COUPLE-SIDE CHOICE TREE — visibility, pick-N, and the one rule that
 * decides whether this surface is safe:
 *
 *   💰 THE NUMBER THE COUPLE SEES IS THE NUMBER THE LOCK COMMITS.
 *
 * Every other assertion here exists to protect that one. A wrong LIST is a
 * cosmetic bug; a wrong TOTAL is money, so the tests that matter assert totals,
 * not just membership.
 *
 * ── WHAT IS BEING PINNED ────────────────────────────────────────────────────
 *   1. An UNPICKED follow-up contributes exactly 0 and cascades nothing.
 *   2. A PICKED follow-up is RENDER-ONLY and contributes exactly 0 — see the
 *      ruling in the module header of ./package-choice-tree. It is pinned here
 *      so the day someone makes it chargeable, they have to come and change a
 *      test that says, in words, why it was not.
 *   3. Unpicking a parent removes its whole subtree — grandchildren included.
 *   4. Display total === committed total, asserted by running the LOCK PATH's
 *      own composition over the same inputs.
 *   5. Pick-N: below the minimum blocks, at the minimum passes, above the
 *      maximum is refused.
 *
 * ── NEUTRALISATION (proof these tests can fail) ─────────────────────────────
 * Delete the follow-up guard in `keptItems` (@/lib/vendor-packages) — the line
 * `if (item.parent_option_id != null) return false;` — and
 * "an unpicked follow-up contributes zero even in its ILLEGAL in-memory shape"
 * fails with a WRONG TOTAL: ₱15,000 against the expected ₱10,000. A wrong
 * number, not merely a wrong list. Verified 2026-07-27, then restored.
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chargeableOptionIds,
  chargeableOptionIdsForSelection,
  choiceTotals,
  extraHoursBounds,
  extraHoursOn,
  isOptionSelectable,
  isPickCapReached,
  pickBounds,
  pickState,
  unfinishedChoiceLines,
  visibleLineIds,
  visibleLineTree,
  type ChoiceSelection,
} from './package-choice-tree';
import { priceCustomizedPackage } from './package-credit-adapter';
import { keptItems } from './vendor-packages';
import type {
  VendorPackageItemOptionRow,
  VendorPackageItemRow,
  VendorPackageWithItems,
} from './vendor-packages';

/* ────────────────────────────────────────────────────────────────────────── */
/* Fixtures                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function opt(
  over: Partial<VendorPackageItemOptionRow> & { option_id: string },
): VendorPackageItemOptionRow {
  return {
    item_id: 'ITEM',
    option_label: over.option_id,
    price_delta_centavos: 0,
    is_default: false,
    is_available: true,
    display_order: 0,
    ...over,
  };
}

function item(
  over: Partial<VendorPackageItemRow> & { item_id: string },
): VendorPackageItemRow {
  return {
    package_id: 'PKG',
    canonical_service: 'catering',
    service_description: `line ${over.item_id}`,
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 1_000_00,
    display_order: 0,
    created_at: '2026-07-27T00:00:00Z',
    parent_option_id: null,
    ...over,
  };
}

function pkg(
  items: VendorPackageItemRow[],
  over: Partial<VendorPackageWithItems> = {},
): VendorPackageWithItems {
  return {
    package_id: 'PKG',
    vendor_profile_id: 'VEN',
    package_name: 'All-in Reception',
    description: null,
    total_price_centavos: 10_000_00,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    primary_canonical_service: 'catering',
    is_active: true,
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
    items,
    ...over,
  };
}

const sel = (picks: Record<string, string[]> = {}): ChoiceSelection => ({ picks });

/** The `sides` line out of a pick-N fixture. */
const sides = (p: VendorPackageWithItems): VendorPackageItemRow =>
  p.items.find((i) => i.item_id === 'sides')!;

/**
 * The canonical branching fixture.
 *
 *   base           plain inclusion
 *   main           CHOICE · std (default, free) | premium (+₱2,000)
 *     └ side       FOLLOW-UP off `premium` · plain (default, free) | truffle (+₱5,000)
 *
 * `side` carries the LEGAL database shape — the DB CHECK
 * `vendor_package_items_followup_not_default_included_ck` forces every
 * follow-up to `is_default_included = FALSE`.
 */
function branchingPkg(over: Partial<VendorPackageWithItems> = {}) {
  return pkg(
    [
      item({ item_id: 'base' }),
      item({
        item_id: 'main',
        options: [
          opt({ option_id: 'std', is_default: true, display_order: 0 }),
          opt({ option_id: 'premium', price_delta_centavos: 2_000_00, display_order: 1 }),
        ],
      }),
      item({
        item_id: 'side',
        parent_option_id: 'premium',
        is_default_included: false,
        options: [
          opt({ option_id: 'plain', is_default: true, display_order: 0 }),
          opt({ option_id: 'truffle', price_delta_centavos: 5_000_00, display_order: 1 }),
        ],
      }),
    ],
    over,
  );
}

/**
 * Run the LOCK PATH's own composition, exactly as `lockPackage` does it:
 * narrow whatever the browser sent through `chargeableOptionIds`, then price it
 * with `priceCustomizedPackage`. Nothing is re-derived here — these are the two
 * calls the server action makes, in the order it makes them.
 */
function commit({
  p,
  removed = [],
  requested,
  creditEnabled,
  paxCount = 0,
}: {
  p: VendorPackageWithItems;
  removed?: string[];
  requested: ReadonlyArray<string>;
  creditEnabled: boolean;
  paxCount?: number;
}) {
  const chosenOptionIds = chargeableOptionIds(p, removed, requested);
  return priceCustomizedPackage({
    pkg: p,
    removedItemIds: removed,
    chosenOptionIds,
    creditEnabled,
    paxCount,
    additions: [],
    catalogue: [],
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. AN UNPICKED FOLLOW-UP — zero money, zero cascade                        */
/* ────────────────────────────────────────────────────────────────────────── */

test('an UNPICKED follow-up contributes exactly zero to the total', () => {
  // 💰 THE NEUTRALISATION TARGET. `main` sits on its free standard, so `side`
  // is not revealed — and a stale client naming `truffle` anyway must move no
  // money. Deleting the follow-up guard in `keptItems` makes this ₱15,000.
  const p = branchingPkg();
  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ side: ['truffle'] }),
    creditEnabled: true,
    paxCount: 0,
  });

  assert.ok(totals, 'the pricer refused a package it should have priced');
  assert.equal(totals.bookingTotalCentavos, 10_000_00);
  assert.deepEqual(totals.chargeableOptionIds, []);
});

test('an unpicked follow-up creates no event_vendors cascade row', () => {
  // Everything `keptItems` returns becomes a booked event_vendors row on lock.
  // A follow-up in here is a vendor the couple never picked.
  const p = branchingPkg();
  assert.deepEqual(
    keptItems(p, []).map((i) => i.item_id),
    ['base', 'main'],
  );
});

test('an unpicked follow-up is not even rendered', () => {
  const p = branchingPkg();
  assert.deepEqual(visibleLineIds(p, [], sel()), ['base', 'main']);
});

test('an unpicked follow-up contributes zero even in its ILLEGAL in-memory shape', () => {
  // 💰 THE NEUTRALISATION TARGET.
  //
  // The database forces every follow-up to `is_default_included = FALSE`
  // (vendor_package_items_followup_not_default_included_ck), and that alone
  // keeps an unpicked follow-up out of the price. But `keptItems` — which is
  // what decides whose options may be charged for — is also handed objects
  // built IN MEMORY, by this configurator and by every test, where no
  // constraint applies. So the BELT is asserted here against exactly the shape
  // the database refuses.
  //
  // Delete `if (item.parent_option_id != null) return false;` from `keptItems`
  // and this test reports ₱15,000 against the expected ₱10,000 — a wrong TOTAL,
  // not merely a wrong list.
  const p = pkg([
    item({ item_id: 'base' }),
    item({
      item_id: 'main',
      options: [
        opt({ option_id: 'std', is_default: true, display_order: 0 }),
        opt({ option_id: 'premium', price_delta_centavos: 2_000_00, display_order: 1 }),
      ],
    }),
    item({
      item_id: 'side',
      parent_option_id: 'premium',
      // ⚠ The shape the DB refuses. `main` is NOT picked, so this line is not
      // revealed — nothing about it may reach the price.
      is_default_included: true,
      options: [
        opt({ option_id: 'plain', is_default: true, display_order: 0 }),
        opt({ option_id: 'truffle', price_delta_centavos: 5_000_00, display_order: 1 }),
      ],
    }),
  ]);

  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ side: ['truffle'] }),
    creditEnabled: true,
    paxCount: 0,
  });

  assert.ok(totals, 'the pricer refused a package it should have priced');
  assert.equal(
    totals.bookingTotalCentavos,
    10_000_00,
    'an unrevealed follow-up was charged for',
  );
  assert.deepEqual(totals.chargeableOptionIds, []);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. A PICKED FOLLOW-UP — visible, and RULED render-only                     */
/* ────────────────────────────────────────────────────────────────────────── */

test('picking the parent option REVEALS the follow-up', () => {
  const p = branchingPkg();
  const tree = visibleLineTree(p, [], sel({ main: ['premium'] }));
  assert.deepEqual(
    tree.map((v) => v.item.item_id),
    ['base', 'main', 'side'],
  );
  // Rendered as a CHAIN, not a peer — the follow-up sits one level under the
  // question that raised it.
  assert.deepEqual(
    tree.map((v) => v.depth),
    [0, 0, 1],
  );
});

test('a PICKED follow-up is priced at exactly zero — the slice ruling', () => {
  // ⚖️ RULED, NOT OVERLOOKED. `lockPackage` reads its items with
  // VENDOR_PACKAGE_ITEM_SELECT, which asks for no `parent_option_id`; the
  // server therefore cannot tell a follow-up from a top-level line, and the
  // credit engine independently refuses an option on a not-included line
  // (`option_on_excluded_item`) — which would fail the whole lock, not just the
  // upgrade. So a picked follow-up is RENDER-ONLY here, and zero is the honest
  // price. Making it chargeable means teaching the LOCK PATH first.
  const p = branchingPkg();
  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ main: ['premium'], side: ['truffle'] }),
    creditEnabled: true,
    paxCount: 0,
  });

  assert.ok(totals);
  // ₱10,000 base + ₱2,000 for `premium`. The ₱5,000 truffle adds NOTHING.
  assert.equal(totals.bookingTotalCentavos, 12_000_00);
  assert.deepEqual(totals.chargeableOptionIds, ['premium']);
});

test('a picked follow-up still never cascades an event_vendors row', () => {
  const p = branchingPkg();
  assert.deepEqual(
    keptItems(p, []).map((i) => i.item_id),
    ['base', 'main'],
  );
});

test('a PRICED follow-up option is never offered — a preference must be free', () => {
  // The other half of "zero-priced": if a priced option were pickable, the
  // couple would be shown an upgrade nobody bills them for, and the vendor
  // would owe it. Free options in that region stay pickable.
  const p = branchingPkg();
  const side = p.items.find((i) => i.item_id === 'side')!;
  const selection = sel({ main: ['premium'] });

  assert.equal(
    isOptionSelectable(p, [], side, side.options![1]!, selection, 0),
    false,
    'the ₱5,000 truffle must not be offered on a line nothing charges for',
  );
  assert.equal(
    isOptionSelectable(p, [], side, side.options![0]!, selection, 0),
    true,
    'a free follow-up option is a genuine preference and stays pickable',
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. UNPICKING A PARENT clears the whole subtree                             */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * A three-level chain:
 *   main  → premium  reveals  side
 *   side  → deluxe   reveals  garnish
 * `side`'s DEFAULT is `plain`, which reveals nothing — so `garnish` is a true
 * grandchild that only a deliberate second pick can surface.
 */
function deepPkg() {
  return pkg([
    item({ item_id: 'base' }),
    item({
      item_id: 'main',
      options: [
        opt({ option_id: 'std', is_default: true, display_order: 0 }),
        opt({ option_id: 'premium', price_delta_centavos: 2_000_00, display_order: 1 }),
      ],
    }),
    item({
      item_id: 'side',
      parent_option_id: 'premium',
      is_default_included: false,
      options: [
        opt({ option_id: 'plain', is_default: true, display_order: 0 }),
        opt({ option_id: 'deluxe', display_order: 1 }),
      ],
    }),
    item({
      item_id: 'garnish',
      parent_option_id: 'deluxe',
      is_default_included: false,
      options: [
        opt({ option_id: 'herbs', is_default: true, display_order: 0 }),
        opt({ option_id: 'gold_leaf', price_delta_centavos: 9_000_00, display_order: 1 }),
      ],
    }),
  ]);
}

test('picking the GRANDPARENT alone reveals neither the child’s child nor its price', () => {
  const p = deepPkg();
  // `premium` reveals `side`. `side` falls back to `plain`, which reveals
  // nothing — so `garnish` must stay hidden until `deluxe` is actually picked.
  assert.deepEqual(visibleLineIds(p, [], sel({ main: ['premium'] })), [
    'base',
    'main',
    'side',
  ]);

  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ main: ['premium'], garnish: ['gold_leaf'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(totals);
  assert.equal(totals.bookingTotalCentavos, 12_000_00, 'the grandchild priced itself');
});

test('the grandchild appears only once the middle option is picked', () => {
  const p = deepPkg();
  assert.deepEqual(visibleLineIds(p, [], sel({ main: ['premium'], side: ['deluxe'] })), [
    'base',
    'main',
    'side',
    'garnish',
  ]);
});

test('unpicking the parent removes the WHOLE subtree — grandchildren too', () => {
  const p = deepPkg();
  const deep = sel({ main: ['premium'], side: ['deluxe'], garnish: ['gold_leaf'] });
  assert.equal(visibleLineIds(p, [], deep).length, 4);

  // Back to the standard main course: both `side` and `garnish` vanish, and
  // their picks — still present in the selection — contribute nothing.
  const collapsed: ChoiceSelection = { ...deep, picks: { ...deep.picks, main: ['std'] } };
  assert.deepEqual(visibleLineIds(p, [], collapsed), ['base', 'main']);

  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: collapsed,
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(totals);
  // 💰 The money is what matters: back to the base price. The ₱2,000 premium is
  // gone with the pick, and the ₱9,000 gold leaf — still sitting in the
  // selection, two levels down — was never chargeable in the first place.
  assert.equal(totals.bookingTotalCentavos, 10_000_00);
  // `std` IS chargeable: the couple explicitly picked the standard option on a
  // kept line, and the DB pins its delta to 0. Chargeable does not mean costly.
  assert.deepEqual(totals.chargeableOptionIds, ['std']);
});

test('removing the top-level line collapses its subtree and its money', () => {
  const p = deepPkg();
  const deep = sel({ main: ['premium'], side: ['deluxe'], garnish: ['gold_leaf'] });
  assert.deepEqual(visibleLineIds(p, ['main'], deep), ['base']);

  const totals = choiceTotals({
    pkg: p,
    removedItemIds: ['main'],
    selection: deep,
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(totals);
  // Non-flexible package: dropping `main` cuts its ₱1,000 replacement value off
  // the price, and no option on it (or under it) is charged.
  assert.equal(totals.bookingTotalCentavos, 9_000_00);
  assert.deepEqual(totals.chargeableOptionIds, []);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. 💰 DISPLAY === COMMIT                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * The matrix. Every shape this slice added, crossed with both flag states, both
 * flexibility modes, and a per-head option — because the failure being guarded
 * against is a number, and a number can be wrong in exactly one of these cells.
 */
const equalityCases: Array<{
  name: string;
  p: VendorPackageWithItems;
  removed?: string[];
  selection: ChoiceSelection;
  paxCount?: number;
}> = [
  { name: 'plain package, nothing touched', p: branchingPkg(), selection: sel() },
  {
    name: 'a chargeable upgrade picked',
    p: branchingPkg(),
    selection: sel({ main: ['premium'] }),
  },
  {
    name: 'a revealed follow-up with a priced pick',
    p: branchingPkg(),
    selection: sel({ main: ['premium'], side: ['truffle'] }),
  },
  {
    name: 'a stale pick on a hidden follow-up',
    p: branchingPkg(),
    selection: sel({ side: ['truffle'] }),
  },
  {
    name: 'a three-level chain, fully picked',
    p: deepPkg(),
    selection: sel({ main: ['premium'], side: ['deluxe'], garnish: ['gold_leaf'] }),
  },
  {
    name: 'a removal alongside an upgrade',
    p: branchingPkg(),
    removed: ['base'],
    selection: sel({ main: ['premium'] }),
  },
  {
    name: 'a flexible package (credit pool)',
    p: branchingPkg({ is_consumable_flexible: true, consumable_budget_centavos: 3_000_00 }),
    selection: sel({ main: ['premium'] }),
  },
  {
    name: 'a per-head upgrade at a real head count',
    p: pkg([
      item({ item_id: 'base' }),
      item({
        item_id: 'menu',
        options: [
          opt({ option_id: 'set_a', is_default: true, display_order: 0 }),
          opt({
            option_id: 'set_b',
            pricing_basis: 'per_pax',
            per_pax_delta_centavos: 150_00,
            min_pax: 50,
            display_order: 1,
          }),
        ],
      }),
    ]),
    selection: sel({ menu: ['set_b'] }),
    paxCount: 180,
  },
  {
    name: 'a pick-N line with two picks',
    p: pkg([
      item({ item_id: 'base' }),
      item({
        item_id: 'sides',
        pick_min: 2,
        pick_max: 3,
        options: [
          opt({ option_id: 's1', is_default: true, display_order: 0 }),
          opt({ option_id: 's2', display_order: 1 }),
          opt({ option_id: 's3', display_order: 2 }),
        ],
      }),
    ]),
    selection: sel({ sides: ['s1', 's3'] }),
  },
];

for (const creditEnabled of [false, true]) {
  for (const c of equalityCases) {
    test(`display === commit · ${c.name} · credit ${creditEnabled ? 'ON' : 'OFF'}`, () => {
      const displayed = choiceTotals({
        pkg: c.p,
        removedItemIds: c.removed ?? [],
        selection: c.selection,
        creditEnabled,
        paxCount: c.paxCount ?? 0,
      });
      assert.ok(displayed, 'the configurator could not price this');

      // (a) What the modal actually submits: the chargeable ids it priced.
      const asSubmitted = commit({
        p: c.p,
        removed: c.removed ?? [],
        requested: displayed.chargeableOptionIds,
        creditEnabled,
        paxCount: c.paxCount ?? 0,
      });
      assert.ok(asSubmitted, 'the lock path refused what the modal priced');
      assert.equal(
        asSubmitted.bookingTotalCentavos,
        displayed.bookingTotalCentavos,
        'the couple was quoted one number and would be charged another',
      );

      // (b) The hostile/stale case: a client that submits EVERY id it holds,
      //     including follow-up picks and extra pick-N picks. The lock re-runs
      //     the same narrowing, so the total must not move.
      const everything = Object.values(c.selection.picks).flat();
      const asAbused = commit({
        p: c.p,
        removed: c.removed ?? [],
        requested: everything,
        creditEnabled,
        paxCount: c.paxCount ?? 0,
      });
      assert.ok(asAbused, 'the lock path refused a payload it must merely narrow');
      assert.equal(
        asAbused.bookingTotalCentavos,
        displayed.bookingTotalCentavos,
        'submitting every held id changed the price — the narrowing is not shared',
      );
    });
  }
}

test('the chargeable set is the SAME function the lock path narrows with', () => {
  // Not "produces the same answer today" — literally the same export. This is
  // what stops the display and the commit drifting when one is edited.
  const p = branchingPkg();
  const selection = sel({ main: ['premium'], side: ['truffle'] });
  assert.deepEqual(
    chargeableOptionIdsForSelection(p, [], selection),
    chargeableOptionIds(p, [], Object.values(selection.picks).flat()),
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. PICK-N                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function pickNPkg() {
  return pkg([
    item({ item_id: 'base' }),
    item({
      item_id: 'sides',
      pick_min: 2,
      pick_max: 3,
      options: [
        opt({ option_id: 's1', is_default: true, display_order: 0 }),
        opt({ option_id: 's2', display_order: 1 }),
        opt({ option_id: 's3', display_order: 2 }),
        opt({ option_id: 's4', display_order: 3 }),
      ],
    }),
  ]);
}

test('pick_min/pick_max null keeps today’s exactly-one behaviour', () => {
  const plain = item({ item_id: 'main' });
  assert.deepEqual(pickBounds(plain), { min: 1, max: 1 });
});

test('pick-N BELOW the minimum blocks the send', () => {
  const p = pickNPkg();
  const blocked = unfinishedChoiceLines(p, [], sel({ sides: ['s1'] }));
  assert.deepEqual(
    blocked.map((i) => i.item_id),
    ['sides'],
    'one of two required picks must not be sendable',
  );
  assert.equal(pickState(sides(p), sel({ sides: ['s1'] })).belowMinimum, true);
});

test('pick-N with NOTHING picked blocks — an unfinished order, not a cheaper one', () => {
  const p = pickNPkg();
  assert.deepEqual(
    unfinishedChoiceLines(p, [], sel()).map((i) => i.item_id),
    ['sides'],
  );

  // 🚫 And it is NOT cheaper. Answering fewer questions must never reduce the
  // price — the vendor priced the package assuming every question is answered.
  const empty = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel(),
    creditEnabled: true,
    paxCount: 0,
  });
  const full = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ sides: ['s1', 's2'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(empty && full);
  assert.equal(empty.bookingTotalCentavos, full.bookingTotalCentavos);
});

test('pick-N AT the minimum passes', () => {
  const p = pickNPkg();
  assert.deepEqual(unfinishedChoiceLines(p, [], sel({ sides: ['s1', 's2'] })), []);
  const state = pickState(sides(p), sel({ sides: ['s1', 's2'] }));
  assert.equal(state.belowMinimum, false);
  assert.equal(state.counterLabel, '2 of 3 chosen');
});

test('pick-N ABOVE the maximum is refused', () => {
  const p = pickNPkg();
  const line = sides(p);
  const atMax = sel({ sides: ['s1', 's2', 's3'] });

  assert.equal(pickState(line, atMax).atMaximum, true);
  assert.equal(
    isPickCapReached(line, line.options![3]!, atMax),
    true,
    'a fourth pick must be refused on a choose-3 line',
  );
  // An already-picked option stays interactive, or the couple could never
  // change their mind.
  assert.equal(isPickCapReached(line, line.options![0]!, atMax), false);
});

test('an optional exactly-one line is answered by its vendor default', () => {
  // Regression: the block must not fire on every ordinary choice line. Today's
  // shipped behaviour is that an unpicked optional line sits on its standard
  // option, whose delta the DB pins to 0 — answered AND correctly priced.
  const p = branchingPkg();
  assert.deepEqual(unfinishedChoiceLines(p, [], sel()), []);
});

test('a REQUIRED choice line is never defaulted — it blocks until picked', () => {
  const p = pkg([
    item({
      item_id: 'course',
      is_required: true,
      options: [
        opt({ option_id: 'beef', is_default: true, display_order: 0 }),
        opt({ option_id: 'fish', display_order: 1 }),
      ],
    }),
  ]);
  assert.deepEqual(
    unfinishedChoiceLines(p, [], sel()).map((i) => i.item_id),
    ['course'],
  );
  assert.deepEqual(unfinishedChoiceLines(p, [], sel({ course: ['fish'] })), []);
});

test('only the FIRST pick on a pick-N line is chargeable, and the rest must be free', () => {
  // The boundary, stated as a rule rather than as a side effect: the lock path
  // narrows to one option per line, so a second PRICED pick could never be
  // charged — and is therefore never offered.
  const p = pkg([
    item({
      item_id: 'sides',
      pick_min: 1,
      pick_max: 2,
      options: [
        opt({ option_id: 'free_a', is_default: true, display_order: 0 }),
        opt({ option_id: 'paid_b', price_delta_centavos: 1_500_00, display_order: 1 }),
        opt({ option_id: 'paid_c', price_delta_centavos: 2_500_00, display_order: 2 }),
        opt({ option_id: 'free_d', display_order: 3 }),
      ],
    }),
  ]);
  const line = sides(p);
  const [, paid_b, paid_c, free_d] = line.options! as VendorPackageItemOptionRow[];

  // One priced pick: chargeable, so offered.
  assert.equal(isOptionSelectable(p, [], line, paid_b!, sel(), 0), true);
  // A SECOND priced pick: not chargeable, so refused.
  assert.equal(
    isOptionSelectable(p, [], line, paid_c!, sel({ sides: ['paid_b'] }), 0),
    false,
  );
  // And the reverse order too — picking the later priced option first must not
  // let an earlier priced one in and silently demote it to free.
  assert.equal(
    isOptionSelectable(p, [], line, paid_b!, sel({ sides: ['paid_c'] }), 0),
    false,
  );
  // A free option that sorts AFTER the priced pick is fine: `resolveChosenOption`
  // still resolves to the priced one, so nothing is misquoted.
  assert.equal(
    isOptionSelectable(p, [], line, free_d!, sel({ sides: ['paid_b'] }), 0),
    true,
  );
});

test('a free option that would STEAL the chargeable slot is refused', () => {
  // ⚠ SUBTLE, AND FOUND BY THE TEST ABOVE FAILING. "Free options are always
  // safe" is wrong. `resolveChosenOption` charges for whichever picked option
  // comes FIRST in display order, so adding a free option that sorts EARLIER
  // than an already-picked priced one moves the charge onto the free one — the
  // couple's ₱1,500 upgrade silently becomes ₱0 and the vendor still delivers
  // it. Refused, in the only direction that costs nobody money.
  const p = pkg([
    item({
      item_id: 'sides',
      pick_min: 1,
      pick_max: 2,
      options: [
        opt({ option_id: 'free_a', is_default: true, display_order: 0 }),
        opt({ option_id: 'paid_b', price_delta_centavos: 1_500_00, display_order: 1 }),
      ],
    }),
  ]);
  const line = sides(p);
  assert.equal(
    isOptionSelectable(p, [], line, line.options![0]!, sel({ sides: ['paid_b'] }), 0),
    false,
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 6. QUANTITIES — the hour stepper                                           */
/* ────────────────────────────────────────────────────────────────────────── */

test('a line with an hourly rate and a cap gets a bounded stepper', () => {
  const line = item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 });
  assert.deepEqual(extraHoursBounds(line), { min: 0, max: 4 });
});

test('a cap WITHOUT an hourly rate is not a stepper', () => {
  // `max_extra_hours` caps the hourly model that already exists on the table —
  // it is explicitly not a generic quantity column, so a cap alone means
  // nothing to price or to show.
  const line = item({ item_id: 'photo', max_extra_hours: 4 });
  assert.equal(extraHoursBounds(line), null);
  assert.equal(extraHoursOn(line, { picks: {}, extraHours: { photo: 3 } }), 0);
});

test('extra hours are clamped to the line’s own cap', () => {
  const line = item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 });
  assert.equal(extraHoursOn(line, { picks: {}, extraHours: { photo: 99 } }), 4);
  assert.equal(extraHoursOn(line, { picks: {}, extraHours: { photo: -3 } }), 0);
});

test('extra hours move NO money — the lock path cannot see the columns', () => {
  // Same ruling as the follow-up: `lockPackage` reads with a select carrying
  // neither `max_extra_hours` nor `extra_hour_centavos`, and
  // PackageCustomizationsInput has no quantity field at all. A stepper that
  // silently changed the total would be a quote the server cannot honour.
  const p = pkg([
    item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
  ]);
  const withHours = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: { picks: {}, extraHours: { photo: 4 } },
    creditEnabled: true,
    paxCount: 0,
  });
  const without = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel(),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(withHours && without);
  assert.equal(withHours.bookingTotalCentavos, without.bookingTotalCentavos);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 7. ADD-ONS + degenerate shapes                                             */
/* ────────────────────────────────────────────────────────────────────────── */

test('an optional ADD-ON never leaks into the configurator list', () => {
  // Add-ons are not inside total_price_centavos, so ticking one would refund
  // money the vendor never charged. This is also the guard that keeps every
  // follow-up out, since the DB forces them to not-included.
  const p = pkg([item({ item_id: 'base' }), item({ item_id: 'addon', is_default_included: false })]);
  assert.deepEqual(visibleLineIds(p, [], sel()), ['base']);
});

test('a follow-up in its ILLEGAL in-memory shape is still not a root', () => {
  // The DB refuses `is_default_included = TRUE` on a follow-up, but this module
  // is also handed objects built in memory, where no constraint applies.
  const p = pkg([
    item({ item_id: 'base' }),
    item({ item_id: 'sneaky', parent_option_id: 'nobody', is_default_included: true }),
  ]);
  assert.deepEqual(visibleLineIds(p, [], sel()), ['base']);
});

test('a cyclic follow-up chain terminates instead of hanging the browser', () => {
  // The database refuses a cycle by trigger; an in-memory object cannot be
  // refused, and an infinite walk in a render is a frozen tab.
  const p = pkg([
    item({
      item_id: 'a',
      options: [opt({ option_id: 'oa', is_default: true })],
    }),
    item({
      item_id: 'b',
      parent_option_id: 'oa',
      is_default_included: false,
      options: [opt({ option_id: 'ob', is_default: true })],
    }),
  ]);
  // Point `a` back under `b`'s option — a cycle a → b → a.
  (p.items[0] as { parent_option_id?: string | null }).parent_option_id = 'ob';
  assert.deepEqual(visibleLineIds(p, [], sel()), []);
});

test('an unavailable option is never selectable', () => {
  const p = pkg([
    item({
      item_id: 'main',
      options: [
        opt({ option_id: 'std', is_default: true, display_order: 0 }),
        opt({ option_id: 'retired', is_available: false, display_order: 1 }),
      ],
    }),
  ]);
  const main = p.items[0]!;
  assert.equal(isOptionSelectable(p, [], main, main.options![1]!, sel(), 0), false);
});
