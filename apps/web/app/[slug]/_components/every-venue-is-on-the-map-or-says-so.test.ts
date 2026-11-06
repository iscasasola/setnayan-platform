/**
 * EVERY VENUE IS ON THE MAP, OR THE MAP SAYS IT IS NOT.
 *
 * Owner, 2026-10-21, on his own Event Hub: *"why do i see a map on
 * www.setnayan.com/cale-ice"*. The Map switch was on (correct). What he saw was
 * one street-level map with a lone pin "2" — because the ceremony had NO pin
 * (only a typed address) and the reception's pin was the only one to frame.
 * `mapFrame` fits every pin it is given; it was given one. Nothing on the map
 * said pin 1 was missing, so a map missing half its places looked exactly like
 * a map that was working — the house disease, a failure rendered as success.
 *
 * The PROPERTY held here, for every style that draws the one shared map and
 * every mix of pinned / unpinned venues: each venue is EITHER a numbered pin
 * OR a numbered "<Role> · not on the map" line — pins + lines = venues, and
 * the label that gives the number its meaning is there. Plus the fit itself on
 * the real shapes: two places ~3 km apart are both inside the frame, and two
 * places on different islands still are.
 *
 * SABOTAGE PERFORMED AND UNDONE (2026-10-21): the `unplaced.map(...)` list in
 * `PinnedMap` was replaced with `null` → the property test went red ("the map
 * drew 1 pin(s) and named 0 missing venue(s) for 2 venues"); restored → green.
 *
 * 🪤 Same harness as `every-scene-style-draws.test.ts`: `globalThis.React`
 * before the DYNAMIC imports, `server-only` stubbed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { mapFrame } from '@/lib/scene-map-tiles';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const h = React.createElement;
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');

// The shapes of a real two-venue wedding in Quezon City: a parish on Tandang
// Sora Ave and a hotel in Vertis North, a few km apart. Illustrative points,
// not anyone's stored data.
const CEREMONY = { role: 'ceremony' as const, name: 'Parish of the Test', address: 'Tandang Sora Ave, Quezon City', latitude: 14.6738, longitude: 121.0469 };
const RECEPTION = { role: 'reception' as const, name: 'Test Hotel North', address: 'Lux Drive, Vertis North, Quezon City', latitude: 14.6505, longitude: 121.0356 };
const unpinned = <T extends { latitude: number | null; longitude: number | null }>(v: T) => ({ ...v, latitude: null, longitude: null });

const EVENT = { venue_withheld: false, venue_name: null, venue_address: null, venue_latitude: null, venue_longitude: null };

/** The numbered pins drawn on the shared map, and the numbered "not on the map" lines. */
function readMap(out: string): { pins: string[]; missing: string[]; drawn: boolean } {
  const fig = /<figure[^>]*data-venue-map-pins="\d+"[\s\S]*?<\/figure>/.exec(out)?.[0];
  if (!fig) return { pins: [], missing: [], drawn: false };
  const pins = [...fig.matchAll(/<span aria-hidden="true" class="absolute flex h-7 w-7[^"]*"[^>]*>(\d+)<\/span>/g)].map((m) => m[1]!);
  const list = /<ul data-venue-map-missing=""[\s\S]*?<\/ul>/.exec(fig)?.[0] ?? '';
  const missing = [...list.matchAll(/<li[^>]*>[\s\S]*?>(\d+)<\/span>([^<]*)<\/li>/g)].map((m) => `${m[1]} ${m[2]!.trim()}`);
  return { pins, missing, drawn: true };
}

test('📍 every venue is a pin or a "not on the map" line — in every style that draws the shared map', async () => {
  const { VenueWidget } = await import('./venue-widget');
  const mixes = [
    [CEREMONY, RECEPTION],
    [unpinned(CEREMONY), RECEPTION], // ← cale-ice, 2026-10-21
    [CEREMONY, unpinned(RECEPTION)],
  ];
  for (const sceneStyle of ['full-photo', 'journey']) {
    for (const venues of mixes) {
      const out = decode(renderToStaticMarkup(h(VenueWidget, { event: { ...EVENT, venues }, sceneStyle } as never)));
      const { pins, missing, drawn } = readMap(out);
      assert.ok(drawn, `${sceneStyle}: a map is drawn while any venue has a pin`);
      assert.equal(
        pins.length + missing.length,
        venues.length,
        `${sceneStyle}: the map drew ${pins.length} pin(s) and named ${missing.length} missing venue(s) for ${venues.length} venues`,
      );
      venues.forEach((v, i) => {
        const n = String(i + 1);
        if (v.latitude != null) assert.ok(pins.includes(n), `${sceneStyle}: ${v.role} is pin ${n}`);
        else {
          const role = v.role === 'ceremony' ? 'Ceremony' : 'Reception';
          assert.ok(missing.includes(`${n} ${role} · not on the map`), `${sceneStyle}: ${v.role} is named as not on the map (${missing.join(' | ')})`);
          assert.match(out, new RegExp(`aria-label="Map showing [^"]*${v.name} is not on the map"`), `${sceneStyle}: a screen reader hears it too`);
        }
      });
    }
  }
});

test('📍 the photo card keeps its rule: the shared map only when two places are pinned — never one pin passed off as both', async () => {
  const { VenueWidget } = await import('./venue-widget');
  const both = readMap(decode(renderToStaticMarkup(h(VenueWidget, { event: { ...EVENT, venues: [CEREMONY, RECEPTION] } } as never))));
  assert.deepEqual(both.pins, ['1', '2']);
  assert.deepEqual(both.missing, []);
  const one = decode(renderToStaticMarkup(h(VenueWidget, { event: { ...EVENT, venues: [unpinned(CEREMONY), RECEPTION] } } as never)));
  assert.equal(readMap(one).drawn, false, 'one pinned place: no shared map — its card keeps its own map');
});

test('🗺 the frame fits every pin it is given — near (~3 km) and far (another island)', () => {
  const near = mapFrame([CEREMONY, RECEPTION], { width: 360, height: 220 })!;
  const far = mapFrame([CEREMONY, { latitude: 10.3157, longitude: 123.8854 }], { width: 360, height: 220 })!;
  for (const [what, f] of [['near', near], ['far', far]] as const) {
    assert.equal(f.spots.length, 2, `${what}: two spots`);
    for (const s of f.spots) {
      assert.ok(s.leftPct > 0 && s.leftPct < 100 && s.topPct > 0 && s.topPct < 100, `${what}: pin inside the frame (${s.leftPct}, ${s.topPct})`);
    }
  }
  assert.ok(near.zoom < 16, 'two places a few km apart are not framed at street level');
  assert.ok(far.zoom < near.zoom, 'places further apart zoom further out');
});
