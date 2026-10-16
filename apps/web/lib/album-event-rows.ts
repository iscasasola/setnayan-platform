/**
 * ALBUMS BY EVENT — the rows of `/vendor-dashboard/collections/albums` (supplier batch walk, W3). Pure: the page and its
 * guard share it.
 *
 * Every booked event, ONE row per event (a multi-day booking is one album), split by the PH civil date as a string:
 * today and later = "Coming up", earlier = "Past" (most recent first — the album a couple just shared is on top).
 * A count that could not be read says nothing; it never reads as "no photos".
 */
import { formatCount } from './format-number';

export type AlbumEventRow = { eventId: string; title: string; line: string; date: string };

export function albumEventRows(
  events: ReadonlyArray<{ eventId: string; eventName: string | null; bookedDate: string }>,
  counts: Readonly<Record<string, number>> | null,
  todayIso: string,
): { upcoming: AlbumEventRow[]; past: AlbumEventRow[] } {
  const byEvent = new Map<string, { eventId: string; eventName: string | null; first: string; last: string }>();
  for (const e of events) {
    const cur = byEvent.get(e.eventId);
    if (!cur) byEvent.set(e.eventId, { eventId: e.eventId, eventName: e.eventName, first: e.bookedDate, last: e.bookedDate });
    else {
      if (e.bookedDate < cur.first) cur.first = e.bookedDate;
      if (e.bookedDate > cur.last) cur.last = e.bookedDate;
    }
  }
  const upcoming: AlbumEventRow[] = [];
  const past: AlbumEventRow[] = [];
  for (const e of byEvent.values()) {
    const n = counts ? (counts[e.eventId] ?? 0) : null;
    const photos = n === null ? '' : n === 0 ? ' · no photos yet' : ` · ${formatCount(n)} photo${n === 1 ? '' : 's'}`;
    const row: AlbumEventRow = {
      eventId: e.eventId,
      title: (e.eventName ?? '').trim() || 'Your booked event',
      line: `${dayWords(e.first)}${photos}`,
      date: e.first,
    };
    (e.last >= todayIso ? upcoming : past).push(row);
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  past.sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

/** "Sat 17 Oct 2026" from a YYYY-MM-DD civil date — through UTC, so the viewer's timezone cannot shift the day. */
function dayWords(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return dt.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
