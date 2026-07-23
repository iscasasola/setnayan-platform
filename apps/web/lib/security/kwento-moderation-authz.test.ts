/**
 * Unit suite for isKwentoModerator — the authority gate blockKwentoGuest must
 * enforce before inserting a guest_message_blocks row. Only the couple and
 * accepted coordinators may silence a guest; a plain guest must be rejected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isKwentoModerator } from './kwento-moderation-authz';

test('couple may moderate', () => {
  assert.equal(isKwentoModerator('couple'), true);
});

test('coordinator (accepted co-host) may moderate', () => {
  assert.equal(isKwentoModerator('coordinator'), true);
});

test('a plain guest may NOT moderate', () => {
  assert.equal(isKwentoModerator('guest'), false);
});

test('a vendor member may NOT moderate', () => {
  assert.equal(isKwentoModerator('vendor'), false);
});

test('no membership (null / undefined) may NOT moderate', () => {
  assert.equal(isKwentoModerator(null), false);
  assert.equal(isKwentoModerator(undefined), false);
});
