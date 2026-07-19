/**
 * Unit suite for the honest day-of clock. Invariants: with a run-of-show we count
 * down to the next block + hours left in the couple's program; with no blocks we
 * degrade to an honest T-band elapsed and never fabricate a vendor service end.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveDayOfClock, formatDuration } from './vendor-dayof-countdown';
import type { RunOfShowBlock } from './run-of-show';

const now = new Date('2026-07-16T10:00:00+08:00');

function block(p: Partial<RunOfShowBlock>): RunOfShowBlock {
  return {
    block_id: p.block_id ?? 'b1',
    label: p.label ?? 'Block',
    start_at: p.start_at ?? '2026-07-16T10:00:00+08:00',
    end_at: p.end_at ?? null,
    location: p.location ?? null,
    run_state: p.run_state ?? 'upcoming',
    actual_start_at: p.actual_start_at ?? null,
  };
}

test('program mode: counts down to the next upcoming block', () => {
  const blocks = [
    block({ block_id: 'a', label: 'Ceremony', start_at: '2026-07-16T09:00:00+08:00', run_state: 'done' }),
    block({ block_id: 'b', label: 'Grand Entrance', start_at: '2026-07-16T10:45:00+08:00', run_state: 'upcoming' }),
  ];
  const c = deriveDayOfClock(blocks, now);
  assert.equal(c.mode, 'program');
  if (c.mode === 'program') {
    assert.equal(c.minutesToNext, 45);
    assert.equal(c.nextLabel, 'Grand Entrance');
    assert.equal(c.allDone, false);
  }
});

test('program mode: hours left counts to the last block end', () => {
  const blocks = [
    block({ block_id: 'a', start_at: '2026-07-16T09:00:00+08:00', end_at: '2026-07-16T10:00:00+08:00', run_state: 'done' }),
    block({ block_id: 'b', start_at: '2026-07-16T11:00:00+08:00', end_at: '2026-07-16T13:00:00+08:00', run_state: 'upcoming' }),
  ];
  const c = deriveDayOfClock(blocks, now);
  if (c.mode === 'program') {
    // last end = 13:00, now = 10:00 → 3.0h
    assert.equal(c.hoursLeftInProgram, 3);
  } else {
    assert.fail('expected program mode');
  }
});

test('program mode: never negative when the program has passed', () => {
  const blocks = [
    block({ block_id: 'a', start_at: '2026-07-16T06:00:00+08:00', end_at: '2026-07-16T08:00:00+08:00', run_state: 'done' }),
  ];
  const c = deriveDayOfClock(blocks, now);
  if (c.mode === 'program') {
    assert.equal(c.hoursLeftInProgram, 0);
    assert.equal(c.minutesToNext, null); // nothing upcoming
  } else {
    assert.fail('expected program mode');
  }
});

test('program mode: allDone when every block is done', () => {
  const blocks = [block({ block_id: 'a', run_state: 'done', start_at: '2026-07-16T08:00:00+08:00' })];
  const c = deriveDayOfClock(blocks, now);
  if (c.mode === 'program') assert.equal(c.allDone, true);
  else assert.fail('expected program mode');
});

test('tband mode: no blocks → honest elapsed, never a fake end', () => {
  const c = deriveDayOfClock([], now);
  assert.equal(c.mode, 'tband');
  if (c.mode === 'tband') {
    // default anchor = now - 60m → 60m elapsed
    assert.equal(c.minutesElapsed, 60);
  }
});

test('tband mode: honors an explicit anchor and clamps at 0', () => {
  const anchorFuture = new Date('2026-07-16T10:30:00+08:00'); // after now
  const c = deriveDayOfClock([], now, anchorFuture);
  if (c.mode === 'tband') assert.equal(c.minutesElapsed, 0);
  else assert.fail('expected tband mode');
});

test('formatDuration renders H/M compactly', () => {
  assert.equal(formatDuration(135), '2h 15m');
  assert.equal(formatDuration(45), '45m');
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(-5), '0m');
});
