'use client';

// ============================================================================
// TourLiveWall — CLIENT-ONLY presentational fork of
// app/[slug]/_components/live-wall-block.tsx for the public Maria & Jose tour
// (Stop 5).
//
// Why a fork (not a reuse): the shipped <LiveWallBlock> runs a 25s network poll
// against `/<slug>/live-wall` (a server route) while the tab is visible. For a
// future-dated SAMPLE event that route resolves nothing useful — the wall isn't
// "live" — so the tour must DISABLE the poll entirely. The block exposes no prop
// to turn polling off, so this fork copies its EXACT markup + the wall's own
// `animate-wall-enter` rise+fade, drops the polling useEffect (and the
// SavePhotoButton overlay — no save action on the read-only tour), and instead
// drives the "comes alive" moment from a CLIENT-ONLY TIMER over pre-seeded
// tiles handed down by the RSC.
//
// This is the stop's client-only interactive moment: local React state (tiles)
// updates the on-screen wall, calls NO server, and resets on reload. The merge
// reuses the wall's own pure mergeTiles so tiles never re-animate once present.
// Palette retuned to the tour's tokens (serif headings, #1E2229 ink, #5F5E5A
// body, #8C6932 / #C5A059 gold, #5C2542 mulberry, #FBF8F1 / #FBF6EA creams).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { mergeTiles, type WallTile } from '@/lib/live-wall-logic';

/** Display-safe tile shape — mirrors WallTile (the RSC maps the snapshot to it). */
export type TourWallTile = WallTile;

export type TourWallCaption = { text: string; author: string } | null;

const DISPLAY_CAP = 12;
/** Cadence the timer drips pre-seeded tiles in at (no network). */
const DRIP_MS = 1400;

export function TourLiveWall({
  initialTiles,
  initialCount,
  initialCaption,
  incomingTiles,
}: {
  initialTiles: TourWallTile[];
  initialCount: number;
  initialCaption: TourWallCaption;
  /** Pre-seeded "about to arrive" tiles the client-only timer reveals one by one. */
  incomingTiles: TourWallTile[];
}) {
  const [tiles, setTiles] = useState<TourWallTile[]>(initialTiles);
  const [count, setCount] = useState(initialCount);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(incomingTiles.length === 0);
  // feedIds present at first paint — only LATER arrivals animate in.
  const seededIds = useRef(new Set(initialTiles.map((t) => t.feedId)));
  const queueIdx = useRef(0);

  // The client-only "comes alive" timer: once started, reveal the pre-seeded
  // tiles one per tick via the wall's own mergeTiles (feedId-deduped), bumping
  // the live counter as each lands. Pure local state — no fetch, no server.
  useEffect(() => {
    if (!playing || done) return;
    const timer = setInterval(() => {
      const next = incomingTiles[queueIdx.current];
      if (!next) {
        setPlaying(false);
        setDone(true);
        return;
      }
      queueIdx.current += 1;
      setTiles((prev) => mergeTiles(prev, [next]));
      setCount((c) => c + 1);
    }, DRIP_MS);
    return () => clearInterval(timer);
  }, [playing, done, incomingTiles]);

  // Newest first on a phone; tiles arrive ascending by sortAt.
  const display = tiles.slice(-DISPLAY_CAP).reverse();
  const showPlay = !done && incomingTiles.length > 0;

  return (
    <section
      aria-label="Live photo wall"
      className="rounded-2xl border border-[#C5A059]/40 bg-[#FBF8F1] p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-[#8C6932]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5C2542]" />
          Live from the celebration
        </p>
        {count > 0 ? (
          <p className="text-xs text-[#5F5E5A]">
            {count.toLocaleString()} moment{count === 1 ? '' : 's'} and counting
          </p>
        ) : null}
      </div>

      {display.length === 0 ? (
        <p className="mx-auto mt-3 max-w-prose text-center text-sm text-[#5F5E5A]">
          The wall is warming up &mdash; photos appear here the moment they&rsquo;re taken.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
          {display.map((tile) => (
            <figure
              key={tile.feedId}
              className={`relative aspect-square overflow-hidden rounded-lg bg-[#1E2229]/5 ${
                seededIds.current.has(tile.feedId) ? '' : 'animate-wall-enter'
              }`}
            >
              {/* Presigned/legacy screened wall-safe derivative — plain <img>
                  (the optimizer would cache an expiring URL). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tile.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </figure>
          ))}
        </div>
      )}

      {initialCaption ? (
        <p className="mt-4 border-t border-[#1E2229]/10 pt-3 text-center font-serif text-sm italic text-[#1E2229]/75">
          &ldquo;{initialCaption.text}&rdquo;
          <span className="ml-1.5 font-sans text-xs not-italic text-[#5F5E5A]">&mdash; {initialCaption.author}</span>
        </p>
      ) : null}

      {showPlay ? (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setPlaying(true)}
            disabled={playing}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#5C2542] px-5 py-2.5 text-sm font-semibold text-[#FBFBFA] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Play aria-hidden className="h-4 w-4" strokeWidth={2} />
            {playing ? 'Photos arriving…' : 'Bring the wall to life'}
          </button>
        </div>
      ) : done && incomingTiles.length > 0 ? (
        <p className="mt-5 text-center text-xs text-[#9A8F86]">
          That&rsquo;s the live feel &mdash; on the real day it never stops. Reload to replay.
        </p>
      ) : null}

      {/* Scoped entrance animation — soft rise + fade for tiles that arrive while
          the visitor watches (the wall's own Daily-Prophet feel, no library). */}
      <style>{`
        @keyframes wall-enter { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
        .animate-wall-enter { animation: wall-enter 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
        @media (prefers-reduced-motion: reduce) { .animate-wall-enter { animation: none; } }
      `}</style>
    </section>
  );
}
