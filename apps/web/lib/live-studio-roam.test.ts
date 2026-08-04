/**
 * Live Studio ROAM pure-logic invariants (Node built-in test runner, run via
 * tsx). Guards the deterministic, Supabase-free half of lib/live-studio-roam.ts — the
 * public-manifest parsing + selection helpers the event-page picker relies on:
 *
 *   1. PARSE — parseRoamManifest() is an injection barrier: every entry must
 *      carry a real 11-char YouTube video id (else dropped), non-array → [], and
 *      the result is stably ordered by zoneIndex.
 *   2. SELECT — selectFeaturedZone() lands on featured → first-live → first → null.
 *   3. GROUP — groupZonesByVenue() buckets by venue, preserving order.
 *   4. FLAG — liveStudioRoamEnabled() is strict-'true' gated (default OFF).
 *   5. GUEST-PICK — applyGuestPick() is the SERVER-SIDE enforcement boundary for the
 *      host's optional guest-pick switch (Wave 2): off → only the on-air channel is
 *      returned, so the other channels' video ids are never sent to the browser.
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyGuestPick,
  groupZonesByVenue,
  liveStudioRoamEnabled,
  parseRoamManifest,
  selectDefaultChannel,
  selectFeaturedZone,
  selectMainStageZone,
  type RoamManifest,
} from './live-studio-roam';

const VID_A = 'dQw4w9WgXcQ'; // 11 chars — valid
const VID_B = 'abcdefghijk'; // 11 chars — valid
const VID_C = 'ABCDEFGHIJK'; // 11 chars — valid

// ── 1. Parse ──────────────────────────────────────────────────────────────

test('parseRoamManifest keeps valid entries and normalizes fields', () => {
  const m = parseRoamManifest([
    { zoneIndex: 1, label: 'Ceremony', venueLabel: 'Church', videoId: VID_A, featured: true, status: 'live' },
    { zoneIndex: 2, label: 'Reception Floor', videoId: VID_B, status: 'offline' },
  ]);
  assert.equal(m.length, 2);
  assert.equal(m[0]?.label, 'Ceremony');
  assert.equal(m[0]?.venueLabel, 'Church');
  assert.equal(m[0]?.featured, true);
  assert.equal(m[1]?.venueLabel, null); // missing venue → null
  assert.equal(m[1]?.status, 'offline');
  assert.equal(m[0]?.mainStage, false); // absent → not the Main Stage cut
});

test('parseRoamManifest reads the mainStage flag (the Main Stage cut)', () => {
  const m = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A },
    { zoneIndex: 2, label: 'B', videoId: VID_B, mainStage: true },
  ]);
  assert.equal(m[0]?.mainStage, false);
  assert.equal(m[1]?.mainStage, true);
});

test('parseRoamManifest drops entries without a real YouTube video id (injection barrier)', () => {
  const m = parseRoamManifest([
    { zoneIndex: 1, label: 'Good', videoId: VID_A },
    { zoneIndex: 2, label: 'Bad-short', videoId: 'nope' },
    { zoneIndex: 3, label: 'Bad-too-long', videoId: 'abcdefghijkl' }, // 12 chars
    { zoneIndex: 4, label: 'Bad-injection', videoId: 'https://evil' },
    { zoneIndex: 5, label: 'Bad-missing' }, // no videoId
  ]);
  assert.equal(m.length, 1);
  assert.equal(m[0]?.label, 'Good');
});

test('parseRoamManifest drops entries with no usable label', () => {
  const m = parseRoamManifest([
    { zoneIndex: 1, label: '   ', videoId: VID_A },
    { zoneIndex: 2, videoId: VID_B },
  ]);
  assert.equal(m.length, 0);
});

test('parseRoamManifest returns [] for non-array / malformed input', () => {
  assert.deepEqual(parseRoamManifest(null), []);
  assert.deepEqual(parseRoamManifest(undefined), []);
  assert.deepEqual(parseRoamManifest('nope'), []);
  assert.deepEqual(parseRoamManifest({ videoId: VID_A }), []);
  assert.deepEqual(parseRoamManifest([null, 42, 'x']), []);
});

test('parseRoamManifest sorts by zoneIndex ascending', () => {
  const m = parseRoamManifest([
    { zoneIndex: 3, label: 'C', videoId: VID_A },
    { zoneIndex: 1, label: 'A', videoId: VID_B },
    { zoneIndex: 2, label: 'B', videoId: VID_C },
  ]);
  assert.deepEqual(m.map((z) => z.label), ['A', 'B', 'C']);
});

test('parseRoamManifest defaults status to live when absent/invalid', () => {
  const m = parseRoamManifest([{ zoneIndex: 1, label: 'X', videoId: VID_A, status: 'bogus' }]);
  assert.equal(m[0]?.status, 'live');
});

// ── 2. Select featured ────────────────────────────────────────────────────

test('selectFeaturedZone prefers the featured zone', () => {
  const m: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, status: 'live' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, featured: true, status: 'offline' },
  ]);
  assert.equal(selectFeaturedZone(m)?.label, 'B');
});

test('selectFeaturedZone falls back to first live, then first, then null', () => {
  const liveSecond: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, status: 'offline' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, status: 'live' },
  ]);
  assert.equal(selectFeaturedZone(liveSecond)?.label, 'B');

  const noneLive: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, status: 'offline' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, status: 'planned' },
  ]);
  assert.equal(selectFeaturedZone(noneLive)?.label, 'A');

  assert.equal(selectFeaturedZone([]), null);
});

test('selectDefaultChannel is the SAME rule over a non-manifest shape (Wave 5)', () => {
  // The generic the program-output paywall runs over raw channel rows, which have no
  // videoId and therefore cannot be a manifest. Two spellings of "which channel is the
  // default" is how a paywall and a viewer end up disagreeing about which camera is
  // the free one, so selectFeaturedZone delegates to this and both are pinned here.
  type Row = { slot: string; featured: boolean; status: string };
  const rows: Row[] = [
    { slot: 'cam1', featured: false, status: 'offline' },
    { slot: 'cam2', featured: false, status: 'live' },
    { slot: 'cam3', featured: true, status: 'planned' },
  ];
  assert.equal(selectDefaultChannel(rows)?.slot, 'cam3', 'the ★ default wins');
  assert.equal(
    selectDefaultChannel(rows.map((r) => ({ ...r, featured: false })))?.slot,
    'cam2',
    'then the first one actually live',
  );
  assert.equal(
    selectDefaultChannel([{ slot: 'cam1', featured: false, status: 'planned' }])?.slot,
    'cam1',
    'then simply the first',
  );
  assert.equal(selectDefaultChannel([]), null);

  // And it is CUT-BLIND by construction — there is no mainStage field to consult.
  // That is what stops a free host's cuts from moving their program output.
  const m: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, featured: true, status: 'live' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, mainStage: true, status: 'live' },
  ]);
  assert.equal(selectDefaultChannel(m)?.label, 'A');
  assert.equal(selectMainStageZone(m)?.label, 'B', 'the cut-aware selector still honours the cut');
});

// ── 2b. Select Main Stage (the directed cut) ───────────────────────────────

test('selectMainStageZone prefers the zone cut to Main Stage', () => {
  const m: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, featured: true, status: 'live' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, mainStage: true, status: 'live' },
  ]);
  // The live cut (B) wins over the static featured/default (A).
  assert.equal(selectMainStageZone(m)?.label, 'B');
});

test('selectMainStageZone falls back to the featured zone when nothing is cut', () => {
  const m: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, status: 'live' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, featured: true, status: 'live' },
  ]);
  assert.equal(selectMainStageZone(m)?.label, 'B');
});

test('selectMainStageZone falls back to first-live then null on an empty manifest', () => {
  const noneCutOrFeatured: RoamManifest = parseRoamManifest([
    { zoneIndex: 1, label: 'A', videoId: VID_A, status: 'offline' },
    { zoneIndex: 2, label: 'B', videoId: VID_B, status: 'live' },
  ]);
  assert.equal(selectMainStageZone(noneCutOrFeatured)?.label, 'B');
  assert.equal(selectMainStageZone([]), null);
});

// ── 3. Group by venue ─────────────────────────────────────────────────────

test('groupZonesByVenue buckets by venue and preserves order', () => {
  const m = parseRoamManifest([
    { zoneIndex: 1, label: 'Aisle', venueLabel: 'Church', videoId: VID_A },
    { zoneIndex: 2, label: 'Floor', venueLabel: 'Reception', videoId: VID_B },
    { zoneIndex: 3, label: 'Altar', venueLabel: 'Church', videoId: VID_C },
  ]);
  const groups = groupZonesByVenue(m);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.venue, 'Church');
  assert.deepEqual(groups[0]?.zones.map((z) => z.label), ['Aisle', 'Altar']);
  assert.equal(groups[1]?.venue, 'Reception');
});

test('groupZonesByVenue puts venue-less zones under a null group', () => {
  const m = parseRoamManifest([{ zoneIndex: 1, label: 'Main', videoId: VID_A }]);
  const groups = groupZonesByVenue(m);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.venue, null);
});

// ── 4. Flag ───────────────────────────────────────────────────────────────

test('liveStudioRoamEnabled is strict-true gated (default OFF)', () => {
  const prev = process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
    assert.equal(liveStudioRoamEnabled(), false);
    process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'false';
    assert.equal(liveStudioRoamEnabled(), false);
    process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = '1';
    assert.equal(liveStudioRoamEnabled(), false); // only the literal 'true' enables
    process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = 'true';
    assert.equal(liveStudioRoamEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED;
    else process.env.NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED = prev;
  }
});

// ── 5. GUEST-PICK (Wave 2 · owner-locked "make it optional") ───────────────
//
// The switch is enforced BY OMISSION, and these tests are the reason that matters:
// a hidden picker still ships every channel's videoId into the page, so the only
// real enforcement is not sending them. applyGuestPick is that boundary.

const GP_MANIFEST: RoamManifest = [
  { zoneIndex: 1, label: 'Ceremony', venueLabel: 'Church', videoId: VID_A, featured: true, mainStage: false, status: 'live' },
  { zoneIndex: 2, label: 'Reception', venueLabel: 'Hall', videoId: VID_B, featured: false, mainStage: true, status: 'live' },
  { zoneIndex: 3, label: 'Photo booth', venueLabel: 'Hall', videoId: VID_C, featured: false, mainStage: false, status: 'live' },
];

test('guest-pick ON leaves the manifest whole — guests may switch channels', () => {
  const out = applyGuestPick(GP_MANIFEST, true);
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((z) => z.videoId), [VID_A, VID_B, VID_C]);
});

test('guest-pick OFF ships ONLY the on-air channel — the other video ids never leave the server', () => {
  const out = applyGuestPick(GP_MANIFEST, false);
  assert.equal(out.length, 1, 'one entry → the picker cannot render (its length > 1 guard)');
  assert.equal(out[0]?.videoId, VID_B, 'the host cut Reception to Channel 1');
  const shipped = out.map((z) => z.videoId);
  assert.ok(!shipped.includes(VID_A), 'Ceremony id withheld');
  assert.ok(!shipped.includes(VID_C), 'Photo-booth id withheld');
});

test('guest-pick OFF with nothing cut falls back to the featured channel', () => {
  const noCut = GP_MANIFEST.map((z) => ({ ...z, mainStage: false }));
  const out = applyGuestPick(noCut, false);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.videoId, VID_A, 'featured is what Channel 1 carries when nothing is cut');
});

test('guest-pick OFF on an empty manifest is empty — never a crash, never a leak', () => {
  assert.deepEqual(applyGuestPick([], false), []);
  assert.deepEqual(applyGuestPick([], true), []);
});

test('guest-pick OFF on a single-channel event is a no-op', () => {
  const one = [GP_MANIFEST[1]!];
  assert.deepEqual(applyGuestPick(one, false), one);
  assert.deepEqual(applyGuestPick(one, true), one);
});
