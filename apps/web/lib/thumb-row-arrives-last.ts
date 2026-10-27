'use client';

import { useEffect, useState } from 'react';

/**
 * lib/thumb-row-arrives-last.ts — THE THUMB ROW ENTERS AFTER THE PAGE HAS BUILT
 * ITSELF (owner 2026-10-27, DECISION_LOG "THE THUMB ROW ARRIVES LAST": *"make
 * thumb row pop up last so it does not intersect with the animation and build up
 * of the page?"*).
 *
 * Before: the Guests row slid up two frames after the first paint — on top of the
 * carousel ring filling (600 ms) and the open section popping and unfolding
 * (420 ms, the fold 120 ms behind it). Now it waits for the page's own arrival to
 * finish, then rises and fades in (the page's CSS draws the rise; this only says
 * WHEN).
 *
 * 🔑 ONE TIMING FOR EVERY THUMB ROW. Every page that adopts the pinned-row
 * template takes its row's entrance from here, so "arrives last" means the same
 * moment everywhere and a page with a longer build-up raises it in one place.
 *
 * Reduced motion: the row is simply there — no wait (nothing is animating, so
 * there is nothing to stay clear of), no rise.
 */

/** The page's build-up, measured on Guests: the ring's 600 ms is the longest; 100 ms of air after it. */
export const THUMB_ROW_ENTERS_AFTER_MS = 700;

/** Pure: how long the row waits. Reduced motion never waits. */
export function thumbRowDelay(reducedMotion: boolean): number {
  return reducedMotion ? 0 : THUMB_ROW_ENTERS_AFTER_MS;
}

/**
 * `true` once the row may enter. Re-arms whenever `key` changes (a page that
 * swaps its body — List ↔ Map — builds up again, so its row enters last again).
 */
export function useThumbRowArrivesLast(key: unknown): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(false);
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setOn(true), thumbRowDelay(reduced));
    return () => window.clearTimeout(t);
  }, [key]);
  return on;
}
