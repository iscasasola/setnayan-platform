/**
 * POST /api/admin/demo/cleanup
 *
 * Cleanup ALL demo vendors. Deletes every vendor_profiles row where
 * is_demo=TRUE, cascading to vendor_services + vendor_service_attributes
 * via existing FK ON DELETE CASCADE.
 *
 * Owner-initiated. Admin-only. Single-admin authority (cleanup is
 * reversible by re-running the seed script).
 *
 * Returns the count of deleted vendor_profiles rows (cascaded child-table
 * deletions are not separately counted — they happen at the DB layer).
 *
 * Pattern: matches the existing admin endpoints (sentry-smoke-test) —
 * standard auth check, service-role admin client for the actual write.
 *
 * Why service-role: the admin RLS on vendor_profiles requires user_id IS NULL
 * for unclaimed rows; demo rows all have user_id=NULL by construction, so
 * normal admin RLS already covers SELECT/UPDATE/DELETE. Using service-role
 * just sidesteps the policy lookup for what's already an admin-gated
 * endpoint — no privilege escalation.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in.' };

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member, email')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';
  if (!isAdmin) {
    return { ok: false as const, status: 403, error: 'Admin only.' };
  }
  return { ok: true as const, userId: user.id, email: profile?.email ?? user.email };
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { count, error } = await admin
    .from('vendor_profiles')
    .delete({ count: 'exact' })
    .eq('is_demo', true);

  if (error) {
    return NextResponse.json(
      { error: `Cleanup failed: ${error.message}` },
      { status: 500 },
    );
  }

  // Audit log — admin cleanup is a high-impact action even when reversible.
  await admin.from('admin_audit_log').insert({
    action: 'demo_vendors_cleanup_all',
    target_table: 'vendor_profiles',
    target_id: null,
    after_json: { deleted_count: count ?? 0 },
    actor_user_id: auth.userId,
    reason: 'Cleanup ALL demo vendors via admin UI',
  });

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    initiatedBy: auth.email,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message:
        'POST only. Cleanup is destructive — accessible from /admin/demo-vendors.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
