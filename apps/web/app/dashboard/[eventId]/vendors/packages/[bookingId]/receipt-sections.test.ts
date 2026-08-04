/**
 * 🧾 THE BOOKING RECEIPT MAY NOT OVERSTATE WHAT THE COUPLE BOUGHT.
 *
 * The shipped page split a package into two lists on `removed_item_ids` alone
 * and never consulted `is_default_included`, so an optional ADD-ON — a line
 * that is never inside `total_price_centavos` and is never charged — was
 * printed under "Included in this booking" with a green tick and no
 * qualifier. The local binding was named `keptItems`, shadowing the imported
 * helper of the same name; that shadow is why the receipt and the LOCK PATH
 * could disagree about what was actually bought without anyone noticing.
 *
 * This is a server component, so the RULE is what is tested, not the JSX —
 * ./receipt-sections is the pure module the page imports. The repo has no
 * pattern for rendering `[bookingId]`-style pages (the only co-located
 * `app/**` tests are pure modules: `[slug]/_lib/site-menu.test.ts`,
 * `(account)/create-event/wedding-guard.test.ts`), so this follows those.
 *
 * NEUTRALISATION: restoring the inline
 * `pkg.items.filter((i) => !removedIds.has(i.item_id))` in place of
 * `keptItems` fails "an ADD-ON is never printed as included — the whole
 * defect" and "the three lists partition every line exactly once".
 *
 * Pure module — no mocks, no env, no clock.
 * `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { receiptSections } from './receipt-sections';
import type {
  VendorPackageItemRow,
  VendorPackageWithItems,
} from '@/lib/vendor-packages';

type ItemOverrides = {
  id: string;
  included?: boolean;
  required?: boolean;
  parent?: string | null;
};

function item({
  id,
  included = true,
  required = false,
  parent = null,
}: ItemOverrides): VendorPackageItemRow {
  return {
    item_id: id,
    package_id: 'PKG',
    canonical_service: 'catering',
    service_description: `line ${id}`,
    is_default_included: included,
    is_required: required,
    replacement_value_centavos: 1_000_00,
    display_order: 0,
    created_at: '2026-07-27T00:00:00Z',
    parent_option_id: parent,
  };
}

function pkg(items: VendorPackageItemRow[]): VendorPackageWithItems {
  return {
    package_id: 'PKG',
    vendor_profile_id: 'VEN',
    package_name: 'All-in Reception',
    description: null,
    total_price_centavos: 100_000_00,
    consumable_budget_centavos: 0,
    is_consumable_flexible: false,
    primary_canonical_service: 'catering',
    is_active: true,
    created_at: '2026-07-27T00:00:00Z',
    updated_at: '2026-07-27T00:00:00Z',
    items,
  };
}

const ids = (rows: ReadonlyArray<VendorPackageItemRow>) =>
  rows.map((i) => i.item_id);

/* ────────────────────────────────────────────────────────────────────────── */
/* 1. THE DEFECT — an add-on printed as bought                                */
/* ────────────────────────────────────────────────────────────────────────── */

test('an ADD-ON is never printed as included — the whole defect', () => {
  const s = receiptSections(
    pkg([item({ id: 'base' }), item({ id: 'addon', included: false })]),
    [],
  );

  // 💰 THE RECEIPT LINE. Anything in `included` is printed under "Included in
  // this booking" — a claim that the couple paid for it. An add-on is never
  // inside `total_price_centavos`, so this must never contain one.
  assert.deepEqual(ids(s.included), ['base']);
});

test('the add-on is SHOWN, in its own section — never silently dropped', () => {
  const s = receiptSections(
    pkg([item({ id: 'base' }), item({ id: 'addon', included: false })]),
    [],
  );

  assert.deepEqual(ids(s.notIncluded), ['addon']);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 2. A required line survives a removal id                                   */
/* ────────────────────────────────────────────────────────────────────────── */

test('a REQUIRED line stays included even when its id is in removed_item_ids', () => {
  const p = pkg([
    item({ id: 'must', required: true }),
    item({ id: 'optional' }),
  ]);
  const s = receiptSections(p, ['must', 'optional']);

  // The lock path ignores a removal id on a required line and keeps charging
  // for it (`isRemovableItem`), so the receipt must keep listing it as bought.
  assert.deepEqual(ids(s.included), ['must']);
  assert.deepEqual(ids(s.removed), ['optional']);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 3. A follow-up appears in NO list                                          */
/* ────────────────────────────────────────────────────────────────────────── */

test('a FOLLOW-UP never appears in the included list or the add-on list', () => {
  // Its legal database shape: the CHECK constraint
  // vendor_package_items_followup_not_default_included_ck forces
  // is_default_included = FALSE, which is also the add-on shape — so the
  // add-on section is exactly where an unguarded filter would leak it.
  const s = receiptSections(
    pkg([
      item({ id: 'base' }),
      item({ id: 'followup', included: false, parent: 'OPT1' }),
    ]),
    [],
  );

  assert.deepEqual(ids(s.included), ['base']);
  assert.deepEqual(ids(s.notIncluded), [], 'a follow-up is not an add-on');
  assert.deepEqual(ids(s.removed), []);
});

test('an ILLEGAL in-memory follow-up claiming to be included is still dropped', () => {
  // No CHECK constraint applies to an object built in memory, and this module
  // is handed those by tests and adapters.
  const s = receiptSections(
    pkg([
      item({ id: 'base' }),
      item({ id: 'liar', included: true, required: true, parent: 'OPT1' }),
    ]),
    ['liar'],
  );

  assert.deepEqual(ids(s.included), ['base']);
  assert.deepEqual(ids(s.notIncluded), []);
  assert.deepEqual(ids(s.removed), []);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 4. THE DOUBLE-LISTING RULING — notIncluded WINS over removed               */
/* ────────────────────────────────────────────────────────────────────────── */

test('an add-on carrying a removal id is listed ONCE, as not-included', () => {
  const s = receiptSections(
    pkg([item({ id: 'base' }), item({ id: 'addon', included: false })]),
    ['addon'],
  );

  // "Removed" asserts the line WAS part of the booking and then came out, and
  // implies a refund. The lock path ignored this removal id entirely
  // (`isRemovableItem` is false for a not-included line), so no money moved
  // and nothing was ever charged. Printing it as removed is the same
  // overstatement in reverse.
  assert.deepEqual(ids(s.notIncluded), ['addon']);
  assert.deepEqual(ids(s.removed), [], 'never double-listed under Removed');
  assert.deepEqual(ids(s.included), ['base']);
});

test('a REQUIRED line carrying a removal id is listed ONCE, as included', () => {
  const s = receiptSections(pkg([item({ id: 'must', required: true })]), [
    'must',
  ]);

  assert.deepEqual(ids(s.included), ['must']);
  assert.deepEqual(ids(s.removed), []);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 5. The partition is exhaustive and mutually exclusive                      */
/* ────────────────────────────────────────────────────────────────────────── */

test('the three lists partition every line exactly once', () => {
  const lines = [
    item({ id: 'kept' }),
    item({ id: 'must', required: true }),
    item({ id: 'must-removed', required: true }),
    item({ id: 'dropped' }),
    item({ id: 'addon', included: false }),
    item({ id: 'addon-removed', included: false }),
  ];
  const s = receiptSections(pkg(lines), [
    'dropped',
    'must-removed',
    'addon-removed',
  ]);

  const printed = [...ids(s.included), ...ids(s.notIncluded), ...ids(s.removed)];
  assert.equal(
    new Set(printed).size,
    printed.length,
    'no line is printed in two sections',
  );
  assert.deepEqual(
    [...printed].sort(),
    lines.map((i) => i.item_id).sort(),
    'every line is printed in exactly one section',
  );

  assert.deepEqual(ids(s.included), ['kept', 'must', 'must-removed']);
  assert.deepEqual(ids(s.notIncluded), ['addon', 'addon-removed']);
  assert.deepEqual(ids(s.removed), ['dropped']);
});

test('a follow-up is the ONLY line the partition drops', () => {
  const lines = [item({ id: 'base' }), item({ id: 'fu', included: false, parent: 'OPT1' })];
  const s = receiptSections(pkg(lines), []);

  const printed = [...ids(s.included), ...ids(s.notIncluded), ...ids(s.removed)];
  assert.deepEqual(printed, ['base']);
});
