/**
 * CHOICE LINES — resolution + surcharge.
 *
 * A choice line is an inclusion the vendor offers alternatives for ("chicken /
 * beef / salmon"). The package price already pays for the STANDARD option, so
 * the standard's delta is pinned to 0 by a DB CHECK and every other option adds
 * its own difference.
 *
 * These are the rules the money depends on, so each test names the failure it
 * prevents rather than the function it calls.
 *
 * Pure module: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  chosenOptionsSurchargeCentavos,
  defaultOptionFor,
  isChoiceLine,
  resolveChosenOption,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from './vendor-packages';

/* ── fixtures ─────────────────────────────────────────────────────────────── */

function opt(
  id: string,
  over: Partial<VendorPackageItemOptionRow> = {},
): VendorPackageItemOptionRow {
  return {
    option_id: id,
    item_id: 'item-menu',
    option_label: id,
    price_delta_centavos: 0,
    is_default: false,
    is_available: true,
    display_order: 0,
    ...over,
  };
}

function item(over: Partial<VendorPackageItemRow> = {}): VendorPackageItemRow {
  return {
    item_id: 'item-menu',
    package_id: 'pkg-1',
    canonical_service: 'catering',
    service_description: 'Plated dinner',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 100_000,
    display_order: 0,
    created_at: '2026-07-26T00:00:00Z',
    ...over,
  };
}

const CHICKEN = opt('chicken', { is_default: true, price_delta_centavos: 0 });
const BEEF = opt('beef', { price_delta_centavos: 8_000 });
const SALMON = opt('salmon', { price_delta_centavos: 15_000 });

function pkgWith(items: VendorPackageItemRow[]): VendorPackageWithItems {
  return {
    package_id: 'pkg-1',
    vendor_profile_id: 'vp-1',
    package_name: 'Full day',
    description: null,
    total_price_centavos: 500_000,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    primary_canonical_service: 'catering',
    is_active: true,
    created_at: '2026-07-26T00:00:00Z',
    updated_at: '2026-07-26T00:00:00Z',
    items,
  } as VendorPackageWithItems;
}

/* ── what makes a line a choice ───────────────────────────────────────────── */

test('a line with no options is not a choice', () => {
  assert.equal(isChoiceLine(item()), false);
  assert.equal(isChoiceLine(item({ options: [] })), false);
});

test('a line with options is a choice', () => {
  assert.equal(isChoiceLine(item({ options: [CHICKEN, BEEF] })), true);
});

/* ── resolution ───────────────────────────────────────────────────────────── */

test('picking nothing falls back to the standard option', () => {
  const line = item({ options: [CHICKEN, BEEF, SALMON] });
  assert.equal(resolveChosenOption(line, [])?.option_id, 'chicken');
});

test('picking an option uses it', () => {
  const line = item({ options: [CHICKEN, BEEF, SALMON] });
  assert.equal(resolveChosenOption(line, ['salmon'])?.option_id, 'salmon');
});

test("an id from ANOTHER line cannot be applied to this one", () => {
  // The failure this prevents: a client sends some other line's option id and
  // gets priced by it. Resolution is scoped to the line's own options.
  const line = item({ options: [CHICKEN, BEEF] });
  assert.equal(resolveChosenOption(line, ['someone-elses-option'])?.option_id, 'chicken');
});

test('a retired option is ignored, and the standard applies instead', () => {
  const retired = opt('beef', { price_delta_centavos: 8_000, is_available: false });
  const line = item({ options: [CHICKEN, retired] });
  assert.equal(resolveChosenOption(line, ['beef'])?.option_id, 'chicken');
});

test('a choice line with no available standard resolves to undefined, not to free', () => {
  // The DB enforces AT MOST one default, never AT LEAST one, so a row written
  // outside the authoring validator can land here. Callers must read this as
  // "unresolved" — treating it as ₱0 would silently give away an upgrade.
  const line = item({ options: [BEEF, SALMON] });
  assert.equal(defaultOptionFor(line), undefined);
  assert.equal(resolveChosenOption(line, []), undefined);
});

/* ── surcharge ────────────────────────────────────────────────────────────── */

test('every line on its standard adds nothing', () => {
  const pkg = pkgWith([item({ options: [CHICKEN, BEEF, SALMON] })]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], []), 0);
});

test('an upgrade adds exactly its delta', () => {
  const pkg = pkgWith([item({ options: [CHICKEN, BEEF, SALMON] })]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], ['beef']), 8_000);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], ['salmon']), 15_000);
});

test('upgrades on separate lines sum', () => {
  const cake = item({
    item_id: 'item-cake',
    canonical_service: 'cake',
    service_description: 'Cake',
    options: [
      opt('two-tier', { item_id: 'item-cake', is_default: true }),
      opt('three-tier', { item_id: 'item-cake', price_delta_centavos: 5_000 }),
    ],
  });
  const pkg = pkgWith([item({ options: [CHICKEN, BEEF] }), cake]);
  assert.equal(
    chosenOptionsSurchargeCentavos(pkg, [], ['beef', 'three-tier']),
    13_000,
  );
});

test('an upgrade on a REMOVED line is not charged', () => {
  // The failure this prevents: the host picks salmon, then drops the catering
  // line entirely, and is still billed the salmon difference.
  const pkg = pkgWith([item({ options: [CHICKEN, BEEF, SALMON] })]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, ['item-menu'], ['salmon']), 0);
});

test('an upgrade on a line that was never included is not charged', () => {
  // An add-on the package never billed for cannot be "upgraded" into the price.
  const addOn = item({ is_default_included: false, options: [CHICKEN, SALMON] });
  const pkg = pkgWith([addOn]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], ['salmon']), 0);
});

test('a REQUIRED line still charges its upgrade', () => {
  // Required means "cannot be dropped", not "cannot be upgraded" — the two are
  // separate axes, and conflating them would silently give the upgrade away.
  const required = item({ is_required: true, options: [CHICKEN, SALMON] });
  const pkg = pkgWith([required]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], ['salmon']), 15_000);
});

test('a removal id for a required line does not suppress its upgrade', () => {
  // `isRemovableItem` refuses the removal, so the line is still kept and its
  // upgrade must still be charged. Reading the raw removed list here instead
  // would let a client dodge the surcharge by sending a removal it isn't
  // allowed to make.
  const required = item({ is_required: true, options: [CHICKEN, SALMON] });
  const pkg = pkgWith([required]);
  assert.equal(
    chosenOptionsSurchargeCentavos(pkg, ['item-menu'], ['salmon']),
    15_000,
  );
});

test('plain lines contribute nothing regardless of what is sent', () => {
  const pkg = pkgWith([item()]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], ['anything']), 0);
});

test('two ids for the same line take the line’s own option, never both', () => {
  // At most one option per line can ever be in force; summing two would double
  // charge. `resolveChosenOption` returns a single row by construction.
  const pkg = pkgWith([item({ options: [CHICKEN, BEEF, SALMON] })]);
  const total = chosenOptionsSurchargeCentavos(pkg, [], ['beef', 'salmon']);
  assert.ok(
    total === 8_000 || total === 15_000,
    `expected one option's delta, got ${total}`,
  );
});

test('an unresolvable choice line adds nothing rather than throwing', () => {
  // Fail closed and visible: no default, nothing picked → no surcharge, and the
  // lock still completes. A throw here would take down the whole lock path.
  const pkg = pkgWith([item({ options: [BEEF, SALMON] })]);
  assert.equal(chosenOptionsSurchargeCentavos(pkg, [], []), 0);
});
