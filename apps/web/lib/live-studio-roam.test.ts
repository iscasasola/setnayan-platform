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
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  groupZonesByVenue,
  liveStudioRoamEnabled,
  parseRoamManifest,
  selectFeaturedZone,
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
