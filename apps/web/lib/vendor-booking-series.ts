/**
 * Per-month booked-business series reader (vendor "My Performance" Momentum
 * chart · monthly bookings bars + earnings sparkline).
 *
 * Wraps the SECURITY DEFINER `vendor_booking_monthly_series(p_vendor_profile_id,
 * p_months)` RPC (see 20270405896838_vendor_booking_monthly_series_rpc.sql),
 * which enforces ownership (current_vendor_profile_ids) and the shared "booked"
 * status definition in SQL, and zero-fills empty months via generate_series so
 * the chart has a stable x-axis.
 *
 * HONESTY: revenuePhp is partial by design (total_cost_php is nullable; vendors
 * settle off-platform). The Momentum card labels the earnings line as confirmed
 * booked revenue only and never fabricates the unpriced remainder.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** One month of the series. `month` is the first-of-month ISO date ('2026-07-01'). */
export type BookingMonthPoint = {
  month: string;
  /** Short axis label, e.g. 'Jul'. */
  label: string;
  bookings: number;
  revenuePhp: number;
};

/** One day of the daily series. `day` is the ISO date ('2026-07-01'). */
export type BookingDayPoint = {
  day: string;
  /** Short axis label, e.g. '1 Jul'. */
  label: string;
  bookings: number;
  revenuePhp: number;
};

const AXIS_FMT = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  timeZone: 'UTC',
});

const DAY_AXIS_FMT = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** '1 Jul' for an ISO date string; falls back to the raw value. */
function dayAxisLabel(dayIso: string): string {
  const d = new Date(`${dayIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dayIso;
  return DAY_AXIS_FMT.format(d);
}

/** 'Jul' for a first-of-month date string; falls back to the raw value. */
function axisLabel(monthIso: string): string {
  const d = new Date(`${monthIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return monthIso;
  return AXIS_FMT.format(d);
}

/**
 * Fetch the caller's last-`months` booked series (default 12). Returns [] on
 * error — the chart degrades to an honest empty state rather than crashing the
 * page.
 *
 * @param supabase  RLS-scoped session client (the RPC is SECURITY DEFINER and
 *                  ownership-gates the caller internally).
 * @param vendorProfileId  The caller's own vendor profile id.
 * @param months  Trailing month count (clamped 1..24 in SQL).
 */
export async function fetchVendorBookingSeries(
  supabase: SupabaseClient,
  vendorProfileId: string,
  months = 12,
): Promise<BookingMonthPoint[]> {
  const { data, error } = await supabase.rpc('vendor_booking_monthly_series', {
    p_vendor_profile_id: vendorProfileId,
    p_months: months,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[vendor-booking-series] rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: error.message,
    });
    return [];
  }

  const rows = (data ?? []) as {
    month_start: string;
    booking_count: number | null;
    revenue_php: number | string | null;
  }[];

  return rows.map((r) => ({
    month: r.month_start,
    label: axisLabel(r.month_start),
    bookings: Number(r.booking_count ?? 0),
    revenuePhp: Number(r.revenue_php ?? 0),
  }));
}

/**
 * Fetch the caller's last-`days` booked series (default 30, clamped 1..90 in
 * SQL). Returns [] on error — the Daily chart degrades to an honest empty state
 * rather than crashing the page.
 *
 * Own-business only (owner 2026-07-01 "also plot daily"): the RPC is SECURITY
 * DEFINER and ownership-gates the caller internally, so daily granularity is
 * privacy-safe — this never touches the cross-business market-intel surface.
 *
 * @param supabase  RLS-scoped session client.
 * @param vendorProfileId  The caller's own vendor profile id.
 * @param days  Trailing day count (clamped 1..90 in SQL).
 */
export async function fetchVendorBookingDailySeries(
  supabase: SupabaseClient,
  vendorProfileId: string,
  days = 30,
): Promise<BookingDayPoint[]> {
  const { data, error } = await supabase.rpc('vendor_booking_daily_series', {
    p_vendor_profile_id: vendorProfileId,
    p_days: days,
  });

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[vendor-booking-series] daily rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: error.message,
    });
    return [];
  }

  const rows = (data ?? []) as {
    day_start: string;
    booking_count: number | null;
    revenue_php: number | string | null;
  }[];

  return rows.map((r) => ({
    day: r.day_start,
    label: dayAxisLabel(r.day_start),
    bookings: Number(r.booking_count ?? 0),
    revenuePhp: Number(r.revenue_php ?? 0),
  }));
}
