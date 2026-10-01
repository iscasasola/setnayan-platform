import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES, eventDatePrecisionOf, type EventDatePrecision } from './events';
import { fetchEventVendors, type EventVendorRow } from './vendors';
import { buildScheduleMatrix, schedulePicksFromVendors } from './schedule-matrix';
import { clashReason, clashesForMatrix, type DateClash } from './date-fits-booked';
import { routes } from './routes';
import { logQueryError } from './supabase/error-detect';

/**
 * 🗓 DOES A PICKED DAY OR MONTH CLASH WITH A BOOKED SUPPLIER? The server half of
 * `lib/date-fits-booked.ts`: the draft's save (`hubDraftAction`) asks it before
 * a date goes into the draft, so a clashing day or month is never accepted
 * (owner 2026-10-01) whichever door it came in by.
 *
 * Reuses the shipped availability read — `buildScheduleMatrix` over
 * `getBatchVendorAvailableDays`, the primitive the supplier Compare reads — and
 * never a second check. Only BOOKED suppliers (`CONFIRMED_VENDOR_STATUSES`) are
 * asked, so with none this costs one small read and answers null.
 *
 * Null = it fits (or cannot be checked — an unread supplier list is not a
 * clash; Apply's `eventDateRefusal`, fail-closed, is still the backstop).
 */
export type DatePickClash = { reason: string; clash: DateClash[] };

export async function datePickClash({
  supabase,
  admin,
  eventId,
  date,
  precision,
  live,
  failClosed = false,
}: {
  /** The couple's own session (RLS: their event_vendors). */
  supabase: SupabaseClient;
  /** Reads the suppliers' calendars (`vendor_calendar_blocks`). */
  admin: SupabaseClient;
  eventId: string;
  date: string;
  precision: EventDatePrecision;
  /** What is live now — picking it again is not a change, so it is not asked. */
  live: { date: string | null; precision: unknown };
  /**
   * The pick fails OPEN (an unread list is not a clash — Apply is the
   * backstop). Apply itself asks with `failClosed`: an unread supplier list or
   * calendar THROWS, so a date never goes live on a read that did not happen
   * (`lib/date-change.server.ts`).
   */
  failClosed?: boolean;
}): Promise<DatePickClash | null> {
  if (date === live.date && precision === (eventDatePrecisionOf(live.precision) ?? 'day')) return null;
  let booked: EventVendorRow[];
  try {
    booked = (await fetchEventVendors(supabase, eventId)).filter((v) =>
      (CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(v.status),
    );
  } catch (e) {
    if (failClosed) throw e;
    logQueryError('datePickClash.vendors', e as Error, { eventId }, 'graceful_degrade');
    return null;
  }
  if (booked.length === 0) return null;
  const matrix = await buildScheduleMatrix({ admin, eventDate: date, precision, picks: schedulePicksFromVendors(booked) }, { failClosed });
  const clashes = clashesForMatrix(matrix);
  if (clashes.length === 0) return null;
  return {
    reason: clashReason(
      clashes.map((c) => c.service),
      precision,
    ),
    clash: clashes.map((c) => ({
      vendorId: c.key,
      name: c.name,
      service: c.service,
      href: `${routes.dashboard.vendors.workspace(eventId, c.key)}?tab=chat`,
    })),
  };
}
