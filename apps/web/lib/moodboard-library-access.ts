import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOwnVendorProfile, type VendorProfileRow } from '@/lib/vendor-profile';
import { uploadableSlotsForShop } from '@/lib/moodboard-gallery-upload';
import { tradesForSlot } from '@/lib/moodboard-gallery';
import { canonicalServicesForTile } from '@/lib/vendor-counts';
import type { PhotoPartGroup } from '@/lib/inspiration-slots';
import type { InspirationPartsSnapshot } from '@/lib/inspiration-parts';
import { getInspirationParts } from '@/lib/inspiration-parts-db';

/**
 * lib/moodboard-library-access.ts — ONE predicate for "may this account author
 * mood-board library photos", used by BOTH the page and the server actions.
 *
 * ── THE BUG THIS CLOSES ─────────────────────────────────────────────────────
 * The page and the save DISAGREED, and had since May 2026:
 *
 *   · page.tsx  — `fetchOwnVendorProfile(...)`, i.e. "do you own or belong to
 *     a shop", plus `services.includes('reception_decor')`.
 *   · actions.ts — `users.account_type === 'vendor'`, a different column
 *     entirely, with no shop and no trade in it.
 *
 * So the surface a dual-role account could SEE was the surface it could not
 * SAVE from: the page rendered, the upload threw "vendor only", and nothing
 * anywhere said why. The §10a internal account that also owns a shop for
 * dogfooding is exactly that account — the page comment already records having
 * been bitten by the same column once before, on the other side.
 *
 * 🔑 TWO PREDICATES FOR ONE QUESTION IS A BUG WITH A UI. It is the same shape
 * as `mayBroadcastOnSharedChannel`: whichever half is stricter becomes an
 * invisible wall, and because each half passes its own tests, nothing goes red.
 * There is now one function and both callers import it.
 *
 * ── AND THE TRADE GATE IS DERIVED, NOT LISTED ───────────────────────────────
 * The old `services.includes('reception_decor')` shut out gown designers,
 * florists, cake makers and rental houses — the trades whose photographs a
 * couple actually wants — which is why the page shipped in May 2026 and has
 * never been used. Access now means "your shop supplies at least one
 * inspiration slot", derived through MB10's slot→trade map.
 */

export type MoodboardLibraryAccess =
  | {
      allowed: true;
      profile: VendorProfileRow;
      /** The slots this shop may upload into, already labelled, in the couple's order (`uploadableSlotsForShop`). Never empty. */
      slots: Array<{ key: string; label: string; group: PhotoPartGroup }>;
      /** 🧰 The part the upload form starts on — the shop's OWN kind of work (`slotForShopKind`); null = the first slot. */
      ownSlot: string | null;
    }
  | { allowed: false; reason: 'not_signed_in' | 'no_shop' | 'no_supplying_trade' };

/** The vendor-facing sentence for each refusal. */
export const MOODBOARD_LIBRARY_DENIAL: Readonly<
  Record<'not_signed_in' | 'no_shop' | 'no_supplying_trade', string>
> = {
  not_signed_in: 'Please sign in.',
  no_shop: 'You need a Setnayan shop to add mood-board photos.',
  no_supplying_trade:
    'None of your shop’s services supply a mood-board shelf yet. Add the trade you work in under Coverage, then come back.',
};

/**
 * PURE half — decide from a profile that has already been fetched. Split out so
 * the rule unit-tests without a database and so the page and the action cannot
 * end up asking it two different ways.
 */
export function moodboardLibraryAccessForProfile(
  profile: VendorProfileRow | null,
  /** The parts snapshot — `await getInspirationParts()`. REQUIRED (③0-b): no silent fallback to the consts. */
  parts: InspirationPartsSnapshot,
): MoodboardLibraryAccess {
  if (!profile) return { allowed: false, reason: 'no_shop' };
  const slots = uploadableSlotsForShop(profile.services, parts);
  if (slots.length === 0) return { allowed: false, reason: 'no_supplying_trade' };
  return { allowed: true, profile, slots, ownSlot: slotForShopKind(slots, profile.services, parts) };
}

/**
 * 🧰 THE PART STARTS ON THE SHOP'S OWN KIND (owner-approved 2026-11-14, cut 4 of the supplier's eleven jobs —
 * DECISION_LOG "THE SEVEN SUPPLIER CUTS ARE APPROVED"). The form used to open on the FIRST part the shop may fill, so
 * a florist landed on Table linens. Now: the shop's services in their own order (the first is the one picked at
 * sign-up), and for each the first part (in the couple's order) LED by that service's trade — a florist starts on
 * Bridal bouquet. Null when none matches — the form keeps the first.
 */
export function slotForShopKind(
  slots: ReadonlyArray<{ key: string }>,
  services: readonly string[] | null | undefined,
  parts: InspirationPartsSnapshot,
): string | null {
  /* A part's LEAD trade (`tradesForSlot`'s first) is whose work it shows; every part a florist may fill lists the
     florist's services, so "does it take this service" cannot tell Table linens from Bridal bouquet — its lead can. */
  for (const service of services ?? []) {
    const hit = slots.find((s) => {
      const lead = tradesForSlot(s.key, parts)[0];
      return lead ? canonicalServicesForTile(lead).includes(service) : false;
    });
    if (hit) return hit.key;
  }
  return null;
}

/**
 * The resolver both callers use. Reads the caller's own shop under THEIR OWN
 * client (so RLS decides which shops they may see) and applies the pure rule.
 */
export async function resolveMoodboardLibraryAccess(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<MoodboardLibraryAccess> {
  if (!userId) return { allowed: false, reason: 'not_signed_in' };
  const [profile, parts] = await Promise.all([fetchOwnVendorProfile(supabase, userId), getInspirationParts()]);
  return moodboardLibraryAccessForProfile(profile, parts);
}
