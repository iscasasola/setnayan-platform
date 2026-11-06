/**
 * auto-arrange-asks-who-moves.test.ts — 🪑 the owner, live on his own event (2026-11-02, Seats › List › ⋯): *"We want to
 * be able to remove all seated. When we click auto seat. We ask if we change all seated or just the unseated ones?"*
 * On a DUMMY room (25 tables of 10, ~230 guests, some seats locked) — no real data.
 *
 *   1 · "Only the unseated" (the default) never moves a seated guest.
 *   2 · "Seat everyone again" moves seated guests — but never a locked one.
 *   3 · "Clear all seats" then Undo puts back EXACTLY what was there (and never over a later choice).
 *   4 · Wired: the action honours the scope, the Clear intent keeps locked seats unless told, Undo restores, and the
 *       editor asks first (the house sheet's two buttons) with Clear all seats in the same ⋯.
 *
 * SABOTAGE (each seen red, then restored): `seatsToClear` ignoring `locked` → 2, 3 · `restorableSeats` returning [] → 3 ·
 * the action ignoring the scope (`const assignments = assignmentsRead`) → 4 · the undo's restore insert removed → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { computeAutoSeat, type AutoSeatGuest, type EventTableRow, type SeatAssignmentRow } from './seating';
import { parseRestoreSeats, parseSeatScope, restorableSeats, seatsThatStay, seatsToClear } from './seat-plan-scope';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

const tables: EventTableRow[] = Array.from({ length: 25 }, (_, i) => ({
  table_id: `t${String(i + 1).padStart(2, '0')}`,
  public_id: `S89T-DUMMY${i}`,
  event_id: 'dummy',
  table_label: `Table ${i + 1}`,
  table_type: 'round_10' as EventTableRow['table_type'],
  capacity: 10,
  sort_order: i,
  x_pos: 10 + (i % 5) * 20,
  y_pos: 15 + Math.floor(i / 5) * 15,
  removed_seats: [],
}));

const guests: AutoSeatGuest[] = Array.from({ length: 230 }, (_, i) => ({
  guest_id: `g${String(i).padStart(3, '0')}`,
  role: i < 8 ? 'principal_sponsor_ninong' : 'guest',
  group_category: 'friends',
  rsvp_status: 'attending',
  plus_one_of_guest_id: null,
  last_name: 'Cruz',
  first_name: `N${i}`,
  group_id: `grp-${i % 23}`,
}));

/** The plan as the host left it: 120 seated (deliberately NOT how the seater would put them), every 10th seat locked. */
const before: SeatAssignmentRow[] = guests.slice(0, 120).map((g, i) => ({
  assignment_id: `a${i}`,
  guest_id: g.guest_id,
  table_id: tables[24 - (i % 12)]!.table_id,
  seat_number: Math.floor(i / 12),
  locked: i % 10 === 0,
  placed_by: i % 2 ? 'couple' : 'auto',
  placed_at: `2026-10-${String(10 + (i % 18)).padStart(2, '0')}T09:00:00Z`,
}));
const where = (rows: { guest_id: string; table_id: string; seat_number: number | null }[]) =>
  new Map(rows.map((r) => [r.guest_id, `${r.table_id}#${r.seat_number}`]));

test('1 · "Only the unseated" (the default) never moves a seated guest', () => {
  assert.equal(parseSeatScope(undefined), 'unseated', 'the default is the unseated');
  assert.equal(parseSeatScope('junk'), 'unseated');
  const rows = computeAutoSeat(tables, guests, before);
  const seated = new Set(before.map((a) => a.guest_id));
  assert.ok(rows.length > 100, `only ${rows.length} seated`);
  for (const r of rows) assert.ok(!seated.has(r.guest_id), `${r.guest_id} already had a seat and was moved`);
  const taken = new Set(before.map((a) => `${a.table_id}#${a.seat_number}`));
  for (const r of rows) assert.ok(!taken.has(`${r.table_id}#${r.seat_number}`), 'a seated guest’s chair was given away');
});

test('2 · "Seat everyone again" moves the seated — never a locked one', () => {
  assert.equal(parseSeatScope('all'), 'all');
  const off = seatsToClear(before, true);
  const stay = seatsThatStay(before, true);
  assert.ok(off.every((r) => !r.locked), 'a locked seat came off');
  assert.equal(stay.length, before.filter((a) => a.locked).length);
  assert.equal(off.length + stay.length, before.length);
  const rows = computeAutoSeat(tables, guests, stay);
  const locked = new Set(stay.map((a) => a.guest_id));
  for (const r of rows) assert.ok(!locked.has(r.guest_id), `locked ${r.guest_id} was moved`);
  const lockedChairs = new Set(stay.map((a) => `${a.table_id}#${a.seat_number}`));
  for (const r of rows) assert.ok(!lockedChairs.has(`${r.table_id}#${r.seat_number}`), 'a locked chair was given away');
  // …and the unlocked seated guests really are arranged again (some land somewhere new).
  const was = where(before);
  const now = where(rows);
  const moved = off.filter((r) => now.has(r.guest_id) && now.get(r.guest_id) !== was.get(r.guest_id));
  assert.ok(moved.length > 50, `only ${moved.length} of ${off.length} seated guests were arranged again`);
});

test('3 · "Clear all seats" then Undo puts back exactly what was there', () => {
  const key = (r: { guest_id: string; table_id: string; seat_number: number | null; locked?: boolean | null; placed_by?: string | null; placed_at?: string | null }) =>
    `${r.guest_id}|${r.table_id}|${r.seat_number}|${r.locked === true}|${r.placed_by ?? ''}|${r.placed_at ?? ''}`;
  for (const keepLocked of [true, false]) {
    const off = seatsToClear(before, keepLocked);
    const stay = seatsThatStay(before, keepLocked);
    if (keepLocked) assert.ok(off.every((r) => !r.locked), 'Clear removed a locked seat it was told to keep');
    else assert.equal(off.length, before.length, '"Clear them too" left seats behind');
    // Undo: the client sends the cleared rows back (JSON round-trip), the server puts back what is still free.
    const back = restorableSeats(parseRestoreSeats(JSON.parse(JSON.stringify(off))), stay);
    assert.deepEqual(new Set([...stay, ...back].map(key)), new Set(before.map(key)), 'Undo did not put every seat back exactly');
  }
  // A guest seated by hand since the clear — and a chair taken since — are never overwritten.
  const off = seatsToClear(before, true);
  const since = [{ guest_id: off[0]!.guest_id, table_id: 't01', seat_number: 9 }, { guest_id: 'new-guest', table_id: off[1]!.table_id, seat_number: off[1]!.seat_number }];
  const back = restorableSeats(off, since);
  assert.ok(!back.some((r) => r.guest_id === off[0]!.guest_id), 'Undo moved a guest the host seated since');
  assert.ok(!back.some((r) => r.table_id === off[1]!.table_id && r.seat_number === off[1]!.seat_number), 'Undo put two guests on one chair');
  assert.deepEqual(parseRestoreSeats([{ guest_id: 'x', table_id: 't', seat_number: -1 }, 'junk', null]), [], 'a junk restore row is dropped');
});

test('4 · wired: the action honours the scope, Clear keeps locked seats, Undo restores; the editor asks first', () => {
  const act = read('app/dashboard/[eventId]/seating/actions.ts');
  assert.match(act, /const scope = parseSeatScope\(formData\.get\('scope'\)\)/);
  assert.match(act, /const assignments = scope === 'all' \? seatsThatStay\(assignmentsRead, true\) : assignmentsRead;/, 'the seater ignores the host’s choice');
  assert.match(act, /scope === 'all' \? seatsToClear\(assignmentsRead, true\)[\s\S]{0,400}?\.eq\('locked', false\)/, '"Seat everyone again" can delete a locked seat');
  assert.match(act, /formData\.get\('intent'\) === 'clear'\)[\s\S]{0,80}?return clearAllSeats\(/);
  const clear = act.slice(act.indexOf('async function clearAllSeats('));
  assert.match(clear.slice(0, 1500), /const keepLocked = formData\.get\('keep_locked'\) !== 'false';[\s\S]*?if \(keepLocked\) del = del\.eq\('locked', false\);/, 'Clear does not keep locked seats by default');
  const undo = act.slice(act.indexOf('async function undoAutoArrange('));
  assert.match(undo.slice(0, 3000), /restorableSeats\(restore, await fetchAssignments\(supabase, eventId\)\)[\s\S]{0,200}?\.insert\(back\.map/, 'Undo does not put the seats back');
  const ed = read('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.match(ed, /data-seat-arrange-scope="unseated"/);
  assert.match(ed, /data-seat-arrange-scope="all"/);
  assert.match(ed, /label="Clear all seats"/);
  assert.equal((ed.match(/onAutoArrange=\{askAutoArrange\}/g) ?? []).length, 2, 'an Auto arrange button skips the question');
  assert.doesNotMatch(ed, /onClick=\{runAutoArrange\}|onAutoArrange=\{runAutoArrange\}/, 'an Auto arrange button skips the question');
  assert.match(ed, /restore: res\.restoreSeats \?\? \[\]/, 'the Undo forgets the seats that came off');
});
