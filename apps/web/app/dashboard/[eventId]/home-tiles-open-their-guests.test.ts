/**
 * home-tiles-open-their-guests.test.ts — Home's two guest tiles open the Guests
 * list ALREADY FILTERED to the people they count (owner 2026-10-07: *"pressing this
 * will show all guests who accepted requests"* · *"no reply will show all guest
 * who have not yet answered"*).
 *
 *   1 · COMING → `/guests?q=coming`, NO REPLY → `/guests?q=no+reply` — the Guests
 *       page's own `?q=` (it seeds the search box, so the couple sees and clears it).
 *   2 · ONE DEFINITION: the tile's number and the filter's rows are the same set —
 *       `rosterStats(rows).yes / .none` against `rosterSearchMatches('coming' /
 *       'no reply')` over one fixture, so the tile can never say 79 and show 64.
 *   3 · the page hands Home the Guests list's own count (`rosterStats(guests).none`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { rosterSearchMatches, rosterStats, type RosterFacts } from '@/lib/guest-roster-view';
import { computeGuestStats, REQUEST_ENTRY_SOURCE, type GuestRow } from '@/lib/guests';
import { homeFacts } from '@/lib/home-facts';
import { glanceDays, pickHomeNext } from '@/lib/home-first-screen';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_home_tiles__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
const HERE = dirname(fileURLToPath(import.meta.url));

let n = 0;
const g = (over: Partial<GuestRow>): GuestRow =>
  ({
    guest_id: `g${(n += 1)}`,
    first_name: `G${n}`,
    last_name: 'Test',
    role: 'guest',
    side: 'bride',
    rsvp_status: 'pending',
    entry_source: 'host',
    passed_away: false,
    invitation_sent_at: '2026-10-01T00:00:00Z',
    plus_one_count: 0,
    ...over,
  }) as unknown as GuestRow;

/** Every shape that could split the two definitions apart. */
const ROWS: GuestRow[] = [
  g({ role: 'bride', rsvp_status: 'attending' }),
  g({ role: 'groom', rsvp_status: 'pending' }),
  g({ rsvp_status: 'attending' }),
  g({ rsvp_status: 'attending' }),
  g({ rsvp_status: 'pending' }), // invited, silent
  g({ rsvp_status: 'pending' }),
  g({ rsvp_status: 'pending', invitation_sent_at: null }), // not yet invited — has not answered either
  g({ rsvp_status: 'maybe' }),
  g({ rsvp_status: 'declined' }),
  g({ rsvp_status: 'pending', entry_source: REQUEST_ENTRY_SOURCE }), // a request: on the page, in no count
  g({ rsvp_status: 'pending', passed_away: true }),
];
const FACTS: RosterFacts = { hasSides: true, groupsOf: () => [], tableOf: () => null };

test('2 · the tile counts exactly the rows its filter shows — coming and no reply', () => {
  const stats = rosterStats(ROWS);
  const coming = ROWS.filter((r) => rosterSearchMatches('coming', r, FACTS));
  const noReply = ROWS.filter((r) => rosterSearchMatches('no reply', r, FACTS));
  assert.equal(coming.length, stats.yes, `"coming" shows ${coming.length} rows; the tile says ${stats.yes}`);
  assert.equal(noReply.length, stats.none, `"no reply" shows ${noReply.length} rows; the tile says ${stats.none}`);
  // The owner's words: EVERY guest who has not answered — an uninvited guest too, never the couple.
  assert.equal(stats.none, 3);
  assert.ok(noReply.every((r) => r.role !== 'bride' && r.role !== 'groom'), 'the couple are not asked');
  // …and Home's own facts state those same numbers.
  const facts = homeFacts({
    eventDate: null,
    precision: 'day',
    timezone: 'Asia/Manila',
    guests: { stats: computeGuestStats(ROWS), measured: true, noReply: stats.none },
    money: 'hidden',
  });
  assert.equal(facts.figures.noReply, noReply.length);
  assert.equal(facts.figures.coming, coming.length, 'Home\'s "coming" is the list\'s attending');
});

test('1 · COMING opens the list filtered to coming, NO REPLY to no reply', async () => {
  const { HomeFirstScreen } = await import('./_components/home-first-screen');
  const html = renderToStaticMarkup(
    React.createElement(HomeFirstScreen, {
      eventId: 'e1',
      cover: { eyebrow: 'Wedding', name: 'A & B' },
      next: pickHomeNext({ guide: null, hasDate: true, guests: { total: 9, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false }),
      days: glanceDays(10),
      coming: '2',
      noReply: '3',
      noReplyWaiting: true,
      money: null,
      services: [],
    } as never),
  );
  const href = (tile: string) => html.match(new RegExp(`<a [^>]*data-home-tile="${tile}"[^>]*>`))?.[0].match(/href="([^"]*)"/)?.[1] ?? null;
  assert.equal(href('coming'), '/dashboard/e1/guests?q=coming');
  assert.equal(href('no-reply'), '/dashboard/e1/guests?q=no+reply');
  assert.equal(new URLSearchParams('q=no+reply').get('q'), 'no reply', 'the page reads the words the search understands');
});

test('3 · the page hands Home the Guests list\'s own no-reply count', () => {
  const page = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(page, /guests: \{ stats: guestStats, measured: guestsMeasured, noReply: rosterStats\(guests\)\.none \}/);
  const guestsPage = stripComments(readFileSync(join(HERE, 'guests', 'page.tsx'), 'utf8'));
  assert.match(guestsPage, /initialQuery=\{[^}]*search\.q/, 'the Guests page seeds its search box from ?q=');
});
