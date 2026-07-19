'use client';

// ============================================================================
// "As the Day Unfolded" — living-story chapters
// ============================================================================
//
// Client component. Renders the couple's day as pages of storytelling: photos
// AND Papic's 5-second clips, woven into a narrative in the order they happened.
// Replaces the old 10-photo `MomentsEssay` paced grid (which the server keeps as
// a fallback when there are no Papic media — see editorial-content.tsx).
//
// Visual language matches the surrounding editorial (see editorial-content.tsx
// header): warm cream ground, Cormorant Garamond display, DM Mono eyebrows,
// champagne-gold + mulberry accents, hairline / double-3px rules.
//
//  • Mobile (< lg): each chapter is a full-bleed story panel — the lead medium
//    fills the panel edge-to-edge (card-width breakout), a bottom scrim carries
//    the clock-time kicker + a "tap for sound" hint on clips. Supporting photos
//    sit in a slim 2-up strip beneath. Natural scroll rhythm; NO scroll-snap.
//  • Desktop (lg+): alternating magazine spreads. Clips render inside a "Daily
//    Prophet" double-border frame with the paper shadow — a living photograph in
//    a newspaper. Time kicker + a short rule beside each spread.
//
// Video behaviour (both platforms):
//  • Clips: muted loop playsInline preload="none" with poster when available.
//  • Play only when ≥50% in viewport (one shared IntersectionObserver); pause
//    when out. Hard cap of 3 clips playing at once (Daily-Prophet rule).
//  • Tap/click toggles sound on that clip and mutes any other unmuted clip
//    (one audible at a time). A speaker glyph reflects the state.
//  • prefers-reduced-motion → poster/still, no autoplay; tap reveals controls.
//
// Zero new dependencies. IntersectionObserver + CSS only. lucide-react is
// already used across this tree, so its icons carry the sound toggle (per the
// Lucide-only icon standard).
// ============================================================================

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { ChapterMedia, DayChapter } from './data';

// ── Module-level playback registry ───────────────────────────────────────────
// Enforces the two global rules across every clip on the page, independent of
// React re-renders: (1) at most 3 clips playing concurrently, (2) at most one
// clip audible at a time.
const MAX_CONCURRENT_CLIPS = 3;
const playingClips = new Set<HTMLVideoElement>();
let audibleClip: HTMLVideoElement | null = null;

function requestPlay(video: HTMLVideoElement): void {
  if (playingClips.has(video)) return;
  if (playingClips.size >= MAX_CONCURRENT_CLIPS) return;
  playingClips.add(video);
  void video.play().catch(() => {
    // Autoplay can be refused (e.g. before any interaction) — drop the slot so
    // another clip can take it.
    playingClips.delete(video);
  });
}

function releasePlay(video: HTMLVideoElement): void {
  playingClips.delete(video);
  video.pause();
}

// ── Shared reduced-motion hook ───────────────────────────────────────────────
// Reads prefers-reduced-motion and tracks changes. Exported so other editorial
// clip surfaces (the Kwento wall) share the identical behaviour without
// re-implementing the media-query wiring.
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reducedMotion;
}

// ── A single clip ────────────────────────────────────────────────────────────
// Exported so the Kwento wall can render a living clip anchor using the SAME
// playback machinery (module-level ≤3-concurrent registry + one-audible-at-a-time
// are shared page-wide across chapters + kwento).
export function ClipFrame({
  media,
  names,
  className,
  reducedMotion,
}: {
  media: ChapterMedia;
  names: string;
  className?: string;
  reducedMotion: boolean;
}): ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);

  // One IntersectionObserver per clip element — cheap, and keeps the play/pause
  // decision local. The concurrency cap lives in the module registry above.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reducedMotion) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            requestPlay(video);
          } else {
            releasePlay(video);
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      releasePlay(video);
      if (audibleClip === video) audibleClip = null;
    };
  }, [reducedMotion]);

  const toggleSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (muted) {
      // Mute whatever else is audible — one voice at a time.
      if (audibleClip && audibleClip !== video) audibleClip.muted = true;
      video.muted = false;
      audibleClip = video;
      setMuted(false);
      // A reduced-motion clip isn't autoplaying; a tap-for-sound starts it.
      if (reducedMotion && video.paused) void video.play().catch(() => {});
    } else {
      video.muted = true;
      if (audibleClip === video) audibleClip = null;
      setMuted(true);
    }
  }, [muted, reducedMotion]);

  return (
    <button
      type="button"
      onClick={toggleSound}
      aria-label={muted ? 'Play sound for this moment' : 'Mute this moment'}
      className={`group relative block w-full cursor-pointer overflow-hidden bg-ink/10 ${className ?? ''}`}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        preload="none"
        poster={media.posterUrl ?? undefined}
        controls={false}
        className="h-full w-full object-cover"
      >
        <source src={media.url} />
      </video>
      {/* Sound state glyph — top-right, quiet until hover/tap. */}
      <span
        aria-hidden
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-ink/55 text-cream backdrop-blur-sm transition group-hover:bg-ink/75"
      >
        {muted ? <VolumeX size={15} strokeWidth={2} /> : <Volume2 size={15} strokeWidth={2} />}
      </span>
      <span className="sr-only">{names} — a living moment from the day</span>
    </button>
  );
}

// ── Lead medium (photo or clip) ──────────────────────────────────────────────
function LeadMedia({
  media,
  names,
  className,
  reducedMotion,
}: {
  media: ChapterMedia;
  names: string;
  className?: string;
  reducedMotion: boolean;
}): ReactElement {
  if (media.type === 'clip') {
    return (
      <ClipFrame media={media} names={names} className={className} reducedMotion={reducedMotion} />
    );
  }
  return (
    <div className={`relative overflow-hidden bg-ink/10 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        alt={`${names} — a moment from the day`}
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

// ── Write-up (drop-cap serif paragraph) ──────────────────────────────────────
// Mirrors the lead-article drop-cap treatment in editorial-content.tsx: the first
// letter floats large in font-display mulberry. A couple's short per-moment story.
function ChapterWriteUp({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={`font-serif text-[15px] leading-relaxed text-ink/85 first-letter:float-left first-letter:mr-2 first-letter:pt-1 first-letter:font-display first-letter:text-5xl first-letter:font-bold first-letter:leading-[0.7] first-letter:text-mulberry ${className ?? ''}`}
    >
      {text}
    </p>
  );
}

// ── Supporting 2-up photo strip ──────────────────────────────────────────────
function SupportingStrip({
  media,
  names,
}: {
  media: ChapterMedia[];
  names: string;
}): ReactElement | null {
  if (media.length === 0) return null;
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {media.map((m, i) => (
        <figure
          key={`${i}-${m.url.slice(0, 24)}`}
          className="relative aspect-[4/3] overflow-hidden rounded-sm bg-ink/10"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.url}
            alt={`${names} — a moment from the day`}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </figure>
      ))}
    </div>
  );
}

// ── One chapter — mobile full-bleed panel + desktop spread ───────────────────
function Chapter({
  chapter,
  names,
  index,
  reducedMotion,
}: {
  chapter: DayChapter;
  names: string;
  index: number;
  reducedMotion: boolean;
}): ReactElement {
  const lead = chapter.media[0];
  const supporting = chapter.media.slice(1);
  const isClip = lead?.type === 'clip';
  const { title, writeUp } = chapter;
  // Alternating desktop layout: even chapters lead media-left, odd flip.
  const flip = index % 2 === 1;

  return (
    <section
      aria-label={
        title
          ? title
          : chapter.time
            ? `A moment ${chapter.time}`
            : 'A moment from the day'
      }
    >
      {/* ── Mobile (< lg): full-bleed story panel ─────────────────────────── */}
      <div className="lg:hidden">
        {/* Negative-margin breakout to the article-card edge. The card padding
            is px-5 (20px) at base and sm:px-10 (40px) from sm up (see
            editorial-content.tsx), so the breakout mirrors both. */}
        <div className="relative -mx-5 min-h-[88svh] overflow-hidden bg-ink/10 sm:-mx-10">
          {lead ? (
            <LeadMedia
              media={lead}
              names={names}
              reducedMotion={reducedMotion}
              className="absolute inset-0 h-full w-full [&>video]:h-full [&>img]:h-full"
            />
          ) : null}
          {/* Bottom scrim: the couple's moment TITLE (when set) sits above the
              clock-time kicker, in the display serif. Scrim inner padding mirrors
              the card's px-5/sm:px-10 so text stays aligned at every breakpoint. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/25 to-transparent px-5 pb-6 pt-28 sm:px-10">
            {title ? (
              <h3 className="mb-1.5 font-display text-2xl font-bold leading-[0.98] tracking-tight text-cream sm:text-3xl">
                {title}
              </h3>
            ) : null}
            <div className="flex items-end justify-between gap-3">
              {chapter.time ? (
                <span className="font-mono text-xs uppercase tracking-[0.24em] text-cream/90">
                  {chapter.time}
                </span>
              ) : (
                <span aria-hidden />
              )}
              {isClip ? (
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-cream/70">
                  tap for sound
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {/* The couple's short story for this moment flows below the panel, before
            the supporting strip. */}
        {writeUp ? <ChapterWriteUp text={writeUp} className="mt-4" /> : null}
        <SupportingStrip media={supporting} names={names} />
      </div>

      {/* ── Desktop (lg+): alternating magazine spread ────────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-8">
        <div className={`lg:col-span-8 ${flip ? 'lg:order-2' : 'lg:order-1'}`}>
          {lead ? (
            isClip ? (
              // "Daily Prophet" frame: double 3px border + paper shadow.
              <div className="border-double border-[3px] border-ink/80 p-1.5 shadow-[0_10px_30px_-12px_rgba(20,16,12,0.35)]">
                <LeadMedia
                  media={lead}
                  names={names}
                  reducedMotion={reducedMotion}
                  className="max-h-[72vh] [&>video]:max-h-[72vh] [&>video]:w-full [&>video]:object-cover"
                />
              </div>
            ) : (
              <figure className="overflow-hidden shadow-[0_10px_30px_-12px_rgba(20,16,12,0.35)]">
                <LeadMedia
                  media={lead}
                  names={names}
                  reducedMotion={reducedMotion}
                  className="max-h-[72vh] [&>img]:max-h-[72vh] [&>img]:w-full [&>img]:object-cover"
                />
              </figure>
            )
          ) : null}
        </div>
        {/* Kicker column beside the media — clock-time eyebrow, then (when the
            couple named the moment) the display-serif title + drop-cap write-up:
            the "photo dominant, write-up beside it" newspaper spread. */}
        <div className={`lg:col-span-4 ${flip ? 'lg:order-1 lg:pr-2' : 'lg:order-2 lg:pl-2'}`}>
          {chapter.time ? (
            <p className="m-0 font-mono text-xs uppercase tracking-[0.24em] text-terracotta">
              {chapter.time}
            </p>
          ) : null}
          {title ? (
            <h3 className="mt-2 font-display text-3xl font-bold leading-[0.98] tracking-tight text-ink">
              {title}
            </h3>
          ) : null}
          <span aria-hidden className="mt-3 block h-px w-16 bg-ink/40" />
          {writeUp ? <ChapterWriteUp text={writeUp} className="mt-4" /> : null}
          {isClip ? (
            <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-ink/45">
              a living moment · tap for sound
            </p>
          ) : null}
          <SupportingStrip media={supporting} names={names} />
        </div>
      </div>
    </section>
  );
}

export function LivingMoments({
  chapters,
  names,
}: {
  chapters: DayChapter[];
  names: string;
}): ReactElement | null {
  const reducedMotion = useReducedMotion();

  if (chapters.length === 0) return null;

  return (
    <div className="mt-6 space-y-14 lg:space-y-24">
      {chapters.map((chapter, i) => (
        <div key={`${i}-${chapter.media[0]?.url.slice(0, 24) ?? 'chapter'}`}>
          <Chapter chapter={chapter} names={names} index={i} reducedMotion={reducedMotion} />
          {/* Hairline rule between chapters (not after the last). */}
          {i < chapters.length - 1 ? (
            <span aria-hidden className="mt-14 block h-px w-full bg-ink/15 lg:mt-24" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Kwento anchor clip ───────────────────────────────────────────────────────
// A small living clip for a Kwento card's anchor media. It's a self-contained
// client component (owns its own reduced-motion read) so the SERVER-rendered
// KwentoWall can drop it in without threading state. It reuses ClipFrame — the
// SAME module-level registry — so the ≤3-concurrent + one-audible caps span
// chapters and kwento together. Wrapped in the thin Daily-Prophet double border,
// consistently sized so cards don't jump.
export function KwentoClip({
  url,
  posterUrl,
  names,
}: {
  url: string;
  posterUrl?: string | null;
  names: string;
}): ReactElement {
  const reducedMotion = useReducedMotion();
  return (
    <div className="mb-3 border-double border-[3px] border-ink/80 p-1 shadow-[0_8px_22px_-14px_rgba(20,16,12,0.35)]">
      <ClipFrame
        media={{ type: 'clip', url, posterUrl: posterUrl ?? null }}
        names={names}
        reducedMotion={reducedMotion}
        className="aspect-[4/3] [&>video]:h-full [&>video]:w-full [&>video]:object-cover"
      />
    </div>
  );
}
