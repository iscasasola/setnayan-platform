/**
 * lib/legacy-redirects.ts — the ONE map of retired page paths that still
 * forward, read by `middleware.ts`.
 *
 * ─── WHY THESE LIVE HERE AND NOT AS PAGES OR next.config REDIRECTS ──────────
 * Each retired path used to be a `page.tsx` whose only job was `redirect(...)`
 * (or, since 2026-10-02, a real page folded into /admin/categories).
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
 * does this — except the KEEPS_QUERY rows, whose destination reads it.
 *
 * ⚠ EXACT PATHS ONLY (a trailing slash is tolerated), plus the one pattern for
 * the three per-event-type pages. Any other child is a different URL and is
 * not forwarded.
 *
 * ⚠ ADDING A ROW to retire another stub: delete the page, add the pair, and
 * `lib/legacy-redirects.test.ts` holds the rest. Do NOT add a `redirects()` rule
 * to next.config.ts for this — it spends the route budget this file exists to
 * save.
 */

/** `/dashboard/<eventId>/<segment>` → `/dashboard/<eventId>/<to>` (`to` may be ''). */
const EVENT_SCOPED: readonly (readonly [from: string, to: string])[] = [
  ['for-you', 'vendors'], //                  retired 2026-06-04
  ['design', 'studio'], //                    retired 2026-06-17
  ['today', ''], //                           retired 2026-06-03 → the event hub
  ['studio/animated-monogram', 'monogram'], // retired 2026-06-25
  ['website/launch', 'website/editor'], //    retired 2026-07-25
];

/** Whole-path pairs (no event id in them). */
const FIXED: readonly (readonly [from: string, to: string])[] = [
  ['/admin/refinements', '/admin/categories'], //                 retired 2026-07-03
  // "Categories & event types" (2026-10-02) — six old doors, one page.
  ['/admin/taxonomy/aliases', '/admin/categories?show=words'], //  retired 2026-10-02
  ['/admin/event-types', '/admin/categories?list=event-types'], // retired 2026-10-02
  ['/admin/wedding-traditions', '/admin/categories?list=religions'], // retired 2026-10-02
  ['/admin/wedding-types', '/admin/categories?list=religions'], //  retired 2026-10-02
  ['/admin/marketing', '/admin/studio'], //                       retired 2026-07-04
  ['/vendor-dashboard/funnel', '/vendor-dashboard/performance'], // retired 2026-07-02
  ['/vendor-dashboard/tax-documents', '/vendor-dashboard'], //     retired 2026-05-29
  ['/explore/categories', '/explore'], //                         retired 2026-08-15
];

/**
 * Paths whose QUERY is carried over, because the destination reads it. The
 * Taxonomy Studio's own deep links (`?view=vocab-event`, `?open=<category>`,
 * `?q=`) live in emails and the admin's bookmarks; the categories page reads
 * those same params (`readState`), so they keep landing on the same thing.
 */
const KEEPS_QUERY: ReadonlyMap<string, string> = new Map([
  ['/admin/taxonomy', '/admin/categories'], //                    retired 2026-10-02
]);

/**
 * `/admin/event-types/<type>/(categories|profile|onboarding)` — the three
 * per-type pages, now sections of the event type's panel.
 */
const EVENT_TYPE_PAGE_RE = /^\/admin\/event-types\/([a-z][a-z0-9_]{1,30})\/(categories|profile|onboarding)$/;

const EVENT_SCOPED_RE: ReadonlyMap<string, string> = new Map(EVENT_SCOPED);
const FIXED_MAP: ReadonlyMap<string, string> = new Map(FIXED);

/** Every old path this map forwards, with `<eventId>` as the placeholder — for tests and docs. */
export const LEGACY_REDIRECT_OLD_PATHS: readonly string[] = [
  ...EVENT_SCOPED.map(([from]) => `/dashboard/<eventId>/${from}`),
  ...FIXED.map(([from]) => from),
  ...[...KEEPS_QUERY.keys()],
  '/admin/event-types/<type>/categories',
  '/admin/event-types/<type>/profile',
  '/admin/event-types/<type>/onboarding',
];

/**
 * The path a retired page forwards to, or `null` when `pathname` is not one of
 * them. Pure — no request, no I/O — so the middleware pays one Map lookup.
 */
export function legacyRedirectTarget(pathname: string, search = ''): string | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  const fixed = FIXED_MAP.get(path);
  if (fixed) return fixed;

  const keeps = KEEPS_QUERY.get(path);
  if (keeps) return search && search !== '?' ? `${keeps}${search.startsWith('?') ? search : `?${search}`}` : keeps;

  const et = EVENT_TYPE_PAGE_RE.exec(path);
  if (et) return `/admin/categories?list=event-types&open=${et[1]}`;

  const m = /^\/dashboard\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return null;
  const to = EVENT_SCOPED_RE.get(m[2]!);
  if (to === undefined) return null;
  return to === '' ? `/dashboard/${m[1]}` : `/dashboard/${m[1]}/${to}`;
}
