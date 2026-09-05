/**
 * S1 · the program tick under a fake timer — cadence, drift correction, gap accounting.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createProgramClock, PROGRAM_TICK_MS } from './program-clock';

/** A deterministic scheduler: `advance(ms)` runs every due callback in order. */
function fakeTimers() {
  let now = 0;
  let seq = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    now: () => now,
    schedule: (fn: () => void, delay: number) => {
      const id = ++seq;
      pending.set(id, { at: now + delay, fn });
      return id;
    },
    cancel: (h: unknown) => {
      pending.delete(h as number);
    },
    /** Move time forward, firing due timers at their scheduled instants. */
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let next: [number, { at: number; fn: () => void }] | null = null;
        for (const entry of pending) if (!next || entry[1].at < next[1].at) next = entry;
        if (!next || next[1].at > end) break;
        pending.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    /** Let the next due timer fire LATE by `lateMs` (a busy worker), then continue. */
    fireNextLate(lateMs: number) {
      let next: [number, { at: number; fn: () => void }] | null = null;
      for (const entry of pending) if (!next || entry[1].at < next[1].at) next = entry;
      assert.ok(next, 'a timer must be pending');
      pending.delete(next[0]);
      now = next[1].at + lateMs;
      next[1].fn();
    },
    pendingCount: () => pending.size,
  };
}

test('ticks at 33.3 ms — 30 ticks in one second, gap never above one tick when on time', () => {
  const t = fakeTimers();
  const ticks: number[] = [];
  const clock = createProgramClock((i) => ticks.push(i), t);
  clock.start();
  // 30 × (1000/30) is 1000.0000000000001 in floats, so probe 1 ms past the 30th tick's
  // nominal instant; the 31st is not due until 1033 ms.
  t.advance(1001);
  assert.equal(ticks.length, 30);
  assert.deepEqual(ticks.slice(0, 3), [1, 2, 3]);
  const s = clock.stats();
  assert.equal(s.ticks, 30);
  assert.ok(s.maxGapTicks <= 1.0001, `maxGapTicks ${s.maxGapTicks}`);
  assert.equal(s.longGaps, 0);
  assert.equal(PROGRAM_TICK_MS, 1000 / 30);
});

test('a late callback is measured as a gap; the next tick re-anchors to the GRID — never a burst', () => {
  const t = fakeTimers();
  const firedAt: number[] = [];
  const clock = createProgramClock(() => firedAt.push(t.now()), t);
  clock.start();
  t.advance(PROGRAM_TICK_MS * 3); // 3 on-time ticks: slots 1, 2, 3
  t.fireNextLate(90); // the 4th (slot 4, nominal 133 ms) fires at 223 ms
  assert.equal(firedAt.length, 4);
  const { maxGapTicks: gap, longGaps, maxGapAtMs } = clock.stats();
  assert.ok(gap > 3.6 && gap < 3.8, `gap should be ~3.7 ticks, got ${gap}`);
  assert.equal(longGaps, 1, 'one gap wider than two ticks');
  assert.ok(Math.abs(maxGapAtMs - (4 * PROGRAM_TICK_MS + 90)) < 1e-6, `worst gap ended at ${maxGapAtMs}`);
  // Slots 5 and 6 (167, 200 ms) went by while the worker was busy. They are SKIPPED, not
  // replayed: nothing fires at 223 ms itself…
  t.advance(0);
  assert.equal(firedAt.length, 4, 'no burst of catch-up ticks at the late instant');
  // …the 5th tick lands on the next grid instant, slot 7 = 233 ms — 10 ms after the late
  // tick, not a full interval after it (that is the drift correction)…
  t.advance(PROGRAM_TICK_MS);
  assert.equal(firedAt.length, 5);
  assert.ok(Math.abs((firedAt[4] ?? 0) - 7 * PROGRAM_TICK_MS) < 1e-6, `5th at ${firedAt[4]}`);
  // …and the cadence continues on the original grid (slot 8 = 267 ms).
  t.advance(PROGRAM_TICK_MS);
  assert.equal(firedAt.length, 6);
  assert.ok(Math.abs((firedAt[5] ?? 0) - 8 * PROGRAM_TICK_MS) < 1e-6, `6th at ${firedAt[5]}`);
  assert.equal(clock.stats().longGaps, 1, 'the recovery ticks are on-grid, not further long gaps');
});

test('stop cancels the pending timer and no further ticks fire; start after stop re-arms', () => {
  const t = fakeTimers();
  let count = 0;
  const clock = createProgramClock(() => count++, t);
  clock.start();
  t.advance(PROGRAM_TICK_MS * 2);
  clock.stop();
  assert.equal(t.pendingCount(), 0);
  t.advance(1000);
  assert.equal(count, 2);
  clock.start();
  t.advance(PROGRAM_TICK_MS);
  assert.equal(count, 3);
});

test('a throwing tick does not stop the clock', () => {
  const t = fakeTimers();
  let count = 0;
  const clock = createProgramClock(() => {
    count++;
    if (count === 1) throw new Error('boom');
  }, t);
  clock.start();
  t.advance(PROGRAM_TICK_MS * 3);
  assert.equal(count, 3);
});
