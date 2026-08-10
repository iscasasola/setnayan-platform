/**
 * Name the caller that is rewriting history in a loop.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * Production throws, for SIGNED-IN users only:
 *
 *     SecurityError: Attempt to use history.replaceState() more than 100 times
 *     per 10 seconds
 *
 * Two rollbacks did not fix it, it reproduces in a private window, and there
 * are no server-side errors. Static analysis has now cleared every candidate:
 * all seven app-level `replaceState` sites are user-gesture callbacks, the
 * param-stripping effect is ref-guarded, the interval refresher is 45s and is
 * not mounted on this route, and no launcher component loops.
 *
 * 🔑 THE THING THAT MAKES READING THE CODE INSUFFICIENT: Next's `HistoryUpdater`
 * calls `history.replaceState` on **every router-state change**, keyed on
 * `[appRouterState]` — not on a URL change. So ">100 replaceState in 10s" does
 * NOT mean "somebody wrote the URL 100 times". It means the router dispatched
 * 100+ times: a `router.refresh()`, a server action, or a resolving RSC subtree
 * fetch each cost one. The call that throws is Next's, and the thing causing it
 * is several frames further up — which is exactly the part a stack trace has
 * and reading does not.
 *
 * So: capture the stack at the moment the storm is detectable, and report it
 * once. One page load then names the caller, instead of another guess.
 *
 * ── RULES THIS FOLLOWS ──────────────────────────────────────────────────────
 * • It must never be the cause of anything. It always calls through to the real
 *   function, it never throws, and it reports at most once per page load.
 * • It reports BEFORE the browser's own limit (100/10s) so it captures a live
 *   stack rather than the aftermath of the SecurityError.
 * • It carries no personal data: a URL PATH only — never the query string,
 *   which on this app can hold guest tokens.
 */

export type HistoryStorm = {
  /** How many writes happened inside the window that tripped it. */
  count: number;
  /** Milliseconds the burst spanned. */
  windowMs: number;
  /** Path only — never the query string. */
  path: string;
  /** The JS stack at the tripping call. This is the answer we are after. */
  stack: string;
};

/** Trip below Safari's 100/10s so the stack is captured while it is still live. */
export const STORM_THRESHOLD = 40;
export const STORM_WINDOW_MS = 5_000;

/**
 * Wrap `history.replaceState`/`pushState` and report the first storm.
 *
 * Returns an uninstall function. Safe to call in any environment: with no
 * `window` it does nothing and returns a no-op.
 */
export function installHistoryStormProbe(
  report: (storm: HistoryStorm) => void,
  opts: { threshold?: number; windowMs?: number } = {},
): () => void {
  if (typeof window === 'undefined' || !window.history) return () => {};

  const threshold = opts.threshold ?? STORM_THRESHOLD;
  const windowMs = opts.windowMs ?? STORM_WINDOW_MS;

  const hits: number[] = [];
  let reported = false;
  const realReplace = window.history.replaceState.bind(window.history);
  const realPush = window.history.pushState.bind(window.history);

  const note = () => {
    // Wrapped in its own try: a probe that throws would become the outage it
    // was written to explain.
    try {
      const now = Date.now();
      hits.push(now);
      while (hits.length && now - hits[0]! > windowMs) hits.shift();
      if (reported || hits.length < threshold) return;
      reported = true;
      report({
        count: hits.length,
        windowMs: now - hits[0]!,
        // PATH ONLY. The query string on this app can carry guest tokens, and
        // a diagnostic must not become the thing that leaks one.
        path: window.location.pathname,
        stack: new Error('history storm').stack ?? '(no stack)',
      });
    } catch {
      /* never let the probe break the page */
    }
  };

  window.history.replaceState = function (...args: Parameters<History['replaceState']>) {
    note();
    return realReplace(...args);
  };
  window.history.pushState = function (...args: Parameters<History['pushState']>) {
    note();
    return realPush(...args);
  };

  return () => {
    window.history.replaceState = realReplace;
    window.history.pushState = realPush;
  };
}
