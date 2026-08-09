import { cache } from 'react';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { envFlagEnabled } from '@/lib/env-flag';

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
  return envFlagEnabled(process.env.GUEST_SESSION_TOKEN_CHECK);
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

/**
 * ── The signing seal ─────────────────────────────────────────────────────────
 *
 * Guest-session cookies are HS256-signed with the raw bytes of ONE env var. The
 * value that resolves here IS the seal, so every rule below exists to serve two
 * goals that pull against each other:
 *
 *   FAIL CLOSED — never sign or verify with a seal that isn't a real secret.
 *   DON'T MOVE THE BYTES — the seal prod signs with today must keep working, or
 *   every guest holding a live cookie is signed out. That happens mid-wedding,
 *   and their only way back in is re-scanning a QR they may no longer have.
 *
 * ⚠ THE SERVICE-ROLE FALLBACK IS DELIBERATELY KEPT. Two unrelated secrets
 * sharing one value is poor hygiene and it should end — but ending it HERE, in
 * code, is the wrong lever. Production has no dedicated GUEST_SESSION_SECRET
 * today, so deleting the fallback would not "improve" anything; it would sign
 * out every live guest the moment the deploy landed. The correct order is:
 * set GUEST_SESSION_SECRET in Vercel first, accept the one-time sign-out at a
 * moment of the owner's choosing, and only then retire the fallback.
 *
 * 🔑 THE REAL COST OF THE SHARED VALUE, stated plainly so it isn't rediscovered:
 * while the fallback is in use, ROTATING THE DATABASE KEY SILENTLY SIGNS OUT
 * EVERY GUEST. Nothing in the rotation runbook says so, because nothing about a
 * database credential suggests it is also a cookie seal.
 *
 * ── What the old guard missed ────────────────────────────────────────────────
 * The previous resolver was `A ?? B ?? ''` followed by `if (!secret) throw`.
 * Probed rather than read, it did three surprising things:
 *
 *   • `GUEST_SESSION_SECRET=''` + a valid service-role key → THREW. `??` is
 *     nullish coalescing, so a present-but-empty variable counts as a value and
 *     short-circuits the fallback standing right behind it. Not hypothetical:
 *     `.env.example` ships that line blank, and `vercel env pull` writes
 *     `NAME=` with no value.
 *   • `GUEST_SESSION_SECRET='   '` → signed, with three spaces as the key.
 *   • `GUEST_SESSION_SECRET='x'`   → signed, with one byte as the key.
 *
 * `if (!secret)` is a PRESENCE check doing the job of a STRENGTH check. Blank
 * and whitespace now read as ABSENT (so the fallback is reached), and anything
 * too short to be a secret is REFUSED outright rather than quietly used.
 *
 * ⚠ Trimming informs the JUDGEMENT ONLY — never the material. A value pasted
 * with a stray newline is still the seal prod is signing with right now, so the
 * signer always receives the original bytes.
 */

/**
 * Below this, a value cannot be a real secret — it is a typo, a placeholder, or
 * a shell artifact. Chosen to sit under every legitimate value: a
 * `openssl rand -hex 32` secret is 64 chars, a Supabase `sb_secret_…` key ~50,
 * a legacy service-role JWT ~200. Nothing valid is anywhere near this floor.
 */
const MIN_SECRET_CHARS = 32;

type SecretSource = 'dedicated' | 'service_role';

export type GuestSessionSecretResolution =
  | { ok: true; material: string; source: SecretSource }
  | { ok: false; reason: string };

/**
 * An index signature, not named optional fields: `process.env` is typed
 * `Dict<string>` with no declared properties, so a weak type of named optionals
 * fails to accept it ("no properties in common").
 */
type SecretEnv = { readonly [key: string]: string | undefined };

/** Blank or whitespace-only is ABSENT, not a value. */
function presentValue(raw: string | undefined): string | null {
  if (typeof raw !== 'string') return null;
  return raw.trim().length > 0 ? raw : null;
}

/**
 * Resolve the seal without touching cookies or throwing — so callers (and the
 * tests, and any future health surface) can ask "is this configured?" and get
 * an answer instead of an exception.
 */
export function resolveGuestSessionSecret(
  env: SecretEnv = process.env,
): GuestSessionSecretResolution {
  const dedicated = presentValue(env.GUEST_SESSION_SECRET);
  const serviceRole = presentValue(env.SUPABASE_SERVICE_ROLE_KEY);

  const picked: { material: string; source: SecretSource } | null = dedicated
    ? { material: dedicated, source: 'dedicated' }
    : serviceRole
      ? { material: serviceRole, source: 'service_role' }
      : null;

  if (!picked) {
    return {
      ok: false,
      reason:
        'GUEST_SESSION_SECRET is not configured and no SUPABASE_SERVICE_ROLE_KEY is available to fall back to',
    };
  }

  // Judged on a trimmed copy; the material handed back stays untrimmed.
  if (picked.material.trim().length < MIN_SECRET_CHARS) {
    const which =
      picked.source === 'dedicated' ? 'GUEST_SESSION_SECRET' : 'SUPABASE_SERVICE_ROLE_KEY';
    return {
      ok: false,
      reason: `${which} is too short to be a signing secret (under ${MIN_SECRET_CHARS} characters) — refusing to sign or verify with it`,
    };
  }

  return { ok: true, material: picked.material, source: picked.source };
}

/**
 * One line per process, not one per request — a seal problem is a deploy-wide
 * condition, and repeating it on every guest page render would bury it.
 */
let warnedSource: SecretSource | 'unusable' | null = null;

function warnOnce(resolution: GuestSessionSecretResolution): void {
  const key = resolution.ok ? resolution.source : 'unusable';
  if (warnedSource === key) return;
  warnedSource = key;

  if (!resolution.ok) {
    // Loud on purpose. Without this, a missing seal is indistinguishable from a
    // forged cookie: readGuestSession() returns null either way, so an entire
    // deploy can sign out every guest with nothing in the logs to say why.
    console.error(
      `[guest-session] NO USABLE SIGNING SECRET — every guest is signed out. ${resolution.reason}. ` +
        'Set GUEST_SESSION_SECRET in the Vercel project env (openssl rand -hex 32) and redeploy.',
    );
    return;
  }

  if (resolution.source === 'service_role') {
    console.warn(
      '[guest-session] signing guest cookies with SUPABASE_SERVICE_ROLE_KEY because ' +
        'GUEST_SESSION_SECRET is unset. Two unrelated secrets are sharing one value: ' +
        'rotating the database key will sign out every guest. Set a dedicated ' +
        'GUEST_SESSION_SECRET (openssl rand -hex 32) when a sign-out is acceptable.',
    );
  }
}

function getSecret(): Uint8Array {
  const resolution = resolveGuestSessionSecret();
  warnOnce(resolution);
  if (!resolution.ok) throw new Error(`[guest-session] ${resolution.reason}`);
  return new TextEncoder().encode(resolution.material);
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

  // Resolve the seal OUTSIDE the catch-all below. A misconfigured seal and a
  // forged cookie both end in "signed out", but they are not the same event and
  // must not look the same to whoever is reading the logs at the time. Left
  // inside the try, a missing secret was swallowed by `catch { return null }` —
  // silence, on every request, for a deploy-wide fault.
  const resolution = resolveGuestSessionSecret();
  warnOnce(resolution);
  if (!resolution.ok) return null; // fail closed, but now it is on the record

  try {
    const { payload } = await jwtVerify(
      cookie.value,
      new TextEncoder().encode(resolution.material),
    );
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
