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
 *
 * theme system (2026-06-18): pass themeId to change the visual palette and
 * font. Defaults to 'moodboard' (current behaviour — inherits the event
 * mood-board CSS vars).
 *
 * preview mode: pass preview={true} in the builder's small phone frame —
 * disables the 'std-reveal-done' wait, audio autoplay, and dismiss/fullscreen.
 */

import type * as React from 'react';
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Music, Smartphone, VolumeX } from 'lucide-react';
import { type StdFilmContent } from '@/lib/save-the-date-content';
import { STD_THEMES, resolveStdTheme, type StdTheme, type StdThemeId } from '@/lib/std-themes';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';

type Slide = { key: string; node: ReactNode; dur: number };

/**
 * Override a theme's TEXT colours for legibility over a Step-1 background, while
 * keeping its accent button + display font. 'light' tone = light text (the
 * background layer has darkened the photo); 'dark' tone = dark ink (the layer
 * laid a cream wash). null → the theme's own colours, unchanged. Paired with the
 * veil in StdBackgroundLayer (lib/std-backgrounds · resolveStdLegibility).
 */
function applyTextTone(theme: StdTheme, tone: 'light' | 'dark' | null): StdTheme {
  if (!tone) return theme;
  if (tone === 'light') {
    return {
      ...theme,
      outerFg: 'text-[#fbf7f0]',
      accentText: 'text-[#fbf7f0]',
      subtleText: 'text-white/75',
      labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-white/80',
      scrubFill: 'bg-white',
    };
  }
  return {
    ...theme,
    outerFg: 'text-[#211d18]',
    accentText: 'text-[#211d18]',
    subtleText: 'text-black/65',
    labelCls: 'font-mono text-[10px] uppercase tracking-[0.3em] text-black/70',
    scrubFill: 'bg-black/70',
  };
}

/**
 * The film's monogram mark — the couple's actual SVG mark (uploaded / Cipher /
 * bespoke) when they have one, rendered as an inert <img> data-URI (object-
 * contain, never clipped); otherwise the typographic initials fallback. Used in
 * the opening monogram beat + the close beat so the film leads + lands on their
 * real mark, matching the reveal.
 */
function FilmMonogram({
  svg,
  text,
  sizeCls,
  textCls,
}: {
  svg?: string | null;
  text: string;
  sizeCls: string;
  textCls: string;
}) {
  if (svg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={bespokeSvgToDataUri(svg)} alt="" className={`${sizeCls} object-contain`} />
    );
  }
  return <div className={textCls}>{text}</div>;
}

export function SaveTheDateFilm({
  content,
  themeId,
  preview = false,
  fill = false,
  transparent = false,
  tone = null,
}: {
  content: StdFilmContent;
  /** Theme override. Defaults to 'moodboard' (inherits the event's Mood Board palette). */
  themeId?: StdThemeId;
  /** When true, renders as a contained phone-card (for the builder preview).
   *  When false (default), renders full-screen under the reveal overlay. */
  preview?: boolean;
  /** Preview-only: fill the parent (a device frame's screen) instead of a 9:16
   *  card — themed bg fills, portrait stage centered (mirrors the live desktop
   *  layout, so it reads right in both the iPhone and MacBook frames). */
  fill?: boolean;
  /** When true, the film's own stage background is transparent so the Step-1
   *  Background layer behind it shows through (Background replaces the theme bg;
   *  the theme still drives fonts + text/accent colours). 2026-06-19. */
  transparent?: boolean;
  /** Legibility text tone over a Step-1 background (lib/std-backgrounds ·
   *  resolveStdLegibility). 'light' = light text (on a darkened veil), 'dark' =
   *  dark text (on a cream veil), null = use the theme's own text colours. The
   *  veil itself is drawn by StdBackgroundLayer; this keeps the two paired. */
  tone?: 'light' | 'dark' | null;
}) {
  const base = STD_THEMES.find((t) => t.id === resolveStdTheme(themeId)) ?? STD_THEMES[0]!;
  // When a background sets a tone, override the theme's TEXT colours (not the
  // accent button / font) so names + dates always read; otherwise use the theme.
  const theme = applyTextTone(base, tone);
  const outerBgCls = transparent ? 'bg-transparent' : theme.outerBg;
  const LABEL = theme.labelCls;

  // The couple's uploaded closing video plays as a locked real-time island beat
  // (plays to the end with sound) in place of the photo gallery. Declared above
  // the slides so the video slide can bind the ref. See the orchestration
  // effect below for play/pause + music-duck handling.
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(content.videoUrl);
  // A landscape video on a portrait phone reads tiny — nudge the guest to rotate
  // (orientation spec, content phase). The hint auto-clears when they do.
  const [videoLandscape, setVideoLandscape] = useState(false);
  const [portraitPhone, setPortraitPhone] = useState(false);

  const slides: Slide[] = [];

  slides.push({
    key: 'monogram',
    dur: 4000,
    node: (
      <div className="flex flex-col items-center gap-3">
        <p className={LABEL}>Save the Date</p>
        <FilmMonogram
          svg={content.monogramSvg}
          text={content.monogram}
          sizeCls="h-28 w-28 sm:h-32 sm:w-32"
          textCls={`${theme.fontCls} text-6xl font-medium ${theme.accentText} sm:text-7xl`}
        />
        <div className={`h-px w-10 ${theme.scrubFill} opacity-40`} />
      </div>
    ),
  });

  slides.push({
    key: 'names',
    dur: 4200,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={LABEL}>Together with their families</p>
        <h1 className={`${theme.fontCls} text-5xl font-medium italic tracking-tight sm:text-6xl`}>
          {content.names}
        </h1>
        <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>are getting married</p>
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
            <div className={`${theme.fontCls} text-6xl font-medium tracking-tight sm:text-7xl`}>
              {content.dateBig}
            </div>
          ) : null}
          {content.dateLabel ? (
            <p className={`${theme.fontCls} text-2xl italic ${theme.subtleText}`}>{content.dateLabel}</p>
          ) : null}
          {content.gcalUrl || content.icsHref ? (
            <a
              href={content.gcalUrl ?? content.icsHref ?? '#'}
              {...(content.gcalUrl
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : { download: content.icsFilename })}
              onClick={(e: MouseEvent) => e.stopPropagation()}
              className={`mt-1 inline-flex items-center gap-2 rounded-full ${theme.accentBg} px-6 py-2.5 text-[13px] font-semibold ${theme.accentFgOnBg} shadow transition hover:${theme.accentBgHover}`}
            >
              Add to calendar
            </a>
          ) : null}
        </div>
      ),
    });
  }

  // Ceremony then reception — separate beats, each shown only when its venue
  // resolved (from the finalized bookings / manual fallback). The film adapts:
  // one venue → one beat; both → two; neither → skipped.
  if (content.ceremonyVenue) {
    slides.push({
      key: 'ceremony',
      dur: 4000,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The ceremony</p>
          <h2 className={`${theme.fontCls} text-4xl font-medium sm:text-5xl`}>{content.ceremonyVenue}</h2>
        </div>
      ),
    });
  }

  if (content.receptionVenue) {
    slides.push({
      key: 'reception',
      dur: 4000,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The celebration</p>
          <h2 className={`${theme.fontCls} text-4xl font-medium sm:text-5xl`}>{content.receptionVenue}</h2>
          {content.receptionCity ? (
            <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>{content.receptionCity}</p>
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
          <p className={`${theme.fontCls} text-2xl italic leading-snug ${theme.subtleText}`}>
            &ldquo;{content.storyTeaser}&rdquo;
          </p>
        </div>
      ),
    });
  }

  if (hasVideo) {
    // Video island — a locked real-time beat. The segment bar tracks the
    // video clock (not a timer), the soundtrack ducks, and the film advances
    // on 'ended' (both wired in the effects below). dur Infinity so the RAF
    // timer never advances it. The element lives in the DOM for every slide
    // (opacity-gated), so videoElRef is bound before the beat is reached.
    slides.push({
      key: 'video',
      dur: Infinity,
      node: (
        <div className="relative flex w-full max-w-sm flex-col items-center gap-3">
          <p className={LABEL}>Watch our story</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- couple-uploaded keepsake clip, no caption track */}
          <video
            ref={videoElRef}
            src={content.videoUrl ?? undefined}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setVideoLandscape(v.videoWidth > v.videoHeight * 1.1);
            }}
            className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-lg"
          />
          {!preview && videoLandscape && portraitPhone ? (
            <div className="pointer-events-none absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur-sm">
              <Smartphone aria-hidden className="h-3.5 w-3.5 rotate-90" strokeWidth={2} />
              Tilt your phone to landscape
            </div>
          ) : null}
        </div>
      ),
    });
  } else if (content.gallery && content.gallery.length > 0) {
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
        <FilmMonogram
          svg={content.monogramSvg}
          text={content.monogram}
          sizeCls="h-16 w-16 sm:h-20 sm:w-20"
          textCls={`${theme.fontCls} text-4xl font-medium ${theme.accentText}`}
        />
        <p className={`${theme.fontCls} text-3xl font-medium italic leading-tight`}>
          We can&rsquo;t wait to
          <br />
          celebrate with you
        </p>
        <p className={LABEL}>Formal invitation to follow</p>
        {content.launchLabel ? (
          <p className={`${theme.fontCls} text-sm italic ${theme.subtleText}`}>
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
              className={`inline-flex items-center gap-2 rounded-full ${theme.accentBg} px-5 py-2.5 text-[13px] font-semibold ${theme.accentFgOnBg} shadow`}
            >
              Add to calendar
            </a>
          ) : null}
        </div>
      </div>
    ),
  });

  const N = slides.length;
  const videoSlideIndex = hasVideo ? slides.findIndex((s) => s.key === 'video') : -1;
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
  // Latest video-slide index for the RAF loop + gesture guards (which close
  // over a once-built effect), and a "was on the video beat last render" flag
  // so we reset the video to its start only when the guest first reaches it.
  const videoSlideIdxRef = useRef(-1);
  videoSlideIdxRef.current = videoSlideIndex;
  const prevOnVideoRef = useRef(false);

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
        if (idxRef.current === videoSlideIdxRef.current) {
          // Video island: the segment bar follows the video clock; the beat
          // advances on 'ended' (listener below), never on a timer.
          const v = videoElRef.current;
          const d = v?.duration ?? 0;
          if (v && d && Number.isFinite(d) && d > 0) {
            setFill(idxRef.current, Math.min(100, (v.currentTime / d) * 100));
          }
        } else {
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
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // The video island hands control back to the scrub on natural end.
    const videoEl = videoElRef.current;
    const onEnded = () => go(videoSlideIdxRef.current + 1);
    if (videoEl) videoEl.addEventListener('ended', onEnded);

    return () => {
      cancelAnimationFrame(raf);
      if (videoEl) videoEl.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  // Coordinate the video island with the soundtrack. On the video beat the
  // music ducks and the video plays to the end with sound (muted in the
  // builder preview so it can autoplay); everywhere else the video is paused
  // and the music resumes when the film is playing + unmuted. Resets the video
  // to its start only on the render the guest first reaches it.
  useEffect(() => {
    // No video → leave music exactly as the existing handlers drive it.
    if (videoSlideIndex < 0) return;
    const v = videoElRef.current;
    const onVideo = idx === videoSlideIndex;
    if (onVideo && v) {
      if (!prevOnVideoRef.current) {
        try { v.currentTime = 0; } catch { /* not seekable yet — plays from 0 */ }
      }
      if (audioRef.current) audioRef.current.pause();
      v.muted = muted || preview;
      if (playing) v.play().catch(() => {});
      else v.pause();
    } else {
      if (v) v.pause();
      if (content.musicUrl && audioRef.current && !preview) {
        if (playing && !muted) audioRef.current.play().catch(() => {});
        else audioRef.current.pause();
      }
    }
    prevOnVideoRef.current = onVideo;
  }, [idx, playing, muted, videoSlideIndex, content.musicUrl, preview]);

  // Track portrait-phone orientation for the landscape-video tilt hint. Full-
  // screen only (the builder preview is a fixed device frame). Clears the moment
  // the guest rotates to landscape.
  useEffect(() => {
    if (preview || typeof window === 'undefined' || !window.matchMedia) return;
    const portrait = window.matchMedia('(orientation: portrait)');
    const update = () => setPortraitPhone(portrait.matches && window.innerWidth < 768);
    update();
    portrait.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      portrait.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, [preview]);

  // Press-and-hold pauses; a quick tap on left/right steps; the gesture also
  // unlocks audio (browser requires user gesture).
  const holdRef = useRef<number | null>(null);
  const wasHoldRef = useRef(false);
  const downXRef = useRef(0);

  const onPointerDown = (e: React.PointerEvent) => {
    downXRef.current = e.clientX;
    wasHoldRef.current = false;
    // Unlock the soundtrack on the gesture — but NOT while the video island is
    // playing (there the music stays ducked; the orchestration effect owns it).
    if (
      audioRef.current &&
      audioRef.current.paused &&
      !muted &&
      idxRef.current !== videoSlideIdxRef.current
    ) {
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

  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      const onVideo = idxRef.current === videoSlideIdxRef.current;
      if (audioRef.current) {
        audioRef.current.muted = next;
        // Only resume music on unmute when we're NOT on the ducked video beat.
        if (!next && !onVideo) audioRef.current.play().catch(() => {});
      }
      if (videoElRef.current) {
        videoElRef.current.muted = next || preview;
        if (!next && onVideo) videoElRef.current.play().catch(() => {});
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

      {/* Localized text scrim — a soft radial behind the centred text so it reads
          over a vivid photo WITHOUT washing the whole image (the global veil is
          'none' for auto photos). Pairs with the tone: light text → a dark halo,
          dark text → a cream halo. Only when a background tone is active. */}
      {tone && transparent ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              tone === 'light'
                ? 'radial-gradient(ellipse 80% 58% at 50% 47%, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.26) 45%, rgba(0,0,0,0) 72%)'
                : 'radial-gradient(ellipse 80% 58% at 50% 47%, rgba(250,247,240,0.64) 0%, rgba(250,247,240,0.32) 45%, rgba(250,247,240,0) 72%)',
          }}
        />
      ) : null}

      {/* Chrome removed (owner 2026-06-19): NO stories scrub bars, NO transport
          controls — just the texts. The film auto-plays; the guest scrubs by
          tapping the left/right thirds and holds to pause (invisible gestures,
          wired below). The lone exception is a single subtle mute, since the
          soundtrack auto-plays and needs an escape. */}
      {content.musicUrl || content.videoUrl ? (
        <div className="absolute right-4 top-5 z-20" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-current/5 opacity-50 transition-opacity hover:opacity-80"
          >
            {muted ? <VolumeX aria-hidden className="h-4 w-4" /> : <Music aria-hidden className="h-4 w-4" />}
          </button>
        </div>
      ) : null}

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

      {/* The only button: on the final beat, a single clean exit to the wedding
          page (live only — the builder preview just loops). No transport bar. */}
      {isClose && !preview ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={() => setDismissed(true)}
          className={`absolute inset-x-8 bottom-12 z-30 rounded-full ${theme.accentBg} py-3.5 text-sm font-semibold ${theme.accentFgOnBg} shadow-lg transition hover:${theme.accentBgHover}`}
        >
          See your wedding page
        </button>
      ) : null}
    </>
  );

  const stageProps = {
    ref: stageRef,
    style: {
      touchAction: 'none' as const,
      // A soft text-shadow makes the toned text pop off a busy photo (inherits
      // to all text on the stage). Only when a background tone is active.
      textShadow:
        tone === 'light'
          ? '0 1px 12px rgba(0,0,0,0.45)'
          : tone === 'dark'
            ? '0 1px 10px rgba(255,255,255,0.55)'
            : undefined,
    },
    onPointerDown,
    onPointerUp,
    onPointerCancel: () => { if (holdRef.current) window.clearTimeout(holdRef.current); },
  };

  if (preview && fill) {
    // Fill a device-frame screen: themed bg fills, portrait stage centered —
    // identical to the live desktop layout below, minus the fixed positioning.
    return (
      <div className={`absolute inset-0 flex justify-center overflow-hidden ${outerBgCls} ${theme.outerFg}`}>
        <div {...stageProps} className="relative h-full w-full max-w-sm select-none overflow-hidden">
          {filmContent}
        </div>
      </div>
    );
  }

  if (preview) {
    return (
      <div
        {...stageProps}
        className={`relative mx-auto aspect-[9/16] w-full max-w-xs select-none overflow-hidden rounded-3xl ${outerBgCls} ${theme.outerFg} shadow-xl`}
      >
        {filmContent}
      </div>
    );
  }

  // Full-screen: theme's outer bg fills the whole viewport; stage is phone-width
  // centered so the scrub bars and content look intentional on desktop.
  return (
    <div className={`fixed inset-0 z-[50] flex justify-center ${outerBgCls} ${theme.outerFg}`}>
      <div
        {...stageProps}
        className="relative h-full w-full max-w-sm select-none overflow-hidden"
      >
        {filmContent}
      </div>
    </div>
  );
}
