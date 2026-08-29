import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  pipelineDayLabel,
  pipelinePressureLine,
  pipelinePressureState,
} from './vendor-pipeline-pressure';

// ── the state ladder ────────────────────────────────────────────────────────

test('room · last · full are decided by the gap to the ceiling', () => {
  assert.equal(pipelinePressureState(0, 3), 'room');
  assert.equal(pipelinePressureState(1, 3), 'room');
  assert.equal(pipelinePressureState(2, 3), 'last', 'one slot left is its own state');
  assert.equal(pipelinePressureState(3, 3), 'full');
});

test('a cap of 1 has no “room” state — the first customer is the last slot', () => {
  assert.equal(pipelinePressureState(0, 1), 'last');
  assert.equal(pipelinePressureState(1, 1), 'full');
});

test('somehow past the ceiling still reads FULL, never negative room', () => {
  assert.equal(pipelinePressureState(9, 3), 'full');
});

test('a zero or nonsense ceiling reads FULL, never “room to spare”', () => {
  // If the grid ever answers 0, the honest reading is "this plan cannot chase
  // anybody", not "unlimited". Erring the other way would draw an encouraging
  // line on a screen where every accept is about to be refused.
  assert.equal(pipelinePressureState(0, 0), 'full');
  assert.equal(pipelinePressureState(0, -2), 'full');
});

// ── the day label ───────────────────────────────────────────────────────────

test('the day is read from the STRING, never through new Date()', () => {
  assert.equal(pipelineDayLabel('2027-02-14'), '14 Feb');
  assert.equal(pipelineDayLabel('2027-12-01'), '1 Dec');
  assert.equal(pipelineDayLabel('2027-01-31'), '31 Jan');
});

test('THE TRAP: the label does not shift a day west of Greenwich', () => {
  // new Date('2027-02-14') is midnight UTC; local getters in the Americas report
  // the 13th. That exact mistake printed the wrong day on 41 screens (2026-08-04).
  // This asserts the OUTPUT, which is what a supplier reads.
  const tz = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    assert.equal(pipelineDayLabel('2027-02-14'), '14 Feb');
    process.env.TZ = 'Pacific/Kiritimati';
    assert.equal(pipelineDayLabel('2027-02-14'), '14 Feb');
  } finally {
    if (tz === undefined) delete process.env.TZ;
    else process.env.TZ = tz;
  }
});

test('an unusable date yields null, so the caller draws nothing', () => {
  assert.equal(pipelineDayLabel(null), null);
  assert.equal(pipelineDayLabel(''), null);
  assert.equal(pipelineDayLabel('not-a-date'), null);
  assert.equal(pipelineDayLabel('2027-13-01'), null, 'month 13 is not a month');
  assert.equal(pipelineDayLabel('2027-00-09'), null);
});

// ── the sentence ────────────────────────────────────────────────────────────

test('each state says a different, true thing — and every one names the day', () => {
  const at = (used: number, cap: number) =>
    pipelinePressureLine({
      used,
      cap,
      dateIso: '2027-02-14',
      state: pipelinePressureState(used, cap),
    });

  assert.equal(at(1, 3), "You're chasing 1 of 3 customers for 14 Feb.");
  assert.equal(at(2, 3), "Your last slot for 14 Feb — you're chasing 2 of 3.");
  assert.equal(at(3, 3), "You're chasing 3 of 3 for 14 Feb — your plan's limit.");

  for (const line of [at(1, 3), at(2, 3), at(3, 3)]) {
    assert.ok(line!.includes('14 Feb'), `every state must name the day: ${line}`);
  }
});

test('no day, no sentence — “you are full” with no date reads as the shop being shut', () => {
  assert.equal(
    pipelinePressureLine({ used: 3, cap: 3, dateIso: '', state: 'full' }),
    null,
  );
});
