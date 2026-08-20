import { formatEventDateWithPrecision, type EventDatePrecision } from './events';

/**
 * The one line under the event's name on every door: when it is, and where.
 *
 * 🚨 WHAT THIS FIXES. Both /join doors printed `event.event_date` STRAIGHT OUT
 * OF THE DATABASE, so the first screen a guest ever sees said `2026-12-18`.
 * That is a machine's way of writing a date, on the one screen whose whole job
 * is to make a stranger feel invited.
 *
 * 🔑 AND THE OBVIOUS FIX WOULD HAVE BEEN WORSE THAN THE BUG. `events.event_date`
 * is only a real day when `event_date_precision` says `'day'`. For 'month' and
 * 'year' the column holds a PLACEHOLDER — first of the month, first of the
 * year, or whatever day the couple happened to be nudged onto — and formatting
 * it prettily would announce a specific date the hosts have not picked.
 * Measured in production 2026-08-20: **4 of 9 events are 'year' precision while
 * holding a real-looking date** (one reads `2027-03-09`). A guest would have
 * been told "March 9, 2027" for a party with no date yet, and might book a
 * flight on it. `2027-03-09` is ugly; "March 9, 2027" is a lie.
 *
 * So this asks `formatEventDateWithPrecision`, which has always been right
 * about this and says why in its own comment — "Sometime in 2027" for a year,
 * "August 2027" for a month, the full long form only for a real day. It is not
 * a second copy of the rule.
 *
 * ⚠ An unrecognised precision falls through to saying NOTHING about the date
 * rather than guessing. The venue still renders. On a door, a missing line
 * costs a guest one question to the host; a wrong date costs them a plane
 * ticket.
 */
const PRECISIONS = new Set<EventDatePrecision>(['year', 'month', 'day']);

/** What the door shows under the event's name. */
export type JoinDoorMetaEvent = {
  event_date: string | null;
  /**
   * How much of that date the hosts have actually decided. REQUIRED, not
   * optional — that is the whole guard. A caller that has not selected the
   * column must pass `null` deliberately, which reads as "say nothing"; if it
   * were optional, forgetting it would compile and the door would silently go
   * back to guessing. Proven: dropping the passthrough in JoinFlow fails
   * typecheck at all three of its call sites.
   */
  event_date_precision: string | null;
  venue_name: string | null;
};

export function joinDoorMeta(event: JoinDoorMetaEvent): string | undefined {
  const precision = event.event_date_precision;
  const when =
    event.event_date && precision && PRECISIONS.has(precision as EventDatePrecision)
      ? formatEventDateWithPrecision(event.event_date, precision as EventDatePrecision)
      : null;
  return [when, event.venue_name].filter(Boolean).join(' · ') || undefined;
}
