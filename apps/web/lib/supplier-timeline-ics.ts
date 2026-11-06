import { DEFAULT_EVENT_TZ } from './schedule';
import { icsEscape } from './ics-text';
import { isTimeTba, TIME_TBA } from './schedule-chapters';

/**
 * The VEVENTs of a supplier's per-event timeline file (`/vendor-dashboard/clients/[eventId]/calendar.ics`). Pure, so the
 * route stays a thin read and the rule below is testable.
 */
export type TimelineIcsBlock = {
  block_id: string;
  label: string;
  start_at: string;
  end_at: string | null;
  location: string | null;
  /** Migration 20271300482585 — the chapter's clock is not known yet; `start_at` holds only its DAY at 00:00. */
  time_tba?: boolean | null;
};

/**
 * A schedule time → an ICS **local** stamp, no `Z`, paired with `TZID=`.
 *
 * `event_schedule_blocks.start_at` holds the venue's WALL CLOCK in a UTC column. Emitting it as `…Z` told every
 * calendar app the 2 PM ceremony was at 2 PM UTC — so the photographer's phone put the wedding in their diary at
 * **10 PM**, eight hours after everyone else arrived.
 */
function icsLocalStamp(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return `${y}${mo}${d}T${h}${mi}00`;
}

/** The wall-clock DAY of a stored time and the day after it, as ICS DATE values (`20261212`, `20261213`). */
function icsDayAndNext(iso: string): [string, string] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const next = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d) + 1));
  return [`${y}${mo}${d}`, next.toISOString().slice(0, 10).replace(/-/g, '')];
}

/**
 * One VEVENT per block. 🛑 A TIME-TBA CHAPTER IS AN ALL-DAY ITEM, "Reception · Time TBA" — the house pattern for an
 * item with a day and no clock (the shop-wide bookings file writes a booking the same way, `DTSTART;VALUE=DATE`). Its
 * stored 00:00 is never written as a time: a timed VEVENT would put the chapter in the supplier's diary at 12:00 AM.
 */
export function timelineIcsEvents(blocks: readonly TimelineIcsBlock[], dtstamp: string): string[] {
  const lines: string[] = [];
  for (const b of blocks) {
    if (isTimeTba(b)) {
      const day = icsDayAndNext(b.start_at);
      if (!day) continue;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${b.block_id}@setnayan.com`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${day[0]}`,
        `DTEND;VALUE=DATE:${day[1]}`,
        `SUMMARY:${icsEscape(`${b.label} · ${TIME_TBA}`)}`,
        ...(b.location ? [`LOCATION:${icsEscape(b.location)}`] : []),
        'END:VEVENT',
      );
      continue;
    }
    const dtstart = icsLocalStamp(b.start_at);
    if (!dtstart) continue;
    const dtend = b.end_at ? icsLocalStamp(b.end_at) : null;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${b.block_id}@setnayan.com`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=${DEFAULT_EVENT_TZ}:${dtstart}`,
      ...(dtend ? [`DTEND;TZID=${DEFAULT_EVENT_TZ}:${dtend}`] : []),
      `SUMMARY:${icsEscape(b.label)}`,
      ...(b.location ? [`LOCATION:${icsEscape(b.location)}`] : []),
      'END:VEVENT',
    );
  }
  return lines;
}
