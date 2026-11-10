'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Count, Fill, easeOutCubic, peekShown, startFor } from '@/components/count';
import { useReanimate } from './reanimate';

/**
 * 🎞 THE MOTION UNDER "ANALYTICS, GROWING" (owner-approved 6 Nov 2026 — the prototype's Motion table).
 *
 * Nothing here is a second engine for what the house already moves:
 *   · counts  = `Count` / `useCountTo` (components/count.tsx) — 420–900 ms by jump, easeOutCubic;
 *   · widths  = `Fill` / `.meter-fill` — 700 ms cubic-bezier(.2,.8,.2,1);
 *   · reveal  = `Reanimate` — IO 0.2 / −8 %, once, `.perf-reanim` fade-rise 0.4 s.
 * What is NEW is the handful of shapes those two cannot draw — a bar growing from its baseline (scaleY), a clip
 * drawing a line in, a ring or arc sweeping (stroke-dashoffset), a needle turning, a mark popping in, a row rising.
 * They run on `useTween`, which keeps the SAME page-lifetime memory as `Count` and `Fill` (`startFor`, keyed `tw:…`),
 * so a window change slides old → new and a re-render never replays.
 *
 * HELD UNTIL SEEN: inside a `Reanimate` that has not played yet, every value shows what it last showed (0 the first
 * time) — the section is invisible then anyway — and plays the moment the section scrolls in.
 * Reduced motion or a hidden tab → the final value at once (the house's own traps).
 */

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Sections that arrive together (within 200 ms of the page painting) start ~120 ms apart. */
const BatchCtx = createContext(0);
export const SectionBatch = BatchCtx.Provider;
export function useBatch(): number {
  return useContext(BatchCtx);
}

/** null = not inside a Reanimate (play at once) · false = held · true = playing. */
export function usePlayed(): boolean | null {
  return useReanimate();
}

/** What a held `Count`/`Fill` keeps showing until its section plays: its last value, or 0. */
export function useHeld(value: number, key: string): number {
  const played = useReanimate();
  return played === false ? (peekShown(key) ?? 0) : value;
}

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    ((typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ||
      document.visibilityState === 'hidden')
  );
}

/** cubic-bezier(x1,y1,x2,y2) → an easing (Newton steps), the curves the house writes in CSS. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    return sy(Math.max(0, Math.min(1, t)));
  };
}

/** `.perf-bar-grow-y`'s curve — cubic-bezier(0.22, 1, 0.36, 1). */
export const EASE_GROW = bezier(0.22, 1, 0.36, 1);
/** `.meter-fill`'s curve — cubic-bezier(0.2, 0.8, 0.2, 1). */
export const EASE_FILL = bezier(0.2, 0.8, 0.2, 1);
export const EASE_OUT = easeOutCubic;

/**
 * One value moving from what was last shown under `key` to `to`. Returns the value for this frame. SSR and the first
 * paint draw the held value (0 the first time) inside an unplayed section, the final value anywhere else.
 */
export function useTween(key: string, to: number, opts: { dur: number; ease: (t: number) => number; delay?: number }): number {
  const played = useReanimate();
  const batch = useBatch();
  const k = `tw:${key}`;
  const [v, setV] = useState<number>(() => (played === false ? (peekShown(k) ?? 0) : to));
  const raf = useRef(0);
  useIso(() => {
    if (played === false) {
      setV(peekShown(k) ?? 0);
      return;
    }
    const from = startFor(k, to);
    if (from === to || reduced()) {
      setV(to);
      return;
    }
    setV(from);
    let start = 0;
    let shown = from;
    let done = false;
    const wait = (opts.delay ?? 0) + batch;
    const tick = (now: number) => {
      if (!start) start = now;
      const p = Math.max(0, Math.min(1, (now - start - wait) / opts.dur));
      shown = from + (to - from) * opts.ease(p);
      setV(shown);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else done = true;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf.current);
      // Cut short: remember what is on screen, so the next run starts from it.
      if (!done) startFor(k, shown);
    };
    // `opts` and `key` are identity, not inputs — only a new target (or the section playing) moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, played]);
  return v;
}

/** `Count`, held until its section plays, then counted after `delay` (+ the section's batch offset). */
export function HeldCount({
  value,
  id,
  delay = 0,
  format,
  className,
}: {
  value: number;
  id: string;
  delay?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const batch = useBatch();
  const v = useHeld(value, id);
  return <Count value={v} id={id} delayMs={batch + delay} format={format} className={className} />;
}

/** `Fill`, held until its section plays, then slid after `delay` (+ the section's batch offset). */
export function HeldFill({
  value,
  id,
  delay = 0,
  className,
  style,
}: {
  value: number;
  id: string;
  delay?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const batch = useBatch();
  const v = useHeld(value, `fill:${id}`);
  return <Fill value={v} id={id} delayMs={batch + delay} className={className} style={style} />;
}
