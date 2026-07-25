/**
 * POST /api/admin/cron/reencrypt-secrets — ENCRYPTION_KEY rotation sweep.
 *
 * Step 4 of the dual-key runbook on /admin/secrets. Re-seals every stored
 * ciphertext under the CURRENT ENCRYPTION_KEY, using ENCRYPTION_KEY_PREVIOUS to
 * read anything still sealed under the old one. Returns three counts; run it
 * until `failed` is 0, then delete ENCRYPTION_KEY_PREVIOUS in Vercel.
 *
 * AUTH — dual gate, fail-closed (either passes):
 *   1. `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`
 *      — the curl / scripted path (mirrors /api/cron/retention-sweep).
 *   2. A logged-in admin session (is_internal | is_team_member | account_type
 *      = 'admin') — the board's own button posts as the admin (mirrors
 *      /api/telemetry/auto-resolve).
 *
 * Both comparisons are timing-safe, and an UNSET CRON_SECRET authorises
 * nothing — it just leaves the admin-session path.
 *
 * The response carries counts only. No secret value, plaintext, or ciphertext
 * ever leaves this route.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { secureCompare } from '@/lib/secure-compare';
import { reencryptStoredSecrets } from '@/lib/secrets/reencrypt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function hasValidCronSecret(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const authz = req.headers.get('authorization') ?? '';
  const bearer = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : '';
  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  return (
    (bearer.length > 0 && secureCompare(bearer, expected)) ||
    (headerSecret.length > 0 && secureCompare(headerSecret, expected))
  );
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
  const authorized = hasValidCronSecret(req) || (await isAdminSession());
  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const counts = await reencryptStoredSecrets();
  return NextResponse.json({ ok: true, ...counts }, { status: 200 });
}

// Reject GET so an accidental browser visit never runs a bulk rewrite.
export function GET() {
  return NextResponse.json(
    { ok: false, error: 'POST only.' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
