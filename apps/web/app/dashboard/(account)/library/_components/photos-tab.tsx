import Link from 'next/link';
import { ArrowRight, Camera, Play, Plus, Sparkles } from 'lucide-react';
import { EventMonogram } from '@/app/_components/event-monogram';
import { getPhotosAlbums, type Album } from '../_data/photos-albums';

// Photos & Videos tab — the cross-event, album-per-event grid. One card per
// event the user hosts (OWNED) or attended, each linking into the existing
// per-event Papic studio (where the full PapicGalleryGrid + "Download all"
// already live). Reuses: lib/papic-gallery.ts (owned visibility filter),
// lib/guest-live-gallery.ts (attended tagged+clean privacy gate),
// getSwitcherData (event list + monograms + role), EventMonogram, and the
// rounded-2xl border-ink/10 card shell from
// app/dashboard/[eventId]/galleries/page.tsx.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.setnayan.com').replace(
  /\/+$/,
  '',
);

/** Parse an event_date string to its UTC year, or null if absent/invalid. */
function parseEventYear(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t).getUTCFullYear();
}

export async function PhotosTab({ userId }: { userId: string }) {
  const { albums, shareEvent } = await getPhotosAlbums(userId);

  if (albums.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 p-10 text-center">
        <Camera aria-hidden className="mx-auto h-8 w-8 text-ink/30" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-ink">No albums yet</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink/55">
          Photos &amp; videos from the events you host or attend land here. Create
          your first event to get started.
        </p>
        <Link
          href="/dashboard/create-event"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
          Create an event
        </Link>
      </div>
    );
  }

  // Facebook share — there's NO API to auto-build a personal FB album, so we
  // share the event's PUBLIC gallery link (renders one OG thumbnail) and give
  // honest album-building guidance. No auto-upload, no cross-event ZIP.
  const fbShareUrl = shareEvent
    ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        `${APP_URL}/${shareEvent.slug}`,
      )}`
    : null;

  // "On this day" — owned events whose anniversary is TODAY (exact month/day).
  // The memory home reaching out: no extra query, just event_date vs today.
  const now = new Date();
  const anniversaries = albums
    .filter((a) => a.role === 'couple' && a.event.event_date)
    .map((a) => {
      const d = new Date(a.event.event_date as string);
      return {
        album: a,
        yearsAgo: now.getUTCFullYear() - d.getUTCFullYear(),
        isToday:
          Number.isFinite(d.getTime()) &&
          d.getUTCMonth() === now.getUTCMonth() &&
          d.getUTCDate() === now.getUTCDate(),
      };
    })
    .filter((x) => x.isToday && x.yearsAgo > 0)
    .sort((a, b) => b.yearsAgo - a.yearsAgo);

  // Timeline — group albums by event year (most recent first; undated last).
  const byYear = new Map<string, Album[]>();
  for (const a of albums) {
    const y = parseEventYear(a.event.event_date);
    const key = y !== null ? String(y) : 'Undated';
    const arr = byYear.get(key);
    if (arr) arr.push(a);
    else byYear.set(key, [a]);
  }
  const years = [...byYear.keys()].sort((a, b) =>
    a === 'Undated' ? 1 : b === 'Undated' ? -1 : Number(b) - Number(a),
  );
  const groupByYear = years.length > 1;

  return (
    <div className="space-y-6">
      {/* "On this day" — anniversary nostalgia hook (the memory home reaching out) */}
      {anniversaries.length > 0 ? (
        <div className="space-y-2">
          {anniversaries.map(({ album, yearsAgo }) => (
            <Link
              key={album.event.event_id}
              href={`/dashboard/${album.event.event_id}/studio/papic`}
              className="flex items-center gap-3 rounded-2xl border border-terracotta/20 bg-terracotta/5 p-4 transition-colors hover:bg-terracotta/10"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
                <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {yearsAgo} {yearsAgo === 1 ? 'year' : 'years'} ago today
                </p>
                <p className="truncate text-xs text-ink/60">
                  {album.event.display_name} — relive the day
                </p>
              </div>
              <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            </Link>
          ))}
        </div>
      ) : null}

      {/* Facebook helper card */}
      <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[#1877F2]">
              <FacebookGlyph className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">Share to Facebook</h2>
              <p className="mt-0.5 text-xs text-ink/55">
                To make a Facebook album: open an event below, Download all, then use
                Facebook&rsquo;s Create Album to upload.
              </p>
            </div>
          </div>
          {fbShareUrl ? (
            <a
              href={fbShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1877F2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1666d4]"
            >
              <FacebookGlyph className="h-4 w-4" />
              Share the gallery link
            </a>
          ) : null}
        </div>
      </div>

      {/* Albums — grouped by year (a timeline) once events span multiple years */}
      {groupByYear ? (
        <div className="space-y-8">
          {years.map((y) => (
            <section key={y}>
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink/45">
                  {y}
                </span>
                <span className="h-px flex-1 bg-ink/10" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(byYear.get(y) ?? []).map((album) => (
                  <AlbumCard key={album.event.event_id} album={album} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {albums.map((album) => (
            <AlbumCard key={album.event.event_id} album={album} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlbumCard({ album }: { album: Album }) {
  const { event, role, count, thumbs } = album;
  const hosting = role === 'couple';
  const studioHref = `/dashboard/${event.event_id}/studio/papic`;
  const hasMedia = count > 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm">
      {/* Thumbnail strip */}
      <Link href={studioHref} className="block">
        <div className="grid grid-cols-4 gap-px bg-ink/5">
          {thumbs.length > 0
            ? thumbs.slice(0, 4).map((t, i) => (
                <div key={i} className="relative aspect-square overflow-hidden bg-cream">
                  {/* Plain <img>: presigned R2 URL isn't in the next/image allowlist. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  {t.isClip ? (
                    <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-white">
                      <Play aria-hidden className="h-3 w-3 fill-current" strokeWidth={0} />
                    </span>
                  ) : null}
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex aspect-square items-center justify-center bg-cream"
                >
                  {i === 0 ? (
                    <Camera aria-hidden className="h-5 w-5 text-ink/20" strokeWidth={1.5} />
                  ) : null}
                </div>
              ))}
        </div>
      </Link>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <EventMonogram event={event} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-ink">
                {event.display_name}
              </h3>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  hosting
                    ? 'bg-terracotta/10 text-terracotta'
                    : 'bg-ink/5 text-ink/60'
                }`}
              >
                {hosting ? 'Hosting' : 'Attended'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink/55">
              {hasMedia
                ? `${count} ${count === 1 ? 'photo or clip' : 'photos & clips'}`
                : 'Collecting…'}
            </p>
          </div>
        </div>

        <Link
          href={studioHref}
          className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-terracotta-600"
        >
          {hasMedia ? 'View & download' : 'Open album'}
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </article>
  );
}

// Facebook brand glyph — newer lucide-react dropped brand icons, so the
// codebase ships inline SVGs (mirrors app/realstories/_components/share-buttons
// .tsx). Inherits currentColor.
function FacebookGlyph({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? 'h-4 w-4'}
    >
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}
