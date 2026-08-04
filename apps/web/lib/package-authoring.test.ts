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
  planItemInsertOrder,
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
    // Branching fields pass through UNDEFINED-as-absent rather than being
    // defaulted: `undefined` and an explicit `null` must stay distinguishable
    // in the tests that assert they read the same to `structuralChanges`.
    parentRef: over.parentRef,
    pickMin: over.pickMin,
    pickMax: over.pickMax,
    maxExtraHours: over.maxExtraHours,
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

// ---------------------------------------------------------------------------
// RECURSIVE CUSTOMIZATION — pick range
//
// Each rule below mirrors a database constraint from migration 20271012816361.
// The mirror is the point: caught here the vendor reads a sentence, caught at
// the database they get a 23514 they cannot act on.
// ---------------------------------------------------------------------------

/** A choice line with `n` options, the first one standard. */
function choiceItem(n: number, over: Partial<DraftItem> = {}): DraftItem {
  return item({
    options: Array.from({ length: n }, (_, i) =>
      opt({
        ref: `o${i}`,
        label: `Option ${i}`,
        is_default: i === 0,
        price_delta_centavos: i === 0 ? 0 : 100 * (i + 1),
      }),
    ),
    ...over,
  });
}

test('a pick range is BOTH-OR-NEITHER — half of it is not an answer', () => {
  // "At least 2, no maximum" would have to be read off the option count, which
  // lives in a different table, so a reader would have to guess.
  assert.ok(
    codes(draft({ items: [choiceItem(3, { pickMin: 2 })] })).includes(
      'choice_pick_range_invalid',
    ),
  );
  assert.ok(
    codes(draft({ items: [choiceItem(3, { pickMax: 2 })] })).includes(
      'choice_pick_range_invalid',
    ),
  );
});

test('a pick range of zero, negative, or inverted is refused', () => {
  const bad = (pickMin: number, pickMax: number) =>
    codes(draft({ items: [choiceItem(5, { pickMin, pickMax })] }));
  assert.ok(bad(0, 3).includes('choice_pick_range_invalid'), 'pick_min = 0 is is_required, not this');
  assert.ok(bad(-1, 3).includes('choice_pick_range_invalid'));
  assert.ok(bad(3, 2).includes('choice_pick_range_invalid'), 'an inverted range can never be met');
  assert.ok(bad(1.5, 3).includes('choice_pick_range_invalid'), 'you cannot pick half an option');
});

test('pick_max cannot exceed the number of options on the line', () => {
  // A line that asks for more picks than it offers leaves the couple on a
  // configurator that will never let them continue.
  const c = codes(draft({ items: [choiceItem(3, { pickMin: 1, pickMax: 4 })] }));
  assert.ok(c.includes('choice_pick_max_exceeds_options'));
  assert.ok(
    !c.includes('choice_pick_range_invalid'),
    'the range itself is well formed — only the ceiling is wrong',
  );
});

test('"choose 3 of 5" and no range at all are both valid', () => {
  assert.deepEqual(validatePackageDraft(draft({ items: [choiceItem(5, { pickMin: 3, pickMax: 3 })] })), []);
  assert.deepEqual(validatePackageDraft(draft({ items: [choiceItem(5)] })), []);
});

test('a pick range on a line with NO options is caught', () => {
  // The rule is checked for every line, not only choice lines, because
  // "choose 2" on a plain line is exactly the authoring slip it exists for.
  const c = codes(draft({ items: [item({ pickMin: 1, pickMax: 2 })] }));
  assert.ok(c.includes('choice_pick_max_exceeds_options'));
});

test('a negative extra-hour ceiling is refused; 0 and absent are fine', () => {
  assert.ok(
    codes(draft({ items: [item({ maxExtraHours: -1 })] })).includes(
      'item_max_extra_hours_invalid',
    ),
  );
  // 0 = "fixed at min_hours". A real answer, not an empty one.
  assert.deepEqual(validatePackageDraft(draft({ items: [item({ maxExtraHours: 0 })] })), []);
  assert.deepEqual(validatePackageDraft(draft({ items: [item({ maxExtraHours: 8 })] })), []);
});

// ---------------------------------------------------------------------------
// RECURSIVE CUSTOMIZATION — follow-up lines
// ---------------------------------------------------------------------------

/**
 * A parent choice line + one follow-up hanging off its second option.
 *
 * The follow-up is `is_default_included: false` because that is the ONLY legal
 * shape for one — a follow-up is conditional by definition, so it can never sit
 * inside `total_price_centavos`
 * (`vendor_package_items_followup_not_default_included_ck`). The `item()`
 * helper defaults inclusion to `true`, which is right for a normal line and
 * wrong for every follow-up, so it is overridden here rather than at each call.
 */
function branchingDraft(over: Partial<DraftItem> = {}): DraftPackage {
  return draft({
    items: [
      item({
        ref: 'main',
        options: [
          opt({ ref: 'beef', label: 'Beef caldereta', is_default: true }),
          opt({ ref: 'fish', label: 'Fish fillet', price_delta_centavos: 500 }),
        ],
      }),
      item({
        ref: 'sides',
        service_description: 'Choose your side',
        is_default_included: false,
        parentRef: { itemRef: 'main', optionRef: 'fish' },
        ...over,
      }),
    ],
  });
}

test('a well-formed follow-up is valid', () => {
  assert.deepEqual(validatePackageDraft(branchingDraft()), []);
});

/* ── A follow-up is CONDITIONAL, so it is never inside the price ───────────── */

test('a follow-up marked "included by default" is refused', () => {
  // 💰 THE MONEY. `is_default_included` puts the line inside
  // total_price_centavos, so every couple pays for it and it cascades into an
  // event_vendors row at lock — while the configurator only ever shows it to
  // the couples who picked its parent option. Mirrors
  // vendor_package_items_followup_not_default_included_ck; caught here so the
  // vendor reads a sentence instead of a 23514.
  const d = branchingDraft({ is_default_included: true });
  assert.ok(codes(d).includes('followup_cannot_be_default_included'));
});

test('a follow-up marked required is refused', () => {
  // The second door onto the same overcharge: "required" means the line cannot
  // be dropped and its value never returns to the credit pool.
  const d = branchingDraft({ is_required: true });
  assert.ok(codes(d).includes('followup_cannot_be_required'));
});

test('both follow-up money problems are reported at once, on the right row', () => {
  const problems = validatePackageDraft(
    branchingDraft({ is_default_included: true, is_required: true }),
  ).filter(
    (p) =>
      p.code === 'followup_cannot_be_default_included' ||
      p.code === 'followup_cannot_be_required',
  );
  assert.equal(problems.length, 2);
  assert.deepEqual(new Set(problems.map((p) => p.itemRef)), new Set(['sides']));
  // The message has to TEACH, not restate the column name — the vendor has to
  // understand why the two settings cannot both be true.
  for (const p of problems) assert.ok(p.message.length > 40);
});

test('a normal top-level line is still allowed to be included and required', () => {
  // Regression: the rule is scoped to follow-ups. Every shape that authors
  // today must keep authoring.
  const d = draft({ items: [item({ is_default_included: true, is_required: true })] });
  assert.deepEqual(validatePackageDraft(d), []);
});

test('a follow-up with a dangling parent is still refused for being priced', () => {
  // A parentRef that no longer resolves is a separate problem; it is not a
  // licence to charge for the line in the meantime.
  const d = branchingDraft({ is_default_included: true });
  d.items[1]!.parentRef = { itemRef: 'main', optionRef: 'ghost' };
  const c = codes(d);
  assert.ok(c.includes('followup_cannot_be_default_included'));
  assert.ok(c.includes('followup_parent_unknown'));
});

test('a follow-up pointing at an option that is not in the draft is refused', () => {
  // Silently accepting it would mean saving with a NULL parent, which PROMOTES
  // the follow-up into a line every couple sees on every booking.
  const d = branchingDraft();
  d.items[1]!.parentRef = { itemRef: 'main', optionRef: 'ghost' };
  assert.ok(codes(d).includes('followup_parent_unknown'));
});

test('a follow-up pointing at an item that is not in the draft is refused', () => {
  const d = branchingDraft();
  d.items[1]!.parentRef = { itemRef: 'ghost', optionRef: 'fish' };
  assert.ok(codes(d).includes('followup_parent_unknown'));
});

test('a parentRef whose two halves disagree is refused', () => {
  // `fish` belongs to `main`, not to `sides`. Guessing which half is right is
  // exactly the kind of silent repair that publishes the wrong line.
  const d = branchingDraft();
  d.items[1]!.options = [opt({ ref: 'own', label: 'Rice', is_default: true })];
  d.items[1]!.parentRef = { itemRef: 'sides', optionRef: 'fish' };
  assert.ok(codes(d).includes('followup_parent_unknown'));
});

test('a follow-up hanging off its own option is refused', () => {
  const d = draft({
    items: [
      item({
        ref: 'self',
        options: [
          opt({ ref: 'a', label: 'A', is_default: true }),
          opt({ ref: 'b', label: 'B', price_delta_centavos: 100 }),
        ],
        parentRef: { itemRef: 'self', optionRef: 'b' },
      }),
    ],
  });
  assert.ok(codes(d).includes('followup_cycle'));
});

test('a 2-cycle is refused, and reported on both lines', () => {
  const d = draft({
    items: [
      item({
        ref: 'a',
        options: [opt({ ref: 'ao', label: 'A', is_default: true }), opt({ ref: 'ao2', label: 'A2', price_delta_centavos: 1 })],
        parentRef: { itemRef: 'b', optionRef: 'bo' },
      }),
      item({
        ref: 'b',
        service_description: 'B line',
        options: [opt({ ref: 'bo', label: 'B', is_default: true }), opt({ ref: 'bo2', label: 'B2', price_delta_centavos: 1 })],
        parentRef: { itemRef: 'a', optionRef: 'ao' },
      }),
    ],
  });
  const cycleRefs = validatePackageDraft(d)
    .filter((p) => p.code === 'followup_cycle')
    .map((p) => p.itemRef);
  assert.deepEqual(cycleRefs.sort(), ['a', 'b']);
});

test('a deep but acyclic chain is valid — depth is the database’s call', () => {
  // The 5-level cap is enforced by the DB trigger only; the validator is about
  // shapes that can never be written at all, not about product bounds.
  const items: DraftItem[] = [];
  for (let n = 0; n < 4; n += 1) {
    items.push(
      item({
        ref: `n${n}`,
        service_description: `Level ${n}`,
        options: [
          opt({ ref: `n${n}o`, label: 'Yes', is_default: true }),
          opt({ ref: `n${n}o2`, label: 'No', price_delta_centavos: 1 }),
        ],
        // Only the root is inside the price; every level below it is a
        // follow-up, and a follow-up is never default-included.
        ...(n === 0
          ? {}
          : {
              is_default_included: false,
              parentRef: { itemRef: `n${n - 1}`, optionRef: `n${n - 1}o` },
            }),
      }),
    );
  }
  assert.deepEqual(validatePackageDraft(draft({ items })), []);
});

test('re-parenting a follow-up is structural — a booked package freezes it', () => {
  const stored = branchingDraft();
  const moved = branchingDraft();
  moved.items[1]!.parentRef = { itemRef: 'main', optionRef: 'beef' };
  assert.ok(structuralChanges(stored, moved).includes('items'));
});

test('widening a pick range or an hour cap is structural', () => {
  const withRange = (pickMax: number) =>
    draft({ items: [choiceItem(5, { pickMin: 2, pickMax })] });
  assert.ok(structuralChanges(withRange(2), withRange(4)).includes('items'));

  const withHours = (maxExtraHours: number) => draft({ items: [item({ maxExtraHours })] });
  assert.ok(structuralChanges(withHours(2), withHours(6)).includes('items'));
});

test('an absent branching field and an explicit null read the same', () => {
  // A loader that stops populating one of these must not look like a re-price.
  const absent = draft({ items: [item()] });
  const explicit = draft({
    items: [item({ parentRef: null, pickMin: null, pickMax: null, maxExtraHours: null })],
  });
  assert.deepEqual(structuralChanges(absent, explicit), []);
});

// ---------------------------------------------------------------------------
// INSERT ORDER — option ids are minted fresh on every save
// ---------------------------------------------------------------------------

const levelRefs = (plan: ReturnType<typeof planItemInsertOrder>) =>
  plan.ok ? plan.levels.map((l) => l.map((i) => i.ref)) : null;

test('a flat package is one level', () => {
  const plan = planItemInsertOrder([item({ ref: 'a' }), item({ ref: 'b' })]);
  assert.deepEqual(levelRefs(plan), [['a', 'b']]);
});

test('an empty package plans to no levels', () => {
  const plan = planItemInsertOrder([]);
  assert.deepEqual(levelRefs(plan), []);
});

test('a follow-up lands in the level AFTER its parent, whatever the array order', () => {
  // The draft deliberately lists the CHILD first — array order is not
  // dependency order, and trusting it is how a follow-up gets written before
  // the option id it points at exists.
  const plan = planItemInsertOrder(branchingDraft().items.slice().reverse());
  assert.deepEqual(levelRefs(plan), [['main'], ['sides']]);
});

test('a three-deep chain plans to three levels', () => {
  const items = [
    item({ ref: 'c', parentRef: { itemRef: 'b', optionRef: 'bo' } }),
    item({ ref: 'a', options: [opt({ ref: 'ao', label: 'A', is_default: true })] }),
    item({ ref: 'b', parentRef: { itemRef: 'a', optionRef: 'ao' }, options: [opt({ ref: 'bo', label: 'B', is_default: true })] }),
  ];
  assert.deepEqual(levelRefs(planItemInsertOrder(items)), [['a'], ['b'], ['c']]);
});

test('siblings on different parents share a level', () => {
  const items = [
    item({ ref: 'p1', options: [opt({ ref: 'p1o', label: 'X', is_default: true })] }),
    item({ ref: 'p2', options: [opt({ ref: 'p2o', label: 'Y', is_default: true })] }),
    item({ ref: 'c1', parentRef: { itemRef: 'p1', optionRef: 'p1o' } }),
    item({ ref: 'c2', parentRef: { itemRef: 'p2', optionRef: 'p2o' } }),
  ];
  assert.deepEqual(levelRefs(planItemInsertOrder(items)), [
    ['p1', 'p2'],
    ['c1', 'c2'],
  ]);
});

test('a dangling parentRef is UNRESOLVED, never demoted to a top-level line', () => {
  const plan = planItemInsertOrder([
    item({ ref: 'a', options: [opt({ ref: 'ao', label: 'A', is_default: true })] }),
    item({ ref: 'orphan', parentRef: { itemRef: 'gone', optionRef: 'gone-o' } }),
  ]);
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.ok === false ? plan.unresolvedRefs : null, ['orphan']);
});

test('a parentRef whose halves disagree is UNRESOLVED', () => {
  const plan = planItemInsertOrder([
    item({ ref: 'a', options: [opt({ ref: 'ao', label: 'A', is_default: true })] }),
    item({ ref: 'b', options: [opt({ ref: 'bo', label: 'B', is_default: true })] }),
    // `ao` belongs to `a`, not to `b`.
    item({ ref: 'c', parentRef: { itemRef: 'b', optionRef: 'ao' } }),
  ]);
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.ok === false ? plan.unresolvedRefs : null, ['c']);
});

test('a cycle is UNRESOLVED rather than looping forever', () => {
  const plan = planItemInsertOrder([
    item({ ref: 'a', parentRef: { itemRef: 'b', optionRef: 'bo' }, options: [opt({ ref: 'ao', label: 'A', is_default: true })] }),
    item({ ref: 'b', parentRef: { itemRef: 'a', optionRef: 'ao' }, options: [opt({ ref: 'bo', label: 'B', is_default: true })] }),
  ]);
  assert.equal(plan.ok, false);
  assert.deepEqual((plan.ok === false ? plan.unresolvedRefs : []).sort(), ['a', 'b']);
});

test('every item appears exactly once across the levels', () => {
  const plan = planItemInsertOrder(branchingDraft().items);
  assert.equal(plan.ok, true);
  const flat = plan.ok ? plan.levels.flatMap((l) => l.map((i) => i.ref)) : [];
  assert.equal(new Set(flat).size, flat.length, 'no item may be inserted twice');
  assert.equal(flat.length, 2);
});
