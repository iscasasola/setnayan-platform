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
import {
  NATIVE_LANDING_COOKIE,
  NATIVE_MARKER_TTL_S,
} from '@/lib/native-oauth-plan';

export async function issueNativeLandingMarker(): Promise<{ marker: string }> {
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
