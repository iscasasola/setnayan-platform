/**
 * face-data-retention-core.ts — WHEN does a guest's face data stop being ours?
 *
 * Pure arithmetic only, so the boundary can be proved without a database. The
 * I/O half lives in `lib/face-data-retention.ts`.
 *
 * ─── THE PROMISE THIS MAKES TRUE ──────────────────────────────────────────
 * The NPC pack's face row (ROPA, regenerated 2026-08-17) states:
 *
 *   "Deleted 3 MONTHS AFTER THE EVENT ENDS (event_end_date where the
 *    celebration spans several days, else event_date) — the same clock as the
 *    full-resolution photo floor. Owner ruling 2026-08-17."
 *
 * and then, in the same row: "ADOPTED 2026-08-17, ENFORCEMENT NOT YET BUILT.
 * No sweep implements this period yet." This module is that sweep.
 *
 * 🔑 "THE SAME CLOCK AS THE FULL-RESOLUTION PHOTO FLOOR" IS AN INSTRUCTION, SO
 * THE NUMBER IS IMPORTED, NOT RE-TYPED. `FULL_RES_POST_EVENT_GRACE_DAYS` is 92
 * — the LONGEST three-calendar-month span (1 Mar → 1 Jun), chosen so "three
 * months" is true for every event date rather than most of them. Re-typing 92
 * here would produce two copies of one rule that drift apart the first time the
 * owner moves it; this repo has already paid for that with a QR that asked
 * ₱1,500 against ₱2,000 owed. If the floor moves, this moves with it.
 */
import { FULL_RES_POST_EVENT_GRACE_DAYS } from '@/lib/papic-fullres-drop-core';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days after the event's LAST day before face data is deleted. Deliberately an
 * alias, not a literal — see the header.
 */
export const FACE_DATA_POST_EVENT_GRACE_DAYS = FULL_RES_POST_EVENT_GRACE_DAYS;

/**
 * The event's LAST day, as a bare `YYYY-MM-DD`, or null when the event carries
 * no usable date at all.
 *
 * This reproduces, exactly, the expression the database already uses in
 * `papic_events_past_fullres_clock`:
 *
 *   GREATEST(COALESCE(e.event_end_date, e.event_date), e.event_date)
 *
 * • COALESCE is the owner's stated fallback (2026-08-10): the end date when the
 *   celebration spans several days, otherwise the start date. A one-day event
 *   is untouched, which is why reading only the start date never showed.
 * • GREATEST is a one-way valve, not decoration. `events_end_date_after_start`
 *   is a CHECK, and a CHECK can be dropped or added NOT VALID. Taking the LATER
 *   of the two means a malformed end date EARLIER than the start can only ever
 *   be ignored — it can never pull the clock backwards and delete sooner.
 *   Every term here can only ever KEEP data longer.
 *
 * ⚠ THE PRODUCT MUST NOT GROW A SECOND ANSWER TO "WHEN DID THIS END". The
 * canonical resolver for a live event is `getMenuLifecyclePhase` (06:00 in the
 * venue's clock on the day after the last day), reached via `eventIsOver`. That
 * one answers "is the celebration finished right now" for a screen. This one
 * answers "which calendar day was the last one" for a retention clock 92 days
 * later, where a six-hour boundary is noise — and it matches the SQL the
 * full-res floor already runs, which is the comparison that matters here.
 */
export function eventLastDay(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
): string | null {
  const start = normalizeDay(eventDate);
  const end = normalizeDay(eventEndDate);
  // COALESCE(end, start), then GREATEST against start. Postgres GREATEST ignores
  // NULLs, so an event with an end date and no start still floors on the end
  // date instead of collapsing to "no clock".
  const coalesced = end ?? start;
  if (!coalesced) return null;
  if (!start) return coalesced;
  return coalesced > start ? coalesced : start;
}

/** A bare `YYYY-MM-DD`, or null for anything we cannot read as one. */
function normalizeDay(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m?.[1] ?? null;
}

/**
 * The instant face data for an event becomes deletable, in epoch ms — or null
 * when the event has no usable date.
 *
 * ⚠ THE DAY IS ANCHORED AT UTC MIDNIGHT ON PURPOSE, matching the database. The
 * SQL floor casts a DATE with `event_last_day::timestamptz`, which resolves in
 * the session timezone — and production runs UTC. The 92-day figure already
 * absorbs the few hours a date cast can introduce (the migration that set it
 * says so explicitly and declines to re-litigate it), so a venue-clock
 * refinement here would buy nothing and would make the two clocks disagree.
 *
 * This is the one place a `new Date('YYYY-MM-DD')` would have been wrong in the
 * other direction — that parses as midnight UTC, which is the PREVIOUS day west
 * of Greenwich, and would delete a day early. Date.UTC is explicit about it.
 */
export function faceDataDeletableFromMs(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
  graceDays: number = FACE_DATA_POST_EVENT_GRACE_DAYS,
): number | null {
  const lastDay = eventLastDay(eventDate, eventEndDate);
  if (!lastDay) return null;
  const parts = lastDay.split('-').map(Number);
  const [y, m, d] = [parts[0] ?? NaN, parts[1] ?? NaN, parts[2] ?? NaN];
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dayStart = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  if (!Number.isFinite(dayStart)) return null;
  return dayStart + Math.max(0, graceDays) * MS_PER_DAY;
}

/**
 * Is this event's face data past its retention period?
 *
 * 🔒 FAILS CLOSED, AND THAT IS THE WHOLE POINT. An event with no readable date
 * returns FALSE — it is never swept. The alternative (treat "no date" as
 * infinitely old) turns one malformed row into irreversible deletion of
 * somebody's biometric consent record and the picture behind it. A sweep that
 * skips something is recoverable on the next run; a sweep that deletes on bad
 * information is not. There is no inverse here.
 */
export function faceDataIsPastRetention(
  eventDate: string | null | undefined,
  eventEndDate: string | null | undefined,
  nowMs: number,
  graceDays: number = FACE_DATA_POST_EVENT_GRACE_DAYS,
): boolean {
  const from = faceDataDeletableFromMs(eventDate, eventEndDate, graceDays);
  if (from === null) return false;
  if (!Number.isFinite(nowMs)) return false;
  return nowMs >= from;
}
