/**
 * THE THREE SEAT PAGES SHARE ONE WAITING STATE, WITH ONE SENTENCE.
 *
 * A guest's walk, 2026-10-11 (fault N20): before seats are shown, `/find-seat`, `/seat` and `/find-my-table` told
 * it three ways — three titles and three different promises. Owner the same day: one waiting state, one sentence;
 * the rule under it (2026-09-30, seats show on the event day unless the couple opens them early) is unchanged.
 *
 * WHAT IS HELD:
 *   (1) AS DRAWN: one title, ONE sentence (one full stop's worth), nothing to press, no frame; with no date the one
 *       extra line says the date is still to be confirmed, and with a date it is not there.
 *   (2) EACH OF THE THREE PAGES draws THIS state — once, for the answer "seats are not shown yet" — and none of them
 *       keeps a title or a sentence of its own for it.
 *   (3) THE RULE IS STILL ASKED on each page: the state stands behind `guestsMaySeeSeatsFor`.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the seat page given back its own
 * "Seating shows on the day" card → (2) red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { DATE_STILL_TO_BE_CONFIRMED } from '../_lib/day-words';
import { SEATS_WAITING_TITLE, SeatsShowOnTheDay, seatsWaitingLine } from './seats-show-on-the-day';

(globalThis as unknown as { React: unknown }).React = React;
const ROOT = join(__dirname, '..');
const page = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('(1) as drawn: one title, one sentence, nothing to press, no frame — and the date line only when there is no date', () => {
  const { renderToStaticMarkup } = require('react-dom/server') as typeof import('react-dom/server');
  const dated = renderToStaticMarkup(React.createElement(SeatsShowOnTheDay, { eventDate: '2026-12-12' }));
  const dateless = renderToStaticMarkup(React.createElement(SeatsShowOnTheDay, { eventDate: null }));
  for (const html of [dated, dateless]) {
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.ok(html.includes(`>${SEATS_WAITING_TITLE}</h1>`));
    assert.equal((html.match(/<p\b/g) ?? []).length, 1, 'more than one line under the title');
    assert.doesNotMatch(html, /<(?:a|button)\b/, 'the waiting state has something to press');
    assert.doesNotMatch(html, /\bborder\b|rounded-|shadow|bg-cream/, 'the waiting state is drawn in a frame');
  }
  const sentences = (s: string) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
  assert.equal(sentences(seatsWaitingLine('2026-12-12')).length, 1, 'with a date the state says more than one sentence');
  assert.deepEqual(sentences(seatsWaitingLine(null)).slice(1), [DATE_STILL_TO_BE_CONFIRMED]);
  assert.ok(!dated.includes(DATE_STILL_TO_BE_CONFIRMED) && dateless.includes(DATE_STILL_TO_BE_CONFIRMED));
  assert.match(seatsWaitingLine('2026-12-12'), /on the day/);
});

const PAGES = ['find-seat/page.tsx', 'seat/page.tsx', 'find-my-table/page.tsx'];
/** The titles and promises each page used to keep for itself. */
const OLD_WORDS = [
  'Seating shows on the day',
  'Your table shows on the day',
  'seating plan opens here on the day',
  'shows here on the day. This table',
  'your table and a map to it will be right here',
  'Come back to this link then',
];

test('(2) each of the three pages draws this state once, and keeps no title or sentence of its own for it', () => {
  for (const rel of PAGES) {
    const src = page(rel);
    assert.equal((src.match(/<SeatsShowOnTheDay\b/g) ?? []).length, 1, `${rel} does not draw the one waiting state exactly once`);
    assert.ok(!src.includes(SEATS_WAITING_TITLE), `${rel} types the title itself instead of drawing the shared state`);
    for (const old of OLD_WORDS) assert.ok(!src.includes(old), `${rel} still tells its own story: ${JSON.stringify(old)}`);
  }
});

test('(3) the rule is still asked: the state stands behind guestsMaySeeSeatsFor on each page', () => {
  for (const rel of PAGES) {
    const src = page(rel);
    assert.match(src, /guestsMaySeeSeatsFor\(/, `${rel} no longer asks whether guests may see seats`);
  }
  // seat and find-my-table: the state is the arm of the answer "no".
  assert.match(page('find-my-table/page.tsx'), /if \(!\(await guestsMaySeeSeatsFor\([^)]*\)\)\) \{\s*return \(\s*<Shell[^>]*>\s*<SeatsShowOnTheDay/);
  assert.match(page('seat/page.tsx'), /const published = await guestsMaySeeSeatsFor\([^)]*\);\s*if \(!published\) \{\s*return \(\s*<SeatPassShell[^>]*>\s*<SeatsShowOnTheDay/);
});
