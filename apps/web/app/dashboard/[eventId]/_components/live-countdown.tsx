'use client';

import { useEffect, useState } from 'react';

/**
 * LiveCountdown — the ticking days · hours · minutes · seconds timer inside the
 * couple Home countdown header (owner 2026-06-04). Client component so it
 * updates every second.
 *
 * The server header (`event-countdown-header.tsx`) owns the date resolution and
 * passes the resolved `targetMs` (PH-midnight of the event date, ms since
 * epoch) + the server clock `serverNowMs`. The initial state is computed from
 * `serverNowMs` so the first client render matches the server HTML (no
 * hydration mismatch); the effect then re-computes from the live clock and
 * ticks once per second.
 */

type Parts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
  /** Within the 24h after the target — the event day itself. */
  isEventDay: boolean;
};

function compute(targetMs: number, nowMs: number): Parts {
  let secs = Math.floor((targetMs - nowMs) / 1000);
  if (secs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      done: true,
      isEventDay: nowMs < targetMs + 86_400_000,
    };
  }
  const days = Math.floor(secs / 86_400);
  secs -= days * 86_400;
  const hours = Math.floor(secs / 3_600);
  secs -= hours * 3_600;
  const minutes = Math.floor(secs / 60);
  const seconds = secs - minutes * 60;
  return { days, hours, minutes, seconds, done: false, isEventDay: false };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

export function LiveCountdown({
  targetMs,
  serverNowMs,
}: {
  targetMs: number;
  serverNowMs: number;
}) {
  const [parts, setParts] = useState<Parts>(() => compute(targetMs, serverNowMs));

  useEffect(() => {
    const tick = () => setParts(compute(targetMs, Date.now()));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (parts.done) {
    return (
      <p className="font-display text-4xl leading-none text-mulberry">
        {parts.isEventDay ? 'Today' : 'Just married'}
      </p>
    );
  }

  const segments: Array<{ value: string; label: string }> = [
    { value: String(parts.days), label: 'days' },
    { value: pad2(parts.hours), label: 'hrs' },
    { value: pad2(parts.minutes), label: 'min' },
    { value: pad2(parts.seconds), label: 'sec' },
  ];

  return (
    <div className="flex items-start gap-3 sm:gap-4">
      {segments.map((seg) => (
        <div key={seg.label} className="flex min-w-[2ch] flex-col items-center">
          <span className="font-display text-3xl leading-none text-mulberry tabular-nums sm:text-4xl">
            {seg.value}
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-ink/55">
            {seg.label}
          </span>
        </div>
      ))}
    </div>
  );
}
