import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  PUBLIC_SAFE_MODERATION_STATE,
  isPublicSafeModerationState,
  filterPublicSafeRows,
} from '@/lib/public-media-visibility';

test('the public-safe state is exactly "clean"', () => {
  assert.equal(PUBLIC_SAFE_MODERATION_STATE, 'clean');
});

test('isPublicSafeModerationState passes ONLY "clean"', () => {
  assert.equal(isPublicSafeModerationState('clean'), true);
});

test('isPublicSafeModerationState fails closed on unscreened (the auto-play leak)', () => {
  // A clip whose poster-frame extraction failed stays 'unscreened' (never
  // screened). The old fail-OPEN blocklist let this through onto the public page.
  assert.equal(isPublicSafeModerationState('unscreened'), false);
});

test('isPublicSafeModerationState excludes nsfw_blocked', () => {
  assert.equal(isPublicSafeModerationState('nsfw_blocked'), false);
});

test('isPublicSafeModerationState excludes RA-10173 withdrawal states', () => {
  assert.equal(isPublicSafeModerationState('consent_withheld'), false);
  assert.equal(isPublicSafeModerationState('faceblock_withheld'), false);
});

test('isPublicSafeModerationState excludes NULL / undefined / unknown', () => {
  assert.equal(isPublicSafeModerationState(null), false);
  assert.equal(isPublicSafeModerationState(undefined), false);
  assert.equal(isPublicSafeModerationState(''), false);
  assert.equal(isPublicSafeModerationState('CLEAN'), false);
  assert.equal(isPublicSafeModerationState('some_future_state'), false);
});

test('filterPublicSafeRows keeps only clean rows and drops every other state', () => {
  const rows = [
    { id: 'a', moderation_state: 'clean' },
    { id: 'b', moderation_state: 'unscreened' },
    { id: 'c', moderation_state: 'nsfw_blocked' },
    { id: 'd', moderation_state: 'consent_withheld' },
    { id: 'e', moderation_state: 'faceblock_withheld' },
    { id: 'f', moderation_state: null },
    { id: 'g' }, // moderation_state undefined
  ];
  const kept = filterPublicSafeRows(rows);
  assert.deepEqual(
    kept.map((r) => r.id),
    ['a'],
  );
});
