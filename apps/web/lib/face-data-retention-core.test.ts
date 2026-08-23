import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FACE_DATA_POST_EVENT_GRACE_DAYS,
  eventLastDay,
  faceDataDeletableFromMs,
  faceDataIsPastRetention,
} from './face-data-retention-core';
import { FULL_RES_POST_EVENT_GRACE_DAYS } from './papic-fullres-drop-core';

/**
 * The boundary, not the volume. Production holds no face rows at all, so a test
 * that only proves "nothing was deleted" would pass against a sweep that does
 * nothing — and against one that deletes everything. These pin the DAY.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Midnight UTC on a bare day, the same anchor the module uses. */
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

test('the grace period IS the full-res floor, not a second copy of it', () => {
  // The pack says "the same clock as the full-resolution photo floor". If these
  // ever differ, one of the two promises has silently become false.
  assert.equal(FACE_DATA_POST_EVENT_GRACE_DAYS, FULL_RES_POST_EVENT_GRACE_DAYS);
  assert.equal(FACE_DATA_POST_EVENT_GRACE_DAYS, 92);
});

test('the last day is the end date when a celebration spans several days', () => {
  assert.equal(eventLastDay('2026-03-01', '2026-03-05'), '2026-03-05');
});

test('a one-day event floors on its only date', () => {
  assert.equal(eventLastDay('2026-03-01', null), '2026-03-01');
});

test('a malformed end date EARLIER than the start can only be ignored', () => {
  // GREATEST is the one-way valve: a bad end date must never pull the clock
  // backwards and delete sooner than promised.
  assert.equal(eventLastDay('2026-03-10', '2026-03-01'), '2026-03-10');
});

test('an end date with no start date still has a clock', () => {
  // Postgres GREATEST ignores NULLs; so does this.
  assert.equal(eventLastDay(null, '2026-03-05'), '2026-03-05');
});

test('an event with no dates at all has NO clock — it is never swept', () => {
  assert.equal(eventLastDay(null, null), null);
  assert.equal(faceDataDeletableFromMs(null, null), null);
  // Fails CLOSED. "No date" must never read as "infinitely old".
  assert.equal(faceDataIsPastRetention(null, null, Date.now()), false);
  assert.equal(faceDataIsPastRetention(undefined, undefined, Date.now()), false);
  assert.equal(faceDataIsPastRetention('not-a-date', '', Date.now()), false);
});

test('THE BOUNDARY: yesterday · 91 days · 92 days · 93 days', () => {
  const last = '2026-01-01';
  const from = dayMs(last) + 92 * MS_PER_DAY;
  assert.equal(faceDataDeletableFromMs(last, null), from);

  // An event that ended yesterday keeps its face data.
  assert.equal(faceDataIsPastRetention(last, null, dayMs(last) + 1 * MS_PER_DAY), false);
  // 91 days — still inside the promise. Three months is not yet up.
  assert.equal(faceDataIsPastRetention(last, null, dayMs(last) + 91 * MS_PER_DAY), false);
  // One millisecond before the fuse.
  assert.equal(faceDataIsPastRetention(last, null, from - 1), false);
  // Exactly 92 days — the fuse. `>=`, so the boundary day itself deletes.
  assert.equal(faceDataIsPastRetention(last, null, from), true);
  // 93 days — well past.
  assert.equal(faceDataIsPastRetention(last, null, dayMs(last) + 93 * MS_PER_DAY), true);
});

test('a multi-day celebration measures from its LAST day, not its first', () => {
  // The defect 20271126998711 fixed for photos, prevented here by construction:
  // a ten-day trip must not lose its closing-night face data nine days early.
  const start = '2026-01-01';
  const end = '2026-01-11';
  const justPastStart = dayMs(start) + 92 * MS_PER_DAY;
  assert.equal(faceDataIsPastRetention(start, end, justPastStart), false);
  assert.equal(faceDataIsPastRetention(start, end, dayMs(end) + 92 * MS_PER_DAY), true);
});

test('a timestamp-shaped date still reads as its day', () => {
  // Postgres may hand back a DATE as `2026-01-01` or a timestamp string.
  assert.equal(eventLastDay('2026-01-01T00:00:00+00:00', null), '2026-01-01');
});

test('an unreadable clock never deletes', () => {
  assert.equal(faceDataIsPastRetention('2026-01-01', null, Number.NaN), false);
});

test('the anchor is UTC midnight, so no event deletes a day early', () => {
  // `new Date('2026-01-01')` is midnight UTC — which is 31 Dec west of
  // Greenwich. Anchoring explicitly is what stops the clock drifting a day.
  assert.equal(faceDataDeletableFromMs('2026-01-01', null, 0), Date.UTC(2026, 0, 1));
});
