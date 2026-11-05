import { NextResponse, type NextRequest } from 'next/server';
import { ACCOUNTS_LIST_COOKIE, decodeJar, jarCookieOptions, jarNamesIn, listCookieOptions } from '@/lib/account-jars';
import { revokeParked } from '@/lib/account-routes.server';

/**
 * SIGN OUT OF ALL ACCOUNTS — every parked account's session is revoked at Supabase and its jar expired, the list
 * is cleared, and then the request continues (307, still a POST) to `/auth/sign-out`, which signs out the active
 * account and clears everything else it always clears. Nothing of any login is left on the device.
 */
export async function POST(request: NextRequest) {
  const secure = process.env.NODE_ENV === 'production';
  const names = jarNamesIn(request.cookies.getAll().map((c) => c.name));
  await Promise.all(
    names.map(async (n) => {
      const jar = decodeJar(request.cookies.get(n)?.value);
      if (jar) await revokeParked(jar.refresh);
    }),
  );
  const response = NextResponse.redirect(new URL('/auth/sign-out', request.url), { status: 307 });
  for (const n of names) response.cookies.set(n, '', { ...jarCookieOptions(secure), maxAge: 0 });
  response.cookies.set(ACCOUNTS_LIST_COOKIE, '', { ...listCookieOptions(secure), maxAge: 0 });
  return response;
}
