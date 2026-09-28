/**
 * ⬅ "BACK TO THE INVITATION" LANDS ON THE INVITATION — WITH ITS EVENT BAR,
 * NOT ITS FRONT COVER, AND NEVER OUT OF THE MAKER'S CANVAS.
 *
 * Owner 2026-09-28: *"pressing this lead be back to invitation but the actual
 * invitation with event bar."* See `_lib/back-to-the-invitation.ts`.
 *
 * Each block holds a PROPERTY, executed:
 *   1 · the guest address carries a hash the opening's own first-page check
 *       reads as "not the first page" — so the reveal does not replay;
 *   2 · the stage / key the page was opened with travel back, nothing else;
 *   3 · inside the Maker's canvas the frame goes back to its OWN src;
 *   4 · every rendered "Back to the invitation" points at that address — not
 *       one bare `/${slug}` left, in the round button or the text links.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { landedOnTheFirstPage } from '@/lib/reveal-stages';
import {
  canvasReturnHref,
  findSeatBackHref,
  FIND_SEAT_RETURN_ANCHOR,
} from './_lib/back-to-the-invitation';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const ORIGIN = 'https://www.setnayan.com';

async function load<T>(path: string, name: string): Promise<T> {
  const mod = (await import(path)) as Record<string, unknown> & { default?: Record<string, unknown> };
  const v = (mod[name] ?? mod.default?.[name]) as T | undefined;
  assert.ok(v, `${path} lost its ${name} export — re-anchor this guard rather than deleting it`);
  return v;
}

test('1 · the guest lands past the front cover: the opening reads the address as NOT the first page', () => {
  const href = findSeatBackHref('rosa-ben');
  const url = new URL(href, ORIGIN);
  assert.equal(url.pathname, '/rosa-ben');
  assert.equal(url.hash, `#${FIND_SEAT_RETURN_ANCHOR}`);
  assert.equal(FIND_SEAT_RETURN_ANCHOR, 'site-details', 'the seat door lives in the Details scene');
  // The property, not the spelling: at the very top of the page, on a phone,
  // the reveal's own gate must still stand down for this address.
  assert.equal(landedOnTheFirstPage({ hash: url.hash, scrollY: 0, viewportHeight: 844 }), false);
  // …and the bare address — what it used to be — is the front cover.
  assert.equal(landedOnTheFirstPage({ hash: '', scrollY: 0, viewportHeight: 844 }), true);
});

test('2 · the stage and the key travel back; nothing else does', () => {
  const href = findSeatBackHref('rosa-ben', { phase: 'event', as: 'replied', invite: 'K3Y', t: 'seat-token', utm_source: 'x' });
  const url = new URL(href, ORIGIN);
  assert.equal(url.searchParams.get('phase'), 'event');
  assert.equal(url.searchParams.get('as'), 'replied');
  assert.equal(url.searchParams.get('invite'), 'K3Y');
  assert.equal(url.searchParams.has('t'), false);
  assert.equal(url.searchParams.has('utm_source'), false);
  assert.equal(url.hash, '#site-details');
  // Both shapes a caller may hold, and a repeated param keeps its first value.
  assert.equal(findSeatBackHref('a-b', new URLSearchParams('phase=rsvp')), '/a-b?phase=rsvp#site-details');
  assert.equal(findSeatBackHref('a-b', { phase: ['editorial', 'rsvp'] }), '/a-b?phase=editorial#site-details');
  assert.equal(findSeatBackHref('a-b', { phase: '  ' }), '/a-b#site-details');
});

test('3 · the Maker canvas goes back to its own src — never the plain guest page', () => {
  assert.equal(
    canvasReturnHref('/rosa-ben?editor=1&phase=rsvp&bars=1', 'rosa-ben', ORIGIN),
    '/rosa-ben?editor=1&phase=rsvp&bars=1',
  );
  assert.equal(canvasReturnHref(`${ORIGIN}/rosa-ben?editor=1&phase=event`, 'rosa-ben', ORIGIN), '/rosa-ben?editor=1&phase=event');
  assert.equal(canvasReturnHref('/u/owner/rosa-ben?editor=1', 'rosa-ben', ORIGIN), '/u/owner/rosa-ben?editor=1');
  // Not the Maker's canvas → keep the guest address.
  assert.equal(canvasReturnHref(null, 'rosa-ben', ORIGIN), null);
  assert.equal(canvasReturnHref('https://evil.example/rosa-ben?editor=1', 'rosa-ben', ORIGIN), null);
  assert.equal(canvasReturnHref('/dashboard/e1/launch', 'rosa-ben', ORIGIN), null);
  assert.equal(canvasReturnHref('/other-couple?editor=1', 'rosa-ben', ORIGIN), null);
  assert.equal(canvasReturnHref('/rosa-ben/find-seat', 'rosa-ben', ORIGIN), null);
});

test('4 · every rendered "Back to the invitation" points at the invitation, not the bare front door', async () => {
  const SeatFrame = await load<React.FC<Record<string, unknown>>>('./_components/seat-frame', 'SeatFrame');
  const YourSeat = await load<React.FC<Record<string, unknown>>>('./_components/your-seat', 'YourSeat');
  const backHref = findSeatBackHref('rosa-ben', { phase: 'event' });
  const expected = `href="${backHref.replace(/&/g, '&amp;')}"`;

  const frame = renderToStaticMarkup(
    React.createElement(SeatFrame, { slug: 'rosa-ben', backHref, who: 'Rosa & Ben', names: 'Rosa & Ben', roomFooter: null }, 'x'),
  );
  const round = /<a[^>]*aria-label="Back to the invitation"[^>]*>/.exec(frame)?.[0] ?? '';
  assert.ok(round, 'the round back button is gone — re-anchor this guard');
  assert.ok(round.includes(expected), `round button: ${round}`);

  const notSeated = renderToStaticMarkup(
    React.createElement(YourSeat, {
      firstName: 'Ana', names: 'Rosa & Ben', occasionLine: null, dayOf: false, doorsOpenLabel: null,
      published: false, tables: [], entrance: null, table: null, mates: [], seatsOpen: 0, venueHref: null,
      inviteHref: backHref, slug: 'rosa-ben', plural: true, pass: null,
    }),
  );
  const textLink = /<a[^>]*>Back to the invitation<\/a>/.exec(notSeated)?.[0] ?? '';
  assert.ok(textLink, 'A4 lost its "Back to the invitation" line — re-anchor this guard');
  assert.ok(textLink.includes(expected), `A4 text link: ${textLink}`);

  // B5 (`NotPostedYet`) lives in the page and reads from the server: hold it
  // structurally — no bare `/${slug}` link may come back anywhere in the route.
  const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.equal(/href=\{`\/\$\{slug\}`\}/.test(page), false, 'a bare /${slug} link is back in find-seat/page.tsx');
  assert.equal(/inviteHref=\{`\/\$\{slug\}`\}/.test(page), false);
});

test('5 · on the Save the Date the film does not replay either — it starts lifted, and its opening stands down', async () => {
  // Owner 2026-09-29: coming back from Find your seat on the Save the Date
  // replayed the whole film. The hash that stands the opening down on every
  // other stage now decides the film too — the same rule, executed.
  const filmLiftedOnLanding = await load<(l: { hash: string; scrollY: number; viewportHeight: number }, asSlide: boolean) => boolean>(
    '../_components/std-film-handoff',
    'filmLiftedOnLanding',
  );
  const back = new URL(findSeatBackHref('rosa-ben', { phase: 'save_the_date' }), ORIGIN);
  assert.equal(back.searchParams.get('phase'), 'save_the_date', 'the stage travels back');
  const landing = { hash: back.hash, scrollY: 0, viewportHeight: 844 };
  assert.equal(filmLiftedOnLanding(landing, false), true, 'the guest lands on the Details, not on the film');
  // The front door still plays it; a restored scroll is a return, too.
  assert.equal(filmLiftedOnLanding({ hash: '', scrollY: 0, viewportHeight: 844 }, false), false);
  assert.equal(filmLiftedOnLanding({ hash: '', scrollY: 1200, viewportHeight: 844 }, false), true);
  // In the Maker's canvas the film is a slide — nothing is ever lifted.
  assert.equal(filmLiftedOnLanding(landing, true), false);

  // The handoff asks it at landing and lifts through the one exit event.
  const handoff = stripComments(readFileSync(join(HERE, '../_components/std-film-handoff.tsx'), 'utf8'));
  const effect = /useEffect\(\(\) => \{\s*const onExit = \(\) => setShowFilm\(false\);[\s\S]*?\}, \[\]\);/.exec(handoff)?.[0] ?? '';
  assert.ok(effect, 'the handoff’s exit effect moved — re-anchor this guard');
  assert.match(effect, /if \(\s*filmLiftedOnLanding\(/, 'the handoff stopped asking the landing rule');
  assert.match(effect, /window\.dispatchEvent\(new CustomEvent\(STD_FILM_EXIT_EVENT\)\)/, 'the lift must be the same exit "See our page" sends');

  // And the opening over it: the landing check is no longer the first-page-only
  // stages' alone, so the veil does not cover a page whose film was lifted.
  const overlay = stripComments(readFileSync(join(HERE, '../_components/reveal/reveal-overlay.tsx'), 'utf8'));
  const gate = /if \(([^)]*?)!landedOnTheFirstPage\(/.exec(overlay);
  assert.ok(gate, 'the overlay lost its landing check — re-anchor this guard');
  assert.equal(/firstPageOnly/.test(gate[1] ?? ''), false, 'the landing check is gated to first-page-only stages again');
});
