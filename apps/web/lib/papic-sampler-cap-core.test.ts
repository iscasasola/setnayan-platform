/**
 * Unit suite for the free-Papic-sampler per-seat cap decision core (Node
 * built-in test runner via tsx — `pnpm test:unit`; CI runs it in the "unit
 * tests" step).
 *
 * Adversarial intent: prove the cap boundary is exactly right — every capture up
 * to the cap is ALLOWED (the live happy path must not regress), and the
 * (cap+1)th is REJECTED with the exact error string the UI maps to the "all used
 * up" state. This is the pure twin of the atomic DB guard
 * `papic_sampler_insert_capture` (migration 20270222212676), which is the
 * authoritative leak-proof check; this suite locks its SEMANTICS so the app
 * constants and the SQL can never silently drift.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SAMPLER_PHOTO_CAP,
  SAMPLER_CLIP_CAP,
  samplerCapDecision,
  samplerRemaining,
  samplerCapForKind,
} from './papic-sampler-cap-core';

test('caps match the locked sampler limits (8 photos · 2 clips)', () => {
  assert.equal(SAMPLER_PHOTO_CAP, 8);
  assert.equal(SAMPLER_CLIP_CAP, 2);
  assert.equal(samplerCapForKind('photo'), 8);
  assert.equal(samplerCapForKind('clip'), 2);
});

test('PHOTOS: every shot up to the cap is allowed; the (cap+1)th is rejected', () => {
  // Captures 1..8 (used = 0..7 before each) are all allowed — the live sampler
  // happy path must keep working.
  for (let used = 0; used < SAMPLER_PHOTO_CAP; used += 1) {
    assert.deepEqual(
      samplerCapDecision('photo', used),
      { allowed: true },
      `photo #${used + 1} should be allowed`,
    );
  }
  // The 9th photo (used = 8 = cap) is REJECTED at the record layer.
  assert.deepEqual(samplerCapDecision('photo', SAMPLER_PHOTO_CAP), {
    allowed: false,
    error: 'sampler_photo_cap',
  });
  // …and so is everything beyond it (a hostile over-cap attempt).
  assert.deepEqual(samplerCapDecision('photo', SAMPLER_PHOTO_CAP + 5), {
    allowed: false,
    error: 'sampler_photo_cap',
  });
});

test('CLIPS: both clips allowed; the 3rd is rejected', () => {
  assert.deepEqual(samplerCapDecision('clip', 0), { allowed: true });
  assert.deepEqual(samplerCapDecision('clip', 1), { allowed: true });
  // The 3rd clip (used = 2 = cap) is rejected.
  assert.deepEqual(samplerCapDecision('clip', SAMPLER_CLIP_CAP), {
    allowed: false,
    error: 'sampler_clip_cap',
  });
});

test('remaining capacity (the presign-layer probe) is exact and never negative', () => {
  assert.equal(samplerRemaining('photo', 0), 8);
  assert.equal(samplerRemaining('photo', 7), 1);
  assert.equal(samplerRemaining('photo', 8), 0); // at cap → presign refuses the URL
  assert.equal(samplerRemaining('photo', 99), 0); // never negative
  assert.equal(samplerRemaining('clip', 0), 2);
  assert.equal(samplerRemaining('clip', 2), 0); // at cap → presign refuses the URL
});

test('the boundary is "remaining <= 0 ⇒ refuse a new presign"', () => {
  // The presign route gates on `remaining <= 0`. Confirm the boundary aligns
  // with the record-layer decision so the two layers agree exactly.
  for (const kind of ['photo', 'clip'] as const) {
    const cap = samplerCapForKind(kind);
    // one slot left → presign allowed AND record allowed
    assert.ok(samplerRemaining(kind, cap - 1) > 0);
    assert.equal(samplerCapDecision(kind, cap - 1).allowed, true);
    // at cap → presign refused AND record rejected
    assert.equal(samplerRemaining(kind, cap), 0);
    assert.equal(samplerCapDecision(kind, cap).allowed, false);
  }
});

test('non-integer / negative used counts are treated as 0 used (fail-safe to allow within cap)', () => {
  assert.equal(samplerRemaining('photo', -3), 8);
  assert.equal(samplerRemaining('photo', Number.NaN), 8);
  assert.deepEqual(samplerCapDecision('photo', Number.NaN), { allowed: true });
});
