import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminProfile } from '@/lib/admin/require-admin';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { buildPersonalDataExport, personalDataExportResponse } from '@/lib/personal-data-export';

/**
 * GET /admin/users/<userId>/export — "Download their data".
 *
 * The same RA 10173 file a person downloads from Profile › Download my data,
 * prepared by an admin for someone who asked the DPO (by email, or because they
 * can no longer sign in). Admin audit 2026-09-30 §2e: until now the only
 * export was self-serve, so those requests could not be answered from the
 * console at all.
 *
 * ONE BUILDER: lib/personal-data-export.ts, the code the self-serve route uses.
 * On this door it reads through the service-role client, says in the file that
 * an admin prepared it, and leaves out message TEXT (staff never read it — the
 * person gets the text from their own download).
 *
 * Route handlers are not covered by the /admin layout's gate, so admin is
 * re-checked here and everyone else gets a plain 404 — the same contract as
 * app/admin/data-privacy/documents/[doc]/route.ts. Every file prepared is
 * logged in admin_data_access_log (who, whose, when), which the account card's
 * Privacy tab lists.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  if (!me) return new NextResponse('Not found', { status: 404 });
  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', me.id)
    .maybeSingle();
  if (!isAdminProfile(profile)) return new NextResponse('Not found', { status: 404 });

  const { userId } = await params;
  if (!UUID_RE.test(userId)) return new NextResponse('Not found', { status: 404 });

  const admin = createAdminClient();
  // The account's sign-in record is the subject: id, email, when they joined
  // and last signed in — the same four facts the self-serve file opens with.
  const { data: found, error: lookupError } = await admin.auth.admin.getUserById(userId);
  if (lookupError && !/not.?found/i.test(lookupError.message)) {
    return new NextResponse(
      "Couldn't look up this account, so no file was made. Try again in a minute.",
      { status: 502, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }
  const subject = found?.user;
  if (!subject) return new NextResponse('Not found', { status: 404 });

  const exported = await buildPersonalDataExport(subject, admin, 'setnayan_admin');

  await logAdminDataAccess(admin, {
    adminUserId: me.id,
    accessedUserId: subject.id,
    surface: 'admin_user_data_export',
    context: { export_complete: exported.export_complete === true },
  });

  return personalDataExportResponse(exported, subject.id);
}
