import 'server-only';

import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS } from '@/lib/r2';
import { displayUrlForStoredAsset, encodeR2Ref } from '@/lib/uploads';
import {
  formatHubMusicLength,
  hubMusicMoodLabel,
  isHubMusicKey,
  isHubMusicMood,
  sortHubMusicTracks,
  type HubMusicAdminTrack,
} from '@/lib/hub-music';
import { hubMusicKeyFromRef, hubMusicRefForKey, type HubMusicChoice } from '@/lib/hub-music-ref';

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

// ── The couple's side — Look › Music › Our music ────────────────────────────

/** Any Supabase client. The couple's own is the point: RLS shows it published rows only. */
type Reader = { from: ReturnType<typeof createAdminClient>['from'] };

export type HubMusicChoicesRead = { ok: true; choices: HubMusicChoice[] } | { ok: false };

/** Busted by the admin's own writer (`app/admin/hub-music/actions.ts`) after every add · edit · remove. */
export const HUB_MUSIC_TAG = 'hub-music-published';

type PublishedTrackRow = Pick<HubMusicRow, 'track_id' | 'title' | 'mood' | 'r2_key' | 'duration_seconds' | 'sort_order'>;

/**
 * ⚡ THE PUBLISHED LIST IS THE SAME FOR EVERY COUPLE — SO IT IS READ ONCE, NOT ONCE PER MAKER RENDER (owner's
 * least-requests rule, 2026-10-08; controller's ruling the same night). The repo's cached-read pattern, as
 * `lib/loader-settings.ts` and `lib/brand-settings.ts` use it: `unstable_cache` under a tag, the read made with the
 * service client (no viewer in it — nothing personal can be remembered), busted by `revalidateTag` from the one
 * writer. The hour is only a backstop.
 *   · PUBLISHED ROWS ONLY — the filter is the query's own; this is the list RLS shows every signed-in person.
 *   · ROWS, NOT ADDRESSES — a row's ▶ address is worked out per render (`hubMusicPlayUrl`), never remembered.
 *   · A REFUSED READ IS NEVER REMEMBERED — it THROWS here (a thrown read is not stored), so the next render asks
 *     again; the caller turns it into "couldn't load".
 * The two GATES (`publishedHubMusicRef` at a pick, `isPublishedHubMusicRef` at Apply) are NOT cached: a gate re-reads.
 */
const loadPublishedHubMusicRows = unstable_cache(
  async (): Promise<PublishedTrackRow[]> => {
    const { data, error } = await createAdminClient()
      .from('hub_music_tracks')
      .select('track_id, title, mood, r2_key, duration_seconds, sort_order')
      .eq('is_published', true);
    if (error || !data) throw new Error(error?.message ?? 'hub_music_tracks: no answer');
    return data as PublishedTrackRow[];
  },
  ['hub-music-published-v1'],
  { tags: [HUB_MUSIC_TAG], revalidate: 3600 },
);

/**
 * The published tracks, in the list's order, for the couple's picker — from the cached list above (0 reads on a
 * Maker render, but for the first after an admin change). A refused read is `{ ok: false }` — the picker then says
 * it could not load, never "no music".
 */
export async function fetchHubMusicChoices(): Promise<HubMusicChoicesRead> {
  try {
    let data: PublishedTrackRow[];
    try {
      data = await loadPublishedHubMusicRows();
    } catch (error) {
      // The picker says "couldn't load"; the reason goes to the log so a refused read is not also a silent one.
      console.error('[supabase-error] lib/hub-music-server.ts · from:hub_music_tracks.select (fetchHubMusicChoices)', error);
      return { ok: false };
    }
    const rows = sortHubMusicTracks(
      data
        .filter((r) => isHubMusicMood(r.mood) && isHubMusicKey(r.r2_key))
        .map((r) => ({ ...r, sortOrder: r.sort_order })),
    );
    const choices = await Promise.all(
      rows.map(async (r) => ({
        trackId: r.track_id,
        ref: hubMusicRefForKey(r.r2_key),
        title: r.title,
        moodLabel: hubMusicMoodLabel(r.mood),
        length: formatHubMusicLength(r.duration_seconds),
        previewUrl: await hubMusicPlayUrl(r.r2_key),
      })),
    );
    return { ok: true, choices };
  } catch {
    return { ok: false };
  }
}

/**
 * The stored reference for ONE published track, by its id — what a pick posts.
 * `null` when there is no such published track OR the read was refused: either
 * way the pick is not written (the song already in place is left alone).
 */
export async function publishedHubMusicRef(supabase: Reader, trackId: unknown): Promise<string | null> {
  if (typeof trackId !== 'string' || !/^[0-9a-f-]{36}$/i.test(trackId)) return null;
  try {
    const { data, error } = await supabase
      .from('hub_music_tracks')
      .select('r2_key')
      .eq('track_id', trackId)
      .eq('is_published', true)
      .maybeSingle();
    // Fails closed (no song is written) — and says why, where someone can read it.
    if (error) console.error('[supabase-error] lib/hub-music-server.ts · from:hub_music_tracks.select (publishedHubMusicRef)', error);
    const key = error ? null : ((data as { r2_key: string } | null)?.r2_key ?? null);
    return key && isHubMusicKey(key) ? hubMusicRefForKey(key) : null;
  } catch {
    return null;
  }
}

/**
 * Is this stored reference a PUBLISHED track's file? Asked at Apply, where a
 * drafted song is about to go live: a reference into `hub-music/` is admitted
 * only while its track is on the list. Fails closed — a refused read is "no".
 */
export async function isPublishedHubMusicRef(supabase: Reader, ref: unknown): Promise<boolean> {
  const key = hubMusicKeyFromRef(ref);
  if (!key) return false;
  try {
    const { data, error } = await supabase
      .from('hub_music_tracks')
      .select('track_id')
      .eq('r2_key', key)
      .eq('is_published', true)
      .maybeSingle();
    if (error) console.error('[supabase-error] lib/hub-music-server.ts · from:hub_music_tracks.select (isPublishedHubMusicRef)', error);
    return !error && Boolean(data);
  } catch {
    return false;
  }
}
