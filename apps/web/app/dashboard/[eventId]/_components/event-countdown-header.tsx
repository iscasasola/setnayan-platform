import Link from 'next/link';
import { formatEventDateWithPrecision, type EventDatePrecision } from '@/lib/events';
import { LiveCountdown } from './live-countdown';

/**
 * EventCountdownHeader — the emotional anchor at the top of the couple Home.
 *
 * Couple-home-cockpit redesign (owner-approved 2026-06-04). Home is a cockpit,
 * not a catalog: this header answers "how close are we?" at a glance — the
 * couple's names, a LIVE days · hours · minutes · seconds countdown to their
 * event date, the date + venue, and a thin "X of N vendors locked" bar.
 *
 * Counts down to the EARLIEST chosen date until the couple settles on one
 * (owner 2026-06-04): targets the committed `event_date`, else the earliest
 * `date_candidates`, else the `date_window_start`. The ticking is a small
 * client child (`<LiveCountdown>`); this server component owns the date
 * resolution + label and passes the resolved target (PH-midnight ms) + the
 * server clock so the first paint matches between server and client.
 *
 * Server component — values derive from the events row + the already-computed
 * lock count (no new queries).
 */

type Props = {
  eventId: string;
  eventName: string;
  /** Committed single date — wins when set ("down to 1"). */
  eventDate: string | null;
  eventDatePrecision: EventDatePrecision;
  /** Not-yet-settled date capture (onboarding events). The countdown falls
   *  back to the earliest candidate, then the window start. */
  dateMode: string | null;
  dateCandidates: string[] | null;
  dateWindowStart: string | null;
  dateWindowEnd: string | null;
  /** venue_name when set, else region. Hidden when null. */
  venueLabel: string | null;
  /** Lockable categories the host has at least one confirmed vendor in. */
  lockedCount: number;
  /** Total lockable categories (entry-point cards excluded). */
  totalLockable: number;
  now: Date;
};

// PH has no DST → Asia/Manila is a fixed +08:00. A wedding date is a calendar
// date with no time, so the countdown targets PH-local midnight of that date —
// a single instant the server and the client both agree on (so the live timer
// hydrates without a mismatch).
function targetMsFor(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00+08:00`).getTime();
}

export function EventCountdownHeader({
  eventId,
  eventName,
  eventDate,
  eventDatePrecision,
  dateMode,
  dateCandidates,
  dateWindowStart,
  // dateWindowEnd stays in Props (the page passes it) but isn't used here —
  // reserved for a future window-range label; not destructured to avoid an
  // unused-local.
  venueLabel,
  lockedCount,
  totalLockable,
  now,
}: Props) {
  // Earliest chosen date: committed date wins; else the earliest candidate (ISO
  // yyyy-mm-dd sorts chronologically); else the window start.
  const candidates = (dateCandidates ?? []).filter(Boolean).slice().sort();
  const countdownDate = eventDate ?? candidates[0] ?? dateWindowStart ?? null;
  const isTentative = !eventDate && countdownDate !== null;

  // Date line under the names. Committed → the date at its precision; tentative
  // → the earliest target date itself (so the couple sees what the timer counts
  // to), with the caption below explaining it's the earliest / not yet locked.
  const dateLineLabel = !countdownDate
    ? null
    : eventDate
      ? formatEventDateWithPrecision(eventDate, eventDatePrecision)
      : formatEventDateWithPrecision(countdownDate, 'day');

  const tentativeCaption = !isTentative
    ? null
    : candidates.length > 1
      ? `Earliest of ${candidates.length} possible dates`
      : dateMode === 'window' || (dateWindowStart !== null && countdownDate === dateWindowStart)
        ? 'Earliest in your date window'
        : 'Tentative — not locked yet';

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

      {dateLineLabel || venueLabel ? (
        <p className="mt-1.5 text-sm">
          {dateLineLabel ? <span className="text-ink/75">{dateLineLabel}</span> : null}
          {dateLineLabel && venueLabel ? <span className="text-ink/30"> · </span> : null}
          {venueLabel ? <span className="text-ink/55">{venueLabel}</span> : null}
        </p>
      ) : null}

      <div className="mt-4">
        {countdownDate ? (
          <LiveCountdown targetMs={targetMsFor(countdownDate)} serverNowMs={now.getTime()} />
        ) : (
          <Link
            href={`/dashboard/${eventId}/date-selection`}
            className="text-sm font-medium text-terracotta hover:underline"
          >
            Add your date to start the countdown &rarr;
          </Link>
        )}
      </div>

      {tentativeCaption ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {tentativeCaption}
        </p>
      ) : null}

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
