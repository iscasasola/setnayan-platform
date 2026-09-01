'use client';

import { useEventWords, WORDS_AS_SHIPPED } from './event-words-provider';

import { useEffect, useRef, useState } from 'react';
import { mergeTiles, type WallTile } from '@/lib/live-wall-logic';
import { SavePhotoButton } from '@/app/_components/save-photo-button';
import { GalleryCredit } from '@/app/_components/gallery/gallery-credit';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';

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
 *
 * ── THE OBSIDIAN SURFACE (gallery archetype § 2, route chip: DAY-OF LIVE PHOTO
 * WALL CARD) ────────────────────────────────────────────────────────────────
 *
 * Ported 2026-08-27. Dark because photographs carry the colour — a SURFACE
 * decision on a light-locked app, not a theme, and there is no toggle.
 *
 * 🚨 COLOURS COME ONLY FROM `--sn-ob-*`. Nothing sets `html.dark` here, so
 * `text-ink` resolves to the LIGHT near-black and measures 1.27:1 on this panel;
 * `text-terracotta` (the pulse dot this card used) measures 5.21:1 and survives,
 * but the family it belongs to does not, so the whole card uses the obsidian set
 * rather than a mix somebody has to remember.
 *
 * 🔒 THE VENUE PROJECTION IS UNTOUCHED (owner-locked 2026-06-11). This is the
 * guest's PHONE mirror only.
 */

const DISPLAY_CAP = 12;
const POLL_MS = 25_000;

export type LiveWallCaption = { text: string; author: string } | null;

/** The currently-armed Papic Challenge + how many guests have answered it. */
export type LiveWallChallenge = { missionId: string; prompt: string; answeredCount: number } | null;

export function LiveWallBlock({
  slug,
  initialTiles,
  initialCount,
  initialCaption,
  initialChallenge = null,
  initialChallengeMeasured = true,
  timeZone,
}: {
  slug: string;
  initialTiles: WallTile[];
  initialCount: number;
  initialCaption: LiveWallCaption;
  /** The event's currently-armed Papic Challenge, or null when none is armed. */
  initialChallenge?: LiveWallChallenge;
  /** False when the FIRST read of the challenge was refused — unknown, never
   *  "none". See WallChallengeRead in lib/live-wall.ts. Defaults to true so
   *  every existing caller (no challenge system to report) keeps rendering
   *  exactly as before. */
  initialChallengeMeasured?: boolean;
  /** The VENUE's zone, for the "· 4:12 PM" half of a tile's credit. Absent ⇒
   *  the name shows alone; the reader's own clock is never printed as the
   *  venue's. */
  timeZone?: string | null;
}) {
  // The event's own word for whoever is throwing it. Falls back to the exact
  // wording this surface shipped with, so a missing provider cannot regress a
  // real wedding — event-words-mounted.test.ts is what stops that hiding.
  const w = useEventWords() ?? WORDS_AS_SHIPPED;
  const [tiles, setTiles] = useState<WallTile[]>(initialTiles);
  const [count, setCount] = useState(initialCount);
  const [caption, setCaption] = useState<LiveWallCaption>(initialCaption);
  const [challenge, setChallenge] = useState<LiveWallChallenge>(initialChallenge);
  // False = the most recent read of the challenge was refused. Distinct from
  // `challenge === null`, which is a genuinely un-armed wall — the two must
  // never render the same way (guests-read-is-honest.test.ts precedent).
  const [challengeMeasured, setChallengeMeasured] = useState(initialChallengeMeasured);
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
  // The tile a guest opened. Held by feedId rather than by the tile itself so
  // the 25s poll can replace the collection underneath without the open frame
  // becoming a stale object — and so a tile the wall drops closes cleanly.
  const [openedId, setOpenedId] = useState<string | null>(null);

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
          setChallenge(null);
          setChallengeMeasured(true);
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
          challenge?: LiveWallChallenge;
          challengeMeasured?: boolean;
        };
        if (Array.isArray(data.tiles)) {
          setTiles((prev) => mergeTiles(prev, data.tiles ?? []));
        }
        if (typeof data.count === 'number') setCount(data.count);
        if (data.caption !== undefined) setCaption(data.caption);
        // The challenge read is honest — only overwrite when THIS poll
        // actually measured it. A route that predates this field (or one that
        // omitted it) must never be read as "challenge cleared".
        if (data.challenge !== undefined) setChallenge(data.challenge);
        if (typeof data.challengeMeasured === 'boolean') {
          setChallengeMeasured(data.challengeMeasured);
        }
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
  // Resolved from the CURRENT tiles every render, so a frame the couple takes
  // down mid-view closes the lightbox instead of leaving it holding a photo the
  // wall has already withdrawn.
  const opened = openedId ? (tiles.find((t) => t.feedId === openedId) ?? null) : null;
  if (display.length === 0) {
    return (
      <section
        aria-label="Live photo wall"
        className="sn-gal p-6 text-center"
      >
        <LiveWallHeader count={0} occasion={w.occasion} />
        <p className="sn-gal-soft mx-auto mt-2 max-w-prose text-sm">
          {closed
            ? // Said plainly, and without blame. The wall did not break and the
              // guest did nothing wrong — the couple chose to keep it to the
              // room. A card that simply emptied itself would read as a fault.
              `The photo wall is playing on the screens at the venue. ${w.TheOrganizer} has kept it off phones for this ${w.occasion}.`
            : stalled
              ? 'We can’t reach the wall right now — this venue’s signal may be busy. It keeps trying, and photos appear the moment it reconnects.'
              : 'The wall is warming up — photos appear here the moment they’re taken.'}
        </p>
        {closed ? null : <ChallengeBanner challenge={challenge} measured={challengeMeasured} />}
      </section>
    );
  }

  return (
    <section
      aria-label="Live photo wall"
      className="sn-gal p-5 sm:p-6"
    >
      <LiveWallHeader count={count} occasion={w.occasion} />
      <ChallengeBanner challenge={challenge} measured={challengeMeasured} />
      <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
        {display.map((tile) => (
          <figure
            key={tile.feedId}
            className={`sn-gal-tile aspect-square ${
              seededIds.current.has(tile.feedId) ? '' : 'animate-wall-enter'
            }`}
          >
            {/* "Click any tile for the lightbox" — a guest watching the wall can
                stop on one frame instead of only ever seeing it thumbnail-sized
                as it scrolls past. */}
            <button
              type="button"
              onClick={() => setOpenedId(tile.feedId)}
              aria-label="Open this photo"
              className="block h-full w-full"
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
            </button>
            {tile.url ? (
              <SavePhotoButton
                url={tile.url}
                filename={`setnayan-photo-${tile.feedId}.jpg`}
              />
            ) : null}
            {/* WHO TOOK IT. Silent when we do not know, and silent for a guest
                who has asked not to be shown. */}
            <GalleryCredit
              name={tile.capturedBy}
              capturedAt={tile.capturedAt}
              timeZone={timeZone}
              raised
            />
          </figure>
        ))}
      </div>
      {caption ? (
        <p className="sn-gal-text mt-4 border-t border-[rgb(251_250_247/0.12)] pt-3 text-center font-serif text-sm italic">
          &ldquo;{caption.text}&rdquo;
          <span className="sn-gal-soft ml-1.5 font-sans text-xs not-italic">
            — {caption.author}
          </span>
        </p>
      ) : null}
      {opened ? (
        <GalleryLightbox
          src={opened.url}
          kind="photo"
          capturedByName={opened.capturedBy}
          capturedAt={opened.capturedAt}
          timeZone={timeZone}
          onClose={() => setOpenedId(null)}
          actions={
            // NOT SavePhotoButton — that control is `absolute inset-x-0 bottom-0`
            // by design, correct pinned to a tile and wrong inside a dialog,
            // where it would leave the card and sit over its own credit.
            <a
              href={opened.url}
              target="_blank"
              rel="noopener noreferrer"
              className="sn-gal-btn inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
            >
              Open full size to save
            </a>
          }
        />
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

function LiveWallHeader({ count, occasion }: { count: number; occasion: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="sn-gal-kick inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.2em]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--sn-ob-gold)]" />
        Live from the {occasion}
      </p>
      {count > 0 ? (
        <p className="sn-gal-soft flex items-baseline gap-1">
          <span className="sn-gal-text font-serif text-xl italic leading-none tabular-nums">
            {count.toLocaleString()}
          </span>
          <span className="text-xs">moment{count === 1 ? '' : 's'} and counting</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The currently-armed Papic Challenge + who has answered it (Papic Build
 * Order §4). THE READ IS HONEST, and this must stay legible on the render:
 *
 *   measured=true,  challenge=null     → genuinely nothing armed → renders nothing.
 *   measured=false, challenge=null|set → the read was refused → says so, never
 *                                          silently drops to the row above.
 *   measured=true,  challenge=set      → the prompt + a live answered count.
 *
 * A count nobody can see is the disease this whole build exists to kill — a
 * log line never changed a pixel (guests-read-is-honest.test.ts precedent).
 */
function ChallengeBanner({
  challenge,
  measured,
}: {
  challenge: LiveWallChallenge;
  measured: boolean;
}) {
  if (!measured) {
    return (
      <p className="sn-gal-soft mt-3 text-center text-xs italic" role="status">
        Challenge status unavailable right now.
      </p>
    );
  }
  if (!challenge) return null;
  return (
    <div className="mt-3 rounded-lg border border-[rgb(251_250_247/0.14)] bg-[rgb(251_250_247/0.06)] px-3.5 py-2.5 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--sn-ob-gold)]">
        Papic Challenge
      </p>
      <p className="sn-gal-text mt-1.5 text-lg font-medium leading-snug">{challenge.prompt}</p>
      <p className="sn-gal-soft mt-1 text-xs tabular-nums">
        {challenge.answeredCount.toLocaleString()}{' '}
        {challenge.answeredCount === 1 ? 'guest has' : 'guests have'} answered
      </p>
    </div>
  );
}
