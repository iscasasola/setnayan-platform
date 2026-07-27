'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  validateServiceRadiusPair,
  type ServiceRadiusPair,
} from '@/lib/vendor-service-radius';

/**
 * Server action behind the My Shop "Coverage reach" card — the vendor declares
 * their INNER (free-transport) and OUTER (overall range) service radius.
 *
 * Owner-locked 2026-07-27 · Explore_Replan_BUILD_SPEC_2026-07-27.md §17.
 *
 * ── THE TIER CAP IS RE-READ HERE, NOT TRUSTED FROM THE FORM ─────────────────
 * The cap check reads `tier_state` from the database inside this action. It is
 * never taken from a hidden input or a client prop, because those are whatever
 * the browser says they are — a vendor could otherwise post `tier=enterprise`
 * and buy 100 km of reach for free. The client-side ceiling on the card is
 * ergonomics; THIS is the enforcement.
 *
 * That said, write-time enforcement alone would still be insufficient: it can't
 * see the future. A vendor who legitimately declares 50 km while on Pro and
 * later lapses to Verified leaves a stale 50 in the column. The read path
 * (`effectiveOuterRadiusKm`) re-clamps on every read, so the stale value is
 * never believed above the current cap. Both halves are needed; neither alone
 * is enough.
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

  // Server-side tier read. Never the form's word for it.
  const { data: tierRow, error: tierError } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (tierError) {
    return { ok: false, error: 'Couldn’t check your plan just now — please try again.' };
  }
  const tier = (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null;

  const parsed = validateServiceRadiusPair({
    inner: formData.get('inner_radius_km'),
    outer: formData.get('outer_radius_km'),
    tier,
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

  revalidatePath('/vendor-dashboard/shop');
  return { ok: true, innerRadiusKm: parsed.innerRadiusKm, outerRadiusKm: parsed.outerRadiusKm };
}
