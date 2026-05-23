/**
 * Comp-grant reader helpers (admin-side).
 *
 * Why this module exists
 * ----------------------
 * The `/admin/users` page renders a "Comp grants" expand panel per user.
 * That panel reads from `public.comp_grants` (canonical 0023 § 3.5b schema,
 * shipped via migrations 20260515020000 + 20260515030000). The table is
 * service-role read in admin contexts: RLS allows `comp_grants_admin_read`
 * for users with `is_internal = TRUE` or `account_type = 'admin'` — but
 * admins reach this page via `createAdminClient()` (service role) so RLS
 * is bypassed anyway. Centralizing the read shape here means the page
 * server-component stays focused on layout, and any future caller (e.g.,
 * vendor-self-comp review queue in 0023 § 6) can reuse the same row type.
 *
 * Source-of-truth: `public.comp_grants` per the merged schema:
 *   - migration `20260515020000_public_stats_exclusion.sql` (stub: grant_id,
 *     source, order_id, vendor_profile_id, created_by_user_id, reason,
 *     created_at)
 *   - migration `20260515030000_self_review_gate.sql` (upgrade: public_id,
 *     user_id, scope, scoped_skus, expiry, retail_value_centavos,
 *     rationale, granted_by, approved_by, two_admin_approval_id,
 *     revoked_at)
 *
 * The two columns `created_by_user_id` + `reason` from the stub are
 * deprecated — new admin-issued comps populate `granted_by` + `rationale`
 * instead. We don't read the deprecated columns here.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

export type CompGrantSource =
  | 'owner_internal'
  | 'team_pool'
  | 'external_promo'
  | 'dispute_remedy'
  | 'vendor_self_comp';

export type CompGrantScope = 'all_services' | 'specific_skus' | 'single_order';

export type CompGrantRow = {
  grant_id: string;
  public_id: string;
  user_id: string | null;
  source: CompGrantSource;
  scope: CompGrantScope;
  scoped_skus: string[] | null;
  expiry: string | null;
  retail_value_centavos: number | null;
  rationale: string | null;
  granted_by: string | null;
  approved_by: string | null;
  revoked_at: string | null;
  created_at: string;
};

/**
 * Fetch every comp_grants row scoped to a single target user. Returns
 * active grants first (revoked_at IS NULL, ordered by created_at DESC),
 * then revoked grants below.
 *
 * Caller must pass a service-role client (e.g., `createAdminClient()`) —
 * the RLS policy `comp_grants_admin_read` would also cover an authenticated
 * is_internal admin, but the admin-users page already uses service role
 * for the user-list query so we stay consistent.
 */
export async function fetchCompGrantsForUser(
  admin: SupabaseClient,
  userId: string,
): Promise<CompGrantRow[]> {
  const { data, error } = await admin
    .from('comp_grants')
    .select(
      'grant_id, public_id, user_id, source, scope, scoped_skus, expiry, retail_value_centavos, rationale, granted_by, approved_by, revoked_at, created_at',
    )
    .eq('user_id', userId)
    .order('revoked_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchCompGrantsForUser failed: ${error.message}`);
  return (data ?? []) as CompGrantRow[];
}

/**
 * Format centavos as a polite "₱X,XXX" string. Returns "—" when null.
 * Diverges from `lib/orders.ts formatPhp` (which takes pesos): we keep
 * centavos here because the DB column is centavos and any conversion to
 * pesos in the reader would silently truncate.
 */
export function formatRetailValueCentavos(
  centavos: number | null | undefined,
): string {
  if (centavos === null || centavos === undefined) return '—';
  const pesos = Math.floor(centavos / 100);
  return `₱${pesos.toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Polite-voice description of a scope.
 * Per [[feedback_setnayan_no_dev_text_post_launch]] — no enum jargon.
 */
export function describeScope(
  scope: CompGrantScope,
  scopedSkus: string[] | null,
): string {
  if (scope === 'all_services') return 'Every Setnayan service';
  if (scope === 'single_order') return 'A single order';
  if (scope === 'specific_skus') {
    const count = scopedSkus?.length ?? 0;
    if (count === 0) return 'Specific services (none picked yet)';
    if (count === 1) return `1 specific service`;
    return `${count} specific services`;
  }
  return scope;
}

/**
 * Polite-voice description of a source. Most user-facing comp grants from
 * /admin/users will be `external_promo` (customer reward, remediation,
 * goodwill); the other sources are surfaced for transparency when reading
 * legacy rows.
 */
export function describeSource(source: CompGrantSource): string {
  switch (source) {
    case 'owner_internal':
      return 'Owner account (permanent)';
    case 'team_pool':
      return 'Setnayan team pool';
    case 'external_promo':
      return 'External promo';
    case 'dispute_remedy':
      return 'Dispute remedy';
    case 'vendor_self_comp':
      return 'Vendor self-comp';
  }
}
