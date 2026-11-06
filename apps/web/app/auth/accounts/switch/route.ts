import { NextResponse, type NextRequest } from 'next/server';
import {
  ACCOUNTS_LIST_COOKIE,
  decodeJar,
  decodeParkedList,
  encodeJar,
  encodeParkedList,
  isUid,
  jarCookieName,
  jarCookieOptions,
  listCookieOptions,
} from '@/lib/account-jars';
import { performSwitch } from '@/lib/account-switch';
import { applyPending, expireSessionCookies, readCurrent, refreshParked, requestClient } from '@/lib/account-routes.server';
import { ACTIVE_SHOP_COOKIE } from '@/lib/active-shop';

/**
 * 🔁 SWITCH TO ANOTHER ACCOUNT ON THIS PHONE — instant, no password (owner 2026-10-22, option B). The sheet's
 * "Other accounts" row posts `uid` here. `performSwitch` (lib/account-switch.ts) refreshes that account's jar,
 * verifies it IS that account, parks the current one, and only then does this response replace the session
 * cookies. A refused switch changes nothing but dropping the dead row.
 *
 * POST only; the jars are SameSite=Lax and path-scoped to /auth/accounts, so a cross-site form cannot drive this.
 */
export async function POST(request: NextRequest) {
  const secure = process.env.NODE_ENV === 'production';
  const home = new URL('/dashboard?hub=1', request.url);
  let target = '';
  try {
    target = String((await request.formData()).get('uid') ?? '').trim().toLowerCase();
  } catch {
    return NextResponse.redirect(home, { status: 303 });
  }
  if (!isUid(target)) return NextResponse.redirect(home, { status: 303 });

  const list = decodeParkedList(request.cookies.get(ACCOUNTS_LIST_COOKIE)?.value);
  const jar = decodeJar(request.cookies.get(jarCookieName(target))?.value);
  const { supabase, pending } = requestClient(request);
  // Only what `setSession` writes is the new session. Reading the current one may refresh it (and write ITS cookies
  // into `pending` too) — applying those would mix two accounts' chunks.
  let activeFrom = -1;

  const result = await performSwitch(
    {
      refresh: refreshParked,
      current: () => readCurrent(supabase),
      activate: async (s) => {
        activeFrom = pending.length;
        const { data, error } = await supabase.auth.setSession({ access_token: s.access, refresh_token: s.refresh });
        return error ? null : (data.user?.id ?? null);
      },
    },
    { target, jar, list },
  );

  const response = NextResponse.redirect(home, { status: 303 });
  // The target's jar is spent either way: a live one became the active session; a dead one is dropped.
  response.cookies.set(jarCookieName(target), '', { ...jarCookieOptions(secure), maxAge: 0 });
  response.cookies.set(ACCOUNTS_LIST_COOKIE, encodeParkedList(result.list), listCookieOptions(secure));
  if (!result.ok) return response;

  // The previous account's session leaves the page cookies entirely, then the target's is written.
  expireSessionCookies(request, response, secure);
  applyPending(request, response, activeFrom >= 0 ? pending.slice(activeFrom) : []);
  if (result.park) response.cookies.set(jarCookieName(result.park.uid), encodeJar(result.park), jarCookieOptions(secure));
  // The chosen shop belonged to the account that left.
  response.cookies.set(ACTIVE_SHOP_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, secure, sameSite: 'lax' });
  return response;
}
