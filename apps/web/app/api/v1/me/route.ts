import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateApiRequest, isAuthError } from '@/lib/api-auth';

/**
 * Auth-gated whoami. The most basic authenticated endpoint — used to
 * verify a token works and to expose the calling user's public profile
 * fields. Future endpoints follow the same pattern: authenticate, then
 * use the resolved user_id with the admin client.
 */
export async function GET(req: Request) {
  const auth = await authenticateApiRequest(req);
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('user_id, public_id, email, display_name, account_type, locale, created_at')
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  return NextResponse.json(
    {
      data: profile,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
