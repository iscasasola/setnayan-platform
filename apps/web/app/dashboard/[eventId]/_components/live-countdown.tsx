'use client';

import { useEffect, useState } from 'react';

/**
 * LiveCountdown — the big days-to-go hero inside the couple Home countdown
 * header (owner-approved couple-app-flow prototype 2026-06-04; ported to the
 * app 2026-06-05). A single dominant day count is the emotional anchor of the
 * Home cockpit — calmer and more legible than a per-second ticker.
 *
 * The server header (`event-countdown-header.tsx`) owns the date resolution and
 * passes the resolved `targetMs` (PH-midnight of the event date, ms since
 * epoch) + the server clock `serverNowMs`. The initial state is computed from
 * `serverNowMs` so the first client render matches the server HTML (no
 * hydration mismatch); the day count only flips at PH-local midnight, so the
 * client re-checks once a minute rather than once a second.
 */

// Asia/Manila has no DST → a fixed +08:00. "Days to go" is a PH-calendar-day
// difference: which PH calendar day the target falls on, minus which PH
// calendar day we're on now. This avoids the "0 days the night before"
// artifact a raw millisecond floor would produce.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;
const phDayIndex = (ms: number) => Math.floor((ms + PH_OFFSET_MS) / MS_PER_DAY);
const daysToGo = (targetMs: number, nowMs: number) =>
  phDayIndex(targetMs) - phDayIndex(nowMs);

export function LiveCountdown({
  targetMs,
  serverNowMs,
}: {
  targetMs: number;
  serverNowMs: number;
}) {
  const [days, setDays] = useState<number>(() => daysToGo(targetMs, serverNowMs));

  useEffect(() => {
    const tick = () => setDays(daysToGo(targetMs, Date.now()));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [targetMs]);

  // Event day (0) or past (<0) — the number gives way to a milestone word.
  if (days <= 0) {
    return (
      <p className="font-display text-6xl leading-none text-mulberry sm:text-7xl">
        {days === 0 ? 'Today' : 'Just married'}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-8xl leading-[0.84] tracking-tight text-mulberry tabular-nums sm:text-9xl">
        {days}
      </span>
      <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
        {days === 1 ? 'day to go' : 'days to go'}
      </span>
    </div>
  );
}
