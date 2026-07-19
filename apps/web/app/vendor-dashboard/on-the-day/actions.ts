'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { saveDayOfOverride } from '@/lib/vendor-dayof-config';
import { resolveModules } from '@/lib/vendor-dayof-modules';

/**
 * Persist the vendor's day-of module override for one booking.
 *
 * The client sends the full set of module ids it wants ON for `eventId`. We:
 *   1. Authenticate the vendor and confirm they are actually BOOKED on the event
 *      (defence-in-depth on top of the RLS insert gate).
 *   2. Intersect the requested set with the modules AVAILABLE to the vendor's
 *      family for THIS event's booked tiles — an override can never enable a
 *      module the vendor's category doesn't offer.
 *   3. Upsert the sparse `vendor_dayof_configs` row.
 */
export async function saveDayOfModules(
  eventId: string,
  requested: string[],
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  const booking = bookings.find((b) => b.eventId === eventId);
  if (!booking) return { ok: false, error: 'You are not booked on this event.' };

  // Event-scoped tiles for this booking (best-effort — the brief RPC carries
  // booked_categories; if unavailable we fall back to the vendor's services).
  let eventTiles: string[] | null = null;
  const { data: brief } = await supabase.rpc('get_vendor_event_brief', {
    p_event_id: eventId,
  });
  if (brief && Array.isArray((brief as { booked_categories?: unknown }).booked_categories)) {
    eventTiles = (brief as { booked_categories: string[] }).booked_categories;
  }

  // Only persist ids that are genuinely available to this vendor for this event.
  const available = new Set(
    resolveModules(profile.services, eventTiles, null).map((m) => m.id),
  );
  const sanitized = requested.filter((id) => available.has(id as never));

  const res = await saveDayOfOverride(
    supabase,
    profile.vendor_profile_id,
    eventId,
    sanitized,
  );
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not save.' };

  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}

/**
 * Grant or revoke a team account's access to one event's launched day-of app
 * (launcher step 3 · per-event account grants, owner override 2026-07-16).
 *
 * Only the vendor owner/admin may manage grants (RLS enforces via
 * current_vendor_ids('admin'); we re-check the booking + membership here for a
 * friendly error). Grant = upsert an active row; revoke = soft-revoke.
 */
export async function setEventAccessGrant(
  eventId: string,
  granteeUserId: string,
  grant: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No vendor profile.' };

  const bookings = await fetchVendorPoolBookings(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) {
    return { ok: false, error: 'You are not booked on this event.' };
  }

  if (grant) {
    const { error } = await supabase.from('vendor_event_access_grants').upsert(
      {
        vendor_profile_id: profile.vendor_profile_id,
        event_id: eventId,
        grantee_user_id: granteeUserId,
        granted_by: user.id,
        revoked_at: null,
      },
      { onConflict: 'vendor_profile_id,event_id,grantee_user_id' },
    );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('vendor_event_access_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .eq('event_id', eventId)
      .eq('grantee_user_id', granteeUserId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/vendor-dashboard/on-the-day');
  return { ok: true };
}
