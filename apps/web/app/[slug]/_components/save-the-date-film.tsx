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
 * The 9-beat spine (owner 2026-06-19):
 *   1 monogram · 2 names · 3 wedding date · 4 ceremony venue · 5 reception venue
 *   · 6 "we can't wait to celebrate with you" · 7 "formal invitation to follow ·
 *   arrives XXX" · 8 the couple's video (press play → FULL SCREEN on top of
 *   everything; on end it advances) OR the photo gallery · 9 add-to-calendar.
 * Beats whose data is missing (no date, one venue, no video) are simply skipped.
 *
 * Interaction: the film auto-plays through the text beats; press-and-hold pauses,
 * a tap on the left third steps back, the right third advances. No chrome — just
 * the texts. The video beat holds until the guest presses play (or scrubs past).
 * Music auto-plays (the reveal-lift gesture has already unlocked audio).
 *
 * theme system: pass themeId to pick the display FONT (the 5 ids map to fonts;
 * colours come from the Step-1 background + legibility tone).
 *
 * preview mode: pass preview={true} in the builder's small phone frame —
 * disables the 'std-reveal-done' wait, audio autoplay, and the video fullscreen
 * (the video plays inline + muted so it animates in the device frame).
 */

import type * as React from 'react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Music, Play, VolumeX } from 'lucide-react';
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
  /** Theme override (the display font). Defaults to 'default' (Cormorant). */
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

  // The couple's uploaded video plays as beat 8: pressed it goes FULL SCREEN on
  // top of everything (never auto-plays inline); on end the film advances to the
  // calendar close. Declared above the slides so the beat can bind the ref; the
  // play handler + end/fullscreen wiring live in the effect below.
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(content.videoUrl);
  // Set by the video effect — the JSX play button calls it (deferred so it can
  // close over the live mute state; mirrors the goRef pattern).
  const playVideoRef = useRef<() => void>(() => {});

  const slides: Slide[] = [];

  // 1 — monogram / logo
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

  // 2 — names
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

  // 3 — wedding date (no add-to-calendar here — that's the closing beat)
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
        </div>
      ),
    });
  }

  // 4 — ceremony venue (shown only when the finalized ceremony booking resolved)
  if (content.ceremonyVenue) {
    slides.push({
      key: 'ceremony',
      dur: 4200,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The ceremony</p>
          <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>We&rsquo;ll exchange our vows at</p>
          <h2 className={`${theme.fontCls} text-4xl font-medium sm:text-5xl`}>{content.ceremonyVenue}</h2>
        </div>
      ),
    });
  }

  // 5 — reception venue ("and we'll celebrate together at …")
  if (content.receptionVenue) {
    slides.push({
      key: 'reception',
      dur: 4200,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The celebration</p>
          <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>And we&rsquo;ll celebrate together at</p>
          <h2 className={`${theme.fontCls} text-4xl font-medium sm:text-5xl`}>{content.receptionVenue}</h2>
          {content.receptionCity ? (
            <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>{content.receptionCity}</p>
          ) : null}
        </div>
      ),
    });
  }

  // 6 — the closing sentiment
  slides.push({
    key: 'sentiment',
    dur: 4600,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <FilmMonogram
          svg={content.monogramSvg}
          text={content.monogram}
          sizeCls="h-14 w-14 sm:h-16 sm:w-16"
          textCls={`${theme.fontCls} text-3xl font-medium ${theme.accentText}`}
        />
        <p className={`${theme.fontCls} text-3xl font-medium italic leading-tight sm:text-4xl`}>
          We can&rsquo;t wait to
          <br />
          celebrate with you
        </p>
      </div>
    ),
  });

  // 7 — formal invitation to follow · arrives XXX
  slides.push({
    key: 'invitation',
    dur: 4400,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={LABEL}>Formal invitation to follow</p>
        {content.launchLabel ? (
          <p className={`${theme.fontCls} text-3xl font-medium italic sm:text-4xl`}>
            Arrives {content.launchLabel}
          </p>
        ) : (
          <p className={`${theme.fontCls} text-2xl italic ${theme.subtleText}`}>
            Watch your inbox
          </p>
        )}
      </div>
    ),
  });

  // 8 — the couple's video (press play → FULL SCREEN) OR the photo gallery
  if (hasVideo) {
    // The video beat holds (dur Infinity) — it never auto-advances on a timer.
    // Pressing play takes the <video> full-screen on top of everything; on its
    // natural end the film advances to the calendar close (effect below). The
    // <video> lives in the DOM for every slide (opacity-gated) so videoElRef is
    // bound before the beat is reached.
    slides.push({
      key: 'video',
      dur: Infinity,
      node: (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p className={LABEL}>Watch our story</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              playVideoRef.current();
            }}
            aria-label="Play our video full screen"
            className="group relative w-full overflow-hidden rounded-2xl shadow-lg"
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- couple-uploaded keepsake clip, no caption track */}
            <video
              ref={videoElRef}
              src={content.videoUrl ?? undefined}
              playsInline
              muted
              preload="metadata"
              className="max-h-[68vh] w-full object-contain"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/15 transition group-hover:bg-black/25">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-[#1a1412] shadow-lg transition group-hover:scale-105">
                <Play aria-hidden className="h-7 w-7 translate-x-0.5" fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          </button>
          <p className={`${theme.fontCls} text-base italic ${theme.subtleText}`}>Tap to play full screen</p>
        </div>
      ),
    });
  } else if (content.gallery && content.gallery.length > 0) {
    slides.push({
      key: 'gallery',
      dur: 6500,
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

  // 9 — add to calendar (terminal beat; holds indefinitely). The ICS / Google
  // link carries both the wedding date and the invitation-launch reminder.
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
        <p className={LABEL}>Save the date</p>
        {content.dateLabel ? (
          <p className={`${theme.fontCls} text-3xl font-medium italic leading-tight`}>
            {content.dateLabel}
          </p>
        ) : null}
        {content.icsHref || content.gcalUrl ? (
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            <a
              href={content.icsHref ?? content.gcalUrl ?? '#'}
              {...(content.icsHref
                ? { download: content.icsFilename }
                : { target: '_blank', rel: 'noopener noreferrer' })}
              className={`inline-flex items-center gap-2 rounded-full ${theme.accentBg} px-6 py-3 text-[13px] font-semibold ${theme.accentFgOnBg} shadow`}
            >
              Add to calendar
            </a>
          </div>
        ) : null}
      </div>
    ),
  });

  const N = slides.length;
  const videoSlideIndex = hasVideo ? slides.findIndex((s) => s.key === 'video') : -1;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false); // starts paused; unblocks on reveal-done
  const [muted, setMuted] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const idxRef = useRef(0);
  const playingRef = useRef(false);
  const startRef = useRef(0);
  const pauseAtRef = useRef(0);
  const goRef = useRef<(j: number) => void>(() => {});
  // Latest video-slide index for the gesture guards + the video effect (which
  // close over once-built effects).
  const videoSlideIdxRef = useRef(-1);
  videoSlideIdxRef.current = videoSlideIndex;

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

  // RAF player — advances timed slides. The video beat (dur Infinity) holds
  // until the guest presses play (the video effect advances it on 'ended').
  useEffect(() => {
    let raf = 0;
    const go = (j: number) => {
      const k = Math.max(0, Math.min(N - 1, j));
      idxRef.current = k;
      setIdx(k);
      startRef.current = performance.now();
    };
    goRef.current = go;

    const loop = (now: number) => {
      if (playingRef.current) {
        const dur = slides[idxRef.current]?.dur ?? 4000;
        if (dur !== Infinity && now - startRef.current >= dur) {
          go(idxRef.current + 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  // Video beat 8 — full-screen play + advance-on-end. The play button calls
  // playVideoRef.current(): ducks the music, takes the <video> full-screen on
  // top of everything, and plays from the start. On the video's natural end (or
  // when the guest leaves full-screen) the music resumes; on 'ended' the film
  // advances to the calendar close. In preview the video just plays inline muted
  // (no fullscreen in the builder's device frame).
  useEffect(() => {
    const v = videoElRef.current;
    if (!v || videoSlideIndex < 0) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => void;
    };
    type FsVideo = HTMLVideoElement & {
      webkitRequestFullscreen?: () => void;
      webkitEnterFullscreen?: () => void;
    };
    const resumeMusic = () => {
      if (content.musicUrl && audioRef.current && !muted && !preview && playingRef.current) {
        audioRef.current.play().catch(() => {});
      }
    };

    playVideoRef.current = () => {
      try { v.currentTime = 0; } catch { /* not seekable yet — plays from 0 */ }
      if (preview) {
        v.muted = true;
        v.play().catch(() => {});
        return;
      }
      if (audioRef.current) audioRef.current.pause();
      v.muted = muted;
      const fv = v as FsVideo;
      const req = v.requestFullscreen ?? fv.webkitRequestFullscreen ?? fv.webkitEnterFullscreen;
      try { req?.call(v); } catch { /* fullscreen denied — plays inline */ }
      v.play().catch(() => {});
    };

    const onEnded = () => {
      const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
      try { exit?.call(doc); } catch { /* already exited */ }
      goRef.current(videoSlideIdxRef.current + 1);
      resumeMusic();
    };
    // Standard + WebKit (iOS native player) fullscreen-exit → pause, resume music.
    const onFsChange = () => {
      const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
      if (!fsEl) {
        v.pause();
        resumeMusic();
      }
    };

    v.addEventListener('ended', onEnded);
    v.addEventListener('webkitendfullscreen', onFsChange);
    doc.addEventListener('fullscreenchange', onFsChange);
    doc.addEventListener('webkitfullscreenchange', onFsChange as EventListener);
    return () => {
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('webkitendfullscreen', onFsChange);
      doc.removeEventListener('fullscreenchange', onFsChange);
      doc.removeEventListener('webkitfullscreenchange', onFsChange as EventListener);
    };
  }, [muted, content.musicUrl, preview, videoSlideIndex]);

  // Press-and-hold pauses; a quick tap on left/right steps; the gesture also
  // unlocks audio (browser requires user gesture).
  const holdRef = useRef<number | null>(null);
  const wasHoldRef = useRef(false);
  const downXRef = useRef(0);

  // A tap that lands on a real control (Add to calendar · play · mute) must reach
  // THAT button, not be swallowed as a film scrub/pause. The stage owns the whole
  // surface for gestures, so guard both ends on the actual hit target.
  const hitControl = (e: React.PointerEvent) =>
    Boolean((e.target as HTMLElement | null)?.closest?.('button, a'));

  const onPointerDown = (e: React.PointerEvent) => {
    if (hitControl(e)) return;
    downXRef.current = e.clientX;
    wasHoldRef.current = false;
    // Unlock the soundtrack on the gesture — but NOT while on the video beat
    // (there the music stays ducked; the video effect owns it).
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
    if (hitControl(e)) return;
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
      if (videoElRef.current) videoElRef.current.muted = next || preview;
      return next;
    });
  };

  // The Save-the-Date is the whole full-screen experience (no chrome, no page
  // beneath in this phase) — the film holds on its closing beat; there's no
  // dismiss. (owner 2026-06-19)

  // Inner JSX shared by both layout modes (preview card + full-screen).
  const filmContent = (
    <>
      {content.musicUrl ? (
        <audio ref={audioRef} src={content.musicUrl} loop muted={muted} />
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
    </>
  );

  // Full-WIDTH legibility scrim (owner 2026-06-19: "the shade needs to cover
  // full width"). A horizontal band centred vertically, fading top + bottom,
  // rendered in the OUTER full-viewport container (not the phone-width stage) so
  // it spans edge to edge behind the centred text. Pairs with the tone: light
  // text → a dark band, dark text → a cream band. Only when a background tone is
  // active (auto photos that need help reading).
  const scrimNode =
    tone && transparent ? (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            tone === 'light'
              ? 'linear-gradient(to bottom, rgba(0,0,0,0) 4%, rgba(0,0,0,0.44) 30%, rgba(0,0,0,0.44) 70%, rgba(0,0,0,0) 96%)'
              : 'linear-gradient(to bottom, rgba(250,247,240,0) 4%, rgba(250,247,240,0.6) 30%, rgba(250,247,240,0.6) 70%, rgba(250,247,240,0) 96%)',
        }}
      />
    ) : null;

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
        {scrimNode}
        <div {...stageProps} className="relative z-10 h-full w-full max-w-sm select-none overflow-hidden">
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
        {scrimNode}
        {filmContent}
      </div>
    );
  }

  // Full-screen: theme's outer bg fills the whole viewport; stage is phone-width
  // centered so the content looks intentional on desktop. The scrim sits in this
  // full-width container (behind the stage) so it spans edge to edge.
  return (
    <div className={`fixed inset-0 z-[50] flex justify-center ${outerBgCls} ${theme.outerFg}`}>
      {scrimNode}
      <div
        {...stageProps}
        className="relative z-10 h-full w-full max-w-sm select-none overflow-hidden"
      >
        {filmContent}
      </div>
    </div>
  );
}
