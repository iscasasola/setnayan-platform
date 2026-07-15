'use client';

import { useEffect, useState } from 'react';

/**
 * CountUp — the shared animated-numeral island for the app's REAL aggregates
 * (hero stats · focal numerals · row counts · ring % labels). Promoted from the
 * launcher's `_components/count-up.tsx` to `app/_components/` in Glass PR-1
 * (2026-07-15) so every recomposed surface (event / vendor / admin) counts its
 * headline numerals the same way.
 *
 * SSR renders the FINAL value (no hydration mismatch; works with JS off), then
 * on mount — unless the visitor prefers reduced motion — the number snaps to 0
 * and counts up to the target via rAF over 1150ms with easeOutCubic, after the
 * caller's per-element delay. Purely presentational: the value itself is always
 * server-computed real data.
 */
export function CountUp({
  value,
  delayMs = 0,
  suffix = '',
}: {
  /** The real, final value — rendered as-is on the server. */
  value: number;
  /** Per-element stagger delay before the count starts. */
  delayMs?: number;
  /** Trailing unit, e.g. "%" for ring labels. */
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!Number.isFinite(value) || value <= 0) return;
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      // Reduced motion: keep the final value, no animation.
      return;
    }
    const DURATION = 1150;
    let raf = 0;
    let start = 0;
    setDisplay(0);
    const timer = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!start) start = now;
        const t = Math.min(1, (now - start) / DURATION);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        setDisplay(Math.round(eased * value));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [value, delayMs]);

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}
