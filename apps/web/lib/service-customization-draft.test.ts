/**
 * ★ CUSTOMIZATION STEP — unit suite for the wire format, the line-state
 * machine, and the amount-only money field.
 *
 * Each test names the failure it prevents. The four that matter most:
 *
 *   • FLAG-OFF IS BYTE-IDENTICAL — the step must not exist when the flag is
 *     off, or a dark feature has changed a live wizard.
 *   • ROUND-TRIP — the wizard posts ONE JSON field, so if serialise→parse
 *     loses a follow-up's parentRef or a pick range, the vendor's structure is
 *     silently flattened at the moment of saving.
 *   • MALFORMED NEVER THROWS AND NEVER WRITES — the parse runs inside a server
 *     action whose only failure mode is a redirect.
 *   • A FOLLOW-UP CANNOT BE REQUIRED OR INCLUDED — money rule, mirrored from
 *     vendor_package_items_followup_not_default_included_ck.
 *
 * Pure module: `pnpm --filter @setnayan/web test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AMOUNT_PREFIX,
  CUSTOMIZATION_DRAFT_VERSION,
  CUSTOMIZATION_FIELD_NAME,
  INCLUDED_PLACEHOLDER,
  LINE_GROUP_ORDER,
  MAX_CUSTOMIZATION_ITEMS,
  allowedLineStates,
  applyLineState,
  autoNameDraftItems,
  autoNamePlaceholder,
  canonicalServiceForVendorCategory,
  countAutoNamed,
  followUpLineage,
  formatAmountInput,
  groupThousands,
  isFollowUp,
  lineGroupOf,
  lineStateOf,
  newFollowUpLine,
  newLine,
  parseAmountInput,
  parseCustomizationDraft,
  refsToRemoveWith,
  rendersAsIncluded,
  serializeCustomizationDraft,
  serviceWizardSteps,
  toPackageDraft,
} from './service-customization-draft';
import { validatePackageDraft, type DraftItem } from './package-authoring';

/* ────────────────────────────────────────────────────────────────────────── */
/* Fixtures                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function line(over: Partial<DraftItem> = {}): DraftItem {
  return {
    ref: over.ref ?? 'i1',
    service_description: over.service_description ?? 'Buffet for 140',
    canonical_service: over.canonical_service ?? 'catering',
    is_default_included: over.is_default_included ?? true,
    is_required: over.is_required ?? false,
    replacement_value_centavos: over.replacement_value_centavos ?? 0,
    options: over.options ?? [],
    parentRef: over.parentRef ?? null,
    pickMin: over.pickMin ?? null,
    pickMax: over.pickMax ?? null,
    maxExtraHours: over.maxExtraHours ?? null,
  };
}

/**
 * The reference draft the round-trip test pins: a CHOICE, a PICK-3, a QUANTITY
 * with a cap, and a TWO-LEVEL follow-up chain. Everything the step can author.
 */
function referenceDraft(): DraftItem[] {
  const mains = line({
    ref: 'i-main',
    service_description: 'Main course',
    is_default_included: true,
    pickMin: 1,
    pickMax: 3,
    options: [
      { ref: 'o-chicken', label: 'Chicken teriyaki', price_delta_centavos: 0, is_default: true, is_available: true },
      { ref: 'o-beef', label: 'Beef caldereta', price_delta_centavos: 8_000_00, is_default: false, is_available: true },
      { ref: 'o-lechon', label: 'Lechon belly', price_delta_centavos: 15_000_00, is_default: false, is_available: true },
      { ref: 'o-fish', label: 'Baked fish', price_delta_centavos: 4_000_00, is_default: false, is_available: false },
    ],
  });
  // Level 1 — follows "Lechon belly" on Main course, and is itself a choice.
  const lechonCut = line({
    ref: 'i-cut',
    service_description: 'Which cut?',
    is_default_included: false,
    parentRef: { itemRef: 'i-main', optionRef: 'o-lechon' },
    options: [
      { ref: 'o-belly', label: 'Belly only', price_delta_centavos: 0, is_default: true, is_available: true },
      { ref: 'o-whole', label: 'Whole lechon', price_delta_centavos: 12_000_00, is_default: false, is_available: true },
    ],
  });
  // Level 2 — follows an option on the level-1 line.
  const carving = line({
    ref: 'i-carve',
    service_description: 'Carving station',
    is_default_included: false,
    replacement_value_centavos: 3_500_00,
    parentRef: { itemRef: 'i-cut', optionRef: 'o-whole' },
  });
  const extraHours = line({
    ref: 'i-hours',
    service_description: 'Extra service hours',
    is_default_included: false,
    replacement_value_centavos: 2_500_00,
    maxExtraHours: 4,
  });
  const alwaysOn = line({
    ref: 'i-crew',
    service_description: 'Full waiting crew',
    is_required: true,
    is_default_included: true,
    replacement_value_centavos: 6_000_00,
  });
  return [mains, lechonCut, carving, extraHours, alwaysOn];
}

/* ────────────────────────────────────────────────────────────────────────── */
/* 1 · FLAG-OFF IS BYTE-IDENTICAL                                             */
/* ────────────────────────────────────────────────────────────────────────── */

test('flag OFF: the wizard has exactly the steps it has today — no ★ Customization', () => {
  const noLinks = serviceWizardSteps({ hasOtherCategories: false, customizationEnabled: false });
  assert.deepEqual(
    noLinks.map((s) => s.id),
    ['what', 'price', 'perk', 'extras', 'review'],
  );
  assert.equal(noLinks.length, 5);

  const withLinks = serviceWizardSteps({ hasOtherCategories: true, customizationEnabled: false });
  assert.deepEqual(
    withLinks.map((s) => s.id),
    ['what', 'price', 'perk', 'extras', 'links', 'review'],
  );
  assert.equal(withLinks.length, 6);
  assert.ok(!withLinks.some((s) => s.id === 'custom'));
});

test('flag ON: ★ Customization lands AFTER Value & media and BEFORE Comes with / Review', () => {
  const withLinks = serviceWizardSteps({ hasOtherCategories: true, customizationEnabled: true });
  assert.deepEqual(
    withLinks.map((s) => s.id),
    ['what', 'price', 'perk', 'extras', 'custom', 'links', 'review'],
  );
  assert.equal(withLinks.length, 7);

  const noLinks = serviceWizardSteps({ hasOtherCategories: false, customizationEnabled: true });
  assert.deepEqual(
    noLinks.map((s) => s.id),
    ['what', 'price', 'perk', 'extras', 'custom', 'review'],
  );
  // The step count is exactly one more than flag-off, in both shapes.
  assert.equal(
    noLinks.length,
    serviceWizardSteps({ hasOtherCategories: false, customizationEnabled: false }).length + 1,
  );
});

test('the field the step contributes is stable and singular', () => {
  assert.equal(CUSTOMIZATION_FIELD_NAME, 'customization_draft');
  // An empty draft contributes an EMPTY string, which the parser reads as
  // "nothing authored" — so a vendor who never opens the step posts nothing
  // meaningful and no package is ever created for them.
  assert.equal(serializeCustomizationDraft([]), '');
  assert.deepEqual(parseCustomizationDraft(''), { ok: true, items: [] });
  assert.deepEqual(parseCustomizationDraft(null), { ok: true, items: [] });
  assert.deepEqual(parseCustomizationDraft(undefined), { ok: true, items: [] });
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 2 · SERIALISE → PARSE ROUND-TRIP                                           */
/* ────────────────────────────────────────────────────────────────────────── */

test('round-trip: choice + pick-3 + capped quantity + two-level follow-up survive intact', () => {
  const before = referenceDraft();
  const wire = serializeCustomizationDraft(before);
  const parsed = parseCustomizationDraft(wire);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.items, before);

  // Spot-check the three shapes by name, so a future refactor that flattens one
  // of them fails on a sentence rather than on an opaque deep-equal diff.
  const main = parsed.items.find((i) => i.ref === 'i-main')!;
  assert.equal(main.pickMin, 1);
  assert.equal(main.pickMax, 3);
  assert.equal(main.options.length, 4);
  assert.equal(main.options.filter((o) => o.is_default).length, 1);

  const hours = parsed.items.find((i) => i.ref === 'i-hours')!;
  assert.equal(hours.maxExtraHours, 4);
  assert.equal(hours.replacement_value_centavos, 2_500_00);

  const cut = parsed.items.find((i) => i.ref === 'i-cut')!;
  assert.deepEqual(cut.parentRef, { itemRef: 'i-main', optionRef: 'o-lechon' });
  const carve = parsed.items.find((i) => i.ref === 'i-carve')!;
  assert.deepEqual(carve.parentRef, { itemRef: 'i-cut', optionRef: 'o-whole' });
});

test('round-trip: the reference draft is ACCEPTED by the shipped validator', () => {
  // Round-tripping a shape the validator would refuse proves nothing — the
  // save would still bounce. Assert the draft is genuinely writable.
  const draft = toPackageDraft(referenceDraft(), {
    packageName: 'Full Wedding Catering',
    totalPriceCentavos: 250_000_00,
  });
  assert.deepEqual(validatePackageDraft(draft), []);
});

test('round-trip is IDEMPOTENT — re-serialising the parsed draft gives the same wire', () => {
  const wire = serializeCustomizationDraft(referenceDraft());
  const parsed = parseCustomizationDraft(wire);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(serializeCustomizationDraft(parsed.items), wire);
});

test('round-trip normalises undefined and null branching fields to the same wire', () => {
  const withUndefined: DraftItem = {
    ref: 'i1',
    service_description: 'Cake',
    canonical_service: 'catering',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options: [],
    // parentRef / pickMin / pickMax / maxExtraHours all ABSENT.
  };
  const withNull = line({ ref: 'i1', service_description: 'Cake' });
  assert.equal(
    serializeCustomizationDraft([withUndefined]),
    serializeCustomizationDraft([withNull]),
  );
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 3 · MALFORMED NEVER THROWS, NEVER WRITES                                   */
/* ────────────────────────────────────────────────────────────────────────── */

test('malformed payload → a readable problem, no throw, nothing to write', () => {
  const cases: Array<[string, unknown]> = [
    ['not JSON at all', '{oops'],
    ['a bare array', '[]'],
    ['a JSON string', '"hello"'],
    ['a JSON number', '42'],
    ['wrong version', JSON.stringify({ v: 999, items: [] })],
    ['items missing', JSON.stringify({ v: CUSTOMIZATION_DRAFT_VERSION })],
    ['items not a list', JSON.stringify({ v: CUSTOMIZATION_DRAFT_VERSION, items: {} })],
    ['a line that is not an object', JSON.stringify({ v: 1, items: [7] })],
    ['a line with no ref', JSON.stringify({ v: 1, items: [{ service_description: 'x' }] })],
    ['a negative amount', JSON.stringify({ v: 1, items: [{ ...line(), replacement_value_centavos: -1 }] })],
    ['a fractional amount', JSON.stringify({ v: 1, items: [{ ...line(), replacement_value_centavos: 1.5 }] })],
    ['a non-boolean flag', JSON.stringify({ v: 1, items: [{ ...line(), is_required: 'yes' }] })],
    ['options not a list', JSON.stringify({ v: 1, items: [{ ...line(), options: 'two' }] })],
    ['a half-written parentRef', JSON.stringify({ v: 1, items: [{ ...line(), parentRef: { itemRef: 'i1' } }] })],
    ['a fractional pick bound', JSON.stringify({ v: 1, items: [{ ...line(), pickMin: 1.5, pickMax: 2 }] })],
    ['not a string at all', 12345],
    ['a File-like object', { name: 'x' }],
  ];

  for (const [label, raw] of cases) {
    // The whole point: this call is TOTAL. If it throws, the server action 500s.
    const res = parseCustomizationDraft(raw);
    assert.equal(res.ok, false, `${label} should be refused`);
    if (res.ok) continue;
    assert.equal(typeof res.message, 'string');
    assert.ok(res.message.length > 10, `${label} needs a readable sentence`);
    // A readable sentence, not a code or a stack trace.
    assert.ok(!/undefined|\[object|Error:|at .*\.ts:/.test(res.message), `${label}: ${res.message}`);
    // NOTHING is handed back to write on the failure branch.
    assert.ok(!('items' in res));
  }
});

test('malformed never degrades into an empty structure that would be SAVED', () => {
  // The destructive shape: a broken payload read as "no lines" would look
  // identical to "the vendor authored nothing", and the caller writes no
  // package for the latter. These must be DIFFERENT outcomes.
  const broken = parseCustomizationDraft('{not json');
  const absent = parseCustomizationDraft('');
  assert.equal(broken.ok, false);
  assert.equal(absent.ok, true);
  if (absent.ok) assert.deepEqual(absent.items, []);
});

test('duplicate refs are refused — they would hide a line from the parent/cycle guards', () => {
  const dupItem = JSON.stringify({
    v: 1,
    items: [line({ ref: 'same' }), line({ ref: 'same', service_description: 'Other' })],
  });
  assert.equal(parseCustomizationDraft(dupItem).ok, false);

  const dupOption = JSON.stringify({
    v: 1,
    items: [
      line({
        ref: 'a',
        options: [
          { ref: 'o', label: 'A', price_delta_centavos: 0, is_default: true, is_available: true },
          { ref: 'o', label: 'B', price_delta_centavos: 100, is_default: false, is_available: true },
        ],
      }),
    ],
  });
  assert.equal(parseCustomizationDraft(dupOption).ok, false);
});

test('an oversized payload is refused rather than turned into unbounded INSERTs', () => {
  const many = Array.from({ length: MAX_CUSTOMIZATION_ITEMS + 1 }, (_, i) =>
    line({ ref: `i${i}` }),
  );
  const res = parseCustomizationDraft(JSON.stringify({ v: 1, items: many }));
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.message, new RegExp(String(MAX_CUSTOMIZATION_ITEMS)));
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 4 · AMOUNT ONLY — "included" IS NEVER TYPED (owner-locked)                 */
/* ────────────────────────────────────────────────────────────────────────── */

test('amount-only: 0 and blank both render as a BLANK (owner 2026-07-28 — never the word "included")', () => {
  // The VALUE is empty…
  assert.equal(formatAmountInput(0), '');
  assert.equal(parseAmountInput(''), 0);
  assert.equal(formatAmountInput(parseAmountInput('')), '');
  // …and the PLACEHOLDER is empty too: "included" implied the thing came
  // whether they picked it or not, so a ₱0 option now shows nothing at all.
  assert.equal(INCLUDED_PLACEHOLDER, '');
  assert.equal(rendersAsIncluded(0), true);
  assert.equal(rendersAsIncluded(parseAmountInput('')), true);
  assert.equal(rendersAsIncluded(1), false);

  // And typing the word produces a ZERO — i.e. "included" — not a stray number.
  assert.equal(parseAmountInput('included'), 0);
  assert.equal(rendersAsIncluded(parseAmountInput('included')), true);
});

test('amount-only: a typed 80000 displays grouped as 80,000', () => {
  assert.equal(groupThousands('80000'), '80,000');
  const centavos = parseAmountInput('80000');
  assert.equal(centavos, 8_000_000); // ₱80,000 in centavos
  assert.equal(formatAmountInput(centavos), '80,000');

  // Live grouping as the vendor types, keystroke by keystroke.
  assert.deepEqual(
    ['8', '80', '800', '8000', '80000', '800000', '8000000'].map(groupThousands),
    ['8', '80', '800', '8,000', '80,000', '800,000', '8,000,000'],
  );

  // The prefix is STATIC chrome, never part of the value — re-parsing a
  // displayed value with the prefix glued on must not change the number.
  assert.equal(AMOUNT_PREFIX, '+₱');
  assert.equal(parseAmountInput(`${AMOUNT_PREFIX}80,000`), 8_000_000);
});

test('amount-only: whole-peso round-trip is exact for everything the field can author', () => {
  for (const typed of ['0', '1', '999', '1000', '12345', '9999999999']) {
    const centavos = parseAmountInput(typed);
    assert.equal(parseAmountInput(formatAmountInput(centavos)), centavos, `₱${typed}`);
  }
  // Leading zeros and junk are normalised, never guessed at.
  assert.equal(parseAmountInput('000080000'), 8_000_000);
  assert.equal(groupThousands('000080000'), '80,000');
  assert.equal(parseAmountInput('₱8,0a0b0'), 800_000);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 5 · THE LINE-STATE MACHINE + GROUPING                                      */
/* ────────────────────────────────────────────────────────────────────────── */

test('a new line lands in the group it was added from, and changing state moves it', () => {
  assert.deepEqual(LINE_GROUP_ORDER, ['included', 'choices', 'quantities', 'addons']);

  const included = newLine('a', 'catering', 'included');
  assert.equal(lineStateOf(included), 'included');
  assert.equal(lineGroupOf(included), 'included');

  const required = applyLineState(included, 'required');
  assert.equal(lineGroupOf(required), 'included');
  // Required implies included — the DB refuses any other combination.
  assert.equal(required.is_default_included, true);
  assert.equal(required.is_required, true);

  const optional = applyLineState(required, 'optional');
  assert.equal(lineGroupOf(optional), 'addons');
  assert.equal(optional.is_default_included, false);
  assert.equal(optional.is_required, false);

  const choice = applyLineState(optional, 'choice');
  assert.equal(lineGroupOf(choice), 'choices');
  // A choice starts VALID: two options, exactly one standard, standard free.
  assert.equal(choice.options.length, 2);
  assert.equal(choice.options.filter((o) => o.is_default).length, 1);
  assert.equal(choice.options.find((o) => o.is_default)!.price_delta_centavos, 0);

  const quantity = applyLineState(choice, 'quantity');
  assert.equal(lineGroupOf(quantity), 'quantities');
  assert.equal(quantity.maxExtraHours, 0);
  assert.equal(quantity.options.length, 0, 'leaving choice must drop its options');
});

test('pick-N is both-or-neither — the DB refuses a half-set pair', () => {
  const choice = newLine('a', 'catering', 'choice');
  const pick = { ...choice, pickMin: 1, pickMax: 2 };
  assert.deepEqual(
    validatePackageDraft(toPackageDraft([pick], { packageName: 'p', totalPriceCentavos: 100 }))
      .filter((p) => p.code === 'choice_pick_range_invalid'),
    [],
  );

  const halfSet = { ...choice, pickMin: 2, pickMax: null };
  const problems = validatePackageDraft(
    toPackageDraft([halfSet], { packageName: 'p', totalPriceCentavos: 100 }),
  );
  assert.ok(problems.some((p) => p.code === 'choice_pick_range_invalid'));

  // Leaving the choice state clears BOTH bounds together, never one.
  const left = applyLineState(pick, 'included');
  assert.equal(left.pickMin, null);
  assert.equal(left.pickMax, null);
});

test('a FOLLOW-UP cannot be set required or included in the state machine itself', () => {
  const followUp = newFollowUpLine('f1', 'catering', {
    itemRef: 'i-main',
    optionRef: 'o-lechon',
  });
  assert.equal(isFollowUp(followUp), true);
  assert.equal(followUp.is_default_included, false);
  assert.equal(followUp.is_required, false);

  // The UI is never offered the two forbidden states…
  assert.deepEqual(allowedLineStates(followUp), ['optional', 'choice', 'quantity']);
  assert.ok(!allowedLineStates(followUp).includes('required'));
  assert.ok(!allowedLineStates(followUp).includes('included'));

  // …and asking for one anyway is a NO-OP, not a throw and not a silent write.
  const forcedRequired = applyLineState(followUp, 'required');
  assert.equal(forcedRequired.is_required, false);
  assert.equal(forcedRequired.is_default_included, false);
  const forcedIncluded = applyLineState(followUp, 'included');
  assert.equal(forcedIncluded.is_default_included, false);

  // Even turning a follow-up into a CHOICE keeps it out of the price — the one
  // state where a top-level line WOULD become default-included.
  const asChoice = applyLineState(followUp, 'choice');
  assert.equal(asChoice.is_default_included, false);
  assert.equal(applyLineState(newLine('t', 'catering'), 'choice').is_default_included, true);

  // The shipped validator agrees, which is the whole point of mirroring it.
  const forced = { ...followUp, is_required: true, is_default_included: true };
  const problems = validatePackageDraft(
    toPackageDraft([line({ ref: 'i-main', options: [
      { ref: 'o-lechon', label: 'Lechon', price_delta_centavos: 0, is_default: true, is_available: true },
      { ref: 'o-other', label: 'Other', price_delta_centavos: 100, is_default: false, is_available: true },
    ] }), forced], { packageName: 'p', totalPriceCentavos: 100_000_00 }),
  );
  assert.ok(problems.some((p) => p.code === 'followup_cannot_be_required'));
  assert.ok(problems.some((p) => p.code === 'followup_cannot_be_default_included'));
});

test('the lineage sentence names the option and the line it follows', () => {
  const items = referenceDraft();
  const cut = items.find((i) => i.ref === 'i-cut')!;
  assert.equal(followUpLineage(cut, items), 'follows “Lechon belly” on Main course');
  // A top-level line has no lineage.
  assert.equal(followUpLineage(items.find((i) => i.ref === 'i-hours')!, items), null);
  // A blank parent name falls back to the auto-name rather than reading `on `.
  const blankParent = [line({ ref: 'p', service_description: '', options: [
    { ref: 'po', label: '', price_delta_centavos: 0, is_default: true, is_available: true },
    { ref: 'po2', label: 'B', price_delta_centavos: 100, is_default: false, is_available: true },
  ] }), line({ ref: 'c', parentRef: { itemRef: 'p', optionRef: 'po' } })];
  assert.equal(followUpLineage(blankParent[1]!, blankParent), 'follows “Option 1” on Item 1');
});

test('deleting a line takes its follow-up subtree with it, and terminates on a cycle', () => {
  const items = referenceDraft();
  // i-main → i-cut → i-carve
  assert.deepEqual([...refsToRemoveWith('i-main', items)].sort(), ['i-carve', 'i-cut', 'i-main']);
  assert.deepEqual([...refsToRemoveWith('i-cut', items)].sort(), ['i-carve', 'i-cut']);
  assert.deepEqual([...refsToRemoveWith('i-hours', items)], ['i-hours']);

  // A cycle must not hang the vendor's browser — bounded by the item count.
  const cyclic = [
    line({ ref: 'a', parentRef: { itemRef: 'b', optionRef: 'ob' } }),
    line({ ref: 'b', parentRef: { itemRef: 'a', optionRef: 'oa' } }),
  ];
  assert.deepEqual([...refsToRemoveWith('a', cyclic)].sort(), ['a', 'b']);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 6 · A BLANK NAME IS AUTO-NAMED, NEVER REFUSED (owner-locked)               */
/* ────────────────────────────────────────────────────────────────────────── */

test('a blank name auto-names rather than blocking the save', () => {
  const blank = [
    line({ ref: 'a', service_description: '' }),
    line({ ref: 'b', service_description: '   ' }),
    line({
      ref: 'c',
      service_description: 'Main',
      options: [
        { ref: 'o1', label: '', price_delta_centavos: 0, is_default: true, is_available: true },
        { ref: 'o2', label: 'Beef', price_delta_centavos: 100, is_default: false, is_available: true },
      ],
    }),
  ];

  // Before the save the vendor sees exactly these words as the PLACEHOLDER…
  assert.equal(autoNamePlaceholder('item', 0), 'Item 1');
  assert.equal(autoNamePlaceholder('item', 1), 'Item 2');
  assert.equal(autoNamePlaceholder('option', 0), 'Option 1');

  // …and the save writes the SAME words, on the same index basis.
  const named = autoNameDraftItems(blank);
  assert.equal(named[0]!.service_description, 'Item 1');
  assert.equal(named[1]!.service_description, 'Item 2');
  assert.equal(named[2]!.service_description, 'Main');
  assert.equal(named[2]!.options[0]!.label, 'Option 1');
  assert.equal(named[2]!.options[1]!.label, 'Beef');

  // NOT REFUSED: a blank name would otherwise trip `item_description_empty`.
  const raw = validatePackageDraft(
    toPackageDraft(blank, { packageName: 'p', totalPriceCentavos: 100_00 }),
  );
  assert.ok(raw.some((p) => p.code === 'item_description_empty'), 'the validator does refuse blanks');
  const after = validatePackageDraft(
    toPackageDraft(named, { packageName: 'p', totalPriceCentavos: 100_00 }),
  );
  assert.ok(!after.some((p) => p.code === 'item_description_empty'), 'naming clears it');

  // And the vendor is TOLD how many were filled in.
  assert.equal(countAutoNamed(blank), 3);
  assert.equal(countAutoNamed(named), 0);
});

/* ────────────────────────────────────────────────────────────────────────── */
/* 7 · SERVICE → PACKAGE                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

test('the vendor-category → canonical_service inverse is derived, deterministic and total', () => {
  // The two namespaces genuinely differ — this is the bug the map prevents.
  assert.equal(canonicalServiceForVendorCategory('photographer'), 'photography');
  assert.equal(canonicalServiceForVendorCategory('videographer'), 'videography');
  assert.equal(canonicalServiceForVendorCategory('florist'), 'florals');
  assert.equal(canonicalServiceForVendorCategory('catering'), 'catering');
  // Many-to-one: first-declared wins, which is the BROAD anchor, not a leaf.
  assert.equal(canonicalServiceForVendorCategory('venue'), 'reception_venue');
  // Total: an unmapped category falls back to its own string rather than
  // producing `undefined` on a NOT NULL column.
  assert.equal(canonicalServiceForVendorCategory('misc'), 'misc');
  assert.equal(canonicalServiceForVendorCategory('made_up'), 'made_up');
});

test('toPackageDraft leaves the credit pool at the shipped defaults', () => {
  const draft = toPackageDraft(referenceDraft(), {
    packageName: 'Catering — Full Day',
    totalPriceCentavos: 250_000_00,
  });
  assert.equal(draft.package_name, 'Catering — Full Day');
  assert.equal(draft.total_price_centavos, 250_000_00);
  // The wizard authors STRUCTURE, not a credit pool — so
  // `consumable_without_flex_or_budget` can never fire from this surface.
  assert.equal(draft.consumable_budget_centavos, 0);
  assert.equal(draft.is_consumable_flexible, false);
  assert.deepEqual(validatePackageDraft(draft), []);
});
