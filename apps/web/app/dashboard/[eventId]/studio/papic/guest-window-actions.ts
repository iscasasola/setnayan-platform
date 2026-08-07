'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The host opens guest cameras before the event day — or closes them again.
 *
 * Owner, 2026-08-07: *"The guests can have the option to use the app on the exact
 * event or when the host allows it"* and *"there should be a button for the host
 * of the event to allow guests to use the papic."*
 *
 * OFF (default) — guests shoot on the event day only.
 * ON            — guests shoot for the event's whole Papic capture window.
 *
 * ── WHY SERVICE-ROLE, AND WHY THAT IS SAFE ──────────────────────────────────
 * `events` UPDATE is column-privileged and its RLS is ROW-level, so any column
 * the `authenticated` role can write is writable by anyone who can update the
 * row at all. This column is therefore withheld (see migration
 * 20271121501756) and the write goes through the admin client — AFTER the
 * membership check below, which is what actually authorises it. Same shape as
 * setCoupleFaceTaggingDeclined and the livestream audience switch.
 *
 * ⚠ THE BUTTON IS NOT THE GATE. Turning this on only widens WHEN; it cannot
 * conjure guest cameras for an event that has no Papic pass. `guestCaptureGate`
 * decides when, `eventPapicGuestActive` decides whether, and the upload route
 * runs both.
 */
export async function setPapicGuestCaptureEarly(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  const early = String(formData.get('early') ?? '') === '1';
  const back = `/dashboard/${eventId}/studio/papic`;
  if (!eventId) redirect('/dashboard');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);

  // THE AUTHORISATION. Only a `couple` member of this event decides this — it
  // governs when other people's phones may shoot into their gallery. Read with
  // the caller's own client so RLS applies to the check itself.
  const { data: membership } = await supabase
    .from('event_members')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();

  if (!membership) redirect(back);

  const { error } = await createAdminClient()
    .from('events')
    .update({ papic_guest_capture_early: early })
    .eq('event_id', eventId);

  // ⚠ Supabase RESOLVES with { error } — it does not throw. Without this check a
  // failed write would redirect to the success state and the host would believe
  // they had opened the cameras.
  if (error) redirect(`${back}?guestCameras=error`);

  revalidatePath(back);
  redirect(`${back}?guestCameras=${early ? 'early' : 'eventday'}`);
}
