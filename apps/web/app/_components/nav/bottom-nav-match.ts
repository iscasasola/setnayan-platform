import type { BottomNavItem } from './types';

/**
 * bottom-nav-match.ts — which bar tab a URL lights, as a pure function.
 *
 * Lifted out of `bottom-nav.tsx` (2026-10-21, the supplier bar Today · Customers
 * · Shop · Hub) so a test can ask the bar's OWN rule which tab a route lights,
 * instead of re-typing the rule beside it — a second copy of a matcher is how a
 * guard agrees with itself while the bar disagrees. The bar calls this; nothing
 * about how it matches changed.
 *
 * Exact-only extras first (`activeMatchAlsoExact`) — lets a merged hub tab
 * combine an exact landing (`/admin`) with prefix umbrellas without flipping
 * every match to exact via `activeMatchExact`. A prefix matches itself or
 * itself + '/', so `/budgets` never mis-matches `/budget`.
 */
export function bottomNavItemMatches(
  pathname: string,
  item: Pick<BottomNavItem, 'activeMatch' | 'activeMatchExact' | 'activeMatchAlsoExact'>,
): boolean {
  if (item.activeMatchAlsoExact?.some((p) => pathname === p)) return true;
  const matches = Array.isArray(item.activeMatch) ? item.activeMatch : [item.activeMatch];
  return item.activeMatchExact
    ? matches.some((prefix) => pathname === prefix)
    : matches.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}
