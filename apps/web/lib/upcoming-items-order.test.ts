/**
 * The "what's next" rail mixes two kinds of value, and only one of them is a
 * real moment. These tests RUN the merge with both kinds present — the defect
 * they guard shipped under a green suite because nothing could reach the code
 * without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeUpcoming } from './upcoming-items';
import { plannedInstant } from './run-of-show';
import { DEFAULT_EVENT_TZ } from './schedule';

/** A stored schedule time, lifted the way fetchScheduleBlockItems lifts it. */
const block = (wallClockIso: string, id: string) => ({
  id,
  date: new Date(plannedInstant(wallClockIso, DEFAULT_EVENT_TZ)!),
});
/** A meeting or appointment — already a real instant. */
const meeting = (instantIso: string, id: string) => ({ id, date: new Date(instantIso) });

test('a 2 PM ceremony sorts BEFORE a 4 PM meeting on the same day', () => {
  // The live defect: the ceremony's wall clock (14:00Z) read as an instant is
  // 10 PM Manila, so it landed AFTER the 4 PM meeting. A couple opening their
  // event home saw their own ceremony listed below a vendor call.
  const now = new Date('2026-12-18T00:00:00.000Z'); // 8 AM at the venue
  const out = mergeUpcoming(
    [
      meeting('2026-12-18T08:00:00.000Z', 'meeting-4pm'), // 4 PM Manila
      block('2026-12-18T14:00:00.000Z', 'ceremony-2pm'), // 2 PM at the venue
    ],
    now,
  );
  assert.deepEqual(
    out.map((i) => i.id),
    ['ceremony-2pm', 'meeting-4pm'],
    'the ceremony happens first and must be listed first',
  );
});

test('the whole day orders correctly against real-instant neighbours', () => {
  // 6 AM at the venue — before everything below. (An earlier version of this
  // fixture put `now` exactly ON the first item; the filter is strictly
  // greater-than, so it silently dropped. The test caught my fixture, which is
  // what a test that actually RUNS does.)
  const now = new Date('2026-12-17T22:00:00.000Z');
  const out = mergeUpcoming(
    [
      block('2026-12-18T21:45:00.000Z', 'send-off'), // 9:45 PM venue
      meeting('2026-12-18T08:00:00.000Z', 'meeting-4pm'), // 4 PM Manila
      block('2026-12-18T14:00:00.000Z', 'ceremony'), // 2 PM venue
      block('2026-12-18T08:00:00.000Z', 'prep'), // 8 AM venue
    ],
    now,
  );
  assert.deepEqual(out.map((i) => i.id), ['prep', 'ceremony', 'meeting-4pm', 'send-off']);
});

test('a moment that has already happened drops out', () => {
  // 8 AM at the venue is 00:00Z; "now" is 10 AM at the venue.
  const now = new Date('2026-12-18T02:00:00.000Z');
  const out = mergeUpcoming(
    [block('2026-12-18T08:00:00.000Z', 'prep'), block('2026-12-18T14:00:00.000Z', 'ceremony')],
    now,
  );
  assert.deepEqual(out.map((i) => i.id), ['ceremony'], 'prep is over; only the ceremony remains');
});

test('the answer does not change with the reader’s timezone', () => {
  const run = () =>
    mergeUpcoming(
      [
        meeting('2026-12-18T08:00:00.000Z', 'meeting'),
        block('2026-12-18T14:00:00.000Z', 'ceremony'),
      ],
      new Date('2026-12-18T00:00:00.000Z'),
    ).map((i) => i.id);
  const expected = ['ceremony', 'meeting'];
  for (const tz of ['UTC', 'Asia/Manila', 'America/New_York', 'Pacific/Kiritimati']) {
    const before = process.env.TZ;
    process.env.TZ = tz;
    assert.deepEqual(run(), expected, `wrong order under TZ=${tz}`);
    process.env.TZ = before;
  }
});
