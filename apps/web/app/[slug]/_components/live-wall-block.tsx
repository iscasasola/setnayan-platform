'use client';

import { useEffect, useRef, useState } from 'react';
import { mergeTiles, type WallTile } from '@/lib/live-wall-logic';
import { SavePhotoButton } from '@/app/_components/save-photo-button';

/**
 * LiveWallBlock — the Salamisim Live Photo Wall, mirrored onto the guest's
 * own phone during the wedding (owner 2026-06-12: "panood, photo wall live
 * and the gallery must be on the on the day website part").
 *
 * This is the on-the-day LIVE form of the wall/gallery pair: the freshest
 * wall-safe tiles flowing in as they're shot, with the newest Kwento caption
 * as the lower-third — the same screened feed the venue projector renders
 * (`getWallSnapshot`), never the raw capture tables. The editorial later gets
 * the RECAP form ("The Wall, Frozen").
 *
 * LIVENESS without sockets: the venue projector owns the realtime channel;
 * a phone block only needs "feels live" — so it polls /[slug]/live-wall every
 * 25s WHILE THE TAB IS VISIBLE (document.visibilitychange gates the timer; a
 * pocketed phone polls zero). Merge is feedId-deduped via the wall's own pure
 * mergeTiles, so tiles never re-animate on refresh. Request-driven only — no
 * cron (house rule).
 *
 * New tiles enter with a soft rise+fade (the Daily-Prophet entrance), capped
 * at the newest 12 on screen.
 */

const DISPLAY_CAP = 12;
const POLL_MS = 25_000;

export type LiveWallCaption = { text: string; author: string } | null;

export function LiveWallBlock({
  slug,
  initialTiles,
  initialCount,
  initialCaption,
}: {
  slug: string;
  initialTiles: WallTile[];
  initialCount: number;
  initialCaption: LiveWallCaption;
}) {
  const [tiles, setTiles] = useState<WallTile[]>(initialTiles);
  const [count, setCount] = useState(initialCount);
  const [caption, setCaption] = useState<LiveWallCaption>(initialCaption);
  // feedIds present at first paint — only LATER arrivals animate in.
  const seededIds = useRef(new Set(initialTiles.map((t) => t.feedId)));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    const poll = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const res = await fetch(`/${encodeURIComponent(slug)}/live-wall`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          tiles?: WallTile[];
          count?: number;
          caption?: LiveWallCaption;
        };
        if (Array.isArray(data.tiles)) {
          setTiles((prev) => mergeTiles(prev, data.tiles ?? []));
        }
        if (typeof data.count === 'number') setCount(data.count);
        if (data.caption !== undefined) setCaption(data.caption);
      } catch {
        // transient venue-WiFi failure — next tick covers it
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      if (!timer) timer = setInterval(() => void poll(), POLL_MS);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void poll();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [slug]);

  // Newest first on a phone; tiles arrive ascending by sortAt.
  const display = tiles.slice(-DISPLAY_CAP).reverse();
  if (display.length === 0) {
    return (
      <section
        aria-label="Live photo wall"
        className="rounded-2xl border border-ink/10 bg-cream p-6 text-center shadow-sm"
      >
        <LiveWallHeader count={0} />
        <p className="mx-auto mt-2 max-w-prose text-sm text-ink/60">
          The wall is warming up — photos appear here the moment they&rsquo;re taken.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="Live photo wall"
      className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6"
    >
      <LiveWallHeader count={count} />
      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
        {display.map((tile) => (
          <figure
            key={tile.feedId}
            className={`relative aspect-square overflow-hidden rounded-lg bg-ink/5 ${
              seededIds.current.has(tile.feedId) ? '' : 'animate-wall-enter'
            }`}
          >
            {/* Presigned, screened wall-safe derivative — plain <img> (the
                optimizer would cache an expiring URL). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tile.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
            {tile.url ? (
              <SavePhotoButton
                url={tile.url}
                filename={`setnayan-photo-${tile.feedId}.jpg`}
              />
            ) : null}
          </figure>
        ))}
      </div>
      {caption ? (
        <p className="mt-4 border-t border-ink/10 pt-3 text-center font-serif text-sm italic text-ink/75">
          &ldquo;{caption.text}&rdquo;
          <span className="ml-1.5 font-sans text-xs not-italic text-ink/50">
            — {caption.author}
          </span>
        </p>
      ) : null}
      {/* Scoped entrance animation — soft rise + fade for tiles that arrive
          while the guest watches (Daily-Prophet feel, no library). */}
      <style>{`
        @keyframes wall-enter { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        .animate-wall-enter { animation: wall-enter 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @media (prefers-reduced-motion: reduce) { .animate-wall-enter { animation: none; } }
      `}</style>
    </section>
  );
}

function LiveWallHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Live from the celebration
      </p>
      {count > 0 ? (
        <p className="text-xs text-ink/55">
          {count.toLocaleString()} moment{count === 1 ? '' : 's'} and counting
        </p>
      ) : null}
    </div>
  );
}
