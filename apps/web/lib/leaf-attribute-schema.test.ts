/**
 * Unit guards for the pure leaf-refinement (vendor attribute schema) mutations.
 * These lock the 0044 ADDITIVE-ONLY / NEVER-ORPHAN contract the Taxonomy Studio
 * editor relies on: immutable keys + option values, safe field relabel, soft
 * retire that never drops a saved value, and a +1 schema_version bump per write.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  slugifyKey,
  isValidKey,
  visibleLeafAttributes,
  visibleLeafAttributesForPayload,
  addLeafAttributeField,
  addLeafAttributeOption,
  relabelLeafAttributeField,
  retireLeafAttributeField,
  retireLeafAttributeOption,
  isFieldRetired,
  isOptionRetired,
  type LeafAttributeMap,
} from './leaf-attribute-schema';

function base(): LeafAttributeMap {
  return {
    shooting_style: {
      type: 'multi_select',
      label: 'Shooting style',
      options: ['candid', 'traditional', 'editorial'],
    },
    coverage_hours: { type: 'int', label: 'Coverage hours', min: 1, max: 24 },
    drone: { type: 'boolean', label: 'Drone footage' },
  };
}

// ── key generation ──────────────────────────────────────────────────────────

test('slugifyKey mirrors the Studio slugify(_, "_") convention', () => {
  assert.equal(slugifyKey('Shooting Style'), 'shooting_style');
  assert.equal(slugifyKey('  Prep & Ready!!  '), 'prep_ready');
  // NFKD splits accented letters into base + combining mark; the mark becomes
  // a separator — identical to the Studio's own slugify(label, '_').
  assert.equal(slugifyKey('cafe deco'), 'cafe_deco');
  assert.equal(slugifyKey('---'), '');
});

test('isValidKey accepts clean snake_case only', () => {
  assert.ok(isValidKey('shooting_style'));
  assert.ok(isValidKey('a1'));
  assert.equal(isValidKey(''), false);
  assert.equal(isValidKey('_leading'), false);
  assert.equal(isValidKey('trailing_'), false);
  assert.equal(isValidKey('Has Space'), false);
});

// ── addLeafAttributeField ───────────────────────────────────────────────────

test('addLeafAttributeField mints an immutable snake_case key from the label', () => {
  const r = addLeafAttributeField(base(), 3, { label: 'Turnaround Time', type: 'int' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.ok('turnaround_time' in r.attributes);
  assert.equal(r.attributes.turnaround_time!.type, 'int');
  assert.equal(r.attributes.turnaround_time!.label, 'Turnaround Time');
  assert.equal(r.schemaVersion, 4, 'version bumps +1');
});

test('addLeafAttributeField rejects a colliding key (even a retired one)', () => {
  const withRetired = retireLeafAttributeField(base(), 1, { fieldKey: 'drone', retired: true });
  assert.ok(withRetired.ok);
  if (!withRetired.ok) return;
  const r = addLeafAttributeField(withRetired.attributes, withRetired.schemaVersion, {
    label: 'Drone',
    type: 'boolean',
  });
  assert.equal(r.ok, false);
});

test('addLeafAttributeField requires options for select types', () => {
  const bad = addLeafAttributeField(base(), 1, { label: 'Cuisine', type: 'multi_select' });
  assert.equal(bad.ok, false);
  const good = addLeafAttributeField(base(), 1, {
    label: 'Cuisine',
    type: 'enum',
    options: ['Filipino', 'Italian', 'Filipino'], // dedupes
  });
  assert.ok(good.ok);
  if (!good.ok) return;
  assert.deepEqual(good.attributes.cuisine!.options, ['filipino', 'italian']);
});

test('addLeafAttributeField rejects unknown field types', () => {
  const r = addLeafAttributeField(base(), 1, { label: 'X', type: 'rich_text' });
  assert.equal(r.ok, false);
});

test('addLeafAttributeField does not mutate the input map', () => {
  const input = base();
  const snapshot = JSON.stringify(input);
  addLeafAttributeField(input, 1, { label: 'New Thing', type: 'text_short' });
  assert.equal(JSON.stringify(input), snapshot, 'input untouched (immutability)');
});

// ── addLeafAttributeOption ──────────────────────────────────────────────────

test('addLeafAttributeOption appends an immutable value; existing options untouched', () => {
  const r = addLeafAttributeOption(base(), 2, { fieldKey: 'shooting_style', label: 'Photojournalistic' });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.deepEqual(r.attributes.shooting_style!.options, [
    'candid',
    'traditional',
    'editorial',
    'photojournalistic',
  ]);
  assert.equal(r.schemaVersion, 3);
});

test('addLeafAttributeOption rejects a duplicate live value', () => {
  const r = addLeafAttributeOption(base(), 1, { fieldKey: 'shooting_style', label: 'Candid' });
  assert.equal(r.ok, false);
});

test('addLeafAttributeOption re-adds a retired value by un-retiring it (round-trip)', () => {
  const retired = retireLeafAttributeOption(base(), 1, {
    fieldKey: 'shooting_style',
    option: 'editorial',
    retired: true,
  });
  assert.ok(retired.ok);
  if (!retired.ok) return;
  assert.ok(isOptionRetired(retired.attributes.shooting_style!, 'editorial'));

  const readd = addLeafAttributeOption(retired.attributes, retired.schemaVersion, {
    fieldKey: 'shooting_style',
    label: 'Editorial',
  });
  assert.ok(readd.ok);
  if (!readd.ok) return;
  assert.equal(isOptionRetired(readd.attributes.shooting_style!, 'editorial'), false);
  // Value never duplicated in options.
  assert.deepEqual(readd.attributes.shooting_style!.options, ['candid', 'traditional', 'editorial']);
});

test('addLeafAttributeOption refuses non-option field types', () => {
  const r = addLeafAttributeOption(base(), 1, { fieldKey: 'coverage_hours', label: 'x' });
  assert.equal(r.ok, false);
});

// ── relabelLeafAttributeField (safe: label is pure display) ──────────────────

test('relabelLeafAttributeField changes the label but never the key', () => {
  const r = relabelLeafAttributeField(base(), 5, {
    fieldKey: 'shooting_style',
    label: 'Photography style',
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.attributes.shooting_style!.label, 'Photography style');
  assert.ok('shooting_style' in r.attributes, 'key preserved');
  assert.deepEqual(
    r.attributes.shooting_style!.options,
    ['candid', 'traditional', 'editorial'],
    'options preserved',
  );
  assert.equal(r.schemaVersion, 6);
});

// ── retire round-trips (never drops the underlying value) ────────────────────

test('retireLeafAttributeField soft-retires + un-retires without losing the def', () => {
  const off = retireLeafAttributeField(base(), 1, { fieldKey: 'drone', retired: true });
  assert.ok(off.ok);
  if (!off.ok) return;
  assert.ok(isFieldRetired(off.attributes.drone!));
  assert.equal(off.attributes.drone!.type, 'boolean', 'def kept intact for validation');

  const on = retireLeafAttributeField(off.attributes, off.schemaVersion, {
    fieldKey: 'drone',
    retired: false,
  });
  assert.ok(on.ok);
  if (!on.ok) return;
  assert.equal(isFieldRetired(on.attributes.drone!), false);
});

test('retireLeafAttributeOption keeps the value inside options (validation survives)', () => {
  const r = retireLeafAttributeOption(base(), 1, {
    fieldKey: 'shooting_style',
    option: 'traditional',
    retired: true,
  });
  assert.ok(r.ok);
  if (!r.ok) return;
  // Value still present in options → a vendor payload holding "traditional" stays valid.
  assert.ok(r.attributes.shooting_style!.options!.includes('traditional'));
  assert.ok(isOptionRetired(r.attributes.shooting_style!, 'traditional'));
});

test('retireLeafAttributeOption refuses to retire the last live option', () => {
  let attrs = base();
  let v = 1;
  for (const opt of ['candid', 'traditional']) {
    const r = retireLeafAttributeOption(attrs, v, { fieldKey: 'shooting_style', option: opt, retired: true });
    assert.ok(r.ok);
    if (!r.ok) return;
    attrs = r.attributes;
    v = r.schemaVersion;
  }
  // Only 'editorial' left live — retiring it must fail.
  const last = retireLeafAttributeOption(attrs, v, {
    fieldKey: 'shooting_style',
    option: 'editorial',
    retired: true,
  });
  assert.equal(last.ok, false);
});

// ── visibleLeafAttributes (the render filter) ────────────────────────────────

test('visibleLeafAttributes hides retired fields + retired options', () => {
  let attrs = base();
  const r1 = retireLeafAttributeField(attrs, 1, { fieldKey: 'drone', retired: true });
  assert.ok(r1.ok);
  if (!r1.ok) return;
  const r2 = retireLeafAttributeOption(r1.attributes, r1.schemaVersion, {
    fieldKey: 'shooting_style',
    option: 'editorial',
    retired: true,
  });
  assert.ok(r2.ok);
  if (!r2.ok) return;

  const visible = visibleLeafAttributes(r2.attributes);
  assert.equal('drone' in visible, false, 'retired field hidden');
  assert.deepEqual(
    visible.shooting_style!.options,
    ['candid', 'traditional'],
    'retired option filtered from render',
  );
  // The render copy is scrubbed of bookkeeping flags.
  assert.equal((visible.shooting_style as { retired_options?: unknown }).retired_options, undefined);
  assert.equal((visible.coverage_hours as { retired?: unknown }).retired, undefined);
});

test('visibleLeafAttributes never mutates its input', () => {
  const off = retireLeafAttributeField(base(), 1, { fieldKey: 'drone', retired: true });
  assert.ok(off.ok);
  if (!off.ok) return;
  const snapshot = JSON.stringify(off.attributes);
  visibleLeafAttributes(off.attributes);
  assert.equal(JSON.stringify(off.attributes), snapshot);
});

// ── visibleLeafAttributesForPayload (never drops a saved answer) ─────────────

test('visibleLeafAttributesForPayload keeps a retired field the vendor answered', () => {
  const off = retireLeafAttributeField(base(), 1, { fieldKey: 'drone', retired: true });
  assert.ok(off.ok);
  if (!off.ok) return;

  // No answer → hidden.
  assert.equal('drone' in visibleLeafAttributesForPayload(off.attributes, {}), false);
  // Answered → visible (so the vendor can see / keep / change it).
  assert.ok('drone' in visibleLeafAttributesForPayload(off.attributes, { drone: true }));
});

test('visibleLeafAttributesForPayload keeps a retired option the vendor selected', () => {
  const r = retireLeafAttributeOption(base(), 1, {
    fieldKey: 'shooting_style',
    option: 'editorial',
    retired: true,
  });
  assert.ok(r.ok);
  if (!r.ok) return;

  // Not selected → option hidden.
  const noPick = visibleLeafAttributesForPayload(r.attributes, { shooting_style: ['candid'] });
  assert.equal(noPick.shooting_style!.options!.includes('editorial'), false);

  // Selected → retired option stays visible so the saved value survives re-save.
  const picked = visibleLeafAttributesForPayload(r.attributes, {
    shooting_style: ['candid', 'editorial'],
  });
  assert.ok(picked.shooting_style!.options!.includes('editorial'));
});

// ── missing-field guards ─────────────────────────────────────────────────────

test('mutations on a missing field key error cleanly', () => {
  assert.equal(relabelLeafAttributeField(base(), 1, { fieldKey: 'nope', label: 'X' }).ok, false);
  assert.equal(retireLeafAttributeField(base(), 1, { fieldKey: 'nope', retired: true }).ok, false);
  assert.equal(addLeafAttributeOption(base(), 1, { fieldKey: 'nope', label: 'x' }).ok, false);
});
