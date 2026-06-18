'use client';

/**
 * SaveTheDateFilm — the continuous, self-playing, scrubbable Save-the-Date
 * "film" (PR4 content layer · 0024_Save_the_Date_Content_and_Customization_2026-06-17.md).
 *
 * Renders full-screen (fixed inset-0 z-[50]) so it sits under the RevealOverlay
 * (z-[60]). When the veil or door reveal completes, it dispatches
 * 'std-reveal-done' and the film starts playing — giving the illusion that the
 * reveal literally uncovered the film already in motion beneath it. If no
 * reveal is active the film auto-starts after a short grace period.
 *
 * Interaction: press-and-hold pauses · tap left-third goes back · tap right
 * advances · tap a scrub bar jumps to that slide · replay from the close beat.
 * Music auto-plays (the reveal-lift gesture has already unlocked audio).
 *
 * After the last slide the guest can dismiss the film to reach the normal
 * wedding page below (RSVP widgets, schedule, etc.).
 */

import type * as React from 'react';
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Music,
  Pause,
  Play,
  RotateCcw,
  VolumeX,
  X,
} from 'lucide-react';
import { type StdFilmContent } from '@/lib/save-the-date-content';

type Slide = { key: string; node: ReactNode; dur: number };

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.3em] text-terracotta';

export function SaveTheDateFilm({
  content,
  preview = false,
}: {
  content: StdFilmContent;
  /** When true, renders as a contained phone-card (for the builder preview).
   *  When false (default), renders full-screen under the reveal overlay. */
  preview?: boolean;
}) {
  const slides: Slide[] = [];

  slides.push({
    key: 'monogram',
    dur: 4000,
    node: (
      <div className="flex flex-col items-center gap-3">
        <p className={LABEL}>Save the Date</p>
        <div className="font-display text-6xl font-medium text-mulberry sm:text-7xl">
          {content.monogram}
        </div>
        <div className="h-px w-10 bg-mulberry/40" />
      </div>
    ),
  });

  slides.push({
    key: 'names',
    dur: 4200,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={LABEL}>Together with their families</p>
        <h1 className="font-display text-5xl font-medium italic tracking-tight sm:text-6xl">
          {content.names}
        </h1>
        <p className="font-display text-xl italic text-ink/55">are getting married</p>
      </div>
    ),
  });

  if (content.dateBig || content.dateLabel) {
    slides.push({
      key: 'date',
      dur: 4800,
      node: (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className={LABEL}>Mark your calendars</p>
          {content.dateBig ? (
            <div className="font-display text-6xl font-medium tracking-tight sm:text-7xl">
              {content.dateBig}
            </div>
          ) : null}
          {content.dateLabel ? (
            <p className="font-display text-2xl italic text-ink/65">{content.dateLabel}</p>
          ) : null}
          {content.gcalUrl || content.icsHref ? (
            <a
              href={content.gcalUrl ?? content.icsHref ?? '#'}
              {...(content.gcalUrl
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : { download: content.icsFilename })}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-mulberry px-6 py-2.5 text-[13px] font-semibold text-cream shadow transition hover:bg-mulberry-600"
            >
              Add to calendar
            </a>
          ) : null}
        </div>
      ),
    });
  }

  if (content.venueName) {
    slides.push({
      key: 'venue',
      dur: 4000,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The celebration</p>
          <h2 className="font-display text-4xl font-medium sm:text-5xl">{content.venueName}</h2>
          {content.venueCity ? (
            <p className="font-display text-xl italic text-ink/55">{content.venueCity}</p>
          ) : null}
        </div>
      ),
    });
  }

  if (content.storyTeaser) {
    slides.push({
      key: 'story',
      dur: 4600,
      node: (
        <div className="flex max-w-xs flex-col items-center gap-3 text-center">
          <p className={LABEL}>Our story</p>
          <p className="font-display text-2xl italic leading-snug text-ink/80">
            &ldquo;{content.storyTeaser}&rdquo;
          </p>
        </div>
      ),
    });
  }

  if (content.gallery && content.gallery.length > 0) {
    slides.push({
      key: 'gallery',
      dur: 5000,
      node: (
        <div className="flex w-full max-w-xs flex-col items-center gap-3">
          <p className={LABEL}>Until then</p>
          <div className="grid w-full grid-cols-3 gap-1.5">
            {content.gallery.slice(0, 6).map((src, i) => (
              // Presigned URL — raw <img> (next/image would cache the expiry).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt=""
                loading="lazy"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ))}
          </div>
        </div>
      ),
    });
  }

  // Close beat — always last. Stays up indefinitely (dur Infinity) so the
  // guest can read and interact with the calendar links before dismissing.
  slides.push({
    key: 'close',
    dur: Infinity,
    node: (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="font-display text-4xl font-medium text-mulberry">
          {content.monogram}
        </div>
        <p className="font-display text-3xl font-medium italic leading-tight">
          We can&rsquo;t wait to
          <br />
          celebrate with you
        </p>
        <p className={LABEL}>Formal invitation to follow</p>
        {content.launchLabel ? (
          <p className="font-display text-sm italic text-ink/50">
            Arrives {content.launchLabel}
          </p>
        ) : null}
        <div
          className="mt-1 flex flex-wrap items-center justify-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {content.icsHref || content.gcalUrl ? (
            <a
              href={content.icsHref ?? content.gcalUrl ?? '#'}
              {...(content.icsHref
                ? { download: content.icsFilename }
                : { target: '_blank', rel: 'noopener noreferrer' })}
              className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-[13px] font-semibold text-cream shadow"
            >
              Add to calendar
            </a>
          ) : null}
        </div>
      </div>
    ),
  });

  const N = slides.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false); // starts paused; unblocks on reveal-done
  const [dismissed, setDismissed] = useState(false);
  const [muted, setMuted] = useState(false);

  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const startRef = useRef(0);
  const pauseAtRef = useRef(0);
  const goRef = useRef<(j: number) => void>(() => {});

  // Preview mode: start immediately (no reveal event to wait for).
  // Full-screen mode: wait for 'std-reveal-done' from the RevealOverlay;
  // fall back to auto-start after 2 s if no reveal is active.
  useEffect(() => {
    if (preview) {
      playingRef.current = true;
      setPlaying(true);
      startRef.current = performance.now();
      return;
    }
    const start = () => {
      if (playingRef.current) return;
      playingRef.current = true;
      setPlaying(true);
      startRef.current = performance.now();
      if (!muted && audioRef.current) audioRef.current.play().catch(() => {});
    };
    window.addEventListener('std-reveal-done', start, { once: true });
    const fallback = setTimeout(start, 2000);
    return () => {
      window.removeEventListener('std-reveal-done', start);
      clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  // RAF player — fills each segment and advances slides.
  useEffect(() => {
    let raf = 0;
    const setFill = (j: number, pct: number) => {
      const el = fillRefs.current[j];
      if (el) el.style.width = pct + '%';
    };
    const go = (j: number) => {
      const k = Math.max(0, Math.min(N - 1, j));
      idxRef.current = k;
      setIdx(k);
      startRef.current = performance.now();
      for (let s = 0; s < N; s++) setFill(s, s < k ? 100 : 0);
    };
    goRef.current = go;
    for (let s = 0; s < N; s++) setFill(s, 0);

    const loop = (now: number) => {
      if (playingRef.current) {
        const dur = slides[idxRef.current]?.dur ?? 4000;
        if (dur !== Infinity) {
          const e = now - startRef.current;
          const frac = Math.min(1, e / dur);
          setFill(idxRef.current, frac * 100);
          if (e >= dur) go(idxRef.current + 1);
        } else {
          setFill(idxRef.current, 100);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  // Press-and-hold pauses; a quick tap on left/right steps; the gesture also
  // unlocks audio (browser requires user gesture).
  const holdRef = useRef<number | null>(null);
  const wasHoldRef = useRef(false);
  const downXRef = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    downXRef.current = e.clientX;
    wasHoldRef.current = false;
    if (audioRef.current && audioRef.current.paused && !muted) {
      audioRef.current.play().catch(() => {});
    }
    holdRef.current = window.setTimeout(() => {
      wasHoldRef.current = true;
      if (playingRef.current) {
        playingRef.current = false;
        setPlaying(false);
        pauseAtRef.current = performance.now();
      }
    }, 240);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    if (wasHoldRef.current) {
      if (!playingRef.current) {
        startRef.current += performance.now() - pauseAtRef.current;
        playingRef.current = true;
        setPlaying(true);
      }
      return;
    }
    const r = stageRef.current?.getBoundingClientRect();
    const x = r ? e.clientX - r.left : 0;
    const w = r?.width ?? 1;
    if (x < w * 0.34) {
      goRef.current(idxRef.current - 1);
    } else {
      const next = idxRef.current + 1;
      goRef.current(next < N ? next : 0);
    }
    if (!playingRef.current) {
      playingRef.current = true;
      setPlaying(true);
    }
  };

  const playPause = () => {
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      pauseAtRef.current = performance.now();
    } else {
      startRef.current += performance.now() - pauseAtRef.current;
      playingRef.current = true;
      setPlaying(true);
    }
  };

  const replay = () => {
    playingRef.current = true;
    setPlaying(true);
    goRef.current(0);
  };

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (audioRef.current) {
        audioRef.current.muted = next;
        if (!next) audioRef.current.play().catch(() => {});
      }
      return next;
    });
  };

  // Full-screen: dismissed removes the film so the page beneath shows.
  // Preview: never dismiss — replay instead.
  if (dismissed && !preview) return null;

  const isClose = idx === N - 1;

  // Inner JSX shared by both layout modes (preview card + full-screen).
  const filmContent = (
    <>
      {content.musicUrl ? (
        <audio ref={audioRef} src={content.musicUrl} loop muted={muted} />
      ) : null}

      {/* Stories-style scrub bars */}
      <div className="absolute inset-x-4 top-4 z-20 flex gap-1.5">
        {slides.map((s, j) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Go to slide ${j + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              goRef.current(j);
              if (!playingRef.current) {
                playingRef.current = true;
                setPlaying(true);
              }
            }}
            className="h-[2px] flex-1 overflow-hidden rounded-full bg-ink/15"
          >
            <span
              ref={(el) => { fillRefs.current[j] = el; }}
              className="block h-full w-0 bg-mulberry"
            />
          </button>
        ))}
      </div>

      {/* Top-right controls */}
      <div
        className="absolute right-4 top-6 z-20 flex items-center gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {content.musicUrl ? (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute music' : 'Mute music'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/50 hover:bg-ink/10"
          >
            {muted ? <VolumeX aria-hidden className="h-4 w-4" /> : <Music aria-hidden className="h-4 w-4" />}
          </button>
        ) : null}
        {isClose ? (
          <button
            type="button"
            onClick={preview ? replay : () => setDismissed(true)}
            aria-label={preview ? 'Replay film' : 'Continue to invitation page'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/50 hover:bg-ink/10"
          >
            {preview ? <RotateCcw aria-hidden className="h-4 w-4" /> : <X aria-hidden className="h-4 w-4" />}
          </button>
        ) : null}
      </div>

      {/* Slides */}
      <div className="absolute inset-0">
        {slides.map((s, j) => (
          <div
            key={s.key}
            className={`absolute inset-0 flex flex-col items-center justify-center px-10 text-center transition-opacity duration-500 ${
              j === idx ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            aria-hidden={j !== idx}
          >
            {s.node}
          </div>
        ))}
      </div>

      {/* Close slide — prominent "See your wedding page" CTA (full-screen only).
          Positioned above the small transport bar so it's unmissable on desktop. */}
      {isClose && !preview ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={() => setDismissed(true)}
          className="absolute inset-x-8 bottom-24 z-30 rounded-full bg-mulberry py-3.5 text-sm font-semibold text-cream shadow-lg transition hover:bg-mulberry-600"
        >
          See your wedding page
        </button>
      ) : null}

      {/* Bottom transport */}
      <div
        className="absolute inset-x-0 bottom-8 z-20 flex items-center justify-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => goRef.current(idxRef.current - 1)}
          aria-label="Previous slide"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:border-ink/30"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={isClose ? replay : playPause}
          aria-label={isClose ? 'Replay film' : playing ? 'Pause' : 'Play'}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/65 hover:border-ink/30"
        >
          {isClose ? (
            <RotateCcw aria-hidden className="h-4 w-4" />
          ) : playing ? (
            <Pause aria-hidden className="h-4 w-4" />
          ) : (
            <Play aria-hidden className="h-4 w-4" />
          )}
        </button>

        {isClose ? (
          <button
            type="button"
            onClick={preview ? replay : () => setDismissed(true)}
            aria-label={preview ? 'Replay film' : 'Continue to invitation page'}
            className="flex h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-xs font-medium text-ink/55 hover:border-ink/30"
          >
            {preview ? 'Replay' : 'Continue'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goRef.current(idxRef.current + 1)}
            aria-label="Next slide"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/15 text-ink/55 hover:border-ink/30"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );

  const stageProps = {
    ref: stageRef,
    style: { touchAction: 'none' as const },
    onPointerDown,
    onPointerUp,
    onPointerCancel: () => { if (holdRef.current) window.clearTimeout(holdRef.current); },
  };

  if (preview) {
    return (
      <div
        {...stageProps}
        className="relative mx-auto aspect-[9/16] w-full max-w-xs select-none overflow-hidden rounded-3xl bg-cream text-ink shadow-xl"
      >
        {filmContent}
      </div>
    );
  }

  // Full-screen: cream backdrop fills the whole viewport; stage is phone-width
  // centered so the scrub bars and content look intentional on desktop.
  return (
    <div className="fixed inset-0 z-[50] flex justify-center bg-cream text-ink">
      <div
        {...stageProps}
        className="relative h-full w-full max-w-sm select-none overflow-hidden"
      >
        {filmContent}
      </div>
    </div>
  );
}
