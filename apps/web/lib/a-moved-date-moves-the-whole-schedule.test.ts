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

test('Apply moves the WHOLE Schedule when the date was written — before the ceremony time, never the ceremony alone', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  const move = src.search(/if \(dateWritten\) \{\s*const shifted = await moveScheduleWithDate\(\{ supabase, eventId, fromDay: priorDay, toDay: nextDay \}\);/);
  const place = src.indexOf('await placeCeremonyBlock(');
  assert.ok(move > 0, 'Apply does not move the whole Schedule when the date is written');
  assert.ok(place > move, 'the ceremony time is placed before the Schedule moves — the move would drag a typed time off its day');
  assert.match(src, /if \(nextDay && ceremonyTimeWrite !== undefined\) \{\s*const placed = await placeCeremonyBlock\(\{ supabase, eventId, day: nextDay, time: ceremonyTimeWrite \}\);/, 'the ceremony step still runs on a date-only move — the ceremony would move twice');
  assert.doesNotMatch(src.slice(place, place + 400), /fromDay/, 'the ceremony step still drags the ceremony alone');
  // One exact-day rule for the ceremony's day and the move's two days.
  assert.match(src, /const priorDay = exactDayOf\(live\.events\.event_date, live\.events\.event_date_precision\);/);
  // A failed move is SAID — the date is live, so Apply again would not finish it.
  assert.match(src, /if \(!shifted\.ok\) \{[\s\S]{0,300}?some Schedule times stayed on the old day/, 'a half-moved Schedule reads as "press Apply again", which cannot finish it');
});
