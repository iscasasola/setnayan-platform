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

/**
 * T is MIDNIGHT on the wedding day, in the venue's timezone.
 *
 * ⚠ THE WINDOW WIDENED 2026-08-05 (owner: "needs to run 12 hours before and 12
 * hours after"). It used to be T-1h .. T+8h — roughly 11pm the night before to
 * 8am on the day. A Filipino wedding's reception is in the EVENING, so day-of
 * mode was never on while the wedding was happening: no live photo wall, no
 * day-of banner, no announcements, no "happening now". It switched itself off
 * before the guests arrived.
 *
 * ⚠ AND WHY IT IS NOT LITERALLY ±12h FROM T. Midnight ±12h is noon-the-day-
 * before to noon-on-the-day — which still ENDS BEFORE AN EVENING RECEPTION and
 * would not have fixed anything. The owner's "12 before and 12 after" is 12
 * hours either side of the wedding DAY, not of its first instant:
 *
 *     live : T - 12h .. T + 36h   (noon the day before → noon the day after)
 *
 * That is one clean rule with no schedule required — which matters, because
 * only one event in production has any schedule blocks at all, so a
 * ceremony-time anchor would leave every other wedding on a fallback.
 */
const PRE_WINDOW_START_MS = 3 * DAY_MS; // T - 3d
const LIVE_WINDOW_START_MS = 12 * HOUR_MS; // T - 12h  (noon the day before)
const LIVE_WINDOW_END_MS = 36 * HOUR_MS; // T + 36h (noon the day after)
const POST_WINDOW_END_MS = 60 * HOUR_MS; // T + 60h (a further 24h to look back)

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
const MORNING_AFTER_MS = 6 * HOUR_MS; // 06:00, i.e. the night is over

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
 * Returns true when the current clock is between T-1 hour and T+8 hours of
 * the event date.
 *
 * @example
 * // wedding scheduled today; called 30 minutes before midnight start
 * isInDayOfWindow(new Date()); // true (within T-1h .. T+8h)
 *
 * @example
 * // wedding scheduled two days from now
 * isInDayOfWindow('2099-01-01'); // false
 */
export function isInDayOfWindow(eventDate: string | Date, tz?: string): boolean {
  return getDayOfPhase(eventDate, tz) === 'live';
}

/**
 * True across the whole wedding-day span — the `live` AND `post` phases
 * (T-1h .. T+24h). Use this (NOT `isInDayOfWindow`) to gate "live seat-plan
 * propagation": the `live` window is midnight-anchored (T-1h..T+8h ≈ 11pm-prev
 * .. 8am), so an EVENING reception actually lands in `post`. Guests arrive and
 * the digital plan is the source of truth across both — so the day-of editing
 * banner and the silent guest-finder self-refresh stay on for the full day,
 * not just the morning hours.
 *
 * @example
 * // evening reception, 6pm on the wedding day → delta ≈ +18h → 'post'
 * isEventDayActive(today); // true (post phase still counts)
 */
export function isEventDayActive(
  eventDate: string | Date,
  tz?: string,
  nowMs?: number,
): boolean {
  const phase = getDayOfPhase(eventDate, tz, nowMs);
  return phase === 'live' || phase === 'post';
}

/** The Event Lifecycle Menu phase — which menu the bottom nav shows. */
// NOT the public-website lifecycle: that is `LifecyclePhase` in lib/invitation-widgets.ts (save_the_date → rsvp → event → editorial), which `app/[slug]/page.tsx` consumes. Renamed from `LifecyclePhase` (OPEN-BROWSE PR1) to end the name collision.
export type MenuLifecyclePhase = 'plan' | 'dayof' | 'after';

/**
 * The Event Lifecycle Menu phase: **Plan → Day-of → After** (2026-06-16).
 *
 * - `after`  — the event was explicitly closed out (`cleared_at` set) OR it is
 *              past the day-of window (auto-clear at T+24h, evaluated read-side
 *              here so it needs no cron — per the locked cron-free architecture).
 * - `dayof`  — the event is live (`isEventDayActive`: live ‖ post — NOT
 *              `isInDayOfWindow`, so an evening reception in `post` still counts)
 *              and not yet cleared.
 * - `plan`   — everything before.
 *
 * Pass `cleared_at` from `events`; the column is added by migration
 * 20261231020000 and read defensively (a missing/null value just means
 * "not cleared", so this stays safe before the migration is applied).
 */
// NOT the public-website phase resolver: that is `getLifecyclePhase` in lib/invitation-widgets.ts. Renamed from `getLifecyclePhase` (OPEN-BROWSE PR1) to end the name collision.
/**
 * ⚠ `tz` and `nowMs` added 2026-08-14 for the day-of takeover, and both are
 * OPTIONAL so no existing caller changes meaning. Omitting `tz` keeps the
 * previous runtime-local anchor — which on Vercel is UTC, so a Manila event's
 * midnight lands 8 hours early and the phase can flip on the wrong side of the
 * boundary. Any caller that knows the venue's zone should pass it.
 *
 * Every branch below still DELEGATES to `eventDateToEpoch` / `isEventDayActive`
 * rather than re-deriving the window: a second copy of this arithmetic is
 * exactly how the bottom nav once swapped into day-of mode while the surface it
 * pointed at disagreed by up to 36 hours.
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
): MenuLifecyclePhase {
  if (clearedAt) return 'after';
  if (!eventDate) return 'plan';
  const eventMs = eventDateToEpoch(eventDate, tz);
  if (!Number.isFinite(eventMs)) return 'plan';

  /*
    IT IS OVER once the venue's clock reaches 06:00 on the day after the last
    day — see MORNING_AFTER_MS above for why six and not zero, and for why the
    old T+60h rule was deleted rather than kept beside this one.

    ⚠ THE NEXT MIDNIGHT IS COMPUTED AS A CALENDAR DAY, NOT AS "+24h".
    Adding a fixed 24h across a DST boundary lands an hour either side of
    midnight. Asia/Manila has no DST, so this is invisible in production today
    — which is exactly the kind of latent arithmetic this repo has been bitten
    by before. `eventDateToEpoch` already knows how to anchor a calendar day in
    a zone; it is asked for the NEXT day rather than told to add a number.
  */
  const firstDay = normalizeCalendarDay(eventDate);
  const lastDay = normalizeCalendarDay(eventEndDate) ?? firstDay;
  const morningAfterMs = lastDay
    ? eventDateToEpoch(nextCalendarDay(lastDay), tz) + MORNING_AFTER_MS
    : NaN;
  const now = nowMs ?? Date.now();
  if (Number.isFinite(morningAfterMs) && now >= morningAfterMs) return 'after';

  if (isEventDayActive(eventDate, tz, nowMs)) return 'dayof';

  /*
    THE MIDDLE DAYS OF A CELEBRATION THAT SPANS SEVERAL.

    `isEventDayActive` only ever sees the FIRST day, so on day three of a
    five-day festival it answers "no" — and before this branch existed the
    phase fell through to **'plan'**, telling a family in the middle of their
    own celebration to go and plan it. (Latent: prod holds no ranged event
    today, which is precisely why it went unnoticed.)

    🔒 STILL DELEGATED — this adds no second copy of the window arithmetic.
    The only comparison is "has the first day begun", and the far edge is the
    SAME `morningAfterMs` the over-check above uses. The reason the rest of
    this function refuses to re-derive the bounds is that the bottom nav once
    swapped into day-of mode while the surface it pointed at disagreed by 36
    hours; a lone `now >= eventMs` cannot reproduce that.
  */
  if (lastDay && lastDay !== firstDay && now >= eventMs && now < morningAfterMs) {
    return 'dayof';
  }

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
 * Returns the current day-of phase for the given event date.
 *
 * ⚠ These bounds are DERIVED from the constants at the top of this file, not
 * re-typed. The list below said `live: T-1h .. T+8h` and `post: T+8h .. T+24h`
 * while the code has used 12h / 36h / 60h — a docblock describing a different
 * function than the one beneath it. Corrected 2026-08-06.
 *
 * - `pre`      : T − PRE_WINDOW_START_MS  .. T − 12h
 * - `live`     : T − 12h                  .. T + 36h  (noon before → noon after)
 * - `post`     : T + 36h                  .. T + 60h  (a further day to look back)
 * - `inactive` : otherwise
 *
 * `now` is injectable so a client component can defer the read to an effect and
 * avoid an SSR/hydration mismatch — the reason lib/guest-journey.ts once carried
 * its own naive copy of this window.
 *
 * @example
 * // 2 hours after the wedding day midnight anchor
 * getDayOfPhase(yesterday); // 'live'  (within T+8h)
 *
 * @example
 * // 2 days before the wedding
 * getDayOfPhase(twoDaysOut); // 'pre'
 *
 * @example
 * // 5 days before the wedding
 * getDayOfPhase(fiveDaysOut); // 'inactive'
 */
export function getDayOfPhase(
  eventDate: string | Date,
  tz?: string,
  nowMs?: number,
): DayOfPhase {
  const eventMs = eventDateToEpoch(eventDate, tz);
  if (!Number.isFinite(eventMs)) return 'inactive';
  const now = nowMs ?? Date.now();
  const delta = now - eventMs; // positive = past anchor

  if (delta >= -LIVE_WINDOW_START_MS && delta <= LIVE_WINDOW_END_MS) return 'live';
  if (delta >= -PRE_WINDOW_START_MS && delta < -LIVE_WINDOW_START_MS) return 'pre';
  if (delta > LIVE_WINDOW_END_MS && delta <= POST_WINDOW_END_MS) return 'post';
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
