/**
 * Telling a stale open tab apart from a real crash.
 *
 * ── WHAT HAPPENS ────────────────────────────────────────────────────────────
 * We deploy on every merge. A page someone already has open keeps asking for
 * the JavaScript files that existed when it loaded — and after a deploy those
 * filenames are gone. The browser cannot fetch them, React throws, and the
 * person sees:
 *
 *     Application error: a client-side exception has occurred
 *
 * Nothing is wrong with the site. A reload fixes it completely. But the message
 * says the opposite, so the reasonable reaction is to assume we are broken and
 * stop — which is exactly what the owner did, twice in one day, on a site that
 * was serving correctly the entire time. The second time, three deploys landed
 * in half an hour while his page sat open.
 *
 * 🔑 THIS IS INDISTINGUISHABLE FROM AN OUTAGE FROM THE OUTSIDE, AND IT IS THE
 * OPPOSITE OF ONE. Every vendor and couple with a tab open during a deploy sees
 * it. We cannot stop deploying; we can stop it reading as a failure.
 *
 * ── WHY MATCH ON THE MESSAGE, WHICH IS USUALLY A BAD IDEA ───────────────────
 * There is no error CODE for this. Webpack throws a plain `Error` with
 * `name === 'ChunkLoadError'`; Vite and Safari surface it as a failed dynamic
 * import with wording that varies by browser. The name check is the reliable
 * half and comes first; the text patterns are the fallback for engines that do
 * not set it. A false positive costs one reload — the same thing the person was
 * about to do by hand — so the failure mode of guessing wrong is mild in the
 * one direction and severe in the other.
 */

/** Error shapes a browser produces when the JS it wants is no longer deployed. */
const STALE_PATTERNS = [
  /loading chunk \S+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i, // Safari
  /'text\/html' is not a valid javascript mime type/i, // a 404 HTML page served where JS was expected
];

export function isStaleBundleError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: unknown; message?: unknown };
  if (e.name === 'ChunkLoadError') return true;
  const message = typeof e.message === 'string' ? e.message : '';
  if (!message) return false;
  return STALE_PATTERNS.some((p) => p.test(message));
}

/** Where the one-shot marker lives. Session-scoped: a new tab starts fresh. */
export const STALE_RELOAD_KEY = 'setnayan:stale-bundle-reloaded';

/**
 * Reload once to pick up the current build. Returns true when it started one.
 *
 * 🔑 ONCE, AND THE GUARD IS THE WHOLE POINT. If the error is NOT a stale bundle
 * — or the new build throws too — reloading on every failure is an infinite
 * refresh loop on a page the person cannot read or leave. That is worse than
 * the message we are replacing. The marker is cleared on any successful render,
 * so a genuine second occurrence later still gets its one reload.
 */
export function reloadForStaleBundle(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  reload: () => void,
): boolean {
  if (storage.getItem(STALE_RELOAD_KEY)) return false;
  storage.setItem(STALE_RELOAD_KEY, '1');
  reload();
  return true;
}
