import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile } from '@/lib/demo-mode';

/**
 * Authoritative demo-mode status for the client-side <DemoModeBanner>.
 *
 * This route holds the SECURE server-side check that used to live inside the
 * DemoModeBanner server component: read the httpOnly demo cookie, verify the
 * session is still an admin, and only then report `show: true`. Moving it here (invoked by the client banner, and only
 * when the non-httpOnly hint cookie is present) is what lets the ROOT LAYOUT stop
 * calling cookies() during SSR — which is what unblocks edge-caching / ISR of the
 * marketing pages. (Perf sweep 2026-07-02, homepage ISR.)
 *
 * Non-admins (even with a stale cookie) and anonymous visitors get `show: false`.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value !== '1') {
    return NextResponse.json({ show: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ show: false });

  const { data: profile } = await supabase
    .from('users')
    .select('account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!isAdminProfile(profile)) return NextResponse.json({ show: false });

  // The Dec-1 cleanup deadline this used to return is retired (owner 2026-11-06: demo shops are permanent and public,
  // marked "(DEMO ONLY)"). The banner now says only what demo mode still does — force demo shops' prices public.
  return NextResponse.json({ show: true });
}
