'use server';

/**
 * Couple-side server action for /dashboard/[eventId]/studio/pakanta.
 *
 * adoptPakantaSongAsSiteMusic — the one-tap "Use this song on my site" button
 * shown on the DELIVERED state. The delivered Pakanta song already auto-adopts
 * when the music team uploads it (unless the couple had set their own song), so
 * this action only matters for a couple who DID set their own song and later
 * decides to switch to the Pakanta one.
 *
 * Re-verifies membership (the dashboard layout gates the page, but actions can
 * be invoked independently) AND the active PAKANTA entitlement before writing,
 * then promotes the delivered song to the site background music.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import { eventSkuActive } from '@/lib/entitlements';

type Result = { ok: true } | { ok: false; error: string };

export async function adoptPakantaSongAsSiteMusic(eventId: string): Promise<Result> {
  try {
    const id = (eventId ?? '').trim();
    if (!id) return { ok: false, error: 'Missing event.' };

    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'You must be signed in.' };

    // Membership check via the RLS-scoped client: if this user can't read the
    // event, maybeSingle() returns null and we bail (the couple owns the row).
    const supabase = await createClient();
    const { data: membershipRow } = await supabase
      .from('events')
      .select('event_id, pakanta_song_r2_key, pakanta_song_status')
      .eq('event_id', id)
      .maybeSingle<{
        event_id: string;
        pakanta_song_r2_key: string | null;
        pakanta_song_status: string | null;
      }>();
    if (!membershipRow) return { ok: false, error: 'Event not found.' };

    const songRef = membershipRow.pakanta_song_r2_key;
    if (!songRef || membershipRow.pakanta_song_status !== 'ready') {
      return { ok: false, error: 'Your song hasn’t been delivered yet.' };
    }

    // Re-verify the active (admin-approved, bundle-aware) PAKANTA entitlement.
    const db = createAdminClient();
    const active = await eventSkuActive(db, id, 'PAKANTA');
    if (!active) return { ok: false, error: 'Pakanta isn’t active on this event.' };

    const { error: updErr } = await db
      .from('events')
      .update({
        site_bg_music_r2_key: songRef,
        site_bg_music_source: 'pakanta',
        site_bg_music_enabled: true,
        pakanta_song_adopted_as_site_music: true,
      })
      .eq('event_id', id);
    if (updErr) return { ok: false, error: updErr.message };

    revalidatePath(`/dashboard/${id}/studio/pakanta`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Could not set the song.' };
  }
}
