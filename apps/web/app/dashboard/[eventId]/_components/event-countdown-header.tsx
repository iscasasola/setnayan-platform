import Link from 'next/link';
import { formatEventDateWithPrecision, type EventDatePrecision } from '@/lib/events';

/**
 * EventCountdownHeader — the emotional anchor at the top of the couple Home.
 *
 * Couple-home-cockpit redesign (owner-approved prototype 2026-06-04). Home is
 * a cockpit, not a catalog: this header answers "how close are we?" at a
 * glance — the couple's names, a big days-to-go number, the date + venue, and
 * a thin "X of N vendors locked" progress bar so the host feels momentum
 * without reading a paragraph.
 *
 * Replaces the text-heavy "Your wedding details" recap as the Home lead. That
 * match-criteria recap moved to the top of Services (where it filters + sorts
 * the search); the full editable record stays at /details.
 *
 * Pure server component — every value is derived from the events row + the
 * already-computed lock count (no new queries). `now` is passed in so the
 * countdown is stable between render and any downstream hydration.
 */

type Props = {
  eventId: string;
  eventName: string;
  eventDate: string | null;
  eventDatePrecision: EventDatePrecision;
  /** venue_name when set, else region. Hidden when null. */
  venueLabel: string | null;
  /** Lockable categories the host has at least one confirmed vendor in. */
  lockedCount: number;
  /** Total lockable categories (entry-point cards excluded). */
  totalLockable: number;
  now: Date;
};

function daysUntil(eventDate: string, now: Date): number {
  const target = new Date(`${eventDate}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function EventCountdownHeader({
  eventId,
  eventName,
  eventDate,
  eventDatePrecision,
  venueLabel,
  lockedCount,
  totalLockable,
  now,
}: Props) {
  const daysOut = eventDate ? daysUntil(eventDate, now) : null;
  const dateLabel = eventDate
    ? formatEventDateWithPrecision(eventDate, eventDatePrecision)
    : null;
  const pct =
    totalLockable > 0
      ? Math.min(100, Math.round((lockedCount / totalLockable) * 100))
      : 0;

  return (
    <section
      aria-labelledby="event-countdown-heading"
      className="rounded-2xl border border-ink/10 bg-cream p-5 shadow-sm sm:p-6"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
        Your wedding
      </p>
      <h1
        id="event-countdown-heading"
        className="mt-1 font-display text-3xl leading-tight text-ink sm:text-4xl"
      >
        {eventName}
      </h1>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          {daysOut !== null && daysOut > 0 ? (
            <p className="flex items-baseline gap-2">
              <span className="font-display text-5xl leading-none text-mulberry">
                {daysOut}
              </span>
              <span className="text-xs font-medium leading-tight text-ink/55">
                days
                <br />
                to go
              </span>
            </p>
          ) : daysOut === 0 ? (
            <p className="font-display text-4xl leading-none text-mulberry">Today</p>
          ) : daysOut !== null ? (
            <p className="font-display text-3xl leading-none text-mulberry">Just married</p>
          ) : (
            <Link
              href={`/dashboard/${eventId}/date-selection`}
              className="text-sm font-medium text-terracotta hover:underline"
            >
              Add your date to start the countdown &rarr;
            </Link>
          )}
        </div>
        {dateLabel ? (
          <div className="text-right">
            <p className="text-sm font-semibold text-ink">{dateLabel}</p>
            {venueLabel ? <p className="mt-0.5 text-xs text-ink/55">{venueLabel}</p> : null}
          </div>
        ) : null}
      </div>

      {totalLockable > 0 ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-ink/55">
            <span>Vendors locked</span>
            <span className="font-medium text-ink">
              {lockedCount} / {totalLockable}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
            <span
              className="block h-full rounded-full bg-terracotta transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
