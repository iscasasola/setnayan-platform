'use client';

import { useEffect, useState } from 'react';
import { CustomersCalendar } from '@/app/vendor-dashboard/customers/_components/customers-calendar';
import { fetchCustomerCalendarMonth } from '@/app/vendor-dashboard/customers/actions';

type Read = NonNullable<Awaited<ReturnType<typeof fetchCustomerCalendarMonth>>>;
/** The month's inputs, flat: the month-dependent half plus the `whole` part (pools · bookings · blocks). */
export type ScheduleCalendarInputs = Pick<Read, 'dayStates' | 'waitlist'> & NonNullable<Read['whole']>;
type Inputs = ScheduleCalendarInputs;

/**
 * 📅 THE SCHEDULE PAGE'S CALENDAR (v113 `calC`; controller 2026-11-08) — the Clients calendar itself
 * (`CustomersCalendar`, `place="schedule"`), never a second calendar: the shop's month with THIS event's day picked on
 * arrival, the same week strip and the same tap-again-to-let-go.
 *
 * 🔢 One request, on first view: the picked client reads none of the month at load (its page switch stays 0
 * requests); this page asks `fetchCustomerCalendarMonth(month, { whole: true })` once (the
 * Clients month action with one option — not a second export). While it is out the month is "Loading…"; refused, it SAYS so
 * — an empty month would read as a free month, which is the one lie a calendar must never tell.
 *
 * `lab` hands the inputs in (the dev lab has no database) and asks for nothing.
 */
export function ScheduleCalendar({
  eventDate,
  todayIso,
  lab,
}: {
  /** The event's day (YYYY-MM-DD) — picked on arrival, and its month is the one drawn. */
  eventDate: string;
  todayIso: string;
  lab?: Inputs | null;
}) {
  const day = eventDate.slice(0, 10);
  const month = day.slice(0, 7);
  const [inputs, setInputs] = useState<Inputs | null | 'loading'>(lab === undefined ? 'loading' : lab);
  useEffect(() => {
    if (lab !== undefined) return;
    let live = true;
    fetchCustomerCalendarMonth(month, { whole: true }).then(
      // A read without its `whole` part is a refused read, said as one — never drawn as an empty month.
      (r) => live && setInputs(r?.whole ? { ...r.whole, dayStates: r.dayStates, waitlist: r.waitlist } : null),
      () => live && setInputs(null),
    );
    return () => {
      live = false;
    };
  }, [month, lab]);

  if (inputs === 'loading') {
    return (
      <p className="py-3 text-[13px] text-ink/70" data-schedule-calendar="loading" aria-busy="true">
        Loading your month…
      </p>
    );
  }
  if (inputs === null) {
    return (
      <p role="status" className="py-3 text-[13px] font-semibold text-danger-700" data-schedule-calendar="unread">
        Your calendar couldn’t load just now — the schedule below is unaffected.
      </p>
    );
  }
  return (
    <div data-schedule-calendar="">
      <CustomersCalendar
        place="schedule"
        initialDayStates={inputs.dayStates}
        initialWaitlist={inputs.waitlist}
        initialMonth={month}
        initialDay={day}
        todayIso={todayIso}
        pools={inputs.pools}
        bookings={inputs.bookings}
        blocks={inputs.blocks}
        halls={inputs.pools.every((p) => p.isHall) && inputs.pools.length > 0}
        closuresComplete={inputs.closuresComplete}
        // 🟠 Asking marks when the one read could tell (Build 2 #43g); null = unread, so no mark and no legend word.
        inquiries={inputs.inquiries ?? []}
        asksRead={inputs.inquiries !== null && inputs.inquiries !== undefined}
        fetchMonth={lab === undefined ? undefined : null}
      />
      {inputs.closuresComplete ? null : (
        <p role="status" className="mt-1 text-[13px] text-warn-800">
          Some of your blocked dates couldn’t load, so a date you closed may show as open here.
        </p>
      )}
    </div>
  );
}
