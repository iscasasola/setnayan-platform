import Link from 'next/link';
import { Wallet, ArrowRight } from 'lucide-react';
import type { UpcomingItem } from '@/lib/upcoming-items';

/**
 * MoneyInFlight — vendor payment milestones due in the next 30 days.
 *
 * Owner directive 2026-05-22: Home becomes an operational hub. Payments
 * coming due in the next month deserve their own section above the
 * general "Upcoming" list — they're the highest-leverage items the
 * host can act on right now (defer or schedule them off Home and they
 * fall through the cracks).
 *
 * Renders nothing when there are zero payment items in the 30-day
 * window (no empty-state). The merged Upcoming list still surfaces
 * payments further out via UpcomingSchedules.
 *
 * Each row deep-links to /dashboard/[eventId]/budget where the host
 * can either record a payment (event_vendor_payments insert) or
 * schedule a reminder. We don't expose a "Mark as paid" form here
 * because creating a payment row is a real money-event and belongs
 * on the budget surface — not a one-click toggle on Home.
 */

type Props = {
  eventId: string;
  items: ReadonlyArray<UpcomingItem>;
  now: Date;
};

export function MoneyInFlight({ eventId, items, now }: Props) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="money-in-flight-heading" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2
          id="money-in-flight-heading"
          className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55"
        >
          Money in flight · next 30 days
        </h2>
        <Link
          href={`/dashboard/${eventId}/budget`}
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta hover:text-terracotta-700"
        >
          Open budget
          <ArrowRight aria-hidden className="h-3 w-3" />
        </Link>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <MoneyInFlightRow item={item} now={now} eventId={eventId} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MoneyInFlightRow({
  item,
  now,
  eventId,
}: {
  item: UpcomingItem;
  now: Date;
  eventId: string;
}) {
  const dateTag = monthDay(item.date);
  const relative = relativeTag(item.daysFromNow);

  return (
    <Link
      href={item.href ?? `/dashboard/${eventId}/budget`}
      className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 transition hover:border-amber-300 hover:bg-amber-50 sm:px-4 sm:py-3"
    >
      <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/65">
          {dateTag}
        </span>
        <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-amber-700">
          {relative}
        </span>
      </div>
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"
      >
        <Wallet className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-ink/65">{item.subtitle}</p>
      </div>
    </Link>
  );
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
