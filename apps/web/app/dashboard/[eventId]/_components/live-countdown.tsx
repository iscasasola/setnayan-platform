'use client';

import { useEffect, useState } from 'react';

/**
 * LiveCountdown — the big days-to-go hero inside the couple Home countdown
 * header (owner-approved couple-app-flow prototype 2026-06-04; ported to the app
 * 2026-06-05; live HH:MM:SS added 2026-06-05). A dominant day count is the
 * emotional anchor of the Home cockpit; beneath it a per-second HH:MM:SS ticks
 * down the time left in the current day — i.e. exactly how long until the day
 * count drops by one.
 *
 * The server header (`event-countdown-header.tsx`) owns the date resolution and
 * passes the resolved `targetMs` — PH-MIDNIGHT (12MN) of the event date, ms since
 * epoch. The countdown anchors on the date's midnight, NEVER a ceremony /
 * church-schedule time (owner 2026-06-05). It also passes the server clock
 * `serverNowMs`. The initial state is `serverNowMs` so the first client render
 * matches the server HTML (no hydration mismatch); the clock then ticks once a
 * second on the client.
 */

// Asia/Manila has no DST → a fixed +08:00. "Days to go" is a PH-calendar-day
// difference: which PH calendar day the target falls on, minus which PH calendar
// day we're on now. This avoids the "0 days the night before" artifact a raw
// millisecond floor would produce.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;
const phDayIndex = (ms: number) => Math.floor((ms + PH_OFFSET_MS) / MS_PER_DAY);
const daysToGo = (targetMs: number, nowMs: number) =>
  phDayIndex(targetMs) - phDayIndex(nowMs);

// Time left in the current PH day — ms until the next PH-local midnight, when the
// day count flips. Result is in (0, MS_PER_DAY]. Because the target is itself a
// PH midnight, this is also the sub-day part of the total time remaining, so the
// H:M:S reads as the countdown's hours / minutes / seconds.
const msToNextPhMidnight = (nowMs: number) =>
  MS_PER_DAY - ((nowMs + PH_OFFSET_MS) % MS_PER_DAY);

const pad2 = (n: number) => String(n).padStart(2, '0');
function splitHms(ms: number): { h: string; m: string; s: string } {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return {
    h: pad2(Math.floor(sec / 3600) % 24),
    m: pad2(Math.floor((sec % 3600) / 60)),
    s: pad2(sec % 60),
  };
}

export function LiveCountdown({
  targetMs,
  serverNowMs,
}: {
  targetMs: number;
  serverNowMs: number;
}) {
  const [nowMs, setNowMs] = useState<number>(serverNowMs);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  const days = daysToGo(targetMs, nowMs);

  // Event day (0) or past (<0) — the number gives way to a milestone word; no
  // ticker once we're there.
  if (days <= 0) {
    return (
      <p className="font-display text-6xl leading-none text-mulberry sm:text-7xl">
        {days === 0 ? 'Today' : 'Just married'}
      </p>
    );
  }

  const { h, m, s } = splitHms(msToNextPhMidnight(nowMs));

  return (
    <div className="flex flex-col items-center">
      <span className="font-display text-8xl leading-[0.84] tracking-tight text-mulberry tabular-nums sm:text-9xl">
        {days}
      </span>
      <span className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/60">
        {days === 1 ? 'day to go' : 'days to go'}
      </span>
      {/* Per-second time-of-day countdown to the next midnight (when the day
       *  count drops). aria-hidden so screen readers aren't spammed every
       *  second — the day count above carries the meaning. */}
      <span
        aria-hidden
        className="mt-2 font-mono text-lg tabular-nums tracking-[0.18em] text-ink/55 sm:text-xl"
      >
        {h}:{m}:{s}
      </span>
    </div>
  );
}
