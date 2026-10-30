/**
 * 🧭 Find's sort choices (owner 2026-10-30) — the venues "Nearest" measures from, and the typed price range "Budget
 * fit" orders by. Pure, executed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveRange,
  nearAnchors,
  nearFromKey,
  nearKey,
  nearRows,
  parsePeso,
  priceSpan,
  rangeFitRatio,
  rangeTyped,
} from './find-sort-choices';
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
  // Only the reception has a pin → one row, named plainly.
  assert.deepEqual(nearRows(nearAnchors([venue('ceremony', null, null), venue('reception', 14.55, 121.05)])), [
    { from: 'reception', label: 'Nearest' },
  ]);
  // Only the ceremony has a pin → one row, measured from the ceremony.
  assert.deepEqual(nearRows(nearAnchors([venue('ceremony', 14.6, 121.0)])), [{ from: 'ceremony', label: 'Nearest' }]);
  // No pin anywhere → nothing to offer (the menu keeps its greyed "Add your venue first").
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

test('the range boxes start at the cheapest and the priciest priced card; no price → no span', () => {
  assert.deepEqual(priceSpan([30000, null, 8000, 45000, undefined]), { low: 8000, high: 45000 });
  assert.equal(priceSpan([null, undefined, 0]), null);
});

test('inside the range scores 1; outside it decays and never reaches zero; no price is neutral', () => {
  const r = effectiveRange({ low: 10000, high: 20000 });
  assert.equal(rangeFitRatio(15000, r), 1);
  assert.equal(rangeFitRatio(10000, r), 1);
  assert.equal(rangeFitRatio(30000, r), 0.5, 'one range-width above → half');
  assert.ok(rangeFitRatio(25000, r)! > rangeFitRatio(30000, r)!, 'closer outside ranks above farther');
  assert.ok(rangeFitRatio(5000, r)! < 1 && rangeFitRatio(5000, r)! > 0.05);
  assert.equal(rangeFitRatio(10_000_000, r), 0.05, 'never zero — re-ordered, never removed');
  assert.equal(rangeFitRatio(null, r), null);
});

test('a blank end is open; reversed ends are put in order; an untouched pair orders nothing', () => {
  assert.equal(rangeFitRatio(999_999, effectiveRange({ low: 10000, high: null })), 1);
  assert.ok(rangeFitRatio(5000, effectiveRange({ low: 10000, high: null }))! < 1);
  assert.deepEqual(effectiveRange({ low: 20000, high: 10000 }), { low: 10000, high: 20000 });
  assert.equal(rangeTyped({ low: null, high: null }), false);
  assert.equal(rangeTyped(undefined), false);
  assert.equal(rangeTyped({ low: 1, high: null }), true);
});

test('a typed amount reads digits only; blank is null', () => {
  assert.equal(parsePeso('₱12,500'), 12500);
  assert.equal(parsePeso(' 8 000 '), 8000);
  assert.equal(parsePeso(''), null);
  assert.equal(parsePeso('abc'), null);
});
