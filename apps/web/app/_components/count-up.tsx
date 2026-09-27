'use client';

import { useEffect, useState } from 'react';
import { formatCount } from '@/lib/format-number';

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
 *
 * 🔢 EVERY FRAME IS GROUPED (owner 2026-09-27, "numbers with comma"): the value
 * is printed through `formatCount`, so the server render reads "100,050" and the
 * count-up ticks 1,204 → 58,311 → 100,050, never "100050". Money passes
 * `format={formatPhp}` (lib/php.ts) instead — one money formatter, not two.
 * `lib/numbers-carry-commas.test.ts` renders this and fails on a raw frame.
 */
export function CountUp({
  value,
  delayMs = 0,
  suffix = '',
  format = formatCount,
}: {
  /** The real, final value — rendered as-is on the server. */
  value: number;
  /** Per-element stagger delay before the count starts. */
  delayMs?: number;
  /** Trailing unit, e.g. "%" for ring labels. */
  suffix?: string;
  /** How each frame is printed. Defaults to the grouped count; pass `formatPhp` for money. */
  format?: (n: number) => string;
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
      {format(display)}
      {suffix}
    </span>
  );
}
