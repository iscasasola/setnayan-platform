/**
 * POST /api/admin/demo/regenerate
 *
 * Runs cleanup-all THEN returns instructions for the operator to run the
 * seed script from a terminal. The CLI is the canonical seeding path
 * (~1,500 rows of inserts + attribute payloads is too much synchronous
 * work for a single HTTP request — running it as a background job
 * inside a serverless function would silently exceed the per-invocation
 * compute envelope on Vercel).
 *
 * Design choice (intentional honest UX):
 *   • This endpoint deletes all demo vendors immediately.
 *   • Then it returns a JSON body with the CLI command to re-seed.
 *   • The admin UI surfaces the response inline so the operator copies
 *     the command and pastes into their terminal.
 *
 * If the marketplace must look-and-feel realistic right after pressing
 * the button, the admin UI should disable "Regenerate" altogether and
 * point owners at the CLI. The button exists to make cleanup ONE-CLICK
 * and to make re-seeding's terminal step VISIBLE rather than buried.
 *
 * Admin-only. Single-admin authority. Audit-logged.
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
      { error: `Cleanup phase failed: ${error.message}` },
      { status: 500 },
    );
  }

  await admin.from('admin_audit_log').insert({
    action: 'demo_vendors_regenerate_cleanup',
    target_table: 'vendor_profiles',
    target_id: null,
    after_json: { deleted_count: count ?? 0 },
    actor_user_id: auth.userId,
    reason: 'Regenerate flow — cleanup phase via admin UI',
  });

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    initiatedBy: auth.email,
    nextStep: {
      message:
        'Cleanup complete. Run the seed script from a terminal to repopulate the marketplace.',
      command:
        'pnpm -F @setnayan/web exec tsx scripts/seed-demo-vendors.ts',
      docs: '/admin/demo-vendors',
    },
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message:
        'POST only. Regenerate clears all demo vendors and prints CLI instructions for re-seeding.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
