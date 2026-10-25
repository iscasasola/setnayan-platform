/**
 * 🪑 EVERY SEAT IS COUNTED, BY ITS ROW — the readers that showed a guest's +1 from the one-name mirror, or counted it
 * twice, or guessed it when the read failed (2026-10-22, after Antonio Loo's two-seat card read "no +1 added yet").
 *
 * A guest's +1s are their seat ROWS (`plus_one_of_guest_id`, owner 2026-09-21: "+3" is three rows). The bringer's old
 * `plus_one_name` holds ONE name and is not kept in step with the rows. THE PROPERTIES:
 *   1 · who a guest brings, by name, is every named seat row (`companionNames`) — two named seats are two names; a
 *       renamed seat beats a stale mirror; a guest set to None with a stale mirror brings nobody; the mirror speaks
 *       only for a guest with no rows at all, and only while they are allowed one;
 *   2 · "N expected with their plus-ones" adds only the seats with no row yet (`seatsNotYetOnTheList`) — the rows are
 *       already in the list's total;
 *   3 · the check-in desk, the souvenir desk and the find-your-seat pass read who comes from the rows, never the mirror
 *       off a row; the pass card's party count, refused, prints no party — never the mirror's 0-or-1 guess; the reply,
 *       refused, falls back to its single box — never empty boxes over named +1s.
 *
 * 🛡 SABOTAGED, each seen RED, then restored (2026-10-22) — see the PR body for the run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { companionNames, type CompanionSeatRow } from './extra-seats';
import { computeGuestStats, seatsNotYetOnTheList } from './guests';
import { stripComments } from './strip-comments';

const WEB = path.join(__dirname, '..');
const read = (rel: string) => stripComments(fs.readFileSync(path.join(WEB, rel), 'utf8'));

const seat = (id: string, of: string, first: string, last: string, p: Partial<CompanionSeatRow> = {}): CompanionSeatRow => ({
  guest_id: id,
  plus_one_of_guest_id: of,
  first_name: first,
  last_name: last,
  plus_one_name_confirmed_at: first === 'TBA' ? null : '2026-10-01T00:00:00Z',
  rsvp_status: 'pending',
  created_at: `2026-10-0${id.slice(-1)}T00:00:00Z`,
  ...p,
});

/* ── 1 · who a guest brings ──────────────────────────────────────────────────────────────────────────────────────── */

test('two named seats are two names, oldest first — the mirror holds one and does not speak', () => {
  const darryl = { guest_id: 'g-d', plus_one_allowed: true, plus_one_name: 'Ana Cruz' };
  const rows = [seat('s2', 'g-d', 'Ben', 'Reyes'), seat('s1', 'g-d', 'Ana', 'Cruz'), seat('x1', 'g-other', 'Zed', 'Ong')];
  assert.deepEqual(companionNames(darryl, rows), ['Ana Cruz', 'Ben Reyes']);
});

test('a seat renamed on its own row beats the stale mirror; an unnamed seat or a "can’t come" seat is nobody yet', () => {
  const g = { guest_id: 'g-k', plus_one_allowed: true, plus_one_name: 'Katrina Buanhog' };
  assert.deepEqual(companionNames(g, [seat('s1', 'g-k', 'Kat', 'Serenas')]), ['Kat Serenas']);
  assert.deepEqual(companionNames(g, [seat('s1', 'g-k', 'TBA', '+1')]), [], 'an unnamed seat printed the mirror');
  assert.deepEqual(companionNames(g, [seat('s1', 'g-k', 'Kat', 'Serenas', { rsvp_status: 'declined' })]), [], 'a +1 who can’t come is counted');
  // A host-typed name with no stamp is a name (the List's `plusOneHasNoName`), and "Ben" over a stand-in "+1" is "Ben".
  assert.deepEqual(companionNames(g, [seat('s1', 'g-k', 'Ben', '+1', { plus_one_name_confirmed_at: null })]), ['Ben']);
});

test('the mirror speaks only for a guest with NO rows, and only while allowed a +1 (set to None → nobody)', () => {
  assert.deepEqual(companionNames({ guest_id: 'g', plus_one_allowed: true, plus_one_name: 'Katrina Buanhog' }, []), ['Katrina Buanhog']);
  assert.deepEqual(companionNames({ guest_id: 'g', plus_one_allowed: false, plus_one_name: 'Katrina Buanhog' }, []), [], 'a guest set to None still brings the mirror');
  assert.deepEqual(companionNames({ guest_id: 'g', plus_one_allowed: true, plus_one_name: 'TBA' }, []), [], 'the import’s "TBA" mirror read as a name');
});

/* ── 2 · the head count ──────────────────────────────────────────────────────────────────────────────────────────── */

test('"expected with their plus-ones" never counts a seat row twice', () => {
  const g = (id: string, n: number, p: Record<string, unknown> = {}) => ({ guest_id: id, rsvp_status: 'pending', plus_one_count: n, plus_one_allowed: n > 0, plus_one_of_guest_id: null, entry_source: 'host_seeded', passed_away: false, ...p });
  const antonio = g('g-a', 2);
  const rows = [antonio, g('s1', 0, { plus_one_of_guest_id: 'g-a' }), g('s2', 0, { plus_one_of_guest_id: 'g-a' })];
  assert.equal(computeGuestStats(rows as never).total, 3, 'the seat rows are not in the total (the fixture is wrong)');
  assert.equal(seatsNotYetOnTheList(rows), 0, 'two seats with two rows were added on top of the total');
  // A +1 whose row was removed (the number left standing) is still a head to expect — once.
  assert.equal(seatsNotYetOnTheList([g('g-j', 1)]), 1);
  assert.equal(seatsNotYetOnTheList([g('g-j', 2), g('s1', 0, { plus_one_of_guest_id: 'g-j' })]), 1);
  // A request and a guest who passed away count for nothing, their seats included.
  assert.equal(seatsNotYetOnTheList([g('g-r', 2, { entry_source: 'self_added_unlisted' }), g('g-p', 1, { passed_away: true })]), 0);
});

test('the Details page adds only the seats with no row yet', () => {
  const src = read('app/dashboard/[eventId]/details/page.tsx');
  assert.ok(!/stats\.total\s*\+\s*stats\.plus_ones/.test(src), 'the Details hint adds the +1 NUMBER to a total that already holds the +1 rows');
  assert.match(src, /seatsNotYetOnTheList\(/);
});

/* ── 3 · the readers ─────────────────────────────────────────────────────────────────────────────────────────────── */

for (const rel of [
  'app/dashboard/[eventId]/guests/checkin/page.tsx',
  'app/dashboard/[eventId]/guests/souvenirs/page.tsx',
  'app/[slug]/find-seat/page.tsx',
]) {
  test(`${rel}: who comes is read from the seat rows, never the one-name mirror off a row`, () => {
    const src = read(rel);
    assert.match(src, /companionNames\(/, 'the page does not read who comes from the seat rows');
    assert.ok(!/\b\w+\.plus_one_name\b/.test(src), 'the page reads the bringer’s one-name mirror (`.plus_one_name`) itself');
  });
}

test('the desks show and search every name they are handed — not one', () => {
  for (const rel of ['app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx', 'app/dashboard/[eventId]/guests/souvenirs/_components/souvenir-desk.tsx']) {
    const src = read(rel);
    assert.match(src, /plusOneNames:\s*readonly string\[\]/, `${rel}: the desk takes one +1 name`);
    assert.ok(!/plusOneName\b(?!s)/.test(src), `${rel}: a single plusOneName is still read`);
  }
});

test('the pass card’s party, refused, prints no party — never the mirror’s guess', () => {
  const src = read('lib/pass-card.server.ts');
  const fn = src.slice(src.indexOf('async function readPartyCounts'), src.indexOf('export function passCardPass'));
  const onError = fn.slice(fn.indexOf('if (error)'), fn.indexOf('for (const r'));
  assert.match(onError, /return null;/, 'a refused party read returns the empty map every guest then guesses from');
  assert.match(src, /party:\s*kit\.party === null \? 0 :/, 'passCardPass guesses a party when the read was refused');
});

test('the reply, refused, keeps its single box — never empty boxes over a guest’s named +1s', () => {
  const seats = read('app/[slug]/_lib/plus-one-seats.server.ts');
  const fn = seats.slice(seats.indexOf('export async function plusOneSeatsFor'));
  assert.match(fn, /Promise<PlusOneSeat\[\] \| null>/);
  assert.match(fn.slice(fn.indexOf('if (error)'), fn.indexOf('const linked')), /return null;/, 'a refused seat read returns [] ("no seats")');
  assert.match(read('app/[slug]/invite/reply/page.tsx'), /plus_one_seats:\s*seats === null \? undefined :/, 'the reply draws a refused read as no seats');
});
