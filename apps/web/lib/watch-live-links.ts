/**
 * lib/watch-live-links.ts — the ONE reduction from "what the couple saved" to
 * "what the public page renders" for the live broadcast.
 *
 * DUAL-STREAM (owner-approved 2026-07-26): a couple can push the same OBS program
 * output to YouTube AND Facebook at once (obs-multi-rtmp does the duplication on
 * their laptop — Setnayan sends no video bytes either way). Their event page then
 * offers both doors. Either side may be absent:
 *
 *   YouTube only  → today's behaviour, byte-for-byte (embed + "Open on YouTube")
 *   both          → embed + "Open on YouTube" + "Watch on Facebook"
 *   Facebook only → no embed; the "Watch on Facebook" link alone
 *   neither       → null (the caller renders nothing, exactly as before)
 *
 * Shared by app/[slug]/_lib/loaders.ts (the wedding page) and app/[slug]/hub
 * (the guest hub) so the two surfaces can never disagree about what's showing.
 *
 * ⚠ BOTH values are re-validated HERE, on READ. `events` UPDATE RLS is ROW-level
 * and the anon key is public, so a host can PATCH either column straight through
 * PostgREST. Re-running the parsers on every render means a forged value renders
 * nothing instead of reaching an iframe src or an href. Never render the raw
 * stored string — always the output of this function.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeFacebookWatchUrl } from '@/lib/facebook-watch';
import { parseYouTubeVideoId, youTubeEmbedUrl } from '@/lib/panood-watch';

export type WatchLiveLinks = {
  /** youtube-nocookie embed src. NULL when the couple published Facebook only. */
  embedUrl: string | null;
  /** Canonical YouTube watch URL — the link beside the player. */
  watchUrl: string | null;
  /** Canonical Facebook watch URL. LINK-OUT ONLY, never an iframe src. */
  facebookUrl: string | null;
};

/** Reduce the two stored columns to render-ready links, or null when neither is usable. */
export function resolveWatchLinks(input: {
  youtubeWatchUrl?: string | null;
  facebookWatchUrl?: string | null;
}): WatchLiveLinks | null {
  let embedUrl: string | null = null;
  let watchUrl: string | null = null;

  const videoId =
    typeof input.youtubeWatchUrl === 'string' ? parseYouTubeVideoId(input.youtubeWatchUrl) : null;
  if (videoId) {
    try {
      embedUrl = youTubeEmbedUrl(videoId);
      watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    } catch {
      // parseYouTubeVideoId already validated the id; belt-and-braces only.
      embedUrl = null;
      watchUrl = null;
    }
  }

  const facebookUrl =
    typeof input.facebookWatchUrl === 'string'
      ? normalizeFacebookWatchUrl(input.facebookWatchUrl)
      : null;

  if (!embedUrl && !facebookUrl) return null;
  return { embedUrl, watchUrl, facebookUrl };
}

/**
 * Read both watch columns for an event, tolerating a database where the Facebook
 * column has not been migrated yet.
 *
 * The retry is the point: selecting a column that does not exist makes PostgREST
 * fail the WHOLE select (42703), which would take the LIVE, SHIPPED YouTube embed
 * down with it on any environment where migration 20271006100000 has not landed.
 * Adding a column must never be able to switch off a wedding's livestream.
 */
export async function readEventWatchUrls(
  client: SupabaseClient,
  eventId: string,
): Promise<{ youtubeWatchUrl: string | null; facebookWatchUrl: string | null }> {
  const both = await client
    .from('events')
    .select('panood_watch_url, panood_watch_url_facebook')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!both.error) {
    const row = (both.data ?? null) as {
      panood_watch_url?: string | null;
      panood_watch_url_facebook?: string | null;
    } | null;
    return {
      youtubeWatchUrl: row?.panood_watch_url ?? null,
      facebookWatchUrl: row?.panood_watch_url_facebook ?? null,
    };
  }

  const legacy = await client
    .from('events')
    .select('panood_watch_url')
    .eq('event_id', eventId)
    .maybeSingle();
  if (legacy.error) return { youtubeWatchUrl: null, facebookWatchUrl: null };
  const row = (legacy.data ?? null) as { panood_watch_url?: string | null } | null;
  return { youtubeWatchUrl: row?.panood_watch_url ?? null, facebookWatchUrl: null };
}
