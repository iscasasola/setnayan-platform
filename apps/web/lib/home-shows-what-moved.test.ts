/**
 * home-shows-what-moved.test.ts — 🏠 HOME'S LINES OPEN THE THINGS THAT MOVED, IN THEIR NEW HOMES.
 *
 * Owner 2026-10-27 (DECISION_LOG "STUDIO IS LOOK AND WORDS ONLY …": *"Each move … repoints Home's progress … or Home says
 * 'Missing' about finished work"*; `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` "The finished map": *"Home — status lines
 * that open the exact item in its new home"*). RSVP already reads on Home's Guests widget (coming · no reply · can't
 * come, from `rosterStats`) and the Schedule has its own card; this guards the two that had no line:
 *
 *   1 · SEATS (R4 → Guests › Seats): "N without a seat" — Guests › Seats' own "Unseated" (`unseatedCount`: no seat, not
 *       declined) — opens Guests › Seats. No seat plan yet → no line. A refused read is said, never 0.
 *   2 · INSPIRATION (R5 → Suppliers › Find): "N looks on your board" opens Find's board. A refused read is said.
 *   3 · THE COUNT IS THE PLAN'S OWN — `homeUnseated` runs `unseatedCount`, so Home and Guests › Seats cannot disagree.
 *   4 · IT IS WIRED — Home reads both for the viewers the planning widgets are for and hands them to `composeHomeControl`.
 *
 * Sabotage (2026-11-06, each seen red, then restored): the seats face's door back to `/seating` → 1 red · an unread
 * seat read drawn as nothing → 1 red · the inspiration face's door to Studio › Mood Board → 2 red · `homeUnseated`
 * counting declined guests → 3 red · the page's `unseated:` hand-over removed → 4 red.
 *
 * Run: cd apps/web && node --import tsx --test lib/home-shows-what-moved.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { fixtureControl } from './home-control-fixture';
import { guestsViewHref } from './guests-views';
import { findBoardHref } from './find-inspiration';
import type { HomeNext } from './home-first-screen';
import {
  composeHomeControl,
  guestsTile,
  homeToday,
  suppliersTile,
  type HomeControlInput,
} from '../app/dashboard/[eventId]/_components/home-control-faces';

{
  /* `home-moved-lines.server.ts` imports `server-only` (a build-time marker) — nothing here is a client. */
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return {};
    return load.call(this, request, ...rest);
  };
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { homeUnseated } = require('./home-moved-lines.server') as typeof import('./home-moved-lines.server');

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = 'e1';
const PLAN: HomeNext = { kind: 'plan', title: 'You are on track', body: '', action: '' };
const GUESTS = { coming: 40, noReply: 10, toInvite: 0, declined: 3, total: 53 };
const control = (over: Partial<HomeControlInput>) => fixtureControl(E, { next: PLAN, ...over });
const facesOf = (c: HomeControlInput, which: 'guests' | 'sup') => {
  const today = homeToday(PLAN, c.guests);
  const tile = which === 'guests' ? guestsTile(c, today) : suppliersTile(c, today);
  return tile?.faces ?? [];
};

test('1 · seats — "N without a seat" opens Guests › Seats; no plan, no line; a refused read is said', () => {
  const seats = facesOf(control({ guests: { ...GUESTS, unseated: 7 } }), 'guests').find((f) => f.id === 'guests-unseated');
  assert.ok(seats, 'Home has no seats line');
  assert.equal(seats.big, '7');
  assert.equal(seats.unit, 'without a seat');
  assert.equal(seats.href, guestsViewHref(E, 'seats'));
  assert.equal(seats.href, `/dashboard/${E}/guests?gview=seats`);
  for (const none of [0, null, undefined]) {
    const faces = facesOf(control({ guests: { ...GUESTS, unseated: none } }), 'guests');
    assert.ok(!faces.some((f) => f.id.startsWith('guests-unseated') || f.id.startsWith('guests-seats')), `unseated=${none} draws a seats line`);
  }
  const unread = facesOf(control({ guests: { ...GUESTS, unseated: 'unread' } }), 'guests').find((f) => f.id === 'guests-seats-unread');
  assert.ok(unread, 'a refused seat-plan read is silent');
  assert.notEqual(unread.big, '0');
  assert.match(unread.sm ?? '', /Couldn’t load/);
  assert.equal(unread.href, guestsViewHref(E, 'seats'));
});

test('2 · inspiration — "N looks on your board" opens Find’s board; a refused read is said', () => {
  const sup = { booked: 2, of: 6, toDecide: [], replied: 0 };
  const face = facesOf(control({ suppliers: { ...sup, inspiration: { photos: 12, parts: 4 } } }), 'sup').find((f) => f.id === 'sup-inspiration');
  assert.ok(face, 'Home has no inspiration line');
  assert.equal(face.big, '12');
  assert.equal(face.unit, 'looks on your board');
  assert.equal(face.sm, '4 parts');
  assert.equal(face.href, findBoardHref(E));
  assert.doesNotMatch(face.href, /studio|mood-board|launch/, 'the board line opens its old home');
  const empty = facesOf(control({ suppliers: { ...sup, inspiration: { photos: 0, parts: 0 } } }), 'sup').find((f) => f.id === 'sup-inspiration');
  assert.equal(empty?.sm, 'Save the looks you love');
  const unread = facesOf(control({ suppliers: { ...sup, inspiration: 'unread' } }), 'sup').find((f) => f.id === 'sup-inspiration-unread');
  assert.ok(unread, 'a refused board read is silent');
  assert.notEqual(unread.big, '0');
  assert.ok(!facesOf(control({ suppliers: sup }), 'sup').some((f) => f.id.startsWith('sup-inspiration')), 'an unread-for-this-viewer board draws a line');
  // `composeHomeControl` carries both reads to the widgets.
  const composed = composeHomeControl({
    eventId: E, next: PLAN, days: { value: '40', label: 'days to go' }, daysN: 40, eventDate: '2026-12-12', venueName: null,
    needs: { guestList: true, suppliers: true },
    roster: { yes: 40, none: 10, toInvite: 0, no: 3, total: 53 },
    money: null, ledger: null, hub: null, suppliers: sup, checklist: null,
    unseated: 5, inspiration: { photos: 2, parts: 1 },
  });
  assert.equal(composed.guests !== null && composed.guests !== 'unread' ? composed.guests.unseated : 'x', 5);
  assert.deepEqual(composed.suppliers !== null && composed.suppliers !== 'unread' ? composed.suppliers.inspiration : 'x', { photos: 2, parts: 1 });
});

test('3 · the count is Guests › Seats’ own — no seat and not declined; no tables = no plan', () => {
  const tables = [{ table_id: 't1' }, { table_id: 't2' }] as never;
  const assignments = [{ table_id: 't1', guest_id: 'g1' }, { table_id: 'gone', guest_id: 'g2' }];
  const guests = [
    { guest_id: 'g1', rsvp_status: 'attending' }, // seated
    { guest_id: 'g2', rsvp_status: 'attending' }, // its table is gone → unseated
    { guest_id: 'g3', rsvp_status: null }, // no reply yet → still to seat
    { guest_id: 'g4', rsvp_status: 'declined' }, // can't come → not work
  ] as never;
  assert.equal(homeUnseated({ tables, assignments }, guests), 2);
  assert.equal(homeUnseated({ tables: [], assignments: [] }, guests), null, 'no seat plan yet draws a count');
  assert.equal(homeUnseated('unread', guests), 'unread');
  assert.equal(homeUnseated({ tables, assignments }, null), 'unread', 'an unread guest list counts as nobody unseated');
  assert.match(code('lib/home-moved-lines.server.ts'), /return unseatedCount\(rows\.tables, rows\.assignments, guests as SeatPlanPerson\[\]\);/);
  assert.match(code('lib/home-moved-lines.server.ts'), /const board = await readFindInspiration\(supabase, eventId, new Set\(\)\);/);
});

test('4 · it is wired — Home reads both for the planning viewers and hands them to the widgets', () => {
  const page = code('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /homePlansRead\.then\(\(plans\) => \(plans \? Promise\.all\(\[readHomeSeatRows\(supabase, eventId\), readHomeInspiration\(supabase, eventId\)\]\) : null\)\)/);
  assert.match(page, /\{ unseated: homeUnseated\(homeMoved\[0\], guestsMeasured \? guests : null\), inspiration: homeMoved\[1\] \}/);
  // The desktop cards draw the SAME faces the phone tiles rotate — one fact, two drawings.
  const row = code('app/dashboard/[eventId]/_components/home-control-row.tsx');
  assert.match(row, /const seats = tile\.faces\.find\(\(f\) => f\.id === 'guests-unseated' \|\| f\.id === 'guests-seats-unread'\);/);
  assert.match(row, /<Link href=\{seats\.href\} className="hc-fig" data-home-fig=\{seats\.id\}>/);
  assert.match(row, /const board = tile\.faces\.find\(\(f\) => f\.id === 'sup-inspiration' \|\| f\.id === 'sup-inspiration-unread'\);/);
  assert.match(row, /<Link href=\{board\.href\} className="hc-fig" data-home-fig=\{board\.id\}>/);
});
