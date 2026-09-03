/**
 * apps/web/lib/event-films.ts
 *
 * 🎞 EVERY FILM OF THEIR DAY — pure helpers for the links a couple attaches to their event.
 *
 * The ₱2,500 Live Studio description promises "unlimited video-link uploads" (migration
 * `20271194920190`). Nothing let a COUPLE do that — `video-links-editor.tsx` is
 * vendor-dashboard only. This module is the couple-side half.
 *
 * ── NOTHING HERE PARSES A URL ──────────────────────────────────────────────
 * `parseVideoRef` in `lib/vendor-microsite.ts` already does it, for YouTube AND Vimeo,
 * including the `vimeo.com/{id}/{hash}` unlisted share form — and it is tested. Writing a
 * second parser would be a second place for an unlisted Vimeo link to stop playing, and a
 * second place for a Drive link to slip through into an iframe. One parser.
 *
 * ⚠ PURE ON PURPOSE. No `server-only` import, no Supabase client — so it runs under the
 * repo's `tsx --test` unit runner, same reason `live-studio-readiness.ts` splits from its
 * `-server` half.
 */
import { parseVideoRef, videoEmbedUrl, videoThumb, type VideoRef } from '@/lib/vendor-microsite';

/** A film row as stored, minus the bookkeeping columns. */
export type EventFilmRow = {
  provider: string;
  video_id: string;
  video_hash: string | null;
  label: string | null;
};

/** A film ready to render: an embeddable URL, a poster when one exists for free. */
export type EventFilm = {
  provider: 'youtube' | 'vimeo';
  videoId: string;
  label: string | null;
  embedUrl: string;
  thumbUrl: string | null;
};

/** Longest label we will store — mirrors the column CHECK so both refuse the same input. */
export const FILM_LABEL_MAX = 120;

/**
 * What a pasted link becomes on its way INTO the database, or null if it is not a
 * YouTube/Vimeo video. Returns the pieces the columns want, never a URL — the stored
 * shape is structured so nothing can later embed raw user input.
 */
export function filmInsertFromLink(
  link: string | null | undefined,
  label?: string | null,
): { provider: 'youtube' | 'vimeo'; video_id: string; video_hash: string | null; label: string | null } | null {
  const ref: VideoRef | null = parseVideoRef(link);
  if (!ref) return null;
  const trimmed = (label ?? '').trim();
  return {
    provider: ref.provider,
    video_id: ref.id,
    video_hash: ref.provider === 'vimeo' ? (ref.hash ?? null) : null,
    label: trimmed ? trimmed.slice(0, FILM_LABEL_MAX) : null,
  };
}

/**
 * What a stored row becomes on its way OUT to the page.
 *
 * 🔒 RE-VALIDATES rather than trusting the column. The row was validated when written,
 * but a value can also arrive by an admin edit, a restore, or a migration — and this is
 * the last step before an `iframe src`. `panood-watch.ts` guards the live replay the same
 * way at read time for the same reason. An unrecognisable row yields null and is dropped,
 * never rendered as a broken frame.
 */
export function filmFromRow(row: EventFilmRow | null | undefined): EventFilm | null {
  if (!row) return null;
  if (row.provider !== 'youtube' && row.provider !== 'vimeo') return null;
  const ref: VideoRef | null =
    row.provider === 'vimeo'
      ? parseVideoRef(row.video_hash ? `vimeo.com/${row.video_id}/${row.video_hash}` : `vimeo.com/${row.video_id}`)
      : parseVideoRef(row.video_id);
  if (!ref || ref.provider !== row.provider) return null;
  return {
    provider: ref.provider,
    videoId: ref.id,
    label: row.label?.trim() || null,
    embedUrl: videoEmbedUrl(ref),
    thumbUrl: videoThumb(ref),
  };
}

/** Every renderable film, in stored order, with unusable rows dropped rather than shown. */
export function filmsFromRows(rows: ReadonlyArray<EventFilmRow> | null | undefined): EventFilm[] {
  return (rows ?? []).map(filmFromRow).filter((f): f is EventFilm => f !== null);
}
