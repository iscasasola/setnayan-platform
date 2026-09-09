'use client';

/**
 * relive.tsx — the day again, one minute at a time.
 *
 * `01_The_Story.md` §7 · §11 · prototype `story.html` `#relive`.
 *
 * ── THE THREE RULES THAT ARE REVIEW FINDINGS, NOT PREFERENCES ──────────────
 *
 * 🔴 THE PREV/NEXT ARE INVISIBLE TO THE EYE AND NEVER INVISIBLE TO THE
 *    KEYBOARD. They are two full-height halves of the picture, at zero opacity
 *    — and they come back the instant they take focus. `opacity:0` leaves a
 *    control in the tab order and in the accessibility tree, which is the whole
 *    point; `display:none` or `visibility:hidden` would have removed it from
 *    both and left a keyboard reader with a slideshow they cannot steer.
 *
 * 🔴 FOCUS MOVES INTO IT AND BACK OUT OF IT — through the shipped hook, not a
 *    hand-rolled copy of its job. `lib/use-modal-a11y.ts` traps Tab, closes on
 *    Escape, restores focus to the button that opened this, and keeps a modal
 *    stack so the dial's sheet underneath peels off in the right order.
 *    `modal-a11y-adoption.test.ts` fails any overlay claiming `aria-modal`
 *    without it, and it caught S9 doing exactly that.
 *
 * 🔴 `prefers-reduced-motion` IS HONOURED BY THE SCRIPT, NOT ONLY THE
 *    STYLESHEET. A reader who has asked for less motion gets no autoplay and no
 *    crossfade — the slideshow becomes a thing they step through. A stylesheet
 *    alone would have stopped the fade and left the pictures changing by
 *    themselves every six seconds, which is the motion they actually objected
 *    to.
 *
 * 🔒 AND IT CANNOT EXIST WITHOUT THE GUESTS' LAYER. Its slides are the day's
 * written minutes, which `redactStoryLayers` empties for a reader the layer is
 * withheld from — so a pre-publish stranger is handed no slides, and the spine
 * renders no button at all. The Relive player was one of the six things the
 * design review found still public in that state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';

/** One minute, as Relive shows it. Plain data — the server built every field. */
export type ReliveSlide = {
  id: string;
  /** `7:12`. */
  stamp: string;
  /** `PM`. */
  suffix: string;
  title: string;
  /** The minute's lead picture. Null for a minute that was written but not shot. */
  imageUrl: string | null;
  /** The line under it — where the celebration was, or the lead's caption. */
  caption: string | null;
  /** One thing somebody said at this minute, already consented. */
  voice: string | null;
  /** Who said it — present ONLY where the guest asked to be named. */
  voiceBy: string | null;
};

/** How long one minute holds the screen before the next, in ms. */
const DWELL = 6000;

export function Relive({
  slides,
  label,
}: {
  slides: ReliveSlide[];
  /** "Relive the wedding day" — the caller owns the event's words. */
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useModalA11y({
    open,
    onClose: () => setOpen(false),
    containerRef: dialogRef,
    initialFocusRef: closeRef,
  });

  const go = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setI(((next % slides.length) + slides.length) % slides.length);
      setProgress(0);
    },
    [slides.length],
  );

  /* Autoplay, and the reduced-motion arm of it. The timer is not merely paused
     for a calm reader — it is never started, so nothing advances by itself. */
  useEffect(() => {
    if (!open || slides.length === 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / DWELL);
      setProgress(p);
      if (p >= 1) {
        if (i === slides.length - 1) setOpen(false);
        else go(i + 1);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open, i, slides.length, go]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(i + 1);
      if (e.key === 'ArrowLeft') go(i - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, i, go]);

  if (slides.length === 0) return null;
  const s = slides[i] ?? slides[0]!;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setI(0);
          setProgress(0);
          setOpen(true);
        }}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-ink bg-ink px-3.5 font-mono text-xs font-bold uppercase tracking-[0.12em] text-cream transition-opacity hover:opacity-85"
      >
        <span aria-hidden>▶</span>
        Relive it
      </button>

      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-[100] flex flex-col bg-[#0E0D0C] text-white"
        >
          {/* One bar per minute — done, running, still to come. */}
          <div className="flex gap-1 px-3.5 pt-3">
            {slides.map((sl, k) => (
              <i
                key={sl.id}
                aria-hidden
                className="relative h-[3px] flex-1 overflow-hidden rounded-sm bg-white/25"
              >
                <span
                  className="absolute inset-y-0 left-0 bg-white"
                  style={{ width: k < i ? '100%' : k === i ? `${progress * 100}%` : '0%' }}
                />
              </i>
            ))}
          </div>

          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="font-condensed text-4xl font-black leading-none tabular-nums tracking-tight">
              {s.stamp}
              {s.suffix ? (
                <small className="ml-1 text-sm tracking-widest opacity-70">{s.suffix}</small>
              ) : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-[44px] items-center rounded-full border border-white/35 px-3.5 font-mono text-xs font-semibold uppercase tracking-[0.1em] opacity-85"
            >
              Close
            </button>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[1fr_auto] gap-3 px-3.5 pb-5 min-[900px]:mx-auto min-[900px]:w-full min-[900px]:max-w-[1100px] min-[900px]:grid-cols-[minmax(0,1fr)_380px] min-[900px]:grid-rows-1 min-[900px]:gap-5">
            <div className="relative min-h-0 overflow-hidden rounded-xl bg-white/5">
              {/*
                THE CROSSFADE. Every slide is mounted and only the current one is
                opaque, so the picture arriving is already decoded — a fade to a
                picture that has not loaded is a fade to grey. Reduced motion
                turns the transition off and leaves the switching instant.
              */}
              {slides.map((sl, k) =>
                sl.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={sl.id}
                    src={sl.imageUrl}
                    alt={k === i ? (sl.caption ?? sl.title) : ''}
                    aria-hidden={k !== i}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${
                      k === i ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ) : null,
              )}
              {s.caption ? (
                <span className="absolute inset-x-3 bottom-2.5 z-10 font-mono text-xs font-semibold uppercase tracking-[0.12em] [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]">
                  {s.caption}
                </span>
              ) : null}

              {/*
                🔴 INVISIBLE, NEVER INVISIBLE TO THE KEYBOARD (`01` §11). Two
                half-width targets over the picture at zero opacity; focus brings
                them back. See the header — this is why they are not `hidden`.
              */}
              <div className="absolute inset-0 z-20 grid grid-cols-2">
                <button
                  type="button"
                  onClick={() => go(i - 1)}
                  className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white opacity-0 outline-offset-[-4px] focus-visible:bg-black/45 focus-visible:opacity-100"
                >
                  Previous minute
                </button>
                <button
                  type="button"
                  onClick={() => go(i + 1)}
                  className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white opacity-0 outline-offset-[-4px] focus-visible:bg-black/45 focus-visible:opacity-100"
                >
                  Next minute
                </button>
              </div>
            </div>

            <div className="grid gap-2.5 self-end min-[900px]:self-end">
              <h3 className="font-condensed text-[clamp(1.75rem,7vw,2.75rem)] font-extrabold uppercase leading-[0.9]">
                {s.title}
              </h3>
              {s.voice ? (
                <p className="font-serif text-[17px] italic leading-snug">
                  {s.voice}
                  <small className="mt-1 block font-mono text-xs font-semibold uppercase not-italic tracking-[0.12em] text-white/65">
                    {/* Q2: a name only where the guest asked for one. */}
                    {s.voiceBy ? <b className="text-[#F0C86E]">{s.voiceBy}</b> : 'A guest'}
                  </small>
                </p>
              ) : null}
              <p className="font-mono text-xs uppercase tracking-[0.12em] text-white/55">
                {i + 1} of {slides.length} · arrow keys move, Escape closes
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
