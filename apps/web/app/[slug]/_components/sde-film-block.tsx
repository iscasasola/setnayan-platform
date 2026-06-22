'use client';

import { Clapperboard } from 'lucide-react';

/**
 * SdeFilmBlock — the Same-Day Edit film on the couple's day-of page (live +
 * recap windows). When the crew has delivered the film it plays a controlled
 * <video> (presigned R2 URL); when the couple owns SDE but the film isn't cut
 * yet, a quiet "being cut" stand-in holds the spot so guests know it's coming.
 *
 * VIDEO (not the audio BackgroundMusic player): reuses the <video playsInline
 * controls poster> shape from save-the-date-film.tsx. Not autoplay — the day-of
 * page already has the Live Wall + (optionally) the Panood broadcast running, so
 * the film is a tap-to-watch keepsake, not a competing autoplay.
 */
export function SdeFilmBlock({
  videoUrl,
  posterUrl,
}: {
  /** Presigned MP4 URL, or null → the couple owns SDE but the film isn't ready yet. */
  videoUrl: string | null;
  posterUrl: string | null;
}) {
  return (
    <section
      aria-label="Same-Day Edit film"
      className="overflow-hidden rounded-2xl border-2 border-terracotta/40 bg-ink shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-cream">
          <Clapperboard aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Same-Day Edit
        </p>
      </div>
      {videoUrl ? (
        <div className="bg-ink">
          {/* presigned URL → raw <video> (controlled, tap-to-watch). */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- crew-delivered keepsake film, no caption track */}
          <video
            src={videoUrl}
            poster={posterUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full bg-ink object-contain"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Clapperboard aria-hidden className="h-7 w-7 text-cream/70" strokeWidth={1.5} />
          <p className="text-sm font-medium text-cream">Your Same-Day Edit is being cut</p>
          <p className="max-w-xs text-xs text-cream/65">
            Our crew is editing the film — it&rsquo;ll appear right here as soon as it&rsquo;s ready.
          </p>
        </div>
      )}
    </section>
  );
}
