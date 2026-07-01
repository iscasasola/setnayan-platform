import { CalendarCheck, Layers, Hourglass } from 'lucide-react';
import type { CapacityAnalytics } from '@/lib/vendor-capacity-analytics';

/**
 * "Capacity" — My Performance · Phase B family 4 (Pro tier). Own-business,
 * unambiguous capacity signals: how booked-ahead you are (distinct upcoming
 * days with a live booking + totals) and unmet demand (couples on your date
 * waitlist). Server component, honest empty states.
 *
 * A utilization RATIO is intentionally omitted — its "available-day" denominator
 * is an owner policy choice; these are raw counts that can't misrepresent.
 */

const DATE_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : DATE_FMT.format(d);
}

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
      <div className="mb-2 flex items-center gap-1.5" style={{ color: 'var(--m-slate)' }}>
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <p className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--m-ink)' }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--m-slate-3)' }}>
        {sub}
      </p>
    </div>
  );
}

export function CapacityCard({ data }: { data: CapacityAnalytics }) {
  const { load, waitlist, waitlistTotal } = data;
  const topDates = waitlist.slice(0, 6);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold" style={{ color: 'var(--m-ink)' }}>
        Capacity
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile
          icon={<CalendarCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Days booked ahead"
          value={`${load.upcomingBookedDays}`}
          sub={
            load.upcomingBookedDays > 0
              ? `${load.next30DaysBooked} in next 30 · ${load.next90DaysBooked} in next 90`
              : 'No upcoming booked days yet'
          }
        />
        <Tile
          icon={<Layers className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Bookings ahead"
          value={`${load.upcomingBookings}`}
          sub={
            load.upcomingBookings > load.upcomingBookedDays
              ? 'Some days hold more than one booking'
              : 'Live upcoming reservations'
          }
        />
        <Tile
          icon={<Hourglass className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
          label="Couples waiting"
          value={`${waitlistTotal}`}
          sub={
            waitlistTotal > 0
              ? `Across ${waitlist.length} date${waitlist.length === 1 ? '' : 's'} you weren't free`
              : 'No unmet demand flagged'
          }
        />
      </div>

      {/* Waitlist detail — the dates couples wanted but you weren't available. */}
      <div className="rounded-lg border bg-white p-5" style={{ borderColor: 'var(--m-line)' }}>
        <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.15em]" style={{ color: 'var(--m-slate)' }}>
          Dates in demand
        </div>
        {topDates.length > 0 ? (
          <ul className="space-y-2">
            {topDates.map((w) => (
              <li key={w.date} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--m-ink)' }}>{fmtDate(w.date)}</span>
                <span className="tabular-nums" style={{ color: 'var(--m-slate)' }}>
                  {w.waiting} waiting
                </span>
              </li>
            ))}
            {waitlist.length > topDates.length && (
              <li className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
                +{waitlist.length - topDates.length} more date
                {waitlist.length - topDates.length === 1 ? '' : 's'}
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            No couples are waiting on a booked-out date. When your calendar fills,
            the dates couples still want show up here — a signal to add a slot or
            raise your price.
          </p>
        )}
      </div>
    </section>
  );
}
