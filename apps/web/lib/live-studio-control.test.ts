/**
 * Live Studio CONTROL — unified single-screen controller invariants (Node built-in
 * test runner, run via tsx). Guards the pure route + lock helpers the shared
 * controller and its server actions rely on (lib/live-studio-control.ts):
 *
 *   1. ROUTE   — the customer-facing surface is /studio/live-studio-control (renamed
 *                from live-studio-roam); the legacy segment is retained only for the
 *                redirect that keeps old links alive.
 *   2. LOCKED  — an un-purchased (free) host gets multiCamUnlocked=false + an
 *                "Unlock · <price>" CTA. The free single-camera livestream is NOT
 *                gated by this — this flag only governs the multi-camera extras.
 *   3. UNLOCK  — a host who owns LIVE_STUDIO gets multiCamUnlocked=true.
 *   4. PRICE   — the CTA uses the live catalog price label, and degrades to a bare
 *                "Unlock" on a catalog miss (never a hardcoded number).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  LIVE_STUDIO_SKU,
  LIVE_STUDIO_FEATURE_KEY,
  LIVE_STUDIO_CONTROL_SEGMENT,
  LIVE_STUDIO_LEGACY_SEGMENT,
  liveStudioDetailPath,
  liveStudioControlPath,
  liveStudioControlLock,
} from './live-studio-control';

test('ROUTE — control paths use the renamed segment', () => {
  assert.equal(LIVE_STUDIO_CONTROL_SEGMENT, 'live-studio-control');
  assert.equal(LIVE_STUDIO_LEGACY_SEGMENT, 'live-studio-roam');
  assert.equal(
    liveStudioDetailPath('S89E-abc'),
    '/dashboard/S89E-abc/studio/live-studio-control',
  );
  assert.equal(
    liveStudioControlPath('S89E-abc'),
    '/dashboard/S89E-abc/studio/live-studio-control/setup',
  );
});

test('ROUTE — the internal data key is unchanged by the rename', () => {
  // reviews / stats / detail / recommendations all key off this string.
  assert.equal(LIVE_STUDIO_FEATURE_KEY, 'live-studio-roam');
  assert.equal(LIVE_STUDIO_SKU, 'LIVE_STUDIO');
});

test('LOCKED — a free (un-purchased) host has the multi-cam extras locked', () => {
  const state = liveStudioControlLock(false, '₱2,999');
  assert.equal(state.multiCamUnlocked, false);
  assert.equal(state.unlockCtaLabel, 'Unlock · ₱2,999');
});

test('UNLOCK — a host who owns LIVE_STUDIO has the multi-cam extras unlocked', () => {
  const state = liveStudioControlLock(true, '₱2,999');
  assert.equal(state.multiCamUnlocked, true);
});

test('PRICE — the unlock CTA degrades to a bare "Unlock" on a catalog miss', () => {
  const state = liveStudioControlLock(false, null);
  assert.equal(state.multiCamUnlocked, false);
  assert.equal(state.unlockCtaLabel, 'Unlock');
});
