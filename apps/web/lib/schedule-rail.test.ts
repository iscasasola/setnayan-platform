import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDrag,
  daysBetween,
  findGaps,
  formatClock,
  formatClockRange,
  formatDateHeading,
  formatDuration,
  formatHour,
  groupByWallDate,
  layoutLanes,
  railHours,
  sameSpan,
  snapMinutes,
  spanOf,
  toDatetimeLocal,
  wallDateKey,
  wallMinutes,
} from './schedule-rail';
import { fromDatetimeLocalValue } from './schedule-datetime-local';

/*
  The rail's arithmetic. The load-bearing property is the first test: a stored
  wall clock read onto the rail and written back through the action's own
  parser comes out byte-identical — the round trip that, broken, once moved a
  ceremony eight hours.
*/

test('🔑 a moment read onto the rail and written back is the same stored time', () => {
  for (const iso of [
    '2026-12-18T14:00:00.000Z',
    '2026-12-18T08:05:00.000Z',
    '2026-12-18T23:55:00.000Z',
    '2026-12-18T00:00:00.000Z',
  ]) {
    const back = fromDatetimeLocalValue(toDatetimeLocal(wallDateKey(iso), wallMinutes(iso)));
    assert.equal(back, iso);
  }
});

test('the rail reads the wall clock from the UTC components, never the reader’s zone', () => {
  assert.equal(wallMinutes('2026-12-18T14:00:00Z'), 14 * 60);
  assert.equal(wallDateKey('2026-12-18T23:30:00Z'), '2026-12-18');
});

test('a span past midnight keeps counting instead of wrapping to the top', () => {
  const s = spanOf('2026-12-18T23:00:00Z', '2026-12-19T01:00:00Z');
  assert.deepEqual(s, { startMin: 23 * 60, endMin: 25 * 60, hasEnd: true });
  assert.equal(toDatetimeLocal('2026-12-18', 25 * 60), '2026-12-19T01:00');
});

test('an open-ended moment is still drawn, and says it has no end', () => {
  assert.deepEqual(spanOf('2026-12-18T14:00:00Z', null), {
    startMin: 840,
    endMin: 870,
    hasEnd: false,
  });
});

test('clock formatting drops the repeated AM/PM, as the prototype reads', () => {
  assert.equal(formatClock(14 * 60), '2:00 PM');
  assert.equal(formatClock(0), '12:00 AM');
  assert.equal(formatClock(12 * 60), '12:00 PM');
  assert.equal(formatClockRange(14 * 60, 15 * 60 + 30), '2:00 – 3:30 PM');
  assert.equal(formatClockRange(8 * 60, 12 * 60), '8:00 AM – 12:00 PM');
  assert.equal(formatHour(7), '7 AM');
  assert.equal(formatHour(13), '1 PM');
});

test('durations read the way people say them', () => {
  assert.equal(formatDuration(30), '30 min');
  assert.equal(formatDuration(240), '4 h');
  assert.equal(formatDuration(90), '1 h 30 min');
});

test('dates and days-to-go', () => {
  assert.equal(formatDateHeading('2026-12-18'), 'Friday 18 December');
  assert.equal(daysBetween('2026-09-25', '2026-12-18'), 84);
  assert.equal(daysBetween('bad', '2026-12-18'), null);
});

test('snap is to five minutes', () => {
  assert.equal(snapMinutes(842), 840);
  assert.equal(snapMinutes(843), 845);
});

test('a moved moment lands on the grid and keeps its length', () => {
  const ceremony = { startMin: 840, endMin: 930 };
  assert.deepEqual(applyDrag(ceremony, 'move', 31), { startMin: 870, endMin: 960 });
  assert.deepEqual(applyDrag({ startMin: 847, endMin: 937 }, 'move', 0), {
    startMin: 845,
    endMin: 935,
  });
});

test('resizing never flips the ends and keeps five minutes', () => {
  const b = { startMin: 840, endMin: 870 };
  assert.deepEqual(applyDrag(b, 'top', 120), { startMin: 865, endMin: 870 });
  assert.deepEqual(applyDrag(b, 'bottom', -120), { startMin: 840, endMin: 845 });
  assert.deepEqual(applyDrag(b, 'bottom', 29), { startMin: 840, endMin: 900 });
});

test('a drag that lands where it started writes nothing', () => {
  const b = { startMin: 840, endMin: 930 };
  assert.ok(sameSpan(applyDrag(b, 'move', 2), b));
  assert.ok(!sameSpan(applyDrag(b, 'move', 3), b));
});

test('overlapping moments share the width; a lone one takes it all', () => {
  const lanes = layoutLanes([
    { id: 'hmua', startMin: 480, endMin: 720 },
    { id: 'ingress', startMin: 600, endMin: 780 },
    { id: 'arrive', startMin: 810, endMin: 840 },
  ]);
  assert.deepEqual(lanes.get('hmua'), { lane: 0, lanes: 2 });
  assert.deepEqual(lanes.get('ingress'), { lane: 1, lanes: 2 });
  assert.deepEqual(lanes.get('arrive'), { lane: 0, lanes: 1 });
});

test('back-to-back moments do not count as overlapping', () => {
  const lanes = layoutLanes([
    { id: 'a', startMin: 840, endMin: 930 },
    { id: 'b', startMin: 930, endMin: 960 },
  ]);
  assert.deepEqual(lanes.get('a'), { lane: 0, lanes: 1 });
  assert.deepEqual(lanes.get('b'), { lane: 0, lanes: 1 });
});

test('gaps are the empty stretches of at least fifteen minutes', () => {
  const spans = [
    { startMin: 480, endMin: 780, hasEnd: true },
    { startMin: 810, endMin: 930, hasEnd: true },
    { startMin: 940, endMin: 1000, hasEnd: true },
  ];
  assert.deepEqual(findGaps(spans, 420, 1080), [
    { startMin: 420, endMin: 480 },
    { startMin: 780, endMin: 810 },
    { startMin: 1000, endMin: 1080 },
  ]);
});

test('the ruler covers the day, and never fewer than eight hours', () => {
  assert.deepEqual(railHours([]), { startHour: 8, endHour: 22 });
  assert.deepEqual(
    railHours([
      { startMin: 480, endMin: 720, hasEnd: true },
      { startMin: 1320, endMin: 1350, hasEnd: true },
    ]),
    { startHour: 8, endHour: 23 },
  );
  const short = railHours([{ startMin: 840, endMin: 900, hasEnd: true }]);
  assert.equal(short.endHour - short.startHour, 8);
  assert.ok(short.startHour <= 14 && short.endHour >= 15);
});

test('moments on two dates become two rails, earliest first', () => {
  const rails = groupByWallDate([
    { id: 'c', start_at: '2026-12-18T14:00:00Z' },
    { id: 'r', start_at: '2026-12-17T19:00:00Z' },
    { id: 'd', start_at: '2026-12-18T17:00:00Z' },
  ]);
  assert.deepEqual(
    rails.map((r) => [r.dateKey, r.rows.map((x) => x.id)]),
    [
      ['2026-12-17', ['r']],
      ['2026-12-18', ['c', 'd']],
    ],
  );
});
