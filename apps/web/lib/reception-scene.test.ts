import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReceptionDesign, sel, DEFAULT_DESIGN } from './reception-scene';

test('sanitizeReceptionDesign: keeps only known part → attr → valid option ids', () => {
  const out = sanitizeReceptionDesign({
    ceiling: { treatment: 'chandeliers', bogus: 'x' },
    tables: { centerpiece: 'candelabra' },
    backdrop: { style: 'not_a_real_style' }, // dropped (invalid option)
    nonsense_part: { foo: 'bar' }, // dropped (unknown part)
  });
  assert.deepEqual(out.ceiling, { treatment: 'chandeliers' });
  assert.deepEqual(out.tables, { centerpiece: 'candelabra' });
  assert.equal(out.backdrop, undefined);
  assert.equal((out as Record<string, unknown>).nonsense_part, undefined);
});

test('sanitizeReceptionDesign: total on malformed input (never throws)', () => {
  assert.deepEqual(sanitizeReceptionDesign(null), {});
  assert.deepEqual(sanitizeReceptionDesign(undefined), {});
  assert.deepEqual(sanitizeReceptionDesign('nope'), {});
  assert.deepEqual(sanitizeReceptionDesign(42), {});
  assert.deepEqual(sanitizeReceptionDesign([1, 2, 3]), {});
  assert.deepEqual(sanitizeReceptionDesign({ ceiling: 'wrongtype' }), {});
});

test('sanitizeReceptionDesign: empty result falls back to DEFAULT_DESIGN via sel()', () => {
  const clean = sanitizeReceptionDesign({});
  assert.equal(sel(clean, 'ceiling', 'treatment'), DEFAULT_DESIGN.ceiling.treatment);
  assert.equal(sel(clean, 'tables', 'centerpiece'), DEFAULT_DESIGN.tables.centerpiece);
});
