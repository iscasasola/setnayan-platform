/**
 * POST /api/admin/demo/cleanup-batch
 *
 * Cleanup a single demo batch. Body: { batch_id: <uuid> }.
 *
 * Deletes every vendor_profiles row where demo_batch_id matches the body
 * batch_id AND is_demo=TRUE (defense in depth — refuses to touch rows that
 * happen to share a UUID but aren't tagged as demo). Cascade does the rest.
 *
 * Admin-only. Single-admin authority. Audit-logged.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_body', message: 'Body must be JSON.' },
      { status: 400 },
    );
  }

  const batchId =
    body && typeof body === 'object' && 'batch_id' in body
      ? String((body as Record<string, unknown>).batch_id)
      : '';

  if (!UUID_RE.test(batchId)) {
    return NextResponse.json(
      { error: 'invalid_batch_id', message: 'batch_id must be a UUID.' },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { count, error } = await admin
    .from('vendor_profiles')
    .delete({ count: 'exact' })
    .eq('demo_batch_id', batchId)
    .eq('is_demo', true);

  if (error) {
    return NextResponse.json(
      { error: `Cleanup failed: ${error.message}` },
      { status: 500 },
    );
  }

  await admin.from('admin_audit_log').insert({
    action: 'demo_vendors_cleanup_batch',
    target_table: 'vendor_profiles',
    target_id: batchId,
    after_json: { deleted_count: count ?? 0, batch_id: batchId },
    actor_user_id: auth.userId,
    reason: `Cleanup demo batch ${batchId} via admin UI`,
  });

  return NextResponse.json({
    ok: true,
    deleted: count ?? 0,
    batchId,
    initiatedBy: auth.email,
  });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message:
        'POST only with { batch_id: <uuid> } body. Accessible from /admin/demo-vendors.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
