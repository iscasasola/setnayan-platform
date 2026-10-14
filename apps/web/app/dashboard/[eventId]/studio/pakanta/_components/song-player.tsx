'use client';

import { markSongHeard } from '@/lib/song-heard';

/**
 * The delivered song's player — the shipped `<audio controls>`, which also marks
 * the song HEARD on this device the moment it starts (`lib/song-heard.ts`), so
 * Home's "Your song is ready" card hands its place to the next step (owner
 * "approve all", 2026-10-14: once, until heard).
 */
export function SongPlayer({ eventId, src }: { eventId: string; src: string }) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- a song; the lyrics are not a caption track
    <audio controls preload="none" src={src} className="mt-3 w-full" onPlay={() => markSongHeard(eventId)} />
  );
}
