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
 * Plus the WAVE 1 single-screen LAYOUT invariants (owner-approved prototype
 * 2026-07-25 · Live_Studio_Unified_Spec § 4b) — the channel numbering and the
 * free/paid grid gate:
 *
 *   5. CHANNELS — Channel 1 is the controlled screen; cameras are CH 2+, numbered
 *                 from their own zone_index so a delete cannot renumber a channel
 *                 under the operator's thumb mid-show.
 *   6. GATE     — a free host's grid contains NO cuttable tile (the UI cannot even
 *                 offer the action the server would reject), yet keeps exactly ONE
 *                 usable free camera channel at CH 2.
 *   7. TALLY    — red is on-air truth: a cut with the broadcast off air is not red.
 *   8. CAP      — 12 configured cameras render 12 channels, and the cap closes.
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
  PROGRAM_CHANNEL,
  PROGRAM_CHANNEL_LABEL,
  FIRST_CAMERA_CHANNEL,
  FREE_CAMERA_NAME,
  LOCKED_PLACEHOLDER_NAMES,
  buildChannelTiles,
  channelForZoneIndex,
  formatChannel,
  liveStudioDetailPath,
  liveStudioControlPath,
  liveStudioControlLock,
  type ControlZone,
} from './live-studio-control';
import { MAX_ROAM_ZONES, canAddZone } from './live-studio-roam-zones';

/** A configured camera channel, defaults off. */
function zone(over: Partial<ControlZone> & { id: number; zone_index: number }): ControlZone {
  return {
    label: `Camera ${over.zone_index}`,
    venue_label: null,
    is_featured: false,
    is_main_stage: false,
    ...over,
  };
}

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

/* ──────────────────────────────────────────────────────────────────────────────
   WAVE 1 · the approved single-screen layout
   ────────────────────────────────────────────────────────────────────────────── */

test('CHANNELS — CH 1 is the controlled screen; cameras start at CH 2', () => {
  assert.equal(PROGRAM_CHANNEL, 1);
  assert.equal(FIRST_CAMERA_CHANNEL, 2);
  assert.equal(PROGRAM_CHANNEL_LABEL, 'CH 1 · Controlled screen');
  assert.equal(channelForZoneIndex(1), 2);
  assert.equal(channelForZoneIndex(4), 5);
  assert.equal(formatChannel(3, 'Garden Aisle'), 'CH 3 · Garden Aisle');
});

test('CHANNELS — numbers come from zone_index, so a delete never renumbers a channel', () => {
  // Zone 3 was removed: the host keeps CH 2 and CH 5. A positional scheme would
  // silently slide CH 5 down to CH 3 mid-celebration.
  const tiles = buildChannelTiles({
    zones: [zone({ id: 10, zone_index: 1 }), zone({ id: 40, zone_index: 4 })],
    multiCamUnlocked: true,
    isLive: false,
  });
  assert.deepEqual(
    tiles.map((t) => t.channel),
    [2, 5],
  );
});

test('UNLOCKED — every configured camera is a host-named, cuttable channel', () => {
  const tiles = buildChannelTiles({
    zones: [
      zone({ id: 1, zone_index: 1, label: 'Main Stage', venue_label: 'Reception Hall', is_featured: true }),
      zone({ id: 2, zone_index: 2, label: 'Garden Aisle' }),
    ],
    multiCamUnlocked: true,
    isLive: false,
  });
  assert.equal(tiles.length, 2);
  assert.ok(tiles.every((t) => t.cuttable && !t.locked && t.zoneId !== null));
  // The host's OWN name + venue is what renders — never a generated label.
  assert.equal(tiles[0]!.name, 'Main Stage');
  assert.equal(tiles[0]!.venue, 'Reception Hall');
  assert.equal(tiles[0]!.featured, true);
  assert.equal(tiles[1]!.featured, false);
});

test('GATE — a free host gets ONE usable camera channel at CH 2 and nothing cuttable', () => {
  const tiles = buildChannelTiles({ zones: [], multiCamUnlocked: false, isLive: false });

  // Exactly one free, usable channel — the host's own camera, at CH 2.
  const free = tiles.filter((t) => t.kind === 'free');
  assert.equal(free.length, 1);
  assert.equal(free[0]!.channel, FIRST_CAMERA_CHANNEL);
  assert.equal(free[0]!.name, FREE_CAMERA_NAME);
  assert.equal(free[0]!.locked, false);
  assert.equal(free[0]!.onProgram, true, 'the free camera IS what Channel 1 carries');

  // THE gate: no tile a free host sees renders a cut control.
  assert.ok(
    tiles.every((t) => t.cuttable === false),
    'a free host must not be offered a cut the server would reject',
  );
  // Everything past the free channel is locked, and locked tiles start at CH 3 so
  // nothing collides with the free CH 2.
  const locked = tiles.filter((t) => t.locked);
  assert.equal(locked.length, LOCKED_PLACEHOLDER_NAMES.length);
  assert.deepEqual(
    locked.map((t) => t.channel),
    [3, 4, 5],
  );
  assert.ok(locked.every((t) => t.kind === 'placeholder' && t.zoneId === null));
});

test('GATE — a lapsed host keeps seeing their real channel names, locked and uncuttable', () => {
  const tiles = buildChannelTiles({
    zones: [
      zone({ id: 7, zone_index: 1, label: 'Church Altar', is_main_stage: true, is_featured: true }),
      zone({ id: 8, zone_index: 2, label: 'Sweetheart Table' }),
    ],
    multiCamUnlocked: false,
    isLive: true,
  });
  assert.equal(tiles.length, 3, 'free camera + their two real channels');
  assert.ok(tiles.every((t) => t.cuttable === false));
  const locked = tiles.filter((t) => t.locked);
  assert.deepEqual(
    locked.map((t) => t.name),
    ['Church Altar', 'Sweetheart Table'],
  );
  // A stale is_main_stage / is_featured must not light a locked tile up.
  assert.ok(locked.every((t) => !t.onProgram && !t.tally && !t.featured));
  // The free camera still carries the tally while the free stream is live.
  assert.equal(tiles[0]!.tally, true);
});

test('TALLY — red needs BOTH the cut and a live broadcast', () => {
  const zones = [zone({ id: 1, zone_index: 1, is_main_stage: true }), zone({ id: 2, zone_index: 2 })];

  const offAir = buildChannelTiles({ zones, multiCamUnlocked: true, isLive: false });
  assert.equal(offAir[0]!.onProgram, true, 'it is on Channel 1…');
  assert.equal(offAir[0]!.tally, false, '…but nothing is on air, so nothing is red');

  const onAir = buildChannelTiles({ zones, multiCamUnlocked: true, isLive: true });
  assert.equal(onAir[0]!.tally, true);
  assert.equal(onAir[1]!.tally, false, 'only the cut channel is red');
  assert.equal(
    onAir.filter((t) => t.tally).length,
    1,
    'exactly one red tile — tally discipline',
  );
});

test('CAP — a full 12-camera grid renders 12 channels and closes the cap', () => {
  const zones = Array.from({ length: MAX_ROAM_ZONES }, (_, i) =>
    zone({ id: i + 1, zone_index: i + 1 }),
  );
  const tiles = buildChannelTiles({ zones, multiCamUnlocked: true, isLive: false });
  assert.equal(tiles.length, MAX_ROAM_ZONES);
  assert.equal(tiles[0]!.channel, 2);
  assert.equal(tiles[MAX_ROAM_ZONES - 1]!.channel, MAX_ROAM_ZONES + 1);
  assert.equal(new Set(tiles.map((t) => t.key)).size, MAX_ROAM_ZONES, 'keys are unique');
  assert.equal(canAddZone(zones.length), false, 'the Add-camera tile must not render');
});
