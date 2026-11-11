/**
 * Day-of live-event mode helpers (iteration 0031).
 *
 * The dashboard home page conditionally renders a "day-of mode" grid when the
 * current time falls inside a window centered on the event date. This module
 * is pure (no Supabase, no React) so it can be safely imported from both
 * server and client components.
 *
 * Windows (relative to `event_date` at midnight in the viewer's local timezone
 * — full timezone correctness lives in the guest-facing renderer per the spec,
 * this couple-side surface uses the dashboard user's clock):
 *
 *   pre      : T - 3d   .. T - 12h
 *   live     : T - 12h  .. T + 36h   (noon the day before → noon the day after)
 *   post     : T + 36h  .. T + 60h
 *   inactive : everything else
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/*
  ─── THE ONE CLOCK (owner ruling, 10 Nov 2026) ────────────────────────────────

  THE DAY OPENS AT 06:00 ON THE EVENT DAY AND CLOSES AT 06:00 THE MORNING AFTER
  THE LAST DAY — both in the VENUE's own clock, both by DEFAULT (the couple can
  move either; `TheDayHours`). Everything that belongs to the day follows these
  two instants: the Event Hub's "The Day" stage, the Live tab, seats, song
  requests, the live wall, check-in, the supplier's "today" desk and /[slug]/hub.

  Before the ruling this file had a second window: "live" ran from NOON THE DAY
  BEFORE to NOON THE DAY AFTER (T-12h .. T+36h from midnight), ignored the last
  day of a celebration, and was evaluated in the RUNTIME's zone whenever a caller
  forgot the venue's — UTC on the server, the phone's own zone in a browser. So
  the Live tab could open the evening before, the dashboard menu said "over" at
  06:00 while the wall still said "live" until noon, and day two of a two-day
  celebration fell out of "live" at noon on day two. One window now:

    pre      : opens − 3d .. opens
    live     : opens      .. closes    (= The Day)
    post     : closes     .. closes + 24h   (a day to look back)
    inactive : everything else

  ⚠ A MISSING ZONE IS THE VENUE FALLBACK (Asia/Manila), NEVER THE RUNTIME'S.
  "Manila when there is no venue" is the ruling; the runtime's zone is right only
  by accident. `eventDateToEpoch` itself keeps its old meaning (callers format
  countdowns with it); only the window functions below default the zone.
*/

/** The zone of an event with no venue — owner ruling 5 (10 Nov 2026). Same value as `DEFAULT_EVENT_TZ` (lib/schedule). */
export const VENUE_TZ_FALLBACK = 'Asia/Manila';
/** The Day opens at this minute of the event day, venue time, unless the couple moved it. 06:00. */
export const THE_DAY_OPENS_DEFAULT_MIN = 6 * 60;
/** The Day closes at this minute of the morning after the LAST day, venue time, unless the couple moved it. 06:00. */
export const THE_DAY_CLOSES_DEFAULT_MIN = 6 * 60;

/**
 * The couple's own hours for The Day — minutes after midnight, venue time. `opensAtMin` is on the FIRST day;
 * `closesAtMin` is on the morning AFTER the last day. Null/absent = the default (06:00 both). Out-of-range values are
 * ignored (the default stands), so a bad stored value can never close a wedding before it opens.
 */
export type TheDayHours = { opensAtMin?: number | null; closesAtMin?: number | null };

const minutesOr = (v: number | null | undefined, dflt: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 24 * 60 ? v : dflt;

const PRE_WINDOW_MS = 3 * DAY_MS; // the run-up before The Day opens
const POST_WINDOW_MS = DAY_MS; // a day to look back after it closes

/**
 * When day-of mode switches on and off, in plain words — `THE_DAY_OPENS_DEFAULT_MIN`
 * on the day and `THE_DAY_CLOSES_DEFAULT_MIN` the morning after the last day. The words live in
 * their own two-line module so copy files (help, /features) can say them without
 * pulling this file into a client bundle; `the-app-says-event-in-plain-words`
 * checks them against `getDayOfPhase`.
 */
export { DAY_OF_ENDS_PLAIN, DAY_OF_STARTS_PLAIN } from '@/lib/day-of-window-words';

/*
  ─── WHEN IS IT OVER? 06:00 ON THE DAY AFTER THE LAST DAY ─────────────────

  🚨 THE PRODUCT ALREADY HAD AN ANSWER AND THIS FILE DID NOT USE IT.
  `lib/event-board.ts` → `isFinishedEvent` has always said an event is finished
  when **its last day is before today in Manila** (`lastDay < todayISO`), and
  three surfaces read it: the My Events board's "Finished" shelf, the chapter
  participation check, and the Studio app's event picker. Meanwhile THIS module
  said an event was still "day-of" until **T+60h** — two and a half days.

  So on 2026-08-21 the owner's events board filed his Movie Night (2026-08-20)
  under **Finished**, and the dashboard he reached by clicking that very card
  greeted him with **"EVENT DAY SOON · Prepare for event day"**. Two answers to
  one question, one click apart. Owner: *"movie night event is already done…
  why can i still plan and build and create guest list as if it hasn't ended"*
  and then *"nothing changed. i can still invite. prepare for event day, etc"*.

  ⏰ **THE SIX HOURS ARE THE ONLY THING THIS ADDS, AND THEY ARE DELIBERATE.**
  The board flips at midnight. A Filipino reception routinely runs past it, and
  a couple whose after-party is still going at 2am must not lose the live desk,
  the photo wall and check-in because the calendar rolled over. So the dashboard
  holds day-of through the night and lets go at **06:00 the next morning** — by
  which hour the party is over on any reading. The two definitions therefore
  agree at every hour a person is realistically looking, and disagree only
  between midnight and dawn, ON PURPOSE. `a-finished-event-reads-as-finished`
  pins that relationship in both directions so neither can be "fixed" alone.

  ⚠ **AND THE OLD T+60h RULE WAS REMOVED, NOT KEPT ALONGSIDE.** It is not merely
  redundant — for a MULTI-DAY celebration it was wrong: `event_date + 60h` lands
  in the middle of day three, so a five-day festival would have declared itself
  finished while it was still running. The rule below anchors on the LAST day
  (`event_end_date` where the type allows a range, else `event_date`) — the same
  value `isFinishedEvent` reads, and the same one the full-res retention floor
  reads. One answer to "when did this end", not three.
*/

export type DayOfPhase = 'pre' | 'live' | 'post' | 'inactive';

/**
 * How far `tz` is ahead of UTC at a given instant, in ms. Intl-only, no deps —
 * format the instant in the zone, read it back as if it were UTC, and diff.
 * `hourCycle: 'h23'` because `hour12: false` yields "24" for midnight on some
 * engines, which would silently shift the anchor by a day.
 */
function zoneOffsetMs(tz: string, atUtcMs: number): number {
  try {
    return offsetFor(tz, atUtcMs);
  } catch {
    // An unrecognised IANA string must never take the guest page down mid-
    // wedding. Fall back to the runtime's own anchor.
    return 0;
  }
}

function offsetFor(tz: string, atUtcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(atUtcMs));
  const f = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return Date.UTC(f('year'), f('month') - 1, f('day'), f('hour'), f('minute'), f('second')) - atUtcMs;
}

/**
 * Midnight on `eventDate` — in the WEDDING'S timezone when one is known.
 *
 * ⚠ WHY THIS TAKES A TIMEZONE (fixed 2026-08-05). The old comment said it built
 * "the dashboard user's local midnight", which is what `new Date(y, m, d)` does
 * — in a BROWSER. This module also runs in server components, and Vercel runs
 * UTC. So for a Manila wedding the anchor landed at 08:00 local, and the `live`
 * window (T-1h .. T+8h) ran roughly **07:00–16:00 on the wedding day** — it
 * switched off mid-reception and was never on for the evening, which is when a
 * Filipino wedding actually happens.
 *
 * The five clock fixes merged 2026-08-04 corrected the schedule, the broadcast
 * and the vendor countdown, and stopped one file short of this one — the file
 * that decides whether the guest page is in `live` at all.
 *
 * `tz` omitted keeps the previous runtime-local behaviour, so no caller changes
 * meaning by accident; every guest-facing caller passes the venue's zone.
 */
/**
 * The instant a calendar date STARTS, in the venue's own clock.
 *
 * Exported 2026-08-05 for the countdown, which was doing `new Date(eventDate)`
 * on a bare `YYYY-MM-DD` — that parses as midnight UTC, so in Manila the
 * countdown expired at 08:00 on the wedding morning and simply vanished, on the
 * one day everybody opens the page. West of Greenwich it is worse: midnight UTC
 * is the previous evening, so it vanished a whole day early.
 *
 * The same shape as the date-is-not-an-instant family fixed 2026-08-04. Reused
 * rather than re-derived — a second copy of this arithmetic is how the two
 * halves drift into agreeing with each other and disagreeing with the venue.
 */
export function eventDateToEpoch(eventDate: string | Date, tz?: string): number {
  if (eventDate instanceof Date) return eventDate.getTime();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    if (tz) {
      // Guess UTC midnight, then correct by the zone's offset at that instant.
      const guess = Date.UTC(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
      return guess - zoneOffsetMs(tz, guess);
    }
    return new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0).getTime();
  }
  return new Date(eventDate).getTime();
}

/**
 * Is The Day open right now? (the `live` phase — 06:00 on the day .. 06:00 the morning after the last day, by default)
 */
export function isInDayOfWindow(
  eventDate: string | Date,
  tz?: string,
  nowMs?: number,
  eventEndDate?: string | Date | null,
  hours?: TheDayHours | null,
): boolean {
  return getDayOfPhase(eventDate, tz, nowMs, eventEndDate, hours) === 'live';
}

/**
 * True while The Day is open — the same question as `isInDayOfWindow`, kept as its own name because the hooks and the
 * seat plan ask it by this one.
 *
 * ⚠ IT USED TO MEAN `live ‖ post` (noon the day before .. two and a half days later), because the old `live` window
 * was anchored on midnight and an evening reception landed in `post`. The Day now runs to 06:00 the morning after the
 * last day, so the reception is inside `live` and `post` is the look-back day after it — which is not The Day.
 */
export function isEventDayActive(
  eventDate: string | Date,
  tz?: string,
  nowMs?: number,
  eventEndDate?: string | Date | null,
  hours?: TheDayHours | null,
): boolean {
  return getDayOfPhase(eventDate, tz, nowMs, eventEndDate, hours) === 'live';
}

/**
 * THE INSTANT THE DAY OPENS: `opensAtMin` (06:00 by default), in the venue's own clock, on the FIRST day.
 * `NaN` when there is no readable date. A full timestamp / Date is read as the instant itself (legacy callers).
 */
export function theDayOpensInstantMs(
  eventDate: string | Date | null | undefined,
  tz?: string,
  hours?: TheDayHours | null,
): number {
  if (!eventDate) return NaN;
  const zone = tz || VENUE_TZ_FALLBACK;
  const firstDay = normalizeCalendarDay(eventDate);
  if (!firstDay) return eventDateToEpoch(eventDate, zone);
  return eventDateToEpoch(firstDay, zone) + minutesOr(hours?.opensAtMin, THE_DAY_OPENS_DEFAULT_MIN) * 60_000;
}

/**
 * THE INSTANT A CELEBRATION IS OVER: `closesAtMin` (06:00 by default), in the venue's own clock, on the day after its
 * LAST day. `NaN` when there is no readable date.
 *
 * ── WHY IT IS EXPORTED RATHER THAN INLINE ───────────────────────────────────
 * The supplier's desk reads it too: its look-back state runs from this instant, and re-deriving "six the morning
 * after" beside the function that already owns it is precisely the second copy this module keeps refusing to write.
 *
 * The six hours, the LAST day rather than the first, and the calendar-day step (never `+24h`, which lands an hour off
 * across a DST boundary) are explained at the top of this file and at `getMenuLifecyclePhase`.
 */
export function morningAfterInstantMs(
  eventDate: string | Date | null | undefined,
  tz?: string,
  eventEndDate?: string | Date | null,
  hours?: TheDayHours | null,
): number {
  const firstDay = normalizeCalendarDay(eventDate);
  const lastDay = normalizeCalendarDay(eventEndDate) ?? firstDay;
  if (!lastDay) return NaN;
  return (
    eventDateToEpoch(nextCalendarDay(lastDay), tz || VENUE_TZ_FALLBACK) +
    minutesOr(hours?.closesAtMin, THE_DAY_CLOSES_DEFAULT_MIN) * 60_000
  );
}

/** The Day, as two instants: `[opensMs, closesMs)`. Both `NaN` when there is no readable date. */
export function theDayWindow(
  eventDate: string | Date | null | undefined,
  tz?: string,
  eventEndDate?: string | Date | null,
  hours?: TheDayHours | null,
): { opensMs: number; closesMs: number } {
  const opensMs = theDayOpensInstantMs(eventDate, tz, hours);
  let closesMs = morningAfterInstantMs(eventDate, tz, eventEndDate, hours);
  // A Date / full timestamp has no calendar day to step from: The Day is the 24h after the instant.
  if (!Number.isFinite(closesMs) && Number.isFinite(opensMs)) closesMs = opensMs + DAY_MS;
  // An end before the start (bad data) never closes The Day before it opens.
  if (Number.isFinite(opensMs) && Number.isFinite(closesMs) && closesMs <= opensMs) closesMs = opensMs + DAY_MS;
  return { opensMs, closesMs };
}

/**
 * The calendar day (`YYYY-MM-DD`) whose The Day contains `now`, at the venue, on the DEFAULT hours: from 06:00 on a
 * date until 06:00 the next morning, "today" is that date. For a desk that asks "is this booking today?" of a day
 * rather than of an event row (the supplier's On the day Hub — booked dates are calendar days), so its "today" opens
 * and closes with The Day instead of at midnight.
 */
export function theDayCalendarDay(tz?: string, nowMs?: number): string {
  return calendarDayInZone(tz || VENUE_TZ_FALLBACK, (nowMs ?? Date.now()) - THE_DAY_CLOSES_DEFAULT_MIN * 60_000);
}

/**
 * The calendar day `YYYY-MM-DD` it is RIGHT NOW at the venue.
 *
 * Every other "what day is it" helper in this repo hardcodes Asia/Manila
 * (`manilaTodayISO`, `manilaToday`, `manilaTodayIso` — three of them). This one
 * takes the zone, because the desk that reads it is told the venue's, and a
 * hardcoded fourth would be wrong the first time somebody marries abroad.
 * An unrecognised zone must never throw on a guest's invitation, so it falls
 * back to the runtime's own day.
 */
export function calendarDayInZone(tz?: string, nowMs?: number): string {
  const at = new Date(nowMs ?? Date.now());
  try {
    // 'en-CA' formats as YYYY-MM-DD; the zone is what pins the day boundary.
    return new Intl.DateTimeFormat('en-CA', tz ? { timeZone: tz } : {}).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA').format(at);
  }
}

/** The Event Lifecycle Menu phase — which menu the bottom nav shows. */
// NOT the public-website lifecycle: that is `LifecyclePhase` in lib/invitation-widgets.ts (save_the_date → rsvp → event → editorial), which `app/[slug]/page.tsx` consumes. Renamed from `LifecyclePhase` (OPEN-BROWSE PR1) to end the name collision.
export type MenuLifecyclePhase = 'plan' | 'dayof' | 'after';

/**
 * The Event Lifecycle Menu phase: **Plan → Day-of → After** (2026-06-16).
 *
 * - `after`  — the event was explicitly closed out (`cleared_at` set) OR The Day
 *              has closed (06:00 the morning after the last day, by default) —
 *              evaluated read-side so it needs no cron.
 * - `dayof`  — The Day is open (`theDayWindow`) and not cleared.
 * - `plan`   — everything before.
 *
 * Pass `cleared_at` from `events`; the column is added by migration
 * 20261231020000 and read defensively (a missing/null value just means
 * "not cleared", so this stays safe before the migration is applied).
 */
// NOT the public-website phase resolver: that is `getLifecyclePhase` in lib/invitation-widgets.ts. Renamed from `getLifecyclePhase` (OPEN-BROWSE PR1) to end the name collision.
/**
 * ⚠ `tz` omitted = the venue fallback (Asia/Manila) since the one-clock ruling
 * (10 Nov 2026) — it used to be the RUNTIME's zone, which on Vercel is UTC, so a
 * Manila event's boundary landed eight hours late. Any caller that knows the
 * venue's zone still passes it.
 *
 * Every branch DELEGATES to `theDayWindow` rather than re-deriving the window:
 * a second copy of this arithmetic is exactly how the bottom nav once swapped
 * into day-of mode while the surface it pointed at disagreed by up to 36 hours.
 */
export function getMenuLifecyclePhase(
  eventDate: string | Date | null | undefined,
  clearedAt: string | Date | null | undefined,
  tz?: string,
  nowMs?: number,
  /** The event's LAST day, for a celebration that spans several
   *  (`events.event_end_date`). Omitted/null ⇒ `eventDate` is the last day,
   *  which is every event in production today. Threaded so the "it is over"
   *  rule anchors on the same value `isFinishedEvent` and the full-res
   *  retention floor already anchor on. */
  eventEndDate?: string | Date | null,
  /** The couple's own hours for The Day (default 06:00 → 06:00). */
  hours?: TheDayHours | null,
): MenuLifecyclePhase {
  if (clearedAt) return 'after';
  if (!eventDate) return 'plan';
  /*
    ONE WINDOW, NOT THREE. 'dayof' is exactly The Day (`theDayWindow`): it opens at 06:00 on the first day and closes
    at 06:00 the morning after the LAST day — so the middle days of a celebration that spans several are inside it by
    construction (before the ruling they needed their own branch, because the old window only ever saw the first day).

    ⚠ THE NEXT MIDNIGHT IS COMPUTED AS A CALENDAR DAY, NOT AS "+24h" (`morningAfterInstantMs`). Adding a fixed 24h
    across a DST boundary lands an hour either side of midnight. Asia/Manila has no DST, so this is invisible in
    production today — exactly the kind of latent arithmetic this repo has been bitten by before.
  */
  const { opensMs, closesMs } = theDayWindow(eventDate, tz, eventEndDate, hours);
  if (!Number.isFinite(opensMs)) return 'plan';
  const now = nowMs ?? Date.now();
  if (Number.isFinite(closesMs) && now >= closesMs) return 'after';
  if (now >= opensMs) return 'dayof';
  return 'plan';
}

/** `YYYY-MM-DD`, or null when the value is not a plain calendar day we can
 *  step forward from (a full timestamp, a Date, an empty string, junk). */
function normalizeCalendarDay(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    // A Date carries an instant, and collapsing one to a calendar day needs a
    // zone we were not given here. Callers pass the DB's `YYYY-MM-DD` string;
    // a Date is the legacy shape, so fall back to its UTC day rather than
    // guessing the venue's.
    return value.toISOString().slice(0, 10);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10)) ? value.slice(0, 10) : null;
}

/** The calendar day after `iso` (`YYYY-MM-DD` → `YYYY-MM-DD`), month and year
 *  rollovers and leap days included, via UTC arithmetic on the DATE PARTS —
 *  no zone is involved, because a calendar day has no zone until
 *  `eventDateToEpoch` anchors it in one. */
function nextCalendarDay(iso: string): string {
  const parts = iso.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * Returns the current day-of phase for the given event — THE ONE WINDOW (see the top of this file):
 *
 * - `pre`      : The Day opens − 3d .. The Day opens
 * - `live`     : The Day (06:00 on the first day .. 06:00 the morning after the last day, by default)
 * - `post`     : The Day closes .. + 24h (a day to look back)
 * - `inactive` : otherwise
 *
 * `now` is injectable so a client component can defer the read to an effect and avoid an SSR/hydration mismatch.
 * `tz` omitted = the venue fallback (Asia/Manila), never the runtime's zone.
 */
export function getDayOfPhase(
  eventDate: string | Date,
  tz?: string,
  nowMs?: number,
  eventEndDate?: string | Date | null,
  hours?: TheDayHours | null,
): DayOfPhase {
  const { opensMs, closesMs } = theDayWindow(eventDate, tz, eventEndDate, hours);
  if (!Number.isFinite(opensMs) || !Number.isFinite(closesMs)) return 'inactive';
  const now = nowMs ?? Date.now();
  if (now >= opensMs && now < closesMs) return 'live';
  if (now >= opensMs - PRE_WINDOW_MS && now < opensMs) return 'pre';
  if (now >= closesMs && now < closesMs + POST_WINDOW_MS) return 'post';
  return 'inactive';
}

/**
 * Formats milliseconds-from-now as a short relative-time string:
 *   < 60s   → "now"
 *   < 60m   → "in 12 min"
 *   < 24h   → "in 1h 30m" (or "in 4h")
 *   >= 24h  → "in 2d 3h"
 *
 * Returns "just now" / "Nm ago" / "Nh ago" for negative deltas (past events).
 *
 * @example
 * formatRelativeMs(5 * 60 * 1000);   // 'in 5 min'
 * formatRelativeMs(90 * 60 * 1000);  // 'in 1h 30m'
 * formatRelativeMs(-2 * 60 * 1000);  // '2 min ago'
 */
export function formatRelativeMs(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  const past = deltaMs < 0;

  if (abs < 60_000) return past ? 'just now' : 'now';

  const minutes = Math.floor(abs / 60_000);
  if (minutes < 60) {
    return past ? `${minutes} min ago` : `in ${minutes} min`;
  }

  const hours = Math.floor(abs / HOUR_MS);
  const remMinutes = Math.floor((abs - hours * HOUR_MS) / 60_000);
  if (hours < 24) {
    if (remMinutes === 0) return past ? `${hours}h ago` : `in ${hours}h`;
    return past ? `${hours}h ${remMinutes}m ago` : `in ${hours}h ${remMinutes}m`;
  }

  const days = Math.floor(abs / DAY_MS);
  const remHours = Math.floor((abs - days * DAY_MS) / HOUR_MS);
  if (remHours === 0) return past ? `${days}d ago` : `in ${days}d`;
  return past ? `${days}d ${remHours}h ago` : `in ${days}d ${remHours}h`;
}
