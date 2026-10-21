import Link from 'next/link';
import { ArrowRight, CalendarClock, Lock, Radio } from 'lucide-react';

export type PickerBooking = {
  eventId: string;
  eventName: string;
  bookedDate: string; // YYYY-MM-DD
  when: 'today' | 'upcoming' | 'past';
};

/**
 * Step 1 of the launcher — pick a DAY you are on.
 *
 * TODAY is launchable now; UPCOMING days are configurable ahead of time; PAST
 * days are shown for reference. Selecting one routes to `?event=<id>` (the
 * configure view); today's day also gets a Launch button.
 *
 * 🔑 ONE ROW PER DAY, NOT PER CELEBRATION. A supplier can be booked on two days
 * of the same wedding — the rehearsal dinner and the day itself — and both are
 * days they have to turn up to. The React key is therefore the (event, date)
 * pair: keying on `eventId` alone silently drops one of two legitimate rows,
 * which is exactly the collapse the caller used to do upstream.
 */
/**
 * 🔒 A DAY WHOSE EVENT IS LOCKED BY ITS BOOKING FEE — what the row says instead
 * of "Set up". Built by the page from the SHIPPED gate (`resolveEventFeeGates`)
 * and the SHIPPED words (`feeLockCopy`): the amount is the bill's, read from the
 * database, never a price in code. Owner "Yes to all", 2026-10-21, item 5 — on a
 * day with no event the Hub lists the next booked events, each locked until its
 * booking fee is paid.
 */
export type PickerLock = {
  /** `feeLockCopy`'s headline — "Pay ₱… to unlock this event", or why there is no bill yet. */
  headline: string;
  /** `feeLockCopy`'s button word, or null when there is nothing to pay (no bill yet). */
  cta: string | null;
  /** The bill's own pay page, else the booking-fees hub. */
  payHref: string;
};

export function EventPicker({
  bookings,
  activeEventId,
  heading = 'Your events',
  locks,
}: {
  bookings: PickerBooking[];
  activeEventId: string | null;
  /** The list's heading — "Your next events" on the Hub's empty day. */
  heading?: string;
  /** Keyed by event: the fee gate's answer for each LOCKED event (an unlocked one is absent). */
  locks?: Readonly<Record<string, PickerLock>>;
}) {
  if (bookings.length === 0) return null;
  return (
    <div>
      <h2 className="sn-sec">{heading}</h2>
      <ul className="mt-3 space-y-2">
        {bookings.map((b) => {
          const active = b.eventId === activeEventId;
          const lock = b.when === 'past' ? undefined : locks?.[b.eventId];
          if (lock) {
            const dateLabel = new Date(`${b.bookedDate}T00:00:00`).toLocaleDateString('en-PH', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            return (
              <li key={`${b.eventId}::${b.bookedDate}`} className="sn-tile space-y-2" data-hub-day-locked="">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'var(--m-line-soft)', color: 'var(--m-slate)' }}
                  >
                    <Lock className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                      {b.eventName}
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--m-slate-2)' }}>
                      {b.when === 'today' ? 'Today' : dateLabel} · Locked
                    </span>
                  </span>
                </div>
                <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
                  {lock.headline}
                </p>
                {lock.cta ? (
                  <Link
                    href={lock.payHref}
                    className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                    style={{ background: 'var(--m-ink)' }}
                  >
                    {lock.cta} <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                ) : null}
              </li>
            );
          }
          const dateLabel = new Date(`${b.bookedDate}T00:00:00`).toLocaleDateString('en-PH', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          return (
            <li
              key={`${b.eventId}::${b.bookedDate}`}
              className="sn-tile flex items-center justify-between gap-3"
              style={active ? { borderColor: 'var(--m-ink)' } : undefined}
            >
              <Link href={`/vendor-dashboard/on-the-day?event=${b.eventId}`} className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: b.when === 'today' ? 'var(--sn-success-soft)' : 'var(--m-line-soft)',
                    color: b.when === 'today' ? 'var(--sn-success)' : 'var(--m-slate-3)',
                  }}
                >
                  {b.when === 'today' ? (
                    <Radio className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                    {b.eventName}
                  </span>
                  <span className="block text-xs" style={{ color: 'var(--m-slate-2)' }}>
                    {b.when === 'today' ? 'Today' : b.when === 'past' ? `${dateLabel} · past` : dateLabel}
                  </span>
                </span>
              </Link>
              {b.when === 'today' ? (
                <Link
                  href={`/vendor-dashboard/on-the-day/live/${b.eventId}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
                  style={{ background: 'var(--m-ink)' }}
                >
                  Launch <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                </Link>
              ) : (
                <Link
                  href={`/vendor-dashboard/on-the-day?event=${b.eventId}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium"
                  style={{ borderColor: 'var(--m-line)', color: 'var(--m-slate)' }}
                >
                  Set up
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
