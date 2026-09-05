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
  t.advance(1000);
  assert.equal(ticks.length, 30);
  assert.deepEqual(ticks.slice(0, 3), [1, 2, 3]);
  const s = clock.stats();
  assert.equal(s.ticks, 30);
  assert.ok(s.maxGapTicks <= 1.0001, `maxGapTicks ${s.maxGapTicks}`);
  assert.equal(PROGRAM_TICK_MS, 1000 / 30);
});

test('a late callback is measured as a gap AND the next tick is re-anchored, not pushed', () => {
  const t = fakeTimers();
  let count = 0;
  const clock = createProgramClock(() => count++, t);
  clock.start();
  t.advance(PROGRAM_TICK_MS * 3); // 3 on-time ticks
  t.fireNextLate(100); // the 4th fires ~133 ms after the 3rd
  assert.equal(count, 4);
  const gap = clock.stats().maxGapTicks;
  assert.ok(gap > 3.9 && gap < 4.1, `gap should be ~4 ticks, got ${gap}`);
  // Drift correction: the 5th tick is scheduled against origin + 5 × interval, which is
  // already past — so it is due IMMEDIATELY (delay 0), not a full interval later.
  t.advance(0);
  assert.equal(count, 5, 'the clock catches up rather than carrying the delay forward');
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
