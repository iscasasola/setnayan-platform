import 'server-only';
import { randomBytes } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Generic scaffold behind the homepage dock-tile live demos (Papic today;
 * Panood + 3D Plan reuse this same shape — DECISION_LOG 2026-07-03 "build it
 * GENERIC as the program's PR-1"). A visitor opens a demo overlay on the
 * public marketing homepage; this mints ONE ephemeral `demo_sessions` row with
 * two unguessable tokens (QR "you" + QR "a friend"). Each phone that scans
 * joins by token — no sign-in, no real event, no Supabase Auth principal.
 *
 * Deliberately holds ONLY session bookkeeping. Face descriptors and captured
 * frames are relayed peer-to-peer over an ephemeral Supabase Realtime channel
 * keyed by the session id (see `lib/demo-realtime.ts`) and NEVER touch this
 * table or any other durable store — stricter than "auto-purge," since there
 * is nothing biometric here to purge.
 */

export const DEMO_SESSION_TTL_MINUTES = 20;
/** Grace window past expiry before a row is eligible for hard delete. */
const PURGE_GRACE_MINUTES = 10;

export type DemoKind = 'papic' | 'panood' | '3d_plan';

export type DemoSession = {
  id: string;
  demoKind: DemoKind;
  tokenA: string;
  tokenB: string;
  joinedA: boolean;
  joinedB: boolean;
  shotCount: number;
  expiresAt: string;
};

export type DemoRole = 'a' | 'b';

function mintToken(): string {
  // 16 bytes → 22-char base64url; same entropy/shape as generateApiKey()
  // (lib/api-keys.ts) — unguessable, URL-safe, short enough for a QR.
  return randomBytes(16).toString('base64url');
}

/**
 * Create a fresh demo session (owner rule: every overlay OPEN mints brand new
 * tokens — QR codes are never reused across sessions). Fire-and-forget purges
 * a batch of expired rows piggybacked on this call, since the project is
 * cron-free (Next.js `after()` is used by the caller, not here — this module
 * has no request context of its own).
 */
export async function createDemoSession(demoKind: DemoKind): Promise<DemoSession> {
  const admin = createAdminClient();
  const expiresAt = new Date(Date.now() + DEMO_SESSION_TTL_MINUTES * 60_000).toISOString();

  // Collision odds on a 128-bit token are negligible; one retry is a generous
  // backstop against the unique-index constraint, not an expected path.
  for (let attempt = 0; attempt < 3; attempt++) {
    const tokenA = mintToken();
    const tokenB = mintToken();
    const { data, error } = await admin
      .from('demo_sessions')
      .insert({ demo_kind: demoKind, token_a: tokenA, token_b: tokenB, expires_at: expiresAt })
      .select('id, demo_kind, token_a, token_b, joined_a, joined_b, shot_count, expires_at')
      .single();
    if (!error && data) {
      return {
        id: data.id,
        demoKind: data.demo_kind,
        tokenA: data.token_a,
        tokenB: data.token_b,
        joinedA: data.joined_a,
        joinedB: data.joined_b,
        shotCount: data.shot_count,
        expiresAt: data.expires_at,
      };
    }
  }
  throw new Error('Could not mint a demo session — please try again.');
}

/**
 * Resolve a scanned token → which session it belongs to and which side (a/b)
 * the scanner is. Never leaks the OTHER token. Lazy-expires: a row past
 * `expires_at` resolves to null exactly like it doesn't exist, so a stale QR
 * (printed, screenshotted, or just old) fails closed with no special-casing
 * by the caller — same shape as `/papic/join/[token]` resolving a dead seat.
 *
 * Any unexpected failure (DB hiccup, misconfigured client) ALSO resolves to
 * null rather than throwing — a page rendering this dead-end must never
 * crash to the global error boundary just because a demo link didn't
 * resolve, matching `resolveKind()` in `/papic/join/[token]/page.tsx`.
 */
export async function resolveDemoToken(
  token: string,
): Promise<{ sessionId: string; demoKind: DemoKind; role: DemoRole } | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('demo_sessions')
      .select('id, demo_kind, token_a, token_b, expires_at')
      .or(`token_a.eq.${token},token_b.eq.${token}`)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at).getTime() <= Date.now()) return null;
    const role: DemoRole = data.token_a === token ? 'a' : 'b';
    return { sessionId: data.id, demoKind: data.demo_kind, role };
  } catch {
    return null;
  }
}

/**
 * Marks a side joined — surfaced live to the desktop overlay via Realtime
 * presence; this is just the durable "did this side ever join" record for a
 * page refresh. Called via `after()`, so best-effort: a failure here must
 * never surface to the visitor, who already has their page.
 */
export async function markDemoSessionJoined(sessionId: string, role: DemoRole): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin
      .from('demo_sessions')
      .update(role === 'a' ? { joined_a: true } : { joined_b: true })
      .eq('id', sessionId);
  } catch {
    /* best-effort */
  }
}

/** The owner-locked shots-per-session cap, enforced server-side across BOTH phones. */
export const DEMO_SHOT_CAP = 3;

export type DemoShotResult =
  | { ok: true; shotNumber: number; remaining: number }
  | { ok: false; reason: 'cap' | 'expired_or_invalid' };

/**
 * Record one shot against the session's cap (PR-2 of the Papic demo). The
 * increment is ATOMIC — `shot_count = shot_count + 1 WHERE shot_count < cap
 * AND not expired` — so two phones racing the last slot can't both win it.
 * The photo itself never reaches the server (it relays peer-to-peer over the
 * session's Realtime channel); this counts frames, nothing more.
 */
export async function incrementDemoShot(token: string): Promise<DemoShotResult> {
  try {
    const resolved = await resolveDemoToken(token);
    if (!resolved) return { ok: false, reason: 'expired_or_invalid' };
    const admin = createAdminClient();
    // supabase-js has no `SET x = x + 1` expression; emulate the atomic
    // conditional bump with a short optimistic-concurrency loop — each attempt
    // only succeeds if the row still holds the shot_count we read, so a racing
    // phone forces a re-read instead of a double-count.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: row } = await admin
        .from('demo_sessions')
        .select('shot_count')
        .eq('id', resolved.sessionId)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (!row) return { ok: false, reason: 'expired_or_invalid' };
      if (row.shot_count >= DEMO_SHOT_CAP) return { ok: false, reason: 'cap' };
      const next = row.shot_count + 1;
      const { data: updated } = await admin
        .from('demo_sessions')
        .update({ shot_count: next })
        .eq('id', resolved.sessionId)
        .eq('shot_count', row.shot_count)
        .select('shot_count')
        .maybeSingle();
      if (updated) return { ok: true, shotNumber: next, remaining: DEMO_SHOT_CAP - next };
    }
    return { ok: false, reason: 'cap' };
  } catch {
    return { ok: false, reason: 'expired_or_invalid' };
  }
}

/**
 * Best-effort hard-delete of rows past their grace window. Called via
 * `after()` from the pages that mint/resolve sessions (no polling cron, per
 * project convention) — so cleanup piggybacks on real traffic instead of a
 * scheduled job. Failure here is silent; a lingering bookkeeping-only row is
 * harmless (it holds no biometric data) and the next purge sweep catches it.
 */
export async function purgeExpiredDemoSessions(): Promise<void> {
  try {
    const admin = createAdminClient();
    const cutoff = new Date(Date.now() - PURGE_GRACE_MINUTES * 60_000).toISOString();
    await admin.from('demo_sessions').delete().lt('expires_at', cutoff);
  } catch {
    /* best-effort */
  }
}
