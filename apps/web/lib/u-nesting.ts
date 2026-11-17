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

// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
// 🔗 THE ADDRESS MOVE — EVENTS AT `/{username}/{event}`, NO `/u/` (owner 2026-11-15, specs DECISION_LOG d7910b5d;
// map ADDRESS_MOVE_MAP_2026-11-15_fable.md). Everything below runs only while the cutover switch is on
// (`NEXT_PUBLIC_U_NESTING_CUTOVER`, lib/public-event-url.ts) — switching it is the owner's.
//
// Names are ONE pool (a word is a shop, a person or an event, never two), so `/{a}/{b}` is decided by the SECOND
// word alone, with no database question:
//   · `b` is one of an event's own pages (`/{event}/hub`, `/{event}/invite`, …) or a shop's (`/{shop}/dates`) or a
//     person's chapter (`/{user}/c/{id}`) → it is NOT a nested event; the route tree answers it as before;
//   · anything else → `/{a}` is a person and `/{b}` their event: rewrite to `/{b}` (the event's route tree renders
//     it; `app/[slug]/page.tsx` checks `a` is really its creator and sends anything else to the real address).
// An event whose own word IS one of those page words keeps the old bare address (`nestableEventSlug`) — its nested
// form could never be told apart from that page.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * An event's own pages — the folders under `app/[slug]/` that serve a URL (plus the two special files). Guarded
 * against the folder tree by `u-nesting.test.ts`, so a new event page cannot be added without joining this list.
 */
export const EVENT_SUB_ROUTES: ReadonlySet<string> = new Set([
  'announcement', 'avatar', 'cached', 'everyone', 'find-my-table', 'find-seat', 'hub', 'icon', 'invite',
  'live-pulse', 'live-wall', 'manifest.webmanifest', 'open-as-pass', 'pabuya', 'print', 'recap', 'redeem',
  'request', 'seat', 'sign-out', 'venue', 'welcome',
]);

/** A shop's pages under its bare address (lib/shop-address.ts `SHOP_SUB_PAGES`) — repeated here so this file stays
 *  free of imports; `u-nesting.test.ts` holds the two lists equal. */
export const SHOP_SUB_ROUTES: ReadonlySet<string> = new Set(['dates', 'booth', 'review', 'guest-review', 'story']);

/** Second words that are never an event under a person. */
export function isNotANestedEvent(second: string): boolean {
  const w = second.toLowerCase();
  return EVENT_SUB_ROUTES.has(w) || SHOP_SUB_ROUTES.has(w) || U_SUBPATH_ROUTES.has(w);
}

/** May this event's address be nested under its creator? False when its own word is one of those page words. */
export function nestableEventSlug(slug: string): boolean {
  return !isNotANestedEvent(slug);
}

const WORD = /^[a-z0-9][a-z0-9-]{0,62}$/i;

/**
 * `/{a}/{b}[/rest]` → `{ eventPath: '/{b}[/rest]', owner: 'a' }` when it is a person's event; null otherwise.
 * `reserved(a)` keeps every app page out (`/admin/x`, `/dashboard/x`, `/u/x`, `/v/x` …).
 */
export function bareNestingRewrite(
  pathname: string,
  reserved: (word: string) => boolean,
): { eventPath: string; owner: string } | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const [a, b] = segments as [string, string];
  if (!WORD.test(a) || !WORD.test(b)) return null;
  if (reserved(a.toLowerCase())) return null;
  if (isNotANestedEvent(b) || reserved(b.toLowerCase())) return null;
  return { eventPath: `/${segments.slice(1).join('/')}`, owner: a };
}

/** `/{a}/c/{chapterId}` → the chapter page's route (`/u/{a}/c/{chapterId}`), as an internal rewrite. */
export function bareChapterRewrite(pathname: string, reserved: (word: string) => boolean): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 3 || segments[1] !== 'c') return null;
  const a = segments[0]!;
  if (!WORD.test(a) || reserved(a.toLowerCase())) return null;
  return `/u/${segments.join('/')}`;
}

/** The old `/u/{a}[/rest]` → `/{a}[/rest]` (the person page and their events lost the `/u/`). */
export function legacyUserPrefixRedirect(pathname: string): string | null {
  if (!pathname.startsWith('/u/')) return null;
  const rest = pathname.slice('/u'.length);
  const segments = rest.split('/').filter(Boolean);
  if (segments.length === 0 || !isUsernameWord(segments[0]!)) return null;
  return `/${segments.join('/')}`;
}

/** The account public-id form (`S89U-XXXXXXXXXX`) — the address People links a username-less account by. It is not
 *  in the one pool of names, so it keeps its `/u/` address. */
const ACCOUNT_PUBLIC_ID = /^s89u-[0-9a-z]{10}$/i;

/** A username as it can stand at the top of an address (`users_slug_format`), never an account public id. */
export function isUsernameWord(word: string): boolean {
  return /^[a-z0-9-]{3,32}$/.test(word) && !ACCOUNT_PUBLIC_ID.test(word);
}
