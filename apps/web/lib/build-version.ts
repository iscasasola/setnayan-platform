/**
 * build-version.ts — "the page you are looking at is older than the server".
 *
 * ── WHAT THIS IS FOR ───────────────────────────────────────────────────────
 * We deploy on every merge, roughly every 15–25 minutes. A tab someone already
 * has open keeps talking to the build it loaded from. Sometimes that fails
 * LOUDLY — the JavaScript filenames are gone, the browser throws a
 * ChunkLoadError, and `lib/stale-bundle.ts` catches it and reloads once.
 *
 * 🔑 THE OTHER HALF THROWS NOTHING. On 2026-09-20 the owner's guest list went
 * blank after a server action: the action ran on the build his tab was loaded
 * from (05:17Z), the redirect's payload came back from a newer one (05:58Z),
 * and the router rendered NOTHING. No exception, so no error boundary, so no
 * stale-bundle reload — an empty page that looks exactly like an outage on a
 * site that is serving perfectly. He reasonably concluded we were broken. The
 * same thing had happened to him twice before, which is why stale-bundle.ts
 * exists at all; this is the case it cannot see.
 *
 * ── WHY THIS AND NOT VERCEL'S SKEW PROTECTION ──────────────────────────────
 * Skew Protection is the real fix: it PINS a tab to its own deployment so the
 * mismatch never happens. It is a Vercel project setting (not a `next.config`
 * option — that is the Astro adapter's API), and on 2026-09-20 enabling it via
 * the REST API returned `404 Skew Protection not found`: it is not available on
 * this account's plan. Until that changes, this module cannot PREVENT the skew.
 * It DETECTS it, and turns a blank screen into a sentence and a reload button.
 *
 * ⚠ So this is a mitigation, not a cure. If the plan ever allows Skew
 * Protection, turn it on — and KEEP this, because a tab open longer than the
 * pin's max age lands in exactly the same place.
 *
 * ── WHY THE DECISION LIVES HERE ────────────────────────────────────────────
 * The component that shows the bar is a client component doing fetches and
 * timers; a guard can only grep it. The part that can actually be got WRONG is
 * the comparison, so it sits here as a pure function a test can EXECUTE
 * against every shape the two ids arrive in.
 */

/** What the client bundle was built from. Inlined at build time — see next.config.ts. */
export const LOADED_BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '';

/**
 * Should we offer a reload?
 *
 * `loaded` is the version baked into this bundle; `serving` is what
 * `/api/health` reports right now (that route already returns
 * `VERCEL_GIT_COMMIT_SHA.slice(0, 7)`, force-dynamic and no-store — it was
 * built for Better Stack pings in iteration 0035 and needed no change).
 *
 * 🔑 EVERY "NO" HERE IS DELIBERATE. The failure mode of a version notice is
 * nagging someone whose page is fine, and a bar that cries wolf gets ignored
 * on the one day it is right:
 *
 *  · Either side missing → we do not know, so we say nothing. Locally and in
 *    any non-Vercel build both are `''` or `'dev'`.
 *  · `'dev'` on either side → the health route's own fallback when there is no
 *    commit sha. Not a version, so not a mismatch.
 *  · Equal → the common case, on every single check.
 *  · A `serving` value we could not parse (not a string) → silence.
 *
 * It returns true ONLY for two different, real, known versions.
 */
export function shouldOfferReload(
  loaded: unknown,
  serving: unknown,
): boolean {
  if (typeof loaded !== 'string' || typeof serving !== 'string') return false;
  const a = loaded.trim();
  const b = serving.trim();
  if (!a || !b) return false;
  if (a === 'dev' || b === 'dev') return false;
  return a !== b;
}

/** The shape `/api/health` answers with, narrowed to the one field we read. */
export function servingVersionFrom(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const v = (payload as { version?: unknown }).version;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
