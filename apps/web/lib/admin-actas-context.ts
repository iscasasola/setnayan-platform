import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveAdminTakeoverEnabled } from '@/lib/admin-takeover-config';

/**
 * Admin Account-Access Model — PHASE 3b: the scoped "act-as" SESSION SWAP.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THE MECHANISM (chosen for being the LEAST-dangerous viable design)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * This is the single highest-risk capability in the program. The chosen
 * mechanism deliberately does NOT mint or impersonate the target user's real
 * Supabase auth JWT and NEVER calls `setSession()`. Doing so would be the most
 * dangerous design: it would put a fully-privileged user session in the admin's
 * browser that RLS would happily honour, and it would be hard to revoke (you'd
 * have to chase the issued JWT + refresh token across the auth server).
 *
 * Instead the admin STAYS LOGGED IN AS THEMSELVES. We layer a SECOND, separate,
 * narrow context on top:
 *
 *   • A `jose` HS256-signed, httpOnly, short-TTL cookie (`setnayan_admin_actas`)
 *     whose payload binds the admin to ONE target user via ONE open
 *     `admin_takeover_sessions` row. Mirrors the existing signed-cookie pattern
 *     in lib/guest-session.ts / lib/live-wall.ts (same crypto, same secret
 *     fallback) — no new dependency, a reviewed in-repo pattern.
 *
 *   • The cookie is NOT a credential by itself. `resolveActAsContext()` treats
 *     it as a CLAIM that must be re-proven against the DB on EVERY request:
 *       1. takeover feature flag still ON (emergency-OFF kills it instantly),
 *       2. JWT signature + shape valid,
 *       3. the bound `admin_takeover_sessions` row is still OPEN
 *          (ended_at IS NULL — covers admin-end, the user's force-end from
 *          #2068, and the ended_by='backstop' sweep) AND not past expires_at,
 *       4. the holder is STILL an admin and IS the session's acting admin.
 *     If ANY check fails the context resolves to null AND the cookie is cleared.
 *
 * Net effect: the context "stops working the instant the session ends" because
 * there is no long-lived privileged token to revoke — every act-as request
 * re-reads the session state, so the moment `ended_at` is set (by anyone) the
 * very next request is inert.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * SCOPE — what an act-as context grants (read-leaning + consent-to-fix)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * The context only IDENTIFIES the target + the session. It does NOT itself read
 * or write anything. Callers (the act-as surface) use the service-role admin
 * client scoped to `target_user_id` to render a read view of the target's OWN
 * account, and route corrections through the existing consent-to-fix /
 * audited-admin-action paths. The privacy invariants HOLD: this module, and any
 * caller, must never read chat message bodies, thread attachments, raw
 * behavioral/decision data, or raw face vectors (enforced by
 * lint-admin-chat-guard on app/admin/**). This file lives in lib/ (outside the
 * guard's scan path) but is written to the same invariant — it contains no such
 * reader and must never gain one.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * FLAG-GATED OFF
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Every entry point asserts `resolveAdminTakeoverEnabled()` first. With the
 * master switch OFF (the default — platform_settings.admin_takeover_enabled
 * NULL + ADMIN_TAKEOVER_ENABLED env unset) no act-as cookie can be minted and
 * any pre-existing cookie resolves to null + is cleared. Prod is byte-identical
 * until the owner flips it post-review.
 */

const ACTAS_COOKIE_NAME = 'setnayan_admin_actas';

/**
 * Hard re-validation TTL on the COOKIE itself (1 hour). Independent of — and
 * always shorter than — the session's ~8h DB backstop. Even if the DB read in
 * resolveActAsContext somehow couldn't run, the signed cookie can never be
 * honoured for more than an hour without being re-minted by an admin who has
 * re-confirmed an open session. The DB check is the primary control; this is a
 * crypto-level backstop so a stale signed cookie cannot outlive the hour.
 */
const ACTAS_COOKIE_TTL_SECONDS = 60 * 60;

function getSecret(): Uint8Array {
  // Same secret resolution as the other signed-cookie helpers in this repo
  // (guest-session.ts / live-wall.ts): a dedicated secret if set, else the
  // service-role key (server-only, never shipped to the client).
  const secret =
    process.env.ADMIN_ACTAS_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!secret) throw new Error('ADMIN_ACTAS_SECRET (or fallback) not configured');
  return new TextEncoder().encode(secret);
}

/**
 * The signed-cookie payload. Deliberately minimal: it BINDS the cookie to one
 * admin + one target + one session row. All authority is re-derived from the DB
 * on read — the cookie is a binding claim, not a grant.
 */
export type ActAsClaim = {
  /** Discriminator so a stray same-secret token from another helper can't pass. */
  kind: 'admin_actas';
  /** The open admin_takeover_sessions.session_id this act-as is bound to. */
  session_id: string;
  /** Whose account is being acted upon. */
  target_user_id: string;
  /** The admin who is acting (must still BE the session's acting admin). */
  admin_user_id: string;
};

/**
 * The fully re-validated act-as context for the current request, or null when
 * there is no live act-as in effect (the overwhelmingly common case — prod with
 * the flag off always returns null).
 */
export type ActAsContext = {
  sessionId: string;
  targetUserId: string;
  adminUserId: string;
  /** Session backstop expiry, for surfacing the countdown in the UI. */
  expiresAt: string;
  /** Session start, for the live banner. */
  startedAt: string;
  /** Reason captured at session start (shown in the banner + audit). */
  reason: string;
};

async function signClaim(claim: ActAsClaim): Promise<string> {
  return await new SignJWT(claim)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ACTAS_COOKIE_TTL_SECONDS}s`)
    .sign(getSecret());
}

function isActAsClaim(payload: unknown): payload is ActAsClaim {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    p.kind === 'admin_actas' &&
    typeof p.session_id === 'string' &&
    typeof p.target_user_id === 'string' &&
    typeof p.admin_user_id === 'string'
  );
}

/**
 * MINT an act-as cookie for an open session. Called only from the server action
 * that ENTERS act-as, AFTER it has verified the session is open + the caller is
 * the session's acting admin (defense in depth — this also re-checks the flag).
 *
 * Refuses unless the takeover flag is ON. Never mints from a request where the
 * session isn't independently verified by the caller.
 */
export async function mintActAsCookie(claim: ActAsClaim): Promise<void> {
  if (!(await resolveAdminTakeoverEnabled())) {
    throw new Error('Account takeover is not enabled on this environment.');
  }
  const token = await signClaim(claim);
  const cookieStore = await cookies();
  cookieStore.set({
    name: ACTAS_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // stricter than the session cookie — act-as never rides a cross-site nav.
    path: '/',
    maxAge: ACTAS_COOKIE_TTL_SECONDS,
  });
}

/** Drop the act-as cookie. Safe to call unconditionally (idempotent). */
export async function clearActAsCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACTAS_COOKIE_NAME);
}

/** Cheap presence check (signature only, no DB) for hot paths like the banner gate. */
export async function hasActAsCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(ACTAS_COOKIE_NAME)?.value);
}

/**
 * Resolve + FULLY re-validate the act-as context for this request. Returns null
 * (and best-effort clears the cookie) on ANY failure. This is the single
 * chokepoint every act-as read/write must go through to learn "am I acting as
 * someone, and for whom?".
 *
 * Re-validation order (cheapest first; bails on the first failure):
 *   1. flag still ON,
 *   2. cookie present + signature/shape valid,
 *   3. bound session still OPEN (ended_at IS NULL) + not past expires_at +
 *      target matches the cookie,
 *   4. acting admin matches the cookie AND is STILL an admin.
 */
export async function resolveActAsContext(): Promise<ActAsContext | null> {
  // 1. Flag. Emergency-OFF must take effect on the very next request, so this
  //    is read uncached (resolveAdminTakeoverEnabled is itself uncached).
  if (!(await resolveAdminTakeoverEnabled())) {
    // Don't bother clearing here — with the flag off, mint can't run, so any
    // residual cookie is already inert. Clearing would need a cookies() write
    // which isn't allowed in every server-component context.
    return null;
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTAS_COOKIE_NAME)?.value;
  if (!raw) return null;

  // 2. Signature + shape.
  let claim: ActAsClaim;
  try {
    const { payload } = await jwtVerify(raw, getSecret());
    if (!isActAsClaim(payload)) {
      await safeClear();
      return null;
    }
    claim = payload;
  } catch {
    await safeClear();
    return null;
  }

  const admin = createAdminClient();

  // 3. Session must still be OPEN, not expired, and for THIS target.
  const { data: session } = await admin
    .from('admin_takeover_sessions')
    .select('session_id, target_user_id, admin_user_id, ended_at, expires_at, started_at, reason')
    .eq('session_id', claim.session_id)
    .maybeSingle();

  if (
    !session ||
    session.ended_at !== null || // admin end, user_force_end (#2068), or backstop
    session.target_user_id !== claim.target_user_id ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    await safeClear();
    return null;
  }

  // 4. The acting admin in the cookie must match the session's acting admin AND
  //    still hold admin privileges (a demoted admin's cookie dies immediately).
  if (session.admin_user_id !== claim.admin_user_id) {
    await safeClear();
    return null;
  }
  const { data: actor } = await admin
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', claim.admin_user_id)
    .maybeSingle();
  if (!(actor?.is_internal || actor?.is_team_member || actor?.account_type === 'admin')) {
    await safeClear();
    return null;
  }

  return {
    sessionId: session.session_id,
    targetUserId: session.target_user_id,
    adminUserId: session.admin_user_id,
    expiresAt: session.expires_at,
    startedAt: session.started_at,
    reason: session.reason,
  };
}

/**
 * Clearing a cookie requires a writable cookie store (Server Action / Route
 * Handler). In a Server Component context the write throws; swallow it — the
 * DB-level checks already make the stale cookie inert, and the next mutating
 * context will clear it.
 */
async function safeClear(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(ACTAS_COOKIE_NAME);
  } catch {
    // Server Component — cannot mutate cookies; the cookie is already inert.
  }
}
