'use server';

/**
 * Server actions for /admin/pakanta — the music-team delivery surface.
 *
 * The admin page is already gated by app/admin/layout.tsx, but server actions
 * can be invoked independently, so deliverPakantaSong re-verifies admin access
 * (hero-video pattern) AND re-verifies the event still owns an ACTIVE PAKANTA
 * entitlement before writing anything (a refunded/cancelled order must not let
 * a stale tab push a song onto a couple who no longer paid).
 *
 * THE AUTO-ADOPT (owner rule 2026-06-22): a delivered Pakanta song should play
 * on the couple's wedding site the MOMENT the music team uploads it — no manual
 * couple step. But it must NEVER clobber a couple who already chose their own
 * site song. The guard: if site_bg_music_r2_key is already set AND we never
 * adopted a Pakanta song before (pakanta_song_adopted_as_site_music = false),
 * the existing music is the couple's own → we record the delivery but leave the
 * site music untouched (the couple can still one-tap "use this song" in Studio).
 *
 * Writes use the service-role client (events RLS has no admin write policy for
 * these cols; service role bypasses RLS, matching hero-video).
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserRoleSummary } from '@/lib/roles';
import { eventSkuActive } from '@/lib/entitlements';

type Result = { ok: true; adopted: boolean } | { ok: false; error: string };

async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const roles = await fetchUserRoleSummary(supabase, user.id);
  if (!roles.hasAdminAccess) throw new Error('Admin access required.');
  return user.id;
}

export async function deliverPakantaSong(input: {
  eventId: string;
  songRef: string;
  filename: string;
}): Promise<Result> {
  try {
    await assertAdmin();

    const eventId = (input.eventId ?? '').trim();
    const songRef = (input.songRef ?? '').trim();
    const filename = (input.filename ?? '').trim() || 'pakanta-song';
    if (!eventId) return { ok: false, error: 'Missing event.' };
    if (!songRef.startsWith('r2://')) {
      return { ok: false, error: 'Upload the finished song before delivering.' };
    }

    const db = createAdminClient();

    // Re-verify the event still has an ACTIVE (admin-approved, bundle-aware)
    // PAKANTA entitlement. A relinquished order must not deliver.
    const active = await eventSkuActive(db, eventId, 'PAKANTA');
    if (!active) {
      return {
        ok: false,
        error: 'This event no longer has an approved Pakanta order.',
      };
    }

    // Read the couple's current site music to decide whether we may auto-adopt.
    // Graceful-degrade: if the new pakanta_song_* columns don't exist yet
    // (42703 / schema cache), treat as not-previously-adopted.
    let coupleHasOwnSong = false;
    const { data: ev, error: readErr } = await db
      .from('events')
      .select('site_bg_music_r2_key, pakanta_song_adopted_as_site_music')
      .eq('event_id', eventId)
      .maybeSingle<{
        site_bg_music_r2_key: string | null;
        pakanta_song_adopted_as_site_music: boolean | null;
      }>();
    if (readErr) {
      // If only the new column is missing we still know site_bg_music; but a
      // hard read failure means we can't safely auto-adopt → record delivery
      // only (never risk clobbering). Fall through with coupleHasOwnSong=true
      // so the non-destructive branch is skipped.
      coupleHasOwnSong = true;
    } else {
      coupleHasOwnSong =
        !!ev?.site_bg_music_r2_key && !ev.pakanta_song_adopted_as_site_music;
    }

    const patch: Record<string, unknown> = {
      pakanta_song_r2_key: songRef,
      pakanta_song_status: 'ready',
      pakanta_song_filename: filename,
      pakanta_song_delivered_at: new Date().toISOString(),
    };
    let adopted = false;
    if (!coupleHasOwnSong) {
      // Auto-adopt: this song becomes the site background music immediately.
      patch.site_bg_music_r2_key = songRef;
      patch.site_bg_music_source = 'pakanta';
      patch.site_bg_music_enabled = true;
      patch.pakanta_song_adopted_as_site_music = true;
      adopted = true;
    }

    const { error: updErr } = await db
      .from('events')
      .update(patch)
      .eq('event_id', eventId);
    if (updErr) return { ok: false, error: updErr.message };

    // Refresh the admin queue. The couple's public landing page is dynamic
    // (presigned music URL resolved at read time), so the BackgroundMusic
    // player picks up the adopted song on the next render with no player change.
    revalidatePath('/admin/pakanta');
    return { ok: true, adopted };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Delivery failed.' };
  }
}
