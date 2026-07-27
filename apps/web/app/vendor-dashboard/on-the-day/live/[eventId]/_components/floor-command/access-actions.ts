'use server';

/**
 * The coordinator's side of the access conversation (owner ruling 2026-07-27:
 * "coordinator will ask for access from the host; host must approve what
 * features do they want to share the vendor").
 *
 * Asking only. Nothing here can grant anything — a row in
 * `event_access_requests` confers no access at any level, and every gated
 * feature reads `moderator_area_level`, never this table. The host's answer
 * lives at /dashboard/[eventId]/access-requests.
 */

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorPoolBookings } from '@/lib/vendor-schedule';
import { normalizeRequestedAreas } from '@/lib/floor-command';
import { resolveAreaLevel, type DelegateArea, type ModeratorPermissions } from '@/lib/event-moderators';

export type AskAccessResult = { ok: boolean; error?: string; asked?: DelegateArea[] };

/** What the host has already shared with this user on this event. */
export async function fetchMyAreaGrants(
  eventId: string,
): Promise<Partial<Record<DelegateArea, 'edit' | 'view' | null>>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  // RLS scopes this to rows the caller may see; the filter keeps it to their own.
  const { data } = await supabase
    .from('event_moderators')
    .select('permissions_json, removed_at')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .is('removed_at', null)
    .maybeSingle();

  if (!data) return {};
  const perms = (data as { permissions_json: ModeratorPermissions }).permissions_json;
  // Resolve through the SAME helper the SQL gate mirrors, so the UI's idea of
  // "already held" cannot drift from what moderator_area_level() will say.
  return {
    seat_plan: resolveAreaLevel(perms, 'seat_plan'),
    schedule: resolveAreaLevel(perms, 'schedule'),
    guest_list: resolveAreaLevel(perms, 'guest_list'),
    vendors: resolveAreaLevel(perms, 'vendors'),
  };
}

/** Whether this coordinator already has an unanswered ask outstanding. */
export async function fetchMyPendingAsk(
  eventId: string,
): Promise<{ requestedAreas: DelegateArea[]; createdAt: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('event_access_requests')
    .select('requested_areas, created_at')
    .eq('event_id', eventId)
    .eq('requester_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (!data) return null;
  const row = data as { requested_areas: string[]; created_at: string };
  return { requestedAreas: row.requested_areas as DelegateArea[], createdAt: row.created_at };
}

/**
 * Send the ask. Areas are normalized server-side — junk is dropped, duplicates
 * collapse, and anything the coordinator ALREADY holds is removed, so a host is
 * never asked to re-grant what they granted last week.
 */
export async function askHostForAccess(
  eventId: string,
  rawAreas: string[],
  rawNote: string | null,
): Promise<AskAccessResult> {
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

  const held = await fetchMyAreaGrants(eventId);
  const areas = normalizeRequestedAreas(rawAreas, held);
  if (areas.length === 0) {
    return { ok: false, error: 'Pick at least one thing you need that you don’t already have.' };
  }

  const note = rawNote?.replace(/\s+/g, ' ').trim().slice(0, 240) || null;

  const { error } = await supabase.from('event_access_requests').insert({
    event_id: eventId,
    requester_user_id: user.id,
    vendor_profile_id: profile.vendor_profile_id,
    requested_areas: areas,
    note,
  });

  if (error) {
    // The partial unique index is the one collision worth naming: it means an
    // ask is already sitting with the host, not that anything went wrong.
    if (error.code === '23505') {
      return { ok: false, error: 'You already have a request waiting with the host.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/access-requests`);
  return { ok: true, asked: areas };
}
