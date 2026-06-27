/**
 * Unit suite for the shared Chinese-wedding overlay predicate.
 * The spine the whole Chinese feature set derives from — must treat the
 * Chinese-as-secondary (overlay) case identically to Chinese-as-primary, since
 * the common Tsinoy wedding is a church/civil primary rite + Chinese secondary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isChineseWedding, isChineseOverlay } from './chinese-wedding';

test('isChineseWedding: primary chinese → true', () => {
  assert.equal(isChineseWedding({ ceremony_type: 'chinese' }), true);
});

test('isChineseWedding: secondary chinese (the common Tsinoy church-primary case) → true', () => {
  assert.equal(
    isChineseWedding({ ceremony_type: 'catholic', secondary_ceremony_type: 'chinese' }),
    true,
  );
});

test('isChineseWedding: mixed primary + chinese secondary → true', () => {
  assert.equal(
    isChineseWedding({ ceremony_type: 'mixed', secondary_ceremony_type: 'chinese' }),
    true,
  );
});

test('isChineseWedding: non-Chinese event → false', () => {
  assert.equal(isChineseWedding({ ceremony_type: 'catholic' }), false);
  assert.equal(isChineseWedding({ ceremony_type: 'civil', secondary_ceremony_type: null }), false);
});

test('isChineseWedding: null/undefined/empty → false (no throw)', () => {
  assert.equal(isChineseWedding(null), false);
  assert.equal(isChineseWedding(undefined), false);
  assert.equal(isChineseWedding({}), false);
});

test('isChineseOverlay: true only when Chinese is the secondary, not the primary', () => {
  assert.equal(
    isChineseOverlay({ ceremony_type: 'catholic', secondary_ceremony_type: 'chinese' }),
    true,
  );
  // Primary chinese is not an "overlay" — it IS the rite.
  assert.equal(isChineseOverlay({ ceremony_type: 'chinese' }), false);
  assert.equal(isChineseOverlay({ ceremony_type: 'catholic' }), false);
});
