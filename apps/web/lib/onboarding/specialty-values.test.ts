/**
 * Unit suite for the specialty-values normaliser + conditional-reveal predicate
 * (Track-B polish). Guards the shape that reaches events.signature_details:
 * numbers become numbers, roster cells coerce, empties/hidden fields drop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpecialtyValues, isSpecialtyFieldVisible } from './specialty-values';
import type { SpecialtyField } from './specialty-catalog';

const f = (o: Partial<SpecialtyField> & { key: string; type: SpecialtyField['type'] }): SpecialtyField => ({
  label: o.key,
  ...o,
});

test('number fields are coerced to real numbers; junk/empty drop', () => {
  const fields = [f({ key: 'pax', type: 'number' }), f({ key: 'bad', type: 'number' }), f({ key: 'empty', type: 'number' })];
  const out = normalizeSpecialtyValues(fields, { pax: '18', bad: 'abc', empty: '' });
  assert.deepEqual(out, { pax: 18 });
  assert.equal(typeof out.pax, 'number');
});

test('text/date/select trim + drop empties; boolean kept only if boolean', () => {
  const fields = [
    f({ key: 'name', type: 'text' }),
    f({ key: 'when', type: 'date' }),
    f({ key: 'variant', type: 'select', options: ['a', 'b'] }),
    f({ key: 'blank', type: 'text' }),
    f({ key: 'flag', type: 'boolean' }),
    f({ key: 'notbool', type: 'boolean' }),
  ];
  const out = normalizeSpecialtyValues(fields, {
    name: '  Maria  ', when: '2027-01-15', variant: 'b', blank: '   ', flag: false, notbool: 'yes',
  });
  assert.deepEqual(out, { name: 'Maria', when: '2027-01-15', variant: 'b', flag: false });
});

test('multiselect keeps a non-empty string array, drops empties', () => {
  const fields = [f({ key: 'motif', type: 'multiselect', options: [] }), f({ key: 'none', type: 'multiselect', options: [] })];
  const out = normalizeSpecialtyValues(fields, { motif: ['gold', '', 'ivory', 42], none: [] });
  assert.deepEqual(out, { motif: ['gold', 'ivory'] });
});

test('person_roster: coerces number cells, drops empty rows + empty cells', () => {
  const fields = [
    f({
      key: 'eighteen_roses',
      type: 'person_roster',
      item_fields: [
        { key: 'name', type: 'text' },
        { key: 'dance_order', type: 'number' },
      ],
    }),
  ];
  const out = normalizeSpecialtyValues(fields, {
    eighteen_roses: [
      { name: 'Papa', dance_order: '1' },
      { name: '  ', dance_order: '' }, // fully empty → dropped
      { name: 'Tito', dance_order: 'x' }, // bad number → cell dropped, row kept
    ],
  });
  assert.deepEqual(out, { eighteen_roses: [{ name: 'Papa', dance_order: 1 }, { name: 'Tito' }] });
});

test('an all-empty roster drops the whole field', () => {
  const fields = [f({ key: 'court', type: 'person_roster', item_fields: [{ key: 'name', type: 'text' }] })];
  assert.deepEqual(normalizeSpecialtyValues(fields, { court: [{ name: '' }, {}] }), {});
});

test('normalize is pure + idempotent', () => {
  const fields = [f({ key: 'pax', type: 'number' }), f({ key: 'name', type: 'text' })];
  const input = { pax: '5', name: 'X' };
  const once = normalizeSpecialtyValues(fields, input);
  const twice = normalizeSpecialtyValues(fields, once);
  assert.deepEqual(once, twice);
  assert.deepEqual(input, { pax: '5', name: 'X' }); // input not mutated
});

test('show_when: a field is hidden until its controller matches (drops its value too)', () => {
  const fields = [
    f({ key: 'rite', type: 'select', options: ['religious', 'civil'] }),
    f({ key: 'unity', type: 'text', show_when: { field: 'rite', equals: ['religious'] } }),
  ];
  // controller = civil → unity hidden → predicate false + value not persisted
  assert.equal(isSpecialtyFieldVisible(fields[1]!, { rite: 'civil' }), false);
  assert.deepEqual(normalizeSpecialtyValues(fields, { rite: 'civil', unity: 'candle' }), { rite: 'civil' });
  // controller = religious → unity shown + persisted
  assert.equal(isSpecialtyFieldVisible(fields[1]!, { rite: 'religious' }), true);
  assert.deepEqual(normalizeSpecialtyValues(fields, { rite: 'religious', unity: 'candle' }), {
    rite: 'religious',
    unity: 'candle',
  });
});

test('show_when supports a multiselect controller (array intersection)', () => {
  const field = f({ key: 'x', type: 'text', show_when: { field: 'tags', equals: ['a', 'b'] } });
  assert.equal(isSpecialtyFieldVisible(field, { tags: ['c', 'b'] }), true);
  assert.equal(isSpecialtyFieldVisible(field, { tags: ['c', 'd'] }), false);
  assert.equal(isSpecialtyFieldVisible(field, {}), false);
});
