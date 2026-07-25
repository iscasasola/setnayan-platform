import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  freeTierBookingCapApplies,
  isAtFreeTierBookingCap,
} from './vendor-free-tier-booking-cap';
import { countDistinctBookedEvents } from './vendor-free-tier-booking-cap-ui';

/**
 * vendor-free-tier-booking-cap.server.ts — the server-side read behind the
 * couple-facing "Fully booked" pre-check.
 *
 * Mirrors `enforce_free_tier_booking_cap` (migrations 20271001120000 +
 * 20271005180000) EXACTLY so the friendly refusal and the hard DB guard can
 * never disagree:
 *   • the SAME master switch — `platform_settings.free_tier_booking_cap_enabled`
 *     (read here, not proxied through an env flag: an env flag cannot track a DB
 *     column, and every mismatch between the two was a real defect)
 *   • only MARKETPLACE vendors carry a tier (callers skip a NULL profile id)
 *   • ACTIVE = status ∈ (contracted, deposit_paid, delivered) — the confirmed
 *     set MINUS 'complete' (a finished event frees its slot)
 *   • the couple's OWN event is excluded from the count (the trigger's
 *     `ev.event_id <> NEW.event_id`), so re-locking on the same event is never
 *     counted against the vendor
 *   • ONE BOOKING = ONE EVENT — `COUNT(DISTINCT event_id)`, never rows. A couple
 *     who books a vendor for four services in one event holds ONE slot.
 *   • only free tiers are capped — `isAtFreeTierBookingCap` owns that rule
 *
 * FAILS OPEN. An unreadable switch, tier or count resolves to "not fully
 * booked". This is the opposite of the verified-gate's fail-closed stance and
 * is deliberate: the DB trigger is the authority, so a read hiccup here can only
 * ever mean the couple sees a slightly less friendly (still non-raw, see
 * `isFreeTierBookingCapError`) refusal — never a booking wrongly blocked.
 *
 * Pass a client that can read `vendor_profiles` for a NON-verified profile
 * (public RLS there is verified-only) — callers use the admin/service client,
 * having already proven the couple owns the booking.
 */

/**
 * How many active `event_vendors` rows to pull when counting distinct events.
 * A free-tier vendor is capped at 3 CONCURRENT events, so anything near this
 * bound already means "at the cap"; the ceiling exists only so a pathological
 * row count can never become a large payload. Fail-open by construction: a
 * truncated read can only ever UNDER-count.
 */
const ACTIVE_ROW_SCAN_LIMIT = 500;

/**
 * Is the cap actually armed? Reads the SAME `platform_settings` column the
 * trigger reads, so the pre-check refuses exactly when the trigger would.
 * Fails OPEN (false) on any read problem.
 */
export async function isFreeTierBookingCapArmed(
  admin: SupabaseClient,
): Promise<boolean> {
  try {
    const { data, error } = await admin
      .from('platform_settings')
      .select('free_tier_booking_cap_enabled')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return false;
    return (
      (data as { free_tier_booking_cap_enabled?: boolean | null })
        .free_tier_booking_cap_enabled === true
    );
  } catch {
    return false;
  }
}

export async function isMarketplaceVendorFullyBooked(
  admin: SupabaseClient,
  vendorProfileId: string,
  opts: { excludeEventId?: string | null } = {},
): Promise<boolean> {
  try {
    // Same master switch as the trigger. OFF → the trigger is inert, so the
    // pre-check must be inert too, or couples lose bookings to a cap that is
    // not enabled.
    if (!(await isFreeTierBookingCapArmed(admin))) return false;

    const { data: profile, error: profileErr } = await admin
      .from('vendor_profiles')
      .select('tier_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (profileErr || !profile) return false;
    const tier =
      (profile as { tier_state?: unknown }).tier_state == null
        ? null
        : String((profile as { tier_state?: unknown }).tier_state);

    // Paid tiers are unlimited — skip the count entirely.
    if (!freeTierBookingCapApplies(tier)) return false;

    let query = admin
      .from('event_vendors')
      .select('event_id')
      .eq('marketplace_vendor_id', vendorProfileId)
      .in('status', ['contracted', 'deposit_paid', 'delivered'])
      .limit(ACTIVE_ROW_SCAN_LIMIT);
    if (opts.excludeEventId) query = query.neq('event_id', opts.excludeEventId);

    const { data: rows, error: rowsErr } = await query;
    if (rowsErr || rows == null) return false;

    const distinctEvents = countDistinctBookedEvents(
      (rows as Array<{ event_id?: string | null }>).map((r) => r.event_id),
    );

    return isAtFreeTierBookingCap(tier, distinctEvents);
  } catch {
    return false;
  }
}
