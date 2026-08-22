/**
 * A clock that measures SILENCE.
 *
 * WHY THIS EXISTS. A direct-to-R2 upload announces every failure it knows
 * about — `error`, `abort`, a non-2xx `load`. It has no event for the failure
 * that actually stranded someone: the transfer that simply stops. No event
 * fires, so no message is shown, and the progress chip sits at 0% with a
 * spinner forever. "Still working" and "dead" render identically, and the only
 * way out is reloading the page.
 *
 * WHY NOT `xhr.timeout`. That caps TOTAL duration, so any value low enough to
 * catch a dead connection also kills a slow-but-healthy large upload on bad
 * wifi. This watchdog is reset by every byte that moves, so it only fires when
 * nothing has happened for `timeoutMs` — long transfers are safe, dead ones
 * are not.
 *
 * `timers` is injectable so the behaviour can be tested without waiting in real
 * time; production passes nothing and gets the global timers.
 */

export type WatchdogTimers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const REAL_TIMERS: WatchdogTimers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as never),
};

export type StallWatchdog = {
  /**
   * Restart the clock. Called at send, and on every progress event.
   *
   * `timeoutMs` overrides the default for THIS arm onward — used when the
   * thing being waited on changes character. See the note on the response
   * wait in `uploadOne`: once the body is written, no further progress event
   * can ever fire, so the transfer-silence budget would become a fixed
   * total-duration cap on the server's reply, which is exactly what this
   * watchdog exists to avoid.
   */
  arm: (timeoutMs?: number) => void;
  /** The transfer reached a terminal state — the clock must never fire again. */
  settle: () => void;
  readonly settled: boolean;
};

export function createStallWatchdog(opts: {
  timeoutMs: number;
  onStall: () => void;
  timers?: WatchdogTimers;
}): StallWatchdog {
  const timers = opts.timers ?? REAL_TIMERS;
  let handle: unknown;
  let settled = false;

  const clear = () => {
    if (handle !== undefined) timers.clearTimeout(handle);
    handle = undefined;
  };

  return {
    arm(timeoutMs?: number) {
      // A progress event can land in the same tick as `load`. Re-arming after
      // the transfer finished would resurrect the clock and report a stall on
      // an upload that already succeeded.
      if (settled) return;
      clear();
      const ms = timeoutMs ?? opts.timeoutMs;
      handle = timers.setTimeout(() => {
        // Belt-and-braces, and knowingly unreachable: `settle()` disposes the
        // clock and `arm()` refuses to schedule once settled, so this callback
        // cannot run in a settled state. Deleting it keeps every test green —
        // measured, not assumed. It is kept as the last line of defence if
        // either of those two is ever loosened, NOT because a test covers it.
        if (settled) return;
        settled = true;
        handle = undefined;
        opts.onStall();
      }, ms);
    },
    settle() {
      settled = true;
      clear();
    },
    get settled() {
      return settled;
    },
  };
}
