import { isSafeNext } from '@/lib/safe-next';

/**
 * Where `/open-shop?next=…` sends a person who already has a shop.
 *
 * `next` must be same-origin by the ONE rule (`isSafeNext`) AND a page of the
 * Shop console — /open-shop is a door for suppliers, not a general-purpose
 * redirector. Anything else, or nothing, is Today (`/vendor-dashboard`), which
 * is where an existing supplier always landed before `next` existed.
 *
 * ⚠ A BRAND-NEW shop still lands on Today after the wizard
 * (`a-new-shop-lands-on-today.test.ts`, first-timer fix 12): that is where the
 * ordered First steps live. `next` only changes the "you already have a shop"
 * forward and the sign-in link that leads back to it.
 */
export const OPEN_SHOP_DEFAULT_LANDING = '/vendor-dashboard';

export function openShopLanding(next: unknown): string {
  if (!isSafeNext(next)) return OPEN_SHOP_DEFAULT_LANDING;
  const path = next.split(/[?#]/)[0];
  if (path === OPEN_SHOP_DEFAULT_LANDING || path.startsWith(OPEN_SHOP_DEFAULT_LANDING + '/')) return next;
  return OPEN_SHOP_DEFAULT_LANDING;
}
