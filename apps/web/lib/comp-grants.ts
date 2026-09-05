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
  /**
   * NULL = applies to every event this user hosts (the original, only shape
   * before migration 20271205612762). Set = scoped to that one event only.
   */
  event_id: string | null;
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
  /**
   * The scoped event's display name, resolved by the fetchers' embed. NOT a
   * column — it is `NULL` for an account-wide grant and for a vendor grant.
   */
  event_name: string | null;
  /**
   * Set only once migration 20271208142357 (PR #5221) is live: the event this
   * grant WAS scoped to, kept after that event was deleted. Optional here so
   * this module compiles either side of that merge; the fetchers start
   * selecting it once the column exists. Read by `describeReach` so a grant
   * whose event is gone never reads as an account-wide one.
   */
  scoped_event_id_snapshot?: string | null;
};

/** PostgREST returns an embed as a nested object; flatten it to `event_name`. */
type CompGrantSelectRow = Omit<CompGrantRow, 'event_name'> & {
  events: { display_name: string | null } | null;
};

const COMP_GRANT_SELECT =
  'grant_id, public_id, user_id, event_id, source, scope, scoped_skus, expiry, retail_value_centavos, rationale, granted_by, approved_by, revoked_at, created_at, events(display_name)';

function toCompGrantRows(data: unknown): CompGrantRow[] {
  return ((data ?? []) as CompGrantSelectRow[]).map(({ events, ...row }) => ({
    ...row,
    event_name: events?.display_name ?? null,
  }));
}

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
    .select(COMP_GRANT_SELECT)
    .eq('user_id', userId)
    .order('revoked_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`fetchCompGrantsForUser failed: ${error.message}`);
  return toCompGrantRows(data);
}

/**
 * Fetch every ACTIVE comp_grants row, across every user — the read side of
 * `/admin/gifts`. Unlike `fetchCompGrantsForUser`, this is not scoped to one
 * target; it is the "what's currently comped, for whom" oversight view.
 *
 * Revoked rows are excluded — this page is about what's live, not history.
 * (A revoked grant is still visible on the target user's own expand-panel at
 * `/admin/accounts?tab=users`, which is where `fetchCompGrantsForUser`'s
 * revoked-rows-included behavior is actually used.)
 */
export async function fetchAllActiveCompGrants(
  admin: SupabaseClient,
  limit = 200,
): Promise<CompGrantRow[]> {
  const { data, error } = await admin
    .from('comp_grants')
    .select(COMP_GRANT_SELECT)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`fetchAllActiveCompGrants failed: ${error.message}`);
  return toCompGrantRows(data);
}

export type HostedEventRow = {
  event_id: string;
  display_name: string;
  event_type: string;
  event_date: string | null;
};

/**
 * Every event `userId` hosts as a 'couple' member — the picker for scoping a
 * comp grant to one specific event instead of their whole account.
 */
export async function fetchEventsHostedBy(
  admin: SupabaseClient,
  userId: string,
): Promise<HostedEventRow[]> {
  const { data, error } = await admin
    .from('event_members')
    .select('events(event_id, display_name, event_type, event_date)')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (error) throw new Error(`fetchEventsHostedBy failed: ${error.message}`);
  return ((data ?? []) as unknown as { events: HostedEventRow | null }[])
    .map((row) => row.events)
    .filter((e): e is HostedEventRow => !!e);
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
 * How FAR a grant reaches — the other half of `describeScope`, and the half
 * that was missing everywhere but `/admin/gifts` until 2026-09-06.
 *
 * 🔑 SCOPE IS NOT REACH. `describeScope` answers "which services are free";
 * this answers "on which events". A grant scoped to one wedding and a grant
 * covering the account forever both printed *"Every Setnayan service"* — the
 * same words, in the same order — on `/admin/accounts?tab=users` and on
 * `/admin/users/<id>`. An admin auditing what was given away could not tell a
 * ₱4,999 one-off from an open tab, so **never render one without the other**.
 *
 * Always returns a sentence: there is no "say nothing" branch, because an
 * absent reach line is exactly what made the two shapes indistinguishable.
 */
export function describeReach(
  grant: Pick<
    CompGrantRow,
    'event_id' | 'user_id' | 'event_name' | 'scoped_event_id_snapshot'
  >,
): string {
  if (grant.event_id) {
    return grant.event_name ? `${grant.event_name} only` : 'One event only';
  }
  // The event was deleted after the grant was issued. `event_id` is NULL now,
  // but this was NEVER an account-wide grant — saying so would report a
  // privilege the customer does not have (see migration 20271208142357).
  if (grant.scoped_event_id_snapshot) return 'One event only — since deleted';
  if (grant.user_id) return 'Every event they host';
  return 'Not tied to an event';
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
