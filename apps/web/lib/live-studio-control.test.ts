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
 *                gated by this — this flag only governs BROADCASTING multi-cam.
 *   3. UNLOCK  — a host who owns LIVE_STUDIO gets multiCamUnlocked=true.
 *   4. PRICE   — the CTA uses the live catalog price label, and degrades to a bare
 *                "Unlock" on a catalog miss (never a hardcoded number).
 *
 * Plus the single-screen LAYOUT invariants (owner-approved prototype 2026-07-25 ·
 * Live_Studio_Unified_Spec § 4b) as REVISED BY WAVE 3 (§ 4d "rehearse free, pay to
 * broadcast" + the owner's "but they can still see it"):
 *
 *   5. CHANNELS   — Channel 1 is the controlled screen; cameras are CH 2+, numbered
 *                   from their own zone_index so a delete cannot renumber a channel
 *                   under the operator's thumb mid-show.
 *   6. REHEARSE   — ⚠ REVERSES the old Wave 1 "GATE" tests. An un-entitled host's
 *                   grid is FULLY usable: every configured camera is cuttable, at
 *                   full brightness, with no padlock and no hidden tile. The
 *                   paywall is publication (lib/live-studio-publish.ts), not the
 *                   mechanic.
 *   7. NUDGE      — "Unlock to broadcast" appears only for an un-entitled host, only
 *                   on a 2nd+ camera, and only once they have ENGAGED it (put it on
 *                   Channel 1). It is a label beside a cut that already succeeded.
 *   8. TALLY      — red is on-air truth: a cut with the broadcast off air is not red.
 *   9. CAP        — 12 configured cameras render 12 channels, and the cap closes.
 *  10. READY      — the tile states the channel's REAL join state; no faked preview.
 *
 * Plus WAVE 6 "one controller" (owner 2026-07-25 · §§ 4b–4d):
 *
 *  11. ROUTER     — every doorway resolves its control-room href through ONE
 *                   flag-aware function, so the legacy Cast room and the unified
 *                   controller can never be half-switched. Flag off = the legacy
 *                   room, exactly as today; flag on = the unified controller.
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
  UNLOCK_TO_BROADCAST_LABEL,
  buildChannelTiles,
  channelForZoneIndex,
  channelReadyCaption,
  formatChannel,
  liveStudioDetailPath,
  liveStudioControlPath,
  liveStudioControlLegacyPath,
  liveStudioControlLock,
  liveStudioControllerHref,
  liveStudioControllerHrefFor,
  panoodBroadcastPath,
  rehearseFreeNotice,
  showRehearsalUnlockNotice,
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
    status: 'planned',
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
  // ⭐ WAVE 8 (§ 4g): the CONTROLLER left /dashboard so it can render chrome-less
  // (an App Router page cannot opt out of an ancestor layout). The detail/buy page
  // above is unchanged — it is a normal dashboard surface and keeps its chrome.
  assert.equal(liveStudioControlPath('S89E-abc'), '/panood/control/S89E-abc');
  assert.equal(
    liveStudioControlLegacyPath('S89E-abc'),
    '/dashboard/S89E-abc/studio/live-studio-control/setup',
  );
});

/* ──────────────────────────────────────────────────────────────────────────────
   ⭐ WAVE 8 — the chrome-less escape (owner-locked 2026-07-25 · § 4g)
   ────────────────────────────────────────────────────────────────────────────── */

test('WAVE 8 — the controller is NOT under /dashboard (that is the whole escape)', () => {
  // `/dashboard/[eventId]/layout.tsx` mounts the SidebarShell top bar, the
  // CustomerBottomNav, the nav FAB and the section sub-nav, and a page cannot opt
  // out of an ancestor layout. Living under /dashboard IS the chrome. If this
  // assertion ever fails, the masthead and bottom nav are back.
  const href = liveStudioControlPath('S89E-abc');
  assert.ok(!href.startsWith('/dashboard'), href);
  assert.ok(href.startsWith('/panood/'), href);
});

test('WAVE 8 — it reuses the /panood namespace the program pop-out already escapes through', () => {
  // Same precedent, not a second mechanism: /panood/program/[eventId] is already a
  // top-level chrome-less route, and `panood` is already a RESERVED top-level slug,
  // so this can never shadow a vendor or event slug.
  assert.match(liveStudioControlPath('S89E-abc'), /^\/panood\/control\//);
});

test('WAVE 8 — the OLD dashboard URL is still addressable, for the redirect only', () => {
  // The stub at the old path redirects here. Nothing links to it.
  assert.notEqual(liveStudioControlLegacyPath('E1'), liveStudioControlPath('E1'));
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
  assert.ok(tiles.every((t) => t.cuttable && t.zoneId !== null));
  // The host's OWN name + venue is what renders — never a generated label.
  assert.equal(tiles[0]!.name, 'Main Stage');
  assert.equal(tiles[0]!.venue, 'Reception Hall');
  assert.equal(tiles[0]!.featured, true);
  assert.equal(tiles[1]!.featured, false);
});

/* ──────────────────────────────────────────────────────────────────────────────
   WAVE 3 · rehearse free, pay to broadcast (owner-locked 2026-07-25 · § 4d)

   ⚠ These tests deliberately REVERSE the Wave 1 "GATE" assertions they replaced
   ("a free host must not be offered a cut", "locked tiles start at CH 3", "a lapsed
   host's tiles are locked and uncuttable"). Under § 4d a free host cutting between
   their own cameras at their own rehearsal is the PRODUCT, not a hole: nothing they
   do here is published, and publication is where the money gate now lives
   (lib/live-studio-publish.ts). If a future change makes any of these pass again,
   the paywall has silently moved back onto the mechanic.
   ────────────────────────────────────────────────────────────────────────────── */

test('REHEARSE — an un-entitled host with no cameras still gets their own free channel at CH 2', () => {
  const tiles = buildChannelTiles({ zones: [], multiCamUnlocked: false, isLive: false });

  assert.equal(tiles.length, 1, 'no invented placeholder cameras — no fake doors');
  assert.equal(tiles[0]!.kind, 'free');
  assert.equal(tiles[0]!.channel, FIRST_CAMERA_CHANNEL);
  assert.equal(tiles[0]!.name, FREE_CAMERA_NAME);
  assert.equal(tiles[0]!.onProgram, true, 'their own camera IS what Channel 1 carries');
  assert.equal(tiles[0]!.cuttable, false, 'already on CH 1 — nothing to cut to');
  assert.equal(tiles[0]!.nudgeUnlock, false, 'one camera is free — nothing to sell');
});

test('REHEARSE — an un-entitled host CAN cut between every camera they configured', () => {
  const tiles = buildChannelTiles({
    zones: [
      zone({ id: 7, zone_index: 1, label: 'Church Altar', is_featured: true }),
      zone({ id: 8, zone_index: 2, label: 'Sweetheart Table' }),
      zone({ id: 9, zone_index: 3, label: 'Photo Booth' }),
    ],
    multiCamUnlocked: false,
    isLive: false,
  });

  assert.equal(tiles.length, 3, 'their real channels, all of them');
  assert.ok(
    tiles.every((t) => t.cuttable && t.zoneId !== null),
    'rehearsal is free — every configured camera is a real cut control',
  );
  // Their own names, their own default, their own channel numbers — identical to a
  // paid host's grid.
  assert.deepEqual(tiles.map((t) => t.name), ['Church Altar', 'Sweetheart Table', 'Photo Booth']);
  assert.deepEqual(tiles.map((t) => t.channel), [2, 3, 4]);
  assert.equal(tiles[0]!.featured, true);
});

test('VISIBLE — an un-entitled host has NO hidden, dimmed or padlocked tile', () => {
  const zones = [
    zone({ id: 1, zone_index: 1, label: 'Ceremony' }),
    zone({ id: 2, zone_index: 2, label: 'Reception floor' }),
  ];
  const free = buildChannelTiles({ zones, multiCamUnlocked: false, isLive: false });
  const paid = buildChannelTiles({ zones, multiCamUnlocked: true, isLive: false });

  // Owner: "but they can still see it." The un-entitled grid must be the SAME grid.
  assert.equal(free.length, paid.length);
  assert.deepEqual(free.map((t) => t.name), paid.map((t) => t.name));
  assert.deepEqual(free.map((t) => t.channel), paid.map((t) => t.channel));
  assert.deepEqual(free.map((t) => t.cuttable), paid.map((t) => t.cuttable));

  // And the field that used to drive the grey-out + 🔒 badge is gone entirely, so
  // there is nothing for a future edit to key a blackout off.
  assert.ok(
    free.every((t) => !('locked' in t)),
    'ChannelTile.locked must stay deleted — it was the dimming/padlock switch',
  );
});

test('NUDGE — "Unlock to broadcast" fires only once an un-entitled host engages a 2nd+ camera', () => {
  const base = [
    zone({ id: 1, zone_index: 1, label: 'Ceremony' }),
    zone({ id: 2, zone_index: 2, label: 'Garden Aisle' }),
    zone({ id: 3, zone_index: 3, label: 'Photo Booth' }),
  ];

  // Page load, nothing engaged → no nudge anywhere. It is not a static padlock.
  const idle = buildChannelTiles({ zones: base, multiCamUnlocked: false, isLive: false });
  assert.ok(idle.every((t) => !t.nudgeUnlock), 'no nudge before they engage anything');

  // They put the FIRST camera on Channel 1 — that one is free to broadcast, so
  // still nothing to sell.
  const first = buildChannelTiles({
    zones: [{ ...base[0]!, is_main_stage: true }, base[1]!, base[2]!],
    multiCamUnlocked: false,
    isLive: false,
  });
  assert.ok(first.every((t) => !t.nudgeUnlock), 'the first camera is the free one');

  // They cut to the SECOND camera → the nudge lands, on that tile only.
  const second = buildChannelTiles({
    zones: [base[0]!, { ...base[1]!, is_main_stage: true }, base[2]!],
    multiCamUnlocked: false,
    isLive: false,
  });
  assert.deepEqual(second.map((t) => t.nudgeUnlock), [false, true, false]);
  // ⚠ NUDGE ≠ BLOCK: the cut it comments on has already happened, and the tile is
  // still a live control.
  assert.equal(second[1]!.onProgram, true, 'the cut succeeded');
  assert.ok(second.every((t) => t.cuttable), 'every tile is still cuttable');
});

test('NUDGE — a host who owns LIVE_STUDIO never sees it', () => {
  const tiles = buildChannelTiles({
    zones: [
      zone({ id: 1, zone_index: 1 }),
      zone({ id: 2, zone_index: 2, is_main_stage: true }),
    ],
    multiCamUnlocked: true,
    isLive: true,
  });
  assert.ok(tiles.every((t) => !t.nudgeUnlock));
});

test('NUDGE — the boundary is ordinal, not channel number (a deleted CH 2 must not nudge)', () => {
  // The host deleted their first camera. Their ONE remaining camera is CH 4 — and
  // one camera is free to broadcast, so engaging it must not ask them for money.
  const tiles = buildChannelTiles({
    zones: [zone({ id: 9, zone_index: 3, label: 'Garden Aisle', is_main_stage: true })],
    multiCamUnlocked: false,
    isLive: false,
  });
  assert.equal(tiles[0]!.channel, 4);
  assert.equal(tiles[0]!.ordinal, 0);
  assert.equal(tiles[0]!.nudgeUnlock, false);
});

test('COPY — the boundary is "Unlock to broadcast", never "unlock to use"', () => {
  // Under rehearse-free the host genuinely CAN use these cameras, so "unlock to
  // use" would be a lie told while they are using it.
  assert.equal(UNLOCK_TO_BROADCAST_LABEL, 'Unlock to broadcast');
  assert.ok(!/to use/i.test(UNLOCK_TO_BROADCAST_LABEL));
});

test('NOTICE — the go-live line appears only when there is something they cannot broadcast', () => {
  assert.equal(showRehearsalUnlockNotice({ owned: false, configuredChannels: 0 }), false);
  assert.equal(
    showRehearsalUnlockNotice({ owned: false, configuredChannels: 1 }),
    false,
    'one camera is free — a paywall over it would be a fake gate',
  );
  assert.equal(showRehearsalUnlockNotice({ owned: false, configuredChannels: 2 }), true);
  assert.equal(showRehearsalUnlockNotice({ owned: true, configuredChannels: 9 }), false);
});

test('NOTICE — the price comes from the catalog and degrades rather than inventing one', () => {
  assert.equal(
    rehearseFreeNotice('₱2,999'),
    'Rehearse free · Unlock ₱2,999 to broadcast all your cameras',
  );
  const noPrice = rehearseFreeNotice(null);
  assert.ok(noPrice.startsWith('Rehearse free · Unlock to broadcast'));
  assert.ok(!/\d/.test(noPrice), 'a catalog miss must never surface a hardcoded number');
});

test('READY — a tile states the channel’s real join state, and never invents one', () => {
  // Nothing writes anything but the 'planned' insert default today, so the honest
  // caption for a freshly added camera is "waiting", not "3 cameras are here".
  assert.equal(channelReadyCaption('planned'), 'Waiting for a camera');
  assert.equal(channelReadyCaption(null), 'Waiting for a camera');
  assert.equal(channelReadyCaption('live'), 'Camera connected');
  assert.equal(channelReadyCaption('offline'), 'Camera dropped out');
  assert.equal(channelReadyCaption('disabled'), 'Turned off');

  const tiles = buildChannelTiles({
    zones: [zone({ id: 1, zone_index: 1, status: 'live' })],
    multiCamUnlocked: false,
    isLive: false,
  });
  assert.equal(tiles[0]!.status, 'live', 'the real column reaches the tile');
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

/* ──────────────────────────────────────────────────────────────────────────────
   WAVE 6 · ONE CONTROLLER — the flag-aware doorway router
   (owner 2026-07-25 · Live_Studio_Unified_Spec §§ 4b–4d.)

   Two control rooms exist in the tree while the consolidation is dark: the LEGACY
   Cast room (/studio/panood/broadcast — live and selling) and the UNIFIED
   controller (/panood/control/[eventId] since Wave 8). Six doorways link to "the
   control room", and the switchover has to be ATOMIC — a doorway left pointing at
   a room that now redirects, or a host mid-show landing on the wrong screen, is
   the failure that matters. These lock the single router every doorway calls.
   ────────────────────────────────────────────────────────────────────────────── */

test('ROUTER — flag OFF resolves to the LEGACY Cast control room, unchanged', () => {
  assert.equal(
    liveStudioControllerHrefFor('S89E-abc', false),
    '/dashboard/S89E-abc/studio/panood/broadcast',
  );
  assert.equal(liveStudioControllerHrefFor('S89E-abc', false), panoodBroadcastPath('S89E-abc'));
});

test('ROUTER — flag ON resolves to the UNIFIED controller', () => {
  assert.equal(liveStudioControllerHrefFor('S89E-abc', true), '/panood/control/S89E-abc');
  assert.equal(liveStudioControllerHrefFor('S89E-abc', true), liveStudioControlPath('S89E-abc'));
});

test('ROUTER — the two rooms are never the same URL (no accidental self-redirect)', () => {
  // The legacy page redirects to liveStudioControlPath when the flag is on. If
  // these ever collided, that redirect would be a loop.
  assert.notEqual(panoodBroadcastPath('E1'), liveStudioControlPath('E1'));
});

test('ROUTER — the env wrapper reads the launch flag, and only "true" flips it', () => {
  const prior = process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
    assert.equal(
      liveStudioControllerHref('E1'),
      panoodBroadcastPath('E1'),
      'unset = today = the legacy room',
    );

    process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'false';
    assert.equal(liveStudioControllerHref('E1'), panoodBroadcastPath('E1'));

    // A value that does not mean yes must NOT retire a live, selling surface.
    process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'ture';
    assert.equal(liveStudioControllerHref('E1'), panoodBroadcastPath('E1'));

    // …but every spelling that plainly means yes must flip it, or an owner who
    // typed TRUE gets a silent no-op — the bug lib/env-flag.ts exists to close.
    for (const v of ['true', 'TRUE', '1', 'yes', 'on']) {
      process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = v;
      assert.equal(liveStudioControllerHref('E1'), liveStudioControlPath('E1'), `"${v}" must flip it`);
    }
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
    else process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = prior;
  }
});

test('ROUTER — the resolved room is always a real route scoped to this event', () => {
  for (const enabled of [false, true]) {
    const href = liveStudioControllerHrefFor('S89E-zzz', enabled);
    // ⭐ WAVE 8: the invariant is EVENT SCOPING, not the /dashboard prefix. The
    // unified controller deliberately lives outside /dashboard so it can render
    // chrome-less (§ 4g); the legacy Cast room still lives inside it. Both must
    // carry this event's id and neither may be the sales page.
    assert.ok(href.includes('S89E-zzz'), href);
    assert.ok(href.startsWith('/'), href);
    assert.ok(!href.includes('undefined'), href);
    // Never the DETAIL/buy page — a doorway labelled "control room" must open the
    // control room, not the sales surface.
    assert.notEqual(href, liveStudioDetailPath('S89E-zzz'));
  }
});
