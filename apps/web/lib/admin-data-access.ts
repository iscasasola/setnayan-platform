import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * RA 10173 "who viewed whom" access log — admin account-access model, Phase 1a
 * (Admin_Account_Access_Model_2026-06-22.md · DECISION_LOG 2026-06-22).
 *
 * Records that an admin VIEWED another account's data. Distinct from
 * admin_audit_log (admin ACTIONS / writes); this is the read/access trail that
 * the consolidated read-only page + takeover sessions both build on, and the
 * substrate for a couple/vendor's right to know who accessed their data.
 *
 * CONTRACT: NON-FATAL. A logging failure must NEVER break the admin surface
 * (mirrors the sku-activation hook contract). Call via the service-role admin
 * client (`createAdminClient()`), ideally from an `after()` hook so it runs
 * post-response and never blocks render.
 */
export async function logAdminDataAccess(
  admin: SupabaseClient,
  entry: {
    /** The acting admin's user_id (null if unresolved — still logged). */
    adminUserId: string | null;
    /** The account whose data was viewed. */
    accessedUserId: string;
    /** Where the view happened, e.g. 'admin_users_detail'. */
    surface: string;
    /** Optional structured context (never PII beyond ids). */
    context?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await admin.from('admin_data_access_log').insert({
      admin_user_id: entry.adminUserId,
      accessed_user_id: entry.accessedUserId,
      surface: entry.surface,
      context: entry.context ?? null,
    });
    if (error) {
      // Pre-migration (table absent) or any write error: log + swallow.
      console.error('[admin-data-access] log write failed (non-fatal):', error.message);
    }
  } catch (e) {
    console.error('[admin-data-access] log threw (non-fatal):', e);
  }
}
