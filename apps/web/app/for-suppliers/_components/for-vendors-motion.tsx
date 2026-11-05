'use client';

/**
 * Client motion for /for-suppliers. The page stays a Server Component (owns metadata, JSON-LD and every live
 * price); these thin islands only move what the server already drew.
 *
 *  · `RevealOnView` — one quiet fade+rise per section as it scrolls in (opacity-only, so content stays in the
 *    accessibility tree; reduced motion rests visible).
 *  · `HeroSlides` — the hero's six trade photos (4 Nov 2026 prototype): one every 5 s, a 0.9 s cross-fade and the
 *    slow 2.5% zoom (CSS). Reduced motion: the first photo stays, nothing turns.
 *  · `ProblemsList` — the twelve problems: the first three, then "See all 12 ›"; each card's photo settles and
 *    its line rises as it scrolls in. The motion is switched ON here (`data-motion`), so a visitor without
 *    JavaScript still sees every photo and every line.
 */

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import { useReveal } from '@/app/_components/marketing/_premium';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';
import { formatCount } from '@/lib/format-number';
import css from './vendor-grow.module.css';

/** Reveals the wrapped section as one quiet fade+rise when it scrolls into view. */
export function RevealOnView({ children, y = 20 }: { children: ReactNode; y?: number }) {
  const ref = useReveal({ y });
  return <div ref={ref as React.RefObject<HTMLDivElement>}>{children}</div>;
}

const SLIDE_MS = 5000;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The hero's photos, server-drawn; this only says which one is showing. */
export function HeroSlides({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [on, setOn] = useState(0);
  useEffect(() => {
    if (count < 2 || reducedMotion()) return;
    const id = window.setInterval(() => setOn((i) => (i + 1) % count), SLIDE_MS);
    return () => window.clearInterval(id);
  }, [count]);
  return (
    <>
      {slides.map((slide, i) => (
        <div key={i} className={i === on ? `${css.slide} ${css.slideOn}` : css.slide}>
          {slide}
        </div>
      ))}
    </>
  );
}

/**
 * The twelve problems. `children` are the server-drawn cards in order; the first `shown` are always visible and
 * the rest open under one button.
 */
export function ProblemsList({
  children,
  shown = 3,
}: {
  children: ReactNode;
  shown?: number;
}) {
  const cards = Children.toArray(children);
  const total = cards.length;
  const [open, setOpen] = useState(false);
  const [motion, setMotion] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const intend = useRevealOnOpen(open, () => ({ head: listRef.current }));

  useEffect(() => {
    const list = listRef.current;
    if (!list || reducedMotion() || !('IntersectionObserver' in window)) return;
    setMotion(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add(css.solveIn!);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -18% 0px' },
    );
    list.querySelectorAll(':scope > li').forEach((li) => io.observe(li));
    return () => io.disconnect();
  }, [open]);

  const toggle = () => {
    const next = !open;
    if (next) intend();
    setOpen(next);
    if (!next) listRef.current?.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <>
      <ol
        ref={listRef}
        className={open ? css.solves : `${css.solves} ${css.solvesClosed}`}
        data-motion={motion ? 'on' : undefined}
      >
        {cards.map((card, i) => (
          <li key={i} className={i < shown ? css.solve : `${css.solve} ${css.solveMore}`}>
            {card}
          </li>
        ))}
      </ol>
      {total > shown ? (
        <div className={css.solvesMore}>
          <button type="button" className={`${css.btn} ${css.btnSecondary}`} aria-expanded={open} onClick={toggle}>
            {open ? `Show the top ${formatCount(shown)}` : `See all ${formatCount(total)} ›`}
          </button>
        </div>
      ) : null}
    </>
  );
}
