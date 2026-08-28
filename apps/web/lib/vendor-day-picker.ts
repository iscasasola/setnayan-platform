/**
 * ONE ROW PER DAY YOU ARE ON — the Event Hub's day list, decided once.
 *
 * ── THE BUG THIS REPLACES ───────────────────────────────────────────────────
 * The Event Hub built its picker with `new Map(bookings.map(b => [b.eventId, b]))`.
 * A Map keyed on a repeated key keeps the LAST value, so a supplier booked on
 * two days of ONE celebration — the rehearsal dinner and the wedding day — saw
 * that couple once and the earlier day silently disappeared.
 *
 * It is not a display quirk. The vanished row is the one carrying the Launch
 * button on ITS day, so on the morning of the rehearsal the picker offered
 * nothing to launch and the console the supplier had come for was unreachable.
 *
 * 🔑 AND THERE WAS NOTHING TO DEDUPE. `fetchVendorRoomEvents` already returns
 * one entry per (event, date) — its own docblock says so — so the collapse was
 * pure loss with no benefit on the other side of it. The composite key is kept
 * anyway: a future source that DOES repeat a (event, date) pair still folds to
 * one row, and the rule stays one line rather than a promise.
 *
 * ── DATES ARE COMPARED AS STRINGS, ALWAYS ───────────────────────────────────
 * Every date here is `YYYY-MM-DD` in the venue's own calendar, compared against
 * `phToday()` lexically. NEVER build a `Date` from one: `new Date('2026-12-12')`
 * is midnight UTC, which is the 11th in Manila, and this repo has already
 * shipped that defect more than a dozen times.
 *
 * Pure — `today` is injected, so the tests are not hostage to the machine clock.
 */

export type VendorDay = {
  eventId: string;
  eventName: string;
  /** YYYY-MM-DD, the venue's calendar day. */
  bookedDate: string;
};

export type PickerDay = VendorDay & {
  when: 'today' | 'upcoming' | 'past';
};

/**
 * Every day this shop is on, oldest first, one row per (celebration, day).
 *
 * @param bookings every booked (event, date) pair, in any order.
 * @param today    `YYYY-MM-DD` in Manila — injected, never read from a clock.
 */
export function collapseToPickerDays<T extends VendorDay>(
  bookings: readonly T[],
  today: string,
): (T & { when: PickerDay['when'] })[] {
  const byDay = new Map<string, T>();
  for (const b of bookings) byDay.set(`${b.eventId}::${b.bookedDate}`, b);
  return [...byDay.values()]
    .map((b) => ({
      ...b,
      when: (b.bookedDate === today
        ? 'today'
        : b.bookedDate > today
          ? 'upcoming'
          : 'past') as PickerDay['when'],
    }))
    .sort((a, b) => a.bookedDate.localeCompare(b.bookedDate));
}

/**
 * Which of a celebration's days the `?event=<id>` setup view is about.
 *
 * `?event=<id>` names a CELEBRATION, and a celebration can hold several of this
 * shop's days — so on its own it does not say which day. Prefer the one dated
 * today (that is the day being worked), then the nearest day still ahead, and
 * only then the most recent past one. The old code took "whichever row the
 * array happened to yield first", which is what decided the setup view's
 * is-it-today branch.
 *
 * Returns null when this shop holds no day on that celebration — which is also
 * the refusal for an id that is not theirs, because the list it filters was
 * already scoped to their own bookings.
 */
export function pickConfigureDay<T extends VendorDay>(
  bookings: readonly T[],
  eventId: string,
  today: string,
): T | null {
  const days = bookings
    .filter((b) => b.eventId === eventId)
    .sort((a, b) => a.bookedDate.localeCompare(b.bookedDate));
  return (
    days.find((b) => b.bookedDate === today) ??
    days.find((b) => b.bookedDate > today) ??
    days[days.length - 1] ??
    null
  );
}
