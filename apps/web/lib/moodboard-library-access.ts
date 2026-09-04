import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchOwnVendorProfile, type VendorProfileRow } from '@/lib/vendor-profile';
import { uploadableSlotsForShop } from '@/lib/moodboard-gallery-upload';

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
      /** The slots this shop may upload into, already labelled. Never empty. */
      slots: Array<{ key: string; label: string }>;
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
): MoodboardLibraryAccess {
  if (!profile) return { allowed: false, reason: 'no_shop' };
  const slots = uploadableSlotsForShop(profile.services);
  if (slots.length === 0) return { allowed: false, reason: 'no_supplying_trade' };
  return { allowed: true, profile, slots };
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
  const profile = await fetchOwnVendorProfile(supabase, userId);
  return moodboardLibraryAccessForProfile(profile);
}
