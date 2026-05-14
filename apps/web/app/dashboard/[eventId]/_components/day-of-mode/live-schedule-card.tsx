'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { formatRelativeMs } from '@/lib/day-of-mode';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
};

type Props = {
  eventId: string;
  blocks: Block[];
};

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function LiveScheduleCard({ eventId, blocks }: Props) {
  // Re-render every 60s so the relative-time countdowns stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return [...blocks]
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .filter((b) => new Date(b.start_at).getTime() > now)
      .slice(0, 3);
  }, [blocks]);

  return (
    <article className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
      <header className="flex items-center justify-between">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta">
          <CalendarClock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Up next
        </p>
        <Link
          href={`/dashboard/${eventId}/schedule`}
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55 hover:text-terracotta"
        >
          Full schedule <ArrowRight aria-hidden className="h-3 w-3" strokeWidth={2} />
        </Link>
      </header>

      {upcoming.length === 0 ? (
        <p className="text-sm text-ink/55">
          Nothing else queued for today.
        </p>
      ) : (
        <ol className="divide-y divide-ink/10">
          {upcoming.map((b) => {
            const startMs = new Date(b.start_at).getTime();
            return (
              <li key={b.block_id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-terracotta/60"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-sm font-medium text-ink">{b.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                    {formatClock(b.start_at)}
                    {b.location ? ` · ${b.location}` : null}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[11px] font-medium text-terracotta-700">
                  {formatRelativeMs(startMs - Date.now())}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
