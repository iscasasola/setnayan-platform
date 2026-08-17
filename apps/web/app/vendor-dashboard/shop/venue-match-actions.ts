'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  ALLOWED_CEREMONY_TYPES,
  ALLOWED_VENUE_SETTINGS,
  parseCompatibility,
} from '@/lib/vendor-compatibility';

/**
 * Server action behind My Shop → Business Profile → "Weddings you're a fit
 * for" — the shop declares which reception settings and which ceremonies it
 * works with.
 *
 * ── WHY THIS IS ITS OWN ACTION, NOT AN `INLINE_PROFILE_FIELDS` KEY ──────────
 * The obvious route was to add both columns to the inline checklist editor.
 * Reading `updateVendorProfileField` rules that out: every key it accepts is
 * either a LOCKED IDENTITY field (blocked outright once a shop is verified —
 * corrections go through /admin/corrections) or an explicitly allowlisted
 * gallery field. Venue and ceremony fit are neither. They are a standing
 * business declaration that legitimately CHANGES — a verified studio that
 * starts taking beach weddings must be able to say so without filing a
 * correction ticket with an admin. Routing it through the identity editor
 * would have shipped a control that a verified shop can see and cannot use.
 *
 * The precedent this mirrors is `updateServiceRadius`: a non-checklist,
 * always-optional marketplace declaration with its own action and its own card.
 * Both answer the same question from different angles — reach answers HOW FAR,
 * this answers WHAT KIND.
 *
 * ── NOT PART OF THE COMPLETION GATE, DELIBERATELY ───────────────────────────
 * This is absent from `businessProfileChecklist()`. Adding it there would drop
 * every already-published shop below 100% overnight and re-open the verify
 * teaser on shops that finished months ago — punishing them for a field that
 * did not exist when they filled the form in. Undeclared is a valid, useful
 * state: it means "open to all", which is exactly what the marketplace filter
 * already assumes of a NULL.
 *
 * Writes through the vendor's OWN authenticated client so `vendor_profiles`'
 * existing write policy re-asserts ownership — a viewer-tier team member gets
 * the same refusal here as on every other field of the row.
 */

export type VenueMatchSaveResult =
  | { ok: true; venueSettings: string[] | null; ceremonyTypes: string[] | null }
  | { ok: false; error: string };

export async function updateVenueMatching(
  _prev: VenueMatchSaveResult | null,
  formData: FormData,
): Promise<VenueMatchSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };
  const vendorProfileId = profile.vendor_profile_id as string;

  const venueSettings = parseCompatibility(
    formData.getAll('compatible_venue_settings'),
    ALLOWED_VENUE_SETTINGS,
  );
  const ceremonyTypes = parseCompatibility(
    formData.getAll('compatible_ceremony_types'),
    ALLOWED_CEREMONY_TYPES,
  );

  const { error } = await supabase
    .from('vendor_profiles')
    .update({
      compatible_venue_settings: venueSettings,
      compatible_ceremony_types: ceremonyTypes,
    })
    .eq('vendor_profile_id', vendorProfileId);

  if (error) {
    // Pre-migration (42703 undefined_column / 42P01 undefined_table) — the code
    // is live, the column is not. Say it in words a shop owner can act on
    // rather than leaking a Postgres code onto the screen.
    if (error.code === '42703' || error.code === '42P01') {
      return { ok: false, error: 'Wedding fit isn’t switched on yet — try again shortly.' };
    }
    // 23502 not_null_violation — clearing every tick posts NULL (which is what
    // "any venue" MEANS here), and both columns were NOT NULL until migration
    // 20271146556997. Measured against production: the save was refused
    // outright and this handler had no branch for it, so the shop owner read a
    // raw Postgres sentence and never saved. Kept as a deploy-window guard: the
    // code can reach a database that has not taken the migration yet.
    if (error.code === '23502') {
      return {
        ok: false,
        error: 'Saving “any venue” isn’t switched on yet — try again shortly.',
      };
    }
    // The DB's own CHECK, if a value slipped past the allowlist above.
    if (error.code === '23514') {
      return { ok: false, error: 'One of those choices isn’t available — reload and try again.' };
    }
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change what weddings you take.'
      : error.message;
    return { ok: false, error: friendly };
  }

  // Both the shop editor and the public profile that renders the badges.
  revalidatePath('/vendor-dashboard/shop');
  if (profile.business_slug) revalidatePath(`/v/${profile.business_slug}`);

  return { ok: true, venueSettings, ceremonyTypes };
}
