'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import type { GalleryPhoto, GalleryTagSource } from '@/lib/papic-gallery';
import { SavePhotoButton } from '@/app/_components/save-photo-button';

// Real Papic gallery grid — the couple's captured photos + clips with working
// filter chips. Server-fetched (presigned thumbnails) and passed in; this only
// handles the client-side filter state + render.

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'tagged', label: 'Photos of us' },
  { id: 'untagged', label: 'Untagged' },
  { id: 'videos', label: 'Videos' },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

function tagDotClass(source: GalleryTagSource): string {
  if (source === 'auto_face') return 'bg-emerald-500';
  if (source === 'qr' || source === 'manual') return 'bg-terracotta';
  return 'bg-ink/30';
}

export function PapicGalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [filter, setFilter] = useState<FilterId>('all');

  const shown = photos.filter((p) => {
    if (filter === 'tagged') return p.tagged;
    if (filter === 'untagged') return !p.tagged;
    if (filter === 'videos') return p.kind === 'clip';
    return true;
  });

  return (
    <>
      <ul className="flex flex-wrap gap-2" role="list" aria-label="Gallery filters">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={active}
                className={
                  active
                    ? 'inline-flex items-center gap-1 rounded-full bg-terracotta px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-cream'
                    : 'inline-flex items-center gap-1 rounded-full bg-ink/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/60 hover:bg-ink/10 hover:text-ink/80'
                }
              >
                {f.label}
              </button>
            </li>
          );
        })}
      </ul>

      {shown.length === 0 ? (
        <p className="text-sm text-ink/55">No photos in this view yet.</p>
      ) : (
        <ul
          className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
          aria-label="Papic gallery"
        >
          {shown.map((p) => (
            <li key={p.id}>
              <div className="relative aspect-square overflow-hidden rounded-lg bg-ink/5">
                {p.url ? (
                  // Presigned R2 thumbnail — a plain img keeps the dynamic, short-
                  // lived URL out of next/image's domain allowlist + optimizer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-ink/10" aria-hidden />
                )}
                {p.kind === 'clip' && (
                  <span className="absolute right-1 top-1 rounded-full bg-black/55 p-1 text-cream">
                    <Play aria-hidden className="h-3 w-3" strokeWidth={2} />
                    <span className="sr-only">Video clip</span>
                  </span>
                )}
                {p.url ? (
                  <SavePhotoButton url={p.url} filename={`setnayan-photo-${p.id}.jpg`} />
                ) : null}
                <span
                  className={`absolute bottom-1 left-1 h-2 w-2 rounded-full ring-1 ring-white/70 ${tagDotClass(p.tagSource)}`}
                  aria-hidden
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
