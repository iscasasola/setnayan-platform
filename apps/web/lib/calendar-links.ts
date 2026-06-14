/**
 * Calendar-link helpers for the Save the Date path.
 *
 * Builds (a) a Google Calendar "add event" URL and (b) an RFC 5545 .ics
 * data URI for a single ALL-DAY wedding event. Both are pure + dependency
 * free so the Save-the-Date view can render the links server-side with no
 * client JS. The ICS shape mirrors the existing budget feed in lib/budget.ts
 * (all-day VEVENT, CRLF line endings) so we stay consistent across the app.
 *
 * A wedding's `event_date` is a bare 'YYYY-MM-DD' (date-only) — Save the Date
 * is an early announcement, so an all-day event is the right granularity (no
 * precise ceremony time yet). All-day end dates are EXCLUSIVE, so DTEND / the
 * Google `dates` end is the day after.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' → 'YYYYMMDD'. Returns null when unparseable. */
function basicDate(dateIso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  return m ? `${m[1]}${m[2]}${m[3]}` : null;
}

/** The day AFTER the given date in 'YYYYMMDD' (exclusive all-day end). */
function nextBasicDate(dateIso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateIso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

/** RFC 5545 text escape — backslash, comma, semicolon, newline. */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Google Calendar "add event" URL for an all-day wedding. Returns null when
 * there's no usable date (no date set yet → no calendar action).
 */
export function googleCalendarUrl(opts: {
  title: string;
  dateIso: string | null;
  location?: string | null;
  details?: string | null;
}): string | null {
  if (!opts.dateIso) return null;
  const start = basicDate(opts.dateIso);
  const end = nextBasicDate(opts.dateIso);
  if (!start || !end) return null;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${start}/${end}`,
  });
  if (opts.location) params.set('location', opts.location);
  if (opts.details) params.set('details', opts.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * A one-event VCALENDAR for the wedding (all-day). Returns null when there's
 * no usable date. `uid` should be stable per event so re-adds dedupe in the
 * guest's calendar.
 */
export function buildWeddingIcs(opts: {
  title: string;
  dateIso: string | null;
  location?: string | null;
  uid: string;
}): string | null {
  if (!opts.dateIso) return null;
  const start = basicDate(opts.dateIso);
  const end = nextBasicDate(opts.dateIso);
  if (!start || !end) return null;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Setnayan//Save the Date//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${opts.uid}`,
    `DTSTAMP:${start}T000000Z`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${icsEscape(opts.title)}`,
    ...(opts.location ? [`LOCATION:${icsEscape(opts.location)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  // RFC 5545 requires CRLF line endings.
  return lines.join('\r\n') + '\r\n';
}

/** Wrap an ICS string as a downloadable data: URI. */
export function icsDataHref(ics: string): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
