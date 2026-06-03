'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { enqueueRelease } from '@/lib/photo-delivery-release';
import { revokeDriveToken } from '@/lib/papic-drive';

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

/* -------------------------------------------------------------------------- */
/*  Release + Disconnect (real OAuth panel wiring, 2026-05-20)                */
/* -------------------------------------------------------------------------- */

/**
 * Trigger the manual_release upload flow — enqueues a photo_delivery_jobs
 * row + flips events.photo_delivery_status='releasing'. The actual uploads
 * run via the existing batch processor (see lib/photo-delivery-release.ts).
 *
 * Safe to call only on manual_release events; the UI hides the Release
 * button in auto_sync mode. The lib function validates the event's grant
 * state and refuses to fire if Drive isn't connected.
 */
export async function releasePhotoDelivery(formData: FormData) {
  const auth = await getCoupleEventId(formData.get('event_id'));
  if (!auth.ok) redirect(auth.redirectTo);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const result = await enqueueRelease({ eventId: auth.eventId, userId: user.id });

  if (!result.ok) {
    redirect(
      `/dashboard/${auth.eventId}/add-ons/photo-delivery?release_error=${encodeURIComponent(
        result.reason.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${auth.eventId}/add-ons/photo-delivery`);
  redirect(
    `/dashboard/${auth.eventId}/add-ons/photo-delivery?release_started=1${
      result.alreadyComplete ? '&already_complete=1' : ''
    }`,
  );
}

/**
 * Disconnect Drive — revokes the OAuth token, marks the grant revoked,
 * and clears events.photo_delivery_* fields back to idle. Idempotent:
 * safe to call repeatedly even if the grant is already revoked.
 *
 * Folder created in the couple's Drive is NOT deleted — the couple owns
 * those files now. They can keep, move, or delete them themselves.
 *
 * Replicates the logic of POST /api/photo-delivery/disconnect so the panel
 * can use a server-action form post instead of a JSON fetch.
 */
export async function disconnectPhotoDelivery(formData: FormData) {
  const auth = await getCoupleEventId(formData.get('event_id'));
  if (!auth.ok) redirect(auth.redirectTo);

  const admin = createAdminClient();

  // Revoke at Google + mark grant revoked (best-effort).
  // Phase 0: revokes the single shared Drive grant (provider='drive') — see the
  // matching note in /api/photo-delivery/disconnect.
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id, refresh_token, revoked_at')
    .eq('event_id', auth.eventId)
    .eq('provider', 'drive')
    .maybeSingle();

  if (grant && !grant.revoked_at && grant.refresh_token) {
    await revokeDriveToken(grant.refresh_token as string);
    await admin
      .from('oauth_grants')
      .update({
        revoked_at: new Date().toISOString(),
        access_token: null,
        access_token_expires_at: null,
      })
      .eq('grant_id', grant.grant_id);
  }

  // Clear events.photo_delivery_* back to idle. Folder pointer wiped so a
  // re-connect produces a fresh folder rather than reusing a stale id.
  await admin
    .from('events')
    .update({
      photo_delivery_provider: null,
      photo_delivery_oauth_expires_at: null,
      photo_delivery_folder_id: null,
      photo_delivery_folder_name: null,
      photo_delivery_account_email: null,
      photo_delivery_status: 'idle',
      photo_delivery_progress_pct: 0,
      photo_delivery_started_at: null,
      photo_delivery_completed_at: null,
      photo_delivery_failed_count: 0,
      photos_released_at: null,
    })
    .eq('event_id', auth.eventId);

  revalidatePath(`/dashboard/${auth.eventId}/add-ons/photo-delivery`);
  redirect(`/dashboard/${auth.eventId}/add-ons/photo-delivery?disconnected=1`);
}
