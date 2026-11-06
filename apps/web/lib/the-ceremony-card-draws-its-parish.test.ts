/**
 * the-ceremony-card-draws-its-parish.test.ts — THE CEREMONY CARD SHOWS THE
 * PARISH'S DRAWING WHEN THERE IS ONE, AND NOTHING WHEN THERE IS NOT.
 *
 * Owner, 2026-10-16 (DECISION_LOG "A LIBRARY OF PARISH DRAWINGS FOR THE EVENT
 * HUB"), *"just the one for us first"* — the Santuario de San Vicente de Paul on
 * cale-ice. `lib/parish-drawings.ts` is the library; the venue card draws it.
 *
 * Held here, by rendering the REAL `VenueWidget` (every style that draws a
 * picture) rather than reading its source:
 *   1. the match: the parish's name (and its longer booked spelling), on a
 *      ceremony card only — never a reception, never a namesake parish;
 *   2. a ceremony card at that parish draws the drawing, on the plate, ABOVE
 *      the venue's name — AVIF first, WebP fallback, lazy, size reserved;
 *   3. a ceremony card anywhere else draws NO drawing (and its photo, as before);
 *   4. the drawing takes the photo's place on its card — one picture per card;
 *      the other card keeps its photo;
 *   5. it stays up before a guest replies (the name never closes, so neither
 *      does the picture of the building);
 *   6. the files exist, are ≤ 60 KB, and carry an alpha channel (the white is
 *      cut, so a dark Look shows no white box).
 *
 * ⛪ Since 2026-10-16 (DECISION_LOG "A VENUE CARD'S PICTURE IS THE COUPLE'S
 * CHOICE") the drawing shows only where the couple PICKED it — every card
 * below that draws it says `drawingChosen`. That it never shows UNPICKED is
 * held in `a-venue-cards-picture-is-the-couples-choice.test.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { PARISH_DRAWINGS, parishDrawingFor } from '@/lib/parish-drawings';
import type { EventVenue } from '@/lib/event-venues';

(globalThis as { React?: unknown }).React = React;
const { VenueWidget } = require('../app/[slug]/_components/venue-widget') as typeof import('../app/[slug]/_components/venue-widget');

const WEB = join(__dirname, '..');
const SANTUARIO = 'Santuario de San Vicente de Paul Parish';
const OTHER = 'Santuario de San Antonio';
const PHOTO = 'https://media.example/ceremony.jpg';
const HOTEL_PHOTO = 'https://media.example/hotel.jpg';

const venues = (ceremonyName: string, opts: { ceremonyPhoto?: string } = {}): EventVenue[] => [
  {
    role: 'ceremony',
    name: ceremonyName,
    address: '1 Church Rd',
    latitude: null,
    longitude: null,
    // ⛪ The couple picked "Our drawing ◆" on this card (the drawing never shows unpicked).
    drawingChosen: true,
    ...(opts.ceremonyPhoto ? { photoUrl: opts.ceremonyPhoto } : {}),
  },
  { role: 'reception', name: 'Seda Hotel Vertis North', address: '1 Astra Way', latitude: null, longitude: null, photoUrl: HOTEL_PHOTO },
];

function draw(vs: EventVenue[], style: string | null, withheld = false): string {
  return renderToStaticMarkup(
    React.createElement(VenueWidget, {
      event: { venues: vs, venue_withheld: withheld } as unknown as Parameters<typeof VenueWidget>[0]['event'],
      sceneStyle: style,
      map: 'none',
    }),
  );
}

/** The markup of one venue's card (`data-venue-role="…"` up to the next card). */
function card(html: string, role: string): string {
  const start = html.indexOf(`data-venue-role="${role}"`);
  assert.ok(start >= 0, `the ${role} card is drawn`);
  const next = html.indexOf('data-venue-role="', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

const count = (s: string, needle: string) => s.split(needle).length - 1;

/** The styles that draw a picture on a venue card (The journey draws none — the map is its picture). */
const PICTURE_STYLES = [null, 'photo-card', 'full-photo'] as const;

test('1 · the match: the parish (and its longer spelling), on a ceremony card only', () => {
  const d = parishDrawingFor({ role: 'ceremony', name: SANTUARIO });
  assert.ok(d, 'the Santuario has a drawing');
  assert.equal(parishDrawingFor({ role: 'ceremony', name: 'Santuario de San Vicente de Paul Parish & Shrine of the Poor' }), d);
  assert.equal(parishDrawingFor({ role: 'both', name: 'SANTUARIO DE SAN VICENTE DE PAÚL' }), d, 'case and accents do not matter');
  assert.equal(parishDrawingFor({ role: 'reception', name: SANTUARIO }), null, 'a reception card never carries it');
  assert.equal(parishDrawingFor({ role: 'ceremony', name: 'San Vicente de Paul Parish' }), null, 'a namesake parish is not this one');
  assert.equal(parishDrawingFor({ role: 'ceremony', name: 'Santuario de San Vicente de Paulino' }), null, 'a prefix must end on a word');
  assert.equal(parishDrawingFor({ role: 'ceremony', name: OTHER }), null);
  assert.equal(parishDrawingFor({ role: 'ceremony', name: null }), null);
});

for (const style of PICTURE_STYLES) {
  const label = style ?? 'default';

  test(`2 · ${label}: the Santuario's ceremony card draws the drawing, above the name`, () => {
    const html = draw(venues(SANTUARIO), style);
    const c = card(html, 'ceremony');
    assert.equal(count(html, 'data-venue-drawing='), 1, 'exactly one drawing on the page');
    assert.equal(count(c, 'data-venue-drawing="santuario-de-san-vicente-de-paul"'), 1, 'and it is on the ceremony card');
    const at = c.indexOf('data-venue-drawing=');
    const name = c.indexOf(`>${SANTUARIO}</h3>`);
    assert.ok(name > at, 'the drawing sits above the venue name');
    assert.ok(c.indexOf('pahina-plate') < at, 'on the card (the plate) itself — not in a dark photo box');
    assert.match(c, /<source type="image\/avif" srcSet="\/parish-drawings\/santuario-de-san-vicente-de-paul\.avif"\/>/);
    assert.match(c, /<img src="\/parish-drawings\/santuario-de-san-vicente-de-paul\.webp"[^>]*loading="lazy"/);
    assert.match(c, /width="686" height="370"/, 'its size is reserved');
  });

  test(`3 · ${label}: any other ceremony draws no drawing`, () => {
    const html = draw(venues(OTHER, { ceremonyPhoto: PHOTO }), style);
    assert.equal(count(html, 'data-venue-drawing'), 0);
    assert.equal(count(html, 'parish-drawings/'), 0);
    assert.ok(card(html, 'ceremony').includes(PHOTO), 'its photo still shows, as before');
  });

  test(`4 · ${label}: a PICKED drawing takes the photo's place; the other card keeps its photo`, () => {
    const html = draw(venues(SANTUARIO, { ceremonyPhoto: PHOTO }), style);
    const c = card(html, 'ceremony');
    assert.equal(count(c, 'data-venue-drawing='), 1);
    assert.equal(count(c, 'data-venue-photo'), 0, 'one picture per card');
    assert.ok(!html.includes(PHOTO));
    assert.ok(card(html, 'reception').includes(HOTEL_PHOTO));
  });

  test(`5 · ${label}: it stays up before a guest replies`, () => {
    const vs = venues(SANTUARIO).map((v) => ({ ...v, address: null }));
    const html = draw(vs, style, true);
    assert.equal(count(card(html, 'ceremony'), 'data-venue-drawing='), 1);
  });
}

test('6 · every file exists, is ≤ 60 KB and carries alpha', () => {
  assert.ok(PARISH_DRAWINGS.length >= 1);
  for (const { drawing } of PARISH_DRAWINGS) {
    for (const src of [drawing.avif, drawing.webp]) {
      const path = join(WEB, 'public', src);
      const size = statSync(path).size;
      assert.ok(size <= 60 * 1024, `${src} is ${size} B — over the 60 KB line`);
      const bytes = readFileSync(path);
      if (src.endsWith('.webp')) {
        // RIFF....WEBPVP8X, flags byte at 20: bit 0x10 = alpha.
        assert.equal(bytes.toString('ascii', 12, 16), 'VP8X', `${src}: an extended WebP (one with alpha)`);
        assert.ok(((bytes[20] ?? 0) & 0x10) !== 0, `${src}: carries alpha`);
      } else {
        assert.ok(bytes.includes(Buffer.from('urn:mpeg:mpegB:cicp:systems:auxiliary:alpha')), `${src}: carries an alpha plane`);
      }
    }
  }
});
