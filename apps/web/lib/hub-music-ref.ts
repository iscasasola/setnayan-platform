/**
 * "IS THIS SONG ONE OF OURS?" — answered from the stored reference alone.
 *
 * An Event Hub's song lives in ONE column, `events.site_bg_music_r2_key`. A
 * couple's own upload sits in their event's folder; a pick from "Our music"
 * (the list an admin uploads at /admin/hub-music, owner 2026-10-08) is the same
 * column holding a reference into `hub-music/`. So which source a song came
 * from is READ OFF what is stored — no second column to drift from the first.
 *
 * Tiny and pure on purpose: `lib/hub-draft.ts` asks it (an Our-music pick is
 * free to use; the couple's own song is Event Hub Pro), and that file rides in
 * the Maker's first load. The moods, titles and upload rules stay in
 * `lib/hub-music.ts`, which the first load never needs.
 */
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';

const HUB_MUSIC_REF_PREFIX = `r2://${PUBLIC_R2_BUCKET}/hub-music/`;

/** The stored reference for a track's object key (`hub-music/…`). */
export function hubMusicRefForKey(key: string): string {
  return `r2://${PUBLIC_R2_BUCKET}/${key}`;
}

/** True for a reference into the Our-music folder — and nothing that climbs out of it. */
export function isHubMusicRef(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith(HUB_MUSIC_REF_PREFIX)) return false;
  const rest = value.slice(HUB_MUSIC_REF_PREFIX.length);
  return rest.length > 0 && !rest.startsWith('/') && !rest.includes('//') && !rest.includes('..');
}

/** The object key inside a reference (`hub-music/…`), or null when it is not one of ours. */
export function hubMusicKeyFromRef(value: unknown): string | null {
  return isHubMusicRef(value) ? value.slice(`r2://${PUBLIC_R2_BUCKET}/`.length) : null;
}

/** One track as the couple's list holds it. */
export type HubMusicChoice = {
  trackId: string;
  /** What `events.site_bg_music_r2_key` holds when this track is the song. */
  ref: string;
  title: string;
  moodLabel: string;
  /** "2:27", or "—" when the length could not be read. */
  length: string;
  /** A playable address for ▶, or null when one could not be made. */
  previewUrl: string | null;
};
