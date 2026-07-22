/**
 * Admin Peso-Per-Lead overview reader (platform unit economics).
 *
 * Assembles the platform-wide cost-per-lead and cost-per-booked-couple for the
 * admin app-performance surface, from the reporting RPC in
 * 20270322391018_peso_per_lead_scorecard.sql:
 *   • admin_peso_per_lead_overview(p_period_days)  — is_console_admin-gated
 *
 * WHERE THE ₱/TOKEN PRICE COMES FROM (NOT hardcoded here)
 * ------------------------------------------------------
 * The RPC returns token COUNTS (tokens_burned_total). The peso value of a token
 * is the admin-managed flat price `TOKEN_PRICE_PHP` from lib/v2/region-token-burn.ts
 * (₱200 today), read from there so the price has ONE source of truth. Subscription
 * spend already arrives as real PHP from vendor_subscriptions.
 *
 * ⚠ ANSWERING IS NOW FREE (2026-07-22)
 * ------------------------------------
 * Migration 20270909586177 neutralised the token burn in `unlock_vendor_event`
 * (v_tokens forced to 0), so accepting an inquiry no longer costs a token —
 * `tokens_burned_total` is 0 going forward and token-spend reads ₱0. The
 * `burnInert` flag ("₱0 token spend in the window") is therefore effectively
 * always true now; this reader still surfaces real subscription spend truthfully
 * and never fabricates spend. (The token packs were also retired the same day.)
 *
 * The vendor-side self-scorecard (`fetchVendorPesoScorecard`) + its dashboard card
 * were REMOVED 2026-07-22 — orphaned (never mounted) and premised on the now-dead
 * burn-on-answer model. Only the admin overview below remains. ⚠ Whether this
 * admin surface should stay (token spend is now structurally ₱0) is an owner call.
 */

import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { TOKEN_PRICE_PHP } from '@/lib/v2/region-token-burn';

/** Re-export so a UI can cite the admin-managed price without re-importing the burn module. */
export { TOKEN_PRICE_PHP };

/** Default reporting window — one 28-day billing cycle. */
export const PESO_DEFAULT_PERIOD_DAYS = 28;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One row of the admin platform-wide overview (peso-resolved). */
export type AdminPesoRow = {
  vendorProfileId: string;
  businessName: string;
  tierState: string | null;
  tokensBurnedTotal: number;
  tokenSpendPhp: number;
  subscriptionSpendPhp: number;
  totalSpendPhp: number;
  leadsAnswered: number;
  finalizedBookings: number;
  costPerBookedCouplePhp: number | null;
};

/** Platform-level totals across all active vendors, for the admin card header. */
export type AdminPesoOverview = {
  periodDays: number;
  tokenPricePhp: number;
  rows: AdminPesoRow[];
  totals: {
    vendors: number;
    tokensBurnedTotal: number;
    tokenSpendPhp: number;
    subscriptionSpendPhp: number;
    totalSpendPhp: number;
    leadsAnswered: number;
    finalizedBookings: number;
    /** Blended platform cost-per-booked-couple. null when 0 bookings. */
    costPerBookedCouplePhp: number | null;
  };
  /** TRUE when NO vendor has any token-burn spend (now structurally the case). */
  burnInert: boolean;
};

type AdminPesoRpcRow = {
  vendor_profile_id: string;
  business_name: string;
  tier_state: string | null;
  tokens_burned_total: number;
  leads_answered: number;
  subscription_php: number;
  finalized_bookings: number;
};

/**
 * Read the admin platform-wide unit-economics overview. Uses the service-role
 * admin client; the RPC still self-gates on is_console_admin(), but the
 * /admin layout already 404s non-admins before this page renders, so this runs
 * only for admins. Returns an empty overview on error (card renders an empty
 * state rather than throwing).
 */
export async function fetchAdminPesoOverview(
  periodDays: number = PESO_DEFAULT_PERIOD_DAYS,
): Promise<AdminPesoOverview> {
  const empty: AdminPesoOverview = {
    periodDays,
    tokenPricePhp: TOKEN_PRICE_PHP,
    rows: [],
    totals: {
      vendors: 0,
      tokensBurnedTotal: 0,
      tokenSpendPhp: 0,
      subscriptionSpendPhp: 0,
      totalSpendPhp: 0,
      leadsAnswered: 0,
      finalizedBookings: 0,
      costPerBookedCouplePhp: null,
    },
    burnInert: true,
  };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admin_peso_per_lead_overview', {
    p_period_days: periodDays,
  });
  if (error || !data) return empty;

  const rows: AdminPesoRow[] = (data as AdminPesoRpcRow[]).map((r) => {
    const tokensBurnedTotal = Number(r.tokens_burned_total) || 0;
    const tokenSpendPhp = round2(tokensBurnedTotal * TOKEN_PRICE_PHP);
    const subscriptionSpendPhp = round2(Number(r.subscription_php) || 0);
    const totalSpendPhp = round2(tokenSpendPhp + subscriptionSpendPhp);
    const finalizedBookings = Number(r.finalized_bookings) || 0;
    return {
      vendorProfileId: r.vendor_profile_id,
      businessName: r.business_name,
      tierState: r.tier_state,
      tokensBurnedTotal,
      tokenSpendPhp,
      subscriptionSpendPhp,
      totalSpendPhp,
      leadsAnswered: Number(r.leads_answered) || 0,
      finalizedBookings,
      costPerBookedCouplePhp:
        finalizedBookings > 0 ? round2(totalSpendPhp / finalizedBookings) : null,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.tokensBurnedTotal += r.tokensBurnedTotal;
      acc.tokenSpendPhp += r.tokenSpendPhp;
      acc.subscriptionSpendPhp += r.subscriptionSpendPhp;
      acc.totalSpendPhp += r.totalSpendPhp;
      acc.leadsAnswered += r.leadsAnswered;
      acc.finalizedBookings += r.finalizedBookings;
      return acc;
    },
    {
      tokensBurnedTotal: 0,
      tokenSpendPhp: 0,
      subscriptionSpendPhp: 0,
      totalSpendPhp: 0,
      leadsAnswered: 0,
      finalizedBookings: 0,
    },
  );

  const totalSpendPhp = round2(totals.totalSpendPhp);

  return {
    periodDays,
    tokenPricePhp: TOKEN_PRICE_PHP,
    rows,
    totals: {
      vendors: rows.length,
      tokensBurnedTotal: totals.tokensBurnedTotal,
      tokenSpendPhp: round2(totals.tokenSpendPhp),
      subscriptionSpendPhp: round2(totals.subscriptionSpendPhp),
      totalSpendPhp,
      leadsAnswered: totals.leadsAnswered,
      finalizedBookings: totals.finalizedBookings,
      costPerBookedCouplePhp:
        totals.finalizedBookings > 0
          ? round2(totalSpendPhp / totals.finalizedBookings)
          : null,
    },
    burnInert: round2(totals.tokenSpendPhp) === 0,
  };
}
