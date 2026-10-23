import 'server-only';

/**
 * lib/home-music-card.server.ts — WHAT HOME'S MUSIC CARD READS (owner 2026-10-23, approved
 * `prototypes/home_service_widgets_2026-10-23.html` frame 7): the song (`pakanta_song_*`, the Music Maker page's own
 * columns), whether it plays on the Event Hub (`pakanta_song_adopted_as_site_music`), and the Hub's music switch as the
 * couple is editing it (the DRAFT laid over `site_bg_music_enabled`, as the Maker shows it).
 *
 * 🔒 HONEST: the event row refused → `{ ok: false }` ("couldn't load", never "no song yet" — the Music Maker page's
 * own fallback reads a refusal as no song, which a card must not repeat). The draft refused → the live switch,
 * flagged.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { readHubDraft } from '@/lib/hub-draft-store';
import { overlayHubDraftEvent } from '@/lib/hub-draft';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';

export type HomeMusicCardRead =
  | { ok: false }
  | {
      ok: true;
      ready: boolean;
      filename: string | null;
      previewUrl: string | null;
      adopted: boolean;
      /** The Event Hub has a song to play at all (`site_bg_music_r2_key`). */
      hubHasMusic: boolean;
      /** Where that song came from — `site_bg_music_source` ('pakanta' · 'upload' · null = our music). */
      hubSource: string | null;
      /** "Play music" on the Hub, the draft laid over. */
      hubMusicOn: boolean;
      draftUnread: boolean;
    };

export async function readHomeMusicCard(supabase: SupabaseClient, eventId: string): Promise<HomeMusicCardRead> {
  const [eventRes, draftRead] = await Promise.all([
    supabase
      .from('events')
      .select('pakanta_song_status, pakanta_song_r2_key, pakanta_song_filename, pakanta_song_adopted_as_site_music, site_bg_music_enabled, site_bg_music_r2_key, site_bg_music_source')
      .eq('event_id', eventId)
      .maybeSingle(),
    readHubDraft(supabase, eventId).then(
      (draft) => ({ draft, unread: false }),
      () => ({ draft: null, unread: true }),
    ),
  ]);
  if (eventRes.error || !eventRes.data) return { ok: false };
  const event = eventRes.data;
  const ready = event.pakanta_song_status === 'ready' && Boolean(event.pakanta_song_r2_key);
  const previewUrl = ready && event.pakanta_song_r2_key ? await displayUrlForStoredAsset(event.pakanta_song_r2_key).catch((): null => null) : null;
  const drafted = overlayHubDraftEvent(event as Record<string, unknown>, draftRead.draft) as typeof event;
  return {
    ok: true,
    ready,
    filename: event.pakanta_song_filename ?? null,
    previewUrl,
    adopted: event.pakanta_song_adopted_as_site_music === true,
    // A Hub song is one the Event Hub can actually play — held to the public bucket, as every Hub signer holds it.
    hubHasMusic: Boolean(siteMediaServeRef(drafted.site_bg_music_r2_key)),
    hubSource: (drafted.site_bg_music_source as string | null) ?? null,
    hubMusicOn: drafted.site_bg_music_enabled === true,
    draftUnread: draftRead.unread,
  };
}
