/**
 * 🪑 MAY THE GUESTS SEE THEIR SEATS? — the ONE rule every guest-facing seat
 * read asks (owner, 2026-09-30, verbatim: "seatplan will show on the date of
 * the event").
 *
 *   · From 00:00 Manila on the event's date (a multi-day event: its FIRST day,
 *     which is `events.event_date`), seats are shown — always, with nothing for
 *     the couple to do, and the couple's switch no longer hides them.
 *   · Before that, seats are shown only if the couple turned on
 *     "Show guests their seats early" (`event_floor_plan.published_at`, set by
 *     `publishSeating`, cleared by `unpublishSeating`). Turning it off before
 *     the day hides them again.
 *   · The day rule needs a real DAY: an event whose date is only known to the
 *     month or year (`event_date_precision` ≠ 'day') has no day to open on, so
 *     only the switch opens it.
 *
 * Manila is the day boundary everywhere (`manilaToday()` in `lib/std-views.ts`;
 * `events.event_date` is a Manila-local DATE).
 *
 * The SQL side asks the SAME question through `public.guests_may_see_seats()`
 * (migration `seats_show_on_the_day`) — the 3D walk (`public_venue_scene`),
 * the name search (`public_seat_lookup`) and the coordinator's scan
 * (`coordinator_seat_by_guest_qr`) all call it. Change one, change both:
 * `lib/guests-may-see-seats.test.ts` reads the migration and holds them level.
 *
 * Every reader goes through here — the sweep in
 * `lib/guests-may-see-seats.test.ts` fails a guest page that reads
 * `published_at` off `event_floor_plan` by itself.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type SeatVisibilityFacts = {
  /** `event_floor_plan.published_at` — the couple's "Show guests their seats early" switch. */
  shownEarlyAt: string | null | undefined;
  /** `events.event_date` — YYYY-MM-DD, the event's (first) day, Manila-local. */
  eventDate: string | null | undefined;
  /** `events.event_date_precision` — only 'day' names a day to open on. */
  eventDatePrecision: string | null | undefined;
};

/** YYYY-MM-DD of `now` on the Manila calendar. */
export function manilaDateOf(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);
}

/** Has the event's (first) day begun in Manila? False without a day-precise date. */
export function seatDayHasCome(
  eventDate: string | null | undefined,
  eventDatePrecision: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (eventDatePrecision !== 'day') return false;
  const day = typeof eventDate === 'string' ? eventDate.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return manilaDateOf(now) >= day;
}

/** THE rule: on/after the day → shown; before it → only if the couple opened it early. */
export function guestsMaySeeSeats(event: SeatVisibilityFacts, now: Date = new Date()): boolean {
  if (seatDayHasCome(event.eventDate, event.eventDatePrecision, now)) return true;
  return Boolean(event.shownEarlyAt);
}

/**
 * 🎟 THE TICKET'S OWN HALF OF THE RULE (owner 2026-09-30, verbatim: *"their
 * digital Ticket will also update on the date of the event with the seat
 * number"*). The Digital ticket (the screen, the saved PNG) and the Printed
 * ticket carry the guest's table and seat FROM 00:00 MANILA ON THE EVENT'S
 * DATE — the day half of `guestsMaySeeSeats`, and only that half: before the
 * day, no table on any ticket, whatever the couple's "show early" switch says.
 * A ticket is a picture the guest keeps; a table the couple moves the week
 * before would sit on it wrong, while the live pages follow the switch.
 */
export function ticketShowsTable(
  event: Pick<SeatVisibilityFacts, 'eventDate' | 'eventDatePrecision'>,
  now: Date = new Date(),
): boolean {
  return seatDayHasCome(event.eventDate, event.eventDatePrecision, now);
}

/**
 * Read the facts for one event and answer. Admin client on the public, RLS-less
 * guest routes. Fails CLOSED on the switch (an unreadable floor plan never
 * opens early) and independently on the date (an unreadable event never
 * claims its day has come) — each half can only ever withhold.
 *
 * `throwOnReadError`: a page that must not dress a failed read up as "not yet"
 * (Find your seat sends it to the error boundary) gets a throw instead — a
 * missing legacy table/column (42P01 / 42703) still reads as "not opened".
 */
export async function guestsMaySeeSeatsFor(
  supabase: SupabaseClient,
  eventId: string,
  opts: { now?: Date; throwOnReadError?: boolean; /** The ticket's half: the day only (`ticketShowsTable`). */ ticket?: boolean } = {},
): Promise<boolean> {
  const [plan, event] = await Promise.all([
    supabase.from('event_floor_plan').select('published_at').eq('event_id', eventId).maybeSingle(),
    supabase.from('events').select('event_date, event_date_precision').eq('event_id', eventId).maybeSingle(),
  ]);
  if (opts.throwOnReadError) {
    for (const r of [plan, event]) {
      const code = (r.error as { code?: string } | null)?.code;
      if (r.error && code !== '42P01' && code !== '42703') {
        throw new Error(`Failed to resolve whether guests may see their seats: ${r.error.message}`);
      }
    }
  }
  const shownEarlyAt = plan.error ? null : ((plan.data as { published_at?: string | null } | null)?.published_at ?? null);
  const row = event.error ? null : (event.data as { event_date?: string | null; event_date_precision?: string | null } | null);
  if (opts.ticket) {
    return ticketShowsTable({ eventDate: row?.event_date ?? null, eventDatePrecision: row?.event_date_precision ?? null }, opts.now ?? new Date());
  }
  return guestsMaySeeSeats(
    { shownEarlyAt, eventDate: row?.event_date ?? null, eventDatePrecision: row?.event_date_precision ?? null },
    opts.now ?? new Date(),
  );
}
