'use client';
import { ScheduleUnread } from './schedule-unread';

import { formatWallClock } from '@/lib/schedule-datetime-local';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { formatRelativeMs } from '@/lib/day-of-mode';
import { venueNowMs } from '@/lib/schedule';
import { isTimeTba, TIME_TBA } from '@/lib/schedule-chapters';

type Block = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  /** ⏰ A Time-TBA chapter (migration 20271300482585): listed as "Time TBA", never ranked by time. */
  time_tba?: boolean | null;
};

/**
 * What "Up next" lists: the next three TIMED blocks after `now` (the venue's clock), then today's Time-TBA chapters.
 * 🛑 A TBA chapter is never ranked by time — its stored 00:00 is only its DAY — so it never sorts in among the timed
 * ones and is never drawn as 12:00 AM; it is listed after them as "Time TBA", on its own day only.
 */
export function upNext<B extends Block>(blocks: readonly B[], now: number): { timed: B[]; tba: B[] } {
  const today = new Date(now).toISOString().slice(0, 10);
  const timed = blocks
    .filter((b) => !isTimeTba(b))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .filter((b) => new Date(b.start_at).getTime() > now)
    .slice(0, 3);
  const tba = blocks.filter((b) => isTimeTba(b) && b.start_at.slice(0, 10) === today);
  return { timed, tba };
}

type Props = {
  eventId: string;
  blocks: Block[];
  /** 🛑 The schedule read was refused — said, never "Nothing else queued for today". */
  failed?: boolean;
};

// A stored block time is the VENUE'S WALL CLOCK, not an instant. This card is
// a client component, so `toLocaleTimeString` rendered it in the guest's own
// timezone — eight hours late in Manila — while the Schedule page one tap away
// rendered the same value correctly on the server. See lib/schedule-datetime-local.ts.
const formatClock = (iso: string): string => formatWallClock(iso);

export function LiveScheduleCard({ eventId, blocks, failed = false }: Props) {
  // Re-render every 60s so the relative-time countdowns stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // the venue's clock — start_at is its wall clock
  const { timed: upcoming, tba } = useMemo(() => upNext(blocks, venueNowMs()), [blocks]);

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

      {failed ? (
        <ScheduleUnread />
      ) : upcoming.length === 0 && tba.length === 0 ? (
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
                  {formatRelativeMs(startMs - venueNowMs())}
                </span>
              </li>
            );
          })}
          {tba.map((b) => (
            <li key={b.block_id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
              <span aria-hidden className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-ink/25" />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-ink">{b.label}</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  {TIME_TBA}
                  {b.location ? ` · ${b.location}` : null}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
