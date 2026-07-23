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
import { resolveStillRef } from '@/lib/papic-display-ref';
import { assembleStoryPhotoSet } from '@/lib/guest-stories-photo-set';
import {
  assembleStoryMediaSet,
  type StoryMediaEntry,
} from '@/lib/guest-stories-media-set';
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

/** Presign cap for the PICKER's pickable set (each item is 1–2 presigns). */
const STORY_PICKER_MAX = 40;

/** Cap on the catalogue tracks offered in the music chooser. */
const MUSIC_OPTIONS_MAX = 8;

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

/**
 * One pickable item for the Story PICKER — the guest's own tagged photos AND
 * clips, any mix (owner 2026-07-23; supersedes the 5 guest + 5 couple split).
 * `url` is the RENDER source: a still web copy for a photo, the geo-stripped
 * `clip_web_r2_key` web copy for a clip (clips without a web copy never appear
 * here — the raw geo-bearing original is NEVER served outbound).
 */
export type StoryMediaItem = {
  id: string;
  kind: 'photo' | 'clip';
  url: string;
  /** Still image URL for the picker grid (clip → poster/thumb); null → icon. */
  thumbUrl: string | null;
  durationSec: number | null;
  subjectCenter?: { x: number; y: number } | null;
};

export type GuestStoryPlan = {
  /** How many clean tagged photos the guest has in total. */
  taggedPhotoCount: number;
  /** Whether the guest clears STORY_MIN_PHOTOS. */
  canRender: boolean;
  /** Ordered photos to feed the reel (only present when canRender). */
  photos: StoryPhoto[];
  /**
   * The PICKABLE set (photos + clips, newest tag first, presigned) for the
   * "choose your own" flow. May be non-empty even when `canRender` is false —
   * clips can push a guest over the STORY_MIN_PHOTOS floor.
   */
  media: StoryMediaItem[];
  template: StoryTemplateSummary;
  music: StoryMusic | null;
  /**
   * The tracks the guest may choose from (Pakanta first when the event owns
   * one, then owned-catalogue tracks). Owned music ONLY — the guest's own
   * upload (BYO §16.7) never appears here because it never reaches the server.
   */
  musicOptions: StoryMusic[];
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
): Promise<{ photos: StoryPhoto[]; total: number; media: StoryMediaItem[] }> {
  const admin = createAdminClient();
  const { data: tags } = await admin
    .from('photo_tags')
    .select('source_table, source_id, created_at')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('removed_at', null)
    .order('created_at', { ascending: false })
    .limit(80);
  if (!tags || tags.length === 0) return { photos: [], total: 0, media: [] };

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
          // Derivative columns + full_res_dropped_at so resolveStillRef can prefer
          // the drop-durable, geo-stripped web copy over the raw original (which
          // 404s once the 90-day full-res sweep runs — a bug already LIVE here).
          // photo_type/poster/clip_web ride along so tagged CLIPS can join the
          // PICKER set through their geo-stripped web copy (photos-only auto
          // path is unchanged — clips are filtered out of it below).
          .select(
            'photo_id, photo_type, r2_object_key, display_r2_key, thumb_r2_key, poster_r2_key, clip_web_r2_key, full_res_dropped_at',
          )
          .in('photo_id', photoIds)
          .eq('moderation_state', 'clean')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as {
            photo_id: string;
            photo_type: string | null;
            r2_object_key: string | null;
            display_r2_key: string | null;
            thumb_r2_key: string | null;
            poster_r2_key: string | null;
            clip_web_r2_key: string | null;
            full_res_dropped_at: string | null;
          }[],
        }),
    captureIds.length
      ? admin
          .from('papic_guest_captures')
          .select(
            'capture_id, media_type, duration_ms, r2_object_key, display_r2_key, thumb_r2_key, poster_r2_key, clip_web_r2_key, full_res_dropped_at, subject_center_x, subject_center_y',
          )
          .in('capture_id', captureIds)
          .eq('moderation_state', 'clean')
          .is('hidden_at', null)
      : Promise.resolve({
          data: [] as {
            capture_id: string;
            media_type: string | null;
            duration_ms: number | null;
            r2_object_key: string | null;
            display_r2_key: string | null;
            thumb_r2_key: string | null;
            poster_r2_key: string | null;
            clip_web_r2_key: string | null;
            full_res_dropped_at: string | null;
            subject_center_x: number | null;
            subject_center_y: number | null;
          }[],
        }),
  ]);

  const keyById = new Map<string, string>();
  // Tier-2 dominant-face center per capture (guest captures only) → subjectCenter.
  const centerById = new Map<string, { x: number; y: number }>();
  // The PICKER's mixed set (photos + clips) keyed by tag source_id.
  const entryById = new Map<string, StoryMediaEntry>();
  const nonEmpty = (v: string | null | undefined): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v : null;
  // Stories are PHOTO inputs rendered onto a canvas, so each resolves to a STILL
  // image ref (thumb ?? display ?? raw). A dropped original never reaches the
  // <img> loader (resolveStillRef excludes it), so the reel no longer dies on a
  // "Could not load a tagged photo" after the full-res sweep.
  for (const p of photosRes.data ?? []) {
    if (p.photo_type === 'clip') {
      // Clip → PICKER only, and ONLY via the geo-stripped web copy. Never the
      // raw r2_object_key (geo-bearing; also 404s after the full-res drop).
      entryById.set(p.photo_id, {
        kind: 'clip',
        renderKey: nonEmpty(p.clip_web_r2_key),
        stillKey: resolveStillRef({
          photo_type: 'clip',
          thumb_r2_key: p.thumb_r2_key,
          poster_r2_key: p.poster_r2_key,
        }),
        durationSec: null, // papic_photos stores no clip duration
      });
      continue;
    }
    const ref = resolveStillRef({
      photo_type: 'photo',
      r2_object_key: p.r2_object_key,
      display_r2_key: p.display_r2_key,
      thumb_r2_key: p.thumb_r2_key,
      full_res_dropped_at: p.full_res_dropped_at,
    });
    if (ref) keyById.set(p.photo_id, ref);
    entryById.set(p.photo_id, {
      kind: 'photo',
      renderKey: ref,
      stillKey: ref,
      durationSec: null,
    });
  }
  for (const c of capturesRes.data ?? []) {
    if (c.media_type === 'clip') {
      entryById.set(c.capture_id, {
        kind: 'clip',
        renderKey: nonEmpty(c.clip_web_r2_key),
        stillKey: resolveStillRef({
          media_type: 'clip',
          thumb_r2_key: c.thumb_r2_key,
          poster_r2_key: c.poster_r2_key,
        }),
        durationSec:
          typeof c.duration_ms === 'number' && c.duration_ms > 0
            ? c.duration_ms / 1000
            : null,
      });
      continue;
    }
    const ref = resolveStillRef({
      media_type: 'photo',
      r2_object_key: c.r2_object_key,
      display_r2_key: c.display_r2_key,
      thumb_r2_key: c.thumb_r2_key,
      full_res_dropped_at: c.full_res_dropped_at,
    });
    if (ref) keyById.set(c.capture_id, ref);
    if (typeof c.subject_center_x === 'number' && typeof c.subject_center_y === 'number') {
      centerById.set(c.capture_id, { x: c.subject_center_x, y: c.subject_center_y });
    }
    entryById.set(c.capture_id, {
      kind: 'photo',
      renderKey: ref,
      stillKey: ref,
      durationSec: null,
      subjectCenter: centerById.get(c.capture_id) ?? null,
    });
  }

  const { ordered, total } = assembleStoryPhotoSet(
    tags.map((t) => ({ source_id: t.source_id as string })),
    keyById,
  );

  const top = ordered.slice(0, STORY_MAX_PHOTOS);
  const photos = (
    await Promise.all(
      top.map(async ({ id, key }): Promise<StoryPhoto | null> => {
        // Same resolver the day-of gallery uses — handles `r2://bucket/key`
        // refs and legacy URLs, presigning the media object for a CORS-safe GET.
        const url = await displayUrlForStoredAsset(key, { ttlSeconds: URL_TTL_SECONDS });
        return url ? { id, url, subjectCenter: centerById.get(id) ?? null } : null;
      }),
    )
  ).filter((p): p is StoryPhoto => Boolean(p));

  // The PICKER set: photos + web-copied clips in tag order, presigned. Clips
  // without a web copy were already dropped by the assembler (renderKey null).
  const pickable = assembleStoryMediaSet(
    tags.map((t) => ({ source_id: t.source_id as string })),
    entryById,
  ).slice(0, STORY_PICKER_MAX);
  const media = (
    await Promise.all(
      pickable.map(async (m): Promise<StoryMediaItem | null> => {
        const url = await displayUrlForStoredAsset(m.renderKey, {
          ttlSeconds: URL_TTL_SECONDS,
        });
        if (!url) return null;
        const thumbUrl =
          m.stillKey === m.renderKey
            ? url
            : m.stillKey
              ? await displayUrlForStoredAsset(m.stillKey, { ttlSeconds: URL_TTL_SECONDS })
              : null;
        return {
          id: m.id,
          kind: m.kind,
          url,
          thumbUrl,
          durationSec: m.durationSec,
          subjectCenter: m.subjectCenter ?? centerById.get(m.id) ?? null,
        };
      }),
    )
  ).filter((m): m is StoryMediaItem => Boolean(m));

  return { photos, total, media };
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
 * Owned-catalogue music picker, exported for reuse by other Setnayan-hosted
 * renders (e.g. the creator Adventure-Chapter teaser). Delegates to the exact
 * same `reel_music_tracks` query as a Guest Story — `is_active` + NOT
 * `is_premium` — so the "owned catalogue only, never major-label" guarantee is
 * one code path, not two. Deliberately does NOT reach for a couple's Pakanta
 * song (that's event-personal, not a general owned track).
 */
export async function pickOwnedReelMusic(): Promise<StoryMusic | null> {
  return pickMusic();
}

/**
 * The MUSIC CHOOSER options for a guest Story: the couple's Pakanta song first
 * (event-personal, when owned), then up to MUSIC_OPTIONS_MAX active owned
 * catalogue tracks. Owned music ONLY — never major-label; the §16.7 BYO upload
 * is client-side-only and never appears here. Defensive against a missing
 * `beat_grid` column (mirrors pickMusic); never throws — a music-read hiccup
 * degrades to an empty list, which the UI treats as "no chooser, default only".
 */
async function listMusicOptions(eventId: string): Promise<StoryMusic[]> {
  const admin = createAdminClient();
  const options: StoryMusic[] = [];
  const pakanta = await pickPakantaSong(eventId);
  if (pakanta?.url) options.push(pakanta);
  const resolveUrl = async (ref: string | null): Promise<string | null> =>
    ref ? await displayUrlForStoredAsset(ref) : null;
  try {
    let rows:
      | { track_slug: string; display_name: string; source_url: string | null; beat_grid?: unknown }[]
      | null = null;
    const { data, error } = await admin
      .from('reel_music_tracks')
      .select('track_slug, display_name, source_url, beat_grid')
      .eq('is_active', true)
      .eq('is_premium', false)
      .order('created_at', { ascending: true })
      .limit(MUSIC_OPTIONS_MAX);
    if (error) {
      if (error.code === '42703') {
        // Older DB without beat_grid — retry without the column.
        const { data: bare } = await admin
          .from('reel_music_tracks')
          .select('track_slug, display_name, source_url')
          .eq('is_active', true)
          .eq('is_premium', false)
          .order('created_at', { ascending: true })
          .limit(MUSIC_OPTIONS_MAX);
        rows = bare ?? null;
      }
    } else {
      rows = data ?? null;
    }
    for (const row of rows ?? []) {
      const url = await resolveUrl((row.source_url as string | null) ?? null);
      if (!url) continue; // un-ingested master → not offerable
      options.push({
        trackSlug: row.track_slug,
        displayName: row.display_name,
        url,
        beatGrid: ((row.beat_grid as BeatGrid | null | undefined) ?? null),
      });
    }
  } catch {
    // music trouble must never block a free Story — chooser just shrinks
  }
  return options;
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
    const { photos, total, media } = await readTaggedPhotos(eventId, guestId);
    const canRender = photos.length >= STORY_MIN_PHOTOS;
    // Any render possible (auto OR picker — clips count toward the floor)?
    const anyRenderable = canRender || media.length >= STORY_MIN_PHOTOS;
    // INTERIM → owned-catalogue priority: the couple's Pakanta song first (so
    // guest reels have sound today), else the first owned reel-music master.
    // Both are Setnayan-owned (no major-label); NULL on both → silent render.
    const music = anyRenderable
      ? ((await pickPakantaSong(eventId)) ?? (await pickMusic()))
      : null;
    const musicOptions = anyRenderable ? await listMusicOptions(eventId) : [];
    return {
      taggedPhotoCount: total,
      canRender,
      photos: canRender ? photos : [],
      media,
      template,
      music,
      musicOptions,
    };
  } catch {
    return {
      taggedPhotoCount: 0,
      canRender: false,
      photos: [],
      media: [],
      template,
      music: null,
      musicOptions: [],
    };
  }
}
