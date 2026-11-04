'use client';

/**
 * <PhotoHeroSlides> — the photo layer of a 4 Nov 2026 marketing hero: one photo at a time, cross-fading
 * every 5 s, with a slow 2.5% push-in on the one showing. The copy is NOT here — the page renders its
 * own `<h1>` and buttons beside this, so the words ship in the server HTML and never wait on a script.
 *
 * Owner on the first draft (4 Nov, *"images are too cut"*): on a phone the photo covers the first screen
 * (`object-fit: cover`); from 1024 px wide it shows its FULL height, anchored right and pushed right by
 * its own `dr` (how far the subject sits from the right edge), so the person in the photo clears the
 * copy instead of being cropped. The geometry lives in `photo-page.css` (`.pp-slide img[style*='--dr']`).
 *
 * The first photo is server-rendered as the one showing and loads with priority (it is the LCP image);
 * the others load after. Under `prefers-reduced-motion: reduce` the photos never change and never move.
 * The layer is decorative (`aria-hidden`, empty `alt`): the hero's words say what the photos show.
 */

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import './photo-page.css';

export type HeroSlide = {
  /** `/marketing/<date>/<key>.webp` — a file under `public/`. */
  src: string;
  width: number;
  height: number;
  /** ≥1024 px: how far right of the frame's edge the photo is pushed, e.g. `'25%'`. */
  dr?: string;
};

const EVERY_MS = 5000;

export function PhotoHeroSlides({ slides }: { slides: readonly HeroSlide[] }) {
  const [on, setOn] = useState(0);
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setInterval(() => setOn((i) => (i + 1) % slides.length), EVERY_MS);
    return () => window.clearInterval(t);
  }, [slides.length]);

  // A gentle drift as the page scrolls past the hero (the photo moves slower than the words).
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < 1400) el.style.transform = `translate3d(0, ${(y * 0.12).toFixed(1)}px, 0)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="pp-hero-photo" aria-hidden="true" ref={layer}>
      {slides.map((s, i) => (
        <div key={s.src} className="pp-slide" data-on={i === on ? '' : undefined}>
          <Image
            src={s.src}
            alt=""
            width={s.width}
            height={s.height}
            priority={i === 0}
            sizes="100vw"
            style={s.dr ? ({ '--dr': s.dr } as CSSProperties) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
