/**
 * App-vs-Import ROI attribution reader (vendor "My Performance" page · Phase 6).
 *
 * Answers "did Setnayan earn its keep?" — how much of a vendor's BOOKED business
 * the platform sourced (marketplace search + auto-cascade up-sell) vs. business
 * the couple/admin brought in off-platform (manually added). Reads the
 * SECURITY DEFINER `vendor_source_attribution(p_vendor_profile_id, p_since)` RPC,
 * which enforces ownership (current_vendor_profile_ids) + booked-status scope in
 * SQL, so this surface only ever sees pre-aggregated per-class counts — never a
 * single couple.
 *
 * HONESTY (the peso ROI is partial by design):
 *   event_vendors.total_cost_php is nullable and vendors settle payment
 *   off-platform (0% commission, Setnayan Pay dormant), so a booking can be
 *   attributed by COUNT without a confirmed peso figure. When priced coverage is
 *   thin, the caller labels the revenue split "based on N of M bookings that have
 *   a confirmed price" rather than implying a complete ledger — and never
 *   fabricates a number for the unpriced remainder.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** The three attribution classes the RPC groups bookings into. */
export type AttributionClass = 'setnayan' | 'off_platform' | 'unattributed';

/** One RPC row — a class with its counts + summed confirmed revenue (PHP). */
export type SourceAttributionRow = {
  attribution: AttributionClass;
  bookingCount: number;
  pricedCount: number;
  revenuePhp: number;
};

/** The rolled-up attribution result the UI renders. */
export type SourceAttribution = {
  setnayan: SourceAttributionRow;
  offPlatform: SourceAttributionRow;
  unattributed: SourceAttributionRow;
  /** Total booked rows across all classes. */
  totalBookings: number;
  /** Total rows that carry a confirmed total_cost_php across all classes. */
  totalPriced: number;
  /** Total confirmed revenue (PHP) across all classes. */
  totalRevenuePhp: number;
  /**
   * Share of Setnayan-sourced bookings out of the ATTRIBUTED total
   * (setnayan + off_platform; unattributed excluded because we can't place it).
   * 0–100, or null when there are no attributed bookings yet.
   */
  setnayanBookingSharePct: number | null;
  /** Share of Setnayan-sourced confirmed revenue out of attributed revenue. 0–100 or null. */
  setnayanRevenueSharePct: number | null;
};

const EMPTY_ROW = (attribution: AttributionClass): SourceAttributionRow => ({
  attribution,
  bookingCount: 0,
  pricedCount: 0,
  revenuePhp: 0,
});

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/**
 * Fetch + roll up the app-vs-import ROI attribution for one vendor.
 *
 * @param supabase  RLS-scoped session client (the RPC is SECURITY DEFINER and
 *                  ownership-gates the caller internally).
 * @param vendorProfileId  The caller's own vendor profile id.
 * @param sinceIso  Optional lower bound on booking created_at (ISO string).
 * @returns the rolled-up attribution, or null on error (caller shows an empty
 *          state rather than crashing the page).
 */
export async function fetchVendorSourceAttribution(
  supabase: SupabaseClient,
  vendorProfileId: string,
  sinceIso?: string | null,
): Promise<SourceAttribution | null> {
  const { data, error } = await supabase.rpc('vendor_source_attribution', {
    p_vendor_profile_id: vendorProfileId,
    p_since: sinceIso ?? null,
  });

  if (error) {
    // Non-fatal — the page degrades to an empty ROI panel. Logged for Sentry.
    // eslint-disable-next-line no-console
    console.error('[vendor-source-attribution] rpc failed', {
      vendor_profile_id: vendorProfileId,
      error: error.message,
    });
    return null;
  }

  const rows = (data ?? []) as {
    attribution: string;
    booking_count: number | null;
    priced_count: number | null;
    revenue_php: number | string | null;
  }[];

  const byClass: Record<AttributionClass, SourceAttributionRow> = {
    setnayan: EMPTY_ROW('setnayan'),
    off_platform: EMPTY_ROW('off_platform'),
    unattributed: EMPTY_ROW('unattributed'),
  };

  for (const r of rows) {
    const cls = r.attribution as AttributionClass;
    if (cls !== 'setnayan' && cls !== 'off_platform' && cls !== 'unattributed') {
      continue;
    }
    byClass[cls] = {
      attribution: cls,
      bookingCount: Number(r.booking_count ?? 0),
      pricedCount: Number(r.priced_count ?? 0),
      revenuePhp: Number(r.revenue_php ?? 0),
    };
  }

  const setnayan = byClass.setnayan;
  const offPlatform = byClass.off_platform;
  const unattributed = byClass.unattributed;

  const totalBookings =
    setnayan.bookingCount + offPlatform.bookingCount + unattributed.bookingCount;
  const totalPriced =
    setnayan.pricedCount + offPlatform.pricedCount + unattributed.pricedCount;
  const totalRevenuePhp =
    setnayan.revenuePhp + offPlatform.revenuePhp + unattributed.revenuePhp;

  // Attributed = the rows we can actually place (exclude unattributed legacy).
  const attributedBookings = setnayan.bookingCount + offPlatform.bookingCount;
  const attributedRevenue = setnayan.revenuePhp + offPlatform.revenuePhp;

  return {
    setnayan,
    offPlatform,
    unattributed,
    totalBookings,
    totalPriced,
    totalRevenuePhp,
    setnayanBookingSharePct: pct(setnayan.bookingCount, attributedBookings),
    setnayanRevenueSharePct: pct(setnayan.revenuePhp, attributedRevenue),
  };
}
