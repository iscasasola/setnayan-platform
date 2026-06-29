/**
 * Peso-Per-Lead Scorecard reader (Wave 6 vendor benefit · unit economics).
 *
 * Assembles a vendor's — or, for admins, the whole platform's — cost-per-lead
 * and cost-per-booked-couple from the two reporting RPCs added in
 * 20270322391018_peso_per_lead_scorecard.sql:
 *   • vendor_peso_per_lead(p_vendor_profile_id, p_period_days)  — ownership-gated
 *   • admin_peso_per_lead_overview(p_period_days)               — is_console_admin-gated
 *
 * WHERE THE ₱/TOKEN PRICE COMES FROM (NOT hardcoded here)
 * ------------------------------------------------------
 * The RPCs return token COUNTS (tokens_burned_total). The peso value of a token
 * is the admin-managed, owner-locked flat price `TOKEN_PRICE_PHP` exported from
 * lib/v2/region-token-burn.ts (₱100 today). We read it from there so the price
 * has ONE source of truth across the app — this module never inlines a literal.
 * Subscription spend already arrives as real PHP from vendor_subscriptions.
 *
 * BEHAVIORAL HONESTY — "burn is economically inert in the pilot"
 * -------------------------------------------------------------
 * The burn-on-answer path (region-token-burn.ts · unlock_vendor_event) is NOT
 * charged in the pilot — the consume call is a deliberate post-pilot activation.
 * So `tokens_burned_total` is 0 in prod today, token spend resolves to ₱0, and
 * cost-per-lead is ₱0 until burn activates. This reader surfaces that truthfully
 * via `burnInert` / `tokenSpendInert` flags — it NEVER fabricates spend. The UI
 * shows a "burn is inert in pilot → ₱0/lead until activated" note when spend=0.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { TOKEN_PRICE_PHP } from '@/lib/v2/region-token-burn';

/** Re-export so a UI can cite the admin-managed price without re-importing the burn module. */
export { TOKEN_PRICE_PHP };

/** Default reporting window — one 28-day billing cycle. */
export const PESO_DEFAULT_PERIOD_DAYS = 28;

/** Raw counts as returned by `vendor_peso_per_lead` (pre-multiply). */
type VendorPesoRpcRow = {
  period_days: number;
  since: string;
  tokens_burned_total: number;
  leads_answered: number;
  subscription_php: number;
  finalized_bookings: number;
};

/** A vendor's assembled scorecard (peso-resolved + derived ratios). */
export type VendorPesoScorecard = {
  periodDays: number;
  since: string;
  tokenPricePhp: number;
  /** Σ(tokens_burned) over the window. 0 in pilot (burn inert). */
  tokensBurnedTotal: number;
  /** tokensBurnedTotal × tokenPricePhp. ₱0 in pilot. */
  tokenSpendPhp: number;
  /** Real PHP from paid subscription orders in the window. */
  subscriptionSpendPhp: number;
  /** tokenSpendPhp + subscriptionSpendPhp. */
  totalSpendPhp: number;
  /** Count of vendor_event_unlocks (answered inquiries) in the window. */
  leadsAnswered: number;
  /** Lifetime finalized_booking_count (NOT window-scoped — labelled as such). */
  finalizedBookings: number;
  /** totalSpendPhp ÷ finalizedBookings, or null when 0 bookings. */
  costPerBookedCouplePhp: number | null;
  /** tokenSpendPhp ÷ leadsAnswered — the marginal peso-per-lead. null when 0 leads. */
  costPerLeadPhp: number | null;
  /** All-in (token + subscription) ÷ leadsAnswered. null when 0 leads. */
  allInCostPerLeadPhp: number | null;
  /** TRUE when token burn produced ₱0 — the pilot reality (burn not charged). */
  burnInert: boolean;
  /** TRUE when there is no spend at all (token OR subscription) to report. */
  noSpendYet: boolean;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Turn the RPC counts into a peso-resolved scorecard (price read from DB const). */
function assembleScorecard(row: VendorPesoRpcRow): VendorPesoScorecard {
  const tokensBurnedTotal = Number(row.tokens_burned_total) || 0;
  const subscriptionSpendPhp = round2(Number(row.subscription_php) || 0);
  const leadsAnswered = Number(row.leads_answered) || 0;
  const finalizedBookings = Number(row.finalized_bookings) || 0;

  const tokenSpendPhp = round2(tokensBurnedTotal * TOKEN_PRICE_PHP);
  const totalSpendPhp = round2(tokenSpendPhp + subscriptionSpendPhp);

  return {
    periodDays: Number(row.period_days) || PESO_DEFAULT_PERIOD_DAYS,
    since: row.since,
    tokenPricePhp: TOKEN_PRICE_PHP,
    tokensBurnedTotal,
    tokenSpendPhp,
    subscriptionSpendPhp,
    totalSpendPhp,
    leadsAnswered,
    finalizedBookings,
    costPerBookedCouplePhp:
      finalizedBookings > 0 ? round2(totalSpendPhp / finalizedBookings) : null,
    costPerLeadPhp: leadsAnswered > 0 ? round2(tokenSpendPhp / leadsAnswered) : null,
    allInCostPerLeadPhp:
      leadsAnswered > 0 ? round2(totalSpendPhp / leadsAnswered) : null,
    // Burn is inert whenever no tokens were actually burned to peso value —
    // the pilot truth (the consume call isn't wired yet).
    burnInert: tokenSpendPhp === 0,
    noSpendYet: totalSpendPhp === 0,
  };
}

/**
 * Read a vendor's OWN scorecard. Uses the caller's RLS-bound server client so
 * the ownership gate in the RPC (vendor_profiles.user_id = auth.uid()) applies.
 * Returns null if the RPC errors (e.g. caller doesn't own the profile) — the UI
 * then simply omits the card rather than throwing.
 */
export async function fetchVendorPesoScorecard(
  supabase: SupabaseClient,
  vendorProfileId: string,
  periodDays: number = PESO_DEFAULT_PERIOD_DAYS,
): Promise<VendorPesoScorecard | null> {
  const { data, error } = await supabase.rpc('vendor_peso_per_lead', {
    p_vendor_profile_id: vendorProfileId,
    p_period_days: periodDays,
  });
  if (error || !data) return null;
  return assembleScorecard(data as VendorPesoRpcRow);
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
  /** TRUE when NO vendor has any token-burn spend (pilot reality). */
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
