import Link from 'next/link';
import { ArrowRight, CalendarClock, Radio } from 'lucide-react';

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
export function EventPicker({
  bookings,
  activeEventId,
}: {
  bookings: PickerBooking[];
  activeEventId: string | null;
}) {
  if (bookings.length === 0) return null;
  return (
    <div>
      <h2 className="sn-sec">Your events</h2>
      <ul className="mt-3 space-y-2">
        {bookings.map((b) => {
          const active = b.eventId === activeEventId;
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
