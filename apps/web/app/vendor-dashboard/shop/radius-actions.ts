'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  isVerifiedForReach,
  validateServiceRadiusPair,
  type ServiceRadiusPair,
} from '@/lib/vendor-service-radius';
import { revalidateShopPage } from '@/lib/shop-page-cache';

/**
 * Server action behind the My Shop "Coverage reach" card — the vendor declares
 * their INNER (free-transport) and OUTER (overall range) service radius.
 *
 * Owner-locked 2026-07-27 · Explore_Replan_BUILD_SPEC_2026-07-27.md §17.
 *
 * ── 🔓 NO PLAN CEILING — VERIFICATION IS RE-READ HERE (owner 2026-11-19) ─────
 * *"ok unlock the range. not plan dependend anymore."* · *"Free Unverified
 * account will have a range of 0km."* So the only ceiling is the shop's
 * verification, read from the database inside this action — never from a hidden
 * input or a client prop, because those are whatever the browser says they are.
 * A verified shop on ANY plan may save up to `MAX_DECLARABLE_RADIUS_KM` (the
 * typo guard, unchanged); an unverified shop may only clear its rings.
 *
 * Write-time enforcement alone would still be insufficient: a shop that saves
 * 50 km while verified and is later un-verified leaves a stale 50 in the column.
 * The read path (`effectiveOuterRadiusKm`) re-clamps on every read, so the stale
 * value reads 0. Both halves are needed; neither alone is enough.
 *
 * Writes through the vendor's OWN authenticated client so `vendor_profiles`'
 * existing write policy re-asserts ownership — a viewer/agent team member gets
 * a friendly refusal from the same policy that protects every other field on
 * the row.
 */

export type ServiceRadiusSaveResult =
  | ({ ok: true } & ServiceRadiusPair)
  | { ok: false; error: string };

export async function updateServiceRadius(
  _prev: ServiceRadiusSaveResult | null,
  formData: FormData,
): Promise<ServiceRadiusSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };
  const vendorProfileId = profile.vendor_profile_id as string;

  // Server-side verification read. Never the form's word for it. The plan is NOT read: reach is not a plan
  // allowance (owner 2026-11-19).
  const { data: verifyRow, error: verifyError } = await supabase
    .from('vendor_profiles')
    .select('verification_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (verifyError) {
    return { ok: false, error: 'Couldn’t check your verification just now — please try again.' };
  }
  const verified = isVerifiedForReach(
    (verifyRow as { verification_state?: string | null } | null)?.verification_state ?? null,
  );

  const parsed = validateServiceRadiusPair({
    inner: formData.get('inner_radius_km'),
    outer: formData.get('outer_radius_km'),
    verified,
  });
  if (!parsed.ok) return parsed;

  const { error } = await supabase
    .from('vendor_profiles')
    .update({
      inner_radius_km: parsed.innerRadiusKm,
      outer_radius_km: parsed.outerRadiusKm,
    })
    .eq('vendor_profile_id', vendorProfileId);

  if (error) {
    // Pre-migration (42703) — the code is live, the column is not. Say so in
    // words the vendor can act on instead of leaking a Postgres code.
    if (error.code === '42703' || error.code === '42P01') {
      return { ok: false, error: 'Travel distances aren’t switched on yet — try again shortly.' };
    }
    // The DB's own ordering CHECK, if a race slipped past validation.
    if (error.code === '23514') {
      return {
        ok: false,
        error: 'Your free-travel distance can’t be further than the furthest you’ll travel.',
      };
    }
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change your travel distances.'
      : error.message;
    return { ok: false, error: friendly };
  }

  revalidateShopPage(vendorProfileId);
  revalidatePath('/vendor-dashboard/shop');
  // Shop › Details › Where you work draws these too (the −/＋ steppers save in place, 2026-10-29).
  revalidatePath('/vendor-dashboard/profile');
  return { ok: true, innerRadiusKm: parsed.innerRadiusKm, outerRadiusKm: parsed.outerRadiusKm };
}
