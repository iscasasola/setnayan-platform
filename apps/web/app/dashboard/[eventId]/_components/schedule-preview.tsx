import Link from 'next/link';
import { CalendarClock, ArrowRight } from 'lucide-react';
import {
  SCHEDULE_BLOCK_LABEL,
  formatBlockTime,
  selectSchedulePreviewBlocks,
  type ScheduleBlockRow,
} from '@/lib/schedule';

type Props = {
  eventId: string;
  blocks: ScheduleBlockRow[];
  now: Date;
};

/**
 * SchedulePreview — the couple's day-of timeline surfaced on the Overview
 * (owner directive 2026-07-09: "add schedule there"). Distinct from the
 * "Needs you" panel above it, which streams deadline/reminder items from
 * fetchUpcomingItems; THIS is the couple's own program — the
 * event_schedule_blocks rows they build under /schedule and that the day-of
 * grid goes live with. Presentational only; the async wrapper does the fetch
 * + graceful-degrade.
 *
 * Shows up to 4 top-level upcoming blocks (start_at >= now). If the whole
 * program is already past we fall back to the first 4 top-level blocks so the
 * card never reads empty when data exists. Zero blocks → a build-your-timeline
 * empty state that funnels into /schedule.
 */
export function SchedulePreview({ eventId, blocks, now }: Props) {
  const href = `/dashboard/${eventId}/schedule`;
  const { display, moreCount, isEmpty } = selectSchedulePreviewBlocks(
    blocks,
    now,
  );

  return (
    <section aria-label="Schedule">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="m-serif text-lg leading-none text-ink">Schedule</h2>
        <Link
          href={href}
          className="text-xs font-medium text-mulberry hover:underline"
        >
          Open schedule
        </Link>
      </div>

      {isEmpty ? (
        <Link
          href={href}
          className="m-card flex items-center justify-between gap-3 px-4 py-4"
        >
          <span>
            <span className="block text-sm font-semibold text-ink">
              Plan your day-of timeline
            </span>
            <span className="mt-0.5 block text-xs text-ink/55">
              Lay out ceremony, reception &amp; the program — your guests see it
              on the day.
            </span>
          </span>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry">
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          </span>
        </Link>
      ) : (
        <div className="m-card overflow-hidden">
          <ul>
            {display.map((block) => (
              <li
                key={block.block_id}
                className="flex items-start gap-3 border-t border-[var(--m-line)] px-4 py-3 first:border-t-0"
              >
                <span
                  aria-hidden
                  className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-mulberry/10 text-mulberry"
                >
                  <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {block.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink/55">
                    {formatBlockTime(block.start_at)}
                    {block.location ? ` · ${block.location}` : ''}
                  </span>
                </span>
                <span className="mt-0.5 shrink-0 text-[11px] font-medium text-ink/45">
                  {SCHEDULE_BLOCK_LABEL[block.block_type]}
                </span>
              </li>
            ))}
          </ul>
          {moreCount > 0 ? (
            <Link
              href={href}
              className="flex items-center justify-between border-t border-[var(--m-line)] px-4 py-2.5 text-xs font-medium text-mulberry hover:bg-mulberry/[0.04]"
            >
              <span>
                {moreCount} more{' '}
                {moreCount === 1 ? 'block' : 'blocks'} in your timeline
              </span>
              <ArrowRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
