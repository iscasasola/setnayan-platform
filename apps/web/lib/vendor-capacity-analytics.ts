/**
 * Capacity analytics reader (vendor "My Performance" · Phase B family 4).
 *
 * Bundles two ownership-gated SECURITY DEFINER RPCs (migration
 * 20270424213000_vendor_capacity_analytics_rpcs): waitlist depth (unmet demand)
 * and upcoming booked load. OWN-BUSINESS only. Pro tier
 * (canSeePerformanceAdvanced), page-enforced.
 *
 * A full utilization RATIO is deliberately NOT computed here — the
 * "available-day" denominator is an owner policy choice (whole month vs
 * future-only vs excluding closed/locked; booked = any-consumption vs
 * full-capacity), and a guessed ratio would drift from what couples see in
 * acquire_schedule_pools. These are raw, unambiguous counts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** One upcoming date with couples waiting on it. */
export type WaitlistDate = {
  date: string;
  waiting: number;
};

export type UpcomingLoad = {
  upcomingBookedDays: number;
  upcomingBookings: number;
  next30DaysBooked: number;
  next90DaysBooked: number;
};

export type CapacityAnalytics = {
  waitlist: WaitlistDate[];
  waitlistTotal: number;
  load: UpcomingLoad;
};

const EMPTY_LOAD: UpcomingLoad = {
  upcomingBookedDays: 0,
  upcomingBookings: 0,
  next30DaysBooked: 0,
  next90DaysBooked: 0,
};

export async function fetchVendorCapacityAnalytics(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<CapacityAnalytics> {
  const [waitRes, loadRes] = await Promise.all([
    supabase.rpc('vendor_waitlist_depth', { p_vendor_profile_id: vendorProfileId }),
    supabase.rpc('vendor_upcoming_load', { p_vendor_profile_id: vendorProfileId }),
  ]);

  if (waitRes.error) {
    // eslint-disable-next-line no-console
    console.error('[vendor-capacity-analytics] waitlist rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: waitRes.error.message,
    });
  }
  if (loadRes.error) {
    // eslint-disable-next-line no-console
    console.error('[vendor-capacity-analytics] load rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: loadRes.error.message,
    });
  }

  const waitRows = (waitRes.error ? [] : (waitRes.data ?? [])) as {
    requested_date: string;
    waiting: number | null;
  }[];
  const waitlist: WaitlistDate[] = waitRows.map((r) => ({
    date: r.requested_date,
    waiting: Number(r.waiting ?? 0),
  }));
  const waitlistTotal = waitlist.reduce((s, w) => s + w.waiting, 0);

  const loadRow = (loadRes.error ? null : ((loadRes.data ?? []) as Record<string, number | null>[])[0]) ?? null;
  const load: UpcomingLoad = loadRow
    ? {
        upcomingBookedDays: Number(loadRow.upcoming_booked_days ?? 0),
        upcomingBookings: Number(loadRow.upcoming_bookings ?? 0),
        next30DaysBooked: Number(loadRow.next_30_days_booked ?? 0),
        next90DaysBooked: Number(loadRow.next_90_days_booked ?? 0),
      }
    : EMPTY_LOAD;

  return { waitlist, waitlistTotal, load };
}
