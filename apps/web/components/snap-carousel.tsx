'use client';

/**
 * SnapCarousel — 🎠 THE ONE CAROUSEL SHAPE (owner 2026-10-27, DECISION_LOG "EVERY CAROUSEL SNAPS TO CENTRE, PEEKS BOTH
 * SIDES, LOOPS", verbatim: *"Carousel must snap to center with a small part peaking and continuous not end to end."*;
 * and "ONE UNIVERSAL TEMPLATE FOR THE FOUR DASHBOARDS" — the summary carousel is one shared part). Guests' summary is the
 * first to wear it; every carousel after it reuses THIS, never a copy.
 *
 *   · The current card snaps to the CENTRE (plain CSS `scroll-snap`, no library); a small part of the previous and the
 *     next card peeks on both sides.
 *   · CONTINUOUS — after the last card comes the first, both ways. Once hydrated, two copies of the cards at each end
 *     (`inert`, hidden from assistive tech) stand in for the neighbours; when a swipe settles on a copy, the track is
 *     moved by exactly one lap to the real card — the same picture, so there is no visible jump. The server's HTML
 *     holds each card ONCE (so every door is in the page exactly once).
 *   · Auto-advances one card every `advanceMs` (≈3 s), continuing the loop; a touch, hover, wheel or focus inside it
 *     pauses it for `pauseMs` (6 s) — and it never moves while off screen or while the page is hidden.
 *   · Dots show the position (decorative — each card is labelled "N of M").
 *   · Reduced motion: no auto-advance and no smooth scrolling; a swipe still loops.
 *
 * Writes the dots and the settled index as ATTRIBUTES, never React state: a scroll never re-renders the cards.
 * 🔒 lib/every-carousel-snaps-to-centre-and-loops.test.ts
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './snap-carousel.module.css';

export type CarouselCard = {
  key: string;
  /** What the card is, for "2 of 3: …". */
  label: string;
  node: ReactNode;
};

/** How many copies stand at each end — two, so a card settled on a copy still has a neighbour on its far side. */
export const CAROUSEL_COPIES = 2;
export const CAROUSEL_ADVANCE_MS = 3000;
export const CAROUSEL_PAUSE_MS = 6000;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** The slots in the track: copies of the last cards, the real cards, copies of the first ones. Pure — tested. */
export function carouselSlots(n: number, looping: boolean): { real: number; copy: boolean }[] {
  const real = Array.from({ length: n }, (_, i) => ({ real: i, copy: false }));
  if (!looping || n < 2) return real;
  const k = CAROUSEL_COPIES;
  const before = Array.from({ length: k }, (_, j) => ({ real: (((n - k + j) % n) + n) % n, copy: true }));
  const after = Array.from({ length: k }, (_, j) => ({ real: j % n, copy: true }));
  return [...before, ...real, ...after];
}

export function SnapCarousel({
  cards,
  label,
  className = '',
  advanceMs = CAROUSEL_ADVANCE_MS,
  pauseMs = CAROUSEL_PAUSE_MS,
  attrs,
}: {
  cards: CarouselCard[];
  /** The region's name ("Guest summary"). */
  label: string;
  className?: string;
  advanceMs?: number;
  pauseMs?: number;
  /** Data hooks for the host's own guards (`data-…`). */
  attrs?: Record<string, string>;
}) {
  const n = cards.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  // The copies are added once the page is live — the server draws every card once.
  const [looping, setLooping] = useState(false);
  useEffect(() => setLooping(n > 1), [n]);
  const slots = carouselSlots(n, looping);

  /** The slot nearest the track's centre. */
  const nearest = (track: HTMLElement): number => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let gap = Number.POSITIVE_INFINITY;
    const kids = track.children;
    for (let i = 0; i < kids.length; i++) {
      const el = kids[i] as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < gap) {
        gap = d;
        best = i;
      }
    }
    return best;
  };
  /** Put slot `i`'s centre on the track's centre, at once. */
  const centre = (track: HTMLElement, i: number) => {
    const el = track.children[i] as HTMLElement | undefined;
    if (!el) return;
    track.scrollLeft = el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2;
  };

  // Landing: once the copies are in, the first REAL card is the one in the centre (it already was, before them).
  useIsoLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !looping) return;
    centre(track, CAROUSEL_COPIES);
    track.setAttribute('data-at', '0');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the copies arrive
  }, [looping]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || n < 2) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let settle: ReturnType<typeof setTimeout> | null = null;
    let pausedUntil = 0;
    let hovering = false;
    let focused = false;
    let onScreen = true;

    const realOf = (slot: number): number => {
      if (!looping) return slot;
      return (((slot - CAROUSEL_COPIES) % n) + n) % n;
    };
    const paint = () => {
      raf = 0;
      const at = realOf(nearest(track));
      if (track.getAttribute('data-at') !== String(at)) track.setAttribute('data-at', String(at));
      const dots = dotsRef.current?.children;
      if (dots) for (let i = 0; i < dots.length; i++) dots[i]!.toggleAttribute('data-on', i === at);
    };
    // Settled on a copy → the same card, one lap over. Same picture, so nothing visibly moves.
    const settled = () => {
      settle = null;
      if (!looping) return;
      const slot = nearest(track);
      if (slot < CAROUSEL_COPIES) centre(track, slot + n);
      else if (slot >= CAROUSEL_COPIES + n) centre(track, slot - n);
      paint();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
      if (settle) clearTimeout(settle);
      settle = setTimeout(settled, 140);
    };
    const hold = () => {
      pausedUntil = Date.now() + pauseMs;
    };
    const enter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = true;
      hold();
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hovering = false;
      hold();
    };
    const focusIn = () => {
      focused = true;
      hold();
    };
    const focusOut = (e: FocusEvent) => {
      if (track.contains(e.relatedTarget as Node | null)) return;
      focused = false;
      hold();
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('scrollend', settled as EventListener);
    track.addEventListener('pointerdown', hold, { passive: true });
    track.addEventListener('touchstart', hold, { passive: true });
    track.addEventListener('wheel', hold, { passive: true });
    track.addEventListener('pointerenter', enter);
    track.addEventListener('pointerleave', leave);
    track.addEventListener('focusin', focusIn);
    track.addEventListener('focusout', focusOut);
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(([e]) => {
            onScreen = Boolean(e && e.intersectionRatio > 0.5);
          }, { threshold: [0, 0.5, 1] })
        : null;
    io?.observe(track);
    // ⏱ One card every `advanceMs`, onward round the loop — never under reduced motion, off screen or on a hidden page.
    const tick = window.setInterval(() => {
      if (reduce.matches || !looping || !onScreen || hovering || focused) return;
      if (document.visibilityState === 'hidden' || Date.now() < pausedUntil) return;
      const slot = nearest(track);
      const next = track.children[slot + 1] as HTMLElement | undefined;
      if (!next) return;
      track.scrollTo({ left: next.offsetLeft + next.offsetWidth / 2 - track.clientWidth / 2, behavior: 'smooth' });
    }, advanceMs);
    paint();
    return () => {
      window.clearInterval(tick);
      if (raf) cancelAnimationFrame(raf);
      if (settle) clearTimeout(settle);
      io?.disconnect();
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('scrollend', settled as EventListener);
      track.removeEventListener('pointerdown', hold);
      track.removeEventListener('touchstart', hold);
      track.removeEventListener('wheel', hold);
      track.removeEventListener('pointerenter', enter);
      track.removeEventListener('pointerleave', leave);
      track.removeEventListener('focusin', focusIn);
      track.removeEventListener('focusout', focusOut);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `nearest`/`centre` read only the DOM
  }, [looping, n, advanceMs, pauseMs]);

  return (
    <div
      className={`${styles.carousel} ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      data-snap-carousel=""
      {...attrs}
    >
      <div ref={trackRef} className={styles.track} data-snap-track="" data-looping={looping ? '' : undefined}>
        {slots.map((s, i) => {
          const card = cards[s.real]!;
          return s.copy ? (
            <div key={`copy-${i}`} className={styles.slide} inert aria-hidden data-snap-copy="">
              {card.node}
            </div>
          ) : (
            <div
              key={card.key}
              className={styles.slide}
              role="group"
              aria-roledescription="slide"
              aria-label={`${s.real + 1} of ${n}: ${card.label}`}
              data-snap-slide={card.key}
            >
              {card.node}
            </div>
          );
        })}
      </div>
      {n > 1 ? (
        <div ref={dotsRef} className={styles.dots} aria-hidden data-snap-dots="">
          {cards.map((c, i) => (
            <i key={c.key} data-on={i === 0 ? '' : undefined} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
