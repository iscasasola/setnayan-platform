// Creator "Adventure Chapter" — owned-music TEASER plan builder (CP-2).
//
// The teaser is a SHORT (a few-second) Setnayan-HOSTED vertical clip built from
// a chapter's own substrate photos (its Papic gallery) set to ONE
// Setnayan-owned music track, ending on a "Made with Setnayan" card. It is the
// shareable hook that pulls a creator's audience toward Setnayan — it is NOT
// the creator's full edit (that stays EMBEDDED on their own platform via
// `embed_url`; Setnayan never hosts it).
//
// This module assembles the render PLAN on the server (which photos, which
// owned track). The actual encode runs CLIENT-SIDE in the browser via
// lib/reel-render.ts (owner-locked render host: ₱0 server compute, no server
// ffmpeg/Remotion). Same shape as the Guest-Stories / Patiktok render path.
//
// OWNED MUSIC ONLY (hard line): the backing track is resolved EXCLUSIVELY from
// the Setnayan-owned `reel_music_tracks` catalogue (via pickOwnedReelMusic —
// `is_active` + NOT `is_premium`). There is NO creator-supplied / uploaded
// audio path in this render: the only audio source is this one server read, so
// no BYO audio can ever reach it.

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchTeaserFrames, type TeaserFrame } from './papic-gallery';
import { pickOwnedReelMusic } from './guest-stories';
import {
  TEASER_MAX_PHOTOS,
  TEASER_MIN_PHOTOS,
  TEASER_TARGET_SEC,
  type TeaserPlan,
  type TeaserPlanPhoto,
} from './creator-teaser-shared';

// Client-safe constants + plan types live in lib/creator-teaser-shared.ts
// (pure data — importable from client components without dragging the
// server-only readers below into the bundle). Re-exported here so server
// callers keep a single import point.
export {
  TEASER_FOOTER,
  TEASER_MAX_PHOTOS,
  TEASER_MIN_PHOTOS,
  TEASER_PALETTE,
  TEASER_TARGET_SEC,
} from './creator-teaser-shared';
export type { TeaserPlan, TeaserPlanPhoto } from './creator-teaser-shared';

/**
 * The chapter's Papic gallery is keyed by the substrate's `papic_gallery_id`
 * (the event id whose gallery seeds the teaser). Returns null when unset.
 */
export function readChapterGalleryEventId(
  substrate: Record<string, unknown> | null | undefined,
): string | null {
  if (!substrate) return null;
  const v = (substrate as { papic_gallery_id?: unknown }).papic_gallery_id;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * Build the teaser render plan for a chapter. `supabase` MUST be the caller's
 * RLS-bound client — `fetchTeaserFrames` runs under RLS, so a creator can only
 * pull frames from a Papic gallery they actually have access to (a foreign
 * event id simply returns no rows). On top of RLS, `fetchTeaserFrames` applies
 * the couple-RECAP path's PUBLIC consent gates (moderation-cleared seat photos +
 * double-consent-cleared guest photos) and hands back only geo-STRIPPED display
 * derivatives. Never throws — degrades to canRender:false.
 */
export async function buildChapterTeaserPlan(
  supabase: SupabaseClient,
  substrate: Record<string, unknown> | null | undefined,
): Promise<TeaserPlan> {
  const base = {
    photos: [] as TeaserPlanPhoto[],
    musicUrl: null,
    beatGrid: null,
    musicLabel: null,
    targetSec: TEASER_TARGET_SEC,
  };

  const eventId = readChapterGalleryEventId(substrate);
  if (!eventId) {
    return {
      ...base,
      canRender: false,
      reason:
        'Add a Papic gallery id to this chapter’s substrate first — the teaser is built from that gallery’s photos.',
    };
  }

  // CONSENT + GEO gate (fetchTeaserFrames): the teaser is a PUBLIC shareable clip,
  // so frames come back already filtered to the recap path's public gates —
  // moderation-cleared SEAT photos + double-consent-cleared GUEST photos — and each
  // url is a geo-STRIPPED display/thumb derivative (never the raw geo-bearing
  // original). Zero cleared frames → the teaser renders with none (canRender:false
  // below), and NEVER falls back to unapproved / geo-bearing guest media.
  let frames: TeaserFrame[];
  try {
    frames = await fetchTeaserFrames(supabase, eventId);
  } catch {
    frames = [];
  }

  const photos: TeaserPlanPhoto[] = frames
    .slice(0, TEASER_MAX_PHOTOS)
    .map((f) => ({ clipId: f.id, url: f.url }));

  if (photos.length < TEASER_MIN_PHOTOS) {
    return {
      ...base,
      canRender: false,
      reason: `Need at least ${TEASER_MIN_PHOTOS} showcase-approved photos in that Papic gallery to build a teaser — found ${photos.length}. (Only consent-cleared frames from galleries you have access to can be used.)`,
    };
  }

  // OWNED MUSIC ONLY — resolved exclusively from the Setnayan-owned catalogue.
  const music = await pickOwnedReelMusic();

  return {
    canRender: true,
    reason: null,
    photos,
    musicUrl: music?.url ?? null,
    beatGrid: music?.beatGrid ?? null,
    musicLabel: music?.displayName ?? null,
    targetSec: TEASER_TARGET_SEC,
  };
}
