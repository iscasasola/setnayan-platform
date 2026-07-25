'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorReachRingsEnabled } from '@/lib/vendor-reach-rings-flag';
import { parseRingSettings, ring2CapKm } from '@/lib/vendor-reach-rings';

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
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tier =
    tierRow && typeof (tierRow as { tier_state?: unknown }).tier_state === 'string'
      ? (tierRow as { tier_state: string }).tier_state
      : null;

  const parsed = parseRingSettings(
    tier,
    formData.get('reach_ring1_km'),
    formData.get('reach_ring2_km'),
  );
  if (!parsed.ok) return parsed;

  const { error } = await supabase
    .from('vendor_profiles')
    .update({
      reach_ring1_km: parsed.ring1Km,
      reach_ring2_km: parsed.ring2Km,
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
