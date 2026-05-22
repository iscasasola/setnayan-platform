/**
 * Vendor calendar intersection — Task #39 (2026-05-22).
 *
 * When a host is at year/month precision with confirmed vendors, surface
 * the set of days inside the precision window where NO confirmed vendor
 * has a calendar block. This is the value-add of the tiered date model:
 * the host can SEE which specific days work across their booked vendors
 * and narrow to a specific day with confidence.
 *
 * The query reads `event_vendors.marketplace_vendor_id` to resolve which
 * marketplace `vendor_profile_id`s back the event's confirmed bookings,
 * then reads `vendor_calendar_blocks` for those profiles within the
 * range and computes the day-wise intersection.
 *
 * RLS scope: the calling client is the user-scoped server Supabase
 * client; existing 0006 policies on `event_vendors` + 0016 policies on
 * `vendor_calendar_blocks` gate access (host can read their event's
 * vendors; couples on a related event can read those vendors' blocks
 * per the 0022 § 2.3 RLS policy).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { CONFIRMED_VENDOR_STATUSES } from './events';

export type AvailabilityResult = {
  /** Number of confirmed vendors counted for the intersection. */
  confirmedVendorCount: number;
  /** Days inside the precision window that no confirmed vendor blocks. */
  availableDays: Date[];
  /** Total days inside the range — used by UI to choose empty/small/large rendering. */
  totalDaysInRange: number;
};

/**
 * Compute the precision window (year / month) as a [start, end] day pair.
 * Year='2027' → Jan 1 – Dec 31 2027. Month='Aug 2027' → Aug 1 – Aug 31 2027.
 * Day is not a valid input (intersection only fires at year/month precision).
 */
export function rangeFromPrecision(
  iso: string,
  precision: 'year' | 'month',
): { start: Date; end: Date } | null {
  const [yearStr, monthStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year) return null;

  if (precision === 'year') {
    return {
      start: new Date(year, 0, 1),
      end: new Date(year, 11, 31),
    };
  }
  if (!month) return null;
  // Last day of month: day 0 of next month.
  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 0),
  };
}

/**
 * Returns the set of days in [rangeStart, rangeEnd] where NO confirmed
 * vendor on this event has a calendar block. Days are returned as Date
 * objects normalized to midnight local time.
 *
 * Empty result (availableDays.length === 0) means the intersection is
 * empty — the host needs to widen the window or release a vendor.
 */
export async function getCommonAvailableDays(
  supabase: SupabaseClient,
  eventId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<AvailabilityResult> {
  const totalDaysInRange = daysBetween(rangeStart, rangeEnd) + 1;
  const empty: AvailabilityResult = {
    confirmedVendorCount: 0,
    availableDays: [],
    totalDaysInRange,
  };

  // Step 1 — resolve confirmed vendors. We want event_vendors rows whose
  // status is at-or-past contracted AND that link to a marketplace vendor
  // (vendor_calendar_blocks only exists on marketplace vendors; manually
  // encoded vendors without marketplace_vendor_id can't contribute a block).
  const { data: vendors, error: vendorsErr } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);

  if (vendorsErr) return empty;

  const profileIds = (vendors ?? [])
    .map((row) => (row as { marketplace_vendor_id: string | null }).marketplace_vendor_id)
    .filter((id): id is string => Boolean(id));

  if (profileIds.length === 0) {
    return empty;
  }

  // Step 2 — pull all blocks in range across these vendor_profile_ids.
  // RLS on vendor_calendar_blocks (0022 § 2.3) permits reads for event
  // members whose event has an active booking against the vendor; the
  // user-scoped client carries the host's session so this filters
  // correctly.
  const { data: blocks, error: blocksErr } = await supabase
    .from('vendor_calendar_blocks')
    .select('vendor_profile_id, blocked_at, blocked_until')
    .in('vendor_profile_id', profileIds)
    .lte('blocked_at', rangeEnd.toISOString())
    .gte('blocked_until', rangeStart.toISOString());

  if (blocksErr) {
    // On error, return zero available days but report the vendor count
    // honestly so the UI doesn't pretend availability is wide-open.
    return { ...empty, confirmedVendorCount: profileIds.length };
  }

  // Step 3 — build a Set of blocked-day keys across all confirmed vendors.
  // Any day blocked by ANY single confirmed vendor disqualifies that day
  // from the intersection (the goal is days that work for ALL of them).
  const blockedDays = new Set<string>();
  for (const block of blocks ?? []) {
    const b = block as { blocked_at: string; blocked_until: string };
    const start = new Date(b.blocked_at);
    const end = new Date(b.blocked_until);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    // Walk each day in [start, end]. blocked_until is the exclusive end
    // (vendor block 09:00-12:00 still occupies one calendar day), so we
    // iterate calendar days and key them YYYY-MM-DD.
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const finalDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= finalDay) {
      blockedDays.add(dayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Step 4 — walk every day in [rangeStart, rangeEnd] and collect the
  // ones that are NOT in blockedDays. Cursor uses Date.setDate which
  // handles month boundaries correctly.
  const available: Date[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  const last = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
  while (cursor <= last) {
    if (!blockedDays.has(dayKey(cursor))) {
      available.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    confirmedVendorCount: profileIds.length,
    availableDays: available,
    totalDaysInRange,
  };
}

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  const startOfA = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const startOfB = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  const ms = startOfB.getTime() - startOfA.getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Format a Date as the YYYY-MM-DD string the DB stores in event_date.
 * Used by the intersection panel's "pick this day" CTA so the saved
 * placeholder is the actual chosen day at day precision.
 */
export function formatDayKey(d: Date): string {
  return dayKey(d);
}
