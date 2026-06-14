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

// Shared style for the two scroll-synced story captions: bold near-black serif with a
// crisp white outline + halo so it stays readable over BOTH the bright field and the
// darker objects (cars), parked in the both-crops safe zone. fontWeight 800 forces a
// heavy weight even on the single-weight display serif (Instrument Serif).
const CAP_STYLE: CSSProperties = {
  left: '50%',
  top: '68%',
  transform: 'translate(-50%, -50%)',
  opacity: 0,
  maxWidth: 840,
  width: '100%',
  color: '#14171c',
  fontWeight: 800,
  fontSize: 'clamp(1.7rem, 4.2vw, 3rem)',
  lineHeight: 1.08,
  letterSpacing: '0.005em',
  textShadow:
    '0 0 2px #FBFBFA, 0 0 4px #FBFBFA, 0 1px 1px #FBFBFA, 0 -1px 1px #FBFBFA, 1px 0 1px #FBFBFA, -1px 0 1px #FBFBFA, 0 3px 18px rgba(251,251,250,.8)',
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
  const loaderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<Uint8Array>(new Uint8Array(0));
  const readyRef = useRef(false);
  const lastIdx = useRef(-1);

  const N = frameUrls.length;

  // Preload frames WITH load-tracking. Guards against the "stuck / next images don't
  // show" feeling on a dense sequence: (1) apply() never swaps to a frame that hasn't
  // decoded yet — it holds the nearest loaded one; (2) the loading veil stays up until
  // EVERY frame is decoded (owner: "everything must load first" — the user never enters
  // the scrub on a half-loaded sequence), then fades out. A thin progress bar shows it
  // working; a long backstop timeout is the only escape hatch if a request truly hangs.
  useEffect(() => {
    const n = frameUrls.length;
    const loaded = new Uint8Array(n);
    loadedRef.current = loaded;
    readyRef.current = false;
    let done = 0;
    const baseline = n; // owner: everything must load first — hold the veil until EVERY frame is in
    const reveal = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      if (loaderRef.current) loaderRef.current.style.opacity = '0';
    };
    const imgs = frameUrls.map((u, i) => {
      const im = new window.Image();
      im.decoding = 'async';
      if (i < 24) (im as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high'; // opening frames first
      const onDone = () => {
        if (loaded[i]) return;
        loaded[i] = 1;
        done++;
        if (barRef.current) barRef.current.style.transform = `scaleX(${(done / n).toFixed(3)})`;
        if (done >= baseline) reveal();
      };
      im.onload = onDone;
      im.onerror = onDone; // a single failed frame must not trap the user behind the veil
      im.src = u;
      return im;
    });
    framesRef.current = imgs;
    if (imgRef.current && imgs[0]) imgRef.current.src = imgs[0].src;
    const safety = window.setTimeout(reveal, 30000); // backstop only, for a request that truly hangs (load/error never fire); the nearest-loaded fallback still covers any gap
    return () => window.clearTimeout(safety);
  }, [frameUrls]);

  useEffect(() => {
    if (N === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Story captions fade in over scroll bands during the scrub, before the end CTA:
    //   A = the overwhelm (the spectrum of choices) · B = the relief ("say it once").
    const band = (x: number, a: number, b: number, fade: number) =>
      x <= a || x >= b ? 0 : x < a + fade ? (x - a) / fade : x > b - fade ? (b - x) / fade : 1;

    const apply = (idx: number, c: number, p: number) => {
      const loaded = loadedRef.current;
      // Never swap to a not-yet-loaded frame (the "stuck on blank" bug) — hold the
      // nearest already-loaded frame until the target one arrives.
      let useIdx = idx;
      if (loaded.length && !loaded[idx]) {
        for (let d = 1; d < N; d++) {
          if (idx - d >= 0 && loaded[idx - d]) { useIdx = idx - d; break; }
          if (idx + d < N && loaded[idx + d]) { useIdx = idx + d; break; }
        }
      }
      const frame = framesRef.current[useIdx];
      if (frame && useIdx !== lastIdx.current && imgRef.current) {
        lastIdx.current = useIdx;
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
      if (loaderRef.current) loaderRef.current.style.opacity = '0';
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
        {/* Loading veil — hides the half-loaded sequence until the opening frames decode, then fades out. */}
        <div
          ref={loaderRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          style={{ background: '#0e0f12', zIndex: 5, transition: 'opacity .7s ease' }}
        >
          <div style={{ width: 190, textAlign: 'center' }}>
            <div
              className="m-mono"
              style={{ fontSize: 10, letterSpacing: '.24em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginBottom: 14 }}
            >
              Setting the scene
            </div>
            <div style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,.14)', overflow: 'hidden' }}>
              <div
                ref={barRef}
                style={{ height: '100%', background: 'var(--m-orange-3)', transformOrigin: 'left', transform: 'scaleX(0)', transition: 'transform .2s linear' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
