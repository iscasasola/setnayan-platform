/**
 * PACKAGE CUSTOMIZATION — the two defects that shipped, pinned.
 *
 * Both bugs were unreachable in production only because zero packages have ever
 * been authored. They fire on the first one, so they are pinned here rather
 * than left to the authoring PR.
 *
 *   1. 💰 A line with `is_default_included = false` is an ADD-ON: its value was
 *      never inside `total_price_centavos`. The pre-fix `computeCustomization`
 *      summed it anyway, so "removing" an add-on refunded money the vendor had
 *      never charged. The lock modal made this reachable by rendering every
 *      item PRE-TICKED while the public card listed only the default-included
 *      ones — the two surfaces disagreed about what the package contained.
 *
 *   2. 🔒 `is_required` (owner-locked 2026-07-26: "the vendor can place required
 *      so this is something they have to pick and cannot be unpicked") was
 *      neither SELECTed by `lockPackage` nor honoured here, so a host could
 *      drop a mandatory line and be refunded for it.
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCustomization,
  isRemovableItem,
  keptItems,
  type VendorPackageWithItems,
} from './vendor-packages';

type ItemOverrides = {
  id: string;
  value: number;
  included?: boolean;
  required?: boolean;
};

function item({ id, value, included = true, required = false }: ItemOverrides) {
  return {
    item_id: id,
    package_id: 'PKG',
    canonical_service: 'catering',
    service_description: `line ${id}`,
    is_default_included: included,
    is_required: required,
    replacement_value_centavos: value,
    display_order: 0,
    created_at: '2026-07-26T00:00:00Z',
  };
}

/** Package priced at ₱100,000 with a ₱0 consumable pool unless overridden. */
function pkg(
  items: ReturnType<typeof item>[],
  over: Partial<VendorPackageWithItems> = {},
): VendorPackageWithItems {
  return {
    package_id: 'PKG',
    vendor_profile_id: 'V',
    package_name: 'Test package',
    total_price_centavos: 10_000_000,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    is_active: true,
    items,
    ...over,
  } as VendorPackageWithItems;
}

// ---------------------------------------------------------------------------
// 1. The add-on refund bug
// ---------------------------------------------------------------------------

test('an add-on (not default-included) refunds NOTHING when removed', () => {
  const addOn = item({ id: 'addon', value: 2_500_00, included: false });
  const p = pkg([item({ id: 'base', value: 5_000_00 }), addOn]);

  const { removedTotalCentavos, totalLockedCentavos } = computeCustomization(p, [
    'addon',
  ]);

  // Pre-fix this returned 250000 and knocked it off the package price.
  assert.equal(removedTotalCentavos, 0);
  assert.equal(totalLockedCentavos, p.total_price_centavos);
});

test('a flexible package does not grow its pool from an add-on either', () => {
  const p = pkg([item({ id: 'addon', value: 2_500_00, included: false })], {
    is_consumable_flexible: true,
    consumable_budget_centavos: 1_000_00,
  });

  const { remainingConsumableCentavos } = computeCustomization(p, ['addon']);
  assert.equal(remainingConsumableCentavos, 1_000_00);
});

test('a genuine included line still refunds normally', () => {
  const p = pkg([item({ id: 'base', value: 5_000_00 })]);
  const { removedTotalCentavos, totalLockedCentavos } = computeCustomization(p, [
    'base',
  ]);
  assert.equal(removedTotalCentavos, 5_000_00);
  assert.equal(totalLockedCentavos, 10_000_000 - 5_000_00);
});

// ---------------------------------------------------------------------------
// 2. The required-line bug
// ---------------------------------------------------------------------------

test('a required line cannot be dropped, and refunds nothing if attempted', () => {
  const p = pkg([item({ id: 'must', value: 3_000_00, required: true })]);

  const { removedTotalCentavos, totalLockedCentavos } = computeCustomization(p, [
    'must',
  ]);
  assert.equal(removedTotalCentavos, 0);
  assert.equal(totalLockedCentavos, p.total_price_centavos);
});

test('a required line survives into keptItems even when the client sent its id', () => {
  const p = pkg([
    item({ id: 'must', value: 3_000_00, required: true }),
    item({ id: 'optional', value: 1_000_00 }),
  ]);

  const kept = keptItems(p, ['must', 'optional']).map((i) => i.item_id);
  assert.deepEqual(kept, ['must']);
});

test('an add-on never cascades into a booking — there is no purchase path for it', () => {
  const p = pkg([
    item({ id: 'base', value: 5_000_00 }),
    item({ id: 'addon', value: 2_500_00, included: false }),
  ]);

  // Nothing removed, yet the add-on must not become an event_vendors row.
  assert.deepEqual(
    keptItems(p, []).map((i) => i.item_id),
    ['base'],
  );
});

// ---------------------------------------------------------------------------
// 3. The predicate itself — the two axes are independent
// ---------------------------------------------------------------------------

test('isRemovableItem: only an included, non-required line is removable', () => {
  assert.equal(isRemovableItem(item({ id: 'a', value: 1 })), true);
  assert.equal(
    isRemovableItem(item({ id: 'b', value: 1, required: true })),
    false,
  );
  assert.equal(
    isRemovableItem(item({ id: 'c', value: 1, included: false })),
    false,
  );
  assert.equal(
    isRemovableItem(item({ id: 'd', value: 1, included: false, required: true })),
    false,
  );
});

test('a missing is_required (older SELECT) does not make a line required', () => {
  const legacy = { ...item({ id: 'legacy', value: 1_000_00 }) } as Record<
    string,
    unknown
  >;
  delete legacy.is_required;
  assert.equal(
    isRemovableItem(legacy as unknown as ReturnType<typeof item>),
    true,
  );
});

// ---------------------------------------------------------------------------
// 4. Unknown ids stay harmless
// ---------------------------------------------------------------------------

test('an id that matches no item is ignored rather than throwing', () => {
  const p = pkg([item({ id: 'base', value: 5_000_00 })]);
  const { removedTotalCentavos } = computeCustomization(p, ['ghost']);
  assert.equal(removedTotalCentavos, 0);
});
