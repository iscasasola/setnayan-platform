/**
 * a-moved-date-moves-the-whole-schedule.test.ts — owner 2026-10-04, verbatim:
 * *"Yes if possible"* (DECISION_LOG "CHANGING THE EVENT DATE MOVES THE WHOLE
 * SCHEDULE"). The real moves, as the couple's own session, are proven against
 * the replayed schema in `tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts`
 * (5–9). Held here:
 *
 *   1. the day arithmetic keeps every wall clock — across a month, a year, a
 *      leap day and the dates other countries change their clocks;
 *   2. ONE exact-day rule — a month or a year is no day, so nothing moves;
 *   3. Apply moves the whole Schedule when the date was WRITTEN, BEFORE it
 *      places a typed ceremony time — and the ceremony step no longer drags the
 *      ceremony alone (that would move it twice).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { exactDayOf, shiftWallClockDays, toDatetimeLocalValue, wallClockDayShift } from './schedule-datetime-local';

test('a whole-day move keeps every wall clock — month ends, leap days and clock-change weekends included', () => {
  const cases: Array<[string, string, string]> = [
    ['2031-06-07T15:00:00.000Z', '2031-06-07', '2031-06-21'],
    ['2031-01-31T08:30:00.000Z', '2031-01-31', '2031-03-02'],
    ['2032-02-28T23:45:00.000Z', '2032-02-28', '2032-03-01'], // over a leap day
    ['2031-03-29T02:30:00.000Z', '2031-03-29', '2031-03-30'], // Europe springs forward that night
    ['2031-11-01T01:30:00.000Z', '2031-11-01', '2031-11-02'], // the US falls back that night
    ['2031-12-31T21:45:00.000Z', '2031-12-31', '2032-01-07'], // over New Year
    ['2031-06-21T18:00:00.000Z', '2031-06-21', '2031-06-07'], // backwards
  ];
  for (const [iso, from, to] of cases) {
    const days = wallClockDayShift(from, to);
    const out = shiftWallClockDays(iso, days)!;
    assert.equal(toDatetimeLocalValue(out).slice(11), toDatetimeLocalValue(iso).slice(11), `${iso} lost its time`);
    assert.equal(toDatetimeLocalValue(out).slice(0, 10), to, `${iso} moved ${days} days but did not land on ${to}`);
    assert.equal(shiftWallClockDays(out, -days), iso, 'the move is not its own undo');
  }
  assert.equal(shiftWallClockDays('2031-06-07T15:00:30.000Z', 3), '2031-06-10T15:00:30.000Z', 'the seconds were dropped');
  assert.equal(shiftWallClockDays(null, 3), null, 'an open end gained a value');
  assert.equal(shiftWallClockDays('not a time', 3), 'not a time', 'an unreadable value was replaced by a guess');
});

test('ONE exact-day rule: a month or a year is no day — no move', () => {
  assert.equal(exactDayOf('2031-06-07', 'day'), '2031-06-07');
  assert.equal(exactDayOf('2031-06-07', null), '2031-06-07', 'an unread precision is the column default, day');
  assert.equal(exactDayOf('2031-06-01', 'month'), null);
  assert.equal(exactDayOf('2031-01-01', 'year'), null);
  assert.equal(exactDayOf(null, 'day'), null);
  assert.equal(wallClockDayShift(null, '2031-06-21'), 0, 'a month-precision old date measured a move');
  assert.equal(wallClockDayShift('2031-06-07', null), 0);
  assert.equal(wallClockDayShift('2031-06-07', '2031-06-07'), 0);
  assert.equal(wallClockDayShift('2031-06-07', '2031-06-21'), 14);
});

test('a SAVED date moves the WHOLE Schedule — in the date’s one door; Apply only stands a ceremony time on the live day', () => {
  /* 🗓 The date saves to the event at once (owner 2026-11-05, "it shouldn't rely on the hub"): the move left Apply for
     `updateEventDate`, which runs it right after its write. */
  const door = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/actions.ts'), 'utf8'));
  const body = door.slice(door.indexOf('export async function updateEventDate'), door.indexOf('export async function setPlanningMode'));
  const write = body.search(/\.update\(\{\s*event_date: eventDate/);
  const move = body.search(/const shifted = await moveScheduleWithDate\(\{\s*supabase,\s*eventId,\s*fromDay: exactDayOf\(prior\.date, prior\.precision\),\s*toDay: exactDayOf\(eventDate, newPrecision\),\s*\}\);/);
  assert.ok(write > 0, 'anti-vacuity: the date door writes the date');
  assert.ok(move > write, 'the date door does not move the whole Schedule after it writes the date');
  // A failed move is SAID beside a saved date — never "the date did not save".
  assert.match(body.slice(move), /if \(!shifted\.ok\) \{[\s\S]{0,300}?your Schedule stayed on the old day/);
  // Apply: the ceremony time stands on the LIVE day (one exact-day rule), and nothing there moves the Schedule.
  const apply = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  assert.match(apply, /const nextDay = exactDayOf\(live\.events\.event_date, live\.events\.event_date_precision\);/);
  assert.match(apply, /if \(nextDay && ceremonyTimeWrite !== undefined\) \{\s*const placed = await placeCeremonyBlock\(\{ supabase, eventId, day: nextDay, time: ceremonyTimeWrite \}\);/);
  assert.doesNotMatch(apply, /moveScheduleWithDate/, 'Apply moves the Schedule — it never holds a date any more');
});

/* 🔒 ALL OR NOTHING, AND ONCE (2026-10-04, train-g audit): the move is ONE SQL
   function — one statement, one transaction, once per move. The behaviour
   (a block that refuses moves nothing; two Applies shift once) is proven in
   tests/db/venues-and-ceremony-time-wait-for-apply.db.test.ts (10 · 11). */
test('the whole-Schedule move is the ONE SQL function — never a loop of per-block writes from here', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib/ceremony-time.server.ts'), 'utf8'));
  const fn = src.slice(src.indexOf('export async function moveScheduleWithDate('));
  assert.ok(fn.length > 0 && src.includes('export async function moveScheduleWithDate('), 'anti-vacuity: the move is gone');
  assert.match(fn, /supabase\.rpc\('move_event_schedule_with_date', \{\s*p_event_id: eventId,\s*p_to_day: toDay,\s*\}\)/);
  assert.doesNotMatch(fn, /p_from_day/, 'the caller chooses where the move is measured from again');
  // A move that did not happen is never "ok": only moved / aligned are.
  assert.match(fn, /if \(\(answer\.status === 'moved' \|\| answer\.status === 'aligned'\) && Number\.isInteger\(moved\) && moved >= 0\) \{/);
  assert.doesNotMatch(fn, /\.from\('event_schedule_blocks'\)|\.update\(|for \(/, 'the Schedule is moved block by block again — a failure part-way leaves half a day');
});
