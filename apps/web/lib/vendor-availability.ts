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

// ---------------------------------------------------------------------------
// Task #45 (2026-05-22) — marketplace calendar intersection filter helpers.
// Owner-locked design: candidate vendors browsed via /vendors are filtered
// against the host's commonAvailability across all confirmed-vendor calendars.
// The dashboard surface above operates on year/month only (the refinement
// flow); the marketplace surface operates on year, month, AND day (every
// candidate must share ≥1 free day with the locked vendors).
//
// N+1 query cost RETIRED 2026-05-30 (PR #680 · pre-pilot audit followup):
// `filterVendorsByAvailabilityIntersection` now batches the calendar read
// for all candidate vendors into a single Supabase round trip via
// `getBatchVendorAvailableDays`. Per-vendor intersection logic still runs
// client-side (Set semantics are clearer in JS than SQL EXCEPT) but the
// round-trip count is now O(1) instead of O(candidates).
// ---------------------------------------------------------------------------

// Re-exported from lib/events for downstream importers that only consume
// the marketplace surface — keeps `EventDatePrecision` a single source of
// truth (defined in lib/events.ts line 185).
export type { EventDatePrecision } from './events';
import type { EventDatePrecision as _EDP } from './events';

/**
 * Compute the host's candidate-day window from event_date + precision.
 * Day mode collapses to a single day; year/month delegate to the same logic
 * the dashboard intersection panel uses.
 *
 * Returns null when event_date is malformed (defensive — callers fall back
 * to no filter rather than crashing the marketplace).
 */
export function computeCandidateWindow(
  eventDate: string,
  precision: _EDP,
): { start: Date; end: Date } | null {
  if (precision === 'day') {
    const [yearStr, monthStr, dayStr] = eventDate.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (!year || !month || !day) return null;
    const single = new Date(year, month - 1, day);
    return { start: single, end: single };
  }
  return rangeFromPrecision(eventDate, precision);
}

/**
 * Build the set of YYYY-MM-DD keys spanning [start, end] inclusive.
 * Used to convert a candidate window into the same set shape the
 * intersection logic produces, so set ops compose cleanly.
 */
export function dayKeySetFromWindow(start: Date, end: Date): Set<string> {
  const keys = new Set<string>();
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor <= last) {
    keys.add(dayKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

/**
 * Resolve the set of YYYY-MM-DD keys a single vendor has AVAILABLE inside
 * [rangeStart, rangeEnd]. Reads vendor_calendar_blocks for that vendor in
 * range, walks each block to mark every blocked calendar day, then returns
 * windowDays minus blockedDays.
 *
 * Returns the full window when the vendor has zero blocks — vendor with no
 * declared calendar is treated as fully available (the V1 default; vendors
 * upgrade their calendar discipline as they ship more events).
 */
export async function getVendorAvailableDays(
  supabase: SupabaseClient,
  vendorProfileId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Set<string>> {
  const windowKeys = dayKeySetFromWindow(rangeStart, rangeEnd);
  if (windowKeys.size === 0) return windowKeys;

  const { data: blocks, error } = await supabase
    .from('vendor_calendar_blocks')
    .select('blocked_at, blocked_until')
    .eq('vendor_profile_id', vendorProfileId)
    .lte('blocked_at', rangeEnd.toISOString())
    .gte('blocked_until', rangeStart.toISOString());

  // On error, return the unfiltered window. The marketplace will still
  // surface the vendor; the locked-vendor intersection on the parent helper
  // is the load-bearing gate (the candidate-vendor filter only narrows
  // further). Failing-open keeps the marketplace usable when calendar
  // queries flake.
  if (error) return windowKeys;

  const blockedDays = new Set<string>();
  for (const block of blocks ?? []) {
    const b = block as { blocked_at: string; blocked_until: string };
    const start = new Date(b.blocked_at);
    const end = new Date(b.blocked_until);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const finalDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= finalDay) {
      blockedDays.add(dayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const available = new Set<string>();
  for (const k of windowKeys) {
    if (!blockedDays.has(k)) available.add(k);
  }
  return available;
}

/**
 * Resolve commonAvailability across all CONFIRMED vendors on an event.
 * Intersection of every confirmed vendor's available-day set inside
 * [rangeStart, rangeEnd]. When 0 confirmed vendors → returns the full
 * window (no filter applied to the marketplace).
 *
 * Empty result (size 0) WITH lockedCount > 0 → conflict state. Callers
 * read `lockedCount` from the return to disambiguate "no filter" from
 * "intersection is empty".
 *
 * Uses the admin Supabase client because the marketplace surface is
 * public + the read crosses event scope (a coordinator could be browsing
 * for a couple they delegate-manage). Existing 0022 § 2.3 RLS on
 * vendor_calendar_blocks would otherwise gate per-viewer.
 */
export async function getEventCommonAvailability(
  supabase: SupabaseClient,
  eventId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<{ commonAvailability: Set<string>; lockedCount: number }> {
  const windowKeys = dayKeySetFromWindow(rangeStart, rangeEnd);

  const { data: locked, error } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);

  if (error) {
    // Defensive: no filter on read error. The marketplace stays browsable.
    return { commonAvailability: windowKeys, lockedCount: 0 };
  }

  const profileIds = (locked ?? [])
    .map((row) => (row as { marketplace_vendor_id: string | null }).marketplace_vendor_id)
    .filter((id): id is string => Boolean(id));

  if (profileIds.length === 0) {
    return { commonAvailability: windowKeys, lockedCount: 0 };
  }

  let intersection: Set<string> | null = null;
  for (const vendorProfileId of profileIds) {
    const vendorDays = await getVendorAvailableDays(
      supabase,
      vendorProfileId,
      rangeStart,
      rangeEnd,
    );
    if (intersection === null) {
      intersection = vendorDays;
    } else {
      const next = new Set<string>();
      for (const k of intersection) {
        if (vendorDays.has(k)) next.add(k);
      }
      intersection = next;
    }
    if (intersection.size === 0) {
      // Short-circuit — no further vendor can re-add days to an empty
      // intersection. Save N-1 roundtrips when conflict is detected early.
      return { commonAvailability: new Set(), lockedCount: profileIds.length };
    }
  }

  return {
    commonAvailability: intersection ?? new Set(),
    lockedCount: profileIds.length,
  };
}

/**
 * Filter candidate vendor IDs to those whose availableDays intersect
 * commonAvailability. Vendor stays in the result iff at least one day
 * inside the candidate window is BOTH free for them AND in the locked
 * vendors' intersection.
 *
 * When commonAvailability is empty (conflict state) → returns empty
 * array (no candidate can satisfy zero shared days).
 *
 * Pre-pilot audit followup 2026-05-30 (PR #680): refactored from N+1 to
 * a single batched fetch via `getBatchVendorAvailableDays` below. The
 * intersection logic still runs per-vendor client-side (Set semantics
 * are clearer in JS than SQL EXCEPT for the windowKeys ∖ blocked path)
 * but the round-trip count drops from O(candidates) to O(1). Failing-
 * open semantics preserved — on read error, every candidate keeps the
 * full window so the marketplace stays usable.
 *
 * At pilot scale (~handful of locked vendors, <50 candidates per page)
 * the per-render latency drops from ~N × 50ms = 2.5s to ~50ms.
 */
export async function filterVendorsByAvailabilityIntersection(
  supabase: SupabaseClient,
  candidateVendorProfileIds: string[],
  commonAvailability: Set<string>,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Set<string>> {
  const result = new Set<string>();
  if (commonAvailability.size === 0) return result;
  if (candidateVendorProfileIds.length === 0) return result;

  const daysByVendor = await getBatchVendorAvailableDays(
    supabase,
    candidateVendorProfileIds,
    rangeStart,
    rangeEnd,
  );

  for (const vendorProfileId of candidateVendorProfileIds) {
    const days = daysByVendor.get(vendorProfileId) ?? new Set<string>();
    for (const k of days) {
      if (commonAvailability.has(k)) {
        result.add(vendorProfileId);
        break;
      }
    }
  }
  return result;
}

/**
 * Batched sibling of `getVendorAvailableDays` — one Supabase read for the
 * entire candidate vendor list, then group blocks by vendor + compute
 * each vendor's available day set client-side using the same windowKeys
 * ∖ blockedDays semantics as the single-vendor helper.
 *
 * Returns a Map keyed by vendor_profile_id. Vendors with zero blocks in
 * range get the full window. Vendors not present in the input array
 * never appear in the result. On Supabase error, every input vendor
 * receives the full window (failing-open per the parent helper's
 * documented contract — marketplace stays browsable even when the
 * calendar table flakes).
 *
 * Added 2026-05-30 (PR #680) to retire the N+1 TODO at
 * `filterVendorsByAvailabilityIntersection` above. Same correctness
 * as N calls to `getVendorAvailableDays`; one round trip.
 */
async function getBatchVendorAvailableDays(
  supabase: SupabaseClient,
  vendorProfileIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  const windowKeys = dayKeySetFromWindow(rangeStart, rangeEnd);
  if (windowKeys.size === 0 || vendorProfileIds.length === 0) {
    return result;
  }

  const { data: blocks, error } = await supabase
    .from('vendor_calendar_blocks')
    .select('vendor_profile_id, blocked_at, blocked_until')
    .in('vendor_profile_id', vendorProfileIds)
    .lte('blocked_at', rangeEnd.toISOString())
    .gte('blocked_until', rangeStart.toISOString());

  // Failing-open: on read error every input vendor gets the full window.
  // Mirrors the single-vendor helper's contract — the marketplace stays
  // browsable when the calendar table flakes; the locked-vendor
  // intersection on the parent helper is the load-bearing gate.
  if (error) {
    for (const id of vendorProfileIds) {
      result.set(id, new Set(windowKeys));
    }
    return result;
  }

  // Group blocks by vendor_profile_id, expanding each block range into
  // its constituent day keys. Same expansion logic as the single-vendor
  // helper at getVendorAvailableDays above.
  const blockedByVendor = new Map<string, Set<string>>();
  for (const block of blocks ?? []) {
    const b = block as {
      vendor_profile_id: string;
      blocked_at: string;
      blocked_until: string;
    };
    const start = new Date(b.blocked_at);
    const end = new Date(b.blocked_until);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    let set = blockedByVendor.get(b.vendor_profile_id);
    if (!set) {
      set = new Set<string>();
      blockedByVendor.set(b.vendor_profile_id, set);
    }
    const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const finalDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cursor <= finalDay) {
      set.add(dayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Compute windowKeys ∖ blockedDays per vendor. Vendors with no blocks
  // get the full window (V1 default — undeclared calendar = fully
  // available, same as single-vendor helper).
  for (const vendorProfileId of vendorProfileIds) {
    const blocked = blockedByVendor.get(vendorProfileId);
    if (!blocked || blocked.size === 0) {
      result.set(vendorProfileId, new Set(windowKeys));
      continue;
    }
    const available = new Set<string>();
    for (const k of windowKeys) {
      if (!blocked.has(k)) available.add(k);
    }
    result.set(vendorProfileId, available);
  }

  return result;
}
