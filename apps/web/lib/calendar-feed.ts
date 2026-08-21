/**
 * THE SUBSCRIPTION FEED — one link, every celebration this person is part of,
 * re-read by their own calendar (owner 2026-08-21).
 *
 * 🔑 WHY A FEED AND NOT THE BUTTON WE ALREADY HAVE. `buildWeddingIcs` and the
 * save-the-date button hand over a COPY taken once. Move the wedding afterwards
 * and the copy in somebody's phone is silently wrong — no error, no clue, and
 * the person trusts it because we gave it to them. A subscribed feed is fetched
 * again by the calendar, so the date in their phone follows the date here.
 *
 * 🔑 AND WHY IT IS NOT THE GOOGLE CALENDAR API. Apple Calendar has no write API
 * at all, so that route would serve one of the two stores the owner named and
 * still need this file for the other. It would also need a third reviewed
 * Google scope on an account already carrying two that Google refuses to issue
 * together (see google-oauth-scope-conflict.test.ts). A `webcal:` link needs no
 * login and no review, and the DEVICE picks which calendar opens it — which is
 * the behaviour the owner asked for in as many words.
 *
 * ── WHAT IS IN IT, AND THE ONE PLACE THIS DEPARTS FROM THE INSTRUCTION ──────
 * The owner said *"planning and now happening can be added to calendar"*. Those
 * are the two shelves the feed EXISTS for. Celebrations that have already
 * happened are nevertheless KEPT in it, and that is deliberate:
 *
 *   🚨 DROPPING AN ENTRY FROM A FEED DELETES IT FROM THEIR PHONE. A calendar
 *   mirrors the feed — it does not accumulate from it. So a wedding that left
 *   the feed the morning after would vanish out of the couple's own calendar on
 *   the day they most want to look at it, and nothing would tell them why.
 *   Silently deleting somebody's wedding from their calendar is not a smaller
 *   version of "only show upcoming things"; it is a different, worse thing.
 *
 * PUT-AWAY celebrations ARE dropped, and that one is right: the person asked
 * for them to be out of sight, and the same rule already governs every shelf on
 * the board (`splitPlanningShelves`).
 *
 * ── THE TRAP THIS FILE IS MOST LIKELY TO FALL INTO ─────────────────────────
 * ⚠ EVERY ENTRY IS AN ALL-DAY DATE, NOT AN INSTANT, AND THAT IS NOT LAZINESS.
 * `events.event_date` is a DATE. Turning a DATE into a timestamp requires a
 * timezone, and getting it wrong is the 2026-08-04 sweep in a new costume: a
 * 12 December wedding read as 11 December on 41 screens because `new Date(iso)`
 * is midnight UTC. `VALUE=DATE` has no timezone to get wrong — the 12th is the
 * 12th on every phone on earth, including the relatives reading it abroad.
 *
 * ⚠ AND THIS IS WHY THE RUN-OF-SHOW IS NOT IN HERE YET.
 * `event_schedule_blocks.start_at` stores the VENUE'S WALL CLOCK in a UTC
 * column (prod: `Ceremony 14:00+00` for a 2 PM Manila ceremony). Emitting it as
 * an instant would put every ceremony in the couple's calendar EIGHT HOURS out
 * — the exact defect that shipped to nine surfaces in August. Doing it properly
 * means emitting `TZID=Asia/Manila` local times off the venue's timezone, which
 * is a real slice with its own tests, not a line to bolt on here.
 */

/** One line in the feed. Deliberately tiny: nothing here can leak a guest. */
export type FeedEntry = {
  /** Stable across re-reads — the calendar updates the entry instead of
   *  duplicating it. Derived from the public id, never from a row number. */
  uid: string;
  /** What the person will read in their calendar. */
  title: string;
  /** First day, ISO `YYYY-MM-DD`. */
  startDate: string;
  /** Last day inclusive, ISO. Equal to `startDate` for a one-day celebration. */
  endDate: string;
  location?: string | null;
  /** Where to go to see it. Calendars render this as a tappable link. */
  url?: string | null;
};

export type FeedEvent = {
  public_id: string | null;
  display_name: string | null;
  event_date: string | null;
  event_end_date?: string | null;
  archived?: boolean | null;
  venue_name?: string | null;
  venue_address?: string | null;
};

/**
 * Which of this person's celebrations belong in the feed.
 *
 * Undated ones are dropped: "Date to be set" is a real state, and a calendar
 * has nowhere to put it. It returns to the feed by itself the moment a date is
 * chosen — which is the behaviour a subscription is for.
 */
export function feedEntriesFor(
  events: readonly FeedEvent[],
  baseUrl: string,
): FeedEntry[] {
  const out: FeedEntry[] = [];
  for (const e of events) {
    if (e.archived) continue; // put away means out of sight here too
    const start = isoDay(e.event_date);
    if (!start) continue;
    const end = isoDay(e.event_end_date) ?? start;
    if (!e.public_id) continue; // no stable UID ⇒ it would duplicate on re-read
    out.push({
      uid: `${e.public_id}@setnayan.com`,
      title: (e.display_name ?? '').trim() || 'A celebration',
      startDate: start,
      endDate: end < start ? start : end,
      location: e.venue_name || e.venue_address || null,
      url: `${baseUrl}/dashboard`,
    });
  }
  return out.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
}

/**
 * Render the feed. RFC 5545, CRLF line endings, folded at 75 octets.
 *
 * `X-WR-CALNAME` and `X-PUBLISHED-TTL` are non-standard but are what Google and
 * Apple actually read for the calendar's NAME and its refresh hint. Standards
 * purity that leaves the subscription called "Untitled" is not purity.
 */
export function buildFeedIcs(opts: {
  entries: readonly FeedEntry[];
  calendarName: string;
  /** Stamped on every entry. Passed in so the output is deterministic in tests
   *  — a builder that reads the clock cannot be asserted on. */
  stampUtc: string;
}): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Setnayan//My Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.calendarName)}`,
    // Both a hint and a courtesy: it asks clients not to hammer the route, and
    // it is the honest answer to "how fast does a change land" — Google ignores
    // it and polls on its own schedule anyway, which is why the UI says so.
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ];
  for (const e of opts.entries) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${opts.stampUtc}`,
      // ⚠ VALUE=DATE, and DTEND is EXCLUSIVE in RFC 5545 — the day AFTER the
      // last day. Emitting the last day itself is the classic off-by-one that
      // ends a three-day reunion on its second morning.
      `DTSTART;VALUE=DATE:${compact(e.startDate)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.endDate))}`,
      `SUMMARY:${icsEscape(e.title)}`,
      ...(e.location ? [`LOCATION:${icsEscape(e.location)}`] : []),
      ...(e.url ? [`URL:${icsEscape(e.url)}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** `YYYY-MM-DD` or null. Accepts a timestamp and keeps only its day. */
function isoDay(v: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v ?? '');
  return m ? m[1]! : null;
}

function compact(iso: string): string {
  return iso.replace(/-/g, '');
}

/**
 * The calendar day after `iso`. Pure UTC arithmetic on the date parts, so no
 * ambient timezone can shift it — the same reason `daysUntilEventDay` does its
 * own parsing rather than trusting `new Date(string)`.
 */
function nextDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * RFC 5545 §3.3.11 escaping. A venue called "Ayala Land, Nuvali" contains a
 * comma, which is a VALUE SEPARATOR in iCalendar — unescaped, the entry either
 * loses everything after it or fails to parse.
 */
function icsEscape(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * RFC 5545 §3.1 line folding at 75 OCTETS — not characters.
 *
 * ⚠ THE UNIT IS THE REASON THIS IS NOT A ONE-LINER. A Filipino celebration name
 * is full of multi-byte characters ("Lolo Ben's 80th" carries a curly
 * apostrophe at 3 bytes), so folding on `.length` produces lines that are legal
 * by count and too long in fact — and, worse, can split a character in half.
 * This walks code points and measures their UTF-8 width.
 */
function fold(line: string): string {
  if (utf8Len(line) <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curBytes = 0;
  // First line takes 75 octets; every continuation is prefixed with one space,
  // which itself costs an octet, so they take 74.
  let budget = 75;
  for (const ch of line) {
    const w = utf8Len(ch);
    if (curBytes + w > budget) {
      out.push(cur);
      cur = '';
      curBytes = 0;
      budget = 74;
    }
    cur += ch;
    curBytes += w;
  }
  if (cur) out.push(cur);
  return out.map((s, i) => (i === 0 ? s : ' ' + s)).join('\r\n');
}

function utf8Len(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}
