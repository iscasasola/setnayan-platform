'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Iteration 0009 Photo Delivery — sync-mode server actions.
//
// Server actions for the sync-mode radio cards on the Photo Delivery setup
// page. The two actions share most of their logic; they're split so the
// form posts read cleanly ("setPhotoDeliverySyncModeManual" /
// "setPhotoDeliverySyncModeAuto") instead of relying on a hidden mode
// field. Matches the 0012 Papic storage-action pattern.
//
// Both actions:
//   1. Verify caller is signed in and a couple on the target event.
//   2. Update events.photo_delivery_sync_mode via the admin client (events
//      writes are RLS-gated; admin client bypasses the gate after the
//      app-level couple check above).
//   3. Revalidate the Photo Delivery setup page so the radio reflects
//      the new state on the next render.
//
// Neither action requires an active Drive OAuth grant — the sync mode is
// an event-level setting independent of OAuth state, so couples can pick
// before connecting Drive.

async function getCoupleEventId(
  rawEventId: FormDataEntryValue | null,
): Promise<
  | { ok: true; eventId: string }
  | { ok: false; redirectTo: string }
> {
  const eventId = typeof rawEventId === 'string' ? rawEventId.trim() : '';
  if (!eventId) {
    return { ok: false, redirectTo: '/dashboard' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, redirectTo: '/login' };
  }

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    return {
      ok: false,
      redirectTo: `/dashboard/${eventId}/add-ons/photo-delivery?sync_mode_error=not_a_couple`,
    };
  }

  return { ok: true, eventId };
}

async function updateSyncMode(
  eventId: string,
  mode: 'manual_release' | 'auto_sync',
): Promise<{ ok: true } | { ok: false; redirectTo: string }> {
  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ photo_delivery_sync_mode: mode })
    .eq('event_id', eventId);

  if (error) {
    return {
      ok: false,
      redirectTo: `/dashboard/${eventId}/add-ons/photo-delivery?sync_mode_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    };
  }

  return { ok: true };
}

/**
 * Switch Photo Delivery sync mode to manual_release (the default — couple
 * clicks "Release to Drive" after the 7-day review window). Backward-
 * compatible — events created before the per-event mode picker default to
 * this behavior.
 */
export async function setPhotoDeliverySyncModeManual(formData: FormData) {
  const auth = await getCoupleEventId(formData.get('event_id'));
  if (!auth.ok) redirect(auth.redirectTo);

  const result = await updateSyncMode(auth.eventId, 'manual_release');
  if (!result.ok) redirect(result.redirectTo);

  revalidatePath(`/dashboard/${auth.eventId}/add-ons/photo-delivery`);
  redirect(
    `/dashboard/${auth.eventId}/add-ons/photo-delivery?sync_mode_set=manual_release`,
  );
}

/**
 * Switch Photo Delivery sync mode to auto_sync (photos stream to Drive in
 * real-time as they land in R2 throughout the event). Couples opting in
 * trade the release gate for a live archive.
 */
export async function setPhotoDeliverySyncModeAuto(formData: FormData) {
  const auth = await getCoupleEventId(formData.get('event_id'));
  if (!auth.ok) redirect(auth.redirectTo);

  const result = await updateSyncMode(auth.eventId, 'auto_sync');
  if (!result.ok) redirect(result.redirectTo);

  revalidatePath(`/dashboard/${auth.eventId}/add-ons/photo-delivery`);
  redirect(
    `/dashboard/${auth.eventId}/add-ons/photo-delivery?sync_mode_set=auto_sync`,
  );
}
