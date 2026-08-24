/**
 * the-venue-shows-real-streets.test.ts — H-4 / AP-10.
 *
 * WHAT WAS WRONG, MEASURED IN PRODUCTION 2026-08-24. A guest reading an
 * invitation and wondering how to get there was shown a decorative gradient
 * band and a line of text. The section is called `venue_map`. It had never
 * drawn a map.
 *
 * 🔴 AND THE SECOND HALF IS WORSE THAN THE FIRST. The predicate deciding
 * whether that section has anything in it asked `venue_name || venue_address`
 * — the two fields a couple TYPES — and never asked about the coordinates the
 * map is drawn FROM. Production had exactly one event with venue coordinates
 * (`cale-ice`) and it had neither a name nor an address, so the one event we
 * could have drawn a map for is the one the section would have been dropped
 * from. **A fix nobody can reach is no fix**, so the gate had to move with the
 * drawing.
 *
 * 🔑 AND THE RULE WAS WRITTEN TWICE — once in `lib/website-section-content.ts`
 * (the couple's editor) and once in `app/[slug]/_components/site-body.tsx` (the
 * guest page), with a docblock promising they "read the same truth". A sentence
 * is not a mechanism. Both now call `hasVenueContent`.
 *
 * These assertions read SOURCE, deliberately: the widget is a server component
 * whose whole output is an embed URL and a class string, and what this file
 * needs to prove is which of the two backdrops is reachable and whether the
 * gate can see coordinates. Every one was mutation-measured by occurrence
 * count before → after.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hasVenueContent } from '../../../lib/website-section-content';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const WIDGET = 'app/[slug]/_components/venue-widget.tsx';
const SITE_BODY = 'app/[slug]/_components/site-body.tsx';
const SECTION_CONTENT = 'lib/website-section-content.ts';

/** Comments explain the defect by NAME; a raw-source grep would match the
 *  explanation and report the bug it just fixed. Strip them first. */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

test('coordinates alone are enough to have a venue section — the exact production shape', () => {
  // `cale-ice` as it really is in production on 2026-08-24: a pin, no name, no
  // typed address. Before this change the section was dropped from it.
  assert.equal(
    hasVenueContent({
      venue_name: null,
      venue_address: null,
      venue_latitude: 14.5995,
      venue_longitude: 120.9842,
    }),
    true,
    'an event with a pin on the map has a venue section — this is the regression',
  );
});

test('a half-pin is not a pin, and nothing at all is still nothing', () => {
  const nothing = {
    venue_name: null,
    venue_address: null,
    venue_latitude: null,
    venue_longitude: null,
  };
  assert.equal(hasVenueContent(nothing), false, 'no venue data must stay empty');
  // A latitude with no longitude cannot be drawn, and `VendorLocationMap`
  // renders null for it — so admitting it would put an empty section in front
  // of a guest, which is the harm the content gate exists to prevent.
  assert.equal(
    hasVenueContent({ ...nothing, venue_latitude: 14.5995 }),
    false,
    'half a coordinate pair draws no map, so it is not content',
  );
  assert.equal(
    hasVenueContent({ ...nothing, venue_longitude: 120.9842 }),
    false,
    'half a coordinate pair draws no map, so it is not content',
  );
});

test('the fields a couple types still count, exactly as before', () => {
  const base = { venue_latitude: null, venue_longitude: null };
  assert.equal(hasVenueContent({ ...base, venue_name: 'Manila Cathedral', venue_address: null }), true);
  assert.equal(hasVenueContent({ ...base, venue_name: null, venue_address: '123 Real St' }), true);
});

test('🔴 there is exactly ONE copy of the venue-content rule left', () => {
  // The drift this closes: two files each carried
  // `Boolean(event.venue_name || event.venue_address)`. Widening one and not
  // the other would have put the couple's editor and the guest page back into
  // disagreement about whether a section is empty — which is how the editor
  // ends up telling a couple to add content they already have.
  for (const rel of [SITE_BODY, SECTION_CONTENT]) {
    const src = code(rel);
    assert.equal(
      /venue_map:\s*Boolean\(/.test(src),
      false,
      `${rel} still hand-rolls the venue-content rule instead of calling hasVenueContent`,
    );
    assert.match(
      src,
      /venue_map:\s*hasVenueContent\(/,
      `${rel} must decide venue content through the shared predicate`,
    );
  }
});

test('🔴 the columns the rule reads are actually SELECTed', () => {
  // A predicate that asks about a column nobody fetched reads `undefined` and
  // answers "no venue" forever — the query is not rejected and nothing throws,
  // it just quietly never draws. Same family as a phantom column.
  const src = read(SECTION_CONTENT);
  const cols = /SECTION_CONTENT_EVENT_COLUMNS\s*=\s*\n?\s*'([^']*)'/.exec(src)?.[1] ?? '';
  assert.notEqual(cols, '', 'could not read the SELECT column list');
  for (const col of ['venue_latitude', 'venue_longitude']) {
    assert.ok(
      cols.split(',').map((c) => c.trim()).includes(col),
      `${col} is read by hasVenueContent but is not in SECTION_CONTENT_EVENT_COLUMNS — ` +
        `the predicate would see undefined and silently answer "no venue"`,
    );
  }
});

test('the guest venue section renders the shipped map, and draws no second one', () => {
  const src = code(WIDGET);
  assert.match(
    src,
    /<VendorLocationMap/,
    'the venue section must render the map component that already ships',
  );
  // RULE 0: no hand-rolled second map. If this ever fails, somebody has drawn
  // a map here instead of reusing the one on the shop pages.
  assert.equal(
    /<iframe/.test(src),
    false,
    'the venue section must not build its own embed — reuse VendorLocationMap',
  );
});

test('the decorative band survives ONLY as the no-coordinates fallback', () => {
  // Not a style nit: if the gradient still rendered unconditionally the map
  // would sit under a 128px decorative slab, and if it vanished entirely then
  // events with no coordinates would lose the header they have today.
  const src = code(WIDGET);
  assert.match(src, /hasCoords \? \(/, 'the backdrop must branch on having coordinates');
  assert.match(
    src,
    /bg-gradient-to-br from-veil via-paper-deep to-gild\/25/,
    'the no-coordinates fallback band was removed — events without a pin lose their venue header',
  );
});

test('"Venue to be confirmed" never appears above a map that confirms it', () => {
  const src = code(WIDGET);
  // The placeholder must be reachable only on the branch with no coordinates.
  // A pin IS a confirmed location; printing "to be confirmed" directly above
  // it tells the guest the opposite of what the map shows.
  assert.match(
    src,
    /hasCoords \? null : \(/,
    'the "to be confirmed" heading must stand down when there is a map',
  );
});

test('the OpenStreetMap host stays reachable, and the pin says who needs it', () => {
  // The general iframe sweep in lib/csp-embeds-are-allowed.test.ts covers this
  // too. This is the second surface to depend on the origin, and the reason to
  // assert it HERE is that the earlier failure was invisible: the embed answers
  // 200, the markup is perfect, and a CSP refusal renders an empty grey panel
  // with nothing logged.
  const config = read('next.config.ts');
  const enforced = /key: 'Content-Security-Policy',[\s\S]{0,200}?"([^"]*)"/.exec(config)?.[1] ?? '';
  assert.notEqual(enforced, '', 'no enforced CSP found');
  assert.match(
    enforced,
    /frame-src[^"]*openstreetmap\.org/,
    'openstreetmap.org left the enforced frame-src — the venue map on every ' +
      'invitation AND the location map on every shop page silently become empty grey panels',
  );
});
