/**
 * lib/guest-stories.ts — the FREE Guest Stories tier.
 *
 * A guest's tagged Papic photos → a 30s, 9:16 auto-reel rendered ENTIRELY
 * CLIENT-SIDE (no server render pipeline; that decision is still pending and
 * isn't needed for this). This module is the server-side READ that assembles a
 * render plan the browser's render engine (lib/reel-render.ts) consumes:
 *
 *   • the guest's tagged, clean-screened photos as presigned GET URLs
 *     (the same photo_tags pipeline the day-of gallery uses — Papic's
 *     untagged-still-delivered + max-10-tags guarantees are upstream and
 *     untouched here; we only READ what's already tagged + clean),
 *   • a Stories template (the beat-aware 30s manifest from stories-templates.ts),
 *   • a Setnayan-owned music track (source_url + beat_grid) — owned catalogue
 *     ONLY, never major-label; NULL source_url → the reel renders silent.
 *
 * FREE TIER — no entitlement gate, no price; nothing here charges anything.
 *
 * SAFETY: admin-client reads are scoped by the caller's verified guest (the
 * caller resolves guest_id from the qr_token capability before calling). Only
 * `moderation_state = 'clean'` photos that aren't FaceBlock-withheld are shown,
 * and clips are excluded — Stories are PHOTO-driven. Presigned 1h GET URLs.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { assembleStoryPhotoSet } from '@/lib/guest-stories-photo-set';
import {
  STORIES_TEMPLATES,
  STORY_MAX_PHOTOS,
  STORY_MIN_PHOTOS,
  DEFAULT_STORY_TEMPLATE,
  findStoriesTemplate,
  type BeatGrid,
} from '@/lib/stories-templates';

// Re-export the client-safe constants (defined in the pure stories-templates
// module) so existing server-side imports keep resolving from here too.
export { STORY_MIN_PHOTOS, STORY_MAX_PHOTOS, DEFAULT_STORY_TEMPLATE };

const URL_TTL_SECONDS = 60 * 60;

export type StoryPhoto = {
  id: string;
  url: string;
  /** Normalized (0..1) dominant-face center for Tier-2 auto-reframe; null →
   *  the render uses its centered default focal. Guest captures only (seat
   *  photos don't carry it yet). */
  subjectCenter?: { x: number; y: number } | null;
};

export type StoryMusic = {
  trackSlug: string;
  displayName: string;
  /** Presigned/owned source URL, or NULL when the master isn't ingested yet. */
  url: string | null;
  /** Beat grid for beat-aware cuts; NULL → renderer falls back to even split. */
  beatGrid: BeatGrid | null;
};

export type StoryTemplateSummary = {
  slug: string;
  name: string;
  palette: [string, string, string, string];
  beatsPerCut: number;
  durationSec: number;
};

export type GuestStoryPlan = {
  /** How many clean tagged photos the guest has in total. */
  taggedPhotoCount: number;
  /** Whether the guest clears STORY_MIN_PHOTOS. */
  canRender: boolean;
  /** Ordered photos to feed the reel (only present when canRender). */
  photos: StoryPhoto[];
  template: StoryTemplateSummary;
  music: StoryMusic | null;
};

function templateSummary(slug: string): StoryTemplateSummary {
  const tpl = findStoriesTemplate(slug) ?? STORIES_TEMPLATES[0];
  return {
    slug: tpl.slug,
    name: tpl.name,
    palette: tpl.palette,
    beatsPerCut: tpl.beatsPerCut,
    durationSec: tpl.durationSec,
  };
}

/**
 * Read the guest's tagged, clean photos (newest tag first) as presigned URLs,
 * capped at STORY_MAX_PHOTOS. Mirrors lib/guest-live-gallery's allowlist
 * posture (clean + not FaceBlock-withheld + photos only) but returns more rows
 * and is shaped for the render engine.
 */
async function readTaggedPhotos(
  eventId: string,
  guestId: string,
): Promise<{ photos: StoryPhoto[]; total: number }> {
  const admin = createAdminClient();
  const { data: tags } = await admin
    .from('photo_tags')
    .select('source_table, source_id, created_at')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(80);
  if (!tags || tags.length === 0) return { photos: [], total: 0 };

  const photoIds = tags
    .filter((t) => t.source_table === 'papic_photos')
    .map((t) => t.source_id as string);
  const captureIds = tags
    .filter((t) => t.source_table === 'papic_guest_captures')
    .map((t) => t.source_id as string);

  const [photosRes, capturesRes] = await Promise.all([
    photoIds.length
      ? admin
          .from('papic_photos')
          .select('photo_id, r2_object_key')
          .in('photo_id', photoIds)
          .eq('moderation_state', 'clean')
          .eq('photo_type', 'photo')
          .is('hidden_at', null)
      : Promise.resolve({ data: [] as { photo_id: string; r2_object_key: string }[] }),
    captureIds.length
      ? admin
          .from('papic_guest_captures')
          .select('capture_id, r2_object_key, subject_center_x, subject_center_y')
          .in('capture_id', captureIds)
          .eq('moderation_state', 'clean')
          // Guest CLIPS (media_type='clip') are excluded — Stories are
          // PHOTO-driven (see module header). A clip's r2_object_key is an MP4,
          // and feeding it to the client-side <img> loader rejects the whole
          // render with "Could not load a tagged photo". Mirrors the
          // photo_type='photo' filter on the papic_photos query above.
          .eq('media_type', 'photo')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as {
            capture_id: string;
            r2_object_key: string;
            subject_center_x: number | null;
            subject_center_y: number | null;
          }[],
        }),
  ]);

  const keyById = new Map<string, string>();
  // Tier-2 dominant-face center per capture (guest captures only) → subjectCenter.
  const centerById = new Map<string, { x: number; y: number }>();
  for (const p of photosRes.data ?? []) keyById.set(p.photo_id, p.r2_object_key);
  for (const c of capturesRes.data ?? []) {
    keyById.set(c.capture_id, c.r2_object_key);
    if (typeof c.subject_center_x === 'number' && typeof c.subject_center_y === 'number') {
      centerById.set(c.capture_id, { x: c.subject_center_x, y: c.subject_center_y });
    }
  }

  const { ordered, total } = assembleStoryPhotoSet(
    tags.map((t) => ({ source_id: t.source_id as string })),
    keyById,
  );

  const top = ordered.slice(0, STORY_MAX_PHOTOS);
  const photos = (
    await Promise.all(
      top.map(async ({ id, key }) => {
        // Same resolver the day-of gallery uses — handles `r2://bucket/key`
        // refs and legacy URLs, presigning the media object for a CORS-safe GET.
        const url = await displayUrlForStoredAsset(key, { ttlSeconds: URL_TTL_SECONDS });
        return url ? { id, url, subjectCenter: centerById.get(id) ?? null } : null;
      }),
    )
  ).filter((p): p is StoryPhoto => Boolean(p));

  return { photos, total };
}

/**
 * INTERIM music source — the couple's delivered Pakanta song (0036).
 *
 * Mirrors the couple-side Patiktok render path
 * (app/dashboard/[eventId]/studio/patiktok/actions.ts): when
 * `events.pakanta_song_r2_key` is non-null the couple owns a delivered, paid
 * Pakanta song, and that song is the backing track for every Setnayan render at
 * their wedding — guest Stories included. Tried FIRST so guest reels have sound
 * the moment a couple owns a Pakanta song, even before the owned reel-music
 * catalogue masters are ingested. Presigns the `r2://` ref (or passes a legacy
 * URL through verbatim). No `beat_grid` → the renderer uses its even-split
 * fallback (still a clean reel, just not beat-snapped). Graceful-degrade on a
 * missing column/table (42703/42P01 → "no Pakanta song"); never blocks a Story.
 */
async function pickPakantaSong(eventId: string): Promise<StoryMusic | null> {
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from('events')
      .select('pakanta_song_r2_key, pakanta_song_filename')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) {
      // 42703 = undefined_column, 42P01 = undefined_table — treat as "no song".
      if (error.code === '42703' || error.code === '42P01') return null;
      return null;
    }
    const songKey = (data?.pakanta_song_r2_key as string | null) ?? null;
    if (!songKey) return null;
    // displayUrlForStoredAsset handles both `r2://bucket/key` refs and legacy
    // URLs, and returns null when storage can't presign — fall back to the
    // owned catalogue in that case.
    const url = await displayUrlForStoredAsset(songKey);
    if (!url) return null;
    return {
      trackSlug: 'pakanta',
      displayName:
        (data?.pakanta_song_filename as string | null) ?? 'Your Pakanta song',
      url,
      beatGrid: null,
    };
  } catch {
    return null; // music trouble must never block a free Story
  }
}

/**
 * Pick the music for a Story: the first ACTIVE Setnayan-owned catalogue track
 * (owned catalogue only — never major-label). Returns its presigned/owned
 * `source_url` (NULL when the master isn't ingested → silent render) and its
 * `beat_grid` (NULL → even-split fallback in the renderer). Defensive against a
 * missing `beat_grid` column (graceful-degrade to no grid).
 *
 * `source_url` is presigned through `displayUrlForStoredAsset`, so a catalogue
 * row may store either an `r2://bucket/key` ref (the convention written by
 * scripts/ingest-owned-music.mjs) or a legacy plain URL (passed through
 * verbatim). The browser always receives a fetchable URL.
 */
async function pickMusic(): Promise<StoryMusic | null> {
  const admin = createAdminClient();
  // Presign a stored `source_url` (r2:// ref → signed GET; plain URL verbatim).
  const resolveUrl = async (ref: string | null): Promise<string | null> =>
    ref ? await displayUrlForStoredAsset(ref) : null;
  try {
    const { data, error } = await admin
      .from('reel_music_tracks')
      .select('track_slug, display_name, source_url, beat_grid')
      .eq('is_active', true)
      .eq('is_premium', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      // 42703 = missing beat_grid column on an older DB — retry without it.
      if (error?.code === '42703') {
        const { data: bare } = await admin
          .from('reel_music_tracks')
          .select('track_slug, display_name, source_url')
          .eq('is_active', true)
          .eq('is_premium', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!bare) return null;
        return {
          trackSlug: bare.track_slug as string,
          displayName: bare.display_name as string,
          url: await resolveUrl((bare.source_url as string | null) ?? null),
          beatGrid: null,
        };
      }
      return null;
    }
    return {
      trackSlug: data.track_slug as string,
      displayName: data.display_name as string,
      url: await resolveUrl((data.source_url as string | null) ?? null),
      beatGrid: (data.beat_grid as BeatGrid | null) ?? null,
    };
  } catch {
    return null; // music trouble must never block a free Story
  }
}

/**
 * Assemble the full render plan for a guest's Story. The caller MUST have
 * already verified the (eventId, guestId) pair from the guest's qr_token
 * capability. Never throws — returns a `canRender:false` plan on any read
 * trouble so the surface degrades to "not enough photos yet".
 */
export async function buildGuestStoryPlan(
  eventId: string,
  guestId: string,
): Promise<GuestStoryPlan> {
  const template = templateSummary(DEFAULT_STORY_TEMPLATE);
  try {
    const { photos, total } = await readTaggedPhotos(eventId, guestId);
    const canRender = photos.length >= STORY_MIN_PHOTOS;
    // INTERIM → owned-catalogue priority: the couple's Pakanta song first (so
    // guest reels have sound today), else the first owned reel-music master.
    // Both are Setnayan-owned (no major-label); NULL on both → silent render.
    const music = canRender
      ? ((await pickPakantaSong(eventId)) ?? (await pickMusic()))
      : null;
    return {
      taggedPhotoCount: total,
      canRender,
      photos: canRender ? photos : [],
      template,
      music,
    };
  } catch {
    return {
      taggedPhotoCount: 0,
      canRender: false,
      photos: [],
      template,
      music: null,
    };
  }
}
