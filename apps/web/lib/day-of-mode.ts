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
 *   pre      : T - 3d   .. T - 1h
 *   live     : T - 1h   .. T + 8h
 *   post     : T + 8h   .. T + 24h
 *   inactive : everything else
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const PRE_WINDOW_START_MS = 3 * DAY_MS; // T - 3d
const LIVE_WINDOW_START_MS = 1 * HOUR_MS; // T - 1h
const LIVE_WINDOW_END_MS = 8 * HOUR_MS; // T + 8h
const POST_WINDOW_END_MS = 24 * HOUR_MS; // T + 24h

export type DayOfPhase = 'pre' | 'live' | 'post' | 'inactive';

function eventDateToEpoch(eventDate: string | Date): number {
  if (eventDate instanceof Date) return eventDate.getTime();
  // Bare date strings ("2026-12-19") parse as UTC midnight; we want the
  // dashboard user's local midnight so the day-of window aligns with the
  // wedding-day morning rather than potentially flipping at 8 PM the night
  // before for far-east timezones. Construct local midnight explicitly when
  // we receive a YYYY-MM-DD shape.
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(eventDate);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
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
export function isInDayOfWindow(eventDate: string | Date): boolean {
  return getDayOfPhase(eventDate) === 'live';
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
export function isEventDayActive(eventDate: string | Date): boolean {
  const phase = getDayOfPhase(eventDate);
  return phase === 'live' || phase === 'post';
}

/** The Event Lifecycle Menu phase — which menu the bottom nav shows. */
export type LifecyclePhase = 'plan' | 'dayof' | 'after';

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
export function getLifecyclePhase(
  eventDate: string | Date | null | undefined,
  clearedAt: string | Date | null | undefined,
): LifecyclePhase {
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
 * - `pre`      : T - 3 days   .. T - 1 hour
 * - `live`     : T - 1 hour   .. T + 8 hours
 * - `post`     : T + 8 hours  .. T + 24 hours
 * - `inactive` : otherwise
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
export function getDayOfPhase(eventDate: string | Date): DayOfPhase {
  const eventMs = eventDateToEpoch(eventDate);
  if (!Number.isFinite(eventMs)) return 'inactive';
  const now = Date.now();
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
