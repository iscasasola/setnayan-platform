'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Iteration 0012 Papic — storage-target server actions.
//
// Server actions for the storage-choice radio cards on the Papic setup
// page. The two actions share most of their logic; they're split so the
// form posts read cleanly ("setPapicStorageR2" / "setPapicStorageDrive")
// instead of relying on a hidden "target" field.
//
// Both actions:
//   1. Verify caller is signed in and a couple on the target event.
//   2. Refuse to switch to google_drive_only without an active
//      oauth_grants row (provider='drive', revoked_at IS NULL). The
//      Connect-Drive flow handles that upsert; switching to Drive before
//      connecting would leave the capture pipeline in a broken state.
//   3. Update events.papic_storage_target via the admin client (events
//      writes are RLS-gated; admin client bypasses the gate after the
//      app-level couple check above).
//   4. Revalidate the Papic setup page so the radio reflects the new
//      state on the next render.

async function getCoupleEventId(rawEventId: FormDataEntryValue | null): Promise<{
  ok: true;
  eventId: string;
} | { ok: false; redirectTo: string }> {
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
      redirectTo: `/dashboard/${eventId}/add-ons/papic?storage_error=not_a_couple`,
    };
  }

  return { ok: true, eventId };
}

/**
 * Switch Papic photo storage to Setnayan R2 (the default, recommended).
 * Always safe to call — no Drive grant is required.
 */
export async function setPapicStorageR2(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ papic_storage_target: 'setnayan_r2' })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/add-ons/papic?storage_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/add-ons/papic`);
  redirect(`/dashboard/${eventId}/add-ons/papic?storage_set=r2`);
}

/**
 * Switch Papic photo storage to Google Drive only. Requires an active
 * oauth_grants row for the event (provider='drive', revoked_at IS NULL).
 * Refuses the switch otherwise — the UI gates the button on connection
 * state, but the server checks again so a stale form submission can't
 * leave the capture pipeline pointed at a phantom Drive grant.
 */
export async function setPapicStorageDrive(formData: FormData) {
  const result = await getCoupleEventId(formData.get('event_id'));
  if (!result.ok) {
    redirect(result.redirectTo);
  }
  const { eventId } = result;

  const admin = createAdminClient();

  // Defensive re-check: only flip the target if the couple has actually
  // connected their Drive. The page hides the button when there's no
  // grant, but the server checks again so a stale form submission can't
  // leave the capture pipeline pointed at a phantom grant.
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id')
    .eq('event_id', eventId)
    .eq('provider', 'drive')
    .is('revoked_at', null)
    .maybeSingle();
  if (!grant) {
    redirect(
      `/dashboard/${eventId}/add-ons/papic?storage_error=connect_drive_first`,
    );
  }

  const { error } = await admin
    .from('events')
    .update({ papic_storage_target: 'google_drive_only' })
    .eq('event_id', eventId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/add-ons/papic?storage_error=${encodeURIComponent(
        error.message.slice(0, 64),
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/add-ons/papic`);
  redirect(`/dashboard/${eventId}/add-ons/papic?storage_set=drive`);
}
