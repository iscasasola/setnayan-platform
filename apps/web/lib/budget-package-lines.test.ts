import { test } from 'node:test';
import assert from 'node:assert/strict';

import { packageBudgetLineItems } from './budget';
import type { VendorPackageItemRow } from './vendor-packages';

/**
 * The budget's package lines — the bug class the booking receipt fixed and the
 * budget missed: every `vendor_package_items` row minus `removed_item_ids`
 * listed optional ADD-ONS and unrevealed FOLLOW-UPS as costs nobody agreed to.
 */

function item(over: Partial<VendorPackageItemRow> & { item_id: string }): VendorPackageItemRow {
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
    pick_min: null,
    pick_max: null,
    max_extra_hours: null,
    extra_hour_centavos: null,
    ...over,
  } as VendorPackageItemRow;
}

const NAME = 'Casa Herrera Catering';

test('an optional ADD-ON never appears as a budget cost — nobody paid for it', () => {
  const lines = packageBudgetLineItems({
    items: [item({ item_id: 'base' }), item({ item_id: 'addon', is_default_included: false })],
    customizationsJson: { removed_item_ids: [] },
    vendorBusinessName: NAME,
  });
  assert.deepEqual(lines.map((l) => l.source_id), ['pkg:base']);
});

test('an unrevealed FOLLOW-UP never appears as a budget cost', () => {
  const lines = packageBudgetLineItems({
    items: [
      item({ item_id: 'base' }),
      // The legal DB shape: the CHECK forces every follow-up to
      // is_default_included = FALSE.
      item({ item_id: 'side', parent_option_id: 'premium', is_default_included: false }),
    ],
    customizationsJson: null,
    vendorBusinessName: NAME,
  });
  assert.deepEqual(lines.map((l) => l.source_id), ['pkg:base']);
});

test('a removed line stays out; a required line survives removal', () => {
  const lines = packageBudgetLineItems({
    items: [
      item({ item_id: 'base' }),
      item({ item_id: 'venue', is_required: true }),
      item({ item_id: 'extras' }),
    ],
    customizationsJson: { removed_item_ids: ['extras', 'venue'] },
    vendorBusinessName: NAME,
  });
  assert.deepEqual(lines.map((l) => l.source_id).sort(), ['pkg:base', 'pkg:venue']);
});

test('charged picks and extra hours appear at their FROZEN snapshot deltas', () => {
  // The persisted shape itself (what lockPackage writes), not the builder —
  // the budget reads records, and this pins the read contract directly.
  const snapshot = {
    version: 1,
    credit_model: false,
    pax_count: 0,
    options: [
      { item_id: 'side', option_id: 'truffle', label: 'Truffle mash', delta_centavos: 5_000_00 },
      { item_id: 'main', option_id: 'std', label: 'Standard', delta_centavos: 0 },
    ],
    extra_hours: [
      { item_id: 'photo', label: 'Photo coverage', hours: 2, rate_centavos: 500_00, max_extra_hours: 4 },
    ],
  };
  const lines = packageBudgetLineItems({
    items: [item({ item_id: 'base' })],
    customizationsJson: { removed_item_ids: [], pricing_snapshot: snapshot },
    vendorBusinessName: NAME,
  });
  const charges = lines.filter((l) => l.source_id.startsWith('pkgcharge:'));
  // ₱0 picks are delivery detail, not money — the budget lists charges only.
  assert.equal(charges.length, 2);
  assert.deepEqual(
    charges.map((l) => l.amount_php).sort((a, b) => a - b),
    [1_000, 5_000],
  );
  assert.ok(charges.every((l) => l.vendor_business_name === NAME));
});

test('a legacy booking with no snapshot shows base lines only — no crash, no invention', () => {
  const lines = packageBudgetLineItems({
    items: [item({ item_id: 'base' })],
    customizationsJson: { removed_item_ids: [] },
    vendorBusinessName: NAME,
  });
  assert.deepEqual(lines.map((l) => l.source_id), ['pkg:base']);
});

test('junk customizations_json degrades to base lines, never a throw', () => {
  for (const junk of [null, 42, 'x', [], { removed_item_ids: 'nope' }, { pricing_snapshot: { v: 'bad' } }]) {
    const lines = packageBudgetLineItems({
      items: [item({ item_id: 'base' })],
      customizationsJson: junk,
      vendorBusinessName: NAME,
    });
    assert.deepEqual(lines.map((l) => l.source_id), ['pkg:base']);
  }
});
