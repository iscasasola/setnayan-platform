import { createHash } from 'node:crypto';
import { peekRateLimit } from '@/lib/rate-limit';

/**
 * Per-event · per-IP throttle for the guest-list SELF-JOIN door.
 *
 * ── WHY THIS EXISTS (pre-launch audit, 2026-08-06) ────────────────────────────
 * The accountless self-join on `/join/[eventId]` mints a `guests` row AND signs
 * a `setnayan_guest_session` cookie — it hands over an IDENTITY — from nothing
 * but the join token printed on the couple's QR poster. Nothing throttled it.
 *
 * That matters because the same path enforces a HARD per-event ceiling on
 * `self_added_unlisted` rows (`SELF_JOIN_CEILING`, app/join/[eventId]/actions.ts).
 * The ceiling is SHARED, so it is not the attacker who gets locked out: once a
 * script fills it, every later visitor — including a real guest standing at the
 * reception desk — is bounced with `error=join_closed` ("This event has reached
 * its sign-up limit"), and there is no in-product way for the couple to clear it.
 * A per-connection throttle turns "one script permanently closes the door for
 * everyone" into "that one connection waits about two minutes".
 *
 * The sibling public surface that merely REVEALS a table label
 * (`/api/seat-lookup/[slug]`) already runs `enforceRateLimit`. This door, which
 * hands over an identity, did not.
 *
 * ── MECHANISM ────────────────────────────────────────────────────────────────
 * The existing two-layer limiter (`lib/with-rate-limit.ts`: L1 in-memory + L2
 * durable Postgres `check_rate_limit`). No second mechanism is introduced. It is
 * imported LAZILY so this module stays unit-testable — `with-rate-limit` pulls in
 * `server-only`, which cannot be resolved outside a Next build.
 *
 * ── HONEST LIMITS (do not oversell this) ─────────────────────────────────────
 * • `x-forwarded-for`'s left-most entry is client-influenceable, so a caller who
 *   rotates it evades an XFF-keyed bucket. `readJoinDoorIp` therefore PREFERS the
 *   proxy-set `x-vercel-forwarded-for` / `x-real-ip` and only falls back to XFF.
 * • L2 (`enforceRateLimit`) fails OPEN by design on a Postgres hiccup or a
 *   pre-migration DB; L1 still bounds a flood hitting one warm instance. This
 *   module's fail-CLOSED covers the case it can actually observe: the limiter
 *   giving back no usable decision at all (it threw, or returned a shape we
 *   cannot read). See `allowGuestSelfJoinAttempt`.
 * • This is a rate limit, not an admission policy. It never decides WHO gets in.
 */

/** Limiter bucket name. Shared by the consuming check and the read-only peek. */
export const JOIN_DOOR_BUCKET = 'guest_self_join';

/**
 * 30 attempts per 2 minutes per (event, connection).
 *
 * Sized for a VENUE, not a laptop: a reception is routinely one NAT'd WiFi IP
 * shared by every guest, so the budget has to clear a real arrival rush. Thirty
 * completed name-forms inside two minutes from a single connection is already
 * far past human speed, while a script is cut from thousands per second to
 * fifteen per minute — the 1000-row ceiling stops being reachable during an event.
 */
export const JOIN_DOOR_LIMIT = 30;
export const JOIN_DOOR_WINDOW_SECS = 120;

/**
 * Query-string key a caller may redirect with. `JoinFlow` renders an unknown key
 * verbatim, so `/join/[eventId]/page.tsx` swaps this one for the sentence below —
 * which is why adopting the throttle needs no edit to the shared flow component.
 */
export const JOIN_DOOR_ERROR_KEY = 'join_throttled';

/** Guest-facing copy. Says "wait", never "blocked" — this is always temporary. */
export const JOIN_DOOR_THROTTLED_MESSAGE =
  'Too many join attempts from this connection. Please wait a moment and try again.';

export type JoinDoorReason = 'ok' | 'no_client_ip' | 'throttled' | 'limiter_unavailable';

export type JoinDoorDecision = {
  allowed: boolean;
  retryAfterSecs: number;
  reason: JoinDoorReason;
};

/**
 * Best-effort client IP, preferring the headers the PLATFORM sets over the one
 * the caller can write.
 *
 * `x-vercel-forwarded-for` and `x-real-ip` are stamped by Vercel's proxy and
 * overwrite whatever the client sent. `x-forwarded-for` is the weak fallback
 * (`lib/client-ip.ts` documents why) and is only used when neither is present.
 * Returns null when no header yields an address.
 */
export function readJoinDoorIp(h: Headers): string | null {
  for (const name of ['x-vercel-forwarded-for', 'x-real-ip', 'x-forwarded-for']) {
    const first = h.get(name)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return null;
}

/**
 * The limiter identity: this event AND this connection.
 *
 * Per-event so one busy wedding can never spend another wedding's budget, and
 * per-IP so one connection's flood cannot close the door on the room.
 *
 * The IP is stored only as a salted SHA-256 digest: the L2 layer writes `ident`
 * into `public.rate_limit_hits`, and a raw address there would be personal data
 * at rest for no benefit (RA 10173 data-minimization — same treatment as
 * `lib/anon-mint-throttle.ts`).
 */
export function joinDoorIdent(eventId: string, ip: string | null): string {
  const salt =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    'setnayan-join-door-throttle';
  const digest = createHash('sha256').update(`${salt}:${ip ?? ''}`).digest('hex').slice(0, 32);
  return `${eventId}:${digest}`;
}

/** The composite key `enforceRateLimit` hands to the L1 limiter for this bucket. */
export function joinDoorL1Key(ident: string): string {
  // Mirrors `rateLimit(`${bucket}:${key}`, …)` in lib/with-rate-limit.ts.
  // join-door-throttle.test.ts reads that file and fails if the composition drifts.
  return `${JOIN_DOOR_BUCKET}:${ident}`;
}

type LimiterResult = { ok: boolean; retryAfterSecs: number; remaining: number };
type Limiter = (
  bucket: string,
  ident: string | null,
  opts: { limit: number; windowSecs: number },
) => Promise<LimiterResult>;

/** Lazy so `server-only` (via with-rate-limit) never loads under `tsx --test`. */
const defaultLimiter: Limiter = async (bucket, ident, opts) => {
  const mod = await import('@/lib/with-rate-limit');
  return mod.enforceRateLimit(bucket, ident, opts);
};

/** null when the limiter gave back something we cannot read as a decision. */
function readLimiterResult(raw: unknown): { ok: boolean; retryAfterSecs: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.ok !== 'boolean') return null;
  const retry =
    typeof r.retryAfterSecs === 'number' && Number.isFinite(r.retryAfterSecs) && r.retryAfterSecs > 0
      ? Math.ceil(r.retryAfterSecs)
      : JOIN_DOOR_WINDOW_SECS;
  return { ok: r.ok, retryAfterSecs: retry };
}

/**
 * CONSUMES one slot. Call immediately before a self-join mints a `guests` row.
 *
 *   const door = await allowGuestSelfJoinAttempt(eventId, await headers());
 *   if (!door.allowed) {
 *     return redirect(`/join/${eventId}?token=…&error=${JOIN_DOOR_ERROR_KEY}`);
 *   }
 *
 * FAILS CLOSED when the limiter yields no usable decision — it threw, or handed
 * back a shape we cannot read. This door mints an identity and its ceiling is
 * shared by every guest, so "we could not tell" must not mean "help yourself".
 *
 * FAILS OPEN in exactly one place: when no client IP can be read at all. Every
 * anonymous caller would otherwise collapse into one bucket, and a single script
 * could shut the door on all IP-less guests — the very outage this prevents. On
 * Vercel a platform IP header is always present, so this is a local/proxied edge
 * case, and it matches `lib/anon-mint-throttle.ts`.
 *
 * `deps.limiter` exists so the fail-closed branch is reachable in tests. Nothing
 * in the app should pass it.
 */
export async function allowGuestSelfJoinAttempt(
  eventId: string,
  h: Headers,
  deps?: { limiter?: Limiter },
): Promise<JoinDoorDecision> {
  const ip = readJoinDoorIp(h);
  if (!ip) return { allowed: true, retryAfterSecs: 0, reason: 'no_client_ip' };

  const limiter = deps?.limiter ?? defaultLimiter;
  let raw: unknown;
  try {
    raw = await limiter(JOIN_DOOR_BUCKET, joinDoorIdent(eventId, ip), {
      limit: JOIN_DOOR_LIMIT,
      windowSecs: JOIN_DOOR_WINDOW_SECS,
    });
  } catch (e) {
    console.error('[join-door-throttle] limiter threw — failing closed:', e);
    return { allowed: false, retryAfterSecs: JOIN_DOOR_WINDOW_SECS, reason: 'limiter_unavailable' };
  }

  const result = readLimiterResult(raw);
  if (!result) {
    console.error('[join-door-throttle] unreadable limiter result — failing closed');
    return { allowed: false, retryAfterSecs: JOIN_DOOR_WINDOW_SECS, reason: 'limiter_unavailable' };
  }
  if (!result.ok) {
    return { allowed: false, retryAfterSecs: result.retryAfterSecs, reason: 'throttled' };
  }
  return { allowed: true, retryAfterSecs: 0, reason: 'ok' };
}

/**
 * READ-ONLY. Has this connection already spent its budget for this event?
 *
 * Does NOT consume a slot, so a guest reloading the join page can never throttle
 * themselves out of it — which is the whole reason the page uses this and not
 * `allowGuestSelfJoinAttempt`. L1 only (see `peekRateLimit`), so it can miss a
 * flood served by another instance; it exists to EXPLAIN a slowdown, never to
 * authorize. The consuming check on the write path stays authoritative.
 */
export function guestSelfJoinDoorIsThrottled(eventId: string, h: Headers): boolean {
  const ip = readJoinDoorIp(h);
  if (!ip) return false;
  return !peekRateLimit(joinDoorL1Key(joinDoorIdent(eventId, ip)), JOIN_DOOR_LIMIT).ok;
}
