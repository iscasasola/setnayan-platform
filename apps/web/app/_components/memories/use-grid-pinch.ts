'use client';

/**
 * use-grid-pinch.ts — THE MEMORIES GRID'S ZOOM, LIKE APPLE PHOTOS (owner 2026-10-23, after trying the prototype:
 * *"The pinch changes too fast"* → controller brief: one column step per gesture, never several).
 *
 *   TOUCH   while two fingers move the grid only SCALES (a transform — nothing re-lays out); on release it snaps
 *           ONE step if the pinch passed a clear threshold (`gestureStep`: ≤ 0.8 more columns, ≥ 1.25 fewer),
 *           otherwise it springs back.
 *   ⌃+WHEEL a trackpad pinch (and ⌃ + a mouse wheel): every event of one gesture (gaps < 250 ms) is summed, the grid
 *           scales live, and the gesture's end applies at most ONE step on the same thresholds.
 *   − / +   the desktop buttons: one step, the same snap.
 *
 * THE SNAP keeps the photo under the fingers where it was: the tile under the gesture's point is found before the
 * columns change, the scroller moves so the same spot of that tile is back under the point, and the new layout
 * starts drawn at the gesture's scale and eases to rest in 200 ms (`SNAP_MS`). prefers-reduced-motion: no spring,
 * no ease — the step lands as it is.
 *
 * Returns `snapTo(next, point?)` for the caller's buttons; the caller owns the column state (and remembers it).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import {
  SNAP_MS,
  WHEEL_GESTURE_GAP_MS,
  gestureStep,
  liveScale,
  pinchScale,
  wheelScale,
} from '@/lib/gallery-zoom';

const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';

type Anchor = { idx: number; fx: number; fy: number; x: number; y: number; s: number; ratio: number };

function scrollerOf(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useGridPinch({
  gridRef,
  cols,
  stepFrom,
  setCols,
}: {
  gridRef: RefObject<HTMLElement | null>;
  cols: number;
  /** One step along the scale from `current` — clamped (`stepColumns`). */
  stepFrom: (current: number, dir: 1 | -1) => number;
  /** Lay the grid out at `next` columns (the caller remembers it). */
  setCols: (next: number) => void;
}): { snap: (dir: 1 | -1, point?: { x: number; y: number }) => void } {
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const anchorRef = useRef<Anchor | null>(null);

  const clearTransform = useCallback((el: HTMLElement) => {
    el.style.transition = '';
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.willChange = '';
  }, []);

  const springBack = useCallback(
    (el: HTMLElement) => {
      if (reducedMotion() || !el.style.transform) return clearTransform(el);
      el.style.transition = `transform ${SNAP_MS}ms ${EASE}`;
      el.style.transform = 'none';
      window.setTimeout(() => clearTransform(el), SNAP_MS + 30);
    },
    [clearTransform],
  );

  /** Commit ONE step at the gesture's point, drawn so far at visual scale `s`. */
  const commit = useCallback(
    (dir: 1 | -1, s: number, x: number, y: number) => {
      const el = gridRef.current;
      if (!el) return;
      const from = colsRef.current;
      const next = stepFrom(from, dir);
      if (next === from) return springBack(el);
      const tiles = [...el.querySelectorAll<HTMLElement>('[data-memories-tile]')];
      const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-memories-tile]') ?? null;
      const idx = hit ? tiles.indexOf(hit) : -1;
      let fx = 0.5;
      let fy = 0.5;
      if (hit) {
        const r = hit.getBoundingClientRect();
        fx = r.width > 0 ? (x - r.left) / r.width : 0.5;
        fy = r.height > 0 ? (y - r.top) / r.height : 0.5;
      }
      anchorRef.current = { idx, fx, fy, x, y, s, ratio: from / next };
      setCols(next);
    },
    [gridRef, setCols, springBack, stepFrom],
  );

  // AFTER THE COLUMNS CHANGE: put the anchored spot back under the point, then ease from the gesture's scale to rest.
  useLayoutEffect(() => {
    const a = anchorRef.current;
    const el = gridRef.current;
    if (!a || !el) return;
    anchorRef.current = null;
    el.style.transition = 'none';
    el.style.transform = '';
    const tile = a.idx >= 0 ? el.querySelectorAll<HTMLElement>('[data-memories-tile]')[a.idx] : null;
    let px = a.x;
    if (tile) {
      const r = tile.getBoundingClientRect();
      px = r.left + a.fx * r.width;
      const py = r.top + a.fy * r.height;
      scrollerOf(el).scrollBy({ top: py - a.y, behavior: 'instant' as ScrollBehavior });
    }
    if (reducedMotion()) return clearTransform(el);
    const g = el.getBoundingClientRect();
    const k = a.s / a.ratio;
    el.style.willChange = 'transform';
    el.style.transformOrigin = `${px - g.left}px ${a.y - g.top}px`;
    el.style.transform = `translate(${a.x - px}px, 0) scale(${k})`;
    void el.offsetWidth; // the start frame is drawn before the ease begins
    el.style.transition = `transform ${SNAP_MS}ms ${EASE}`;
    el.style.transform = 'none';
    const t = window.setTimeout(() => clearTransform(el), SNAP_MS + 30);
    return () => window.clearTimeout(t);
  }, [cols, gridRef, clearTransform]);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;

    const live = (s: number, ox: number, oy: number) => {
      el.style.transition = 'none';
      el.style.willChange = 'transform';
      el.style.transformOrigin = `${ox}px ${oy}px`;
      el.style.transform = `scale(${liveScale(s)})`;
    };

    // ── TOUCH ───────────────────────────────────────────────────────────────
    let t0 = 0;
    let tNow = 0;
    let mid = { x: 0, y: 0 };
    let origin = { x: 0, y: 0 };
    const dist = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      t0 = dist(e.touches);
      tNow = t0;
      mid = { x: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2, y: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 };
      const g = el.getBoundingClientRect();
      origin = { x: mid.x - g.left, y: mid.y - g.top };
    };
    const onMove = (e: TouchEvent) => {
      if (!t0 || e.touches.length !== 2) return;
      e.preventDefault();
      tNow = dist(e.touches);
      live(pinchScale(t0, tNow), origin.x, origin.y);
    };
    const onEnd = (e: TouchEvent) => {
      if (!t0 || e.touches.length >= 2) return;
      const s = pinchScale(t0, tNow);
      t0 = 0;
      const dir = gestureStep(s);
      if (dir) commit(dir, liveScale(s), mid.x, mid.y);
      else springBack(el);
    };
    // Safari's own page zoom must not take the gesture the grid is answering.
    const onGesture = (e: Event) => e.preventDefault();

    // ── ⌃ + WHEEL — one gesture while its events keep coming ────────────────
    let sum = 0;
    let wheelTimer = 0;
    let at = { x: 0, y: 0 };
    let wOrigin = { x: 0, y: 0 };
    const endWheel = () => {
      wheelTimer = 0;
      const s = wheelScale(sum);
      sum = 0;
      const dir = gestureStep(s);
      if (dir) commit(dir, liveScale(s), at.x, at.y);
      else springBack(el);
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (!wheelTimer) {
        at = { x: e.clientX, y: e.clientY };
        const g = el.getBoundingClientRect();
        wOrigin = { x: at.x - g.left, y: at.y - g.top };
      } else {
        window.clearTimeout(wheelTimer);
      }
      // A line-mode wheel (Firefox) reports lines, not pixels.
      sum += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      live(wheelScale(sum), wOrigin.x, wOrigin.y);
      wheelTimer = window.setTimeout(endWheel, WHEEL_GESTURE_GAP_MS);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });
    // ⌃-wheel / trackpad pinch and Safari's gesture are heard on the WINDOW while the grid is mounted — a pinch
    // over the header, the count line or a gutter must zoom the grid too, never the browser's page zoom.
    window.addEventListener('gesturestart', onGesture as EventListener, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      if (wheelTimer) window.clearTimeout(wheelTimer);
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
      window.removeEventListener('gesturestart', onGesture as EventListener);
      window.removeEventListener('wheel', onWheel);
    };
  }, [gridRef, commit, springBack]);

  const snap = useCallback(
    (dir: 1 | -1, point?: { x: number; y: number }) => {
      const el = gridRef.current;
      if (!el) return;
      let p = point;
      if (!p) {
        const g = el.getBoundingClientRect();
        const top = Math.max(g.top, 0);
        const bottom = Math.min(g.bottom, window.innerHeight);
        p = { x: g.left + g.width / 2, y: top + (bottom - top) / 2 };
      }
      commit(dir, 1, p.x, p.y);
    },
    [gridRef, commit],
  );

  return { snap };
}
