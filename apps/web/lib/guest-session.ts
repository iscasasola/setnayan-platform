import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

const COOKIE_NAME = 'setnayan_guest_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — covers up-to-30-day post-event window

/**
 * QR-rotation session revocation (build ④ · council § 5.11). The 60-day JWT
 * embeds the guest's qr_token at mint time; without this check a session
 * minted from a LEAKED QR survives up to 60 days after the host/guest rotates
 * the token. When GUEST_SESSION_TOKEN_CHECK=true, every readGuestSession()
 * additionally verifies the embedded qr_token still matches guests.qr_token —
 * a mismatch means the token was rotated since this session was minted, and
 * the session is treated as signed out.
 *
 * COST (measured shape, flag ON): exactly one primary-key SELECT on guests per
 * request, memoized per (guest_id, qr_token) within the request via React
 * cache() — so a page that calls readGuestSession() many times (e.g.
 * /[slug]/page.tsx + its actions) pays for ONE query. Supabase SIN from Vercel
 * ≈ a few ms; index: guests_pkey.
 *
 * FAILURE POLICY: definitive mismatch or missing/deleted row → revoked (null).
 * A transport/DB ERROR fails OPEN (session honored) so a transient outage
 * can't sign out every guest at once — the flag exists to kill leaked
 * sessions, not to add a new single point of failure.
 */
function guestSessionTokenCheckEnabled(): boolean {
  return process.env.GUEST_SESSION_TOKEN_CHECK === 'true';
}

const sessionTokenMatchesDb = cache(
  async (guestId: string, qrToken: string): Promise<boolean> => {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from('guests')
        .select('qr_token')
        .eq('guest_id', guestId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) return true; // fail OPEN on transport/DB error (see above)
      return data?.qr_token === qrToken;
    } catch {
      return true; // admin client unavailable (e.g. CI build) — fail open
    }
  },
);

function getSecret(): Uint8Array {
  const secret =
    process.env.GUEST_SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!secret) throw new Error('GUEST_SESSION_SECRET (or fallback) not configured');
  return new TextEncoder().encode(secret);
}

export type GuestSessionPayload = {
  guest_id: string;
  event_id: string;
  qr_token: string;
};

export async function signGuestSession(payload: GuestSessionPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function readGuestSession(): Promise<GuestSessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, getSecret());
    if (
      typeof payload.guest_id !== 'string' ||
      typeof payload.event_id !== 'string' ||
      typeof payload.qr_token !== 'string'
    ) {
      return null;
    }
    const session: GuestSessionPayload = {
      guest_id: payload.guest_id,
      event_id: payload.event_id,
      qr_token: payload.qr_token,
    };
    // Flag-gated DB re-validation — the chokepoint covers EVERY consumer
    // (24 files import this reader; validating here means none can be missed).
    if (guestSessionTokenCheckEnabled()) {
      const ok = await sessionTokenMatchesDb(session.guest_id, session.qr_token);
      if (!ok) return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function setGuestSession(payload: GuestSessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const token = await signGuestSession(payload);
  cookieStore.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearGuestSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
