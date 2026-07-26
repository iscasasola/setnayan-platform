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

test('a real policy value is carried through', () => {
  const pkg = pkgWith([item('a')], {
    unspent_credit_policy: 'refundable',
  } as Partial<VendorPackageWithItems>);
  assert.equal(toCreditPackage(pkg).unspent_credit_policy, 'refundable');
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
