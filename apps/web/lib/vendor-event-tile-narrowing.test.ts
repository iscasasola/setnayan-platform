/**
 * Regression suite for the event-tile narrowing vocabulary bug.
 *
 * THE DEFECT (found in production 2026-07-30, on the seeded song-desk fixture):
 * the day-of surfaces narrow a vendor's own service tiles to "the tiles booked
 * on THIS event". The event-side signal is
 * `get_vendor_event_brief().booked_categories`, which speaks the COUPLE-SIDE
 * category vocabulary (`band_dj`, `planner_coordinator`, `host_emcee`), while
 * `vendor_profiles.services` speaks the TILE vocabulary (`live_band`,
 * `coordinator`, `host_mc`). They were intersected directly with `Set.has()`.
 *
 * `live_band` ∉ {`band_dj`} — so narrowing excluded every tile, the resolver
 * returned `null`, and ALL THREE specialization desks were unreachable for
 * every booked vendor. The symptom was silent: the gate returned `{ok:false}`
 * and the inbox rendered "no requests yet" while three sat in the table.
 *
 * These tests assert the translation, and — the part that actually protects us —
 * the END-TO-END composition, so reverting either the translation or the
 * empty-array guard turns this suite red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tilesForVendorCategories } from './vendor-category-taxonomy';
import { specializationSetForServices } from './vendor-specialization-gate';
import { familiesForServices } from './vendor-dayof-modules';

// ─── The translation itself ─────────────────────────────────────────────────

test('band_dj maps to the music tiles services actually holds', () => {
  const tiles = tilesForVendorCategories(['band_dj']);
  assert.ok(tiles, 'must not be null — band_dj is mappable');
  assert.ok(tiles.includes('live_band'), 'live_band is what services[] stores');
  assert.ok(tiles.includes('dj'), 'band_dj is a coarse alias spanning both');
});

test('the other two specialization categories translate too', () => {
  assert.deepEqual(tilesForVendorCategories(['planner_coordinator']), ['coordinator']);
  assert.deepEqual(tilesForVendorCategories(['host_emcee']), ['host_mc']);
});

test('absent input does not narrow', () => {
  assert.equal(tilesForVendorCategories(null), null);
  assert.equal(tilesForVendorCategories(undefined), null);
});

test('a category that maps to no tile yields null, never an empty array', () => {
  // `misc` is bucket C (exempt). Returning [] here would re-create the bug at
  // one remove: an empty array is truthy and narrows everything away.
  assert.equal(tilesForVendorCategories(['misc']), null);
  assert.equal(tilesForVendorCategories([]), null);
});

test('unrecognised values pass through rather than being dropped', () => {
  assert.deepEqual(tilesForVendorCategories(['live_band']), ['live_band']);
});

test('garbage in the array cannot throw', () => {
  const junk = [null, 42, {}, 'band_dj'] as unknown as string[];
  assert.ok(tilesForVendorCategories(junk)?.includes('live_band'));
});

// ─── END-TO-END: the composition that was actually broken ───────────────────
// Each case is the real production shape: services[] from vendor_profiles,
// booked_categories[] from the RPC. Reverting the fix turns these red.

test('a booked live band resolves to the song desk (the prod defect)', () => {
  const services = ['live_band']; // vendor_profiles.services
  const booked = ['band_dj']; //    get_vendor_event_brief().booked_categories
  assert.equal(
    specializationSetForServices(services, tilesForVendorCategories(booked)),
    'song_desk',
  );
});

test('a booked coordinator resolves to floor command', () => {
  assert.equal(
    specializationSetForServices(['coordinator'], tilesForVendorCategories(['planner_coordinator'])),
    'floor_command',
  );
});

test('a booked emcee resolves to stage script', () => {
  assert.equal(
    specializationSetForServices(['host_mc'], tilesForVendorCategories(['host_emcee'])),
    'stage_script',
  );
});

test('narrowing still REFINES a multi-role vendor to their booked role', () => {
  // The feature the narrowing exists for must survive the fix: a supplier who
  // does both coordination and music, booked as the band, gets the song desk.
  const both = ['coordinator', 'live_band'];
  assert.equal(
    specializationSetForServices(both, tilesForVendorCategories(['band_dj'])),
    'song_desk',
  );
  assert.equal(
    specializationSetForServices(both, tilesForVendorCategories(['planner_coordinator'])),
    'floor_command',
  );
});

// ─── The empty-array guard, asserted directly ───────────────────────────────

test('an empty tile list does not narrow a vendor out of their specialization', () => {
  assert.equal(specializationSetForServices(['live_band'], []), 'song_desk');
});

test('an empty tile list does not hide every day-of family', () => {
  assert.ok(familiesForServices(['live_band'], []).size > 0);
});

test('a REAL narrowing still excludes a tile the vendor was not booked for', () => {
  // The guard must not become "never narrow" — a non-empty, non-matching set
  // still has to exclude, or the narrowing feature is gone.
  assert.equal(specializationSetForServices(['live_band'], ['coordinator']), null);
});
