import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCOUNTS_LIST_COOKIE,
  canAddAnother,
  decodeParkedList,
  encodeJar,
  encodeParkedList,
  jarCookieName,
  jarCookieOptions,
  listCookieOptions,
  parkInList,
} from '@/lib/account-jars';
import { expireSessionCookies, readCurrent, requestClient } from '@/lib/account-routes.server';
import { ACTIVE_SHOP_COOKIE } from '@/lib/active-shop';

/**
 * ＋ ADD ANOTHER ACCOUNT — park the signed-in session in its own jar (NOT signed out at Supabase: it stays a live
 * session, held only at /auth/accounts), clear the page's session cookies, and open the shipped sign-in card. When
 * that sign-in succeeds, the new login is the active one and this one is a row under "Other accounts", one tap
 * away. Google · Apple · email all land the same way — nothing in the sign-in flow changes.
 */
export async function POST(request: NextRequest) {
  const secure = process.env.NODE_ENV === 'production';
  const { supabase } = requestClient(request);
  const current = await readCurrent(supabase);
  if (!current) return NextResponse.redirect(new URL('/login', request.url), { status: 303 });

  const list = decodeParkedList(request.cookies.get(ACCOUNTS_LIST_COOKIE)?.value);
  if (!canAddAnother(list)) return NextResponse.redirect(new URL('/dashboard?hub=1', request.url), { status: 303 });
  const next = parkInList(list, { uid: current.uid.toLowerCase(), email: current.email, name: current.name });
  if (!next) return NextResponse.redirect(new URL('/dashboard?hub=1', request.url), { status: 303 });

  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303 });
  response.cookies.set(jarCookieName(current.uid), encodeJar({ uid: current.uid.toLowerCase(), refresh: current.refresh }), jarCookieOptions(secure));
  response.cookies.set(ACCOUNTS_LIST_COOKIE, encodeParkedList(next), listCookieOptions(secure));
  expireSessionCookies(request, response, secure);
  response.cookies.set(ACTIVE_SHOP_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, secure, sameSite: 'lax' });
  return response;
}
