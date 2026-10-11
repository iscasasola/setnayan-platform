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
 *   (4) A NAMED GUEST gets the same state as a stranger on all three (added 2026-10-11 — see its note).
 *   (5) /everyone's "Check back closer to the day." follows the same no-date rule.
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
/** How many times each page asks "may guests see seats?" for a viewer — and so how many times it draws the state. */
const MOUNTS: Record<string, number> = { 'find-seat/page.tsx': 1, 'seat/page.tsx': 2, 'find-my-table/page.tsx': 1 };
/** The titles and promises each page used to keep for itself — a stranger's, and a named guest's. */
const OLD_WORDS = [
  'Seating shows on the day',
  'Your table shows on the day',
  'seating plan opens here on the day',
  'shows here on the day. This table',
  'your table and a map to it will be right here',
  'Come back to this link then',
  // The named guest's (the tester's walk of the joined batch, 2026-10-11).
  'Your seat is being arranged. On the day',
  'your exact table and a map to it will appear right here',
];

test('(2) each of the three pages draws this state for every waiting branch, and keeps no title or sentence of its own for it', () => {
  for (const rel of PAGES) {
    const src = page(rel);
    assert.equal((src.match(/<SeatsShowOnTheDay\b/g) ?? []).length, MOUNTS[rel], `${rel} does not draw the one waiting state once per waiting branch`);
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

/*
  ── A NAMED GUEST GETS THE SAME STATE AS A STRANGER (the tester's walk of the joined batch, 2026-10-11) ──
  As the named guest of an event with no date: /find-my-table ended "The date is still to be confirmed." while
  /find-seat read "not set yet · You're on the list, Bean… No need to check back — this updates by itself." and /seat
  read "Your seat is being arranged. On the day, your exact table and a map to it will appear right here." — three
  stories again, one of them telling the guest NOT to come back beside two telling them to. The first build had
  only replaced each page's stranger branch.

  SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the shared state taken off find-seat's
  named branch (`) : null}` in place of `<NotPostedYet …>`) → (4) red.
*/
test('(4) the named guest’s waiting branch on each page is this state too — never a page’s own "being arranged" or "no need to check back"', () => {
  // /find-seat — the named viewer's return: YourSeat only once seats are shown; before that, the shared state.
  const find = page('find-seat/page.tsx');
  assert.equal((find.match(/<YourSeat\b/g) ?? []).length, 1);
  assert.match(find, /\{published \? \(\s*<YourSeat\b[\s\S]*?\/>\s*\) : \(\s*<NotPostedYet slug=\{slug\} backHref=\{backHref\} eventDate=\{event\.event_date as string \| null\} \/>\s*\)\}/, 'a named guest is shown the page’s own "not set yet" before seats are shown');
  assert.equal((find.match(/<NotPostedYet\b/g) ?? []).length, 2, 'the stranger and the named guest no longer share the one waiting state');
  const notPosted = find.slice(find.indexOf('function NotPostedYet('));
  assert.match(notPosted, /<SeatsShowOnTheDay eventDate=\{eventDate\}/);
  // The words a named guest was told, and where they are still true: only once seats are shown.
  const yourSeat = page('find-seat/_components/your-seat.tsx');
  assert.match(yourSeat, /No need to check back — this updates by itself\./, 'anti-vacuity: the seated-soon line moved');
  assert.ok(!find.includes('No need to check back'));

  // /seat — BOTH passes (a table's code, a guest's own pass) stand behind the rule and draw the state.
  const seat = page('seat/page.tsx');
  const arms = [...seat.matchAll(/const published = await guestsMaySeeSeatsFor\([^)]*\);\s*if \(!published\) \{\s*return \(\s*<SeatPassShell[^>]*>\s*<SeatsShowOnTheDay eventDate=\{event\.event_date\} \/>/g)];
  assert.equal(arms.length, 2, `/seat draws the shared state on ${arms.length} of its 2 waiting branches`);
  assert.equal((seat.match(/guestsMaySeeSeatsFor\(/g) ?? []).length, 2, 'a third reading of the rule appeared on /seat — hold its waiting branch here too');

  // /find-my-table — one gate, asked BEFORE the page looks up whose table it is, so it is every viewer's.
  const table = page('find-my-table/page.tsx');
  const gate = table.indexOf('if (!(await guestsMaySeeSeatsFor(');
  assert.ok(gate > 0);
  assert.equal((table.match(/guestsMaySeeSeatsFor\(/g) ?? []).length, 1);
  const whose = table.indexOf(".eq('guest_id', session.guest_id)");
  assert.ok(whose > gate, 'the gate is asked after the page has looked up whose table it is — a named guest could get another branch');
  assert.ok(!/<h1[^>]*>\s*Your seat is being arranged\s*<\/h1>/.test(table.slice(0, gate)), 'a waiting title of its own stands before the gate');
});

test('(5) /everyone’s "check back closer to the day" follows the same rule for an event with no day', () => {
  const src = page('everyone/page.tsx');
  assert.match(src, /The entourage hasn&rsquo;t been shared yet\.\{' '\}\s*\{withDayNote\('Check back closer to the day\.', event\.event_date\)\}/);
  assert.match(src, /\.select\('event_id, slug, display_name, landing_page_visibility, event_date'\)/, 'the page does not read the event’s date');
});
