/**
 * PACKAGE AUTHORING VALIDATOR — unit suite.
 *
 * Every rule here is CROSS-ROW: the single-row rules are CHECK constraints in
 * migration 20271006413374 and are deliberately not duplicated. The suite is
 * organised by the invariant, and each test names the failure it prevents.
 *
 * Pure module: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  validatePackageDraft,
  isPackageDraftValid,
  editScopeForPackage,
  structuralChanges,
  isEditAllowed,
  type DraftPackage,
  type DraftItem,
  type DraftOption,
} from './package-authoring';

function opt(over: Partial<DraftOption> = {}): DraftOption {
  return {
    ref: over.ref ?? 'o1',
    label: over.label ?? 'Chicken teriyaki',
    price_delta_centavos: over.price_delta_centavos ?? 0,
    is_default: over.is_default ?? false,
    is_available: over.is_available ?? true,
  };
}

function item(over: Partial<DraftItem> = {}): DraftItem {
  return {
    ref: over.ref ?? 'i1',
    service_description: over.service_description ?? 'Buffet for 140',
    canonical_service: over.canonical_service ?? 'catering',
    is_default_included: over.is_default_included ?? true,
    is_required: over.is_required ?? false,
    replacement_value_centavos: over.replacement_value_centavos ?? 5_000_00,
    options: over.options ?? [],
  };
}

/** A valid baseline — every test mutates one thing off this. */
function draft(over: Partial<DraftPackage> = {}): DraftPackage {
  return {
    package_name: over.package_name ?? 'Complete Wedding Catering',
    total_price_centavos: over.total_price_centavos ?? 10_000_00,
    consumable_budget_centavos: over.consumable_budget_centavos ?? 0,
    is_consumable_flexible: over.is_consumable_flexible ?? false,
    items: over.items ?? [item()],
  };
}

const codes = (d: DraftPackage) => validatePackageDraft(d).map((p) => p.code);

test('the baseline draft is valid', () => {
  assert.deepEqual(validatePackageDraft(draft()), []);
  assert.equal(isPackageDraftValid(draft()), true);
});

// ---------------------------------------------------------------------------
// Package shape
// ---------------------------------------------------------------------------

test('a package needs a name and at least one inclusion', () => {
  const c = codes(draft({ package_name: '   ', items: [] }));
  assert.ok(c.includes('package_name_empty'));
  assert.ok(c.includes('package_no_items'));
});

test('a package priced at zero is refused', () => {
  // Owner-locked: "there should never be an option to have a service at 0."
  assert.ok(codes(draft({ total_price_centavos: 0 })).includes('package_price_not_positive'));
  assert.ok(codes(draft({ total_price_centavos: -1 })).includes('package_price_not_positive'));
});

test('a non-integer price is refused — centavos are whole numbers', () => {
  assert.ok(
    codes(draft({ total_price_centavos: 1000.5 })).includes('package_price_not_positive'),
  );
});

test('the package price cannot sit below the lines the couple cannot drop', () => {
  // Otherwise the credit engine could refund more than the package ever cost.
  const c = codes(
    draft({
      total_price_centavos: 1_000_00,
      items: [item({ is_required: true, replacement_value_centavos: 5_000_00 })],
    }),
  );
  assert.ok(c.includes('package_price_below_required'));
});

test('optional lines do NOT raise the required floor', () => {
  const c = codes(
    draft({
      total_price_centavos: 1_000_00,
      items: [item({ is_required: false, replacement_value_centavos: 5_000_00 })],
    }),
  );
  assert.ok(!c.includes('package_price_below_required'));
});

test('the spendable budget cannot exceed the package price', () => {
  assert.ok(
    codes(
      draft({ total_price_centavos: 5_000_00, consumable_budget_centavos: 5_000_01 }),
    ).includes('consumable_exceeds_total'),
  );
});

test('a flexible package with no budget is refused', () => {
  // "Flexible" redirects freed money into the pool. With no pool, the couple is
  // told they have credit that buys nothing.
  assert.ok(
    codes(draft({ is_consumable_flexible: true, consumable_budget_centavos: 0 })).includes(
      'consumable_without_flex_or_budget',
    ),
  );
});

test('a flexible package WITH a budget is fine', () => {
  assert.deepEqual(
    validatePackageDraft(
      draft({ is_consumable_flexible: true, consumable_budget_centavos: 2_000_00 }),
    ),
    [],
  );
});

// ---------------------------------------------------------------------------
// Item shape
// ---------------------------------------------------------------------------

test('an inclusion needs a description', () => {
  assert.ok(
    codes(draft({ items: [item({ service_description: '  ' })] })).includes(
      'item_description_empty',
    ),
  );
});

test('a negative inclusion value is refused', () => {
  assert.ok(
    codes(draft({ items: [item({ replacement_value_centavos: -1 })] })).includes(
      'item_value_negative',
    ),
  );
});

test('a zero-value inclusion is allowed — complimentary lines are real', () => {
  const c = codes(draft({ items: [item({ replacement_value_centavos: 0 })] }));
  assert.ok(!c.includes('item_value_negative'));
});

// ---------------------------------------------------------------------------
// Choice lines — the cross-row rules a CHECK cannot see
// ---------------------------------------------------------------------------

test('a choice with one option is not a choice', () => {
  assert.ok(
    codes(
      draft({ items: [item({ options: [opt({ is_default: true })] })] }),
    ).includes('choice_needs_two_options'),
  );
});

test('a choice needs exactly one standard option — zero is refused', () => {
  const c = codes(
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Chicken' }),
            opt({ ref: 'b', label: 'Beef', price_delta_centavos: 8_000_00 }),
          ],
        }),
      ],
    }),
  );
  assert.ok(c.includes('choice_needs_exactly_one_default'));
});

test('a choice needs exactly one standard option — two is refused', () => {
  // Two baselines make the package price ambiguous; the credit engine would
  // pick one arbitrarily.
  const c = codes(
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Chicken', is_default: true }),
            opt({ ref: 'b', label: 'Pork', is_default: true }),
          ],
        }),
      ],
    }),
  );
  assert.ok(c.includes('choice_needs_exactly_one_default'));
});

test('a well-formed choice line passes', () => {
  assert.deepEqual(
    validatePackageDraft(
      draft({
        items: [
          item({
            options: [
              opt({ ref: 'a', label: 'Chicken teriyaki', is_default: true }),
              opt({ ref: 'b', label: 'Beef caldereta', price_delta_centavos: 8_000_00 }),
              opt({ ref: 'c', label: 'Lechon belly', price_delta_centavos: 15_000_00 }),
            ],
          }),
        ],
      }),
    ),
    [],
  );
});

test('the standard option cannot be unavailable', () => {
  const c = codes(
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Chicken', is_default: true, is_available: false }),
            opt({ ref: 'b', label: 'Beef', price_delta_centavos: 100 }),
          ],
        }),
      ],
    }),
  );
  assert.ok(c.includes('choice_default_unavailable'));
});

test('a choice where everything is sold out is refused', () => {
  const c = codes(
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Chicken', is_available: false }),
            opt({ ref: 'b', label: 'Beef', is_available: false, price_delta_centavos: 100 }),
          ],
        }),
      ],
    }),
  );
  assert.ok(c.includes('choice_all_options_unavailable'));
});

test('two options with the same label are refused, case- and space-insensitively', () => {
  const c = codes(
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Beef caldereta', is_default: true }),
            opt({ ref: 'b', label: '  BEEF CALDERETA ', price_delta_centavos: 500 }),
          ],
        }),
      ],
    }),
  );
  assert.ok(c.includes('choice_option_label_duplicated'));
});

// ---------------------------------------------------------------------------
// Reporting behaviour
// ---------------------------------------------------------------------------

test('every problem is returned at once, not just the first', () => {
  const problems = validatePackageDraft(
    draft({
      package_name: '',
      total_price_centavos: 0,
      items: [item({ service_description: '', options: [opt({ label: 'only' })] })],
    }),
  );
  assert.ok(problems.length >= 4, `expected several problems, got ${problems.length}`);
});

test('item problems carry the ref so the form can highlight the right row', () => {
  const problems = validatePackageDraft(
    draft({ items: [item({ ref: 'row-7', service_description: '' })] }),
  );
  const p = problems.find((x) => x.code === 'item_description_empty');
  assert.equal(p?.itemRef, 'row-7');
});

test('option problems carry both refs', () => {
  const problems = validatePackageDraft(
    draft({
      items: [
        item({
          ref: 'row-1',
          options: [
            opt({ ref: 'opt-9', label: 'X', is_default: true, is_available: false }),
            opt({ ref: 'opt-2', label: 'Y', price_delta_centavos: 100 }),
          ],
        }),
      ],
    }),
  );
  const p = problems.find((x) => x.code === 'choice_default_unavailable');
  assert.equal(p?.itemRef, 'row-1');
  assert.equal(p?.optionRef, 'opt-9');
});

// ---------------------------------------------------------------------------
// Edit scope — a booked package is a contract
// ---------------------------------------------------------------------------

test('a package with no bookings is fully editable', () => {
  assert.equal(editScopeForPackage(0), 'full');
});

test('one booking freezes the package to metadata only', () => {
  assert.equal(editScopeForPackage(1), 'metadata_only');
  assert.equal(editScopeForPackage(47), 'metadata_only');
});

test('renaming a booked package is allowed', () => {
  const stored = draft();
  const renamed = draft({ package_name: 'Complete Wedding Catering (2027)' });
  assert.deepEqual(structuralChanges(stored, renamed), []);
  assert.equal(isEditAllowed('metadata_only', stored, renamed), true);
});

test('re-pricing a booked package is refused', () => {
  const stored = draft();
  const repriced = draft({ total_price_centavos: 12_000_00 });
  assert.deepEqual(structuralChanges(stored, repriced), ['total_price_centavos']);
  assert.equal(isEditAllowed('metadata_only', stored, repriced), false);
});

test('adding or removing an inclusion is structural', () => {
  const stored = draft();
  const added = draft({ items: [item(), item({ ref: 'i2', service_description: 'Cake' })] });
  assert.ok(structuralChanges(stored, added).includes('items'));

  const removed = draft({ items: [] });
  assert.ok(structuralChanges(stored, removed).includes('items'));
});

test('flipping an inclusion to required is structural', () => {
  const stored = draft();
  const nowRequired = draft({ items: [item({ is_required: true })] });
  assert.ok(structuralChanges(stored, nowRequired).includes('items'));
});

test('re-pricing a choice option is structural', () => {
  const base = (delta: number) =>
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Chicken', is_default: true }),
            opt({ ref: 'b', label: 'Beef', price_delta_centavos: delta }),
          ],
        }),
      ],
    });
  assert.ok(structuralChanges(base(8_000_00), base(9_500_00)).includes('items'));
});

test('marking a choice option sold out is structural — it changes what is sellable', () => {
  const avail = (is_available: boolean) =>
    draft({
      items: [
        item({
          options: [
            opt({ ref: 'a', label: 'Chicken', is_default: true }),
            opt({ ref: 'b', label: 'Beef', price_delta_centavos: 100, is_available }),
          ],
        }),
      ],
    });
  assert.ok(structuralChanges(avail(true), avail(false)).includes('items'));
});

test('item and option order does not count as a change', () => {
  const a = draft({
    items: [
      item({ ref: 'i1' }),
      item({ ref: 'i2', service_description: 'Cake', options: [
        opt({ ref: 'x', label: 'Vanilla', is_default: true }),
        opt({ ref: 'y', label: 'Choco', price_delta_centavos: 500 }),
      ] }),
    ],
  });
  const b = draft({
    items: [
      item({ ref: 'i2', service_description: 'Cake', options: [
        opt({ ref: 'y', label: 'Choco', price_delta_centavos: 500 }),
        opt({ ref: 'x', label: 'Vanilla', is_default: true }),
      ] }),
      item({ ref: 'i1' }),
    ],
  });
  assert.deepEqual(structuralChanges(a, b), []);
});

test('an unbooked package accepts a structural edit', () => {
  assert.equal(isEditAllowed('full', draft(), draft({ total_price_centavos: 1 })), true);
});
