'use server';

import { papicCardHref, papicSeatBack, withQuery, hrefPath } from '@/lib/papic-home-href';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { refuseLimitedHelper } from '@/lib/host-gate';
import { forgetDraftedEventColumn } from '@/lib/hub-draft-store';
import { revalidateGuestSite } from '@/lib/revalidate-site';

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
 *
 * ⚡ THE CARD'S DROPDOWN IS LIVE — NO APPLY (owner 2026-11-22, specs DECISION_LOG "THE PAPIC DROPDOWN IN MEMORIES IS LIVE
 * — NO APPLY"). The Memories dropdown (Off · On — event day · On — everyone, now) sends `papic_on` here too, folded in
 * because the server-action budget is at its ceiling: BOTH columns go in one live write, behind the same couple check.
 * A `papic_on` still waiting in the Event Hub draft is then cleared (`forgetDraftedEventColumn`), so a later Apply
 * cannot put the older answer back. Off sends `papic_on` alone — the early column is left as it is. A call with no
 * `papic_on` is the early switch exactly as before.
 */
export async function setPapicGuestCaptureEarly(formData: FormData): Promise<void> {
  await refuseLimitedHelper(formData.get('event_id'), 'photos');
  const eventId = String(formData.get('event_id') ?? '').trim();
  const early = String(formData.get('early') ?? '') === '1';
  // `papic_on` — only the card's dropdown sends it ('1' / '0'); anything else is "not sent".
  const papicOnRaw = formData.get('papic_on');
  const papicOn = papicOnRaw === '1' ? true : papicOnRaw === '0' ? false : null;
  // With `papic_on` sent, the early column is written only when it was sent too (Off never touches it).
  const writeEarly = papicOn === null || formData.has('early');
  // 🖼 Saved inside the Papic card (`return_to=memories`, its seat since 2026-11-08; `home` = Today, kept) → back there;
  // a fixed word, never a URL from the form (`papicSeatBack`).
  const back = papicSeatBack(eventId, formData.get('return_to')) ?? papicCardHref(eventId);
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

  const admin = createAdminClient();
  const { data: written, error } = await admin
    .from('events')
    .update({
      ...(writeEarly ? { papic_guest_capture_early: early } : {}),
      ...(papicOn !== null ? { papic_on: papicOn } : {}),
    })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  // ⚠ Supabase RESOLVES with { error } — it does not throw. Without this check a
  // failed write would redirect to the success state and the host would believe
  // they had opened the cameras.
  // A failure lands on the Papic page, where its banner is read — never a silent return to Home.
  if (error) redirect(papicCardHref(eventId, `guestCameras=error`));
  // An update that matched no row wrote nothing — that is a refusal too, never a "saved".
  if (!written) redirect(papicCardHref(eventId, `guestCameras=error`));

  if (papicOn !== null) {
    // The live pick supersedes the same fact drafted earlier (Event Details › Photos from guests) — best-effort, logged.
    await forgetDraftedEventColumn(supabase, eventId, 'papic_on');
  }
  // Memories (the card's seat), the couple's own pages that read the switch, and the Event Hub guests open.
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidateGuestSite((written as { slug?: string | null }).slug);
  revalidatePath(hrefPath(back));
  if (back === `/dashboard/${eventId}`) redirect(back);
  // The dropdown's pick carries its own words on the card — no banner (its two outcomes are the early switch's).
  if (papicOn !== null) redirect(back);
  redirect(withQuery(back, `guestCameras=${early ? 'early' : 'eventday'}`));
}
