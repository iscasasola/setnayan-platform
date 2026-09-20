import { SignJWT, jwtVerify } from 'jose';
import { resolveGuestSessionSecret } from '@/lib/guest-session';

/**
 * apps/web/lib/live-screen-session.ts
 *
 * The credential a paired venue screen holds (DAY-12). A TV has no account and
 * nobody signs in on it, so pairing hands it a signed, httpOnly cookie instead.
 *
 * WHAT MAKES IT REVOCABLE: the token carries the screen's `paired_at`. The
 * screen page re-reads the row on every request and refuses the token unless
 *   • the row exists and `revoked_at` is null (Remove kills it), and
 *   • the row's `paired_at` equals the token's (a new code + a new pairing
 *     changes `paired_at`, so the OLD device stops working the moment the new
 *     one pairs — and "New code" clears `paired_at`, so it stops at once).
 * A signature alone is never enough; `verifyLiveScreenToken` returns a CLAIM,
 * and `liveScreenTokenMatchesRow` is the check that decides.
 *
 * WHY THE GUEST SEAL: the signing material is the guest-session secret, reused
 * rather than adding a third deploy-time secret nobody would set. The two
 * tokens cannot stand in for each other: this one requires the
 * `setnayan:live-screen` audience, which a guest token never carries, and a
 * guest verify requires `guest_id` / `qr_token`, which this one never carries.
 */

export const LIVE_SCREEN_COOKIE_NAME = 'setnayan_live_screen';
/** A screen that stays plugged in through prep, the day and the after-party. */
export const LIVE_SCREEN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const AUDIENCE = 'setnayan:live-screen';

export type LiveScreenClaim = {
  screen_id: number;
  event_id: string;
  paired_at: string;
};

function secretOrNull(): Uint8Array | null {
  const resolution = resolveGuestSessionSecret();
  if (!resolution.ok) {
    console.error(`[live-screen] NO USABLE SIGNING SECRET — screens cannot pair. ${resolution.reason}`);
    return null;
  }
  return new TextEncoder().encode(resolution.material);
}

export async function signLiveScreenToken(claim: LiveScreenClaim): Promise<string | null> {
  const secret = secretOrNull();
  if (!secret) return null;
  return await new SignJWT({ ...claim })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${LIVE_SCREEN_COOKIE_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

/** Signature + shape only. Never sufficient on its own — see the file docblock. */
export async function verifyLiveScreenToken(token: string | undefined | null): Promise<LiveScreenClaim | null> {
  if (!token) return null;
  const secret = secretOrNull();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { audience: AUDIENCE });
    if (
      typeof payload.screen_id !== 'number' ||
      !Number.isInteger(payload.screen_id) ||
      typeof payload.event_id !== 'string' ||
      typeof payload.paired_at !== 'string'
    ) {
      return null;
    }
    return { screen_id: payload.screen_id, event_id: payload.event_id, paired_at: payload.paired_at };
  } catch {
    return null;
  }
}

/**
 * The decision. Pure, so the revocation rule is executed in a test rather than
 * grepped for. `paired_at` is compared as an instant, not as text: PostgREST
 * may render the same timestamp with a different offset or precision than the
 * string that was signed.
 */
export function liveScreenTokenMatchesRow(
  claim: LiveScreenClaim,
  row: { id: number; event_id: string; paired_at: string | null; revoked_at: string | null } | null,
): boolean {
  if (!row) return false;
  if (row.revoked_at) return false;
  if (row.id !== claim.screen_id || row.event_id !== claim.event_id) return false;
  if (!row.paired_at) return false;
  const a = Date.parse(row.paired_at);
  const b = Date.parse(claim.paired_at);
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}
