/**
 * 🔗 WHERE A PATH ON A SHOP'S OWN DOMAIN GOES (final check A1-124, 25 Nov 2026).
 *
 * The shop page links by root paths — `/{shop}?dates=1`, `/{shop}?reviewsPage=2`, `/{shop}/story/{event}`,
 * `/{other-shop}` — because on setnayan.com a shop lives at `/{shop}`. On the shop's own domain the middleware
 * rewrote EVERY path to `/v/{shop}{path}`, so those links became `/v/{shop}/{shop}…`, a 404.
 *
 * `target` is the resolver's answer (`/v/{shop}`). Returns the internal path to rewrite to, or `null` for every other
 * path (another shop, sign-in, the dashboard, help …), which the middleware REDIRECTS to Setnayan's own address
 * (`setnayanAddressFor`). 🔒 Never served under the shop's domain: a sign-in or a dashboard on a domain the supplier
 * controls would hand them the session (controller review of #8321, 25 Nov).
 */
const SHOP_SUBROUTES = /^\/(?:story|dates|booth|guest-review|review)(?:\/|$)/i;

export function customDomainShopPath(target: string, pathname: string): string | null {
  if (!target.startsWith('/v/')) return null;
  if (pathname === '/' || pathname === '') return target;
  const own = `/${target.slice(3)}`.toLowerCase();
  const lower = pathname.toLowerCase();
  // The shop's own root-path links: drop the repeated name.
  if (lower === own) return target;
  if (lower.startsWith(`${own}/`)) return `${target}${pathname.slice(own.length)}`;
  // The shop's sub-pages addressed from its domain root (`/story/{event}`, `/dates`).
  if (SHOP_SUBROUTES.test(pathname)) return `${target}${pathname}`;
  return null;
}

/** Setnayan's own origin for a path that does not belong to the shop (sign-in, dashboard, another shop …). */
export const SETNAYAN_ORIGIN = 'https://www.setnayan.com';

export function setnayanAddressFor(pathname: string, search: string): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SETNAYAN_ORIGIN}${path}${search}`;
}
