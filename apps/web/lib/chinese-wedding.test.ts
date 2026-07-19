/**
 * Unit suite for the shared Chinese-wedding overlay predicate.
 * The spine the whole Chinese feature set derives from — must treat the
 * Chinese-as-secondary (overlay) case identically to Chinese-as-primary, since
 * the common Tsinoy wedding is a church/civil primary rite + Chinese secondary.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isChineseWedding,
  isChineseOverlay,
  isMuslimWedding,
  ceremonyMatches,
} from './chinese-wedding';

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

test('isMuslimWedding: primary muslim → true', () => {
  assert.equal(isMuslimWedding({ ceremony_type: 'muslim' }), true);
});

test('isMuslimWedding: secondary muslim (overlay on a non-muslim primary) → true', () => {
  assert.equal(
    isMuslimWedding({ ceremony_type: 'catholic', secondary_ceremony_type: 'muslim' }),
    true,
  );
});

test('isMuslimWedding: mixed primary + muslim secondary → true', () => {
  assert.equal(
    isMuslimWedding({ ceremony_type: 'mixed', secondary_ceremony_type: 'muslim' }),
    true,
  );
});

test('isMuslimWedding: non-Muslim event → false', () => {
  assert.equal(isMuslimWedding({ ceremony_type: 'catholic' }), false);
  assert.equal(
    isMuslimWedding({ ceremony_type: 'chinese', secondary_ceremony_type: null }),
    false,
  );
});

test('isMuslimWedding: null/undefined/empty → false (no throw)', () => {
  assert.equal(isMuslimWedding(null), false);
  assert.equal(isMuslimWedding(undefined), false);
  assert.equal(isMuslimWedding({}), false);
});

test('ceremonyMatches: generic — matches faithKey on either column', () => {
  assert.equal(ceremonyMatches({ ceremony_type: 'inc' }, 'inc'), true);
  assert.equal(
    ceremonyMatches({ ceremony_type: 'civil', secondary_ceremony_type: 'inc' }, 'inc'),
    true,
  );
  assert.equal(ceremonyMatches({ ceremony_type: 'catholic' }, 'inc'), false);
});

test('ceremonyMatches: null/undefined/empty → false (no throw)', () => {
  assert.equal(ceremonyMatches(null, 'muslim'), false);
  assert.equal(ceremonyMatches(undefined, 'muslim'), false);
  assert.equal(ceremonyMatches({}, 'muslim'), false);
});

test('ceremonyMatches: named wrappers agree with the generic primitive', () => {
  const overlay = { ceremony_type: 'catholic', secondary_ceremony_type: 'chinese' };
  assert.equal(isChineseWedding(overlay), ceremonyMatches(overlay, 'chinese'));
  const nikahOverlay = { ceremony_type: 'catholic', secondary_ceremony_type: 'muslim' };
  assert.equal(isMuslimWedding(nikahOverlay), ceremonyMatches(nikahOverlay, 'muslim'));
});
