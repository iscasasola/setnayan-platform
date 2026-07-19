'use client';

import { useEffect, useRef, useState } from 'react';
import { useReanimate } from './reanimate';

/**
 * Count-up number for My Performance — ticks 0 → `value` so the figures animate
 * alongside the graphs. It fires off the same in-view signal as the bars: when
 * wrapped in <Reanimate>, it holds at 0 until the section scrolls into view, then
 * ticks (owner 2026-07-02: "always show their first animation"). It also re-ticks
 * on the Daily/Monthly/Annual toggle, which remounts the block.
 *
 * In-view flag via context: `null` = no wrapper → tick on mount (fallback);
 * `false` = armed, not yet in view → hold 0; `true` = in view → tick.
 * Starts at 0 (clean tick, no value→0 flash). value===0 skips the pointless
 * tick. Owner "always play it": NOT gated behind prefers-reduced-motion.
 * `format` renders each frame (e.g. formatPhp for ₱).
 */
export function CountUp({
  value,
  durationMs = 650,
  format,
}: {
  value: number;
  durationMs?: number;
  format?: (n: number) => string;
}) {
  const played = useReanimate();
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Wrapped in <Reanimate> but the section hasn't scrolled into view yet —
    // hold at 0 so the tick coincides with the section's reveal.
    if (played === false) {
      setDisplay(0);
      return;
    }
    if (value === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(value * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs, played]);

  const n = Math.round(display);
  return <>{format ? format(n) : n.toLocaleString('en-PH')}</>;
}
