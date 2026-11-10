/**
 * lib/shop-view.ts — WHICH SHOP-PAGE REQUESTS THE CACHED COPY MAY ANSWER (speed, 2026-11-10).
 *
 * The public shop page (`app/v/[slug]/page.tsx`) is `force-dynamic`: it reads the viewer's session (Follow, the
 * couple's own event, an existing thread), the admin demo cookie, the team-preview gate and the address's query — so
 * every open of every shop was a full server render (~90 tables, dozens of reads). For a STRANGER — no session, no
 * demo cookie, no query the page reads — the live render draws the same page for everybody.
 *
 * Same shape as the cached Event Hub (EV1, `lib/hub-view-key.ts`): the middleware rewrites such a request to
 * `/v/{slug}/cached` (`app/v/[slug]/cached/page.tsx`), a route that renders the SAME page function and reads NOTHING
 * from the request, so Next renders it once and serves it from the cache (ISR) until the shop's tag is revalidated
 * (`revalidateShopPage`, `lib/shop-page-cache.ts` — every supplier save that changes the shop) or `revalidate`
 * passes. Everyone else (signed in, an admin in demo mode, the native apps, a query the page reads) keeps the live
 * render, exactly as before.
 *
 * Pure and edge-safe: the middleware imports it. Held by `lib/the-shop-page-stays-cacheable.test.ts`.
 */
import { HUB_LIVE_COOKIES, isAuthCookieName } from './hub-view-key';

/** The route segment the middleware rewrites to: `app/v/[slug]/cached`. Never reachable from outside. */
export const SHOP_VIEW_SEGMENT = 'cached';

const SLUG = '[a-z0-9][a-z0-9-]{0,62}';

/** Is this path the cached shop route itself (`/v/{slug}/cached`)? Refused from outside; never recorded as a visit. */
export function isShopViewPath(pathname: string): boolean {
  return new RegExp(`^/v/${SLUG}/${SHOP_VIEW_SEGMENT}/?$`, 'i').test(pathname);
}

/**
 * EVERY query parameter the shop page reads EXCEPT the campaign tags. Any of them on the request keeps the live
 * render: they change what is drawn (`reviewsPage`, the waitlist notice `wl`, the opened service, the event a couple
 * came from and the back door `src`, a chapter referral). ⚠ The guard test reads the page's `search.*` reads and
 * fails when one is neither here nor in `SHOP_BEACON_PARAMS`.
 */
export const SHOP_LIVE_PARAMS: readonly string[] = ['reviewsPage', 'wl', 'service', 'event', 'src', 'ref_chapter'];

/**
 * The query the page reads ONLY to attribute the view (the funnel's VIEWS stage) — it draws nothing from them. On the
 * cached copy the view is recorded by the page's beacon (`ShopViewBeacon`), which reads them off the address, so a
 * shared link with `?utm_source=` is still answered from the cache and still attributed.
 */
export const SHOP_BEACON_PARAMS: readonly string[] = ['utm', 'utm_source', 'utm_medium', 'utm_campaign'];

/**
 * Is this request one the cached shop copy may answer — and for which shop? `null` = the live render.
 * Pure: the middleware hands it what it read off the request.
 */
export function shopRequestShape(req: {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  cookieNames: readonly string[];
  clientTypeCookie: string | null;
  userAgent: string | null;
  isServerAction: boolean;
}): { slug: string } | null {
  const reads = req.method === 'GET' || req.method === 'HEAD';
  // A Server Action posted from the cached page keeps the same route tree (the client's router holds it).
  if (!reads && !(req.method === 'POST' && req.isServerAction)) return null;
  const m = new RegExp(`^/v/(${SLUG})/?$`, 'i').exec(req.pathname);
  if (!m) return null;
  for (const p of SHOP_LIVE_PARAMS) if (req.searchParams.has(p)) return null;
  // `?demo=` is the middleware's own admin flag (it sets a cookie and redirects) — never answered from a cache.
  if (req.searchParams.has('demo')) return null;
  // A session, or any cookie a live render reads that a stranger's copy cannot (the admin demo cookie among them).
  if (req.cookieNames.some((n) => isAuthCookieName(n) || HUB_LIVE_COOKIES.includes(n))) return null;
  // The native shells (store app, desktop app) keep the live render.
  if (req.clientTypeCookie === 'capacitor' || req.clientTypeCookie === 'tauri') return null;
  if (/SetnayanApp/i.test(req.userAgent ?? '')) return null;
  return { slug: m[1]! };
}

/** The tag EVERY shop copy wears — for a save that is no one shop's (`revalidateAllShopPages`). */
export const SHOP_PAGES_TAG = 'shop-pages';

/** The cache tag every copy of ONE shop's page wears — revalidated by that shop's saves. */
export function shopPageTag(vendorProfileId: string): string {
  return `shop-page:${vendorProfileId}`;
}

/** The tag a copy wears by its ADDRESS — so a copy drawn before the shop existed (a 404) is cleared when it opens. */
export function shopSlugTag(slug: string): string {
  return `shop-page-slug:${slug.toLowerCase()}`;
}
