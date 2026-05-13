import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'setnayan_guest_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — covers up-to-30-day post-event window

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
    return {
      guest_id: payload.guest_id,
      event_id: payload.event_id,
      qr_token: payload.qr_token,
    };
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
