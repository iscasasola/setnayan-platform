'use client';

import { useEffect, useState } from 'react';

type Props = { targetIso: string };

type Remaining = { days: number; hours: number; minutes: number; seconds: number; isPast: boolean };

function compute(target: number): Remaining {
  const now = Date.now();
  const ms = target - now;
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, isPast: false };
}

export function CountdownWidget({ targetIso }: Props) {
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState<Remaining>(() => compute(target));

  useEffect(() => {
    const id = window.setInterval(() => setRemaining(compute(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  // Auto-hide once the wedding starts.
  if (remaining.isPast) return null;

  const boxes: { label: string; value: number }[] = [
    { label: 'Days', value: remaining.days },
    { label: 'Hours', value: remaining.hours },
    { label: 'Mins', value: remaining.minutes },
    { label: 'Secs', value: remaining.seconds },
  ];

  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-6 text-center sm:p-8">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
        Until we say &lsquo;I do&rsquo;
      </p>
      <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
        {boxes.map((b) => (
          <div key={b.label} className="rounded-lg border border-ink/10 bg-cream py-3">
            <p className="font-serif text-3xl tabular-nums sm:text-5xl">
              {String(b.value).padStart(2, '0')}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              {b.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
