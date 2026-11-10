'use server';

/**
 * The coordinator's side of the access conversation (owner ruling 2026-07-27:
 * "coordinator will ask for access from the host; host must approve what
 * features do they want to share the vendor").
 *
 * Asking only — ONE export, the ask. Nothing here can grant anything — a row in
 * `event_access_requests` confers no access at any level, and every gated
 * feature reads `moderator_area_level`, never this table. The host's answer
 * lives at /dashboard/[eventId]/access-requests.
 */

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { postThreadSystemLine } from '@/lib/chat-system-line.server';
import { accessAskedLine } from '@/lib/chat-gap-lines';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { normalizeRequestedAreas } from '@/lib/floor-command';
import type { DelegateArea } from '@/lib/event-moderators';
// The two READS live in a server-only module, not here: every export of a 'use server' file is a route, and the
// repo's server-action budget sits at its ceiling (`scripts/lint-server-action-budget.mjs`). Server components call
// them directly; this file keeps the one thing a browser presses — the ask.
import { fetchMyAreaGrants } from '@/lib/my-area-grants.server';
import { eventFeeBlocksAction } from '@/lib/vendor-event-fee-access.server';

export type AskAccessResult = { ok: boolean; error?: string; asked?: DelegateArea[] };

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
  if (!profile) return { ok: false, error: 'No supplier profile.' };

  const bookings = await fetchVendorRoomEvents(supabase, profile.vendor_profile_id);
  if (!bookings.some((b) => b.eventId === eventId)) {
    return { ok: false, error: 'You are not booked on this event.' };
  }
  // The booking fee unlocks the event (owner, 2026-09-20). No-op while the
  // flag is off; a refused or missing fee read returns null (fail OPEN).
  const feeBlocked = await eventFeeBlocksAction(profile.vendor_profile_id, eventId);
  if (feeBlocked) return { ok: false, error: feeBlocked };

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
      return { ok: false, error: 'You already have a request waiting with the host or the coordinator.' };
    }
    return { ok: false, error: error.message };
  }

  // 🔗 THE CHAT SAYS SO (chat gaps, 8 Nov — the (+)'s "Ask for access" and this page's ask are the same ask). One plain
  // Setnayan line in this event × shop conversation — the part names only, never the free-text note. Best-effort: the
  // ask is already made; a missing thread just means there is no chat to tell.
  await postThreadSystemLine(createAdminClient(), {
    eventId,
    vendorProfileId: profile.vendor_profile_id,
    body: accessAskedLine({ shopName: profile.business_name ?? '', areas }),
  });

  revalidatePath(`/vendor-dashboard/on-the-day/live/${eventId}`);
  revalidatePath(`/dashboard/${eventId}/access-requests`);
  return { ok: true, asked: areas };
}
