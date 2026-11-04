/**
 * apps/web/lib/sample-event/paths.ts
 *
 * 🎭 Where the Maria and Jose sample lives — `/sample` and everything under it.
 *
 * Pure and dependency-free on purpose: the guards read it. (Middleware imported
 * it too, to bounce the sample out of the native app by prefix while Apple
 * reviewed 1.0 — `appShellBouncesSample`. That bounce left with `/` on
 * 2026-11-02, owner: "let everything go live"; the sample now opens in the app
 * exactly where `/` does, under its own switch — `./gate.ts`.)
 * Nothing here knows the sample's id — that lives in `./snapshot.ts`, which no
 * server action may import (`app/sample/the-sample-is-sealed.test.ts`).
 */

/** The one root every sample page hangs under. */
export const SAMPLE_ROOT = '/sample';

/** Is this pathname the sample, or a page under it? (`/samples` is not.) */
export function isSamplePath(pathname: string): boolean {
  return pathname === SAMPLE_ROOT || pathname.startsWith(`${SAMPLE_ROOT}/`);
}
