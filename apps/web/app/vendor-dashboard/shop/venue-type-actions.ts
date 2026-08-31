'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { isVendorVenueType } from '@/lib/vendor-venue-type';

/**
 * Server action behind My Shop → Business Profile → "What kind of venue are
 * you". `vendor_profiles.venue_type` (migration 20260810000000) has been
 * read publicly since it shipped — by the v1 vendor profile API and by
 * Explore's leaf-match filter — with no writer a vendor could reach. Both
 * live shops carry the seed default (ballroom / garden / heritage), because
 * that is the only value nobody could change.
 *
 * `venue_type` is not one of `LOCKED_IDENTITY_FIELD_KEYS`
 * (lib/vendor-corrections.ts) — unlike the 8 verified-locked identity
 * fields, it stays freely editable even once a shop is verified, the same
 * way `compatible_venue_settings` / `compatible_ceremony_types` do
 * (venue-match-actions.ts, the direct precedent this mirrors).
 *
 * NULL is a valid, deliberate state — the migration comment calls it
 * "no venue-type constraint" and the leaf-match matcher admits a NULL
 * venue_type against every couple's pick. Clearing the pick posts NULL.
 *
 * Writes through the vendor's OWN authenticated client so `vendor_profiles`'
 * existing write policy re-asserts ownership.
 */

export type VenueTypeSaveResult =
  | { ok: true; venueType: string | null }
  | { ok: false; error: string };

export async function updateVenueType(
  _prev: VenueTypeSaveResult | null,
  formData: FormData,
): Promise<VenueTypeSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };
  const vendorProfileId = profile.vendor_profile_id as string;

  const raw = formData.get('venue_type');
  const venueType = isVendorVenueType(raw) ? raw : null;

  const { error } = await supabase
    .from('vendor_profiles')
    .update({ venue_type: venueType })
    .eq('vendor_profile_id', vendorProfileId);

  if (error) {
    // Pre-migration (42703 undefined_column / 42P01 undefined_table) — the
    // code is live, the column is not. See CLAUDE.md § the phantom-column
    // trap: a select/update naming a missing column is REJECTED outright.
    if (error.code === '42703' || error.code === '42P01') {
      return { ok: false, error: 'Venue type isn’t switched on yet — try again shortly.' };
    }
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change your venue type.'
      : error.message;
    return { ok: false, error: friendly };
  }

  revalidatePath('/vendor-dashboard/shop');
  if (profile.business_slug) revalidatePath(`/v/${profile.business_slug}`);

  return { ok: true, venueType };
}
