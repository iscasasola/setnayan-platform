'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Count-up number for My Performance — ticks 0 → `value` on mount so the figures
 * re-animate every time the Daily/Monthly/Annual toggle remounts the windowed
 * block (key={mode} in PerformanceControls). Pairs with the CSS `.perf-bar-grow`
 * bar animation so graphs + numbers re-animate together on each switch.
 *
 * Starts at 0 (so the tick is clean — no value→0→up flash) and animates to
 * `value` on mount; the block remounts per toggle, so it re-ticks each switch.
 * Owner 2026-07-02 ("always play it"): the tick is NOT gated behind
 * prefers-reduced-motion — it plays for everyone. (value===0 still skips the
 * pointless 0→0 tick.) `format` renders each frame (e.g. formatPhp for ₱).
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
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
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
  }, [value, durationMs]);

  const n = Math.round(display);
  return <>{format ? format(n) : n.toLocaleString('en-PH')}</>;
}
