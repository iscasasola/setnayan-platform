/**
 * POST /api/telemetry/auto-resolve — Connection Logs code-level auto-clear.
 *
 * Accepts `{ file_path }` and flips every ACTIVE fault matching that path to
 * 'resolved'. The intent (per the task spec) is: when a bug is fixed locally,
 * clear its faults in one call so the Active tab stays a true picture of what's
 * still broken.
 *
 * AUTH — dual gate (either passes):
 *   1. `x-internal-worker-secret: $INTERNAL_WORKER_SECRET` header — the
 *      local-dev / CI / scripted path (matches lib/telemetry/insert.ts).
 *   2. A logged-in admin session (account_type='admin' | is_internal |
 *      is_team_member) — lets an admin tool trigger it.
 *
 * This is a mutation on a public-fed table, so it MUST be gated even though the
 * page that links here is already behind the admin layout.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { resolveFaultsByFilePath } from '@/lib/telemetry/fault-log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasValidWorkerSecret(req: NextRequest): boolean {
  const expected = process.env.INTERNAL_WORKER_SECRET;
  if (!expected) return false;
  const supplied = req.headers.get('x-internal-worker-secret');
  return !!supplied && supplied === expected;
}

async function isAdminSession(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(
    profile?.is_internal || profile?.is_team_member || profile?.account_type === 'admin',
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authorized = hasValidWorkerSecret(req) || (await isAdminSession());
  if (!authorized) {
    return new NextResponse(null, { status: 401 });
  }

  let body: { file_path?: unknown };
  try {
    body = (await req.json()) as { file_path?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const filePath = typeof body.file_path === 'string' ? body.file_path.trim() : '';
  if (!filePath) {
    return NextResponse.json({ ok: false, error: 'file_path_required' }, { status: 400 });
  }

  const resolved = await resolveFaultsByFilePath(filePath);
  return NextResponse.json({ ok: true, file_path: filePath, resolved }, { status: 200 });
}
