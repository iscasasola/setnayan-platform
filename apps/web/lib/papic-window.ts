/**
 * apps/web/lib/papic-window.ts
 *
 * The Papic CAPTURE WINDOW (owner 2026-06-26 ·
 * migration 20270305885232_papic_capture_window_per_event).
 *
 * The couple picks a window for their event's Papic — a START (day + time) and
 * an END (day; the time is auto-set to end-of-day). That single window sets how
 * long the cameras can SHOOT — paparazzi_seats.valid_from / valid_until are
 * stamped to it and capture is gated to it.
 *
 * ⚠ The window is NOT a price input. Papic is FLAT per camera (2026-07-22 naming
 * lock · migration 20270830568357): the charge is `cameras × rate`, no per-day
 * multiplier — matching /pricing (_papic-estimator.tsx). `days` (the calendar-
 * inclusive span, ≥ 1) is surfaced for the seat window + labels only. The old
 * `cameras × rate/day × DAYS` bill engine was retired with the flat rename.
 *
 * Event-type rules (owner 2026-06-26):
 *   • travel  — free range: day 1 → end date of the trip (both picked).
 *   • else    — anchored to events.event_date: the window must COVER the event
 *               day and may extend BEFORE it but never past it (the last DAY is
 *               pinned to event_date; only the start moves earlier). Weddings
 *               are the canonical single-day case.
 *
 * ⏰ AND CAPTURE RUNS TWELVE HOURS PAST THAT LAST DAY (owner 2026-09-22). The
 * last day is still the last day — `days`, the price labels and the picker all
 * count the days the couple picked — but the shutter keeps working until
 * 11:59:59 the next morning, Manila. See PAPIC_CAPTURE_GRACE_HOURS. This
 * header used to say the window "never extends AFTER" the event date and that
 * is now only true of the DAY, not of the shutter.
 *
 * PURE + unit-testable. No DB, no I/O. Day boundaries are Asia/Manila — the
 * PH-first audience — and PH has no DST, so a fixed +08:00 offset is exact.
 */

/** Asia/Manila is UTC+8 year-round (no DST) — a fixed offset is exact. */
export const PAPIC_TZ_OFFSET = '+08:00';

/**
 * How early a camera may start shooting, relative to the event date.
 *
 * 🔒 OWNER RULE, 2026-08-07, settled across three messages in one sitting:
 *   1. *"they can start taking photo up to 5 months before the main event"*
 *   2. *"let them use the papic service up to 6 months away from the event"*  ← FINAL
 *   3. *"still preserve 3 months all their photos in high res before we compress it"*
 *
 * 🔑 SIX IS NOT DERIVED FROM RETENTION, AND MUST NOT BE. The first version of
 * this constant computed `5 = 6 months retention − 1 month post-event`, which
 * looked elegant and quietly made the capture window a hostage of the retention
 * window. The owner then set capture to a flat six months. At six months out the
 * first-capture clock runs out ON THE WEDDING DAY — so if capture were still
 * derived, the arithmetic would now "prove" the promise is zero days.
 *
 * It is not zero, because the promise was never carried by this number:
 *
 *   originals are dropped at   GREATEST( first_capture + 6 months,
 *                                        event_date    + 3 months )
 *
 * — a GREATEST in SQL (migration 20271102113000), not a subtraction here. The
 * SECOND term is what preserves the photos after the day, and it holds no matter
 * how early shooting began. Shoot from six months out and the originals live
 * three months past the wedding; shoot on the day itself and they live six.
 * Those are two independent promises, and this file owns only the first.
 *
 * ⚠ THE RULE WAS NEVER IN THE CODE AT ALL. The default window was a SINGLE DAY —
 * the event day, midnight to midnight — so a couple who never opened the window
 * picker got a camera that refused every shot until the wedding morning. The
 * engagement shoot, the fittings, the week before: all rejected. That default is
 * what stamped `valid_from = valid_until` onto six of the thirteen seats in
 * production, including both seats anyone had ever claimed.
 */
export const PAPIC_CAPTURE_MONTHS_BEFORE = 6;

/**
 * The earliest date a camera may shoot for an event on `eventDate`.
 * Calendar months, not 183 days — "6 months before 12 December" is 12 June.
 */
export function earliestCaptureDate(eventDate: string): string {
  const [y, m, d] = eventDate.split('-').map(Number);
  // Day 1 of the target month, then clamp the day to that month's length so
  // 31 March − 6 months lands on 30 September, and 31 August − 6 months on 28/29 Feb.
  const target = new Date(Date.UTC(y!, m! - 1 - PAPIC_CAPTURE_MONTHS_BEFORE, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d!, lastDay);
  const mm = String(target.getUTCMonth() + 1).padStart(2, '0');
  return `${target.getUTCFullYear()}-${mm}-${String(day).padStart(2, '0')}`;
}

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

/**
 * HOW LONG THE CAMERAS KEEP SHOOTING AFTER THE CELEBRATION'S LAST DAY ENDS.
 *
 * 🔒 OWNER RULE, 2026-09-22, settled in two messages in one sitting:
 *   1. *"okay, we give them until lunch the next day."*
 *   2. *"just do 12 hours after the event ends."*
 *
 * 🔑 THOSE ARE ONE RULE, AND THAT IS WHAT MADE IT BUILDABLE WITHOUT ASKING A
 * COUPLE ANYTHING. `events` stores `event_date` / `event_end_date` as DATE
 * columns and holds no clock time for an event anywhere — the only `time`
 * columns on the table are the partners' birth times, and no run-of-show table
 * carries times either (both measured 2026-09-22). So "when their event ends"
 * can only mean the end of the event's calendar day, 23:59:59 Manila. Twelve
 * hours past that is 11:59:59 the next morning, which IS lunch the next day.
 *
 * ⚠ DO NOT ADD AN EVENT END-TIME FIELD TO MAKE THIS MORE PRECISE. Considered
 * and rejected: it puts a new required question in front of every couple to buy
 * accuracy nobody asked for, and `event_end_date` is NULL on all 11 live events
 * — a second optional field would be null too and would fall back here anyway.
 *
 * ⚠ AND IT IS A TAIL ON CAPTURE, NOT A LONGER CELEBRATION. `days` — the
 * calendar-inclusive span on every price label and order description — still
 * counts the days the couple picked. A wedding is one day of capture that runs
 * until noon the next morning, not two days.
 */
export const PAPIC_CAPTURE_GRACE_HOURS = 12;

const HOUR_MS = 3_600_000;

/**
 * THE ONE PLACE THE CAMERAS' CLOSING INSTANT IS DECIDED.
 *
 * Takes the last calendar day of the window (Manila) and returns the instant
 * capture stops — the end of that day plus {@link PAPIC_CAPTURE_GRACE_HOURS}.
 *
 * 🔑 EVERY GATE AND EVERY SCREEN COMES THROUGH HERE. `resolvePapicWindow` and
 * `resolveStoredWindow` stamp its answer into `events.papic_window_end` and
 * `paparazzi_seats.valid_until`; `guestCaptureGate` closes on it; the picker
 * and the settings row print it through `formatCaptureCloseLabel`. If the
 * screen says the new instant and a gate keeps the old one, this build has made
 * things worse than before it started — so there is exactly one term.
 */
export function manilaCaptureCloseIso(dateStr: string): string {
  const endOfDay = manilaEndOfDayIso(dateStr);
  const dayMs = Date.parse(endOfDay);
  // ⚠ NEVER THROW ON THE WAY TO A GATE. `new Date(NaN).toISOString()` raises a
  // RangeError, and this is called from the guest capture gate — an exception
  // there is a refusal that does not even look like one. An unparseable day
  // returns the string it was given, which every reader treats as "no bound"
  // and fails OPEN, the posture the rest of this module already takes.
  if (!Number.isFinite(dayMs)) return endOfDay;
  const closeMs = dayMs + PAPIC_CAPTURE_GRACE_HOURS * HOUR_MS;
  // Shift into the Manila wall clock, then re-attach the fixed offset. Derived
  // from the constant on purpose: hard-coding "the next day at 11:59:59" would
  // still read correctly and would no longer be the owner's number.
  const wall = new Date(closeMs + 8 * HOUR_MS).toISOString();
  return `${wall.slice(0, 10)}T${wall.slice(11, 19)}${PAPIC_TZ_OFFSET}`;
}

/**
 * The inverse: the last calendar day the couple PICKED, recovered from a stored
 * close instant. Used for `days`, for the date range on labels, and to seed the
 * picker — all of which must keep talking about the chosen days.
 *
 * 🔑 CORRECT FOR BOTH SHAPES, DELIBERATELY. A window stored before the grace
 * shipped holds `D 23:59:59` and one stored after holds `D+1 11:59:59`; minus
 * twelve hours those are `D 11:59:59` and `D 23:59:59`, and both are day D. So
 * a label never jumps a day on an event whose row the migration has not reached.
 */
export function captureCloseEndDate(closeIso: string | null | undefined): string | null {
  if (!closeIso) return null;
  const t = Date.parse(String(closeIso));
  if (!Number.isFinite(t)) return manilaDate(closeIso);
  return manilaDate(new Date(t - PAPIC_CAPTURE_GRACE_HOURS * HOUR_MS).toISOString());
}

/**
 * The instant a stored `valid_until` closes the shutter.
 *
 * 🔑 TWO SHAPES, AND THE DIFFERENCE IS THE WHOLE POINT. Since migration
 * 20271238778987, `paparazzi_seats.valid_until` is a **timestamptz** holding the exact closing
 * instant (`manilaCaptureCloseIso` wrote it), so it is honoured verbatim — that
 * is how the twelve-hour tail reaches the gate at all.
 *
 * A bare `YYYY-MM-DD` keeps its ORIGINAL meaning, the whole Manila day. It is
 * not given the tail, and that is deliberate rather than an oversight: a bare
 * date is a row the widening did not reach, and silently re-reading old values
 * under a new rule is how a window changes meaning without anyone deciding it.
 * The migration moves every real row; this branch only has to not lie.
 */
function captureEndMs(validUntil: string | null | undefined): number {
  if (!validUntil) return NaN;
  const s = String(validUntil);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return Date.parse(`${s}T23:59:59.999${PAPIC_TZ_OFFSET}`);
  }
  // A full timestamp carries its own offset — parse it as written.
  return Date.parse(s);
}

/**
 * Is a camera's capture window open right now?
 *
 * 🚨 THE BUG THIS EXISTS TO KILL. `paparazzi_seats.valid_from` / `valid_until`
 * are **DATE** columns, so PostgREST hands back `"2026-09-19"`. Both call sites
 * used to do `Date.parse(vf)` — which is midnight **UTC**, i.e. 08:00 Manila —
 * and compare it to `Date.now()`. A one-day window stamps the SAME date into
 * both columns, so start and end collapsed onto the SAME INSTANT: the window was
 * open for about one millisecond, once, at 8 AM on the event day.
 *
 * Measured in prod 2026-08-07: SIX of thirteen seats carried
 * `valid_from = valid_until`, and **both seats anyone had ever claimed were in
 * that set**. Every shutter tap either of those photographers made was refused.
 * That is the whole reason `papic_photos` had zero rows.
 *
 * A DATE means a whole Manila DAY: from 00:00:00 to 23:59:59.999 at +08:00.
 *
 * ⏰ `valid_until` IS NO LONGER A DATE. It was widened to timestamptz so it can
 * hold the owner's twelve-hour tail (11:59:59 the morning after the last day) —
 * a DATE column cannot express 11:59am, and this function reads a bare date as
 * a whole day on purpose, so stamping `last day + 1` would have granted the
 * WHOLE next day instead. `valid_from` stays a DATE, also on purpose: widening
 * it would suddenly honour the start TIME that has always been truncated to
 * midnight, and a camera that opens at 2 PM instead of 00:00 REFUSES shots that
 * work today. See captureEndMs for how the two shapes are read.
 *
 * ⚠ TEST THIS UNDER Asia/Manila. In UTC the start bound looks correct — midnight
 * UTC really is the start of that UTC day — so a UTC-only suite is blind to it,
 * which is exactly how it shipped.
 *
 * Fails OPEN on null/absent/unparseable bounds: a legacy seat with no window
 * must never be bricked by this check.
 */
export function captureWindowState(
  validFrom: string | null | undefined,
  validUntil: string | null | undefined,
  nowMs: number = Date.now(),
): 'open' | 'not_started' | 'closed' {
  const startMs = validFrom ? Date.parse(`${validFrom}T00:00:00${PAPIC_TZ_OFFSET}`) : NaN;
  const endMs = captureEndMs(validUntil);
  if (Number.isFinite(startMs) && nowMs < startMs) return 'not_started';
  if (Number.isFinite(endMs) && nowMs > endMs) return 'closed';
  return 'open';
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
  | 'end_after_event_date'
  /** Start earlier than PAPIC_CAPTURE_MONTHS_BEFORE months before the event. */
  | 'start_too_early';

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
        // A trip's last day gets the same twelve hours as a wedding day — one
        // rule for every event type, so nobody has to remember an exception.
        startIso: manilaStartIso(startDate, input.startTime ?? '00:00'),
        endIso: manilaCaptureCloseIso(endDate),
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
  // And no earlier than the owner's allowance (5 calendar months before).
  if (Date.parse(`${startDate}T00:00:00Z`) < Date.parse(`${earliestCaptureDate(anchor)}T00:00:00Z`)) {
    return { ok: false, error: 'start_too_early' };
  }
  return {
    ok: true,
    window: {
      startIso: manilaStartIso(startDate, input.startTime ?? '00:00'),
      endIso: manilaCaptureCloseIso(anchor),
      days: inclusiveDays(startDate, anchor),
      startDate,
      endDate: anchor,
    },
  };
}

export type StoredWindow = {
  /** paparazzi_seats validity window + the multiplier for pricing */
  startIso: string | null;
  /** The instant capture STOPS — the last day's end plus the owner's twelve hours. */
  endIso: string | null;
  days: number;
  /** The first calendar day of the window, Manila. */
  startDate: string | null;
  /**
   * The LAST calendar day the couple picked, Manila — not the day `endIso`
   * falls on, which is the morning after.
   *
   * 🔑 CARRIED RATHER THAN RE-DERIVED. Every label was built by running
   * `manilaDate(endIso)`, and the moment `endIso` moved past midnight that
   * turned a one-day wedding into "Dec 20 – Dec 21 · 2 days" on the price tile,
   * the order description and the settings row at once. The chosen days and the
   * closing instant are two different facts now; this is the first one.
   */
  endDate: string | null;
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
    // ⚠ THE END DAY IS RECOVERED, NEVER READ OFF `windowEnd`. A stored close
    // instant sits on the MORNING AFTER the last day, so `manilaDate(windowEnd)`
    // would add a phantom day to `days` and to every label built from it.
    const startDay = manilaDate(windowStart);
    const endDay = captureCloseEndDate(windowEnd);
    return {
      startIso: windowStart,
      endIso: windowEnd,
      days: inclusiveDays(startDay, endDay),
      startDate: startDay,
      endDate: endDay,
    };
  }
  // DEFAULT WINDOW — the owner's rule, not a single day.
  //
  // ⚠ THIS USED TO RETURN A ONE-DAY WINDOW anchored to the event date, labelled
  // "legacy single-day fallback". It is not a legacy path: it is what EVERY
  // event gets until someone opens the window picker, and it made the camera
  // refuse every shot except on the wedding day itself. Six of thirteen prod
  // seats were stamped from it.
  //
  // A camera may shoot from PAPIC_CAPTURE_MONTHS_BEFORE months before the event
  // through the end of the event day.
  const anchor = manilaDate(eventDate);
  if (isValidDateStr(anchor)) {
    const start = earliestCaptureDate(anchor);
    return {
      startIso: manilaStartIso(start, '00:00'),
      endIso: manilaCaptureCloseIso(anchor),
      days: inclusiveDays(start, anchor),
      startDate: start,
      endDate: anchor,
    };
  }
  return { startIso: null, endIso: null, days: 1, startDate: null, endDate: null };
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

/**
 * A single Manila calendar date as a short human string, e.g. "Sep 19" — for
 * a refusal sentence that names WHEN a camera opens, not just THAT it's shut.
 * null on an empty/unparseable input (the caller falls back to date-less copy).
 */
export function formatManilaDate(value: string | null | undefined): string | null {
  const d = manilaDate(value);
  if (!d) return null;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${d}T12:00:00${PAPIC_TZ_OFFSET}`));
}

/**
 * When the cameras stop, written for a couple: e.g. "Sep 20, 11:59 AM".
 *
 * 🔑 FORMATS THE GATE'S OWN NUMBER. It takes the stored close instant — the
 * same string `captureWindowState` compares against — rather than re-deriving
 * "the end day plus twelve hours" for the screen. A screen that computes the
 * rule a second time is a second decider, and the failure it produces is the
 * one this build exists inside: the page promising a shutter that is already
 * shut. null on an empty/unparseable instant, so the caller falls back to
 * date-less copy instead of printing "Invalid Date".
 */
export function formatCaptureCloseLabel(closeIso: string | null | undefined): string | null {
  if (!closeIso) return null;
  const t = Date.parse(String(closeIso));
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(t));
}
