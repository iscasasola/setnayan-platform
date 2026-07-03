'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';

/** One resolved film: a privacy-preserving embed URL + optional poster. */
export type FilmCard = {
  key: string;
  provider: 'youtube' | 'vimeo';
  embedUrl: string;
  poster: string | null;
};

/** How many films show before the "Show all" expander (two rows at sm:grid-cols-2). */
const INITIAL_VISIBLE = 6;

/**
 * Public "Films" video rack. Renders click-to-play THUMBNAIL FACADES, not live
 * iframes — so a vendor with up to 30 films costs one <img> each on load, and
 * the real youtube-nocookie / player.vimeo.com iframe is injected only when the
 * visitor clicks that card. At volume the rack shows the first ~6 (two rows)
 * with a quiet "Show all films (N)" expander that reveals the rest client-side.
 */
export function FilmsRack({
  films,
  title,
}: {
  films: FilmCard[];
  title: string;
}) {
  const [expanded, setExpanded] = useState(false);
  // Which cards have been clicked to play (facade → live iframe).
  const [playing, setPlaying] = useState<Set<string>>(() => new Set());

  const visible = expanded ? films : films.slice(0, INITIAL_VISIBLE);
  const hiddenCount = films.length - INITIAL_VISIBLE;

  return (
    <section className="space-y-3 border-b border-ink/10 py-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Films
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((film) => {
          const isPlaying = playing.has(film.key);
          return (
            <div
              key={film.key}
              className="relative aspect-video overflow-hidden rounded-xl bg-ink/5"
            >
              {isPlaying ? (
                <iframe
                  src={`${film.embedUrl}${film.embedUrl.includes('?') ? '&' : '?'}autoplay=1`}
                  title={`${title} film`}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  className="absolute inset-0 h-full w-full"
                />
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setPlaying((prev) => new Set(prev).add(film.key))
                  }
                  aria-label={`Play ${title} film`}
                  className="group absolute inset-0 h-full w-full"
                >
                  {film.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={film.poster}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    // Poster-less facade (Vimeo with no resolved oEmbed thumb).
                    <span
                      aria-hidden
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/85 text-white/80"
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide">
                        {film.provider === 'vimeo' ? 'Vimeo' : 'Video'}
                      </span>
                    </span>
                  )}
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-ink/10 transition-colors group-hover:bg-ink/25"
                  >
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-105">
                      <Play
                        className="ml-0.5 h-6 w-6 text-ink"
                        strokeWidth={1.5}
                        fill="currentColor"
                      />
                    </span>
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
      {!expanded && hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm font-medium text-ink/70 underline decoration-ink/20 underline-offset-4 transition-colors hover:text-ink"
        >
          Show all films ({films.length})
        </button>
      ) : null}
    </section>
  );
}
