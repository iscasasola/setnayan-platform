/**
 * 🏛 THE VENUE SCENE HAS THE THREE APPROVED LOOKS — AND ONE MAP SWITCH.
 *
 * Owner, 2026-09-30 (DECISION_LOG "VENUE STYLES APPROVED"), verbatim: *"venue
 * scene - YES! :D"* on `prototypes/venue_styles_2026-09-30_fable.html`: Photo
 * card (default) · Full photo · The journey, picked with the scene's existing
 * Style ▾; and **Map: One map for both / No map** beside it.
 *
 * What the drawings do is held by `app/[slug]/_components/every-scene-style-
 * draws.test.ts` (the venue tests). This file holds the plumbing: the ONE
 * registry offers exactly the three, the default stays today's card, the Map
 * pick survives the sanitiser and reaches the page, and the Maker draws the
 * switch where the Style row is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sceneStyleOptions, defaultSceneStyle } from '@/lib/scene-styles';
import { hasHubCanvas, sanitizeHubCanvas } from '@/lib/hub-canvas';
import { venueMapOfRow } from '@/lib/scene-style-of-row';

const WEB = join(__dirname, '..');
const read = (...p: string[]) => readFileSync(join(WEB, ...p), 'utf8');

test('the Venue scene offers exactly Photo card · Full photo · The journey, on the Invitation and The Day', () => {
  for (const stage of ['rsvp', 'event'] as const) {
    for (const eventType of ['wedding', 'birthday', 'wake', null]) {
      const opts = sceneStyleOptions('venue_map', stage, eventType);
      assert.deepEqual(
        opts.map((o) => [o.id, o.name]),
        [
          ['photo-card', 'Photo card'],
          ['full-photo', 'Full photo'],
          ['journey', 'The journey'],
        ],
        `${stage} / ${eventType}`,
      );
      assert.equal(defaultSceneStyle('venue_map', stage, eventType), 'photo-card', 'the default is today’s card');
    }
  }
});

test('the Map switch: only "none" is stored; absent = one map; it is not an arrangement', () => {
  assert.equal(sanitizeHubCanvas({ venueMap: 'none' }).venueMap, 'none');
  for (const junk of ['one', 'NONE', true, 1, null, {}]) {
    assert.equal(sanitizeHubCanvas({ venueMap: junk }).venueMap, undefined, JSON.stringify(junk));
  }
  assert.equal(venueMapOfRow({ config_json: { canvas: { venueMap: 'none' } } }), 'none');
  for (const config_json of [null, {}, { canvas: {} }, { canvas: { venueMap: 'one' } }]) {
    assert.equal(venueMapOfRow({ config_json }), 'one', JSON.stringify(config_json));
  }
  assert.equal(venueMapOfRow(null), 'one');
  // A map pick frames nothing — framing would bring motion the couple never chose.
  assert.equal(hasHubCanvas({ venueMap: 'none' }), false);
});

test('both guest-page mounts hand the Venue scene its Map pick and the run of show', () => {
  for (const f of ['hideable-widget-render.tsx', 'public-hideable-widget.tsx']) {
    const src = read('app', '[slug]', '_components', f);
    assert.match(
      src,
      // `venueEvent` is the row itself, or on the day the row narrowed to ONE
      // venue (`dayVenuesNow`, owner 2026-10-01) — the Map pick and the times ride either way.
      /<VenueWidget event=\{venueEvent\} sceneStyle=\{sceneStyle\} map=\{venueMapOfRow\(widget\)\} blocks=\{scheduleBlocks\} \/>/,
      `${f}: the Venue scene is mounted without its Map pick or its times`,
    );
    assert.match(src, /const venueEvent = isLive\s*\?\s*\{\s*\.\.\.event,\s*venues: dayVenuesNow\(/, `${f}: on the day the Venue scene draws both venues again`);
  }
});

test('the Maker draws Map as a two-way switch beside the Venue scene’s Style, saving canvas.venueMap', () => {
  const src = read('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'scene-style-row.tsx');
  const at = src.indexOf("type === 'venue_map'");
  assert.ok(at > 0, 'no Map row for the Venue scene');
  const row = src.slice(at, src.indexOf(') : null;', at));
  assert.match(row, /<IRow label="Map"/);
  assert.match(row, /One map for both/);
  assert.match(row, /No map/);
  assert.match(row, /delete c\.venueMap/, '"One map for both" is the default and an absence');
  assert.match(row, /c\.venueMap = 'none'/);
  assert.doesNotMatch(row, /PickMenu/, 'two choices are a switch, never a dropdown');
  assert.match(src, /\{styleRow\}\s*\{mapRow\}/, 'the switch sits right under Style');
});
