import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS } from '@/lib/r2';
import { displayUrlForStoredAsset, encodeR2Ref } from '@/lib/uploads';
import {
  isHubMusicKey,
  isHubMusicMood,
  sortHubMusicTracks,
  type HubMusicAdminTrack,
} from '@/lib/hub-music';

/**
 * Server reads for Event Hub music (`hub_music_tracks`) — see lib/hub-music.ts
 * for the rules both sides share.
 *
 * 🔑 A FAILED READ IS NOT AN EMPTY LIST. Supabase resolves with `{ error }`
 * instead of throwing, so the read hands the error back as its own answer and
 * the page prints "couldn't read" where "no tracks yet" would have been.
 */

export type HubMusicRow = {
  track_id: string;
  public_id: string;
  title: string;
  mood: string | null;
  r2_key: string;
  duration_seconds: number | null;
  file_bytes: number | string;
  is_published: boolean;
  sort_order: number;
};

/** Every column a track row is read with — the admin list and the action's "before" both use it. */
export const HUB_MUSIC_ROW_FIELDS =
  'track_id, public_id, title, mood, r2_key, duration_seconds, file_bytes, is_published, sort_order';

/**
 * A playable address for one stored track — the same way a couple's own song
 * reaches a guest (`displayUrlForStoredAsset` over a public-bucket ref). Null
 * when it cannot be made; the row then shows no ▶ rather than a dead one.
 */
export async function hubMusicPlayUrl(key: string): Promise<string | null> {
  if (!isHubMusicKey(key)) return null;
  try {
    return await displayUrlForStoredAsset(encodeR2Ref(R2_BUCKETS.media, key));
  } catch {
    return null;
  }
}

export async function hubMusicTrackFromRow(row: HubMusicRow): Promise<HubMusicAdminTrack> {
  return {
    trackId: row.track_id,
    publicId: row.public_id,
    title: row.title,
    mood: isHubMusicMood(row.mood) ? row.mood : null,
    durationSeconds: row.duration_seconds,
    fileBytes: Number(row.file_bytes),
    isPublished: row.is_published === true,
    sortOrder: row.sort_order,
    previewUrl: await hubMusicPlayUrl(row.r2_key),
  };
}

export type HubMusicAdminRead =
  | { ok: true; tracks: HubMusicAdminTrack[] }
  | { ok: false; error: { message?: string } };

/** Every track, published or not, for /admin/hub-music. Service role: call only behind `requireAdmin()`. */
export async function fetchHubMusicForAdmin(): Promise<HubMusicAdminRead> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from('hub_music_tracks').select(HUB_MUSIC_ROW_FIELDS);
    if (error) return { ok: false, error };
    if (!data) return { ok: false, error: { message: 'The read returned nothing at all.' } };
    const tracks = await Promise.all((data as HubMusicRow[]).map(hubMusicTrackFromRow));
    return { ok: true, tracks: sortHubMusicTracks(tracks) };
  } catch (e) {
    return { ok: false, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}
