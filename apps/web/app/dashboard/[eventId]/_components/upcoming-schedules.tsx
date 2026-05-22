import Link from 'next/link';
import {
  Calendar,
  Camera,
  Cake,
  Utensils,
  Music2,
  Sparkles,
  HeartHandshake,
  PartyPopper,
  ArrowRight,
  ArrowDown,
  Wine,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import { type ScheduleBlockType } from '@/lib/schedule';

// V1 pilot Home v2 — owner directive 2026-05-22.
// Sits BELOW UsefulRightNow, ABOVE ActivityFeed. Shows up to 5 upcoming
// schedule blocks (the host's authored day-of timeline). The brief
// originally called for `vendor_meetings` rows, but that table doesn't
// ship in V1 — `event_schedule_blocks` is the closest analog and is
// already the host's calendar of record. When `vendor_meetings` lands
// post-V1, this component can take an additional prop and merge the
// two streams.

export type UpcomingItem = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  block_type: ScheduleBlockType;
};

type Props = {
  eventId: string;
  items: ReadonlyArray<UpcomingItem>;
  /** Server-passed clock so relative tags are stable between
   *  render and hydration (this is a server component but we
   *  pass it explicitly to keep the formatter pure). */
  now: Date;
};

export function UpcomingSchedules({ eventId, items, now }: Props) {
  if (items.length === 0) {
    return (
      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <h2
          id="upcoming-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Upcoming
        </h2>
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-ink/15 bg-cream px-4 py-3 text-sm text-ink/65">
          <span>Nothing scheduled yet — your next steps are below</span>
          <ArrowDown aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="upcoming-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="upcoming-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Upcoming
        </h2>
        <Link
          href={`/dashboard/${eventId}/schedule`}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta hover:text-terracotta-700"
        >
          See full calendar
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.block_id}>
            <UpcomingRow item={item} now={now} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function UpcomingRow({ item, now }: { item: UpcomingItem; now: Date }) {
  const start = new Date(item.start_at);
  const Icon = iconFor(item.block_type);
  const dateTag = monthDay(start);
  const relative = relativeTag(start, now);
  const timeLabel = timeOfDay(start, item.end_at ? new Date(item.end_at) : null);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          {dateTag}
        </span>
        <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-terracotta">
          {relative}
        </span>
      </div>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta"
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.label}</p>
        <p className="truncate text-xs text-ink/55">
          {timeLabel}
          {item.location ? ` · ${item.location}` : null}
        </p>
      </div>
    </div>
  );
}

function iconFor(type: ScheduleBlockType): LucideIcon {
  switch (type) {
    case 'pre_ceremony':
      return Sparkles;
    case 'ceremony':
      return HeartHandshake;
    case 'cocktails':
      return Wine;
    case 'reception':
      return PartyPopper;
    case 'dinner':
      return Utensils;
    case 'program':
      return Heart;
    case 'dancing':
      return Music2;
    case 'send_off':
      return Cake;
    case 'after_party':
      return Camera;
    case 'custom':
    default:
      return Calendar;
  }
}

function monthDay(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  })
    .format(date)
    .toUpperCase();
}

function timeOfDay(start: Date, end: Date | null): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const startLabel = fmt.format(start);
  if (!end) return startLabel;
  return `${startLabel} – ${fmt.format(end)}`;
}

function relativeTag(start: Date, now: Date): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const startDay = new Date(start);
  startDay.setHours(0, 0, 0, 0);
  const days = Math.round((startDay.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return 'Past';
  if (days < 7) return `in ${days}d`;
  if (days < 30) return `in ${days}d`;
  return `in ${Math.round(days / 7)}w`;
}
