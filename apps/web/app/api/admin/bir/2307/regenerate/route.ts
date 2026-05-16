import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { regenerateVendor } from '@/lib/bir/generator';

/**
 * POST /api/admin/bir/2307/regenerate
 *
 * Body: { vendor_profile_id: string, tax_year: number, tax_quarter: 1|2|3|4 }
 *
 * Regenerates the 2307 PDF for a single vendor + quarter. Used by the
 * admin "Regenerate" button on /admin/bir/2307 — e.g. when a vendor's
 * TIN was wrong on the first run and the admin fixed it, or when a
 * late-arriving payout slipped into the quarter after the cron fired.
 *
 * Idempotent — the underlying upsert UPDATEs in place and bumps
 * regenerated_count + appends to audit_log.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from('users')
    .select('account_type,is_internal,is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  const isAdmin =
    profile?.is_internal ||
    profile?.is_team_member ||
    profile?.account_type === 'admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin only.' }, { status: 403 });
  }

  let body: {
    vendor_profile_id?: string;
    tax_year?: number;
    tax_quarter?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const vendor_profile_id = body.vendor_profile_id;
  const year = Number(body.tax_year);
  const quarter = Number(body.tax_quarter);
  if (
    !vendor_profile_id ||
    !Number.isFinite(year) ||
    !Number.isFinite(quarter) ||
    quarter < 1 ||
    quarter > 4
  ) {
    return NextResponse.json(
      { error: 'vendor_profile_id, tax_year, tax_quarter required.' },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const row = await regenerateVendor(
      admin,
      vendor_profile_id,
      year,
      quarter as 1 | 2 | 3 | 4,
      user.id,
    );
    return NextResponse.json({ ok: true, filing: row });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[api/admin/bir/2307/regenerate] failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
