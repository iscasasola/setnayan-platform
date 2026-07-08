/**
 * Unit suite for the PURE booth-card parsing in `lib/vendor-services.ts`.
 * `parsePackageInclusions` feeds the 3D booth vendor card's kind-aware list
 * from the legacy `vendor_services.package_inclusions` JSONB, which holds
 * either plain strings or `{ label, worth_php? }` objects — the parse must be
 * tolerant of both (and of junk) because the column predates the structured
 * vendor_service_inclusions table and has no DB shape check.
 *
 * Run via the repo's `test:unit` script (tsx --test "lib/**\/*.test.ts").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePackageInclusions } from './vendor-services';

test('parsePackageInclusions: plain strings become labels (trimmed, blanks dropped)', () => {
  const items = parsePackageInclusions(['Lechon belly', '  Dessert bar ', '', '   ']);
  assert.deepEqual(items, [{ label: 'Lechon belly' }, { label: 'Dessert bar' }]);
});

test('parsePackageInclusions: { label, worth_php } objects carry the worth chip', () => {
  const items = parsePackageInclusions([
    { label: 'Free photo album', worth_php: 2500 },
    { label: 'Standby generator' },
  ]);
  assert.deepEqual(items, [
    { label: 'Free photo album', worthPhp: 2500 },
    { label: 'Standby generator', worthPhp: null },
  ]);
});

test('parsePackageInclusions: non-positive / non-numeric worth normalises to null', () => {
  const items = parsePackageInclusions([
    { label: 'A', worth_php: 0 },
    { label: 'B', worth_php: -5 },
    { label: 'C', worth_php: '₱99' },
  ]);
  assert.deepEqual(items, [
    { label: 'A', worthPhp: null },
    { label: 'B', worthPhp: null },
    { label: 'C', worthPhp: null },
  ]);
});

test('parsePackageInclusions: junk shapes degrade to empty, never throw', () => {
  assert.deepEqual(parsePackageInclusions(null), []);
  assert.deepEqual(parsePackageInclusions(undefined), []);
  assert.deepEqual(parsePackageInclusions('Lechon'), []);
  assert.deepEqual(parsePackageInclusions({ label: 'not-an-array' }), []);
  assert.deepEqual(parsePackageInclusions([42, true, { worth_php: 100 }, { label: 9 }]), []);
});
