import Link from 'next/link';
import {
  Calendar,
  CalendarDays,
  Clock,
  Wallet,
  RefreshCw,
  FileText,
  Users,
  CalendarClock,
  ArrowRight,
  ArrowDown,
  type LucideIcon,
} from 'lucide-react';
import type { UpcomingItem, UpcomingItemCategory } from '@/lib/upcoming-items';

/**
 * UpcomingSchedules — V1 Home aggregation surface.
 *
 * Owner directive 2026-05-22: Home is the operational hub. PR #329
 * shipped this component pulling only from event_schedule_blocks; this
 * version widens to five sources via the unified `UpcomingItem` shape
 * from `@/lib/upcoming-items` (vendor meetings · day-of schedule
 * blocks · vendor payment milestones · Setnayan SKU subscription
 * renewals · statutory document deadlines).
 *
 * Sits BELOW MoneyInFlight, ABOVE ActivityFeed. The merged stream
 * is already sorted chronologically + capped server-side, so the
 * component just renders the rows it's given. Category-specific
 * icons + styling distinguish the source at a glance without leaking
 * source-table names into UI strings.
 */

export type { UpcomingItem };

type Props = {
  eventId: string;
  items: ReadonlyArray<UpcomingItem>;
  /** Server-passed clock so relative tags are stable between
   *  render and hydration. */
  now: Date;
  /** Section heading. Defaults to "Upcoming"; Home passes "Needs you". */
  headingLabel?: string;
  /** Empty-state copy. Defaults to the calendar hint; Home passes an
   *  "all caught up" message (which also drops the down-arrow). */
  emptyLabel?: string;
};

export function UpcomingSchedules({ eventId, items, now, headingLabel, emptyLabel }: Props) {
  if (items.length === 0) {
    return (
      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <h2
          id="upcoming-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          {headingLabel ?? 'Upcoming'}
        </h2>
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-ink/15 bg-cream px-4 py-3 text-sm text-ink/65">
          <span>{emptyLabel ?? 'Nothing on the calendar yet — your next steps are below'}</span>
          {emptyLabel ? null : (
            <ArrowDown aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={1.75} />
          )}
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
          {headingLabel ?? 'Upcoming'}
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
          <li key={item.id}>
            <UpcomingRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const Icon = iconFor(item.category);
  const dateTag = monthDay(item.date);
  const relative = relativeTag(item.daysFromNow);
  const iconStyles = iconStylesFor(item.category);
  const containerStyles = containerStylesFor(item.category);

  const body = (
    <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${containerStyles}`}>
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
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconStyles}`}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-ink/55">{item.subtitle}</p>
      </div>
    </div>
  );

  if (item.href) {
    return (
      <Link href={item.href} className="block transition hover:opacity-95">
        {body}
      </Link>
    );
  }
  return body;
}

function iconFor(category: UpcomingItemCategory): LucideIcon {
  switch (category) {
    case 'meeting':
      return Users;
    case 'schedule':
      return Clock;
    case 'payment':
      return Wallet;
    case 'renewal':
      return RefreshCw;
    case 'document':
      return FileText;
    case 'recommended_deadline':
      return CalendarClock;
    default:
      return CalendarDays;
  }
}

function iconStylesFor(category: UpcomingItemCategory): string {
  switch (category) {
    case 'payment':
      // Payments echo the amber palette used in MoneyInFlight so the
      // visual association carries across both sections.
      return 'bg-warn-100 text-warn-700';
    case 'renewal':
      return 'bg-success-50 text-success-700';
    case 'document':
      return 'bg-blue-50 text-blue-700';
    case 'meeting':
      return 'bg-indigo-50 text-indigo-700';
    case 'recommended_deadline':
      // Gentle violet — distinct from payment-amber / document-blue /
      // meeting-indigo / renewal-emerald. Soft guidance, not urgency.
      return 'bg-violet-50 text-violet-700';
    case 'schedule':
    default:
      return 'bg-terracotta/10 text-terracotta';
  }
}

function containerStylesFor(category: UpcomingItemCategory): string {
  switch (category) {
    case 'payment':
      return 'border-warn-200/70 bg-warn-50/40';
    case 'document':
      // Statutory deadlines need to stand out a touch — they're easy
      // to miss otherwise. Soft blue tint matches the icon palette.
      return 'border-blue-200/70 bg-blue-50/30';
    default:
      return 'border-ink/10 bg-white';
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

function relativeTag(daysFromNow: number): string {
  if (daysFromNow === 0) return 'Today';
  if (daysFromNow === 1) return 'Tomorrow';
  if (daysFromNow < 7) return `in ${daysFromNow}d`;
  if (daysFromNow < 30) return `in ${daysFromNow}d`;
  return `in ${Math.round(daysFromNow / 7)}w`;
}

// Calendar import retained for future direct-render scenarios where
// the type isn't surfaced via the category enum yet.
export { Calendar };
