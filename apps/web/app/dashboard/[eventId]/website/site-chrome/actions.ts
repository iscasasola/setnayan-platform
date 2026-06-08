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
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function requireHostMembership(eventId: string): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: moderator } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  if (moderator) return user.id;

  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (legacy?.member_type === 'couple') return user.id;

  redirect('/dashboard');
}

function r2RefOrNull(v: FormDataEntryValue | null): string | null {
  return typeof v === 'string' && v.startsWith('r2://') ? v : null;
}

export async function updateSiteChrome(
  eventId: string,
  formData: FormData,
): Promise<void> {
  await requireHostMembership(eventId);

  const musicRef = r2RefOrNull(formData.get('bg_music_url'));
  const videoRef = r2RefOrNull(formData.get('hero_video_url'));
  // Checkbox: present only when checked. Music can't be enabled without a track.
  const enabledRequested = formData.get('bg_music_enabled') === 'on';
  const musicEnabled = enabledRequested && Boolean(musicRef);

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from('events')
    .update({
      site_bg_music_r2_key: musicRef,
      site_bg_music_source: musicRef ? 'upload' : null,
      site_bg_music_enabled: musicEnabled,
      landing_page_hero_video_r2_key: videoRef,
    })
    .eq('event_id', eventId)
    .select('slug')
    .maybeSingle();

  if (error) {
    redirect(
      `/dashboard/${eventId}/website/site-chrome?error=${encodeURIComponent(
        'Could not save. Please try again.',
      )}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/website/site-chrome`);
  revalidatePath(`/dashboard/${eventId}/website`);
  if (event?.slug) revalidatePath(`/${event.slug}`);
  redirect(`/dashboard/${eventId}/website/site-chrome?saved=1`);
}
