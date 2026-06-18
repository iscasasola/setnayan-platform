'use client';

/**
 * RevealParticles — a lightweight canvas-2D effect layer for the rigid reveal
 * family (envelopes + church doors), which has no particle system of its own
 * (the WebGL veil has its own three.js petals). Two kinds:
 *
 *   - 'butterflies' — flutter up + out as the envelope flaps open
 *   - 'petals'      — rose petals drift + sway down through the opening
 *
 * Self-contained: mounts a `pointer-events-none absolute inset-0` canvas, sizes
 * to its parent via ResizeObserver, spawns over the opening window (~5s) then
 * lets the last particles settle, and tears down on unmount. Honors
 * prefers-reduced-motion (renders nothing). No WebGL context — cheap enough for
 * the live guest page on a phone.
 *
 * Mount it inside the reveal's `relative` stage, ABOVE the flaps.
 */

import { useEffect, useRef } from 'react';

export type RevealParticleKind = 'butterflies' | 'petals';

const PETAL_PALETTE = ['#d98aa0', '#c9637f', '#e3a9b6'];
const BFLY_PALETTE = ['#cb9e4b', '#b8748f', '#7a3b52'];
const MAX = 44;
const SPAWN_WINDOW_MS = 5200;
const SPAWN_EVERY_MS = 150;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  flap: number;
  color: string;
};

export function RevealParticles({
  kind,
  colors,
}: {
  kind: RevealParticleKind;
  /** Override palette (e.g. Mood-Board petal colour). Falls back to the kind default. */
  colors?: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const palette = colors && colors.length ? colors : kind === 'petals' ? PETAL_PALETTE : BFLY_PALETTE;
    let w = 1;
    let h = 1;

    const resize = () => {
      const r = cv.getBoundingClientRect();
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    ro?.observe(cv);

    const parts: Particle[] = [];
    const pick = () => palette[Math.floor(Math.random() * palette.length)]!;

    const spawn = () => {
      if (parts.length >= MAX) return;
      const s = Math.max(0.6, h / 620);
      if (kind === 'petals') {
        parts.push({
          x: Math.random() * w,
          y: -8,
          vx: (Math.random() - 0.5) * 0.4 * s,
          vy: (0.5 + Math.random() * 0.7) * s,
          size: (3 + Math.random() * 2.6) * s,
          rot: Math.random() * 6.2832,
          vr: (Math.random() - 0.5) * 0.12,
          flap: 0,
          color: pick(),
        });
      } else {
        parts.push({
          x: w * 0.5 + (Math.random() - 0.5) * w * 0.6,
          y: h * (0.5 + Math.random() * 0.15),
          vx: (Math.random() - 0.5) * 1.1 * s,
          vy: -(0.5 + Math.random() * 0.7) * s,
          size: (5 + Math.random() * 3) * s,
          rot: 0,
          vr: 0,
          flap: Math.random() * 6.2832,
          color: pick(),
        });
      }
    };

    const drawPetal = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = 0.92;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.2832);
      ctx.fill();
      ctx.restore();
    };
    const drawButterfly = (p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      const ww = p.size * (0.55 + 0.45 * Math.abs(Math.sin(p.flap)));
      ctx.fillStyle = p.color;
      for (const d of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(d * ww * 0.5, -p.size * 0.2, ww * 0.5, p.size * 0.5, d * 0.5, 0, 6.2832);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(d * ww * 0.45, p.size * 0.3, ww * 0.42, p.size * 0.38, d * 0.4, 0, 6.2832);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(40,30,20,0.7)';
      ctx.fillRect(-1, -p.size * 0.5, 2, p.size);
      ctx.restore();
    };

    let raf = 0;
    const start = performance.now();
    let last = 0;
    const loop = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, w, h);
      if (elapsed < SPAWN_WINDOW_MS && t - last > SPAWN_EVERY_MS) {
        spawn();
        last = t;
      }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]!;
        if (kind === 'petals') {
          p.x += p.vx + Math.sin(p.y / 32) * 0.3;
          p.y += p.vy;
          p.rot += p.vr;
          drawPetal(p);
          if (p.y > h + 10) parts.splice(i, 1);
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.flap += 0.35;
          drawButterfly(p);
          if (p.y < -14 || p.x < -20 || p.x > w + 20) parts.splice(i, 1);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [kind, colors]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
