/**
 * lib/guest-pass-hop.ts — THE REQUESTS THAT WRITE OR CLEAR THE GUEST PASS.
 *
 * The guest pass (`setnayan_guest_session`, lib/guest-session.ts) has exactly
 * one job on these requests: become what the guest just did. A personal link
 * (`/{slug}?invite=<token>` → `/{slug}/redeem`) REPLACES whatever pass the
 * phone held; a seat claim, a Papic hand-off and a sign-out write or clear it.
 *
 * 🔴 WHY THIS EXISTS (owner's live iPhone test, 2026-10-02, build 5666406): on
 * ONE phone — the host's own, used for weeks — a guest's personal link landed
 * on the Event Hub's "Get inside" instead of that guest's invitation, signed in
 * AND signed out, while the same link worked on another phone. The server hop
 * itself is deterministic (`app/[slug]/page.tsx` → `redeem/route.ts` sets the
 * pass → `invite/enter`), so what differs is the PHONE'S state, and two pieces
 * of it sat on that hop as second writers / interceptors:
 *
 *   1. `middleware.ts`'s sliding refresh re-signs whatever pass the REQUEST
 *      carried — signature only, no database check, so a rotated or replaced
 *      pass is re-signed too — and adds its Set-Cookie to the SAME response
 *      on which the redeem writes the new pass. Two writers of one cookie in
 *      one response, and which one the phone keeps is header order, not a
 *      decision.
 *   2. `public/sw.js` took the tokened navigation (`/{slug}?invite=…` is a
 *      bare guest slug to it) into its network-first handler, so the first hop
 *      ran through a service worker that only long-used phones have installed,
 *      with an offline fallback in front of it.
 *
 * ⚠ NEITHER IS PROVEN TO BE THAT PHONE'S CAUSE — the phone was not inspected
 * (no cookie dump, no service-worker state). They are the two device-dependent
 * things the trace found on the hop, so both are taken off it.
 *
 * 🔑 THE RULE NOW: on these requests nothing but the route itself touches the
 * pass, and the service worker leaves the navigation to the browser. One
 * writer per hop, the same on every phone.
 *
 * ⚠ `public/sw.js` cannot import this module (it is served as a plain file), so
 * it carries a copy of the same predicate; `guest-pass-hop.test.ts` runs BOTH
 * over one table of URLs and fails if they ever disagree.
 *
 * Pure. No I/O.
 */

/** The second path segment, under `/{slug}/…`, of a route that writes or clears the pass. */
const SLUG_PASS_ROUTES: ReadonlySet<string> = new Set(['redeem', 'sign-out']);

export function isGuestPassHop(pathname: string, search: string | URLSearchParams): boolean {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  // A personal link, before it has been redeemed — whatever path it rides on.
  if ((params.get('invite') ?? '').trim()) return true;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (pathname === '/auth/sign-out') return true;
  // /papic/me/<token>/session — the Papic hand-off mints the pass.
  if (segments[0] === 'papic' && segments[1] === 'me' && segments[3] === 'session') return true;
  if (segments.length >= 2 && SLUG_PASS_ROUTES.has(segments[1]!)) return true;
  // /{slug}/seat/claim — the seat QR mints the pass.
  if (segments[1] === 'seat' && segments[2] === 'claim') return true;
  return false;
}

/**
 * May the middleware slide the pass's expiry forward on this request? Only on
 * a plain read (GET / HEAD) that is not a pass hop. A POST is a Server Action —
 * the join door, the plus-one welcome and the QR rotation all write the pass
 * from one — and a refresh there is a second writer racing the action's own.
 */
export function mayRefreshGuestPass(method: string, pathname: string, search: string | URLSearchParams): boolean {
  const m = method.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD') return false;
  return !isGuestPassHop(pathname, search);
}
