'use client';

/**
 * SaveTheDateFilm — the continuous, self-playing, scrubbable Save-the-Date
 * "film" (the PR4 content layer · build plan P1).
 *
 *   Design + spine : 0024_save_the_date/0024_Save_the_Date_Content_and_Customization_2026-06-17.md
 *
 * The save-the-date as one auto-playing piece: it opens on the monogram and
 * advances through the content beats to the last slide, on its own. The guest
 * can pause (press-and-hold), step (tap the left/right side), jump (tap a bar
 * at the top — the stories-style scrub), and replay. Music plays throughout
 * (mute toggle). It can go fullscreen. At the end, the add-to-calendar appears.
 *
 * Colours come from the couple's Mood Board via the site palette CSS vars
 * already applied by the page (cream / ink / mulberry / terracotta), so the
 * film recolours per event at zero cost.
 *
 * Mounts UNDER the reveal opening: RevealOverlay lifts → this film is revealed.
 * Adaptive — it only renders beats it has data for (the couple's builder, P4,
 * supplies split venues + media; until then it gracefully shows fewer slides).
 */

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Music, Pause, Play, RotateCcw, VolumeX } from 'lucide-react';

export type StdFilmContent = {
  monogram: string;
  names: string;
  dateBig: string | null;
  dateLabel: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  storyTeaser?: string | null;
  websiteUrl?: string | null;
  gcalUrl?: string | null;
  icsHref?: string | null;
  icsFilename: string;
  musicUrl?: string | null;
};

type Slide = { key: string; node: React.ReactNode; dur: number };

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.3em] text-terracotta';

export function SaveTheDateFilm({ content }: { content: StdFilmContent }) {
  const slides: Slide[] = [];
  slides.push({
    key: 'monogram',
    dur: 4000,
    node: (
      <div className="flex flex-col items-center">
        <div className="font-display text-5xl font-medium text-mulberry">{content.monogram}</div>
        <div className="my-3 h-px w-12 bg-mulberry/60" />
        <p className={LABEL}>Save the date</p>
      </div>
    ),
  });
  slides.push({
    key: 'names',
    dur: 3800,
    node: (
      <div className="flex flex-col items-center gap-2">
        <p className={LABEL}>Together with their families</p>
        <h1 className="font-display text-4xl font-medium italic tracking-tight sm:text-5xl">{content.names}</h1>
        <p className="font-display text-lg italic text-ink/60">are getting married</p>
      </div>
    ),
  });
  if (content.dateBig || content.dateLabel) {
    slides.push({
      key: 'date',
      dur: 4600,
      node: (
        <div className="flex flex-col items-center gap-4">
          {content.dateBig ? (
            <div className="font-display text-5xl font-medium tracking-tight sm:text-6xl">{content.dateBig}</div>
          ) : null}
          {content.dateLabel ? <p className={LABEL}>{content.dateLabel}</p> : null}
          {content.gcalUrl || content.icsHref ? (
            <a
              href={content.gcalUrl ?? content.icsHref ?? '#'}
              {...(content.gcalUrl
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : { download: content.icsFilename })}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2.5 text-[13px] font-semibold text-cream shadow transition hover:bg-mulberry-600"
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
      dur: 3900,
      node: (
        <div className="flex flex-col items-center gap-2">
          <p className={LABEL}>The celebration</p>
          <h2 className="font-display text-3xl font-medium">{content.venueName}</h2>
          {content.venueCity ? <p className="font-display text-lg italic text-ink/60">{content.venueCity}</p> : null}
        </div>
      ),
    });
  }
  if (content.storyTeaser) {
    slides.push({
      key: 'story',
      dur: 4200,
      node: (
        <div className="flex max-w-[15rem] flex-col items-center gap-2">
          <p className={LABEL}>Our story</p>
          <p className="font-display text-xl italic leading-snug text-ink/80">“{content.storyTeaser}”</p>
        </div>
      ),
    });
  }
  slides.push({
    key: 'close',
    dur: 5200,
    node: (
      <div className="flex flex-col items-center gap-3">
        <div className="font-display text-2xl font-medium text-mulberry">{content.monogram}</div>
        <p className="font-display text-2xl font-medium italic leading-tight">
          We can’t wait to
          <br />
          celebrate with you
        </p>
        <p className={LABEL}>Formal invitation to follow</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
          {content.gcalUrl || content.icsHref ? (
            <a
              href={content.gcalUrl ?? content.icsHref ?? '#'}
              {...(content.gcalUrl
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : { download: content.icsFilename })}
              className="inline-flex items-center gap-2 rounded-full bg-mulberry px-4 py-2 text-[12px] font-semibold text-cream"
            >
              Add to calendar
            </a>
          ) : null}
          {content.websiteUrl ? (
            <a
              href={content.websiteUrl}
              className="inline-flex items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-[12px] font-medium text-ink/70"
            >
              See details
            </a>
          ) : null}
        </div>
      </div>
    ),
  });

  const N = slides.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [done, setDone] = useState(false);
  const [muted, setMuted] = useState(false);
  const [immersive, setImmersive] = useState(false);

  const fillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const idxRef = useRef(0);
  const playingRef = useRef(true);
  const doneRef = useRef(false);
  const startRef = useRef(0);
  const pauseAtRef = useRef(0);
  const goRef = useRef<(j: number) => void>(() => {});

  // The raf player — advances slides, fills the active scrub segment.
  useEffect(() => {
    let raf = 0;
    startRef.current = performance.now();
    const setFill = (j: number, pct: number) => {
      const el = fillRefs.current[j];
      if (el) el.style.width = pct + '%';
    };
    const go = (j: number) => {
      const k = Math.max(0, Math.min(N - 1, j));
      idxRef.current = k;
      setIdx(k);
      doneRef.current = false;
      setDone(false);
      startRef.current = performance.now();
      for (let s = 0; s < N; s++) setFill(s, s < k ? 100 : 0);
    };
    goRef.current = go;
    for (let s = 0; s < N; s++) setFill(s, 0);
    const loop = (now: number) => {
      if (playingRef.current && !doneRef.current) {
        const e = now - startRef.current;
        const dur = slides[idxRef.current]?.dur ?? 3500;
        const frac = Math.min(1, e / dur);
        setFill(idxRef.current, frac * 100);
        if (e >= dur) {
          if (idxRef.current < N - 1) go(idxRef.current + 1);
          else {
            doneRef.current = true;
            setDone(true);
            playingRef.current = false;
            setPlaying(false);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  // Best-effort music auto-start. The film mounts UNDER the reveal opening, so
  // by the time it's visible the guest has already tapped to lift the veil —
  // that document gesture unlocks audio, so this play() succeeds in the real
  // flow. If it's blocked (film viewed standalone, no prior gesture), the
  // pointer-down handler below unlocks it on the first interaction instead.
  useEffect(() => {
    if (!content.musicUrl || muted) return;
    audioRef.current?.play().catch(() => {});
  }, [content.musicUrl, muted]);

  const playPause = () => {
    if (doneRef.current) {
      doneRef.current = false;
      setDone(false);
      playingRef.current = true;
      setPlaying(true);
      goRef.current(0);
      return;
    }
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

  // Press-and-hold pauses; a quick tap on the left/right side steps; the gesture
  // also unlocks audio + fullscreen (the browser requires a user gesture).
  const holdRef = useRef<number | null>(null);
  const wasHoldRef = useRef(false);
  const downXRef = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    downXRef.current = e.clientX;
    wasHoldRef.current = false;
    if (audioRef.current && audioRef.current.paused && !muted) audioRef.current.play().catch(() => {});
    holdRef.current = window.setTimeout(() => {
      wasHoldRef.current = true;
      if (playingRef.current && !doneRef.current) {
        playingRef.current = false;
        setPlaying(false);
        pauseAtRef.current = performance.now();
      }
    }, 240);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    if (wasHoldRef.current) {
      if (!playingRef.current && !doneRef.current) {
        startRef.current += performance.now() - pauseAtRef.current;
        playingRef.current = true;
        setPlaying(true);
      }
      return;
    }
    const r = stageRef.current?.getBoundingClientRect();
    const x = r ? e.clientX - r.left : 0;
    const w = r?.width ?? 1;
    if (x < w * 0.34) goRef.current(idxRef.current - 1);
    else goRef.current(idxRef.current < N - 1 ? idxRef.current + 1 : 0);
    if (!playingRef.current) {
      playingRef.current = true;
      setPlaying(true);
    }
  };

  const toggleFullscreen = () => {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setImmersive((v) => !v));
    } else {
      setImmersive((v) => !v);
    }
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

  return (
    <div
      ref={stageRef}
      className={`relative mx-auto flex aspect-[9/16] w-full max-w-sm select-none flex-col overflow-hidden rounded-3xl bg-cream text-ink shadow-xl ${
        immersive ? 'fixed inset-0 z-[80] max-w-none rounded-none' : ''
      }`}
      style={{ touchAction: 'none' }}
    >
      {content.musicUrl ? <audio ref={audioRef} src={content.musicUrl} loop muted={muted} /> : null}

      {/* stories-style scrub bar */}
      <div className="absolute inset-x-3 top-3 z-20 flex gap-1.5">
        {slides.map((s, j) => (
          <button
            key={s.key}
            type="button"
            aria-label={`Go to slide ${j + 1}`}
            onClick={(e) => {
              e.stopPropagation();
              goRef.current(j);
              if (!playingRef.current && !doneRef.current) {
                playingRef.current = true;
                setPlaying(true);
              }
            }}
            className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/15"
          >
            <span
              ref={(el) => {
                fillRefs.current[j] = el;
              }}
              className="block h-full w-0 bg-mulberry"
            />
          </button>
        ))}
      </div>

      {/* top-right controls */}
      <div className="absolute right-3 top-7 z-20 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
        {content.musicUrl ? (
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute music' : 'Mute music'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/60"
          >
            {muted ? <VolumeX aria-hidden className="h-4 w-4" /> : <Music aria-hidden className="h-4 w-4" />}
          </button>
        ) : null}
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Toggle fullscreen"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink/60"
        >
          <Maximize2 aria-hidden className="h-4 w-4" />
        </button>
      </div>

      {/* slides */}
      <div className="absolute inset-0" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {slides.map((s, j) => (
          <div
            key={s.key}
            className={`absolute inset-0 flex flex-col items-center justify-center px-8 text-center transition-opacity duration-500 ${
              j === idx ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden={j !== idx}
          >
            {s.node}
          </div>
        ))}
      </div>

      {/* bottom transport */}
      <div className="absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => goRef.current(idxRef.current - 1)}
          aria-label="Previous"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-ink/60"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={playPause}
          aria-label={done ? 'Replay' : playing ? 'Pause' : 'Play'}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-ink/70"
        >
          {done ? <RotateCcw aria-hidden className="h-4 w-4" /> : playing ? <Pause aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => goRef.current(idxRef.current < N - 1 ? idxRef.current + 1 : 0)}
          aria-label="Next"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-ink/15 text-ink/60"
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
