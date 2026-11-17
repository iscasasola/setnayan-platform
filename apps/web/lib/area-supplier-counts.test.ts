/**
 * 📍 "Areas that fit · by suppliers we have there" (owner 2026-11-17; definition accepted on PR #7920) — a supplier is
 * here when its OWN tier-clamped reach covers the area's centre. Real counts; a refused read is the server reader's
 * null (never an empty map), held in `area-supplier-counts.server.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { countSuppliersByArea, rankAreas, shopReachKm } from './area-supplier-counts';

const TAGAYTAY = { key: 'tagaytay', lat: 14.106, lon: 120.962 };
const CEBU = { key: 'cebu', lat: 10.316, lon: 123.886 };
const MANILA = { key: 'manila', lat: 14.599, lon: 120.984 };

test('a shop counts where its own reach covers the area — and nowhere it cannot be said to serve', () => {
  const nearTagaytay = { lat: 14.12, lon: 120.95, tier: 'pro', innerKm: null, outerKm: 30 };
  const counts = countSuppliersByArea(
    [
      nearTagaytay,
      { lat: 14.12, lon: 120.95, tier: 'pro', innerKm: null, outerKm: 80 }, // reaches Manila too (~55 km)
      { lat: null, lon: null, tier: 'pro', innerKm: null, outerKm: 500 }, // unpinned → nowhere
      { lat: 14.12, lon: 120.95, tier: 'free', innerKm: null, outerKm: null }, // free tier: no reach → nowhere
    ],
    [TAGAYTAY, CEBU, MANILA],
  );
  assert.equal(counts.get('tagaytay'), 2);
  assert.equal(counts.get('manila'), 1);
  assert.equal(counts.get('cebu'), 0, 'a measured zero is present, not missing');
  assert.equal(shopReachKm({ lat: 0, lon: 0, tier: 'free', innerKm: null, outerKm: null }), null);
});

test('areas rank by suppliers there, then nearest the guests’ home; an empty area is never suggested', () => {
  const counts = new Map([['tagaytay', 4], ['manila', 4], ['cebu', 0]]);
  const ranked = rankAreas(counts, [TAGAYTAY, CEBU, MANILA], { lat: 14.65, lon: 121.05 });
  assert.deepEqual(ranked.map((r) => r.key), ['manila', 'tagaytay'], 'a tie goes to the nearer area; Cebu (0) is left out');
  assert.ok(ranked[0]!.km !== null && ranked[0]!.km < ranked[1]!.km!);
});
