/**
 * apps/web/lib/papic-window.ts
 *
 * The Papic CAPTURE WINDOW (owner 2026-06-26 ·
 * migration 20270305885232_papic_capture_window_per_event).
 *
 * The couple picks a window for their event's Papic — a START (day + time) and
 * an END (day; the time is auto-set to end-of-day). That single window drives
 * BOTH halves of the spec at once:
 *
 *   • the BILL — every camera (Limited guest cameras + Unlimited extras) is
 *     priced `cameras × rate/day × DAYS`, DAYS being the calendar-inclusive
 *     span of the window (≥ 1). One day for a single-day wedding; the full trip
 *     span for travel.
 *   • how long the cameras can SHOOT — paparazzi_seats.valid_from / valid_until
 *     are stamped to the window and capture is gated to it.
 *
 * Event-type rules (owner 2026-06-26):
 *   • travel  — free range: day 1 → end date of the trip (both picked).
 *   • else    — anchored to events.event_date: the window must COVER the event
 *               day and may extend BEFORE it but never AFTER (the end is pinned
 *               to event_date; only the start moves earlier). Weddings are the
 *               canonical single-day case.
 *
 * PURE + unit-testable. No DB, no I/O. Day boundaries are Asia/Manila — the
 * PH-first audience — and PH has no DST, so a fixed +08:00 offset is exact.
 */

/** Asia/Manila is UTC+8 year-round (no DST) — a fixed offset is exact. */
export const PAPIC_TZ_OFFSET = '+08:00';

/** Travel is the only multi-day-by-default type; everything else anchors to event_date. */
export function isTravelEventType(eventType: string | null | undefined): boolean {
  return String(eventType ?? '').toLowerCase() === 'travel';
}

/** Normalize a date-ish value ('YYYY-MM-DD' or full ISO) to the Manila calendar date. */
export function manilaDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value);
  // A bare 'YYYY-MM-DD' is already a calendar date — keep it verbatim.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  // 'en-CA' formats as YYYY-MM-DD; the timeZone pins the day boundary to Manila.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(
    new Date(t),
  );
}

function isValidDateStr(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T00:00:00Z`));
}

function normalizeTime(time: string | null | undefined): string {
  const s = String(time ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return '00:00';
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Manila wall-clock start as a timestamptz ISO (with the fixed +08:00 offset). */
export function manilaStartIso(dateStr: string, timeStr: string): string {
  return `${dateStr}T${normalizeTime(timeStr)}:00${PAPIC_TZ_OFFSET}`;
}

/** End-of-day Manila (23:59:59) for a calendar date as a timestamptz ISO. */
export function manilaEndOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59${PAPIC_TZ_OFFSET}`;
}

/** Calendar-inclusive day count between two YYYY-MM-DD dates (≥ 1). Mon→Fri = 5. */
export function inclusiveDays(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number {
  if (!isValidDateStr(startDate) || !isValidDateStr(endDate)) return 1;
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const diff = Math.round((b - a) / 86_400_000) + 1;
  return Math.max(1, diff);
}

export type ResolvedPapicWindow = {
  startIso: string;
  endIso: string;
  /** calendar-inclusive, ≥ 1 */
  days: number;
  startDate: string;
  endDate: string;
};

export type PapicWindowError =
  | 'missing_start'
  | 'missing_event_date'
  | 'start_after_end'
  | 'end_after_event_date';

export type PapicWindowResult =
  | { ok: true; window: ResolvedPapicWindow }
  | { ok: false; error: PapicWindowError };

export type PapicWindowInput = {
  eventType: string | null | undefined;
  /** the anchor for non-travel events ('YYYY-MM-DD' or ISO) */
  eventDate: string | null | undefined;
  /** picked start day 'YYYY-MM-DD' */
  startDate: string | null | undefined;
  /** picked start time 'HH:MM' (24h); defaults to 00:00 */
  startTime?: string | null;
  /** picked end day 'YYYY-MM-DD' — used for travel; ignored (pinned to event_date) otherwise */
  endDate?: string | null;
};

/**
 * Resolve the couple's picks into a concrete window, applying the event-type
 * rules. The END time is always auto-set (end-of-day Manila) — the couple only
 * ever picks an end DAY (and for non-travel events not even that — it's pinned).
 */
export function resolvePapicWindow(input: PapicWindowInput): PapicWindowResult {
  const startDate = input.startDate ?? null;
  if (!isValidDateStr(startDate)) return { ok: false, error: 'missing_start' };

  if (isTravelEventType(input.eventType)) {
    // Travel: free range, both ends picked. Day 1 → end of trip.
    const endDate = isValidDateStr(input.endDate ?? null)
      ? (input.endDate as string)
      : startDate; // a single-day trip is allowed
    if (Date.parse(`${endDate}T00:00:00Z`) < Date.parse(`${startDate}T00:00:00Z`)) {
      return { ok: false, error: 'start_after_end' };
    }
    return {
      ok: true,
      window: {
        startIso: manilaStartIso(startDate, input.startTime ?? '00:00'),
        endIso: manilaEndOfDayIso(endDate),
        days: inclusiveDays(startDate, endDate),
        startDate,
        endDate,
      },
    };
  }

  // Anchored types (wedding + all others): the end is PINNED to event_date — the
  // window covers the event day and may extend before it, never after.
  const anchor = manilaDate(input.eventDate);
  if (!isValidDateStr(anchor)) return { ok: false, error: 'missing_event_date' };
  if (Date.parse(`${startDate}T00:00:00Z`) > Date.parse(`${anchor}T00:00:00Z`)) {
    // Starting after the event day can't cover it.
    return { ok: false, error: 'end_after_event_date' };
  }
  return {
    ok: true,
    window: {
      startIso: manilaStartIso(startDate, input.startTime ?? '00:00'),
      endIso: manilaEndOfDayIso(anchor),
      days: inclusiveDays(startDate, anchor),
      startDate,
      endDate: anchor,
    },
  };
}

export type StoredWindow = {
  /** paparazzi_seats validity window + the multiplier for pricing */
  startIso: string | null;
  endIso: string | null;
  days: number;
};

/**
 * Read a stored window (events.papic_window_start/end) into the shape the
 * pricing + provisioning paths need. Falls back to the legacy single-day
 * behaviour (anchored to event_date) when no window is set, so every existing
 * event keeps working unchanged.
 */
export function resolveStoredWindow(args: {
  windowStart: string | null | undefined;
  windowEnd: string | null | undefined;
  eventDate: string | null | undefined;
}): StoredWindow {
  const { windowStart, windowEnd, eventDate } = args;
  if (windowStart && windowEnd) {
    return {
      startIso: windowStart,
      endIso: windowEnd,
      days: inclusiveDays(manilaDate(windowStart), manilaDate(windowEnd)),
    };
  }
  // Legacy single-day fallback.
  const anchor = manilaDate(eventDate);
  if (isValidDateStr(anchor)) {
    return {
      startIso: manilaStartIso(anchor, '00:00'),
      endIso: manilaEndOfDayIso(anchor),
      days: 1,
    };
  }
  return { startIso: null, endIso: null, days: 1 };
}

/** Short human summary of a window for order descriptions / UI, e.g. "Jun 12–14 · 3 days". */
export function formatWindowSummary(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): string {
  const s = manilaDate(startDate);
  const e = manilaDate(endDate);
  if (!s) return '';
  const days = inclusiveDays(s, e ?? s);
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
    }).format(new Date(`${d}T12:00:00${PAPIC_TZ_OFFSET}`));
  const span = !e || e === s ? fmt(s) : `${fmt(s)} – ${fmt(e)}`;
  return `${span} · ${days} day${days === 1 ? '' : 's'}`;
}
