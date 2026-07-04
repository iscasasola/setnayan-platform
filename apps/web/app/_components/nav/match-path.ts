/**
 * Sidebar active-state matcher — pure, query-aware.
 *
 * WHY: the shared <SidebarItem> primitive (all three doorways —
 * customer · vendor · admin) originally compared PATHNAME only:
 *
 *     pathname === item.href || pathname.startsWith(matchPrefix + '/')
 *
 * That breaks for studio menus whose `href` carries a query string — the
 * Accounts Studio ships sibling tabs `/admin/accounts?tab=users` and
 * `/admin/accounts?tab=events`. On `/admin/accounts?tab=users` the pathname
 * is `/admin/accounts`, which equals NEITHER href's pathname-match nor the
 * legacy matchPrefix (`/admin/users` / `/admin/events`), so NEITHER lit.
 * We can't just set `matchPrefix: '/admin/accounts'` on both — that would
 * light BOTH siblings at once (double-lighting).
 *
 * SEMANTICS (this file is THE contract — unit-tested in match-path.test.ts):
 *
 *  1. QUERY-LESS href — unchanged from Phase 0. Active when
 *     `pathname === href` OR `pathname.startsWith(matchPrefix + '/')` OR
 *     `pathname === matchPrefix`. Zero regression to any existing doorway
 *     row (none of which today carry a `?` in their href).
 *
 *  2. QUERY-AWARE href (href contains `?`) — active when BOTH:
 *       a) current pathname === the href's pathname (the part before `?`), AND
 *       b) EVERY query param declared in the href is present in the current
 *          URL with the SAME value. Extra current params are fine (we do NOT
 *          require an exact param-set match), so `?tab=users&x=1` still lights
 *          the `?tab=users` item. `?tab=events` does NOT light `?tab=users`.
 *
 *  3. matchPrefix STILL applies alongside a query href — so the Users item
 *     (query href `/admin/accounts?tab=users` + `matchPrefix '/admin/users'`)
 *     ALSO lights on legacy `/admin/users/[id]` detail routes. Final rule:
 *       active = (query-aware href match) OR (matchPrefix prefix/exact match).
 *
 * The current query is provided by the caller as anything with a
 * `.get(key) => string | null` method — `URLSearchParams`,
 * `ReadonlyURLSearchParams` (from next/navigation `useSearchParams()`), or a
 * test double. `null`/`undefined` current params is treated as "no params
 * present" (acceptable first-paint / SSR state — resolves on hydration).
 */

import type { NavItem } from './types';

/** Minimal read-only surface of URLSearchParams / ReadonlyURLSearchParams. */
export type ParamGetter = { get(key: string): string | null };

/**
 * Split an href into its pathname and its declared query params. `href` may be
 * a plain path (`/admin/users`) or a path + query (`/admin/accounts?tab=users`).
 * Returns the pathname and, when a query string is present, the parsed params.
 */
function splitHref(href: string): { path: string; query: URLSearchParams | null } {
  const qIndex = href.indexOf('?');
  if (qIndex === -1) return { path: href, query: null };
  return {
    path: href.slice(0, qIndex),
    query: new URLSearchParams(href.slice(qIndex + 1)),
  };
}

/**
 * True when every param declared in the item's href query is present with an
 * equal value in the current URL's params. Empty href-query ⇒ vacuously true.
 */
function currentSatisfiesHrefQuery(
  hrefQuery: URLSearchParams,
  current: ParamGetter | null | undefined,
): boolean {
  for (const [key, value] of hrefQuery.entries()) {
    if ((current?.get(key) ?? null) !== value) return false;
  }
  return true;
}

/**
 * True when `pathname` (+ current query) is within this item's route.
 *
 * Pure + typed — no React, no DOM. The caller supplies the current pathname
 * and the current search params so this can be unit-tested in isolation.
 *
 * Preserves the Phase 0 rule verbatim for query-less hrefs; adds query-aware
 * exact matching + keeps matchPrefix working (see file header for the full
 * contract).
 */
export function matchesPath(
  item: NavItem,
  pathname: string,
  currentParams?: ParamGetter | null,
): boolean {
  const { path: hrefPath, query: hrefQuery } = splitHref(item.href);

  // Query-aware href match: pathname must equal the href's pathname AND every
  // declared query param must match the current URL.
  const hrefMatch =
    hrefQuery !== null
      ? pathname === hrefPath && currentSatisfiesHrefQuery(hrefQuery, currentParams)
      : // Query-less href — plain exact pathname match (Phase 0 behavior).
        pathname === hrefPath;

  // matchPrefix defaults to the href's PATHNAME (never the query) so a legacy
  // umbrella like matchPrefix='/admin/users' keeps lighting /admin/users/[id]
  // even when the primary href now carries a ?tab= query. The trailing slash is
  // load-bearing — without it `/budget` matches `/budgets`.
  const matchPrefix = item.matchPrefix ?? hrefPath;
  const prefixMatch =
    pathname === matchPrefix || pathname.startsWith(matchPrefix + '/');

  return hrefMatch || prefixMatch;
}
