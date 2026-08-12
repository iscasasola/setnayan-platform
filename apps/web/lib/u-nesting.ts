/**
 * `/u/{userSlug}/…` — deciding what is an EVENT and what is a real route.
 *
 * The middleware rewrites `/u/{userSlug}/{eventSlug}[/rest]` to `/{eventSlug}[/rest]`
 * so the whole event subtree (landing page + its 12 subroutes) renders under the
 * pretty nested URL without duplicating a single route.
 *
 * 🚨 WHY THIS FILE EXISTS. That rewrite used to fire on SEGMENT COUNT alone —
 * "3 or more segments ⇒ it's a nested event" — which silently ate the ONLY other
 * route under a user profile: the chapter page at
 * `app/u/[userSlug]/c/[chapterId]`. Every request for a storyteller's chapter was
 * rewritten to `/c/{chapterId}`, which is not an event, so it 404'd. **The chapter
 * page had never once been reachable in production.**
 *
 * 🔑 THE COMMENT ON THE CHAPTER PAGE REASONED ABOUT THE WRONG LAYER. It argued the
 * route could never collide because "the `c` segment is a single static char, and
 * real slugs are ≥3 chars" — true, and irrelevant: that is a fact about Next.js
 * ROUTE MATCHING, and the middleware rewrite runs BEFORE any route is matched and
 * never consulted it. A correct argument about one layer is not a guarantee at
 * another.
 *
 * 🔑 WHY NOBODY NOTICED. Publishing a chapter required an external video account
 * until 2026-08-12, so prod held ZERO chapters and this URL had never been
 * requested for a real one. A route with no data looks exactly like a route that
 * works. Same family as every other silent gate in this repo: nothing threw, and
 * the only symptom was an absence.
 *
 * Kept pure and separate from middleware.ts so it is unit-testable, and so the
 * reserved set can be checked against the real directory tree by a guard that
 * fails when a NEW `/u/{userSlug}/x` route is added without being listed here.
 */

/**
 * Path segments directly under `/u/{userSlug}` that are REAL routes in this app,
 * never event slugs. Anything here is left alone by the nesting rewrite.
 *
 * ⚠ ADDING A ROUTE UNDER `app/u/[userSlug]/` MEANS ADDING IT HERE. Forgetting
 * makes the new route unreachable in production while every local check stays
 * green — `u-nesting.test.ts` derives the truth from the filesystem and fails if
 * this set drifts.
 *
 * An event slug can never collide with these: slugs are `^[a-z0-9-]{3,32}$`, so a
 * one-character segment like `c` is not a legal slug in the first place.
 */
export const U_SUBPATH_ROUTES: ReadonlySet<string> = new Set(['c']);

/**
 * The internal path `/u/{userSlug}/…` should be rewritten to, or `null` when the
 * request must fall through to a real route.
 *
 * `null` for: a bare `/u/{userSlug}` profile, and any reserved subpath above.
 */
export function userNestingRewritePath(pathname: string): string | null {
  if (!pathname.startsWith('/u/')) return null;
  const segments = pathname.split('/').filter(Boolean); // ['u', userSlug, …]
  if (segments.length < 3) return null; // bare /u/{userSlug} → the profile page
  const first = segments[2]!;
  if (U_SUBPATH_ROUTES.has(first)) return null; // a real route, not an event slug
  return `/${segments.slice(2).join('/')}`;
}
