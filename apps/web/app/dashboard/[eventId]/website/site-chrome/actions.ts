'use server';

/**
 * Server action for the Music & Video hero editor (Increment B ·
 * Wedding_Website_Lifecycle_Spec_2026-06-07 §6.2). Writes the site-chrome
 * columns from the lifecycle foundation (20260912000000):
 *   - site_bg_music_r2_key / site_bg_music_source / site_bg_music_enabled
 *   - landing_page_hero_video_r2_key
 *
 * File bytes are PUT directly to R2 by <FileUpload> via /api/upload (audio +
 * video MIME types + larger per-type caps were added there in Increment B).
 * By the time this runs the file is in R2 and the form carries the `r2://`
 * ref. Auth mirrors the hero-photo editor (event_moderators OR legacy couple
 * row). Background music plays only when BOTH enabled AND a track is set —
 * "enabled with no track" is coerced off so the player never mounts with no
 * source. Music never autoplays (the player is tap-to-start), per §6.2.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';

function r2RefOrNull(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.startsWith('r2://') ? v : null;
}

export async function updateSiteChrome(
  eventId: string,
  formData: FormData,
): Promise<void> {
  await requireHostMembership(eventId);

  // Omit-when-untouched (council §1.4 hardening): only write a column when the
  // form actually carried its control. The unconditional write nulled
  // landing_page_hero_video_r2_key / the music keys whenever a field was absent
  // — stale-tab / partial-post data loss. This editor always renders both
  // controls, so normal saves are unchanged; only a malformed post is spared.
  const update: Record<string, unknown> = {};

  if (formData.has('bg_music_url')) {
    const musicRef = r2RefOrNull(formData.get('bg_music_url'));
    // Checkbox: present only when checked. Music can't be enabled without a track.
    const enabledRequested = formData.get('bg_music_enabled') === 'on';
    update.site_bg_music_r2_key = musicRef;
    update.site_bg_music_source = musicRef ? 'upload' : null;
    update.site_bg_music_enabled = enabledRequested && Boolean(musicRef);
  }
  if (formData.has('hero_video_url')) {
    update.landing_page_hero_video_r2_key = r2RefOrNull(formData.get('hero_video_url'));
  }

  const supabase = await createClient();
  const hasWrite = Object.keys(update).length > 0;
  const { data: event, error } = hasWrite
    ? await supabase
        .from('events')
        .update(update)
        .eq('event_id', eventId)
        .select('slug')
        .maybeSingle()
    : await supabase
        .from('events')
        .select('slug')
        .eq('event_id', eventId)
        .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/site-chrome?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidateWebsiteEditor(eventId, 'site-chrome');
  revalidateGuestSite(event?.slug);
  redirect(`/dashboard/${eventId}/website/site-chrome?saved=1`);
}
