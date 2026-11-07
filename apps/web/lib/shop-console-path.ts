import { isSafeNext } from '@/lib/safe-next';

/**
 * A user-controlled "where next" path, accepted ONLY when it is a page of the
 * Shop console (`/vendor-dashboard` or below). Pure — middleware, layouts and
 * tests read the same rule.
 *
 * Same-origin by the ONE rule (`isSafeNext`) AND inside the console. Anything
 * else, or nothing, is Today (`/vendor-dashboard`).
 *
 * Two doors use it:
 *   · `/open-shop?next=…` — where a person who ALREADY has a shop is forwarded
 *     (e.g. "Get your invite link" on /for-suppliers). /open-shop is a door
 *     for suppliers, not a general-purpose redirector.
 *     ⚠ A BRAND-NEW shop still lands on Today after the wizard
 *     (`a-new-shop-lands-on-today.test.ts`, first-timer fix 12): that is where
 *     the ordered First steps live.
 *   · the vendor-dashboard layout's sign-in bounce — a deep link to a chat or a
 *     booking survives the login round trip instead of collapsing to Today.
 */
export const SHOP_CONSOLE_HOME = '/vendor-dashboard';

/**
 * The request path (pathname + search) the middleware stamps on every request
 * it passes on, so a LAYOUT — which Next does not hand the URL — can build a
 * `?next=` that points back where the person was going. Always overwritten by
 * the middleware; still only ever read through `shopConsolePath`, so a forged
 * value can at worst pick another console page.
 */
export const REQUEST_PATH_HEADER = 'x-sn-request-path';

export function shopConsolePath(next: unknown): string {
  if (!isSafeNext(next)) return SHOP_CONSOLE_HOME;
  const path = next.split(/[?#]/)[0] ?? '';
  if (path === SHOP_CONSOLE_HOME || path.startsWith(SHOP_CONSOLE_HOME + '/')) return next;
  return SHOP_CONSOLE_HOME;
}

/** pathname + search of a URL, minus Next's internal `_rsc` cache-buster. */
export function requestPathOf(url: { pathname: string; search: string }): string {
  const params = new URLSearchParams(url.search);
  params.delete('_rsc');
  const q = params.toString();
  return url.pathname + (q ? `?${q}` : '');
}
