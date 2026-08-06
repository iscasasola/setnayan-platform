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
export function getMenuLifecyclePhase(
  eventDate: string | Date | null | undefined,
  clearedAt: string | Date | null | undefined,
): MenuLifecyclePhase {
  if (clearedAt) return 'after';
  if (!eventDate) return 'plan';
  const eventMs = eventDateToEpoch(eventDate);
  if (!Number.isFinite(eventMs)) return 'plan';
  if (isEventDayActive(eventDate)) return 'dayof';
  // Past the day-of window with no explicit close-out → auto-clear to After.
  if (Date.now() > eventMs + POST_WINDOW_END_MS) return 'after';
  return 'plan';
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
