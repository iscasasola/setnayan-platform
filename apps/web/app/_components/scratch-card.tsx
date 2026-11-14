'use client';

/**
 * ScratchCard — a scratch-off: whatever you pass as `children` sits underneath, and a champagne-gold
 * cover (or `coverImage`) sits over it on a canvas. Scratching with a finger or the mouse rubs the cover
 * away; past `threshold` (default 55%) the rest fades out over 400ms and `onComplete` fires once.
 *
 * Built for the couple's "a supplier's gift landed" moment (the wrapped still on top, the opened one
 * underneath), but it knows nothing about gifts — any content, any 1:1 or rectangular box.
 *
 *   • Strokes are continuous `destination-out` lines between successive pointer points (round caps and
 *     joins), so a fast swipe is a smooth path, not a trail of dots. Pointer events cover mouse, touch
 *     and pen; the canvas is `touch-action: none` so scratching never scrolls the page.
 *   • Retina-crisp: the canvas is sized by `devicePixelRatio` (capped at 2, as reveal-particles.tsx does).
 *   • Progress is read back with `getImageData`, sampled, at most every 150ms and on every stroke end.
 *     A cross-origin `coverImage` taints the canvas and that read THROWS — the card then falls back to an
 *     estimate from the strokes themselves (lib/scratch-card.ts), so it can still be finished.
 *   • The sheen sweeps across what is left of the cover only (`source-atop` over the cover each frame),
 *     and gold dust falls from the finger while scratching (`dust`, on by default).
 *   • Resizes with its box (ResizeObserver): before any scratch the cover is redrawn at the new size;
 *     after, what was scratched is scaled across, so a rotate never re-covers what was already rubbed.
 *   • Reduced motion (the phone's own setting): no sheen, no dust, no fade, and a single tap or click
 *     reveals at once — nobody has to scrub. Enter or Space reveals from the keyboard, always.
 *   • `revealed` (controlled) reveals from outside; `disabled` leaves the cover on and ignores input.
 *
 * The rules that decide WHEN it is done live in lib/scratch-card.ts, pure, with their tests.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  brushRadiusFor,
  clearedFraction,
  estimatedFraction,
  isRevealed,
  normaliseThreshold,
  pointsAlong,
  sampleStepFor,
  type Point,
} from '@/lib/scratch-card';

const CHAMPAGNE = ['#B8935A', '#E2C58E', '#C9A26A', '#F3DFB2', '#B08A50'];
const DUST = ['#F3D9A8', '#E2C58E', '#C9A26A', '#FFF4D6'];
const MEASURE_EVERY_MS = 150;
const FADE_MS = 400;
const SHEEN_PERIOD_MS = 3200;

type Dust = { x: number; y: number; vx: number; vy: number; r: number; life: number; color: string };

export function ScratchCard({
  children,
  coverImage,
  threshold,
  onComplete,
  ariaLabel = 'Scratch to reveal',
  dust = true,
  revealed,
  disabled = false,
  className,
  style,
}: {
  /** What the scratch reveals. */
  children: ReactNode;
  /** An image to scratch off instead of the gold cover; drawn to fill the box (cover-fit). */
  coverImage?: string;
  /** Fraction (0–1) that has to be scratched before it reveals itself. Default 0.55. */
  threshold?: number;
  /** Fires once, when the card reveals (by scratching, a reduced-motion tap, the keyboard or `revealed`). */
  onComplete?: () => void;
  /** What a screen reader hears for the cover. */
  ariaLabel?: string;
  /** Gold dust under the finger while scratching. */
  dust?: boolean;
  /** Controlled: true reveals it now. */
  revealed?: boolean;
  /** Keep the cover on and ignore input. */
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const coverRef = useRef<HTMLCanvasElement | null>(null); // offscreen: the cover with its holes
  const reduce = usePrefersReducedMotion();
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  const [done, setDone] = useState(false);
  const doneRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const scratched = useRef(false);
  const last = useRef<Point | null>(null);
  const drawing = useRef(false);
  const lastMeasure = useRef(0);
  const unreadable = useRef(false);
  const stroke = useRef({ length: 0, count: 0 });
  const dustParts = useRef<Dust[]>([]);
  const frame = useRef<number | null>(null);
  const coverImg = useRef<HTMLImageElement | null>(null);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    drawing.current = false;
    setDone(true);
    onCompleteRef.current?.();
  }, []);

  /** Paint the full cover (gold, or the image) into the offscreen canvas. */
  const paintCover = useCallback(() => {
    const cover = coverRef.current;
    const { w, h, dpr } = size.current;
    if (!cover || w === 0) return;
    const c = cover.getContext('2d');
    if (!c) return;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, w, h);
    const img = coverImg.current;
    if (img && img.complete && img.naturalWidth > 0) {
      const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * k;
      const ih = img.naturalHeight * k;
      c.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      return;
    }
    const g = c.createLinearGradient(0, 0, w, h);
    CHAMPAGNE.forEach((col, i) => g.addColorStop(i / (CHAMPAGNE.length - 1), col));
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    // brushed-metal grain: fine light and dark flecks, seeded per size so a redraw looks the same
    let seed = Math.round(w * 31 + h * 17);
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const flecks = Math.round((w * h) / 90);
    for (let i = 0; i < flecks; i += 1) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(255,248,225,0.22)' : 'rgba(110,80,40,0.12)';
      c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 1);
    }
  }, []);

  /** Compose the visible canvas: the cover, the sheen on what is left of it, then the dust. */
  const compose = useCallback((now: number) => {
    const view = viewRef.current;
    const cover = coverRef.current;
    const { w, h, dpr } = size.current;
    if (!view || !cover || w === 0) return;
    const v = view.getContext('2d');
    if (!v) return;
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.globalCompositeOperation = 'source-over';
    v.clearRect(0, 0, view.width, view.height);
    v.drawImage(cover, 0, 0);
    v.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!reduceRef.current) {
      const t = (now % SHEEN_PERIOD_MS) / SHEEN_PERIOD_MS;
      const x = -w + t * w * 3;
      const s = v.createLinearGradient(x, 0, x + w * 0.6, h * 0.6);
      s.addColorStop(0, 'rgba(255,250,235,0)');
      s.addColorStop(0.5, 'rgba(255,250,235,0.32)');
      s.addColorStop(1, 'rgba(255,250,235,0)');
      v.globalCompositeOperation = 'source-atop';
      v.fillStyle = s;
      v.fillRect(0, 0, w, h);
      v.globalCompositeOperation = 'source-over';
      const parts = dustParts.current;
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i]!;
        p.vy += 0.08;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        if (p.life <= 0 || p.y > h + 4) {
          parts.splice(i, 1);
          continue;
        }
        v.globalAlpha = Math.min(1, p.life / 30);
        v.fillStyle = p.color;
        v.beginPath();
        v.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        v.fill();
      }
      v.globalAlpha = 1;
    }
  }, []);

  /** Size both canvases to the box; keep what was already scratched. */
  const fit = useCallback(() => {
    const box = boxRef.current;
    const view = viewRef.current;
    if (!box || !view) return;
    const r = box.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const prev = size.current;
    if (prev.w === w && prev.h === h && prev.dpr === dpr && coverRef.current) return;
    const old = coverRef.current;
    const keep = scratched.current && old ? old : null;
    const cover = document.createElement('canvas');
    cover.width = Math.round(w * dpr);
    cover.height = Math.round(h * dpr);
    coverRef.current = cover;
    view.width = cover.width;
    view.height = cover.height;
    size.current = { w, h, dpr };
    if (keep) {
      const c = cover.getContext('2d');
      c?.drawImage(keep, 0, 0, cover.width, cover.height);
    } else {
      paintCover();
    }
    compose(performance.now());
  }, [compose, paintCover]);

  /** How much is gone, read back from the cover (or estimated, if the browser will not let us read it). */
  const measure = useCallback(() => {
    if (doneRef.current) return;
    const cover = coverRef.current;
    const { w, h } = size.current;
    if (!cover || w === 0) return;
    let fraction = 0;
    if (!unreadable.current) {
      try {
        const data = cover.getContext('2d')?.getImageData(0, 0, cover.width, cover.height).data;
        if (data) fraction = clearedFraction(data, sampleStepFor(cover.width * cover.height));
      } catch {
        unreadable.current = true; // a cross-origin cover: fall through to the estimate
      }
    }
    if (unreadable.current) {
      fraction = estimatedFraction(stroke.current.length, stroke.current.count, brushRadiusFor(w, h), w, h);
    }
    if (isRevealed(fraction, normaliseThreshold(threshold))) finish();
  }, [finish, threshold]);

  // The cover image, when given. Until it loads (or if it fails) the gold cover stands in.
  useEffect(() => {
    coverImg.current = null;
    if (!coverImage) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      coverImg.current = img;
      if (!scratched.current) {
        paintCover();
        compose(performance.now());
      }
    };
    img.src = coverImage;
    return () => {
      img.onload = null;
    };
  }, [coverImage, compose, paintCover]);

  // Size on mount and whenever the box changes.
  useEffect(() => {
    fit();
    const box = boxRef.current;
    const ro = typeof ResizeObserver === 'function' && box ? new ResizeObserver(() => fit()) : null;
    if (box) ro?.observe(box);
    return () => ro?.disconnect();
  }, [fit]);

  // The sheen + dust loop — only while the cover is on and motion is allowed.
  useEffect(() => {
    if (done || reduce) {
      compose(performance.now());
      return;
    }
    const tick = (now: number) => {
      compose(now);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [done, reduce, compose]);

  // Controlled reveal.
  useEffect(() => {
    if (revealed) finish();
  }, [revealed, finish]);

  const local = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const scratchTo = (to: Point) => {
    const cover = coverRef.current;
    const c = cover?.getContext('2d');
    const { w, h, dpr } = size.current;
    if (!cover || !c) return;
    const from = last.current ?? to;
    const radius = brushRadiusFor(w, h);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = radius * 2;
    c.beginPath();
    c.moveTo(from.x, from.y);
    // a tap with no movement still clears a round spot: a zero-length round-capped line draws nothing
    c.lineTo(to.x + (from.x === to.x && from.y === to.y ? 0.01 : 0), to.y);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
    stroke.current.length += Math.hypot(to.x - from.x, to.y - from.y);
    scratched.current = true;
    last.current = to;
    if (dust && !reduceRef.current) {
      for (const p of pointsAlong(from, to, 14)) {
        if (dustParts.current.length > 160) break;
        dustParts.current.push({
          x: p.x + (Math.random() - 0.5) * radius,
          y: p.y + (Math.random() - 0.5) * radius * 0.6,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -0.6 - Math.random() * 1.2,
          r: 0.8 + Math.random() * 1.6,
          life: 30 + Math.random() * 30,
          color: DUST[Math.floor(Math.random() * DUST.length)]!,
        });
      }
    }
    if (reduceRef.current) compose(performance.now());
    const now = performance.now();
    if (now - lastMeasure.current >= MEASURE_EVERY_MS) {
      lastMeasure.current = now;
      measure();
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || doneRef.current) return;
    if (reduceRef.current) {
      finish(); // reduced motion: one tap reveals — nobody has to scrub
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    stroke.current.count += 1;
    last.current = null;
    scratchTo(local(e));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || disabled || doneRef.current) return;
    scratchTo(local(e));
  };
  const endStroke = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    measure();
  };

  return (
    <div ref={boxRef} className={className} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {/* What the scratch reveals. Hidden from screen readers until it is revealed, so nobody hears the prize first. */}
      <div aria-hidden={!done} style={{ position: 'absolute', inset: 0 }}>
        {children}
      </div>
      <canvas
        ref={viewRef}
        role="button"
        tabIndex={done || disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        aria-hidden={done || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endStroke}
        onPointerCancel={endStroke}
        onPointerLeave={endStroke}
        onKeyDown={(e) => {
          if (disabled || doneRef.current) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            finish();
          }
        }}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: disabled ? 'default' : 'grab',
          opacity: done ? 0 : 1,
          transition: reduce ? 'none' : `opacity ${FADE_MS}ms ease`,
          pointerEvents: done ? 'none' : 'auto',
        }}
      />
    </div>
  );
}
