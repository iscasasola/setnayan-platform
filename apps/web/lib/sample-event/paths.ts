/**
 * apps/web/lib/sample-event/paths.ts
 *
 * 🎭 Where the Maria and Jose sample lives — `/sample` and everything under it.
 *
 * Pure and dependency-free on purpose: middleware (edge) imports it to keep the
 * sample out of the native app while Apple reviews 1.0, and the guards read it.
 * Nothing here knows the sample's id — that lives in `./snapshot.ts`, which no
 * server action may import (`app/sample/the-sample-is-sealed.test.ts`).
 */

/** The one root every sample page hangs under. */
export const SAMPLE_ROOT = '/sample';

/** Is this pathname the sample, or a page under it? (`/samples` is not.) */
export function isSamplePath(pathname: string): boolean {
  return pathname === SAMPLE_ROOT || pathname.startsWith(`${SAMPLE_ROOT}/`);
}

/**
 * 🍎 Does the native shell bounce this path the way it bounces the brochure?
 *
 * Middleware sends a native-shell request for any path in
 * `APP_EXCLUDED_MARKETING_PATHS` to the board or /login. That set is matched
 * EXACTLY (`/` and `/features`, never their children), and the sample has
 * children (`/sample/hub/…`), so it joins by prefix — and only while `/` itself
 * is bounced, i.e. while Discover is held back for Apple review. The day `/`
 * leaves the set, the sample follows it out with no second edit
 * (`lib/sample-event/sample-event.test.ts`).
 */
export function appShellBouncesSample(pathname: string, excludedMarketingPaths: ReadonlySet<string>): boolean {
  return excludedMarketingPaths.has('/') && isSamplePath(pathname);
}
