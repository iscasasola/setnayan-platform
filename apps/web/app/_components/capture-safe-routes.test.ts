import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isBroadcastCaptureRoute, isRoomDisplayRoute } from './capture-safe-routes';

/**
 * Unit tests for the global-chrome route gates (capture-safe-routes.ts).
 *
 * TOO NARROW → chrome draws on `/panood/program/[eventId]`, the window OBS
 * captures, and goes out live on the couple's broadcast. These cases lock the
 * edge for both predicates.
 */

// ── 6. isBroadcastCaptureRoute — the narrower "an encoder sees this" gate ────
test('isBroadcastCaptureRoute covers ONLY the OBS-captured program output', () => {
  assert.equal(isBroadcastCaptureRoute('/panood/program/S89E-ABCDEFGHJK'), true);
  // The controller is NOT captured — other chrome may legitimately draw there.
  assert.equal(isBroadcastCaptureRoute('/panood/control/S89E-ABCDEFGHJK'), false);
});

test('isBroadcastCaptureRoute is exact-prefix and defensive too', () => {
  assert.equal(isBroadcastCaptureRoute('/panood/programme/S89E-ABC'), false);
  assert.equal(isBroadcastCaptureRoute('/panood/program'), false);
  assert.equal(isBroadcastCaptureRoute('/embed/panood/program/S89E-ABC'), false);
  assert.equal(isBroadcastCaptureRoute('/panood/cam/abc123'), false);
  assert.equal(isBroadcastCaptureRoute('/'), false);
  assert.equal(isBroadcastCaptureRoute(null), false);
  assert.equal(isBroadcastCaptureRoute(undefined), false);
  assert.equal(isBroadcastCaptureRoute(''), false);
});

test('DAY-12: a paired venue screen is a room display — a room watches it, nobody can dismiss anything', () => {
  assert.equal(isRoomDisplayRoute('/live/screen'), true);
});

test('DAY-12: the /live pairing page is not a room display — a person is there', () => {
  assert.equal(isRoomDisplayRoute('/live'), false);
  assert.equal(isRoomDisplayRoute('/live/screens'), false, 'exact path, not a prefix');
  assert.equal(isRoomDisplayRoute('/live/screen/extra'), false);
  assert.equal(isRoomDisplayRoute(null), false);
});

test('DAY-12: the venue screen is not an encoder-capture surface — the two reasons stay separate', () => {
  assert.equal(isBroadcastCaptureRoute('/live/screen'), false);
});
