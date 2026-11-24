/**
 * The pure supplier capture model (lib/vendor-papic-tier.ts) — the plan's event limit plus what the shop has taken.
 * Owner 2026-11-23: Free · Verified 10 photos per event, no videos; Plus · Pro · Ultra no limit (storage only).
 * The per-plan edges live in `supplier-event-photo-limits.test.ts`; this pins the model's own arithmetic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureKindWords, captureLimitLine, eventCaptureAllowance } from './vendor-papic-tier';

test('photos left clamps at 0 and never goes negative', () => {
  assert.equal(eventCaptureAllowance('free', 0).photosLeft, 10);
  assert.equal(eventCaptureAllowance('verified', 4).photosLeft, 6);
  assert.equal(eventCaptureAllowance('free', 99).photosLeft, 0);
});

test('a nonsense count is cleaned, an unread one stays unread', () => {
  assert.equal(eventCaptureAllowance('free', -3).photosTaken, 0);
  assert.equal(eventCaptureAllowance('free', 2.9).photosTaken, 2);
  assert.equal(eventCaptureAllowance('free', null).photosTaken, null);
  assert.equal(eventCaptureAllowance('free', null).photosLeft, null);
});

test('the line never prints more than the limit', () => {
  assert.equal(captureLimitLine(eventCaptureAllowance('free', 14)), '10 of 10 photos at this event · Go Plus for unlimited');
});

test('what the camera pill says the plan shoots', () => {
  assert.equal(captureKindWords(eventCaptureAllowance('free', 0).rule), 'photos only');
  assert.equal(captureKindWords(eventCaptureAllowance('pro', 0).rule), 'photos + video');
});
