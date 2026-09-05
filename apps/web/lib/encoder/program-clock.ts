/**
 * S1 · the program tick.
 *
 * A fixed-cadence timer that drives the compositor at 30 fps (33.3 ms). Runs INSIDE the
 * worker on purpose: a page's own timers are throttled the moment its window is hidden or
 * occluded (Chromium: 1 Hz after a few seconds, then 1/min; WebKit similar), and a live
 * encoder cannot be at the mercy of which window the couple has in front. Dedicated-worker
 * timers are throttled LESS than page timers, which is the whole reason S1 exists — but NOT
 * zero. MEASURED 2026-09-05 (S1 close, plain Chromium 148, this `setTimeout` tick, load
 * held constant by a visible control on the same machine): visible 30.0 ticks/s, 0 gaps
 * > 2 ticks in 180 s; tab hidden with the window on screen 21.6 ticks/s, 381 long gaps,
 * worst 1.35 s; hidden + window minimised 26.0 ticks/s, 635 long gaps in 540 s, worst
 * 8.4 s. The throttling is the visibility state, not the load. This tick is a scaffold;
 * S3's audio-thread clock is the one the couple streams on, and S13's minimise test on the
 * real installers (WKWebView / WebView2) is the measurement that decides the shipped app.
 *
 * // S3 replaces this tick with the AudioContext-derived clock
 * S3 owns the master clock (`AudioContext.currentTime`); when it lands, `createProgramClock`
 * is swapped for a clock fed from the audio graph and the rest of the worker is unchanged.
 * Nothing before S3 may assume a programme audio stream (rule 19).
 *
 * Drift-corrected, never bursting: every tick is scheduled against the GRID `origin + n ×
 * interval`, not `now + interval`, so a callback that ran a few ms late shortens the next
 * wait instead of pushing every later tick — and a callback that ran so late that whole
 * slots went by SKIPS them and lands on the next grid instant. It never replays the missed
 * slots as a burst of same-instant ticks: S4 pulls one encode per tick, and three composites
 * stamped on the same millisecond are duplicates, not catch-up.
 * Gap-accounted: `maxGapTicks` records the worst distance between two consecutive ticks in
 * whole intervals and `maxGapAtMs` when it happened; `longGaps` COUNTS every inter-tick gap
 * wider than two intervals — the evidence run's number ("no gaps > 2 ticks" is longGaps = 0
 * outside warm-up), which a running maximum alone cannot give.
 */

/** An inter-tick gap wider than this many intervals counts as a long gap. */
export const LONG_GAP_TICKS = 2;

export const PROGRAM_TICK_MS = 1000 / 30;

export type ProgramClockDeps = {
  now: () => number;
  schedule: (fn: () => void, delayMs: number) => unknown;
  cancel: (handle: unknown) => void;
};

export type ProgramClock = {
  start(): void;
  stop(): void;
  /** Ticks fired so far, the worst inter-tick gap (in intervals, and when), and how many gaps exceeded LONG_GAP_TICKS. */
  stats(): { ticks: number; maxGapTicks: number; maxGapMs: number; maxGapAtMs: number; longGaps: number };
};

export function createProgramClock(
  onTick: (tickIndex: number) => void,
  deps: ProgramClockDeps,
  intervalMs = PROGRAM_TICK_MS,
): ProgramClock {
  let handle: unknown = null;
  let running = false;
  let origin = 0;
  /** Grid slot of the tick currently armed (or just fired). Ticks fired may be fewer. */
  let slot = 0;
  let ticks = 0;
  let lastTickAt: number | null = null;
  let maxGapMs = 0;
  let maxGapAtMs = 0;
  let longGaps = 0;

  function armNext(): void {
    if (!running) return;
    const now = deps.now();
    // The next grid slot strictly after `now` — at least the one after the slot that just
    // fired, further ahead if that many have already gone by.
    slot = Math.max(slot + 1, Math.floor((now - origin) / intervalMs) + 1);
    const target = origin + slot * intervalMs;
    handle = deps.schedule(fire, Math.max(0, target - now));
  }

  function fire(): void {
    if (!running) return;
    const at = deps.now();
    if (lastTickAt !== null) {
      const gap = at - lastTickAt;
      if (gap > maxGapMs) {
        maxGapMs = gap;
        maxGapAtMs = at - origin;
      }
      if (gap > LONG_GAP_TICKS * intervalMs) longGaps += 1;
    }
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
      slot = 0;
      ticks = 0;
      lastTickAt = null;
      maxGapMs = 0;
      maxGapAtMs = 0;
      longGaps = 0;
      armNext();
    },
    stop() {
      running = false;
      if (handle !== null) deps.cancel(handle);
      handle = null;
    },
    stats() {
      return { ticks, maxGapTicks: maxGapMs / intervalMs, maxGapMs, maxGapAtMs, longGaps };
    },
  };
}
