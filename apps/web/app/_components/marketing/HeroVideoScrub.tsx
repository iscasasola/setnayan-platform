'use client';

/**
 * HeroVideoScrub — the admin-uploaded homepage hero, played as a scroll-scrub.
 *
 * The owner uploads a video in /admin/hero-video; the browser extracts it to an
 * ordered list of JPEG frames stored in R2 (see lib/hero-video.ts). This client
 * island preloads those frames and swaps them as you scroll a tall section —
 * the reliable image-sequence technique (browser <video> currentTime scrubbing
 * does NOT hold seeks during scroll). Zero-dependency: a passive scroll listener
 * + requestAnimationFrame, matching the repo's no-GSAP marketing motion.
 *
 * object-fit:cover means one square (1:1) source crops cleanly to desktop and
 * mobile. The CTA fades in over the final stretch. prefers-reduced-motion shows
 * the final frame + CTA statically (no scrub).
 */

import Link from 'next/link';
import { useEffect, useRef, type CSSProperties } from 'react';

type Props = {
  frameUrls: string[];
  ctaText: string;
  ctaHref: string;
};

const SCRUB_END = 0.82; // frames play over the first 82% of scroll; CTA reveals after

// Shared style for the two scroll-synced story captions: dark editorial serif with a
// soft light halo so it reads on the bright video, parked in the both-crops safe zone.
const CAP_STYLE: CSSProperties = {
  left: '50%',
  top: '68%',
  transform: 'translate(-50%, -50%)',
  opacity: 0,
  maxWidth: 760,
  width: '100%',
  color: '#1E2229',
  fontSize: 'clamp(1.5rem, 3.4vw, 2.5rem)',
  lineHeight: 1.12,
  textShadow: '0 1px 2px rgba(255,255,255,.6), 0 2px 32px rgba(255,255,255,.9)',
  willChange: 'opacity',
};

export function HeroVideoScrub({ frameUrls, ctaText, ctaHref }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const capARef = useRef<HTMLDivElement>(null);
  const capBRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const lastIdx = useRef(-1);

  const N = frameUrls.length;

  // Preload every frame so the swap is instant (cached decode, no flicker).
  useEffect(() => {
    const imgs = frameUrls.map((u) => {
      const im = new window.Image();
      im.src = u;
      return im;
    });
    framesRef.current = imgs;
    if (imgRef.current && imgs[0]) imgRef.current.src = imgs[0].src;
  }, [frameUrls]);

  useEffect(() => {
    if (N === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Story captions fade in over scroll bands during the scrub, before the end CTA:
    //   A = the overwhelm (the spectrum of choices) · B = the relief ("say it once").
    const band = (x: number, a: number, b: number, fade: number) =>
      x <= a || x >= b ? 0 : x < a + fade ? (x - a) / fade : x > b - fade ? (b - x) / fade : 1;

    const apply = (idx: number, c: number, p: number) => {
      const frame = framesRef.current[idx];
      if (frame && idx !== lastIdx.current && imgRef.current) {
        lastIdx.current = idx;
        imgRef.current.src = frame.src;
      }
      if (scrimRef.current) scrimRef.current.style.opacity = String(c);
      if (imgRef.current) imgRef.current.style.opacity = String(1 - c * 0.5);
      // Captions hide as soon as the end overlay starts revealing (c > 0).
      if (capARef.current) capARef.current.style.opacity = String(c > 0 ? 0 : band(p, 0.06, 0.34, 0.05));
      if (capBRef.current) capBRef.current.style.opacity = String(c > 0 ? 0 : band(p, 0.45, 0.72, 0.05));
      if (endRef.current) {
        endRef.current.style.opacity = String(c);
        endRef.current.style.transform = `translate(-50%, calc(-50% + ${((1 - c) * 16).toFixed(1)}px))`;
      }
    };

    if (reduce) {
      apply(N - 1, 1, 1);
      return;
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const wrap = wrapRef.current;
        if (!wrap) return;
        const total = wrap.offsetHeight - window.innerHeight;
        const p = total > 0 ? Math.min(Math.max(-wrap.getBoundingClientRect().top / total, 0), 1) : 0;
        const w = Math.min(p / SCRUB_END, 1);
        const idx = Math.round(w * (N - 1));
        const c = Math.min(Math.max((p - 0.8) / 0.18, 0), 1);
        apply(idx, c, p);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [N]);

  return (
    <section ref={wrapRef} className="relative" style={{ height: '300vh', background: '#0e0f12' }}>
      <div className="sticky top-0 overflow-hidden" style={{ height: '100vh', background: '#0e0f12' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: 'cover' }}
        />
        <div
          ref={scrimRef}
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            opacity: 0,
            background:
              'radial-gradient(120% 90% at 50% 46%, rgba(14,15,18,.45) 0%, rgba(14,15,18,.72) 55%, rgba(14,15,18,.92) 100%)',
          }}
        />
        {/* Story captions — fade in over the scrub; hidden by reduced-motion and once the end CTA reveals. */}
        <div ref={capARef} aria-hidden className="m-serif italic pointer-events-none absolute px-6 text-center" style={CAP_STYLE}>
          A thousand choices. The same questions, over and over.
        </div>
        <div ref={capBRef} aria-hidden className="m-serif italic pointer-events-none absolute px-6 text-center" style={CAP_STYLE}>
          Say it once — and find your perfect fit.
        </div>
        <div
          ref={endRef}
          className="absolute px-6 text-center"
          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: 0, maxWidth: 900, width: '100%' }}
        >
          <div
            className="m-mono"
            style={{ fontSize: 11, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--m-orange-3)', marginBottom: 16 }}
          >
            Set na ’yan
          </div>
          <div
            className="m-serif italic"
            style={{ color: '#FBFBFA', fontSize: 'clamp(2rem, 5vw, 3.4rem)', lineHeight: 1.08, margin: '0 auto' }}
          >
            Everything you need to <span style={{ color: 'var(--m-orange-3)' }}>start your wedding.</span>
          </div>
          <div style={{ marginTop: 28 }}>
            <Link href={ctaHref} className="m-btn m-btn-primary m-btn-lg">
              {ctaText}
            </Link>
          </div>
          <div
            className="m-mono"
            style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--m-orange-3)', marginTop: 18 }}
          >
            0% commission · always
          </div>
        </div>
        <div
          className="m-mono absolute left-1/2 -translate-x-1/2"
          style={{ bottom: 22, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)' }}
        >
          scroll ↓
        </div>
      </div>
    </section>
  );
}
