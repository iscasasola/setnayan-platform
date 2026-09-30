/**
 * ONE MAP, SEVERAL PINS (`lib/scene-map-tiles.ts`) — the Venue map's
 * "One map, two pins" and "Full map". The frame must hold every pin, draw only
 * the host the CSP already allows, and draw nothing it cannot place.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { mapFrame } from './scene-map-tiles';

const CHURCH = { latitude: 14.1153, longitude: 120.9621 };
const PAVILION = { latitude: 14.1009, longitude: 120.9950 };

test('two venues: both pins inside the box, apart, at the highest zoom that holds them', () => {
  const f = mapFrame([CHURCH, PAVILION])!;
  assert.ok(f, 'a frame is drawn');
  for (const s of f.spots) {
    assert.ok(s.leftPct >= 0 && s.leftPct <= 100, `pin x ${s.leftPct}`);
    assert.ok(s.topPct >= 0 && s.topPct <= 100, `pin y ${s.topPct}`);
  }
  assert.notDeepEqual(f.spots[0], f.spots[1], 'two places are two pins');
  const closer = mapFrame([CHURCH, { latitude: 14.1155, longitude: 120.9623 }])!;
  assert.ok(closer.zoom > f.zoom, 'places close together zoom further in');
});

test('the tiles cover the box and come only from the OSM tile host in img-src', () => {
  const f = mapFrame([CHURCH, PAVILION])!;
  assert.ok(f.tiles.length > 0);
  for (const t of f.tiles) assert.match(t.src, /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  const minLeft = Math.min(...f.tiles.map((t) => t.leftPct));
  const maxRight = Math.max(...f.tiles.map((t) => t.leftPct + t.widthPct));
  assert.ok(minLeft <= 0 && maxRight >= 100, 'no bare strip at either side');
});

test('one venue still frames; nothing, or a bad pin, draws no map', () => {
  assert.equal(mapFrame([CHURCH])!.spots.length, 1);
  assert.equal(mapFrame([]), null);
  assert.equal(mapFrame([CHURCH, { latitude: Number.NaN, longitude: 1 }]), null);
});
