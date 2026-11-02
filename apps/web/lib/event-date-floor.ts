/**
 * 💍 NO EVENT BEFORE DECEMBER 19, 2026 — THE FOUNDERS' WEDDING IS THE FIRST.
 *
 * Owner, 2026-11-01 (DECISION_LOG "NO EVENT BEFORE DECEMBER 19, 2026 — THE
 * FOUNDERS' WEDDING IS THE FIRST (fixed rule)"): a new event's date, and any
 * change to an existing event's date, must be on or after 2026-12-19. The
 * founders' own (`users.is_internal`) accounts may use any date, and an event
 * that already exists keeps its date until somebody changes it.
 *
 * 🔒 UNCHANGEABLE BY DESIGN. Owner: *"No need to change it will be an
 * unchangeable rule"* — a constant in code, never an Admin setting and never a
 * database row. Every door that creates an event or sets its date asks
 * `eventDateFloorRefusal` (server side, the backstop) and every date picker a
 * normal account sees starts at `eventDateMinFor` (the front door). The guard
 * `event-date-floor.test.ts` holds both halves.
 *
 * Pure — no I/O. Who is exempt is answered by `event-date-floor.server.ts`.
 */

/** The first day any normal account's event may be on. */
export const FIRST_EVENT_DAY = '2026-12-19';

/** The founders' wedding — the very first event (named in the refusal). */
export const FOUNDERS_WEDDING_DAY = '2026-12-18';

/** The owner's own words, verbatim (DECISION_LOG 2026-11-01). Said beside the date. */
export const EVENT_DATE_FLOOR_MESSAGE =
  "Thank you for planning with Setnayan! Our very first event is our founders' wedding on December 18, 2026 — and we'd love for them to open the doors. Events start from December 19, 2026. Pick that day or later, and we can't wait to be part of yours.";

export type FloorPrecision = 'day' | 'month' | 'year';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The LAST day a stored date can mean at its precision — a month-precise
 * "December 2026" (stored as 2026-12-01) still reaches December 19–31, so it is
 * not refused; the day it later narrows to is asked again. Same reading as
 * `isEventDateInPast` (lib/events.ts). Null for anything that is not a date.
 */
export function lastDayOf(iso: string, precision: FloorPrecision | null | undefined = 'day'): string | null {
  // A bare month ("2026-12") is read at month precision.
  if (/^\d{4}-\d{2}$/.test(iso.trim())) return lastDayOf(`${iso.trim()}-01`, 'month');
  const m = ISO_DAY.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (precision === 'year') return `${m[1]}-12-31`;
  if (precision === 'month') {
    const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`;
  }
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Is this date (at its precision) wholly before the first event day? */
export function isBeforeFirstEventDay(iso: string | null | undefined, precision: FloorPrecision | null | undefined = 'day'): boolean {
  if (!iso) return false;
  const last = lastDayOf(iso, precision);
  return last !== null && last < FIRST_EVENT_DAY;
}

export type FloorInput = {
  /** The date being written (YYYY-MM-DD) — null clears it, which is always allowed. */
  date: string | null | undefined;
  precision?: FloorPrecision | null;
  /**
   * What the event holds now. An existing event's date that is NOT being changed
   * is never refused (owner: events that already exist are exempt "unless their
   * date is being changed"). Omit for a new event.
   */
  prior?: { date: string | null | undefined; precision?: unknown } | null;
  /** The founders' accounts (is_internal) may use any date. */
  exempt: boolean;
};

/**
 * The one rule. Returns the owner's message when the write must be refused,
 * null when it may go ahead.
 */
export function eventDateFloorRefusal(input: FloorInput): string | null {
  if (input.exempt) return null;
  const date = input.date ?? null;
  if (!date) return null;
  const precision = input.precision ?? 'day';
  const prior = input.prior ?? null;
  if (prior && (prior.date ?? null) === date && (prior.precision ?? 'day') === precision) return null;
  return isBeforeFirstEventDay(date, precision) ? EVENT_DATE_FLOOR_MESSAGE : null;
}

/**
 * The same rule over a list of proposed days — the candidate dates and the
 * date window a new event is created with. Any one before the first day refuses
 * the whole list (said once, beside the dates).
 */
export function eventDatesFloorRefusal(dates: ReadonlyArray<string | null | undefined>, exempt: boolean): string | null {
  for (const d of dates) {
    const r = eventDateFloorRefusal({ date: d, exempt });
    if (r) return r;
  }
  return null;
}

/**
 * The candidate days an event may still be NARROWED to (a supplier lock picks
 * the one left): the ones on or after the first event day. Who is exempt is only
 * asked when a candidate falls before it, so the common case costs no read.
 */
export async function candidatesOnOrAfterFirstEventDay(
  candidates: readonly string[],
  isExempt: () => Promise<boolean>,
): Promise<string[]> {
  if (!candidates.some((d) => isBeforeFirstEventDay(d))) return [...candidates];
  if (await isExempt().catch(() => false)) return [...candidates];
  return candidates.filter((d) => !isBeforeFirstEventDay(d));
}

/**
 * The `min` a date picker starts at: today for the founders, otherwise the
 * later of today and the first event day.
 */
export function eventDateMinFor(today: string, exempt: boolean): string {
  if (exempt) return today;
  return today > FIRST_EVENT_DAY ? today : FIRST_EVENT_DAY;
}

/* ── 📥 GUEST IMPORT OPENS DECEMBER 19 (owner 2026-11-02, DECISION_LOG "GUEST IMPORT OPENS DECEMBER 19, LIKE EVENT
   CREATION": *"importing guests will happen on december 19."* · *"just like event creation"*) ─────────────────────
   The same fixed day and the same message shape as the event floor above — a constant, never a setting. Before it, a
   normal account's guest import is refused on the server and the import door says so; the founders' accounts
   (`is_internal`) import now. Held by `guest-import-opens-dec-19.test.ts`. */

/** What the import door says before the day — the event floor's own words, for importing. */
export const GUEST_IMPORT_OPENS_MESSAGE =
  "Thank you for planning with Setnayan! Our very first event is our founders' wedding on December 18, 2026 — and we'd love for them to open the doors. Importing guests from a file opens on December 19, 2026. Until then, add your guests one at a time, and your file will be ready for that day.";

/** The one rule: the owner's message when an import must wait, null when it may go ahead. `today` is YYYY-MM-DD (Manila). */
export function guestImportRefusal(today: string, exempt: boolean): string | null {
  if (exempt) return null;
  return today < FIRST_EVENT_DAY ? GUEST_IMPORT_OPENS_MESSAGE : null;
}
