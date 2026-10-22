/**
 * WHICH SHOP THE SUPPLIER PAGES READ AND WRITE — the ONE active-shop resolver (owner 2026-10-22: every account
 * switches between all of its shops from the avatar sheet).
 *
 * The avatar sheet lists every shop a login can open, one row per shop. Pressing a row posts its id to
 * `app/vendor-dashboard/switch-shop/route.ts`, which checks it against this login's own shops and writes the httpOnly
 * `sn_shop` cookie. Every server read or write that needs "the shop I am standing in" asks {@link resolveActiveShop}
 * — `fetchOwnVendorProfile`, `resolveVendorRole`, `fetchAdminVendorContext`, the shop-field actions, Instagram,
 * manpower, the plan page — so a switch moves the page AND the saves together.
 *
 * 🔒 WHY THERE IS ONLY ONE. Until 2026-10-22 the owner path ignored the cookie: dozens of reads found "my shop" as
 * `vendor_profiles.user_id = auth.uid()` directly, so an owner of shop A who also helps shop B, switched to B, would
 * have seen B while the field editors saved to A. Those reads now take the shop id from here; the guard
 * `lib/the-active-shop-is-resolved-once.test.ts` fails any shop-scoped server file that finds the shop by the login's
 * own id again, and `tests/db/an-owner-picks-which-shop.db.test.ts` runs this resolver against the replayed schema
 * with two shops and proves a write after switching lands on the switched shop.
 *
 * The rule (pure, {@link pickActiveShop}):
 *   1. the chosen shop, when this login OWNS it or holds a helper seat in it;
 *   2. else the shop they own (oldest first);
 *   3. else their first helper seat (oldest first) — exactly what the resolver did before a switch existed.
 * A chosen id the login cannot reach (a forged cookie, a seat since removed) falls back to 2/3 — it never opens, and
 * nothing is ever written to it.
 *
 * A refused read THROWS, never answers "no shop": a supplier who has a shop must not be sent to the brand-new-shop
 * wizard because a query did not answer (`lib/shop-presence.ts`). RLS is still the fence underneath — a helper on
 * shop B reaches exactly what the policies admit a helper of B, and the owner-only `vendor_profiles` write policy
 * still refuses them B's profile; the shop editors say so (`owned`) instead of saving nothing and reporting success.
 */
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VendorSwitchTarget } from '@/lib/roles';
import { classifyShopRead } from '@/lib/shop-presence';

/** The cookie that names the chosen shop. httpOnly; never read by page script. */
export const ACTIVE_SHOP_COOKIE = 'sn_shop';

/** The shop the supplier pages are standing in, and whether this login OWNS it (owner-only writes check this). */
export type ActiveShop = { vendorProfileId: string; owned: boolean };

/**
 * The shops this login can open in the supplier dashboard — the avatar sheet draws one row for each and the switch
 * route admits only these. Every shop they own AND every helper seat (owner 2026-10-22).
 */
export function reachableShops<T extends Pick<VendorSwitchTarget, 'owned'>>(shops: readonly T[]): T[] {
  return [...shops];
}

/**
 * THE RULE, pure. `ownedIds` / `seatIds` oldest first. A chosen id outside both lists is never returned.
 */
export function pickActiveShop(
  ownedIds: readonly string[],
  seatIds: readonly string[],
  chosen: string | null | undefined,
): ActiveShop | null {
  if (chosen) {
    if (ownedIds.includes(chosen)) return { vendorProfileId: chosen, owned: true };
    if (seatIds.includes(chosen)) return { vendorProfileId: chosen, owned: false };
  }
  const own = ownedIds[0];
  if (own) return { vendorProfileId: own, owned: true };
  const seat = seatIds[0];
  if (seat) return { vendorProfileId: seat, owned: false };
  return null;
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

function idsOf(rows: readonly unknown[] | null | undefined): string[] {
  const out: string[] = [];
  for (const r of rows ?? []) {
    const id = (r as { vendor_profile_id?: unknown }).vendor_profile_id;
    if (typeof id === 'string' && id.length > 0 && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * THE resolver. Reads the login's owned shops and helper seats (ids only, in parallel) plus the chosen-shop cookie,
 * and applies {@link pickActiveShop}. Null = a PROVEN absence (both reads answered, nothing found). Throws when
 * either read is refused.
 *
 * React `cache()` per request: the layout, the page and every action helper in one render share a single pair of
 * reads. `chosen` is for tests and callers outside a request; pages and actions leave it undefined (the cookie).
 */
export const resolveActiveShop = cache(
  async (supabase: SupabaseClient, userId: string, chosen?: string | null): Promise<ActiveShop | null> => {
    const [ownedRes, seatRes, cookie] = await Promise.all([
      supabase
        .from('vendor_profiles')
        .select('vendor_profile_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('vendor_team_members')
        .select('vendor_profile_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      chosen === undefined ? readActiveShopCookie() : Promise.resolve(chosen),
    ]);
    for (const [name, res] of [
      ['vendor_profiles', ownedRes],
      ['vendor_team_members', seatRes],
    ] as const) {
      if (classifyShopRead(res.data, res.error) === 'unreadable') {
        throw new Error(
          `resolveActiveShop failed: ${name} read unreadable: [${
            (res.error as { message?: string } | null)?.message ?? 'no rows and no error'
          }]`,
        );
      }
    }
    return pickActiveShop(idsOf(ownedRes.data), idsOf(seatRes.data), cookie);
  },
);

/** Just the id — for a read that needs only "which shop". */
export async function resolveActiveShopId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  return (await resolveActiveShop(supabase, userId))?.vendorProfileId ?? null;
}

/** What an owner-only shop editor says to a helper standing in somebody else's shop (RLS would refuse the write). */
export const OWNER_ONLY_SHOP_EDIT = 'Only the shop’s owner can change this.';

/** What a shop editor says when the shop reads did not answer — nothing was written. */
export const SHOP_UNREADABLE = 'We couldn’t load your shop just now. Nothing was changed — please try again.';

export type OwnedActiveShop = { ok: true; vendorProfileId: string } | { ok: false; error: string };

/**
 * For an OWNER-ONLY shop editor (the `vendor_profiles` write policy admits the owner alone): the active shop when this
 * login owns it, else a sentence saying why nothing will be saved. A helper standing in somebody else's shop is told
 * so here, instead of the update matching zero rows and reporting success.
 */
export async function resolveOwnedActiveShop(
  supabase: SupabaseClient,
  userId: string,
  chosen?: string | null,
): Promise<OwnedActiveShop> {
  let active: ActiveShop | null;
  try {
    active = await resolveActiveShop(supabase, userId, chosen);
  } catch {
    return { ok: false, error: SHOP_UNREADABLE };
  }
  if (!active) return { ok: false, error: 'Supplier profile not found.' };
  if (!active.owned) return { ok: false, error: OWNER_ONLY_SHOP_EDIT };
  return { ok: true, vendorProfileId: active.vendorProfileId };
}
