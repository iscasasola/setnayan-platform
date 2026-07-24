/**
 * Live Studio ROAM controller channel-config invariants (Node built-in test runner,
 * run via tsx). Guards the pure zone-setup helpers the controller + its server actions
 * rely on (lib/live-studio-roam-zones.ts):
 *
 *   1. LABEL — normalizeZoneLabel trims/collapses/caps and rejects empty.
 *   2. VENUE — normalizeVenueLabel is optional (empty → null).
 *   3. INDEX — computeNextZoneIndex allocates max+1, 1 on empty, gap-tolerant.
 *   4. CAP   — canAddZone honors MAX_ROAM_ZONES.
 *   5. INPUT — normalizeZoneInput is the create/update choke point (label required,
 *              venue optional, featured coerced).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_ROAM_ZONES,
  ROAM_ZONE_LABEL_MAX,
  canAddZone,
  computeNextZoneIndex,
  normalizeVenueLabel,
  normalizeZoneInput,
  normalizeZoneLabel,
} from './live-studio-roam-zones';

// ── 1. Label ────────────────────────────────────────────────────────────────

test('normalizeZoneLabel trims, collapses inner whitespace, caps length', () => {
  assert.equal(normalizeZoneLabel('  Ceremony  '), 'Ceremony');
  assert.equal(normalizeZoneLabel('Reception    Floor'), 'Reception Floor');
  const long = 'x'.repeat(ROAM_ZONE_LABEL_MAX + 20);
  assert.equal(normalizeZoneLabel(long)?.length, ROAM_ZONE_LABEL_MAX);
});

test('normalizeZoneLabel rejects empty / whitespace / non-string', () => {
  assert.equal(normalizeZoneLabel(''), null);
  assert.equal(normalizeZoneLabel('   '), null);
  assert.equal(normalizeZoneLabel(null), null);
  assert.equal(normalizeZoneLabel(42), null);
});

// ── 2. Venue ────────────────────────────────────────────────────────────────

test('normalizeVenueLabel is optional (empty → null) and trims otherwise', () => {
  assert.equal(normalizeVenueLabel(''), null);
  assert.equal(normalizeVenueLabel('   '), null);
  assert.equal(normalizeVenueLabel(undefined), null);
  assert.equal(normalizeVenueLabel('  Church  '), 'Church');
});

// ── 3. Index ────────────────────────────────────────────────────────────────

test('computeNextZoneIndex allocates max+1 and starts at 1', () => {
  assert.equal(computeNextZoneIndex([]), 1);
  assert.equal(computeNextZoneIndex([{ zone_index: 1 }, { zone_index: 2 }]), 3);
  // Gap-tolerant: a deleted middle zone leaves a gap; next is max+1, not gap-fill.
  assert.equal(computeNextZoneIndex([{ zone_index: 1 }, { zone_index: 3 }]), 4);
});

// ── 4. Cap ──────────────────────────────────────────────────────────────────

test('canAddZone honors MAX_ROAM_ZONES', () => {
  assert.equal(canAddZone(0), true);
  assert.equal(canAddZone(MAX_ROAM_ZONES - 1), true);
  assert.equal(canAddZone(MAX_ROAM_ZONES), false);
  assert.equal(canAddZone(MAX_ROAM_ZONES + 5), false);
});

// ── 5. Input choke point ──────────────────────────────────────────────────────

test('normalizeZoneInput requires a label', () => {
  const r = normalizeZoneInput({ label: '   ', venueLabel: 'Church' });
  assert.equal(r.ok, false);
});

test('normalizeZoneInput normalizes a full valid input', () => {
  const r = normalizeZoneInput({
    label: '  Reception  Floor ',
    venueLabel: '  Grand Ballroom ',
    isFeatured: 'on',
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.label, 'Reception Floor');
    assert.equal(r.value.venueLabel, 'Grand Ballroom');
    assert.equal(r.value.isFeatured, true);
  }
});

test('normalizeZoneInput coerces featured falsey + optional venue', () => {
  const r = normalizeZoneInput({ label: 'Photo Booth' });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.value.venueLabel, null);
    assert.equal(r.value.isFeatured, false);
  }
});
