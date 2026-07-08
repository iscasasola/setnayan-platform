import type { SupabaseClient } from '@supabase/supabase-js';
import { accountAutosurfaceEnabled } from './account-autosurface-flag';

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

    // Insert the guest membership; ON CONFLICT keeps any existing (couple / guest)
    // membership untouched — this only ADDS a surfaced row for a not-yet-member
    // account. `auto_surfaced` marks it for the picker + the opt-out paths.
    await admin.from('event_members').upsert(
      { event_id: eventId, user_id: userId, member_type: 'guest', auto_surfaced: true },
      { onConflict: 'event_id,user_id', ignoreDuplicates: true },
    );

    // TODO(counsel): fire the RA 10173 "you were added to {couple}'s event" in-app
    // notice + one-tap Leave here once counsel signs off the copy + a notification
    // type. The membership already surfaces the event card; the notice is the
    // consent-UX layer and is deliberately not shipped until the flag is cleared.
  } catch (err) {
    console.error('maybeAutoSurfaceEventForGuest failed', eventId, guestId, err);
  }
}
