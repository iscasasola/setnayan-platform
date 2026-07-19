/**
 * Won & Lost Reasons reader (Wave 6 vendor benefit).
 *
 * Assembles a vendor's — or, for admins, the platform's — self-reported
 * inquiry-outcome breakdown (won / lost / no-response, by reason) from the two
 * reporting RPCs added in 20270324681685_inquiry_outcomes_won_lost.sql:
 *   • vendor_inquiry_outcomes_rollup(p_vendor_profile_id)  — ownership-gated
 *   • admin_inquiry_outcomes_overview()                    — is_console_admin-gated
 *
 * TAXONOMY IS DB-DRIVEN — the reason picklist is read from
 * inquiry_outcome_reason_codes (fetchReasonCodes), NEVER hardcoded here, per
 * [[feedback_setnayan_categories_db_not_hardcoded]]. This module only knows the
 * three OUTCOME states (won/lost/no_response), which are a fixed enum on the
 * inquiry_outcomes.outcome CHECK constraint — not a taxonomy.
 *
 * OFF-PLATFORM HONESTY — "won" is a SELF-REPORTED vendor signal, not a verified
 * on-platform payment (Setnayan settles off-platform). The UIs label it as such.
 */

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

/** The three fixed outcome states (enum, NOT taxonomy). */
export type OutcomeState = 'won' | 'lost' | 'no_response';

/** A reason-code row from the admin-managed taxonomy table. */
export type ReasonCode = {
  reasonCode: string;
  label: string;
  /** Which outcome(s) this reason is offered for. */
  appliesTo: OutcomeState | 'any';
  sortOrder: number;
};

/** Totals across a vendor's (or the platform's) outcomes. */
export type OutcomeTotals = {
  won: number;
  lost: number;
  no_response: number;
  total: number;
};

/** One (outcome × reason) tally row. */
export type OutcomeReasonRow = {
  outcome: OutcomeState;
  reasonCode: string | null;
  label: string;
  n: number;
};

export type VendorOutcomeRollup = {
  totals: OutcomeTotals;
  byReason: OutcomeReasonRow[];
};

export type AdminOutcomeOverview = {
  totals: OutcomeTotals & { reporting_vendors: number };
  byReason: OutcomeReasonRow[];
};

const EMPTY_TOTALS: OutcomeTotals = { won: 0, lost: 0, no_response: 0, total: 0 };

type RpcTotals = Partial<Record<keyof OutcomeTotals | 'reporting_vendors', number>>;
type RpcReasonRow = {
  outcome?: string;
  reason_code?: string | null;
  label?: string;
  n?: number;
};
type RpcRollup = { totals?: RpcTotals; by_reason?: RpcReasonRow[] };

function coerceReasonRows(rows: RpcReasonRow[] | undefined): OutcomeReasonRow[] {
  return (rows ?? [])
    .filter((r): r is RpcReasonRow & { outcome: string } => typeof r.outcome === 'string')
    .map((r) => ({
      outcome: r.outcome as OutcomeState,
      reasonCode: r.reason_code ?? null,
      label: r.label ?? '(no reason given)',
      n: Number(r.n ?? 0),
    }));
}

/**
 * Read the admin-managed reason taxonomy (active rows only). Source of truth for
 * every "pick a reason" picklist in the app — the list is NEVER hardcoded. Uses
 * the caller's RLS-bound client (the read-active policy is open to authenticated
 * users). Returns [] on error so the capture UI degrades to "outcome + note".
 */
export async function fetchReasonCodes(
  supabase: SupabaseClient,
): Promise<ReasonCode[]> {
  const { data, error } = await supabase
    .from('inquiry_outcome_reason_codes')
    .select('reason_code, label, applies_to, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    reasonCode: r.reason_code as string,
    label: r.label as string,
    appliesTo: r.applies_to as ReasonCode['appliesTo'],
    sortOrder: r.sort_order as number,
  }));
}

/**
 * Read a vendor's OWN won/lost/no-response roll-up. Uses the caller's
 * RLS-bound server client so the RPC's ownership gate applies. Returns null on
 * error (UI omits the card) and an empty roll-up when there are no outcomes yet.
 */
export async function fetchVendorOutcomeRollup(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorOutcomeRollup | null> {
  const { data, error } = await supabase.rpc('vendor_inquiry_outcomes_rollup', {
    p_vendor_profile_id: vendorProfileId,
  });
  if (error || !data) return null;
  const rpc = data as RpcRollup;
  return {
    totals: { ...EMPTY_TOTALS, ...(rpc.totals ?? {}) },
    byReason: coerceReasonRows(rpc.by_reason),
  };
}

/**
 * Read the platform-wide outcome overview for /admin/insights. Uses the
 * service-role admin client; the RPC still self-gates on is_console_admin(), and
 * the /admin layout already 404s non-admins before this renders. Returns an
 * empty overview on error (card renders an empty state instead of throwing).
 */
export async function fetchAdminOutcomeOverview(): Promise<AdminOutcomeOverview> {
  const empty: AdminOutcomeOverview = {
    totals: { ...EMPTY_TOTALS, reporting_vendors: 0 },
    byReason: [],
  };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('admin_inquiry_outcomes_overview');
  if (error || !data) return empty;
  const rpc = data as RpcRollup;
  return {
    totals: {
      ...EMPTY_TOTALS,
      reporting_vendors: 0,
      ...(rpc.totals ?? {}),
    },
    byReason: coerceReasonRows(rpc.by_reason),
  };
}
