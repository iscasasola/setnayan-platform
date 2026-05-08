/**
 * Guest magic-link session.
 *
 * Public guests authenticate by visiting `/[event-slug]?invite=[qr_token]`. The
 * server validates the token against the `guests` table, then signs a JWT and
 * sets it as a cookie so subsequent visits don't require the query param.
 *
 * The cookie's claim set carries `guest_id` and `event_id` so we can look up
 * the guest cheaply on every request without a DB hit per validation.
 *
 * Lifetime: 30 days. The work order ties session expiry to the QR's "30 days
 * after the event ends" rule, but for V1 simplicity we use a flat 30-day TTL
 * from the cookie's issue time. Token rotation invalidates by design (the new
 * token's JWT chain is different).
 */

import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "tayo_guest_session";
const ISSUER = "tayo:guest";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export interface GuestSessionClaims {
  guest_id: string;
  event_id: string;
  qr_token: string; // bound to this token; rotation invalidates
  iat: number;
  exp: number;
}

function getSecret(): Uint8Array {
  const secret = process.env.EVENTS_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "EVENTS_TOKEN_SECRET is required (min 32 chars). Generate with `openssl rand -hex 32`.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signGuestSession(input: {
  guest_id: string;
  event_id: string;
  qr_token: string;
}): Promise<string> {
  return await new SignJWT({
    guest_id: input.guest_id,
    event_id: input.event_id,
    qr_token: input.qr_token,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyGuestSession(token: string): Promise<GuestSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    if (
      typeof payload.guest_id !== "string" ||
      typeof payload.event_id !== "string" ||
      typeof payload.qr_token !== "string"
    ) {
      return null;
    }
    return {
      guest_id: payload.guest_id,
      event_id: payload.event_id,
      qr_token: payload.qr_token,
      iat: Number(payload.iat ?? 0),
      exp: Number(payload.exp ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Set the guest cookie on the response. Call from server actions / route
 * handlers / RSC where cookies() is mutable.
 */
export async function setGuestSessionCookie(jwt: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_SECONDS,
    path: "/",
  });
}

export async function clearGuestSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readGuestSession(): Promise<GuestSessionClaims | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyGuestSession(token);
}

export const GUEST_SESSION_COOKIE_NAME = COOKIE_NAME;
