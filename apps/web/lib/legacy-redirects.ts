/**
 * lib/legacy-redirects.ts — the ONE map of retired page paths that still
 * forward, read by `middleware.ts`.
 *
 * ─── WHY THESE LIVE HERE AND NOT AS PAGES OR next.config REDIRECTS ──────────
 * Each retired path used to be a `page.tsx` whose only job was `redirect(...)`.
 * A redirect-only page is still a deployed route, and Vercel caps a project at
 * 2,048 routes (a production deploy was rejected at 2,057). A `next.config`
 * `redirects()` rule costs a route too. A middleware forward costs NONE — it is
 * not in the routes manifest — and the middleware matcher already covers every
 * path here, so the old URL is answered before routing.
 *
 * ─── WHY THEY STILL FORWARD ─────────────────────────────────────────────────
 * "Because of other people's links": digest emails, bookmarks, DB-stored
 * notification URLs and anything Google indexed cannot be seen from the code.
 * 308 = permanent + method-preserving, the same shape as the `/services` and
 * `/add-ons` forwards beside it in the middleware. The destination is the one
 * each stub redirected to, unchanged. The stubs dropped the query string, and so
 * does this (only the `what-to-bring` pair carries its own).
 *
 * ⚠ EXACT PATHS ONLY (a trailing slash is tolerated). A retired path's child is
 * a different URL and is not forwarded.
 *
 * ⚠ ADDING A ROW to retire another stub: delete the page, add the pair, and
 * `lib/legacy-redirects.test.ts` holds the rest. Do NOT add a `redirects()` rule
 * to next.config.ts for this — it spends the route budget this file exists to
 * save.
 */

import { MORE_SERVICES_PARAM, MORE_SERVICES_VALUE } from './studio-hub';

/** The More menu's address, relative to the event (`studioHubHref`). */
const MORE_MENU = `?${MORE_SERVICES_PARAM}=${MORE_SERVICES_VALUE}`;

/**
 * `/dashboard/<eventId>/<segment>` → `/dashboard/<eventId><to>`. `to` is ''
 * (the event's Home), a path, or a query on Home (`?…`).
 */
const EVENT_SCOPED: readonly (readonly [from: string, to: string])[] = [
  ['for-you', 'vendors'], //                  retired 2026-06-04
  // retired 2026-06-17 → /studio, which is itself retired since 2026-10-02 —
  // so it lands where /studio now does, in one hop.
  ['design', MORE_MENU],
  ['today', ''], //                           retired 2026-06-03 → the event hub
  ['studio/animated-monogram', 'monogram'], // retired 2026-06-25
  ['website/launch', 'website/editor'], //    retired 2026-07-25
  // 🧭 The full-page More Services (owner 2026-10-02, tracker d1: "remove the
  // old page — the More menu is the one place; old links forward"). `/suite`
  // was the page; `/studio` was its predecessor and had redirected to it.
  ['suite', MORE_MENU],
  ['studio', MORE_MENU],
];

/** Whole-path pairs (no event id in them). */
const FIXED: readonly (readonly [from: string, to: string])[] = [
  ['/admin/refinements', '/admin/taxonomy'], //                   retired 2026-07-03
  ['/admin/marketing', '/admin/studio'], //                       retired 2026-07-04
  ['/vendor-dashboard/funnel', '/vendor-dashboard/performance'], // retired 2026-07-02
  ['/vendor-dashboard/tax-documents', '/vendor-dashboard'], //     retired 2026-05-29
  ['/explore/categories', '/explore'], //                         retired 2026-08-15
];

const EVENT_SCOPED_RE: ReadonlyMap<string, string> = new Map(EVENT_SCOPED);
const FIXED_MAP: ReadonlyMap<string, string> = new Map(FIXED);

/** Every old path this map forwards, with `<eventId>` as the placeholder — for tests and docs. */
export const LEGACY_REDIRECT_OLD_PATHS: readonly string[] = [
  ...EVENT_SCOPED.map(([from]) => `/dashboard/<eventId>/${from}`),
  ...FIXED.map(([from]) => from),
];

/**
 * The path a retired page forwards to, or `null` when `pathname` is not one of
 * them. Pure — no request, no I/O — so the middleware pays one Map lookup.
 */
export function legacyRedirectTarget(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  const fixed = FIXED_MAP.get(path);
  if (fixed) return fixed;

  const m = /^\/dashboard\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return null;
  const to = EVENT_SCOPED_RE.get(m[2]!);
  if (to === undefined) return null;
  if (to === '' || to.startsWith('?')) return `/dashboard/${m[1]}${to}`;
  return `/dashboard/${m[1]}/${to}`;
}
