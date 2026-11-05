/**
 * replay-scope.ts — WHERE SENTRY SESSION REPLAY RUNS (owner, 2026-10-23: "Drop Sentry Session Replay on PUBLIC pages
 * only … keep error reporting everywhere and replay on signed-in screens").
 *
 * Measured the same day (Lighthouse mobile, live): the replay recorder (rrweb) rode the idle Sentry load of EVERY page —
 * the signed-out front door, the public Event Hubs, the legal and help pages — though replay only ever records on an
 * error (`replaysSessionSampleRate: 0`) and a public visitor's error page tells us little a stack trace does not.
 *
 * The rule is a list of the SIGNED-IN WORK AREAS — every route under these prefixes requires a session (their layouts
 * redirect a stranger to /login). Everything else is public and records no replay. Error reporting is unchanged on
 * every page; only the recorder is scoped. A visitor who signs in and moves into a work area gets the recorder then
 * (`app/_components/deferred-observability.tsx` adds it on the first signed-in path).
 *
 * Pure (no imports) so the rule is tested directly: `lib/telemetry/replay-only-on-signed-in-screens.test.ts`.
 */
export const REPLAY_WORK_AREAS = ['/dashboard', '/vendor-dashboard', '/admin', '/onboarding', '/open-shop', '/site-editor'] as const;

/** Does Session Replay run on this path? Only inside a signed-in work area. */
export function sessionReplayAllowed(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split(/[?#]/)[0] ?? '';
  return REPLAY_WORK_AREAS.some((area) => path === area || path.startsWith(`${area}/`));
}
