import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  isBroadcastCaptureRoute,
  isConsentSuppressedRoute,
} from './capture-safe-routes';

/**
 * Unit tests for the global-chrome route gates (capture-safe-routes.ts).
 *
 * Two failure modes, both expensive, pull in opposite directions:
 *   - TOO NARROW → chrome draws on `/panood/program/[eventId]`, the window OBS
 *     captures, and goes out live on the couple's broadcast.
 *   - TOO WIDE  → a visitor is never asked for analytics consent at all, which
 *     is an RA 10173 problem, not a cosmetic one.
 * These cases lock both edges, for both predicates.
 */

// ── 1. The OBS-captured program output — the leak this gate exists for ───────
test('/panood/program/[eventId] is suppressed', () => {
  assert.equal(isConsentSuppressedRoute('/panood/program/S89E-ABCDEFGHJK'), true);
});

// ── 2. The host's full-screen Live Studio controller (Wave 8) ────────────────
test('/panood/control/[eventId] is suppressed', () => {
  assert.equal(isConsentSuppressedRoute('/panood/control/S89E-ABCDEFGHJK'), true);
});

// ── 3. Exact-prefix: a sibling segment must never be swallowed ───────────────
test('a sibling route sharing the prefix is NOT suppressed', () => {
  // The trailing slash is the boundary: /panood/programme is a different route.
  assert.equal(isConsentSuppressedRoute('/panood/programme'), false);
  assert.equal(isConsentSuppressedRoute('/panood/programme/S89E-ABCDEFGHJK'), false);
  assert.equal(isConsentSuppressedRoute('/panood/controls'), false);
  assert.equal(isConsentSuppressedRoute('/panood/controls/S89E-ABCDEFGHJK'), false);
});

test('the bare segment (a 404, not a capture surface) is NOT suppressed', () => {
  assert.equal(isConsentSuppressedRoute('/panood/program'), false);
  assert.equal(isConsentSuppressedRoute('/panood/control'), false);
});

test('the prefix must be at the START of the path', () => {
  assert.equal(isConsentSuppressedRoute('/embed/panood/program/S89E-ABC'), false);
});

// ── 4. RA 10173 — the banner still shows everywhere else ─────────────────────
test('the camera-join page KEEPS the banner (may be the only page a guest opens)', () => {
  // /panood/cam/ is not a capture surface (the published media is a
  // getUserMedia camera track), and a helper who opens it may never visit
  // another Setnayan route — suppressing here would mean never asking them.
  assert.equal(isConsentSuppressedRoute('/panood/cam/abc123'), false);
});

test('other panood routes keep the banner', () => {
  assert.equal(isConsentSuppressedRoute('/panood'), false);
  assert.equal(isConsentSuppressedRoute('/panood/demo/abc123'), false);
});

test('representative normal routes keep the banner', () => {
  for (const path of [
    '/',
    '/pricing',
    '/explore',
    '/login',
    '/cookies',
    '/help/what-is-papic',
    '/dashboard/S89E-ABCDEFGHJK',
    '/dashboard/S89E-ABCDEFGHJK/studio/panood/broadcast',
    '/vendor-dashboard',
    '/admin/data-privacy',
    '/juan-and-maria',
  ]) {
    assert.equal(isConsentSuppressedRoute(path), false, `${path} must keep the banner`);
  }
});

// ── 5. Pre-hydration / defensive inputs ──────────────────────────────────────
test('null / undefined / empty pathname is not suppressed', () => {
  assert.equal(isConsentSuppressedRoute(null), false);
  assert.equal(isConsentSuppressedRoute(undefined), false);
  assert.equal(isConsentSuppressedRoute(''), false);
});

// ── 6. isBroadcastCaptureRoute — the narrower "an encoder sees this" gate ────
test('isBroadcastCaptureRoute covers ONLY the OBS-captured program output', () => {
  assert.equal(isBroadcastCaptureRoute('/panood/program/S89E-ABCDEFGHJK'), true);
  // The controller is NOT captured — it is excluded from the consent banner for
  // a different reason, and other chrome may legitimately draw there.
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
