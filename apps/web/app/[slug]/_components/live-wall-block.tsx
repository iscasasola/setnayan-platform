'use client';

import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

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
  // The event's own word for whoever is throwing it. Falls back to the exact
  // wording this surface shipped with, so a missing provider cannot regress a
  // real wedding — event-words-mounted.test.ts is what stops that hiding.
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  const [tiles, setTiles] = useState<WallTile[]>(initialTiles);
  const [count, setCount] = useState(initialCount);
  const [caption, setCaption] = useState<LiveWallCaption>(initialCaption);
  // Two consecutive fetch failures — see the poll loop. Only ever set from
  // there, so a first-load-with-no-tiles (the ordinary quiet moment) never
  // shows an error that is not true.
  const [stalled, setStalled] = useState(false);
  // The couple closed the wall to guests' phones while this page was open.
  // Distinct from `stalled`: that is "we cannot reach the wall", this is "we
  // reached it and we are not welcome any more".
  const [closed, setClosed] = useState(false);
  // feedIds present at first paint — only LATER arrivals animate in.
  const seededIds = useRef(new Set(initialTiles.map((t) => t.feedId)));

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;
    // Consecutive failures. TWO, not one: a single miss on venue wifi is
    // ordinary and must not accuse the network. Two in a row is a pattern, and
    // by then the guest has been staring at "the wall is warming up" for the
    // best part of a minute believing photos are on their way.
    let misses = 0;

    const poll = async () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      try {
        const res = await fetch(`/${encodeURIComponent(slug)}/live-wall`, {
          cache: 'no-store',
        });
        // 404 IS A REFUSAL, NOT AN OUTAGE — and the two must not be treated
        // alike. The feed answers 404 only when the wall is not on offer to
        // guests: the couple switched the phone mirror off, or the wall was
        // never theirs. An outage looks like a 5xx or a thrown fetch, which
        // fall through to the miss counter below.
        //
        // Without this branch, a couple turning the mirror off stopped NEW
        // photos and left every already-open phone showing the ones it had
        // downloaded, indefinitely, under the same "photos appear here the
        // moment they're taken" promise. Closing has to reach the phones that
        // are already holding the wall, not only the ones that reload.
        if (res.status === 404) {
          setClosed(true);
          setTiles([]);
          setCaption(null);
          setCount(0);
          stop();
          return;
        }
        if (!res.ok) {
          misses += 1;
          if (misses >= 2) setStalled(true);
          return;
        }
        misses = 0;
        setStalled(false);
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
        // Transient venue-wifi failure — the next tick covers it, and after two
        // in a row we stop promising photos that are not coming.
        //
        // 🔴 BOTH THIS CATCH AND THE `!res.ok` ABOVE USED TO CHANGE NO STATE AT
        // ALL. The wall kept retrying every 25 seconds forever while the guest
        // read "The wall is warming up — photos appear here the moment they're
        // taken." On a bad venue network that sentence was a promise the page
        // had already stopped being able to keep, and there was nothing on
        // screen to tap, retry, or even suspect.
        misses += 1;
        if (misses >= 2) setStalled(true);
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
          {closed
            ? // Said plainly, and without blame. The wall did not break and the
              // guest did nothing wrong — the couple chose to keep it to the
              // room. A card that simply emptied itself would read as a fault.
              `The photo wall is playing on the screens at the venue. ${w.TheOrganizer} has kept it off phones for this celebration.`
            : stalled
              ? 'We can’t reach the wall right now — this venue’s signal may be busy. It keeps trying, and photos appear the moment it reconnects.'
              : 'The wall is warming up — photos appear here the moment they’re taken.'}
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
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
        Live from the celebration
      </p>
      {count > 0 ? (
        <p className="flex items-baseline gap-1 text-ink/55">
          <span className="font-serif text-xl italic leading-none tabular-nums text-ink">
            {count.toLocaleString()}
          </span>
          <span className="text-xs">moment{count === 1 ? '' : 's'} and counting</span>
        </p>
      ) : null}
    </div>
  );
}
