/**
 * load-rules.ts — THE TWO WAITING RULES OF EVERY LOADER (motion standard 18 Nov 2026, § 2 "Waits" + § 4 #17 Load).
 *
 *   1. WAIT BEFORE SHOWING — a loader shows only if the work is still running after `LOAD_WAIT_MS` (150).
 *      A page that answers faster shows no loader at all: no flash.
 *   2. ONCE SHOWN, STAY — a loader that did show stays at least `LOAD_STAY_MS` (400), so it never blinks.
 *
 * "150 ms and 400 ms are waiting rules, not new speeds" (the prototype's Load card).
 *
 * ⚡ NEITHER RULE MAY EVER HOLD THE PAGE BACK. The wait hides the LOADER, never the content; the stay keeps an
 * OVERLAY (the top line) up over a page that is already drawn. A route's `loading.tsx` is swapped out by React the
 * moment the page is ready — nothing here delays that swap, and nothing here makes a request.
 *
 * ONE HELPER, TWO FORMS, HELD EQUAL:
 *   · script — `createLoadGate` below (the top line `app/_components/nav-progress.tsx`, the branded veil over a
 *     route skeleton `components/loading-activity.tsx`);
 *   · stylesheet — `--sn-m-load-wait` / `--sn-m-load-stay` in `app/globals.css` (every `.skeleton` block waits by
 *     CSS alone, because a loading screen is drawn before any script runs).
 * 🔒 lib/the-load-rules-are-one.test.ts holds the two copies equal and runs the gate.
 */

/** A loader shows only if the work is still running after this long. */
export const LOAD_WAIT_MS = 150;
/** A loader that showed stays at least this long. */
export const LOAD_STAY_MS = 400;

/** May a loader show yet, `elapsedMs` after the work began? */
export function loaderMayShow(elapsedMs: number): boolean {
  return elapsedMs >= LOAD_WAIT_MS;
}

/**
 * How much longer a loader must stay once the work is done. `shownAtMs` is when it appeared (`null` = it never
 * did, so there is nothing to keep up).
 */
export function loaderStayLeft(shownAtMs: number | null, nowMs: number): number {
  if (shownAtMs === null) return 0;
  return Math.max(0, shownAtMs + LOAD_STAY_MS - nowMs);
}

type Timer = ReturnType<typeof setTimeout>;

export type LoadGateClock = {
  now: () => number;
  setTimer: (fn: () => void, ms: number) => Timer;
  clearTimer: (t: Timer) => void;
};

const REAL_CLOCK: LoadGateClock = {
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (t) => clearTimeout(t),
};

export type LoadGate = {
  /** The work began. The loader shows `LOAD_WAIT_MS` later — if the work is still running. */
  start: () => void;
  /** The work is done. A loader never shown stays hidden; a shown one hides once it has stayed `LOAD_STAY_MS`. */
  finish: () => void;
  /** Drop everything now (unmount). Calls neither `show` nor `hide`. */
  cancel: () => void;
  /** Is the loader on screen right now? */
  shown: () => boolean;
};

/**
 * The gate every script-driven loader goes through. `show` / `hide` are the loader's own two moves; the gate only
 * decides WHEN. The clock is injectable so the rule is executed by a test rather than read out of a component.
 */
export function createLoadGate(
  moves: { show: () => void; hide: () => void },
  clock: LoadGateClock = REAL_CLOCK,
): LoadGate {
  let wait: Timer | undefined;
  let stay: Timer | undefined;
  let shownAt: number | null = null;

  const clear = () => {
    if (wait !== undefined) clock.clearTimer(wait);
    if (stay !== undefined) clock.clearTimer(stay);
    wait = stay = undefined;
  };

  return {
    start() {
      clear();
      // A loader still up from the last run simply carries on — it never blinks off and on.
      if (shownAt !== null) return;
      wait = clock.setTimer(() => {
        wait = undefined;
        shownAt = clock.now();
        moves.show();
      }, LOAD_WAIT_MS);
    },
    finish() {
      clear();
      if (shownAt === null) return;
      const done = () => {
        stay = undefined;
        shownAt = null;
        moves.hide();
      };
      const left = loaderStayLeft(shownAt, clock.now());
      if (left <= 0) done();
      else stay = clock.setTimer(done, left);
    },
    cancel() {
      clear();
      shownAt = null;
    },
    shown: () => shownAt !== null,
  };
}
