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
 *   2. A PICKED follow-up IS charged (flipped 2026-07-28) — its own option's
 *      delta lands on the total, exactly like any other choice line's. It was
 *      pinned at 0 while `VENDOR_PACKAGE_ITEM_SELECT` withheld
 *      `parent_option_id`, so whoever made it chargeable had to come here and
 *      rewrite a test that said, in words, why it was not. That is what
 *      happened; both halves of the story are kept in the tests below.
 *   3. Unpicking a parent removes its whole subtree — grandchildren included.
 *   4. Display total === committed total, asserted by running the LOCK PATH's
 *      own composition over the same inputs, across a matrix that now includes a
 *      selection exercising every priced axis at once.
 *   5. Pick-N: below the minimum REFUSES TO PRICE AT ALL (it used to merely cost
 *      the same as a finished order), at the minimum passes, above the maximum
 *      is clamped by the narrowing and refused by the engine.
 *   6. Extra hours bill at the line's own rate, clamped to its own cap, and only
 *      on a line the booking actually contains.
 *
 * ── THE ONE RULE UNDER ALL OF THEM ──────────────────────────────────────────
 * VISIBILITY BOUNDS CHARGEABILITY. Widening what can be billed did not widen
 * what can be billed WITHOUT BEING SHOWN: every new charge is gated on the same
 * `visibleLineTree` walk the couple's screen renders from, so a follow-up whose
 * parent was never picked is dropped by the narrowing and refused by the engine.
 * Several tests below assert exactly that pairing, because it is the guarantee
 * that had to survive the flip.
 *
 * ── NEUTRALISATION (proof these tests can fail) ─────────────────────────────
 * Delete the follow-up guard in `keptItems` (@/lib/vendor-packages) — the line
 * `if (item.parent_option_id != null) return false;` — and
 * "a picked follow-up still never cascades an event_vendors row" fails: the
 * conditional line becomes a booked vendor row. Separately, drop the
 * `.slice(0, pickBounds(item).max)` in `effectivePicksOn` and
 * "picks beyond pick_max are CLAMPED by the narrowing" fails with a wrong TOTAL.
 * Both verified 2026-07-28, then restored.
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chargeableExtraHours,
  chargeableExtraHoursForSelection,
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
  requestedHours = {},
  creditEnabled,
  paxCount = 0,
}: {
  p: VendorPackageWithItems;
  removed?: string[];
  requested: ReadonlyArray<string>;
  requestedHours?: Record<string, number>;
  creditEnabled: boolean;
  paxCount?: number;
}) {
  const chosenOptionIds = chargeableOptionIds(p, removed, requested);
  const extraHours = chargeableExtraHours(p, removed, requested, requestedHours);
  return priceCustomizedPackage({
    pkg: p,
    removedItemIds: removed,
    chosenOptionIds,
    creditEnabled,
    paxCount,
    additions: [],
    catalogue: [],
    extraHours,
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

test('a PICKED follow-up IS charged — the lock path was taught first', () => {
  // ⚖️ THE RULING REVERSED, 2026-07-28, and the order of operations is the whole
  // story. This asserted ₱0 for as long as `VENDOR_PACKAGE_ITEM_SELECT` withheld
  // `parent_option_id`: the server could not tell a follow-up from a top-level
  // line, so pricing one would have been a guess, and the credit engine refused
  // the shape outright (`option_on_excluded_item`) — which failed the whole lock,
  // not just the upgrade. Zero was the honest price for a screen the server
  // could not honour.
  //
  // The select now carries all five branching columns and the engine resolves a
  // revealed follow-up like any other choice line, so the ₱5,000 the couple was
  // shown is the ₱5,000 they are charged.
  const p = branchingPkg();
  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ main: ['premium'], side: ['truffle'] }),
    creditEnabled: true,
    paxCount: 0,
  });

  assert.ok(totals);
  // ₱10,000 base + ₱2,000 `premium` + ₱5,000 `truffle`.
  assert.equal(totals.bookingTotalCentavos, 17_000_00);
  assert.deepEqual(totals.chargeableOptionIds, ['premium', 'truffle']);
});

test('a follow-up whose parent is NOT picked is dropped, never billed', () => {
  // 🚨 THE OTHER HALF, and the one that has to keep holding now that a follow-up
  // can cost money. `main` sits on its free standard, so `side` is not revealed —
  // a stale page (or a hand-rolled payload) naming `truffle` anyway must move no
  // money at all, because the question was never asked.
  const p = branchingPkg();

  // Dropped by the narrowing, before the pricer ever sees it.
  assert.deepEqual(chargeableOptionIds(p, [], ['std', 'truffle']), ['std']);

  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ main: ['std'], side: ['truffle'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(totals);
  assert.equal(totals.bookingTotalCentavos, 10_000_00, 'an unrevealed follow-up billed');
});

test('the ENGINE refuses an unrevealed follow-up pick that dodges the narrowing', () => {
  // Belt and brace, and they are genuinely independent: the narrowing DROPS,
  // the engine REFUSES. This is the path a hand-rolled client takes — straight
  // to `priceCustomizedPackage` with an id the tree would have discarded — and
  // it must fail closed rather than price something nobody was quoted.
  const p = branchingPkg();
  const priced = priceCustomizedPackage({
    pkg: p,
    removedItemIds: [],
    chosenOptionIds: ['std', 'truffle'], // NOT narrowed — `side` is not revealed
    creditEnabled: true,
    paxCount: 0,
    additions: [],
    catalogue: [],
    extraHours: {},
  });
  assert.equal(priced, null, 'the engine priced an option on a line not in the booking');
});

test('a picked follow-up still never cascades an event_vendors row', () => {
  const p = branchingPkg();
  assert.deepEqual(
    keptItems(p, []).map((i) => i.item_id),
    ['base', 'main'],
  );
});

test('a PRICED follow-up option IS offered, because it is now charged for', () => {
  // The mirror of the flip above. This asserted `false` while a follow-up pick
  // cost ₱0 — offering a priced option there would have shown the couple an
  // upgrade nobody billed and handed the vendor a bill they never agreed to.
  // Now that the pick is charged, refusing it would hide an upgrade the vendor
  // is offering and the couple would happily pay for.
  //
  // ⚠ The RULE did not change: `isOptionSelectable` still says "only a
  // zero-delta option may be offered where the pricer would not charge". It says
  // TRUE here because it asks the boundary function, and the boundary moved.
  const p = branchingPkg();
  const side = p.items.find((i) => i.item_id === 'side')!;
  const selection = sel({ main: ['premium'] });

  assert.equal(
    isOptionSelectable(p, [], side, side.options![1]!, selection, 0),
    true,
    'the ₱5,000 truffle is chargeable on a revealed follow-up, so it is offered',
  );
  assert.equal(
    isOptionSelectable(p, [], side, side.options![0]!, selection, 0),
    true,
    'the free follow-up option stays pickable',
  );
});

test('a follow-up option is NOT offered while its parent is unpicked', () => {
  // The guard that has to survive the flip: `side` is not revealed at all when
  // `main` sits on its standard option, so nothing on it is chargeable and the
  // priced option must stay refused. (The modal never renders the line in this
  // state — `visibleLineTree` omits it — but the two rules are independent and
  // this pins the one that decides money.)
  const p = branchingPkg();
  const side = p.items.find((i) => i.item_id === 'side')!;
  const selection = sel({ main: ['std'] });

  assert.equal(visibleLineIds(p, [], selection).includes('side'), false);
  assert.equal(
    isOptionSelectable(p, [], side, side.options![1]!, selection, 0),
    false,
    'a priced option on an unrevealed follow-up must never be offered',
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
  {
    // 💰 THE INVARIANT CASE. Every axis the charge-path widening turned on, in
    // one selection, all carrying real money: a revealed follow-up with a priced
    // pick, a pick-N line with TWO priced picks, and an hour stepper. If the
    // display and the commit can diverge at all, this is the cell that shows it.
    name: 'branched + pick-N + extra hours, every axis priced',
    p: pkg([
      item({ item_id: 'base' }),
      item({
        item_id: 'main',
        options: [
          opt({ option_id: 'std', is_default: true, display_order: 0 }),
          opt({ option_id: 'premium', price_delta_centavos: 2_000_00, display_order: 1 }),
        ],
      }),
      item({
        item_id: 'style',
        parent_option_id: 'premium',
        is_default_included: false,
        options: [
          opt({ option_id: 'plain', is_default: true, display_order: 0 }),
          opt({ option_id: 'boneless', price_delta_centavos: 1_200_00, display_order: 1 }),
        ],
      }),
      item({
        item_id: 'sides',
        pick_min: 2,
        pick_max: 3,
        options: [
          opt({ option_id: 's1', is_default: true, display_order: 0 }),
          opt({ option_id: 's2', price_delta_centavos: 400_00, display_order: 1 }),
          opt({ option_id: 's3', price_delta_centavos: 700_00, display_order: 2 }),
        ],
      }),
      item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
    ]),
    selection: {
      picks: { main: ['premium'], style: ['boneless'], sides: ['s2', 's3'] },
      extraHours: { photo: 3 },
    },
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

      // (a) What the modal actually submits: the chargeable ids AND the
      //     chargeable hours it priced.
      const asSubmitted = commit({
        p: c.p,
        removed: c.removed ?? [],
        requested: displayed.chargeableOptionIds,
        requestedHours: { ...displayed.chargeableExtraHours },
        creditEnabled,
        paxCount: c.paxCount ?? 0,
      });
      assert.ok(asSubmitted, 'the lock path refused what the modal priced');
      assert.equal(
        asSubmitted.bookingTotalCentavos,
        displayed.bookingTotalCentavos,
        'the couple was quoted one number and would be charged another',
      );

      // (b) The hostile/stale case: a client that submits EVERY id and EVERY
      //     hour it holds, including picks on hidden follow-ups and picks past
      //     `pick_max`. The lock re-runs the same narrowing, so the total must
      //     not move in either direction.
      const everything = Object.values(c.selection.picks).flat();
      const asAbused = commit({
        p: c.p,
        removed: c.removed ?? [],
        requested: everything,
        requestedHours: { ...(c.selection.extraHours ?? {}) },
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
  // ⚠ AND IT SURVIVES THE ROUND TRIP THROUGH THE WIRE. The browser holds a
  // grouped `ChoiceSelection`; the server is handed a FLAT id list with no
  // grouping and no click order in it. The two must reach the same answer, or
  // the shared function is shared in name only.
  assert.deepEqual(
    chargeableOptionIdsForSelection(p, [], selection),
    ['premium', 'truffle'],
  );
});

test('the chargeable HOURS are one function across the wire too', () => {
  const p = pkg([
    item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
  ]);
  const selection: ChoiceSelection = { picks: {}, extraHours: { photo: 9 } };
  assert.deepEqual(
    chargeableExtraHoursForSelection(p, [], selection),
    chargeableExtraHours(p, [], [], selection.extraHours ?? {}),
  );
  assert.deepEqual(chargeableExtraHoursForSelection(p, [], selection), { photo: 4 });
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

  // 🚫 STRENGTHENED, not relaxed. This used to assert "unfinished costs the same
  // as finished" — true, but the weaker of the two available guarantees, and it
  // only held because a pick-N line could not move money at all. Now that every
  // pick carries its own delta, an unfinished line has NO price rather than a
  // coincidentally-equal one: the engine refuses below `pick_min`, so there is
  // no number to quote and the modal blocks on `null` as well as on
  // `unfinishedChoiceLines`. An unfinished order is not an order.
  const empty = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel(),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.equal(empty, null, 'a package below a line’s minimum was given a price');

  const full = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ sides: ['s1', 's2'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(full, 'answering every question must price');
});

test('pick_min unmet REFUSES the lock, it does not quote less', () => {
  // The commit half of the assertion above, run through the lock path's own
  // composition. `lockPackage` turns this null into a hard error rather than
  // writing a booking at a price nobody agreed to.
  const p = pickNPkg();
  assert.equal(
    commit({ p, requested: ['s1'], creditEnabled: true }),
    null,
    'one of two required picks priced anyway',
  );
  assert.ok(commit({ p, requested: ['s1', 's2'], creditEnabled: true }));
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

test('EVERY pick on a pick-N line is chargeable, and each adds its own delta', () => {
  // 💰 THE MONEY FLIP. This asserted the opposite: only the first pick could be
  // charged (`resolveChosenOption` returned one option per line), so a second
  // PRICED pick was refused rather than shown as an upgrade nobody would bill.
  // A "choose 2 of 3" therefore charged for one premium side and delivered two.
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

  assert.equal(isOptionSelectable(p, [], line, paid_b!, sel(), 0), true);
  // A SECOND priced pick is now chargeable, so it is offered — in BOTH orders.
  assert.equal(
    isOptionSelectable(p, [], line, paid_c!, sel({ sides: ['paid_b'] }), 0),
    true,
  );
  assert.equal(
    isOptionSelectable(p, [], line, paid_b!, sel({ sides: ['paid_c'] }), 0),
    true,
  );
  assert.equal(
    isOptionSelectable(p, [], line, free_d!, sel({ sides: ['paid_b'] }), 0),
    true,
  );

  // And the number: both deltas land, not just the first in display order.
  const totals = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ sides: ['paid_b', 'paid_c'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(totals);
  assert.equal(totals.bookingTotalCentavos, 10_000_00 + 1_500_00 + 2_500_00);
  assert.deepEqual(totals.chargeableOptionIds, ['paid_b', 'paid_c']);
});

test('the order-dependent "stolen chargeable slot" is gone, not merely guarded', () => {
  // ⚠ THIS TEST USED TO ASSERT A REFUSAL, and the refusal existed to paper over
  // an order-dependence: only ONE option per line was charged — whichever came
  // first in display order — so picking a priced option and THEN a free one that
  // sorts earlier silently moved the charge onto the free one. The couple's
  // ₱1,500 upgrade became ₱0 and the vendor still delivered it, so
  // `isOptionSelectable` had to refuse the free option to keep the quote honest.
  //
  // Charging every pick on its own delta removes the hazard at the root: there
  // is no single "chargeable slot" left to steal, so both options are offered
  // AND the priced one keeps its price whichever order they were picked in.
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
    true,
  );

  const withBoth = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ sides: ['paid_b', 'free_a'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  const withPaidOnly = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: sel({ sides: ['paid_b'] }),
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(withBoth && withPaidOnly);
  assert.equal(
    withBoth.bookingTotalCentavos,
    withPaidOnly.bookingTotalCentavos,
    'adding a FREE option changed the price — the slot-steal is back',
  );
  assert.equal(withBoth.bookingTotalCentavos, 10_000_00 + 1_500_00);
});

test('picks beyond pick_max are CLAMPED by the narrowing, in display order', () => {
  // The tree DROPS the excess (a stale page must not fail a money action); the
  // engine REFUSES it (a hand-rolled payload must not be priced by guess). Both
  // postures are asserted, because they are the two different callers.
  const p = pkg([
    item({
      item_id: 'sides',
      pick_min: 1,
      pick_max: 2,
      options: [
        opt({ option_id: 'a', price_delta_centavos: 1_00, is_default: true, display_order: 0 }),
        opt({ option_id: 'b', price_delta_centavos: 2_00, display_order: 1 }),
        opt({ option_id: 'c', price_delta_centavos: 4_00, display_order: 2 }),
      ],
    }),
  ]);
  // NOTE: `a` is the default and the DB pins a default's delta to 0; this
  // fixture is in-memory, where no constraint applies, so the deltas are chosen
  // to make "which two survived" unambiguous from the total alone.

  // Three picks on a choose-2 line → the first two in DISPLAY order survive,
  // regardless of the order the ids arrived in.
  assert.deepEqual(chargeableOptionIds(p, [], ['c', 'b', 'a']), ['a', 'b']);
  assert.deepEqual(chargeableOptionIds(p, [], ['a', 'b', 'c']), ['a', 'b']);

  // The engine's own posture on the same over-long list: refuse outright.
  assert.equal(
    priceCustomizedPackage({
      pkg: p,
      removedItemIds: [],
      chosenOptionIds: ['a', 'b', 'c'], // NOT narrowed
      creditEnabled: true,
      paxCount: 0,
      additions: [],
      catalogue: [],
      extraHours: {},
    }),
    null,
    'the engine priced more picks than the line takes',
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

test('extra hours MOVE money — billed at the line’s own rate', () => {
  // Flipped with the follow-up ruling and for the same reason: `lockPackage`
  // read with a select carrying neither `max_extra_hours` nor
  // `extra_hour_centavos`, and `PackageCustomizationsInput` had no quantity
  // field at all — so the stepper was a request the server could not honour and
  // ₱0 was the honest answer. The select carries both columns now and the
  // payload carries the quantity, so 4 hours at ₱500 is ₱2,000 on the total.
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
  assert.equal(without.bookingTotalCentavos, 10_000_00);
  assert.equal(withHours.bookingTotalCentavos, 10_000_00 + 4 * 500_00);
  assert.deepEqual(withHours.chargeableExtraHours, { photo: 4 });
});

test('extra hours are CLAMPED to the line’s cap before anything is billed', () => {
  // The stepper cannot exceed the cap, but a stale page or a hand-rolled payload
  // can. The narrowing clamps (a money action must not fail over it) and the
  // engine refuses an unclamped value (a price nobody was quoted must not be
  // charged) — the same two postures as the option boundary.
  const p = pkg([
    item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
  ]);
  assert.deepEqual(chargeableExtraHours(p, [], [], { photo: 99 }), { photo: 4 });
  assert.deepEqual(chargeableExtraHours(p, [], [], { photo: -3 }), {});
  // Zero is omitted rather than recorded — an untouched stepper is not a request.
  assert.deepEqual(chargeableExtraHours(p, [], [], { photo: 0 }), {});

  const clamped = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: { picks: {}, extraHours: { photo: 99 } },
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(clamped);
  assert.equal(clamped.bookingTotalCentavos, 10_000_00 + 4 * 500_00, 'billed past the cap');

  assert.equal(
    priceCustomizedPackage({
      pkg: p,
      removedItemIds: [],
      chosenOptionIds: [],
      creditEnabled: true,
      paxCount: 0,
      additions: [],
      catalogue: [],
      extraHours: { photo: 99 }, // NOT clamped
    }),
    null,
    'the engine billed hours past the cap instead of refusing',
  );
});

test('hours on a line with no hourly rate are dropped, then refused', () => {
  // `max_extra_hours` caps an hourly model that already exists; a cap with no
  // rate is not something anyone knows how to bill, so it is not a stepper and
  // it is not a charge.
  const p = pkg([item({ item_id: 'photo', max_extra_hours: 4 })]);
  assert.deepEqual(chargeableExtraHours(p, [], [], { photo: 3 }), {});
  assert.equal(
    priceCustomizedPackage({
      pkg: p,
      removedItemIds: [],
      chosenOptionIds: [],
      creditEnabled: true,
      paxCount: 0,
      additions: [],
      catalogue: [],
      extraHours: { photo: 3 },
    }),
    null,
  );
});

test('hours on a line the couple removed leave with the line', () => {
  const p = pkg([
    item({ item_id: 'base' }),
    item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
  ]);
  assert.deepEqual(chargeableExtraHours(p, ['photo'], [], { photo: 4 }), {});
  const totals = choiceTotals({
    pkg: p,
    removedItemIds: ['photo'],
    selection: { picks: {}, extraHours: { photo: 4 } },
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(totals);
  // Non-flexible package: the ₱1,000 line value comes off, and none of its
  // hours are billed.
  assert.equal(totals.bookingTotalCentavos, 9_000_00);
});

test('extra hours on a REVEALED follow-up are billed; on a hidden one they are not', () => {
  // Follow-ups carry the hour axis too, and it is bounded by the same visibility
  // rule as their options: no reveal, no charge.
  const p = pkg([
    item({
      item_id: 'main',
      options: [
        opt({ option_id: 'std', is_default: true, display_order: 0 }),
        opt({ option_id: 'premium', price_delta_centavos: 2_000_00, display_order: 1 }),
      ],
    }),
    item({
      item_id: 'extracover',
      parent_option_id: 'premium',
      is_default_included: false,
      extra_hour_centavos: 300_00,
      max_extra_hours: 3,
    }),
  ]);

  const revealed = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: { picks: { main: ['premium'] }, extraHours: { extracover: 2 } },
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(revealed);
  assert.equal(revealed.bookingTotalCentavos, 10_000_00 + 2_000_00 + 2 * 300_00);

  const hidden = choiceTotals({
    pkg: p,
    removedItemIds: [],
    selection: { picks: { main: ['std'] }, extraHours: { extracover: 2 } },
    creditEnabled: true,
    paxCount: 0,
  });
  assert.ok(hidden);
  assert.equal(hidden.bookingTotalCentavos, 10_000_00, 'hours billed on a hidden line');
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

/* ────────────────────────────────────────────────────────────────────────── */
/* REVERSIBLE REMOVAL (2026-07-29) — an unticked root stays on screen,        */
/* worth nothing, until the couple re-ticks it. Before this, `visibleLineTree`*/
/* dropped removed roots outright: the line vanished for the session, every   */
/* removed-state style in the lock modal was unreachable dead code, and the   */
/* "+₱X back to budget" copy promised an experiment the UI couldn't finish.   */
/* ────────────────────────────────────────────────────────────────────────── */

test('a removed root STAYS VISIBLE, marked, so it can be re-ticked', () => {
  const p = branchingPkg();
  const tree = visibleLineTree(p, ['main'], sel());
  const main = tree.find((l) => l.item.item_id === 'main');
  assert.ok(main, 'the unticked line must stay on screen');
  assert.equal(main!.removed, true);
  assert.equal(main!.depth, 0);
  // …and everything NOT removed is explicitly marked as such.
  for (const l of tree) {
    if (l.item.item_id !== 'main') assert.equal(l.removed, false);
  }
});

test('a removed root reveals NO follow-ups, even with its option still selected', () => {
  const p = branchingPkg();
  // The couple picked `premium` (which reveals `side`), THEN unticked the line.
  const tree = visibleLineTree(p, ['main'], sel({ main: ['premium'] }));
  assert.equal(
    tree.some((l) => l.item.item_id === 'side'),
    false,
    'a removed root must not keep revealing its subtree',
  );
});

test('a removed root is NEVER chargeable — options and hours both', () => {
  const p = branchingPkg();
  assert.deepEqual(
    chargeableOptionIds(p, ['main'], ['premium', 'truffle']),
    [],
    'picks on a removed line must not survive the narrowing',
  );
  const hourly = pkg([
    item({ item_id: 'base' }),
    item({ item_id: 'photo', extra_hour_centavos: 500_00, max_extra_hours: 4 }),
  ]);
  assert.deepEqual(
    chargeableExtraHours(hourly, ['photo'], [], { photo: 3 }),
    {},
    'hours on a removed line must not survive the narrowing',
  );
});

test('remove → re-tick is a perfect roundtrip, on screen and in money', () => {
  const p = branchingPkg();
  const never = visibleLineTree(p, [], sel({ main: ['premium'] }));
  const restored = visibleLineTree(p, [], sel({ main: ['premium'] }));
  assert.deepEqual(restored, never);
  for (const creditEnabled of [true, false]) {
    const a = commit({ p, removed: [], requested: ['premium'], creditEnabled });
    const b = commit({ p, removed: [], requested: ['premium'], creditEnabled });
    assert.deepEqual(b, a, `re-ticked commit must equal never-removed (credit=${creditEnabled})`);
  }
});

test('flat consumers keep BOOKING semantics — a removed line is not in them', () => {
  const p = branchingPkg();
  assert.equal(visibleLineIds(p, ['main'], sel()).includes('main'), false);
  // A removed pick-N line below its minimum must NOT block the lock button.
  const pn = pickNPkg();
  assert.deepEqual(
    unfinishedChoiceLines(pn, ['sides'], sel()).map((i) => i.item_id),
    [],
    'a removed line cannot hold the CTA hostage over picks it no longer needs',
  );
});
