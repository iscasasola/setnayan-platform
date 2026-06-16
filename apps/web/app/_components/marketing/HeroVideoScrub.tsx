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

// How tall the pinned scroll-track is, in viewport heights. This is the runway a
// DELIBERATE (slow) scrubber scrolls through at their own pace. (Was 300 → 200vh of
// runway; 700 → 600vh.) Lower it if the page feels too long to scroll.
const TRACK_VH = 700;

// Minimum play-through TIME, in seconds. The animation chases the scroll position but is
// never allowed to advance faster than this — so a full play-through ALWAYS takes at least
// MIN_PLAY_SECONDS. A fast swipe can't finish it in one flick; it keeps gliding slowly,
// even after the finger stops, until it's done. (This is the DURATION dial — it has nothing
// to do with how many frames were extracted; set it near your source clip's real length for
// a natural 1× feel.) Frame COUNT (uploader FPS) only changes how SMOOTH these seconds look.
const MIN_PLAY_SECONDS = 5;
const MAX_RATE = 1 / MIN_PLAY_SECONDS; // max progress (0..1) per second — the speed cap

// Ease-out softness as the animation nears the scroll target (progress/sec per unit of
// remaining distance). The MAX_RATE cap dominates while far from target; this just softens
// the final settle so it doesn't stop abruptly. Higher = snappier settle.
const EASE_PER_SEC = 6;

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
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const capARef = useRef<HTMLDivElement>(null);
  const capBRef = useRef<HTMLDivElement>(null);
  const framesRef = useRef<HTMLImageElement[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<Uint8Array>(new Uint8Array(0));
  const readyRef = useRef(false);
  const armedRef = useRef(false); // gate the swipe-to-dismiss until just after ready, so leftover momentum can't auto-start the scrub mid-way
  const statusRef = useRef<HTMLDivElement>(null);
  const lastIdx = useRef(-1);

  const N = frameUrls.length;

  // Preload frames WITH load-tracking + a "make the wait useful" loading veil.
  // Owner: the wait should sell the story, then invite the swipe — but it must NOT
  // hold the visitor hostage until the LAST frame lands (a long frame sequence made
  // that a multi-second freeze on the front door). So we LOCK page scroll and hold
  // the visitor on the pitch + a progress bar only until the OPENING frames are in
  // (LEAD, below); then we release scroll and flip the prompt to "Swipe up to begin"
  // while the rest stream in the background. apply() holds the nearest already-loaded
  // frame, so the scrub never blanks even if a later frame hasn't arrived yet.
  useEffect(() => {
    const n = frameUrls.length;
    const loaded = new Uint8Array(n);
    loadedRef.current = loaded;
    readyRef.current = false;
    let done = 0;
    let leadDone = 0;
    // Release once the OPENING frames are in (these get fetchPriority high below),
    // not after all N — the rest keep loading in the background.
    const LEAD = Math.min(n, 24);
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const stopTouch = (e: TouchEvent) => e.preventDefault();
    const unlock = () => {
      document.body.style.overflow = '';
      document.removeEventListener('touchmove', stopTouch);
    };
    const reveal = () => {
      if (readyRef.current) return;
      readyRef.current = true;
      unlock();
      // Always begin at the FIRST frame: discard any scroll that slipped through during
      // loading (e.g. iOS momentum the lock didn't fully catch), then arm the
      // swipe-to-dismiss after a beat so that leftover momentum can't auto-start mid-scrub.
      window.scrollTo(0, 0);
      lastIdx.current = -1;
      window.setTimeout(() => {
        armedRef.current = true;
      }, 350);
      // Keep the veil up but invite the swipe — it fades on the first deliberate scroll.
      if (statusRef.current) {
        statusRef.current.textContent = 'Swipe up to begin ↑';
        statusRef.current.style.color = 'var(--m-orange-3)';
        statusRef.current.style.opacity = '1';
      }
    };

    if (reduce) {
      readyRef.current = true;
      if (loaderRef.current) loaderRef.current.style.opacity = '0';
    } else {
      document.body.style.overflow = 'hidden'; // lock scroll while the veil is up
      document.addEventListener('touchmove', stopTouch, { passive: false });
    }

    const imgs = frameUrls.map((u, i) => {
      const im = new window.Image();
      im.decoding = 'async';
      if (i < 24) (im as HTMLImageElement & { fetchPriority?: string }).fetchPriority = 'high'; // opening frames first
      const onDone = () => {
        if (loaded[i]) return;
        loaded[i] = 1;
        done++;
        if (i < LEAD) leadDone++;
        if (barRef.current) barRef.current.style.transform = `scaleX(${(done / n).toFixed(3)})`;
        // Opening frames in (or, for a tiny sequence, all of them) → release + invite
        // the swipe; the bar keeps advancing behind the fading veil as the rest arrive.
        if (!reduce && (leadDone >= LEAD || done >= n)) reveal();
      };
      im.onload = onDone;
      im.onerror = onDone; // a failed frame still counts, so the veil can never trap the user
      im.src = u;
      return im;
    });
    framesRef.current = imgs;
    if (imgRef.current && imgs[0]) imgRef.current.src = imgs[0].src;
    const safety = window.setTimeout(() => { if (!reduce) reveal(); }, 12000); // backstop if even the opening frames stall
    return () => {
      window.clearTimeout(safety);
      unlock(); // always release scroll on unmount
    };
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
      // Fade the "scroll ↓" hint out as the end overlay reveals — at the end
      // there's nothing more to scroll into until the "Tap to learn more" pill
      // (PostHeroReveal) is tapped, so the hint hands off cleanly.
      if (scrollHintRef.current) scrollHintRef.current.style.opacity = String(1 - c);
    };

    if (reduce) {
      if (loaderRef.current) loaderRef.current.style.opacity = '0';
      apply(N - 1, 1, 1);
      return;
    }

    // Time-paced scrub: the visible progress (`eased`) chases the scroll-derived target,
    // but its SPEED is capped (MAX_RATE = 1 / MIN_PLAY_SECONDS progress-per-second). So a
    // fast swipe can't finish the animation in one flick — it keeps gliding at the capped
    // rate, even after the finger stops, until the full play-through has taken its set
    // number of seconds. A slow, deliberate scrub stays UNDER the cap, so it still tracks
    // the scroll position 1:1. Driven by delta-time off the rAF timestamp so the duration
    // is wall-clock (frame-rate independent). The loop self-halts once it reaches the
    // target and re-arms on the next scroll/resize, so it costs nothing while idle.
    //
    // This finishing-after-you-stop behaviour is safe because the content below the hero is
    // collapsed to zero height until tapped (see PostHeroReveal) — a hard fling LANDS at the
    // hero's end and stays pinned there, so the animation always plays out on-screen rather
    // than scrolling away mid-play.
    let raf = 0;
    let eased = -1; // -1 = uninitialised → snap to the first target instead of gliding up from 0
    let lastT = 0; // ms timestamp of the previous tick, for delta-time pacing

    const targetProgress = () => {
      const wrap = wrapRef.current;
      if (!wrap) return 0;
      const total = wrap.offsetHeight - window.innerHeight;
      return total > 0 ? Math.min(Math.max(-wrap.getBoundingClientRect().top / total, 0), 1) : 0;
    };

    const render = (p: number) => {
      const w = Math.min(p / SCRUB_END, 1);
      const idx = Math.round(w * (N - 1));
      const c = Math.min(Math.max((p - 0.8) / 0.18, 0), 1);
      apply(idx, c, p);
    };

    const tick = (now: number) => {
      raf = 0;
      const target = targetProgress();
      // Veil fade keys off the RAW scroll target (not the eased value) so the first
      // deliberate swipe dismisses it immediately, without waiting for the glide.
      if (readyRef.current && armedRef.current && target > 0.004 && loaderRef.current && loaderRef.current.style.opacity !== '0') {
        loaderRef.current.style.opacity = '0';
      }
      if (eased < 0) {
        // First paint: land exactly on the current frame, no glide-in.
        eased = target;
        lastT = now;
        render(eased);
        return;
      }
      const dt = Math.min((now - lastT) / 1000, 0.05); // seconds; clamp tab-away / first-resume gaps
      lastT = now;
      const diff = target - eased;
      if (Math.abs(diff) < 0.0006) {
        if (eased !== target) {
          eased = target;
          render(eased); // settle exactly on the target frame
        }
        return; // converged → stop until the next scroll/resize re-arms the loop
      }
      // Velocity = proportional ease-out, but SPEED-CAPPED so a full play-through can't
      // happen faster than MIN_PLAY_SECONDS no matter how fast the visitor swiped.
      const want = diff * EASE_PER_SEC; // desired progress/sec (softens near the target)
      const vel = Math.max(-MAX_RATE, Math.min(MAX_RATE, want));
      eased += vel * dt;
      render(eased);
      raf = requestAnimationFrame(tick); // keep gliding toward the target
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    kick();
    return () => {
      window.removeEventListener('scroll', kick);
      window.removeEventListener('resize', kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [N]);

  return (
    <section ref={wrapRef} className="relative" style={{ height: `${TRACK_VH}vh`, background: '#0e0f12' }}>
      <div className="sticky top-0 overflow-hidden" style={{ height: '100vh', background: '#0e0f12' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* Full-bleed: the square (1:1) source COVERS the viewport on desktop and
            mobile, cropping to the captions' both-crops safe zone (Owner 2026-06-14:
            "fill the screen"). Displayed sharpness scales with the admin frame
            extraction resolution (FRAME_MAX_EDGE in hero-uploader.tsx) — bump it
            and re-publish for a crisper fill on large screens. */}
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
          ref={scrollHintRef}
          className="m-mono absolute left-1/2 -translate-x-1/2"
          style={{ bottom: 22, fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.6)', transition: 'opacity .3s ease' }}
        >
          scroll ↓
        </div>
        {/* Loading veil — turns the wait into the pitch: holds the visitor on the story
            (scroll locked) until every frame is in, then invites the swipe; fades on first scroll. */}
        <div
          ref={loaderRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
          style={{ background: '#F6F3EE', zIndex: 5, transition: 'opacity .8s ease' }}
        >
          <div style={{ maxWidth: 600, textAlign: 'center' }}>
            <div
              className="m-mono"
              style={{ fontSize: 10, letterSpacing: '.26em', textTransform: 'uppercase', color: 'var(--m-orange-3)', marginBottom: 22 }}
            >
              Set na ’yan
            </div>
            <p
              className="m-serif italic"
              style={{ color: '#1E2229', fontSize: 'clamp(1.4rem, 4.4vw, 2.15rem)', lineHeight: 1.32, margin: '0 auto 14px', maxWidth: 560 }}
            >
              Ever felt buried by wedding planning — hundreds, even thousands of services to sift through, only to find most don’t fit your wedding?
            </p>
            <p style={{ color: 'rgba(30,34,41,.6)', fontSize: 'clamp(.95rem, 2.6vw, 1.05rem)', lineHeight: 1.5, margin: '0 auto 30px', maxWidth: 440 }}>
              We’re setting it all up for you.
            </p>
            <div style={{ height: 2, maxWidth: 220, margin: '0 auto 16px', borderRadius: 2, background: 'rgba(30,34,41,.12)', overflow: 'hidden' }}>
              <div
                ref={barRef}
                style={{ height: '100%', background: 'var(--m-orange-3)', transformOrigin: 'left', transform: 'scaleX(0)', transition: 'transform .25s linear' }}
              />
            </div>
            <div
              ref={statusRef}
              className="m-mono"
              style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(30,34,41,.5)', transition: 'color .5s ease, opacity .5s ease' }}
            >
              Setting it up for you…
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
