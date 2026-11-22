/**
 * /auth/go — the phone app's Google sign-in starts HERE, so the iOS sheet names setnayan.com instead of
 * `<ref>.supabase.co` (owner screenshot 22 Nov 2026). It only ever answers 302 to this project's own
 * Supabase authorize endpoint with the query it was given, or 400. See lib/oauth-front-door.ts for why
 * this is not an open redirect and why PKCE is untouched.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { authorizeTarget } from '@/lib/oauth-front-door';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  const target = authorizeTarget(request.nextUrl.search, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!target) {
    return new NextResponse('This sign-in link is not one Setnayan made. Close this window and try again.', {
      status: 400,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const res = NextResponse.redirect(target, 302);
  res.headers.set('cache-control', 'no-store');
  return res;
}
