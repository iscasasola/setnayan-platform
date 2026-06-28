/**
 * Unit suite for the Papic photo-only media filter — the root-cause rule behind
 * the clip-leak fix (sibling of #2335). A photo-only consumer must EXCLUDE guest
 * clips (`media_type='clip'`) / seat clips (`photo_type='clip'`) but must never
 * drop a real photo, including legacy rows whose discriminator is absent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isPapicPhotoRow,
  PAPIC_GUEST_PHOTO_TYPE,
  PAPIC_SEAT_PHOTO_TYPE,
  PAPIC_CLIP_VALUE,
} from './papic-media-filter';

// ---- the constants the SQL filters spell ----------------------------------

test('guest-capture filter targets media_type = photo', () => {
  assert.equal(PAPIC_GUEST_PHOTO_TYPE.column, 'media_type');
  assert.equal(PAPIC_GUEST_PHOTO_TYPE.value, 'photo');
});

test('seat-photo filter targets photo_type = photo', () => {
  assert.equal(PAPIC_SEAT_PHOTO_TYPE.column, 'photo_type');
  assert.equal(PAPIC_SEAT_PHOTO_TYPE.value, 'photo');
});

// ---- isPapicPhotoRow: clips are excluded ----------------------------------

test('a guest CLIP row is excluded from a photo-only consumer', () => {
  assert.equal(isPapicPhotoRow({ media_type: PAPIC_CLIP_VALUE }), false);
  assert.equal(isPapicPhotoRow({ media_type: 'clip' }), false);
});

test('a seat CLIP row is excluded from a photo-only consumer', () => {
  assert.equal(isPapicPhotoRow({ photo_type: 'clip' }), false);
});

// ---- isPapicPhotoRow: real photos are kept --------------------------------

test('an explicit guest photo row is kept', () => {
  assert.equal(isPapicPhotoRow({ media_type: 'photo' }), true);
});

test('an explicit seat photo row is kept', () => {
  assert.equal(isPapicPhotoRow({ photo_type: 'photo' }), true);
});

test('a legacy row with no discriminator stays a photo (DB default = photo)', () => {
  // Pre media_type migration 20270216612756, or a SELECT that didn't pull the
  // column — must default to photo, never silently dropped.
  assert.equal(isPapicPhotoRow({}), true);
  assert.equal(isPapicPhotoRow({ media_type: null }), true);
  assert.equal(isPapicPhotoRow({ photo_type: null }), true);
});

test('media_type wins when both discriminators are present (guest-capture shape)', () => {
  // A guest-capture row would carry media_type; photo_type is irrelevant there.
  assert.equal(isPapicPhotoRow({ media_type: 'clip', photo_type: 'photo' }), false);
  assert.equal(isPapicPhotoRow({ media_type: 'photo', photo_type: 'clip' }), true);
});
