/**
 * Which routes globally-mounted chrome must NOT draw on — pure, unit-tested.
 *
 * WHY THIS EXISTS: the root layout mounts a handful of components on EVERY
 * route (demo banner, nav progress, toasts). One of those routes is
 * `/panood/program/[eventId]`, the chrome-less Live Studio PROGRAM OUTPUT window
 * that a couple's OBS **window-captures** and streams to their YouTube. That
 * page's own header states the rule it exists to keep: OBS captures the WINDOW,
 * so any chrome in the tree is one layout change away from leaking into the
 * couple's broadcast. Anything a global component paints there goes out on air,
 * on a day that cannot be re-run.
 *
 * Two predicates, because the two exclusions are made for DIFFERENT reasons and
 * a future reader must not collapse them:
 *   · `isBroadcastCaptureRoute` — "an encoder is capturing these pixels."
 *   · `isRoomDisplayRoute`      — "a ROOM is watching these pixels."
 *
 * (A third, `isConsentSuppressedRoute`, gated the cookie banner. The banner was
 * removed on 2026-10-22 — essential cookies only — and the predicate with it.)
 */

/**
 * Routes an external encoder (OBS) window-captures. NOTHING global may paint
 * here. Written WITH the trailing slash and matched as a plain prefix, so a
 * sibling segment can never be swallowed: a future `/panood/programme` does not
 * start with `/panood/program/`.
 */
const BROADCAST_CAPTURE_PREFIXES = ['/panood/program/'] as const;

/**
 * DAY-12 (2026-09-20) — a VENUE SCREEN: a TV / projector / LED wall in the room
 * showing `/live/screen`. Not encoder-captured, but the same consequence: every
 * pixel is watched by a roomful of guests, and nobody is at the TV to dismiss
 * anything. A demo banner there would sit on the couple's monogram all night.
 *
 * EXACT path, not a prefix: `/live` itself (where a person types the pairing
 * code) is an ordinary page — a human is there.
 */
const ROOM_DISPLAY_PATHS: ReadonlySet<string> = new Set(['/live/screen']);

/** True on a surface a ROOM is watching (a paired venue screen). */
export function isRoomDisplayRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ROOM_DISPLAY_PATHS.has(pathname);
}

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname.startsWith(prefix));
}

/**
 * True when `pathname` is a surface an external encoder is capturing, i.e. when
 * anything painted there is literally part of the couple's live broadcast.
 */
export function isBroadcastCaptureRoute(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return matchesPrefix(pathname, BROADCAST_CAPTURE_PREFIXES);
}
