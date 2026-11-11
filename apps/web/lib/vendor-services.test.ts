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

test('parsePackageInclusions: { label, worth_php } objects keep the label only — an included line has no price', () => {
  // Owner 11 Nov 2026: "The inclusions should not have a price". A legacy stored worth is dropped on read.
  const items = parsePackageInclusions([
    { label: 'Free photo album', worth_php: 2500 },
    { label: 'Standby generator' },
    { label: 'C', worth_php: '₱99' },
  ]);
  assert.deepEqual(items, [{ label: 'Free photo album' }, { label: 'Standby generator' }, { label: 'C' }]);
});

test('parsePackageInclusions: junk shapes degrade to empty, never throw', () => {
  assert.deepEqual(parsePackageInclusions(null), []);
  assert.deepEqual(parsePackageInclusions(undefined), []);
  assert.deepEqual(parsePackageInclusions('Lechon'), []);
  assert.deepEqual(parsePackageInclusions({ label: 'not-an-array' }), []);
  assert.deepEqual(parsePackageInclusions([42, true, { worth_php: 100 }, { label: 9 }]), []);
});
