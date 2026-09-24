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
import { parseClientRef, eventMediaPolicy } from '@/lib/r2-client-ref';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembership } from '@/lib/host-gate';
import { refChange } from '@/lib/hub-look-pro';
import { lookProAllows } from '@/lib/hub-look-gate';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';
import { resolveReturnTo } from '@/lib/editor-return';

/**
 * 🔴 SEC-1: a client-supplied ref, pinned to THIS event's own media folder.
 *
 * The `startsWith('r2://')` check this replaces was the only validation, and both
 * columns it feeds are served to the PUBLIC guest site:
 * `[slug]/_lib/loaders.ts:294` signs `site_bg_music_r2_key` through
 * `displayUrlForStoredAsset`, and `lib/showcase-db.ts` resolves the hero video for
 * the public showcase. `displayUrlForStoredAsset` signs ANY bucket with no tenancy
 * check (its own header says so), so a crafted post could point a wedding's
 * background music or hero video at
 * `r2://setnayan-vendor-verification/vendors/X/verification/dti.pdf` and the
 * couple's public site would serve a signed URL to another vendor's government ID.
 *
 * `eventMediaPolicy` already existed for exactly this shape and was simply never
 * applied here — the same half-wired pattern as the RSVP selfie (#3911). A ref
 * that fails is treated as ABSENT, which the caller already handles as "no track /
 * no video" rather than an error.
 */
function r2RefOrNull(
  v: FormDataEntryValue | null,
  eventId: string,
): string | null {
  if (typeof v !== 'string') return null;
  return parseClientRef(v, eventMediaPolicy(eventId)) ? v : null;
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
  const supabase = await createClient();
  const update: Record<string, unknown> = {};

  /* ── THE LOOK IS PRO (owner 2026-09-24, "A" · "Free is the page we write. Pro
     is changing how it looks.") ────────────────────────────────────────────────
     Both controls here are the couple's own media on the page: a song, and a
     video where our hero sits. So both ask `lookProAllows` with what the write
     would DO to what is stored (`refChange`):
       • a free couple who already has a song or a video KEEPS it, may switch the
         song on or off, and may take either off — 'none' / 'remove', never gated;
       • adding one, or replacing one with a different file, is Pro.
     ⚠ THIS TIGHTENS THE 2026-07-24 GRANDFATHER, which let a couple with a song
     REPLACE it freely, and it ends "the video hero is free". Both are the owner's
     2026-09-24 ruling applied, not a new rule: a different file is a new look.
     A refused field is simply NOT WRITTEN; if anything was refused the couple is
     sent to the one Pro page rather than told "saved". */
  const { data: stored } = await supabase
    .from('events')
    .select('site_bg_music_r2_key, landing_page_hero_video_r2_key')
    .eq('event_id', eventId)
    .maybeSingle();
  let refused = false;

  if (formData.has('bg_music_url')) {
    const musicRef = r2RefOrNull(formData.get('bg_music_url'), eventId);
    // Checkbox: present only when checked. Music can't be enabled without a track.
    const enabledRequested = formData.get('bg_music_enabled') === 'on';
    const musicChange = refChange(stored?.site_bg_music_r2_key as string | null | undefined, musicRef);
    if (await lookProAllows(eventId, musicChange)) {
      update.site_bg_music_r2_key = musicRef;
      update.site_bg_music_source = musicRef ? 'upload' : null;
      update.site_bg_music_enabled = enabledRequested && Boolean(musicRef);
    } else {
      refused = true;
    }
  }
  if (formData.has('hero_video_url')) {
    const videoRef = r2RefOrNull(
      formData.get('hero_video_url'),
      eventId,
    );
    const videoChange = refChange(
      stored?.landing_page_hero_video_r2_key as string | null | undefined,
      videoRef,
    );
    if (await lookProAllows(eventId, videoChange)) {
      update.landing_page_hero_video_r2_key = videoRef;
    } else {
      refused = true;
    }
  }

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
  // Anything a free couple may keep was saved above; what needed Pro was not.
  if (refused) redirect(`/dashboard/${eventId}/studio/website-pro`);
  redirect(
    resolveReturnTo(formData, `/dashboard/${eventId}/website/site-chrome?saved=1`, '?saved=1'),
  );
}
