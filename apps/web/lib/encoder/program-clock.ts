/**
 * S1 · the program tick.
 *
 * A fixed-cadence timer that drives the compositor at 30 fps (33.3 ms). Runs INSIDE the
 * worker on purpose: a page's own timers are throttled the moment its window is hidden or
 * occluded (Chromium: 1 Hz after a few seconds, then 1/min; WebKit similar), and a live
 * encoder cannot be at the mercy of which window the couple has in front. Dedicated-worker
 * timers are not throttled by page visibility, which is the whole reason S1 exists.
 *
 * // S3 replaces this tick with the AudioContext-derived clock
 * S3 owns the master clock (`AudioContext.currentTime`); when it lands, `createProgramClock`
 * is swapped for a clock fed from the audio graph and the rest of the worker is unchanged.
 * Nothing before S3 may assume a programme audio stream (rule 19).
 *
 * Drift-corrected: each tick is scheduled against `start + n × interval`, not `now +
 * interval`, so a late callback shortens the next wait instead of pushing every later tick.
 * Gap-accounted: `maxGapTicks` records the worst distance between two consecutive ticks in
 * whole intervals — the number the evidence run prints (no gap > 2 ticks).
 */

export const PROGRAM_TICK_MS = 1000 / 30;

export type ProgramClockDeps = {
  now: () => number;
  schedule: (fn: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
};

export type ProgramClock = {
  start(): void;
  stop(): void;
  /** Ticks fired so far, plus the worst inter-tick gap measured in whole intervals. */
  stats(): { ticks: number; maxGapTicks: number; maxGapMs: number };
};

export function createProgramClock(
  onTick: (tickIndex: number) => void,
  deps: ProgramClockDeps,
  intervalMs = PROGRAM_TICK_MS,
): ProgramClock {
  let handle: unknown = null;
  let running = false;
  let origin = 0;
  let ticks = 0;
  let lastTickAt: number | null = null;
  let maxGapMs = 0;

  function armNext(): void {
    if (!running) return;
    const target = origin + (ticks + 1) * intervalMs;
    const delay = Math.max(0, target - deps.now());
    handle = deps.schedule(fire, delay);
  }

  function fire(): void {
    if (!running) return;
    const at = deps.now();
    if (lastTickAt !== null) maxGapMs = Math.max(maxGapMs, at - lastTickAt);
    lastTickAt = at;
    ticks += 1;
    try {
      onTick(ticks);
    } catch {
      /* a throwing tick must not stop the clock — the next composite is 33 ms away */
    }
    armNext();
  }

  return {
    start() {
      if (running) return;
      running = true;
      origin = deps.now();
      ticks = 0;
      lastTickAt = null;
      maxGapMs = 0;
      armNext();
    },
    stop() {
      running = false;
      if (handle !== null) deps.cancel(handle);
      handle = null;
    },
    stats() {
      return { ticks, maxGapTicks: maxGapMs / intervalMs, maxGapMs };
    },
  };
}
