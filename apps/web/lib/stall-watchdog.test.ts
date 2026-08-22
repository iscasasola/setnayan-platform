import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStallWatchdog, type WatchdogTimers } from './stall-watchdog';

/** A hand-cranked clock — no waiting, and every elapsed ms is deliberate. */
function fakeClock() {
  let now = 0;
  let seq = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: WatchdogTimers = {
    setTimeout: (fn, ms) => {
      const id = ++seq;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (handle) => {
      pending.delete(handle as number);
    },
  };
  return {
    timers,
    /** Advance the clock, firing anything due. */
    tick(ms: number) {
      now += ms;
      for (const [id, t] of [...pending]) {
        if (t.at <= now) {
          pending.delete(id);
          t.fn();
        }
      }
    },
    get outstanding() {
      return pending.size;
    },
  };
}

function build(timeoutMs = 1000) {
  const clock = fakeClock();
  let stalls = 0;
  const wd = createStallWatchdog({
    timeoutMs,
    onStall: () => {
      stalls += 1;
    },
    timers: clock.timers,
  });
  return { clock, wd, stalls: () => stalls };
}

test('silence past the window fires the stall', () => {
  const { clock, wd, stalls } = build();
  wd.arm();
  clock.tick(999);
  assert.equal(stalls(), 0, 'must not fire early');
  clock.tick(1);
  assert.equal(stalls(), 1, 'fires the moment the window closes');
  assert.equal(wd.settled, true);
});

test('bytes moving resets the clock — a slow upload is never killed', () => {
  const { clock, wd, stalls } = build();
  wd.arm();
  // 20 progress events, each 900ms apart: 18 SECONDS of a healthy transfer,
  // eighteen times the stall window, and it must never fire.
  for (let i = 0; i < 20; i += 1) {
    clock.tick(900);
    wd.arm();
  }
  assert.equal(stalls(), 0, 'a transfer that keeps moving is not a stall');
  // …and it still fires once the bytes genuinely stop.
  clock.tick(1000);
  assert.equal(stalls(), 1);
});

test('a finished transfer never fires', () => {
  const { clock, wd, stalls } = build();
  wd.arm();
  wd.settle();
  clock.tick(60_000);
  assert.equal(stalls(), 0);
});

/**
 * The next two assert each guard's OWN effect, at the only moment it is
 * visible. Checking `outstanding` AFTER a tick proves nothing: the tick fires
 * the timer and removes it, so a leaked clock and a disposed one both read 0.
 * Three guards here are deliberately belt-and-braces, which means end-state
 * tests cannot tell them apart — each covers the others.
 */
test('settle() disposes the pending clock immediately', () => {
  const { clock, wd } = build();
  wd.arm();
  assert.equal(clock.outstanding, 1, 'armed');
  wd.settle();
  assert.equal(clock.outstanding, 0, 'settle must dispose the timer, not merely ignore it');
});

test('a progress event racing completion schedules nothing', () => {
  const { clock, wd, stalls } = build();
  wd.arm();
  wd.settle();
  wd.arm(); // late progress event, same tick as load
  assert.equal(clock.outstanding, 0, 'a settled watchdog must never schedule again');
  clock.tick(60_000);
  assert.equal(stalls(), 0, 'a succeeded upload must never report a stall');
});

test('the stall is reported exactly once', () => {
  const { clock, wd, stalls } = build();
  wd.arm();
  clock.tick(5000);
  wd.arm();
  clock.tick(5000);
  wd.settle();
  clock.tick(5000);
  assert.equal(stalls(), 1);
});

test('re-arming does not pile up timers', () => {
  const { clock, wd } = build();
  for (let i = 0; i < 50; i += 1) wd.arm();
  assert.equal(clock.outstanding, 1, 'exactly one clock at a time');
});

test('arm(ms) switches budget — the response wait is not the transfer wait', () => {
  const { clock, wd, stalls } = build(1000);
  wd.arm();          // transfer clock: 1s of silence is fatal
  clock.tick(900);
  wd.arm(10_000);    // body fully sent; now waiting on the server
  clock.tick(9_000); // 9x the transfer budget, and still healthy
  assert.equal(stalls(), 0, 'the server may take longer than a stalled byte');
  clock.tick(1_000);
  assert.equal(stalls(), 1, 'but it is still bounded — never infinite');
});

test('the longer budget still cannot fire after the transfer settles', () => {
  const { clock, wd, stalls } = build(1000);
  wd.arm();
  wd.arm(10_000);
  wd.settle();
  clock.tick(60_000);
  assert.equal(stalls(), 0);
  assert.equal(clock.outstanding, 0, 'and leaves no timer behind');
});
