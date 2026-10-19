'use server';

/**
 * Mint the ONE-TIME marker that lets `/auth/callback?native=1` run the sign-in
 * landing (vendor promotion, RSVP terms stamp) after the phone app's Apple
 * sheet. The design and why it exists: lib/native-oauth-plan.ts, "THE NATIVE
 * LANDING MARKER".
 *
 * A server action, not a route: Next refuses a server-action POST whose Origin
 * is not this site, so another site cannot mint a marker into a visitor's jar.
 * The value goes back ONLY to the caller that asked (lib/native-oauth.ts), which
 * puts it on the callback URL; the cookie copy is httpOnly and scoped to the
 * callback path, and the callback spends it on its first native visit.
 */

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { holdNativeAppleAuthorization } from '@/lib/apple-sign-in-store';
import {
  NATIVE_LANDING_COOKIE,
  NATIVE_MARKER_TTL_S,
} from '@/lib/native-oauth-plan';

/** Apple's authorization codes are short; anything else is not one. */
const MAX_APPLE_CODE_LENGTH = 2048;

/**
 * 🍎 ALSO, ON THE SAME CALL: the native sheet's five-minute Apple authorization
 * code (App Store 5.1.1(v)). It is the only thing a native Sign in with Apple
 * yields that can be traded for a refresh token, and without a refresh token the
 * grant can never be revoked when the account is erased. Carried here rather
 * than in a new action because this IS the moment right after the sign-in, and
 * every exported action is a production route (scripts/lint-server-action-budget.mjs).
 * The trade runs AFTER the response (`after`), for the signed-in user read from
 * this request's own session — the caller names no user — and only a code whose
 * Apple ID matches that account's Apple identity is held
 * (lib/apple-sign-in-store.ts · holdNativeAppleAuthorization). Best-effort: the
 * marker is returned whatever happens to the code.
 */
export async function issueNativeLandingMarker(
  input?: { appleAuthorizationCode?: unknown },
): Promise<{ marker: string }> {
  const code = input?.appleAuthorizationCode;
  if (typeof code === 'string' && code.length > 0 && code.length <= MAX_APPLE_CODE_LENGTH) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      const user = data?.user ?? null;
      if (user) after(() => holdNativeAppleAuthorization(user.id, user, code).then(() => undefined));
    } catch {
      // No session to attach it to — the sign-in itself is unaffected.
    }
  }
  const marker = randomBytes(32).toString('hex');
  const jar = await cookies();
  jar.set(NATIVE_LANDING_COOKIE, marker, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/auth/callback',
    maxAge: NATIVE_MARKER_TTL_S,
  });
  return { marker };
}
