/**
 * CREDIT ADAPTER + THE PARITY PROPERTY THAT MAKES THE FLAG SAFE TO FLIP.
 *
 * The headline test here is `parity`: for a package with no upgrades and the
 * DB-default 'expiring' policy, the credit engine must reproduce the shipped
 * `computeCustomization` to the centavo. That property is the entire argument
 * that turning `NEXT_PUBLIC_PACKAGE_CREDIT` on cannot silently reprice a
 * booking, so it is asserted by exhaustion over every subset of removals, in
 * both the flexible and non-flexible shapes, rather than on a couple of
 * hand-picked cases.
 *
 * Pure module: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  allowedRemovals,
  type PriceCustomizedPackageArgs,
  toCreditPackage,
  unresolvedRequiredChoices,
  DEFAULT_UNSPENT_CREDIT_POLICY,
} from './package-credit-adapter';
import { computePackageCredit } from './package-credit';
import {
  computeCustomization,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';

/**
 * Test-local caller for the pricer's required-object API.
 *
 * The production signature has NO optional fields on purpose — a forgotten one
 * is how a line removal once handed back spent credit. Tests state only what
 * they exercise, and this ONE helper is the single place a new required field
 * has to be answered for.
 */
function price(over: Partial<PriceCustomizedPackageArgs> & { pkg: VendorPackageWithItems }) {
  return priceCustomizedPackage({
    removedItemIds: [],
    chosenOptionIds: [],
    creditEnabled: true,
    paxCount: 0,
    additions: [],
    catalogue: [],
    ...over,
  });
}


/* ── fixtures ─────────────────────────────────────────────────────────────── */

function opt(
  id: string,
  itemId: string,
  over: Partial<VendorPackageItemOptionRow> = {},
): VendorPackageItemOptionRow {
  return {
    option_id: id,
    item_id: itemId,
    option_label: id,
    price_delta_centavos: 0,
    is_default: false,
    is_available: true,
    display_order: 0,
    ...over,
  };
}

function item(
  id: string,
  over: Partial<VendorPackageItemRow> = {},
): VendorPackageItemRow {
  return {
    item_id: id,
    package_id: 'pkg-1',
    canonical_service: 'catering',
    service_description: id,
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 10_000,
    display_order: 0,
    created_at: '2026-07-26T00:00:00Z',
    ...over,
  };
}

function pkgWith(
  items: VendorPackageItemRow[],
  over: Partial<VendorPackageWithItems> = {},
): VendorPackageWithItems {
  return {
    package_id: 'pkg-1',
    vendor_profile_id: 'vp-1',
    package_name: 'Full day',
    description: null,
    total_price_centavos: 500_000,
    consumable_budget_centavos: 50_000,
    is_consumable_flexible: false,
    primary_canonical_service: 'catering',
    is_active: true,
    created_at: '2026-07-26T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
    items,
    ...over,
  } as VendorPackageWithItems;
}

/* ── the adapter ──────────────────────────────────────────────────────────── */

test('a missing unspent_credit_policy reads as expiring, never refundable', () => {
  // The failure this prevents: an unselected column silently taking money off
  // the price. 'refundable' has unresolved semantics (see ./package-credit) and
  // must never be reached by omission.
  const c = toCreditPackage(pkgWith([item('a')]));
  assert.equal(c.unspent_credit_policy, 'expiring');
  assert.equal(DEFAULT_UNSPENT_CREDIT_POLICY, 'expiring');
});

test('an unrecognised policy value also reads as expiring', () => {
  const pkg = pkgWith([item('a')]);
  (pkg as { unspent_credit_policy?: string }).unspent_credit_policy = 'nonsense';
  assert.equal(toCreditPackage(pkg).unspent_credit_policy, 'expiring');
});

test('the RETIRED refundable policy normalises to expiring, never through', () => {
  // Owner-locked 2026-07-26: credit shifts, it never discounts. A stored
  // 'refundable' must not reach the engine as a discount instruction.
  const pkg = pkgWith([item('a')], {
    unspent_credit_policy: 'refundable',
  } as unknown as Partial<VendorPackageWithItems>);
  assert.equal(toCreditPackage(pkg).unspent_credit_policy, 'expiring');
});

test('a missing is_required reads as FALSE, not TRUE', () => {
  // FALSE is the conservative direction: reading it as TRUE would make the line
  // unremovable and hide credit the couple is entitled to.
  const raw = item('a');
  delete (raw as { is_required?: boolean }).is_required;
  assert.equal(toCreditPackage(pkgWith([raw])).items[0]!.is_required, false);
});

test('an unfetched options list stays a PLAIN line, not an empty choice', () => {
  const c = toCreditPackage(pkgWith([item('a')]));
  assert.equal(c.items[0]!.options, undefined);
});

test('a fetched options list becomes a choice line', () => {
  const line = item('a', {
    options: [opt('std', 'a', { is_default: true }), opt('up', 'a', { price_delta_centavos: 5_000 })],
  });
  const c = toCreditPackage(pkgWith([line]));
  assert.equal(c.items[0]!.options?.length, 2);
});

/* ── allowedRemovals ──────────────────────────────────────────────────────── */

test('a removal naming a REQUIRED line is dropped, not passed to the engine', () => {
  // The engine fails closed on it; the shipped path ignores it. Dropping keeps
  // today's forgiving behaviour, and can only ever yield LESS credit.
  const pkg = pkgWith([item('req', { is_required: true }), item('opt')]);
  assert.deepEqual(allowedRemovals(pkg, ['req', 'opt']), ['opt']);
});

test('a removal naming a NEVER-INCLUDED line is dropped', () => {
  const pkg = pkgWith([item('addon', { is_default_included: false })]);
  assert.deepEqual(allowedRemovals(pkg, ['addon']), []);
});

test('a removal naming an unknown id is dropped', () => {
  const pkg = pkgWith([item('a')]);
  assert.deepEqual(allowedRemovals(pkg, ['ghost']), []);
});

test('sanitising removals can only ever REDUCE credit, never inflate it', () => {
  // The safety argument for pre-sanitising instead of failing closed, asserted
  // rather than asserted-in-a-comment.
  const pkg = pkgWith([item('req', { is_required: true, replacement_value_centavos: 99_000 }), item('opt')], {
    is_consumable_flexible: true,
  });
  const sanitised = computePackageCredit({
    pkg: toCreditPackage(pkg),
    removedItemIds: allowedRemovals(pkg, ['req', 'opt']),
  });
  assert.ok(sanitised.ok);
  // The required line's 99,000 never enters the pool.
  assert.equal(sanitised.availableCreditCentavos, 50_000 + 10_000);
});

/* ── unresolvedRequiredChoices ────────────────────────────────────────────── */

test('a required CHOICE line with nothing picked is unresolved', () => {
  const line = item('main', {
    is_required: true,
    options: [opt('chicken', 'main', { is_default: true }), opt('beef', 'main', { price_delta_centavos: 8_000 })],
  });
  assert.deepEqual(unresolvedRequiredChoices(pkgWith([line]), [], []), ['main']);
});

test('a required choice line WITH a pick is resolved', () => {
  const line = item('main', {
    is_required: true,
    options: [opt('chicken', 'main', { is_default: true }), opt('beef', 'main', { price_delta_centavos: 8_000 })],
  });
  assert.deepEqual(unresolvedRequiredChoices(pkgWith([line]), [], ['beef']), []);
});

test('a required PLAIN line needs no pick', () => {
  const line = item('venue', { is_required: true });
  assert.deepEqual(unresolvedRequiredChoices(pkgWith([line]), [], []), []);
});

test('an OPTIONAL choice line needs no pick — it defaults', () => {
  const line = item('dessert', {
    options: [opt('cake', 'dessert', { is_default: true }), opt('halo', 'dessert', { price_delta_centavos: 2_000 })],
  });
  assert.deepEqual(unresolvedRequiredChoices(pkgWith([line]), [], []), []);
});

test('picking a RETIRED option does not resolve a required choice line', () => {
  const line = item('main', {
    is_required: true,
    options: [
      opt('chicken', 'main', { is_default: true }),
      opt('beef', 'main', { price_delta_centavos: 8_000, is_available: false }),
    ],
  });
  assert.deepEqual(unresolvedRequiredChoices(pkgWith([line]), [], ['beef']), ['main']);
});

test('the UI gate and the server agree: unresolved ⇒ the engine would refuse', () => {
  // Anti-drift. If these two ever disagree, the modal either blocks a lock the
  // server would accept, or lets through one it will reject.
  const line = item('main', {
    is_required: true,
    options: [opt('chicken', 'main', { is_default: true }), opt('beef', 'main', { price_delta_centavos: 8_000 })],
  });
  const pkg = pkgWith([line]);
  assert.equal(unresolvedRequiredChoices(pkg, [], []).length, 1);
  const engine = computePackageCredit({ pkg: toCreditPackage(pkg), chosenOptionIds: [] });
  assert.equal(engine.ok, false);
  assert.ok(
    !engine.ok && engine.errors.some((e) => e.code === 'required_choice_unselected'),
  );
});

/* ── THE PARITY PROPERTY ──────────────────────────────────────────────────── */

/** Every subset of `ids`. */
function subsets(ids: string[]): string[][] {
  return ids.reduce<string[][]>(
    (acc, id) => acc.concat(acc.map((s) => [...s, id])),
    [[]],
  );
}

for (const flexible of [false, true]) {
  test(`parity: expiring + no upgrades reproduces computeCustomization exactly (flexible=${flexible})`, () => {
    // THE test that makes flipping the flag safe. By exhaustion over all 16
    // subsets of four lines — one required, one add-on, two ordinary — in both
    // package shapes.
    const items = [
      item('req', { is_required: true, replacement_value_centavos: 40_000 }),
      item('addon', { is_default_included: false, replacement_value_centavos: 7_000 }),
      item('a', { replacement_value_centavos: 12_500 }),
      item('b', { replacement_value_centavos: 3_300 }),
    ];
    const pkg = pkgWith(items, { is_consumable_flexible: flexible });

    for (const removal of subsets(['req', 'addon', 'a', 'b'])) {
      const shipped = computeCustomization(pkg, removal);
      const credit = computePackageCredit({
        pkg: toCreditPackage(pkg),
        removedItemIds: allowedRemovals(pkg, removal),
      });
      assert.ok(credit.ok, `engine refused subset [${removal.join(',')}]`);

      assert.equal(
        credit.bookingTotalCentavos,
        shipped.totalLockedCentavos,
        `booking total diverged on [${removal.join(',')}]`,
      );
      assert.equal(
        credit.remainingCreditCentavos,
        shipped.remainingConsumableCentavos,
        `remaining pool diverged on [${removal.join(',')}]`,
      );
      assert.equal(
        credit.removedTotalCentavos,
        shipped.removedTotalCentavos,
        `removed total diverged on [${removal.join(',')}]`,
      );
    }
  });
}

test('parity holds with choice lines too, as long as nothing is upgraded', () => {
  const line = item('dessert', {
    replacement_value_centavos: 9_000,
    options: [
      opt('cake', 'dessert', { is_default: true }),
      opt('halo', 'dessert', { price_delta_centavos: 4_000 }),
    ],
  });
  const pkg = pkgWith([item('a'), line], { is_consumable_flexible: true });
  const shipped = computeCustomization(pkg, []);
  const credit = computePackageCredit({ pkg: toCreditPackage(pkg), chosenOptionIds: [] });
  assert.ok(credit.ok);
  assert.equal(credit.bookingTotalCentavos, shipped.totalLockedCentavos);
  assert.equal(credit.remainingCreditCentavos, shipped.remainingConsumableCentavos);
});

test('an upgrade is the ONLY thing that moves the total off parity', () => {
  const line = item('dessert', {
    options: [
      opt('cake', 'dessert', { is_default: true }),
      opt('halo', 'dessert', { price_delta_centavos: 4_000 }),
    ],
  });
  const pkg = pkgWith([line], { is_consumable_flexible: true, consumable_budget_centavos: 0 });
  const credit = computePackageCredit({
    pkg: toCreditPackage(pkg),
    chosenOptionIds: ['halo'],
  });
  assert.ok(credit.ok);
  // No pool to absorb it, so it lands on the total as overspend.
  assert.equal(credit.overspendCentavos, 4_000);
  assert.equal(
    credit.bookingTotalCentavos,
    computeCustomization(pkg, []).totalLockedCentavos + 4_000,
  );
});

/* ── THE ONE PRICER — both write sites must agree ─────────────────────────── */

import { priceCustomizedPackage } from './package-credit-adapter';

const UPGRADE_LINE = () =>
  item('dessert', {
    replacement_value_centavos: 9_000,
    options: [
      opt('cake', 'dessert', { is_default: true }),
      opt('halo', 'dessert', { price_delta_centavos: 4_000 }),
    ],
  });

test('an upgrade with NO pool to absorb it is charged, under either flag', () => {
  // The half that must hold in both worlds: nothing makes a picked upgrade free.
  const pkg = pkgWith([item('a'), UPGRADE_LINE()], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 0,
  });
  for (const creditEnabled of [false, true]) {
    const base = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: creditEnabled })!;
    const up = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: ['halo'], creditEnabled: creditEnabled })!;
    assert.equal(
      up.bookingTotalCentavos - base.bookingTotalCentavos,
      4_000,
      `a picked upgrade was free (creditEnabled=${creditEnabled})`,
    );
  }
});

test('the remove path SEES choices at all — the actual regression', () => {
  // THE BUG THIS PINS. `removeItemFromPackage` fetched no options and priced
  // with `computeCustomization` alone, so a choice line read as a plain line
  // and the upgrade was invisible to it. Pricing the post-removal state must
  // therefore differ from the options-blind computation whenever an upgrade is
  // picked and there is no pool to absorb it.
  // `a` frees NOTHING, so no credit can absorb the upgrade and the difference
  // has to show up in the total under either flag. (With a line that frees
  // credit, the pool legitimately absorbs it — asserted separately below.)
  const pkg = pkgWith([item('a', { replacement_value_centavos: 0 }), UPGRADE_LINE()], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 0,
  });
  const optionsBlind = computeCustomization(pkg, ['a']).totalLockedCentavos;
  for (const creditEnabled of [false, true]) {
    const priced = price({ pkg: pkg, removedItemIds: ['a'], chosenOptionIds: ['halo'], creditEnabled: creditEnabled })!;
    assert.notEqual(
      priced.bookingTotalCentavos,
      optionsBlind,
      `the remove path is blind to choices again (creditEnabled=${creditEnabled})`,
    );
  }
});

test('under CREDIT, freed credit absorbs the upgrade instead of raising the total', () => {
  // Not a bug — the owner rule is "credit offsets upgrades; the couple pays the
  // difference only if they overspend". Pinned so nobody later "fixes" it into
  // double-charging: the upgrade is still recorded as SPEND, it just is not
  // billed on top when the pool covers it.
  const pkg = pkgWith([item('a', { replacement_value_centavos: 10_000 }), UPGRADE_LINE()], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 0,
  });
  const withoutUpgrade = price({ pkg: pkg, removedItemIds: ['a'], chosenOptionIds: [], creditEnabled: true })!;
  const withUpgrade = price({ pkg: pkg, removedItemIds: ['a'], chosenOptionIds: ['halo'], creditEnabled: true })!;

  assert.equal(withUpgrade.overspendCentavos, 0, 'a 10,000 pool covers a 4,000 upgrade');
  assert.equal(
    withUpgrade.bookingTotalCentavos,
    withoutUpgrade.bookingTotalCentavos,
    'the pool absorbed it, so the price must not move',
  );
  assert.equal(
    withoutUpgrade.remainingConsumableCentavos - withUpgrade.remainingConsumableCentavos,
    4_000,
    'the upgrade must still be DEDUCTED from the pool — otherwise it was free',
  );
});

test('the pricer returns null rather than a number when the engine refuses', () => {
  // Fail closed: a required choice line with nothing picked has no total, and
  // substituting one would charge a couple for a decision they never made.
  const required = item('main', {
    is_required: true,
    options: [opt('chicken', 'main', { is_default: true }), opt('beef', 'main', { price_delta_centavos: 8_000 })],
  });
  assert.equal(price({ pkg: pkgWith([required]), removedItemIds: [], chosenOptionIds: [], creditEnabled: true }), null);
});

test('flag OFF still charges a picked upgrade — it is never free', () => {
  const pkg = pkgWith([UPGRADE_LINE()], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 0,
  });
  const base = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: false })!.bookingTotalCentavos;
  const up = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: ['halo'], creditEnabled: false })!.bookingTotalCentavos;
  assert.equal(up - base, 4_000);
});

/* ── CREDIT IS CONSUMABLE ON OTHER SERVICES ───────────────────────────────── */

test('credit BUYS another service — the pool drains, the price does not move', () => {
  // Owner-locked 2026-07-26: "credits can be consumables to other services, but
  // not deductables… can be used on other services of the vendors as well."
  const pkg = pkgWith([item('a', { replacement_value_centavos: 0 })], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 50_000,
  });
  const before = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true })!;
  const after = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: [{ addition_id: 'svc-photo', quantity: 1 }],
    catalogue: [{ addition_id: 'svc-photo', unit_price_centavos: 30_000 }] })!;

  assert.equal(
    after.bookingTotalCentavos,
    before.bookingTotalCentavos,
    'consuming credit must NOT change what the couple pays',
  );
  assert.equal(
    before.remainingConsumableCentavos - after.remainingConsumableCentavos,
    30_000,
    'the pool must actually be debited — otherwise the service was free',
  );
});

test('spending MORE than the pool bills the excess, it does not discount', () => {
  const pkg = pkgWith([item('a', { replacement_value_centavos: 0 })], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 10_000,
  });
  const r = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: [{ addition_id: 'svc-big', quantity: 1 }],
    catalogue: [{ addition_id: 'svc-big', unit_price_centavos: 25_000 }] })!;
  assert.equal(r.overspendCentavos, 15_000, 'the excess is owed');
  assert.equal(
    r.bookingTotalCentavos,
    price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true })!.bookingTotalCentavos + 15_000,
  );
});

test('an addition with NO committed price is refused, never priced at zero', () => {
  // The failure this prevents: a service the vendor never opted into credit
  // (credit_price_centavos NULL) being handed over for free.
  const pkg = pkgWith([item('a')], { is_consumable_flexible: true, consumable_budget_centavos: 50_000 });
  const r = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: [{ addition_id: 'svc-unpriced', quantity: 1 }],
    catalogue: [] });
  assert.equal(r, null, 'an unpriced addition must fail closed');
});

test('additions are refused outright when the credit flag is OFF', () => {
  // Silently dropping them would tell the couple the booking simply cost less.
  const pkg = pkgWith([item('a')], { is_consumable_flexible: true, consumable_budget_centavos: 50_000 });
  const r = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: false, paxCount: 0, additions: [{ addition_id: 'svc', quantity: 1 }],
    catalogue: [{ addition_id: 'svc', unit_price_centavos: 10_000 }] });
  assert.equal(r, null);
});

test('quantity multiplies the COMMITTED price, not a client number', () => {
  const pkg = pkgWith([item('a', { replacement_value_centavos: 0 })], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 100_000,
  });
  const r = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: [{ addition_id: 'svc', quantity: 3 }],
    catalogue: [{ addition_id: 'svc', unit_price_centavos: 20_000 }] })!;
  assert.equal(
    price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true })!.remainingConsumableCentavos -
      r.remainingConsumableCentavos,
    60_000,
    '3 × ₱200 committed',
  );
});

/* ── credit purchases must SURVIVE a line removal ─────────────────────────── */

test('credit already spent is NOT handed back when a line is removed', () => {
  // THE GAP THIS PINS. `removeItemFromPackage` re-priced with no additions, so
  // dropping any line recomputed the pool as if the couple had bought nothing —
  // overstating the credit still available. Same shape as the divergence that
  // once hid a paid upgrade: two write sites, one of them forgetting something.
  const pkg = pkgWith(
    [item('a', { replacement_value_centavos: 0 }), item('drop', { replacement_value_centavos: 0 })],
    { is_consumable_flexible: true, consumable_budget_centavos: 50_000 },
  );
  const adds = [{ addition_id: 'svc', quantity: 1 }];
  const cat = [{ addition_id: 'svc', unit_price_centavos: 30_000 }];

  const atLock = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: adds, catalogue: cat })!;
  const afterRemove = price({ pkg: pkg, removedItemIds: ['drop'], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: adds, catalogue: cat })!;

  assert.equal(
    atLock.remainingConsumableCentavos,
    20_000,
    '₱500 pool − ₱300 spent',
  );
  assert.equal(
    afterRemove.remainingConsumableCentavos,
    20_000,
    'the purchase survives the removal — the pool must not refill',
  );

  // And the bug's signature: pricing WITHOUT the additions hands the money back.
  const buggy = price({ pkg: pkg, removedItemIds: ['drop'], chosenOptionIds: [], creditEnabled: true, paxCount: 0 })!;
  assert.equal(
    buggy.remainingConsumableCentavos,
    50_000,
    'sanity: forgetting the additions is exactly what overstates the pool',
  );
});

test('a removal cannot re-rate a purchase at a NEW price', () => {
  // The frozen price is used, not a fresh read. If a vendor raises their credit
  // price after the couple bought, the removal must not silently re-charge.
  const pkg = pkgWith([item('a', { replacement_value_centavos: 0 })], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 50_000,
  });
  const atOldPrice = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: [{ addition_id: 'svc', quantity: 1 }],
    catalogue: [{ addition_id: 'svc', unit_price_centavos: 30_000 }] })!;
  const atNewPrice = price({ pkg: pkg, removedItemIds: [], chosenOptionIds: [], creditEnabled: true, paxCount: 0, additions: [{ addition_id: 'svc', quantity: 1 }],
    catalogue: [{ addition_id: 'svc', unit_price_centavos: 45_000 }] })!;
  assert.notEqual(
    atOldPrice.remainingConsumableCentavos,
    atNewPrice.remainingConsumableCentavos,
    'the price passed in is what is charged — so it must be the FROZEN one',
  );
});
