/**
 * Static auditor for the RLS guest-scope hardening migration
 * (supabase/migrations/20270831174208_rls_guest_scope.sql).
 *
 * The migration re-scopes a set of sensitive RLS policies OFF the guest-admitting
 * public.current_event_ids() helper. This module lets a unit test assert, from
 * the migration's SQL text, that:
 *   1. every listed policy is (re)created, and
 *   2. its CREATE POLICY statement references the expected scoped helper, and
 *   3. it no longer references current_event_ids().
 *
 * It complements the in-migration DO $$ post-condition (which runs against the
 * live catalog at apply time) with a build-time guard that catches a regression
 * before the migration ever reaches a database.
 */

export type RescopedPolicy = {
  table: string;
  policy: string;
  /**
   * A substring the re-created policy MUST contain — the scoped gate that
   * replaced current_event_ids(). Usually a scoped helper name, but for a
   * policy that gates inline (e.g. an EXISTS on event_members.member_type) it
   * is that predicate fragment instead.
   */
  requiredSubstring: string;
};

/**
 * The policies the migration re-scopes. Order/content mirrors the migration's
 * DROP/CREATE blocks and its DO $$ assert list.
 */
export const RESCOPED_POLICIES: RescopedPolicy[] = [
  { table: 'oauth_grants', policy: 'event_member_reads_oauth_grants', requiredSubstring: 'current_couple_event_ids' },
  { table: 'guests', policy: 'event_member_can_read_guest', requiredSubstring: 'current_couple_or_coordinator_event_ids' },
  { table: 'orders', policy: 'orders_owner_read', requiredSubstring: 'current_couple_event_ids' },
  { table: 'guest_face_enrollments', policy: 'event_member_can_read_face_enrollment', requiredSubstring: 'current_couple_event_ids' },
  { table: 'event_vendor_payment_plan', policy: 'event_vendor_payment_plan_host_select', requiredSubstring: 'current_couple_event_ids' },
  { table: 'event_vendor_payment_plan', policy: 'event_vendor_payment_plan_host_write', requiredSubstring: 'current_couple_event_ids' },
  { table: 'budget_allocation_decisions', policy: 'couple_reads_budget_allocation_decisions', requiredSubstring: 'current_couple_event_ids' },
  { table: 'budget_allocation_decisions', policy: 'couple_deletes_budget_allocation_decisions', requiredSubstring: 'current_couple_event_ids' },
  { table: 'event_appointments', policy: 'event_appointments_couple_insert', requiredSubstring: 'current_couple_or_coordinator_event_ids' },
  { table: 'event_appointments', policy: 'event_appointments_couple_update', requiredSubstring: 'current_couple_or_coordinator_event_ids' },
  // Kwento block lever — gates inline on member_type (its USING/WITH CHECK use
  // an EXISTS on event_members, not a helper), so assert that predicate.
  { table: 'guest_message_blocks', policy: 'guest_message_blocks_manage', requiredSubstring: "member_type IN ('couple','coordinator')" },
  { table: 'patiktok_oauth_grants', policy: 'couple_reads_patiktok_oauth_grants', requiredSubstring: 'current_couple_event_ids' },
];

export type PolicyAudit = {
  policy: string;
  ok: boolean;
  reason?: string;
};

/**
 * Extract the text of the `CREATE POLICY <name> ...;` statement for one policy.
 * Returns null if no such statement exists. The statement is taken from the
 * `CREATE POLICY <name>` token to the first following semicolon — CREATE POLICY
 * bodies contain no inner semicolons.
 */
export function extractCreatePolicy(sql: string, policy: string): string | null {
  // Match at a word boundary so `event_appointments_couple_insert` does not
  // also match `..._insert_something`.
  const re = new RegExp(`CREATE\\s+POLICY\\s+${policy}\\b`);
  const m = re.exec(sql);
  if (!m) return null;
  const start = m.index;
  const end = sql.indexOf(';', start);
  return end === -1 ? sql.slice(start) : sql.slice(start, end);
}

/** True iff the text references current_event_ids() (never its scoped cousins). */
export function referencesUnscopedHelper(statement: string): boolean {
  // current_couple_event_ids / current_couple_or_coordinator_event_ids do not
  // contain "current_event_ids" as a substring, so a plain includes is exact.
  return statement.includes('current_event_ids');
}

/** Audit one migration's SQL against RESCOPED_POLICIES. */
export function auditMigrationSql(sql: string): PolicyAudit[] {
  return RESCOPED_POLICIES.map(({ policy, requiredSubstring }) => {
    const stmt = extractCreatePolicy(sql, policy);
    if (stmt === null) {
      return { policy, ok: false, reason: 'CREATE POLICY statement not found' };
    }
    if (referencesUnscopedHelper(stmt)) {
      return { policy, ok: false, reason: 'still references current_event_ids()' };
    }
    if (!stmt.includes(requiredSubstring)) {
      return { policy, ok: false, reason: `does not contain required gate: ${requiredSubstring}` };
    }
    return { policy, ok: true };
  });
}
