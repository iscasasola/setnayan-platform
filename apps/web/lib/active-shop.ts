/**
 * WHICH SHOP THE SUPPLIER PAGES READ — the shop-id switch (avatar sheet Direction 2, owner 2026-10-22).
 *
 * The avatar sheet lists every shop a login can open, one row per shop (it used to draw `vendorProfiles[0]` alone).
 * The supplier dashboard resolves ONE shop per login (`fetchOwnVendorProfile`): the shop you OWN, else your first
 * helper seat. A helper who sits in two shops therefore could only ever reach the first. The switch is a cookie the
 * resolver reads for the helper path, set by `app/vendor-dashboard/switch-shop/route.ts` after it checks the shop is
 * one of this login's own.
 *
 * 🔒 THE OWNER PATH IGNORES THE COOKIE, ON PURPOSE. 47 reads (actions, payments, Instagram, subscriptions…) find
 * "my shop" as `vendor_profiles.user_id = auth.uid()` directly, not through the resolver. If an owner who also helps
 * another shop switched the RESOLVER to that shop, the page would show shop B while those actions wrote to shop A.
 * So a login that owns a shop reaches its own shop only (`reachableShops`), and the switch is offered where it is
 * safe: a helper with no shop of their own, whose every owner-path read finds nothing either way.
 *
 * RLS is unchanged and is the real fence: a forged id names a shop the policies do not admit, and the route refuses
 * any id outside `reachableShops` before it writes the cookie.
 */
import type { VendorSwitchTarget } from '@/lib/roles';

/** The cookie that names the helper's chosen shop. httpOnly; never read by page script. */
export const ACTIVE_SHOP_COOKIE = 'sn_shop';

/**
 * The shops this login can actually open in the supplier dashboard — the avatar sheet draws one row for each.
 * Owner of a shop → that shop only (see the docblock: owner-path reads cannot follow a switch).
 * No shop of their own → every helper seat.
 */
export function reachableShops<T extends Pick<VendorSwitchTarget, 'owned'>>(shops: readonly T[]): T[] {
  const owned = shops.filter((s) => s.owned);
  return owned.length > 0 ? owned : [...shops];
}

/**
 * The helper seat the resolver opens: the chosen one when it is one of theirs, else the first (oldest) — exactly
 * what the resolver did before the switch existed. A chosen id that is not in the list is never returned.
 */
export function pickHelperShop(seatIds: readonly string[], chosen: string | null | undefined): string | undefined {
  if (chosen && seatIds.includes(chosen)) return chosen;
  return seatIds[0];
}

/** The chosen shop from the request's cookies — null outside a request, or when none is set. */
export async function readActiveShopCookie(): Promise<string | null> {
  try {
    const { cookies } = await import('next/headers');
    const jar = await cookies();
    const v = jar.get(ACTIVE_SHOP_COOKIE)?.value?.trim();
    return v ? v : null;
  } catch {
    return null;
  }
}
