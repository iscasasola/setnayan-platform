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

/** Cookie options shared by every guest-session writer. */
const GUEST_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: COOKIE_MAX_AGE_SECONDS,
} as const;

/**
 * Build the {name, value, options} for the guest-session cookie WITHOUT writing
 * it. Lets a Route Handler attach the cookie directly to a NextResponse (e.g. a
 * redirect), where setting via `cookies()` after building a redirect can be
 * dropped. setGuestSession (next/headers) is the Server-Action/page path.
 */
export async function buildGuestSessionCookie(payload: GuestSessionPayload): Promise<{
  name: string;
  value: string;
  options: typeof GUEST_SESSION_COOKIE_OPTIONS;
}> {
  return {
    name: COOKIE_NAME,
    value: await signGuestSession(payload),
    options: GUEST_SESSION_COOKIE_OPTIONS,
  };
}

export async function setGuestSession(payload: GuestSessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const { name, value, options } = await buildGuestSessionCookie(payload);
  cookieStore.set({ name, value, ...options });
}

export async function clearGuestSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
