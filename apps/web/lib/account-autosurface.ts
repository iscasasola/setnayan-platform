import type { SupabaseClient } from '@supabase/supabase-js';
import { accountAutosurfaceEnabled } from './account-autosurface-flag';
import { emitNotification } from './notification-emit';

/**
 * COUNSEL SIGN-OFF REQUIRED — the RA 10173 "you were added" notice copy.
 *
 * This is the consent-facing language a guest sees when an event is auto-attached
 * to their account. PH counsel MUST review + approve it before
 * FEATURE_ACCOUNT_AUTOSURFACE is enabled. Placeholder-factual until then; the
 * whole path is flag-gated OFF, so this never reaches a real guest.
 */
const AUTOSURFACE_NOTICE = {
  title: (eventName: string) => `You were added to ${eventName}`,
  body: 'A couple added you to their event on Setnayan. You can leave any time from your events.',
};

/**
 * Account auto-surface (#7b) — FLAG-GATED, ships OFF (counsel-blocked, RA 10173).
 *
 * When enabled, a guest whose person resolves to an already-claimed Setnayan
 * account gets the event surfaced into that account's picker WITHOUT waiting for
 * them to accept (owner: "sent whether they accept or not"). The guest opts out
 * by saying NO — declining (DB trigger `hide_autosurfaced_on_decline`) or leaving
 * (`leaveAutoSurfacedEvent`), both of which set `event_members.hidden_at`, which
 * the picker filters.
 *
 * Best-effort — never blocks the guest add. No-op while the flag is off, so no
 * `auto_surfaced` rows ever exist in production until counsel clears the flag.
 *
 * Requires an admin (service-role) client: it reads across the person spine and
 * writes an event_members row for ANOTHER user's account, which no RLS caller
 * could do.
 */
export async function maybeAutoSurfaceEventForGuest(
  admin: SupabaseClient,
  eventId: string,
  guestId: string,
): Promise<void> {
  if (!accountAutosurfaceEnabled()) return;
  try {
    const { data: g } = await admin
      .from('guests')
      .select('person_id')
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (!g?.person_id) return;

    const { data: person } = await admin
      .from('people')
      .select('claimed_by_user_id')
      .eq('person_id', g.person_id)
      .maybeSingle();
    const userId = person?.claimed_by_user_id as string | null | undefined;
    if (!userId) return; // unclaimed person → no account to surface to

    // Only surface + notify when the account is NOT already a member — so a
    // couple/guest membership is never touched, and we don't re-notify on every
    // subsequent guest add for the same person.
    const { data: existing } = await admin
      .from('event_members')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existing) return;

    const { error: insErr } = await admin.from('event_members').insert({
      event_id: eventId,
      user_id: userId,
      member_type: 'guest',
      auto_surfaced: true,
    });
    // A race (the same (event_id,user_id) inserted concurrently) trips the UNIQUE
    // constraint → treat as already-surfaced, don't notify.
    if (insErr) return;

    // RA 10173 notice (gap G6) — counsel-approved copy (AUTOSURFACE_NOTICE).
    // Best-effort; a failed notice must not undo the surfacing above.
    const { data: ev } = await admin
      .from('events')
      .select('display_name')
      .eq('event_id', eventId)
      .maybeSingle();
    const eventName = (ev?.display_name as string | null) || 'an event';
    await emitNotification({
      userId,
      type: 'event_auto_surfaced',
      title: AUTOSURFACE_NOTICE.title(eventName),
      body: AUTOSURFACE_NOTICE.body,
      relatedUrl: `/dashboard/${eventId}`,
    });
  } catch (err) {
    console.error('maybeAutoSurfaceEventForGuest failed', eventId, guestId, err);
  }
}
