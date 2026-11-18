'use client';

import { useCountTo } from '@/components/count';
import { formatCount } from '@/lib/format-number';
import { QUICK_MS } from '@/lib/motion-table';

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
 * caller's per-element delay. A later change TICKS from the old value to the new
 * one in Quick (18 Nov 2026) — it never restarts from 0. Purely presentational:
 * the value itself is always server-computed real data.
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
  // One engine (components/count.tsx, the button rule's `Count`): final value on the server, then 0 → value over
  // 1150 ms easeOutCubic after the stagger ON LOAD (the load count moves to Rise in Phase 4).
  // 🎞 TICK (the motion standard § 4 #8, owner 18 Nov 2026 — "Today a change restarts the count from 0"): a LATER
  // change ticks from the number on screen to the new one in Quick, with no stagger — never back through 0.
  // Values ≤ 0 and reduced motion print at once.
  const display = useCountTo(value, {
    durationMs: 1150,
    delayMs,
    fromZeroOnLoad: true,
    changeDurationMs: QUICK_MS,
    skipNonPositive: true,
  });

  return (
    <span>
      {format(display)}
      {suffix}
    </span>
  );
}
