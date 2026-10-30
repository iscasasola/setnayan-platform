/**
 * 🧭 Find's "Nearest" (owner 2026-10-30) — the venues it measures from. Pure, executed. (No price range: owner
 * 2026-10-31, price is "sort only".)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nearAnchors,
  nearFromKey,
  nearKey,
  nearRows,
} from './find-sort-choices';
import { LENSES } from './ranking-lenses';
import type { EventVenue } from './event-venues';

const venue = (role: EventVenue['role'], latitude: number | null, longitude: number | null): EventVenue => ({
  role,
  name: role,
  address: null,
  latitude,
  longitude,
});

test('Nearest offers one row per venue with a pin — reception first, never a pinless place', () => {
  const both = nearAnchors([venue('ceremony', 14.6, 121.0), venue('reception', 14.55, 121.05)]);
  assert.deepEqual(nearRows(both).map((r) => r.from), ['reception', 'ceremony']);
  assert.deepEqual(nearRows(both).map((r) => r.label), ['Nearest to reception', 'Nearest to ceremony']);
  // Only the reception has a pin → one row, the shipped lens label.
  assert.deepEqual(nearRows(nearAnchors([venue('ceremony', null, null), venue('reception', 14.55, 121.05)])), [
    { from: 'reception', label: LENSES.near.label },
  ]);
  // Only the ceremony has a pin → one row, measured from the ceremony.
  assert.deepEqual(nearRows(nearAnchors([venue('ceremony', 14.6, 121.0)])), [{ from: 'ceremony', label: LENSES.near.label }]);
  // No pin anywhere → nothing to offer (the menu keeps the lens greyed with its reason).
  assert.deepEqual(nearRows(nearAnchors([venue('reception', null, null)])), []);
});

test('one place for both (a "Ceremony & Reception" venue, or two pins on the same spot) is ONE row', () => {
  assert.equal(nearRows(nearAnchors([venue('both', 14.6, 121.0)])).length, 1);
  assert.equal(nearRows(nearAnchors([venue('ceremony', 14.6, 121.0), venue('reception', 14.6001, 121.0001)])).length, 1);
});

test('a Nearest row key round-trips; any other key is not a venue', () => {
  assert.equal(nearFromKey(nearKey('ceremony')), 'ceremony');
  assert.equal(nearFromKey(nearKey('reception')), 'reception');
  assert.equal(nearFromKey('near'), null);
  assert.equal(nearFromKey('budget'), null);
});
