/**
 * Which routes globally-mounted chrome must NOT draw on — pure, unit-tested.
 *
 * WHY THIS EXISTS: the root layout mounts a handful of components on EVERY
 * route (cookie banner, demo/pilot banners, nav progress, toasts). One of those
 * routes is `/panood/program/[eventId]`, the chrome-less Live Studio PROGRAM
 * OUTPUT window that a couple's OBS **window-captures** and streams to their
 * YouTube. That page's own header states the rule it exists to keep: OBS
 * captures the WINDOW, so any chrome in the tree is one layout change away from
 * leaking into the couple's broadcast. Anything a global component paints there
 * goes out on air, on a day that cannot be re-run.
 *
 * <CookieConsentBanner> had no route gate at all (its only early return was
 * `!mounted || decided`), so a consent card pinned to the bottom-right corner
 * was one un-decided visitor away from being broadcast. This module is the gate.
 *
 * Two predicates, because the two exclusions are made for DIFFERENT reasons and
 * a future reader must not collapse them:
 *   · `isBroadcastCaptureRoute` — "an encoder is capturing these pixels."
 *   · `isConsentSuppressedRoute` — the above, PLUS the host's own full-screen
 *     controller, where the banner is an operating hazard rather than a leak.
 */

/**
 * Routes an external encoder (OBS) window-captures. NOTHING global may paint
 * here. Written WITH the trailing slash and matched as a plain prefix, so a
 * sibling segment can never be swallowed: a future `/panood/programme` does not
 * start with `/panood/program/`.
 */
const BROADCAST_CAPTURE_PREFIXES = ['/panood/program/'] as const;

/**
 * Additionally suppressed for the CONSENT banner only — the authenticated
 * host's full-screen Live Studio controller (Wave 8: `fixed inset-0` at 100dvh,
 * `overflow-hidden`, never scrolls). Not captured, so this is not a leak; it is
 * an operating hazard. The banner is `fixed` bottom-right at `z-[70]` while the
 * control shell is `z-0`, so it lands squarely on the unlock-to-broadcast pill
 * and the bottom control row, mid-broadcast, on a surface that cannot be
 * scrolled to move it out of the way.
 */
const CONSENT_ONLY_PREFIXES = ['/panood/control/'] as const;

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

/**
 * True when the cookie-consent banner must NOT render on `pathname`.
 *
 * ⚠ RA 10173 — THIS GATE MUST STAY TINY. The banner is how Setnayan asks for
 * consent to non-essential (analytics) cookies, so every route taken off it is a
 * person we might never ask. A route only qualifies when suppressing the ask
 * costs nobody their choice, which is true of both entries here for the same
 * reason: each is reachable ONLY by a signed-in control-room member, who
 * necessarily passed through /login and the dashboard first — routes where the
 * banner IS shown. No consent opportunity is lost.
 *   · `/panood/program/` — a MACHINE-captured output surface with no controls
 *     and no human interacting; it exists purely for an encoder to capture.
 *   · `/panood/control/` — the host's own tool; see CONSENT_ONLY_PREFIXES.
 *
 * DELIBERATELY *NOT* HERE — `/panood/cam/[token]`, the camera-join page a helper
 * opens on their phone. It is not a capture surface (the published media is a
 * `getUserMedia` camera track; DOM chrome never enters the WebRTC stream), and
 * it is very often the ONLY Setnayan page that person will ever open.
 * Suppressing the banner there would mean never asking them at all — while the
 * globally mounted PostHog provider still captures `$pageview` on that route for
 * anyone who consented earlier. That is a consent gap, not a UX tidy-up. The
 * banner stays.
 *
 * Both lists are the narrowest workable form on purpose: the bare
 * `/panood/program` and `/panood/control` paths are 404s, not capture surfaces,
 * and deliberately keep their banner rather than widening this gate.
 *
 * `pathname` is whatever `usePathname()` hands back — `null` before hydration,
 * which reads as "not suppressed" so the banner's own `mounted` gate stays the
 * single thing deciding first paint.
 */
export function isConsentSuppressedRoute(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false;
  return (
    matchesPrefix(pathname, BROADCAST_CAPTURE_PREFIXES) ||
    matchesPrefix(pathname, CONSENT_ONLY_PREFIXES)
  );
}
