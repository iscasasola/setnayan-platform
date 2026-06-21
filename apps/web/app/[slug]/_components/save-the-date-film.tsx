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
 * Interaction (owner 2026-06-21): the film auto-plays through the text beats;
 * PRESS pauses and RELEASE continues; a deliberate vertical DRAG scrubs to an
 * adjacent beat (still auto-playing). Scrolling does NOT move the film. No
 * tap-to-step, no chrome — just the texts.
 * The video beat plays the clip; press pauses it, release resumes, a swipe scrubs
 * past. Music auto-plays (the reveal-lift gesture has already unlocked audio).
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
import { Music, Volume2, VolumeX } from 'lucide-react';
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
// Dragging BACK to re-read holds that beat for its normal dwell PLUS
// this bonus before auto-play pulls forward again — a deliberate re-read isn't
// yanked off after the standard ~4s (owner 2026-06-21). Forward skips keep the
// normal dwell.
const REREAD_DWELL_BONUS_MS = 4000;
// The video↔content cross-dissolve duration (owner 2026-06-21 "smoother crossfade
// between the video and the website"). ONE value drives BOTH the audio crossfade
// (equal-power ramp) AND the full-screen clip overlay's opacity fade, so sound and
// picture dissolve together — up from the old unsynced 700ms audio / 500ms visual.
const VIDEO_FADE_MS = 850;

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
  // The video's poster still — present ONLY in "fit to screen" mode (resolved
  // upstream when std_media.fit === 'fit'), where it fills the letterbox bars with
  // a BLURRED IMAGE behind the object-contain clip. A still (not a 2nd <video>)
  // because iOS plays one video at a time, so a video backdrop stayed BLACK on
  // iPhone (owner 2026-06-21). Absent — "fill", the DEFAULT — means the clip is
  // object-cover, edge-to-edge (a slight crop, never black bars).
  const videoPosterUrl = content.videoPosterUrl ?? null;
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
  // The autoplay policy forced the couple's clip to play MUTED (no recent user
  // gesture by the time the film reaches the video beat — see the video effect).
  // The clip still plays + advances; this just surfaces a one-tap "Tap for sound"
  // control over it so the guest CAN hear the couple's own audio if they want.
  const [videoSoundBlocked, setVideoSoundBlocked] = useState(false);
  // One-time "press & hold to pause" hint (shown a beat after the film starts,
  // then fades for good). The film has no transport chrome, so this is the lone
  // cue that a guest can hold to linger on a beat. Set by start(); see render.
  const [showHoldHint, setShowHoldHint] = useState(false);

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
  // The music↔video crossfade RAF id, held in a ref so the "Tap for sound"
  // handler (outside the effect) can cancel an in-flight fade before it unmutes.
  const videoFadeRef = useRef(0);

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
      // One-time "press & hold to pause" cue — a beat after the film begins, then
      // it fades for good (start() is one-time-guarded above). The film has no
      // other chrome, so this is the lone hint that a guest can hold to linger.
      window.setTimeout(() => setShowHoldHint(true), 1600);
      window.setTimeout(() => setShowHoldHint(false), 6400);
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
  // by itself when its beat is active — with sound when the page still has user
  // activation, else muted (the fallback below keeps it from hanging). The
  // soundtrack CROSSFADES to the video's audio as it
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
    const crossfade = (musicTo: number, videoTo: number, pauseMusicAtEnd = false) => {
      cancelAnimationFrame(videoFadeRef.current);
      const m0 = a?.volume ?? 1;
      const v0 = v.volume;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / VIDEO_FADE_MS);
        // Equal-power crossfade: the channel fading OUT follows cos, fading IN
        // follows sin (cos²+sin²=1), so perceived loudness stays CONSTANT — no
        // mid-dissolve dip a linear amplitude ramp has — and the ramp eases in/out
        // rather than a linear ramp's abrupt onset/offset.
        const fadeOut = Math.cos((p * Math.PI) / 2); // 1 → 0
        const fadeIn = Math.sin((p * Math.PI) / 2); // 0 → 1
        setVol(a, musicTo <= m0 ? musicTo + (m0 - musicTo) * fadeOut : m0 + (musicTo - m0) * fadeIn);
        setVol(v, videoTo <= v0 ? videoTo + (v0 - videoTo) * fadeOut : v0 + (videoTo - v0) * fadeIn);
        if (p < 1) {
          videoFadeRef.current = requestAnimationFrame(tick);
        } else if (pauseMusicAtEnd && a) {
          a.pause(); // hold the song's position; it resumes here after the video
        }
      };
      videoFadeRef.current = requestAnimationFrame(tick);
    };

    if (onVideo) {
      if (!prevOnVideoRef.current) {
        v.loop = false; // was looping while warm — let it END so the film advances
        try { v.currentTime = 0; } catch { /* not seekable yet — plays from 0 */ }
        setVol(v, 0); // start silent, fade up
        setVideoSoundBlocked(false); // fresh beat — the catch below re-flags if blocked
      }
      v.muted = muted || preview;
      if (playing) {
        // Autoplay-with-SOUND needs recent user activation. By the time the film
        // auto-advances into this beat (~30s of text beats after the reveal-lift),
        // that activation is gone — and on iOS Safari a play() fired outside a
        // gesture handler is blocked regardless. The no-reveal grace path and an
        // auto-completing reveal never had a gesture at all. So an UNMUTED play()
        // REJECTS; because the beat holds on dur:Infinity and ONLY 'ended'
        // advances it, the film would HANG on the frozen first frame forever —
        // the reported "hangs in the center even on strong internet" (it's the
        // autoplay policy, not buffering). MUTED autoplay is always permitted, so
        // on rejection retry muted: the clip plays, fires 'ended', and the film
        // advances. We keep the soundtrack playing under the now-silent clip so
        // the beat isn't dead air.
        const attempt = v.play();
        if (attempt && typeof attempt.then === 'function') {
          attempt.catch(() => {
            v.muted = true;
            // Surface the one-tap "Tap for sound" control (a gesture CAN unmute) —
            // unless the guest has globally muted, in which case they want silence.
            if (!muted) setVideoSoundBlocked(true);
            v.play().catch(() => {
              // Even muted playback failed (decode/network) — don't strand the
              // guest on the Infinity beat; advance to the closing screen.
              if (idxRef.current === videoSlideIdxRef.current) {
                goRef.current(videoSlideIdxRef.current + 1);
              }
            });
            if (a && content.musicUrl && !muted) {
              a.play().catch(() => {});
              crossfade(1, 0); // undo the duck — keep the music as the beat's audio
            }
          });
        }
      } else {
        v.pause();
      }
      crossfade(0, 1, true); // music fades out → PAUSES (holds position); video fades in
    } else {
      // Resume the music FROM WHERE IT PAUSED — play() never resets currentTime,
      // and we never touch a.currentTime, so it continues, never restarts.
      if (content.musicUrl && a && !preview && playing && !muted) {
        a.play().catch(() => {});
      }
      crossfade(1, 0); // video fades out, music fades back up from its held position
      // Keep the clip WARM (playing, silent) BEFORE its beat so its audio can ramp
      // in on the beat without a fresh (iOS-blocked) play(); only PAUSE it once
      // we're PAST the beat (clip done) or sound is off. See the unlock above.
      if (idxRef.current > videoSlideIdxRef.current || muted || preview) {
        v.pause();
      } else if (v.paused) {
        // RE-WARM if a prior mute or backward-scrub left the clip paused before its
        // beat — restart it silent + looping so its audio is ready to ramp on the
        // beat. Best-effort: succeeds on desktop/Android; iOS off-gesture rejects →
        // the beat's own "Tap for sound" fallback still holds (no hang).
        v.muted = false;
        v.loop = true;
        setVol(v, 0);
        v.play().catch(() => {});
      }
    }
    prevOnVideoRef.current = onVideo;

    // Natural end → return to the closing screen (the crossfade-back fires there).
    // Guard like onError below: ONLY the clip's own beat may advance on 'ended'.
    // Warm-play sets loop=false on the beat, but a scrub could leave it playing
    // off-beat — its natural end must NOT yank the film forward from a text beat.
    const onEnded = () => {
      if (idxRef.current === videoSlideIdxRef.current) goRef.current(videoSlideIdxRef.current + 1);
    };
    // A mid-play decode/network error must NOT strand the film on the Infinity
    // video beat either — advance, but ONLY while this beat is active (the clip
    // preloads from mount, so an early load error must not jump a text beat).
    const onError = () => {
      if (idxRef.current === videoSlideIdxRef.current) {
        goRef.current(videoSlideIdxRef.current + 1);
      }
    };
    v.addEventListener('ended', onEnded);
    v.addEventListener('error', onError);
    return () => {
      cancelAnimationFrame(videoFadeRef.current);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('error', onError);
    };
  }, [idx, playing, muted, videoSlideIndex, content.musicUrl, preview]);

  // Tell the veil's petals whether on-screen TEXT is present, so a petal resting on
  // it can CRAWL down and only FALL once the words are gone (owner 2026-06-21 "if
  // the text disappears … it will fall"). Cleared on every beat change (the words
  // swap out) — the petals fall through during the cross-fade — then set true once
  // the new beat has settled. Stays false on the video beat (no text surface).
  // Runs in the builder preview too, so the couple sees the crawl while authoring.
  useEffect(() => {
    const w = window as Window & { __stdTextShowing?: boolean };
    w.__stdTextShowing = false;
    if (idx === videoSlideIndex) return; // video beat = no text surface
    const t = window.setTimeout(() => {
      w.__stdTextShowing = true;
    }, 520);
    return () => {
      clearTimeout(t);
      w.__stdTextShowing = false;
    };
  }, [idx, videoSlideIndex]);

  // Interaction model (owner 2026-06-21): PRESS pauses, RELEASE continues; a
  // deliberate vertical DRAG scrubs through the beats (still auto-playing).
  // Scrolling does NOT move the film. No tap-to-step. The press also unlocks
  // audio (browsers need a gesture).
  const downXRef = useRef(0);
  const downYRef = useRef(0);

  // A tap that lands on a real control (Add to calendar · play · mute) must reach
  // THAT button, not be swallowed as a film scrub/pause.
  const hitControl = (e: React.PointerEvent) =>
    Boolean((e.target as HTMLElement | null)?.closest?.('button, a'));

  // Scrub to an adjacent beat (clamped) WITHOUT leaving auto-play — a swipe is a
  // navigation nudge (skip ahead / swipe back to re-read), NOT a pause, so the
  // film keeps auto-advancing from wherever the guest lands (owner 2026-06-21
  // "when they swipe, auto play must still continue"). goRef.current() resets the
  // per-beat dwell timer, so the landed beat gets its full duration before the
  // player moves on. Pause stays available via press-and-hold.
  const stepBeat = (dir: number) => {
    const target = Math.max(0, Math.min(N - 1, idxRef.current + dir));
    goRef.current(target);
    // Re-read hold: a BACKWARD scrub gets a longer dwell so auto-play doesn't yank
    // the guest off the beat they returned to. goRef set startRef=now; pushing it
    // into the future extends the hold; forward skips keep the normal dwell.
    if (dir < 0) startRef.current = performance.now() + REREAD_DWELL_BONUS_MS;
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
    // Stir the veil's petals at the press point — the controls RUN the petals, not
    // just hold the film (owner 2026-06-21 "the controls will run the petals and
    // veil"). The veil (z-60) listens for 'std-veil-poke' and bounces the nearest
    // petal; harmless no-op when no reveal/petals are mounted.
    try {
      window.dispatchEvent(
        new CustomEvent('std-veil-poke', { detail: { x: e.clientX, y: e.clientY } }),
      );
    } catch {
      /* noop */
    }
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
    // PRESS = PAUSE (owner 2026-06-21 "tap just pauses; releasing will continue").
    // On the video beat that pauses the CLIP directly (the film holds there, so
    // its `playing` flag is left alone); on a text beat it stops the auto-advance
    // and stamps pauseAt so the beat keeps its full dwell when it resumes. A swipe
    // (detected on release) overrides this to scrub instead.
    if (idxRef.current === videoSlideIdxRef.current) {
      videoElRef.current?.pause();
      pauseAtRef.current = 0;
    } else if (playingRef.current) {
      playingRef.current = false;
      setPlaying(false);
      pauseAtRef.current = performance.now();
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (hitControl(e)) return;
    const dx = e.clientX - downXRef.current;
    const dy = e.clientY - downYRef.current;
    // Vertical swipe = SCRUB to an adjacent beat (up → next, down → back); the film
    // keeps auto-playing (stepBeat resets the dwell). This overrides the press-
    // pause — the guest is navigating, not pausing.
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 30) {
      stepBeat(dy < 0 ? 1 : -1);
      if (!playingRef.current) {
        playingRef.current = true;
        setPlaying(true);
      }
      pauseAtRef.current = 0;
      return;
    }
    // RELEASE (tap or hold) = CONTINUE. On the video beat, resume the clip; on a
    // text beat, resume the auto-advance and credit the paused span back to the
    // beat's dwell so it isn't cut short. No tap-to-step (owner 2026-06-21).
    if (idxRef.current === videoSlideIdxRef.current) {
      videoElRef.current?.play().catch(() => {});
    } else {
      if (pauseAtRef.current) startRef.current += performance.now() - pauseAtRef.current;
      if (!playingRef.current) {
        playingRef.current = true;
        setPlaying(true);
      }
    }
    pauseAtRef.current = 0;
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

  // "Tap for sound" — the couple's clip auto-played MUTED because the browser
  // blocked autoplay-with-sound (no recent gesture). This handler runs from the
  // guest's tap (a gesture), so unmuting a clip that's already playing IS allowed:
  // give it its own audio and duck the soundtrack under it. We pause the music so
  // it HOLDS its position and resumes after the clip (matching the crossfade
  // design) instead of restarting.
  const enableVideoSound = () => {
    const v = videoElRef.current;
    if (!v) return;
    cancelAnimationFrame(videoFadeRef.current); // stop any in-flight music↔video fade
    v.muted = false;
    setVol(v, 1);
    const a = audioRef.current;
    if (a) { setVol(a, 0); a.pause(); }
    v.play().catch(() => {}); // already playing — just ensures audible playback
    setVideoSoundBlocked(false);
  };

  // (Desktop SCROLL no longer scrubs the film — owner 2026-06-21 "transition of
  // text still moves with scrolling … that should not work anymore." The film
  // auto-plays; press-and-hold pauses and release resumes, and a deliberate
  // vertical drag still scrubs. The old window 'wheel' listener that advanced
  // beats on every mouse/trackpad scroll was removed.)

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
    if (preview || (!content.musicUrl && !content.videoUrl)) return;
    const unlock = () => {
      const a = audioRef.current;
      const v = videoElRef.current;
      if (!a && !v) return; // nothing mounted yet — let a later touch retry
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);

      // ── Soundtrack <audio> unlock (original behaviour).
      if (a) {
        if (playingRef.current) {
          // Already playing (no-reveal grace path) → just keep it going.
          if (!muted) a.play().catch(() => {});
        } else {
          // Under the veil: silently unlock, then pause + rewind so it starts
          // fresh on the lift. volume 0 during the play→pause so there's no blip.
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
        }
      }

      // ── Couple's clip <video> — keep it WARM so its audio auto-crossfades in
      // on the video beat (owner 2026-06-21 "the video's audio does not auto
      // crossfade"). iOS only lets a <video> play WITH sound if a tap started it;
      // by the time the film reaches the clip (~30s after the lift) that credit
      // is spent, so a fresh unmuted play() at the beat is BLOCKED. The earlier
      // play→pause prime failed for exactly that reason: once paused, the beat
      // needed a blocked re-play. So instead START the clip playing right here —
      // unmuted, volume 0 (silent), looping, still invisible (opacity-0 off-beat)
      // — and LEAVE it playing. A media element kept running from a user gesture
      // retains its audio rights, so the beat only RAMPS its volume up (the
      // crossfade), never a fresh play()/unmute. This is exactly why the
      // soundtrack <audio> already auto-plays — it runs continuously from here.
      // loop=true stops it ending+pausing before its beat (the beat sets
      // loop=false so 'ended' still advances). "Tap for sound" stays the fallback
      // if iOS won't keep it warm (e.g. Low Power Mode pauses background video).
      // Skip if the first touch lands while ALREADY on the video beat (no-reveal
      // grace path): there the beat owns the clip (loop=false, audible play), and
      // setting loop=true here would suppress 'ended' → the Infinity beat hangs.
      if (v && !muted && idxRef.current !== videoSlideIdxRef.current) {
        v.muted = false;
        v.loop = true;
        setVol(v, 0);
        v.play().catch(() => { /* not ready/blocked — the beat's own play() still tries */ });
      }
    };
    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };
  }, [preview, content.musicUrl, content.videoUrl, muted]);

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
          a deliberate vertical drag, and PRESSES to pause / releases to continue
          (owner 2026-06-21). The lone exception is a single subtle mute, since the
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

      {/* The film carries no "swipe up to continue" cue — it duplicated the veil's
          "Lift the veil ↑ / or double-tap" swipe-up pill, so the two were
          consolidated into that single pill (owner 2026-06-21). What remains is a
          DIFFERENT, one-time cue: "press and hold to pause", since the film has no
          transport chrome and pausing would otherwise be undiscoverable. It fades
          after a few seconds and never returns. pointer-events-none so it never
          blocks a scrub or hold. */}
      {!preview ? (
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center transition-opacity duration-700 ${
            showHoldHint ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="rounded-full bg-black/35 px-5 py-2.5 font-mono text-sm uppercase tracking-[0.16em] text-cream/90 backdrop-blur-[2px] [text-shadow:0_1px_8px_rgba(0,0,0,0.7)]">
            Press and hold to pause
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
    onPointerCancel: () => {
      // A cancelled press (lost pointer) must CONTINUE, never strand the film paused.
      if (idxRef.current === videoSlideIdxRef.current) {
        videoElRef.current?.play().catch(() => {});
      } else {
        if (pauseAtRef.current) startRef.current += performance.now() - pauseAtRef.current;
        if (!playingRef.current) {
          playingRef.current = true;
          setPlaying(true);
        }
      }
      pauseAtRef.current = 0;
    },
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
          on top of everything (z-[70], above the reveal/veil). Two play modes the
          couple picks in the builder (std_media.fit · owner 2026-06-21 "an option
          how the video plays, fit to screen or fill"):
          • FILL (the DEFAULT) — object-cover, edge-to-edge; no poster is resolved,
            so there's no backdrop and a slight crop instead of black bars.
          • FIT TO SCREEN — object-contain (whole frame) over a blurred, scaled
            copy of the clip's POSTER STILL (an <img>, NOT a 2nd <video> — iOS plays
            one video at a time, so a video backdrop stayed BLACK on iPhone: owner
            2026-06-21 "still black screens on top and bottom"). If a fit-mode clip
            has no poster, it falls back to object-cover so the bars are never black.
          `videoPosterUrl` is set upstream only for fit-mode, so its presence is what
          selects contain-vs-cover below. Then fades out as the film advances to the
          calendar close. videoElRef binds here on the live page; the orchestration
          effect plays it + crossfades the music. */}
      {hasVideo ? (
        <div
          className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center bg-black transition-opacity ease-in-out ${
            idx === videoSlideIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ transitionDuration: `${VIDEO_FADE_MS}ms` }} // synced to the audio crossfade
          aria-hidden={idx !== videoSlideIndex}
        >
          {/* Blurred ambient FILL — a scaled, blurred copy of the clip's POSTER
              STILL fills the whole viewport behind the contained clip, so an aspect
              mismatch (portrait screen + landscape clip, or the reverse) reads as a
              soft cinematic fill instead of black bars — WITHOUT cropping the
              couple's frame. An <img>, not a 2nd <video>: iOS plays only one video
              at a time, so a video backdrop never played on iPhone and the bars
              stayed black (owner 2026-06-21). A heavily-blurred still is
              indistinguishable from a blurred video here, and works everywhere. */}
          {videoPosterUrl ? (
            <img
              src={videoPosterUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-[0.6]"
            />
          ) : null}
          {/* The real clip — WHOLE frame visible (object-contain) over the blurred
              poster fill. With no poster to fill the bars, fall back to object-cover
              so the clip fills the screen (a slight crop) rather than show black
              bars (owner 2026-06-21 "shouldn't have black screens top and bottom"). */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption -- couple-uploaded keepsake clip, no caption track */}
          <video
            ref={videoElRef}
            src={content.videoUrl ?? undefined}
            playsInline
            preload="auto"
            className={`relative h-full w-full ${videoPosterUrl ? 'object-contain' : 'object-cover'}`}
          />

          {/* "Tap for sound" — shows only when the clip had to auto-play MUTED
              (autoplay policy) and the guest hasn't globally muted. One tap is a
              user gesture, so it unmutes the couple's own audio. pointer-events
              re-enabled on the button alone; the rest of the overlay stays
              pass-through so the film's scrub/hold gestures still reach the stage
              beneath. Hidden the instant sound is on or the beat ends. */}
          {videoSoundBlocked && !muted && idx === videoSlideIndex ? (
            <button
              type="button"
              onClick={enableVideoSound}
              className="pointer-events-auto absolute bottom-10 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/15 px-5 py-3 font-mono text-sm uppercase tracking-[0.16em] text-white backdrop-blur-md transition hover:bg-white/25"
            >
              <Volume2 aria-hidden className="h-5 w-5" />
              Tap for sound
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
