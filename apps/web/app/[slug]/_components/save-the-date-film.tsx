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
import { Music, VolumeX } from 'lucide-react';
import { type StdFilmContent } from '@/lib/save-the-date-content';
import { STD_THEMES, resolveStdTheme, type StdTheme, type StdThemeId } from '@/lib/std-themes';
import { readableTextOn } from '@/lib/site-palette';
import { bespokeSvgToDataUri } from '@/lib/bespoke-monogram-shared';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import { type MonogramConfig } from '@/lib/monogram';

/**
 * Set an <audio>/<video> volume safely. The HTML spec requires the setter to
 * THROW (`IndexSizeError`) for any value outside [0,1] — every conforming engine
 * (Blink, WebKit, Gecko) throws; none silently clamps. (Desktop Chrome didn't
 * crash here only because those sessions never produced an out-of-range value,
 * not because it clamps.) So we keep the value in range ourselves before every
 * write: clamp finite values to [0,1], and SKIP non-finite ones — a NaN/Infinity
 * (e.g. from a detached/unloaded media element, or a non-monotonic clock making
 * the fade ratio NaN) must NOT reach the setter. A bare `v<0?0:v>1?1:v` would
 * leak NaN straight through (`NaN<0` and `NaN>1` are both false), so the
 * Number.isFinite guard is load-bearing, not decorative. Skipping leaves the
 * volume untouched for that frame — inaudible, and the next frame self-corrects.
 * (Fixes the /[slug] Save-the-Date crossfade crash · Sentry 2026-06-19; the NaN
 * guard closes the residual path the first clamp left open.)
 */
function setVol(el: HTMLMediaElement | null, v: number) {
  if (!el || !Number.isFinite(v)) return;
  el.volume = v < 0 ? 0 : v > 1 ? 1 : v;
}

type Slide = {
  key: string;
  node: ReactNode;
  dur: number;
  /** A UNIQUE entrance animation per beat (owner 2026-06-19 "a unique way to
   *  animate each information"). CSS `animation` shorthand referencing the
   *  keyframes in FILM_ANIM_CSS; replays each time the beat becomes active. */
  anim: string;
};

/**
 * Per-beat entrance keyframes — one distinct motion per piece of information so
 * each beat reveals its own way (bloom · rise · zoom · slide-in L/R · breathe ·
 * blur-in · pop · soft-rise). Injected once via a <style> tag in the film; the
 * active slide applies its `anim` inline (so it re-fires on every visit, forward
 * or scrubbed back). `both` fill-mode holds the final resting state.
 */
const FILM_ANIM_CSS = `
@keyframes stdBloom { from { opacity: 0; transform: scale(.62); filter: blur(6px); } to { opacity: 1; transform: scale(1); filter: blur(0); } }
@keyframes stdRise { from { opacity: 0; transform: translateY(34px); } to { opacity: 1; transform: translateY(0); } }
@keyframes stdZoom { from { opacity: 0; transform: scale(1.32); } to { opacity: 1; transform: scale(1); } }
@keyframes stdSlideL { from { opacity: 0; transform: translateX(-54px); } to { opacity: 1; transform: translateX(0); } }
@keyframes stdSlideR { from { opacity: 0; transform: translateX(54px); } to { opacity: 1; transform: translateX(0); } }
@keyframes stdBreathe { from { opacity: 0; transform: scale(1.1); } 60% { opacity: 1; } to { opacity: 1; transform: scale(1); } }
@keyframes stdBlurIn { from { opacity: 0; filter: blur(12px); letter-spacing: .12em; } to { opacity: 1; filter: blur(0); letter-spacing: normal; } }
@keyframes stdPop { from { opacity: 0; transform: scale(.88); } to { opacity: 1; transform: scale(1); } }
@keyframes stdRiseSoft { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) {
  .std-anim { animation: none !important; }
}
`;

// The film is composed at ONE fixed logical size (a portrait "design canvas")
// and the whole stage is uniformly transform-scaled to fit the screen (owner
// 2026-06-19: "take the maximum width always without causing the texts to
// exceed both width and height, and keep everything at the same size"). So every
// element keeps its proportions and the type/monogram are sized ONCE here — no
// responsive breakpoints (which scaled in steps + fought the transform). The fit
// scale = min(containerW / BASE_W, containerH / BASE_H) — the largest scale that
// fits within BOTH dimensions, i.e. maximum size without overflowing either.
const BASE_W = 440;
const BASE_H = 780;
const FIT_MIN = 0.6;
const FIT_MAX = 2.3;

const EASE = 'cubic-bezier(.2,.8,.2,1)';
const ANIM = {
  bloom: `stdBloom 900ms ${EASE} both`,
  rise: `stdRise 800ms ${EASE} both`,
  zoom: `stdZoom 820ms ${EASE} both`,
  slideL: `stdSlideL 820ms ${EASE} both`,
  slideR: `stdSlideR 820ms ${EASE} both`,
  breathe: `stdBreathe 1100ms ease-out both`,
  blurIn: `stdBlurIn 950ms ease-out both`,
  pop: `stdPop 700ms ${EASE} both`,
  riseSoft: `stdRiseSoft 1000ms ease-out both`,
} as const;

/**
 * The couple's ONBOARDING lockup — their chosen monogram design (bar / duo /
 * script / infinity, framed, or the initials circle) from onboarding. The film
 * renders THIS as the mark when they have NO uploaded/lab SVG (owner 2026-06-19:
 * "logo will be from the onboarding, but if they upload or use the monogram lab,
 * it will bypass the onboarding logo"). Reuses HeroMonogram — the one canonical
 * lockup renderer — so the film matches the hero/chrome/QR mark exactly.
 */
export type StdLockup = {
  /** events monogram design columns (HeroMonogram reads these). */
  design: {
    monogram_style?: string | null;
    monogram_font_key?: string | null;
    monogram_frame_key?: string | null;
  };
  /** Resolved monogram config (text + colour + chosen face). */
  monogram: MonogramConfig;
};

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
      labelCls: 'font-mono text-sm uppercase tracking-[0.18em] text-white/90',
      scrubFill: 'bg-white',
    };
  }
  return {
    ...theme,
    outerFg: 'text-[#211d18]',
    accentText: 'text-[#211d18]',
    subtleText: 'text-black/65',
    labelCls: 'font-mono text-sm uppercase tracking-[0.18em] text-black/80',
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
  textStyle,
  lockup,
  lockupScaleCls,
}: {
  svg?: string | null;
  text: string;
  sizeCls: string;
  textCls: string;
  /** Inline colour for the text-initials fallback — the couple's accent hex when
   *  no legibility tone is forcing light/dark text (the svg/lockup marks carry
   *  their own ink, so this only colours path 3). */
  textStyle?: React.CSSProperties;
  /** The onboarding lockup — rendered when there's no uploaded/lab SVG. */
  lockup?: StdLockup | null;
  /** Fixed Tailwind scale class for the 80px HeroMonogram so it fills this beat
   *  (the stage's transform-scale handles all responsiveness — no breakpoints). */
  lockupScaleCls: string;
}) {
  // 1 · uploaded / monogram-lab mark wins (bypasses the onboarding logo).
  if (svg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={bespokeSvgToDataUri(svg)} alt="" className={`${sizeCls} object-contain`} />
    );
  }
  // 2 · else the couple's onboarding lockup (their real chosen design).
  if (lockup) {
    return (
      <div aria-hidden className={`inline-flex origin-center items-center justify-center ${lockupScaleCls}`}>
        <HeroMonogram
          event={lockup.design}
          monogram={lockup.monogram}
          animatedMonogram={false}
          bespokeSvg={null}
        />
      </div>
    );
  }
  // 3 · last-resort initials in the film's own font (safety net).
  return (
    <div className={textCls} style={textStyle}>
      {text}
    </div>
  );
}

export function SaveTheDateFilm({
  content,
  themeId,
  preview = false,
  fill = false,
  transparent = false,
  tone = null,
  lockup = null,
  accentHex = null,
}: {
  content: StdFilmContent;
  /** Theme override (the display font). Defaults to 'default' (Cormorant). */
  themeId?: StdThemeId;
  /** The film's accent colour (button + accent marks) as a `#rrggbb` hex —
   *  resolved upstream as the couple's manual override ?? their Mood-Board
   *  accent ?? brand mulberry. null → the theme's mulberry Tailwind classes
   *  (the no-hex fallback). Tailwind JIT can't emit a runtime hex, so when set
   *  it's applied as an inline style; the button text is derived contrast-safe. */
  accentHex?: string | null;
  /** The couple's onboarding lockup — the mark shown when there's no uploaded /
   *  monogram-lab SVG (content.monogramSvg). null → text-initials fallback. */
  lockup?: StdLockup | null;
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

  // Accent — the couple's colour for the CTA button + accent marks. The BUTTON
  // always uses the accent (solid fill; its text is derived contrast-safe), so
  // it stays on-brand on any background. The accent MARKS (beat-1 divider +
  // the text-initials fallback) take the accent ONLY when no legibility tone is
  // active — with a photo background + tone, tone wins for readability. When
  // accentHex is null we keep the theme's mulberry Tailwind classes.
  const accentBtnCls = accentHex ? '' : `${theme.accentBg} ${theme.accentFgOnBg}`;
  const accentBtnStyle: React.CSSProperties | undefined = accentHex
    ? { backgroundColor: accentHex, color: readableTextOn(accentHex) }
    : undefined;
  const accentMarkHex = accentHex && tone === null ? accentHex : null;
  const accentMarkStyle: React.CSSProperties | undefined = accentMarkHex
    ? { color: accentMarkHex }
    : undefined;
  const accentMarkCls = accentMarkHex ? '' : theme.accentText;
  const dividerCls = accentMarkHex ? '' : theme.scrubFill;
  const dividerStyle: React.CSSProperties | undefined = accentMarkHex
    ? { backgroundColor: accentMarkHex }
    : undefined;

  // The couple's uploaded video plays as beat 8: pressed it goes FULL SCREEN on
  // top of everything (never auto-plays inline); on end the film advances to the
  // calendar close. Declared above the slides so the beat can bind the ref; the
  // play handler + end/fullscreen wiring live in the effect below.
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = Boolean(content.videoUrl);
  // "Was on the video beat last render" — so the orchestration resets the clip
  // to its start (and silences it for the fade-up) only when the guest FIRST
  // reaches the video beat, not on every re-render while it plays.
  const prevOnVideoRef = useRef(false);

  const slides: Slide[] = [];

  // 1 — monogram / logo
  slides.push({
    key: 'monogram',
    dur: 4000,
    anim: ANIM.bloom,
    node: (
      <div className="flex flex-col items-center gap-3">
        <p className={LABEL}>Save the Date</p>
        <FilmMonogram
          svg={content.monogramSvg}
          text={content.monogram}
          lockup={lockup}
          lockupScaleCls="scale-[1.8]"
          sizeCls="h-36 w-36"
          textCls={`${theme.fontCls} text-7xl font-medium ${accentMarkCls}`}
          textStyle={accentMarkStyle}
        />
        <div className={`h-px w-10 ${dividerCls} opacity-40`} style={dividerStyle} />
      </div>
    ),
  });

  // 2 — names
  slides.push({
    key: 'names',
    dur: 4200,
    anim: ANIM.rise,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={LABEL}>Together with their families</p>
        <h1 className={`${theme.fontCls} text-6xl font-medium italic tracking-tight`}>
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
      anim: ANIM.zoom,
      node: (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className={LABEL}>Mark your calendars</p>
          {/* ONE date (owner 2026-06-19 "date showed twice"): the long-form is
              the hero; the compact MM.DD.YY is only a fallback when there's no
              long form. */}
          {content.dateLabel ? (
            <div className={`${theme.fontCls} text-6xl font-medium tracking-tight`}>
              {content.dateLabel}
            </div>
          ) : content.dateBig ? (
            <div className={`${theme.fontCls} text-7xl font-medium tracking-tight`}>
              {content.dateBig}
            </div>
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
      anim: ANIM.slideL,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The ceremony</p>
          <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>We&rsquo;ll exchange our vows at</p>
          <h2 className={`${theme.fontCls} text-5xl font-medium`}>{content.ceremonyVenue}</h2>
        </div>
      ),
    });
  }

  // 5 — reception venue ("and we'll celebrate together at …")
  if (content.receptionVenue) {
    slides.push({
      key: 'reception',
      dur: 4200,
      anim: ANIM.slideR,
      node: (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className={LABEL}>The celebration</p>
          <p className={`${theme.fontCls} text-xl italic ${theme.subtleText}`}>And we&rsquo;ll celebrate together at</p>
          <h2 className={`${theme.fontCls} text-5xl font-medium`}>{content.receptionVenue}</h2>
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
    anim: ANIM.breathe,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <FilmMonogram
          svg={content.monogramSvg}
          text={content.monogram}
          lockup={lockup}
          lockupScaleCls="scale-[0.9]"
          sizeCls="h-16 w-16"
          textCls={`${theme.fontCls} text-3xl font-medium ${accentMarkCls}`}
          textStyle={accentMarkStyle}
        />
        <p className={`${theme.fontCls} text-4xl font-medium italic leading-tight`}>
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
    anim: ANIM.blurIn,
    node: (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className={LABEL}>Formal invitation to follow</p>
        {content.launchLabel ? (
          <p className={`${theme.fontCls} text-4xl font-medium italic`}>
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

  // 8 — the couple's video (AUTOPLAYS inline) OR the photo gallery
  if (hasVideo) {
    // The video beat holds (dur Infinity) — it AUTOPLAYS (owner 2026-06-19 "the
    // video should autoplay, no more clicking") and plays FULL SCREEN, on top of
    // everything (owner 2026-06-19 "why is the video not full screen"). On the
    // live page the actual <video> is the full-screen overlay rendered in the
    // return below (videoElRef binds there); this beat just holds the label
    // beneath it. In the builder preview the video plays INLINE in the device
    // frame instead (a fixed overlay would escape the frame). It crossfades the
    // soundtrack + advances to the calendar close on its natural end.
    slides.push({
      key: 'video',
      dur: Infinity,
      anim: ANIM.pop,
      node: preview ? (
        <div className="flex w-full max-w-sm flex-col items-center gap-4">
          <p className={LABEL}>Watch our story</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- couple-uploaded keepsake clip, no caption track */}
          <video
            ref={videoElRef}
            src={content.videoUrl ?? undefined}
            playsInline
            preload="auto"
            className="max-h-[520px] w-full rounded-2xl object-contain shadow-lg"
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className={LABEL}>Watch our story</p>
        </div>
      ),
    });
  } else if (content.gallery && content.gallery.length > 0) {
    slides.push({
      key: 'gallery',
      dur: 6500,
      anim: ANIM.zoom,
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
    anim: ANIM.riseSoft,
    node: (
      <div className="flex flex-col items-center gap-4 text-center">
        <FilmMonogram
          svg={content.monogramSvg}
          text={content.monogram}
          lockup={lockup}
          lockupScaleCls="scale-[1.1]"
          sizeCls="h-24 w-24"
          textCls={`${theme.fontCls} text-4xl font-medium ${accentMarkCls}`}
          textStyle={accentMarkStyle}
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
              className={`inline-flex items-center gap-2 rounded-full ${accentBtnCls} px-6 py-3 text-base font-semibold shadow`}
              style={accentBtnStyle}
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
  // Has the guest ever advanced by hand? Drives the "Swipe up to continue" hint
  // (Guest Legibility Floor: a gesture is never the only way — it needs a visible
  // instruction). The hint shows at the start + on the held video beat, and fades
  // once the guest has moved through it once. (A hint, not chrome — owner kept the
  // "just the texts" film; this matches the approved veil hint pattern.)
  const [advanced, setAdvanced] = useState(false);
  const advancedRef = useRef(false);
  const markAdvanced = () => {
    if (!advancedRef.current) {
      advancedRef.current = true;
      setAdvanced(true);
    }
  };

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

  // Uniform fit-to-screen scale (owner 2026-06-19). The container is measured;
  // the BASE_W×BASE_H stage is transform-scaled by `fitScale` to the largest
  // size that fits within both dimensions, keeping every element proportional.
  const containerRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      if (cw < 2 || ch < 2) return;
      const s = Math.min(cw / BASE_W, ch / BASE_H);
      setFitScale(Math.max(FIT_MIN, Math.min(FIT_MAX, s)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // When does the content start advancing?
  // - Preview: immediately.
  // - A reveal IS active: ONLY once the veil/door is fully lifted ('std-reveal-
  //   done'). The content must NOT play under the veil (owner 2026-06-19) — so
  //   there's no early timer here. (If the reveal can't run — e.g. WebGL fails —
  //   veil-reveal fires 'std-reveal-done' itself, so we never hang.)
  // - No reveal: start after a short grace.
  // The reveal sets window.__stdRevealActive when it will show; we read it after
  // a tick so the reveal has mounted.
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
    // No-reveal path only: start after a grace once we know no reveal armed.
    const graceStart = window.setTimeout(() => {
      const revealActive = (window as Window & { __stdRevealActive?: boolean }).__stdRevealActive;
      if (!revealActive) start();
    }, 700);
    return () => {
      window.removeEventListener('std-reveal-done', start);
      clearTimeout(graceStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  // RAF player — advances timed slides. The video beat (dur Infinity) holds on
  // a timer; it autoplays and the video effect advances it on 'ended'.
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

  // Video beat — AUTOPLAY + audio CROSSFADE (owner 2026-06-19). The video plays
  // by itself when its beat is active (the reveal gesture already granted the
  // page media playback). The soundtrack CROSSFADES to the video's audio as it
  // plays, then crossfades back to the music when the film returns to the
  // closing screen. On the video's natural end the film advances to the calendar
  // close. The whole experience is already full screen (Fullscreen API on the
  // reveal-lift), so the video plays inline within it.
  useEffect(() => {
    const v = videoElRef.current;
    if (videoSlideIndex < 0 || !v) return;
    const a = audioRef.current;
    const onVideo = idx === videoSlideIndex;

    // Gentle ~700ms audio dissolve between the music and the video. When the
    // music fades to 0 (entering the video) it then PAUSES, so it HOLDS its
    // position and resumes from there afterwards — it must never restart from
    // the beginning (owner 2026-06-19), which a still-playing `loop`-ed track
    // would do by looping back to 0 during a long clip.
    let fade = 0;
    const crossfade = (musicTo: number, videoTo: number, pauseMusicAtEnd = false) => {
      cancelAnimationFrame(fade);
      const m0 = a?.volume ?? 1;
      const v0 = v.volume;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / 700);
        setVol(a, m0 + (musicTo - m0) * p);
        setVol(v, v0 + (videoTo - v0) * p);
        if (p < 1) {
          fade = requestAnimationFrame(tick);
        } else if (pauseMusicAtEnd && a) {
          a.pause(); // hold the song's position; it resumes here after the video
        }
      };
      fade = requestAnimationFrame(tick);
    };

    if (onVideo) {
      if (!prevOnVideoRef.current) {
        try { v.currentTime = 0; } catch { /* not seekable yet — plays from 0 */ }
        setVol(v, 0); // start silent, fade up
      }
      v.muted = muted || preview;
      if (playing) v.play().catch(() => {}); else v.pause();
      crossfade(0, 1, true); // music fades out → PAUSES (holds position); video fades in
    } else {
      // Resume the music FROM WHERE IT PAUSED — play() never resets currentTime,
      // and we never touch a.currentTime, so it continues, never restarts.
      if (content.musicUrl && a && !preview && playing && !muted) {
        a.play().catch(() => {});
      }
      crossfade(1, 0); // video fades out, music fades back up from its held position
      v.pause();
    }
    prevOnVideoRef.current = onVideo;

    // Natural end → return to the closing screen (the crossfade-back fires there).
    const onEnded = () => goRef.current(videoSlideIdxRef.current + 1);
    v.addEventListener('ended', onEnded);
    return () => {
      cancelAnimationFrame(fade);
      v.removeEventListener('ended', onEnded);
    };
  }, [idx, playing, muted, videoSlideIndex, content.musicUrl, preview]);

  // Press-and-hold pauses; a quick tap on left/right steps; a vertical swipe or
  // a mouse-wheel SCROLLS through the beats (owner 2026-06-19: "auto play or
  // scrubbed via scroll to go back to information"). The gesture also unlocks
  // audio (browser requires user gesture).
  const holdRef = useRef<number | null>(null);
  const wasHoldRef = useRef(false);
  const downXRef = useRef(0);
  const downYRef = useRef(0);

  // A tap that lands on a real control (Add to calendar · play · mute) must reach
  // THAT button, not be swallowed as a film scrub/pause.
  const hitControl = (e: React.PointerEvent) =>
    Boolean((e.target as HTMLElement | null)?.closest?.('button, a'));

  // Scrub to an adjacent beat (clamped) and switch to MANUAL — the deliberate
  // scroll/swipe takes control, so auto-advance stops where the guest landed.
  const stepBeat = (dir: number) => {
    markAdvanced();
    const target = Math.max(0, Math.min(N - 1, idxRef.current + dir));
    goRef.current(target);
    if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
    }
  };

  // Auto-play to FULL SCREEN (owner 2026-06-19). Browsers REQUIRE a user gesture
  // for the Fullscreen API, so we fire it on the first gesture: the reveal-lift
  // (the veil dispatches 'std-go-fullscreen' synchronously from its tap — see the
  // effect below) or, with no reveal, the guest's first tap on the film. Targets
  // documentElement so the reveal + film are both inside. Once only; iOS Safari
  // has no element fullscreen → it silently stays the CSS full-viewport (already
  // edge-to-edge). Never in the builder preview.
  const fsTriedRef = useRef(false);
  const requestFilmFullscreen = () => {
    if (preview || fsTriedRef.current) return;
    fsTriedRef.current = true;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    try { req?.call(el); } catch { /* blocked / unsupported — stays full-viewport */ }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (hitControl(e)) return;
    requestFilmFullscreen(); // first stage gesture → true full screen (no-reveal path)
    downXRef.current = e.clientX;
    downYRef.current = e.clientY;
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
    const dx = e.clientX - downXRef.current;
    const dy = e.clientY - downYRef.current;
    // Vertical swipe = SCROLL-scrub (up → next, down → back) into manual mode.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
      stepBeat(dy < 0 ? 1 : -1);
      return;
    }
    // On the VIDEO beat a tap controls the video — never steps the film, so a tap
    // can't leave the video (owner 2026-06-19). Tapping the paused / not-yet-
    // playing clip plays it FULL SCREEN (the tap is the gesture, so iOS allows
    // play()); tapping while it plays pauses it. Moving on is still a vertical
    // swipe-scrub (handled just above) or the video's natural end.
    if (idxRef.current === videoSlideIdxRef.current) {
      const v = videoElRef.current;
      if (v) {
        if (v.paused) {
          requestFilmFullscreen();
          if (!playingRef.current) {
            playingRef.current = true;
            setPlaying(true);
          }
          v.play().catch(() => {});
        } else {
          v.pause();
          if (playingRef.current) {
            playingRef.current = false;
            setPlaying(false);
          }
        }
      }
      return;
    }
    // Horizontal tap = a quick nudge that keeps the film auto-playing.
    const r = stageRef.current?.getBoundingClientRect();
    const x = r ? e.clientX - r.left : 0;
    const w = r?.width ?? 1;
    markAdvanced();
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

  // Scroll-to-scrub — a WINDOW wheel listener (not the stage) so a mouse/trackpad
  // scroll anywhere scrubs, even over the cream desktop margins beside the
  // centred stage. Down = forward, up = back; debounced to one beat per flick;
  // switches to manual (auto-advance stops where the guest lands). Live only.
  useEffect(() => {
    if (preview) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - last < 360 || Math.abs(e.deltaY) < 14) return;
      last = now;
      const dir = e.deltaY > 0 ? 1 : -1;
      goRef.current(Math.max(0, Math.min(N - 1, idxRef.current + dir)));
      playingRef.current = false;
      setPlaying(false);
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [preview, N]);

  // On the reveal-lift gesture the veil dispatches 'std-go-fullscreen'
  // SYNCHRONOUSLY from its lift tap (a user gesture), so both the Fullscreen API
  // AND the music start here are inside that activation — which is why the music
  // actually autoplays (browsers block audio-with-sound without a gesture; the
  // lift IS the gesture). The content itself still waits for 'std-reveal-done'.
  useEffect(() => {
    if (preview) return;
    const onGoFs = () => {
      // Music: unlock + play now (transient activation) so it's already going as
      // the veil rises. Idempotent — start()/the video effect just continue it.
      if (content.musicUrl && audioRef.current && !muted) {
        audioRef.current.play().catch(() => {});
      }
      if (fsTriedRef.current) return;
      fsTriedRef.current = true;
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
      try { req?.call(el); } catch { /* blocked / unsupported */ }
    };
    window.addEventListener('std-go-fullscreen', onGoFs);
    return () => window.removeEventListener('std-go-fullscreen', onGoFs);
  }, [preview, content.musicUrl, muted]);

  // iOS audio unlock (fixes "music didn't play when the veil lifted" on mobile).
  // The lift play() above fires inside a SYNTHETIC 'std-go-fullscreen' event,
  // which iOS Safari does NOT count as a user gesture → it silently blocks the
  // soundtrack on phones. So unlock the element on the guest's FIRST REAL touch:
  // a capture-phase listener (fires even though the veil's grab-zone owns the
  // gesture) does a trusted play→pause, which marks the <audio> user-activated.
  // The real lift play() (start() on 'std-reveal-done' + onGoFs) then works with
  // no gesture. We rewind + mute the unlock blip so the music still BEGINS on the
  // lift, not on the grab.
  useEffect(() => {
    if (preview || !content.musicUrl) return;
    const unlock = () => {
      const a = audioRef.current;
      if (!a) return; // element not mounted yet — let a later touch retry
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
      // Already playing (no-reveal grace path) → just make sure it keeps going.
      if (playingRef.current) {
        if (!muted) a.play().catch(() => {});
        return;
      }
      // Under the veil: silently unlock, then pause + rewind so it starts fresh
      // on the lift. volume 0 during the play→pause so there's no audible blip.
      const vol = a.volume;
      setVol(a, 0);
      const finish = () => {
        a.pause();
        a.currentTime = 0;
        setVol(a, vol);
      };
      const p = a.play();
      if (p && typeof p.then === 'function') p.then(finish).catch(() => { setVol(a, vol); });
      else finish();
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
  }, [preview, content.musicUrl, muted]);

  // The Save-the-Date is the whole full-screen experience (no chrome, no page
  // beneath in this phase) — the film holds on its closing beat; there's no
  // dismiss. (owner 2026-06-19)

  // Inner JSX shared by both layout modes (preview card + full-screen).
  const filmContent = (
    <>
      {/* Per-beat entrance keyframes (injected once). */}
      <style dangerouslySetInnerHTML={{ __html: FILM_ANIM_CSS }} />

      {content.musicUrl ? (
        <audio ref={audioRef} src={content.musicUrl} loop muted={muted} />
      ) : null}

      {/* Chrome removed (owner 2026-06-19): NO stories scrub bars, NO transport
          controls — just the texts. The film auto-plays; the guest scrubs by
          scrolling / vertical-swiping (or tapping the left/right thirds) and
          holds to pause. The lone exception is a single subtle mute, since the
          soundtrack auto-plays and needs an escape. */}
      {content.musicUrl || content.videoUrl ? (
        <div className="absolute bottom-5 right-4 z-20" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-current/10 opacity-75 transition-opacity hover:opacity-100"
          >
            {muted ? <VolumeX aria-hidden className="h-5 w-5" /> : <Music aria-hidden className="h-5 w-5" />}
          </button>
        </div>
      ) : null}

      {/* "Swipe up to continue" hint — the ONLY cue that this auto-playing film
          is scrubbable (Guest Legibility Floor: a gesture needs a visible
          instruction so an elder is never stranded). Shows at the start and on
          the held video beat — which never auto-advances — and fades once the
          guest has moved through it by hand. A hint pill matching the approved
          veil pattern, not the transport chrome the owner removed. */}
      {playing && !preview && idx !== N - 1 && (!advanced || idx === videoSlideIndex) ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
          <p className="rounded-full bg-black/35 px-6 py-3 font-mono text-base uppercase tracking-[0.16em] text-cream backdrop-blur-[2px] [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
            Swipe up to continue ↑
          </p>
        </div>
      ) : null}

      {/* Slides — each beat plays its OWN entrance animation when it becomes
          active (re-fires on every visit, forward or scrubbed back). The
          animation rides the full-screen slide box, so the centred content
          rises / blooms / slides as one. */}
      <div className="absolute inset-0">
        {slides.map((s, j) => {
          const active = j === idx;
          return (
            <div
              key={s.key}
              className={`std-anim absolute inset-0 flex flex-col items-center justify-center px-8 text-center transition-opacity duration-500 sm:px-10 ${
                active ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
              style={active ? { animation: s.anim } : undefined}
              aria-hidden={!active}
            >
              {s.node}
            </div>
          );
        })}
      </div>
    </>
  );

  // Full-WIDTH legibility scrim (owner 2026-06-19: "the shade needs to cover
  // full width"). A horizontal band centred vertically, fading top + bottom,
  // rendered in the OUTER full-viewport container (not the phone-width stage) so
  // it spans edge to edge behind the centred text. Only when a background tone
  // is active (auto photos that need help reading).
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

  // Subtle "Created at SETNAYAN" mark at the lower edge (owner 2026-06-19 —
  // subtle branding only). Sits in the OUTER container (not the scaled stage) so
  // it stays small + consistent; inherits the tone-aware text colour, very low
  // opacity, pointer-transparent. Hidden behind the full-screen video overlay.
  const brandingNode = (
    <p className="pointer-events-none absolute inset-x-0 bottom-3.5 z-10 text-center font-mono text-[9px] uppercase tracking-[0.3em] opacity-35">
      Created at Setnayan
    </p>
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

  // The fixed-size design canvas, uniformly scaled to fit its container. Every
  // beat is composed at BASE_W×BASE_H; `fitScale` makes it as large as fits
  // within both the width AND height — so the type/monogram are maximal on every
  // screen without ever overflowing, and all proportions are preserved.
  const stageEl = (
    <div
      {...stageProps}
      style={{
        ...stageProps.style,
        width: BASE_W,
        height: BASE_H,
        transform: `scale(${fitScale})`,
        transformOrigin: 'center',
      }}
      className="relative z-10 shrink-0 select-none"
    >
      {filmContent}
    </div>
  );

  if (preview && fill) {
    // Fill a device-frame screen: themed bg fills, the design canvas is scaled to
    // fit the frame — identical to the live layout below, minus fixed positioning.
    return (
      <div
        ref={containerRef}
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${outerBgCls} ${theme.outerFg}`}
      >
        {scrimNode}
        {stageEl}
        {brandingNode}
      </div>
    );
  }

  if (preview) {
    return (
      <div
        ref={containerRef}
        className={`relative mx-auto flex aspect-[9/16] w-full max-w-xs items-center justify-center overflow-hidden rounded-3xl ${outerBgCls} ${theme.outerFg} shadow-xl`}
      >
        {scrimNode}
        {stageEl}
        {brandingNode}
      </div>
    );
  }

  // Full-screen: the themed bg + photo fill the whole viewport; the design canvas
  // is centred and uniformly scaled to fit (max size, no overflow — owner
  // 2026-06-19). The full-width scrim spans the container, behind the canvas.
  return (
    <>
      <div
        ref={containerRef}
        className={`fixed inset-0 z-[50] flex items-center justify-center overflow-hidden ${outerBgCls} ${theme.outerFg}`}
      >
        {scrimNode}
        {stageEl}
        {brandingNode}
      </div>

      {/* FULL-SCREEN video overlay (owner 2026-06-19 "why is the video not full
          screen"). The couple's clip takes over the whole viewport on its beat —
          on top of everything (z-[70], above the reveal/veil) — autoplays
          object-contain on black, then fades out as the film advances to the
          calendar close. videoElRef binds here on the live page; the
          orchestration effect plays it + crossfades the music. */}
      {hasVideo ? (
        <div
          className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-black transition-opacity duration-500 ${
            idx === videoSlideIndex ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden={idx !== videoSlideIndex}
        >
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- couple-uploaded keepsake clip, no caption track */}
          <video
            ref={videoElRef}
            src={content.videoUrl ?? undefined}
            playsInline
            preload="auto"
            className="h-full w-full object-contain"
          />
        </div>
      ) : null}
    </>
  );
}
