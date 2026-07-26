'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorReachRingsEnabled } from '@/lib/vendor-reach-rings-flag';
import {
  parseRingSettings,
  resolveTierForRingSave,
  ring2CapKm,
} from '@/lib/vendor-reach-rings';

/**
 * Server action behind the My Shop "Coverage — free travel & willing to travel"
 * card (owner-locked model 2026-07-25 § 6). Non-redirecting
 * (`useActionState`-shaped), same idiom as `autoreply-actions.ts`.
 *
 * SERVER-AUTHORITATIVE. The card's inputs are capped client-side for UX only;
 * this action re-derives both radii through the SAME pure clamp the resolver
 * uses (`parseRingSettings` → `resolveRingRadii`), so an over-tier submission
 * is stored at the tier cap rather than as the vendor typed it. Note the cap is
 * ALSO applied on every read, so even a direct PostgREST PATCH that bypasses
 * this action is inert — see the migration's header comment.
 *
 * Flag-dark: refuses outright while NEXT_PUBLIC_VENDOR_REACH_RINGS_V1 is off,
 * mirroring the card that never renders. So the two ring columns are never
 * written by any path until the owner flips the flag.
 */

export type ReachRingsSaveResult =
  | { ok: true; ring1Km: number; ring2Km: number; capKm: number }
  | { ok: false; error: string };

export async function updateVendorReachRings(
  _prev: ReachRingsSaveResult | null,
  formData: FormData,
): Promise<ReachRingsSaveResult> {
  if (!isVendorReachRingsEnabled()) {
    return { ok: false, error: 'Coverage rings aren’t available yet.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };

  // The tier is NOT on the profile projection (and must not be added to it —
  // see lib/vendor-profile.ts FULL_VENDOR_PROFILE_SELECT). Read it on its own so
  // a column/deploy skew can only fail this one narrow query.
  //
  // ABORT, NEVER DEGRADE, on a failed tier read. `asVendorTier(null)` is 'free',
  // whose Ring-2 cap is the SMALLEST on the ladder (30 km) — so treating a
  // transient PostgREST hiccup as "no tier" would clamp an Enterprise vendor's
  // 100 km down to 30 km and then WRITE that 30 to the column. A read failure
  // would durably confiscate 70 km of purchased reach. Refusing the save costs
  // the vendor one retry; guessing costs them the plan they paid for.
  const { data: tierRow, error: tierErr } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tierRead = resolveTierForRingSave(
    tierRow as { tier_state?: unknown } | null,
    tierErr,
  );
  if (!tierRead.ok) return { ok: false, error: tierRead.error };
  const tier = tierRead.tier;

  const parsed = parseRingSettings(
    tier,
    formData.get('reach_ring1_km'),
    formData.get('reach_ring2_km'),
  );
  if (!parsed.ok) return parsed;

  // `parsed.ring2Store`, NOT `parsed.ring2Km`. NULL in reach_ring2_km means
  // "follow my plan's cap", and the card is seeded with the DERIVED radius — so
  // persisting the effective number turns an untouched vendor's relative
  // "whatever my plan allows" into an absolute freeze at today's cap. They then
  // buy Pro for the advertised 60 km and the read-side clamp hands them back the
  // Solo 30 they accidentally wrote. See `ring2ColumnValue`.
  const { error } = await supabase
    .from('vendor_profiles')
    .update({
      reach_ring1_km: parsed.ring1Km,
      reach_ring2_km: parsed.ring2Store,
    })
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change your coverage.'
      : /column .* does not exist/i.test(error.message)
        ? 'Coverage rings aren’t available yet.'
        : error.message;
    return { ok: false, error: friendly };
  }

  revalidatePath('/vendor-dashboard/shop');
  // Spread the parsed fields EXPLICITLY: `{ ok: true, ...parsed }` puts
  // `parsed.ok` after the literal and TypeScript rejects the shadowed key
  // (TS2783). Naming the fields also keeps this return type-stable if
  // parseRingSettings ever grows a field.
  return {
    ok: true,
    ring1Km: parsed.ring1Km,
    ring2Km: parsed.ring2Km,
    capKm: ring2CapKm(tier),
  };
}
