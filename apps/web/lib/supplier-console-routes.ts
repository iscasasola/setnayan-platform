/**
 * 🚪 THE SUPPLIER CONSOLE'S OWN PAGES, BY FIRST SEGMENT (W1-B28, supplier walk 16 Nov 2026).
 *
 * An unknown `/vendor-dashboard/<anything>` answered 200 — the console's heavy layout and its ~8 s loader — and only
 * then drew "This page doesn't exist". The cause is the rise slot's catch-all (`app/vendor-dashboard/@rise/[...rest]`,
 * which must stay: it clears a risen page on a soft navigation): with it, EVERY address under the console "matches",
 * so Next never answers its fast 404.
 *
 * So the middleware answers first: a console address whose first segment is not one of the console's own pages is
 * rewritten (before any session work) to an address no route can match, and Next serves the root 404 — status 404, at
 * once, with the site's own "doesn't exist" page. Nothing deeper is judged here: `/vendor-dashboard/clients/<id>` stays
 * the page's own business (its `notFound()`).
 *
 * ⚠ THE LIST MUST BE EVERY TOP-LEVEL PAGE. A new page left off it would 404. `supplier-console-routes.test.ts` walks
 * `app/vendor-dashboard/` and fails until this list and the folders agree — both ways.
 *
 * Pure and edge-safe: no I/O. Legacy forwards (`lib/legacy-redirects.ts`) and `next.config.ts` redirects run before it.
 */

export const SUPPLIER_CONSOLE_HOME = '/vendor-dashboard';

/** Every folder directly under `app/vendor-dashboard/` that holds a page or a route handler. */
export const SUPPLIER_CONSOLE_SEGMENTS: ReadonlySet<string> = new Set([
  'activities',
  'attributes',
  'booking-fees',
  'bookings',
  'branches',
  'calendar',
  'clients',
  'collections',
  'contracts',
  'creators',
  'customers',
  'deep-search',
  'demand',
  'disputes',
  'earnings',
  'events',
  'help',
  'invite',
  'lines',
  'locked-qr',
  'manpower',
  'messages',
  'moodboard-library',
  'more',
  'notifications',
  'on-the-day',
  'packages',
  'partnerships',
  'payday',
  'payment-options',
  'performance',
  'profile',
  'proposals',
  'recaps',
  'recommendations',
  'repertoire',
  'reviews',
  'rooms-seating',
  'services',
  'settings',
  'shop',
  'subscription',
  'switch-shop',
  'team',
  'theft-watch',
  'track-record',
  'verify',
  'website',
]);

/**
 * Where an unknown console address is rewritten: two segments that start with `_`. A folder whose name starts with `_`
 * is private and never a route, so only a DYNAMIC folder could match — and the one top-level dynamic folder,
 * `app/[slug]`, has none beneath it (held by the test). Unmatched → Next's root 404 (`app/not-found.tsx`), status 404.
 */
export const SUPPLIER_PAGE_NOT_FOUND_REWRITE = '/_no-such-page/_vendor-dashboard';

/** True when `pathname` is under the console and its first segment is not one of the console's pages. */
export function isUnknownSupplierPage(pathname: string): boolean {
  if (!pathname.startsWith(SUPPLIER_CONSOLE_HOME + '/')) return false;
  const first = pathname.slice(SUPPLIER_CONSOLE_HOME.length + 1).split('/')[0] ?? '';
  if (first === '') return false; // `/vendor-dashboard/` is the home
  let seg = first;
  try {
    seg = decodeURIComponent(first);
  } catch {
    return true; // a malformed escape is no page of ours
  }
  return !SUPPLIER_CONSOLE_SEGMENTS.has(seg);
}
