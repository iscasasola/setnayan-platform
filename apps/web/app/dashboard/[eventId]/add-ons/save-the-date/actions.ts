'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';
import { STD_THEME_IDS } from '@/lib/std-themes';
import { resolveRevealEffects, type RevealEffects } from '@/lib/std-reveal-effects';
import { NO_REVEAL } from '@/app/[slug]/_components/reveal/reveal-templates';
import { resolveStdBackground, type StdBackground } from '@/lib/std-backgrounds';
import { resolveStdMedia, type StdMedia } from '@/lib/std-media';
import { screenStdVideo } from '@/lib/nsfw-screen';
import { displayUrlForStoredAsset } from '@/lib/uploads';

/**
 * Server actions for the Save-the-Date builder (0024 PR4 · P4).
 *
 * chooseRevealTemplate — persists the couple's chosen opening reveal
 *   (events.std_reveal_template). The live page (RevealOverlay) now prefers this
 *   over the admin house default. Validated against the 5 REVEAL_TEMPLATE_IDS.
 *   Called programmatically from the chooser (useTransition) → returns a result
 *   instead of redirecting, so the preview stays put.
 * saveInvitationLaunchDate — persists when the full invitation goes live
 *   (events.std_invitation_launch_date), driving the film's closing beat + the
 *   second add-to-calendar VEVENT (P3). A plain form action → redirects back.
 *
 * AuthZ mirrors the sibling wax-seal actions: gate on an explicit couple
 * membership, then write through the couple's authenticated client
 * (couple_can_update_event is the DB-level enforcement).
 */

async function requireCouple(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=not-found`);
  }
  return supabase;
}

function revalidate(eventId: string) {
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/add-ons/save-the-date`);
}

function isRevealTemplateId(v: string): v is RevealTemplateId {
  return (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v);
}

export async function chooseRevealTemplate(
  eventId: string,
  templateId: string,
): Promise<{ ok: boolean }> {
  // Accept the 5 openings + 'none' (No Reveal — the free, no-opening choice).
  if (!eventId || !(templateId === NO_REVEAL || isRevealTemplateId(templateId))) {
    return { ok: false };
  }
  const supabase = await requireCouple(eventId);
  const { error } = await supabase
    .from('events')
    .update({ std_reveal_template: templateId })
    .eq('event_id', eventId);
  if (error) return { ok: false };
  revalidate(eventId);
  return { ok: true };
}

/**
 * Presign a just-uploaded Step-1 background photo (r2:// ref) → a display URL,
 * so the builder preview can show it immediately. Gated to the event's couple.
 */
export async function presignStdBackground(
  eventId: string,
  ref: string,
): Promise<{ url: string | null }> {
  if (!eventId || !ref) return { url: null };
  await requireCouple(eventId);
  const url = await displayUrlForStoredAsset(ref);
  return { url: url ?? null };
}

/**
 * saveAllStdContent — single-shot save for the live builder (2026-06-18).
 * Persists theme + invitation launch date + the four film-snapshot columns
 * (std_film_date / venue_name / venue_city / story) in one write.
 * Returns { ok: boolean } — no redirect; the builder shows an inline result.
 *
 * Snapshot fields store film-specific overrides so subsequent edits to the
 * core event (event_date, venue_name, love_story) don't change a finalized
 * film. Passing null/empty clears the override and falls back to live event
 * data on the next render.
 */
export async function saveAllStdContent(
  eventId: string,
  data: {
    theme?: string;
    launchDate?: string | null;
    filmDate?: string | null;
    filmVenueName?: string | null;
    filmVenueCity?: string | null;
    filmCeremonyName?: string | null;
    filmStory?: string | null;
    revealEffects?: RevealEffects | null;
    background?: StdBackground | null;
    media?: StdMedia | null;
    /** A newly-uploaded song r2 ref. Persists to the SINGLE-SOURCE site music
     *  (events.site_bg_music_*) — the STD film reuses the couple's site song.
     *  undefined = no change; a string = set + enable. */
    siteMusicKey?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!eventId) return { ok: false, error: 'missing-event' };
  const supabase = await requireCouple(eventId);

  const theme =
    data.theme && (STD_THEME_IDS as readonly string[]).includes(data.theme)
      ? data.theme
      : null;

  const rawDate = data.launchDate?.trim() ?? null;
  const launchDate =
    rawDate === '' || rawDate === null
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : undefined;
  if (launchDate === undefined) return { ok: false, error: 'bad-date' };

  const rawFilmDate = data.filmDate?.trim() ?? null;
  const filmDate =
    rawFilmDate === '' || rawFilmDate === null
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(rawFilmDate)
        ? rawFilmDate
        : undefined;
  if (filmDate === undefined) return { ok: false, error: 'bad-film-date' };

  const patch: Record<string, unknown> = {};
  if (theme !== null) patch.std_theme = theme;
  patch.std_invitation_launch_date = launchDate;
  if (data.filmDate !== undefined) patch.std_film_date = filmDate;
  if (data.filmVenueName !== undefined) patch.std_film_venue_name = data.filmVenueName?.trim() || null;
  if (data.filmVenueCity !== undefined) patch.std_film_venue_city = data.filmVenueCity?.trim() || null;
  if (data.filmCeremonyName !== undefined) patch.std_film_ceremony_name = data.filmCeremonyName?.trim() || null;
  if (data.filmStory !== undefined) patch.std_film_story = data.filmStory?.trim() || null;
  // Reveal effect toggles — sanitised to {butterflies,petals} booleans.
  if (data.revealEffects !== undefined && data.revealEffects !== null) {
    patch.std_reveal_effects = resolveRevealEffects(data.revealEffects);
  }
  // Step-1 background choice — validated to {kind, value}.
  if (data.background !== undefined && data.background !== null) {
    patch.std_background = resolveStdBackground(data.background);
  }
  // Step-3 media choice — validated to {type, videoKey?, posterKey?, nsfw?}.
  //
  // SECURITY: the NSFW verdict is set by the SERVER-SIDE screen only — never
  // trusted from the client (otherwise a couple could POST nsfw:'approved' and
  // bypass the platform lock). So a new/changed video is forced to 'pending';
  // an UNCHANGED video keeps the server's existing verdict. The poster frame
  // (the screening proxy) is taken from the upload, falling back to the saved
  // one for an unchanged video.
  let screenAfterSave: { videoKey: string; posterR2Key: string } | null = null;
  if (data.media !== undefined && data.media !== null) {
    const incoming = resolveStdMedia(data.media);
    if (incoming.type === 'video' && incoming.videoKey) {
      const { data: cur } = await supabase
        .from('events')
        .select('std_media')
        .eq('event_id', eventId)
        .maybeSingle();
      const current = resolveStdMedia((cur as Record<string, unknown> | null)?.std_media);
      const sameVideo =
        current.type === 'video' && current.videoKey === incoming.videoKey;
      const nsfw = sameVideo ? (current.nsfw ?? 'pending') : 'pending';
      const posterKey =
        incoming.posterKey ?? (sameVideo ? (current.posterKey ?? null) : null);
      patch.std_media = {
        type: 'video',
        videoKey: incoming.videoKey,
        posterKey,
        nsfw,
      };
      if (nsfw === 'pending' && posterKey) {
        screenAfterSave = { videoKey: incoming.videoKey, posterR2Key: posterKey };
      }
    } else {
      patch.std_media = { type: 'gallery' };
    }
  }

  // Step-4 Music — a newly-uploaded song. SINGLE-SOURCE: the STD film reuses the
  // couple's site song, so this writes events.site_bg_music_* (the same column
  // the film + Event/RSVP paths read). Uploading a song enables it; removal /
  // disable stays on the dedicated site-chrome surface (we never clobber here).
  if (typeof data.siteMusicKey === 'string' && data.siteMusicKey.trim()) {
    patch.site_bg_music_r2_key = data.siteMusicKey.trim();
    patch.site_bg_music_enabled = true;
  }

  const { error } = await supabase.from('events').update(patch).eq('event_id', eventId);
  if (error) return { ok: false, error: 'db-error' };

  // Backfill the canonical wedding date from the Save-the-Date date when the
  // event has none yet. The public page's lifecycle phase reads
  // events.event_date (NOT std_film_date) to decide whether to show the film —
  // so without this, a couple who only sets the date here would never see their
  // Save-the-Date appear (it'd sit in the RSVP phase). Guarded to event_date IS
  // NULL so an existing wedding date is never clobbered; std_film_date stays the
  // display-only override on top.
  if (filmDate) {
    await supabase
      .from('events')
      .update({ event_date: filmDate })
      .eq('event_id', eventId)
      .is('event_date', null);
  }

  // Screen the uploaded video by its poster frame (background, fail-open). Only
  // an 'approved' verdict ever lets the video play on the public page.
  if (screenAfterSave) {
    const { videoKey, posterR2Key } = screenAfterSave;
    after(() => screenStdVideo({ eventId, videoKey, posterR2Key }).catch(() => {}));
  }

  revalidate(eventId);
  return { ok: true };
}

export async function saveInvitationLaunchDate(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const raw = String(formData.get('launch_date') ?? '').trim();
  // Empty clears the date; otherwise require a YYYY-MM-DD calendar date.
  const value = raw === '' ? null : raw;
  if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=bad-date#touches`);
  }

  const { error } = await supabase
    .from('events')
    .update({ std_invitation_launch_date: value })
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=save#touches`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/add-ons/save-the-date?std=saved#touches`);
}

export async function saveStdContent(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  // Writes to the STD-specific snapshot columns (std_film_*), NOT the live
  // event columns (event_date / venue_name / etc.). This decouples the film
  // content from subsequent event edits — the snapshot is the source of truth
  // for the film once finalized. See migration 20270122000000.
  const updates: Record<string, unknown> = {};

  const rawDate = String(formData.get('film_date') ?? '').trim();
  if (rawDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=bad-date#content`);
    }
    updates.std_film_date = rawDate;
  }

  const venueName = String(formData.get('film_venue_name') ?? '').trim();
  if (venueName) updates.std_film_venue_name = venueName;

  const venueCity = String(formData.get('film_venue_city') ?? '').trim();
  if (venueCity) updates.std_film_venue_city = venueCity;

  const filmStory = String(formData.get('film_story') ?? '').trim();
  if (filmStory) updates.std_film_story = filmStory;

  if (Object.keys(updates).length === 0) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date`);
  }

  const { error } = await supabase
    .from('events')
    .update(updates)
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=save#content`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/add-ons/save-the-date?std=saved#content`);
}

export async function saveSoundtrack(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const musicRef = String(formData.get('music_r2_ref') ?? '').trim();
  if (!musicRef) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date`);
  }

  const { error } = await supabase
    .from('events')
    .update({
      site_bg_music_r2_key: musicRef,
      site_bg_music_source: 'upload',
      site_bg_music_enabled: true,
    })
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/add-ons/save-the-date?std_error=save#content`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/add-ons/save-the-date?std=saved#content`);
}
