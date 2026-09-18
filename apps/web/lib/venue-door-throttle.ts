import { createHash } from 'node:crypto';
import {
  readJoinDoorIp,
  JOIN_DOOR_LIMIT,
  JOIN_DOOR_WINDOW_SECS,
} from '@/lib/join-door-throttle';

/**
 * Per-connection throttle for the doors that mint an ANONYMOUS SESSION at a venue.
 *
 * ── WHY THIS EXISTS (2026-09-18) ──────────────────────────────────────────────
 * Three server actions hand a person with no account a real Supabase identity
 * (`signInAnonymously`) on nothing but a token or a public event id:
 *
 *   • `claimPapicSeat`        (app/papic/actions.ts)        — crew-seat QR
 *   • `claimPanoodCamera`     (app/panood/actions.ts)       — camera-operator QR
 *   • `startGuestPickSession` (app/panood/guest-pick-actions.ts) — a guest's tap
 *
 * Today the only thing between a script and those mints — besides the token — is
 * Supabase's GLOBAL captcha — observed switched OFF on 2026-09-18, which is a
 * dated reading, not a standing fact; check the Supabase dashboard. When on, it is
 * Cloudflare Turnstile, which escalates to an INTERACTIVE solve when one IP makes
 * many requests quickly; a reception is exactly that, a hundred-plus guests on
 * one NAT'd venue WiFi. So captcha is the wrong shape of lock for a venue, and
 * with it off nothing in THIS app bounds a connection. (GoTrue has its own
 * anonymous-sign-in rate limit, set in the Supabase dashboard — not in this repo,
 * and not read by this session. Whatever it is set to also applies per venue IP.)
 *
 * The guest-list join door solved the same problem without captcha: a scarce,
 * event-scoped token plus a throttle SIZED FOR A VENUE (`lib/join-door-throttle.ts`).
 * This module is that pattern applied to the three anonymous-session doors.
 *
 * ⚖ It is gated by `venueDoorThrottleEnabled()` AT EACH CALL SITE and ships OFF —
 * see `lib/venue-door-flag.ts` for the open owner decision. This module never
 * reads the flag itself, so both states are exercisable in one test process.
 *
 * ── WHAT IT REUSES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────────
 * REUSED: the venue sizing (`JOIN_DOOR_LIMIT` per `JOIN_DOOR_WINDOW_SECS`, one
 * number for "a room of guests behind one IP", not a second guess at it), the
 * platform-header-first IP read (`readJoinDoorIp`), the salted-digest identity
 * (no raw IP at rest — RA 10173), and the existing two-layer limiter
 * (`enforceRateLimit`, imported lazily so this stays unit-testable).
 *
 * NOT REUSED — the join door's FAIL-CLOSED. That door fails closed because its
 * `SELF_JOIN_CEILING` is shared by every guest, so "could not tell" had to mean
 * "no". These doors have no shared ceiling: a claim token is single-use and
 * `seatClaimability()` / `cameraClaimability()` still refuse a taken or revoked
 * one before any mint. A limiter outage with fail-closed would lock the whole
 * crew out on the wedding day; with fail-open it leaves the doors exactly as
 * they are today. So an unreadable limiter FAILS OPEN here, and says so in the
 * decision's `reason`.
 *
 * ── KEYING ────────────────────────────────────────────────────────────────────
 * • The CLAIM doors key on (door, connection) — NOT on the token and NOT on the
 *   event. The throttle must run BEFORE the admin-client token lookup (that
 *   lookup is what an enumerating script is spending), and at that point the
 *   event is unknown; keying on the token would let the script rotate tokens
 *   and never meet the same bucket twice.
 * • GUEST-PICK keys on (door, event, connection), like the join door: the event
 *   is known up front, and one busy wedding must never spend another's budget.
 *
 * ── HONEST LIMITS ─────────────────────────────────────────────────────────────
 * • A rate limit, not an admission policy. It never decides WHO gets in; the
 *   token (or the event's guest-pick switch and paywall) still does.
 * • L2 fails open by design and L1 is per-instance, so a flood spread across
 *   many instances is bounded per instance, not globally.
 * • It does NOT turn captcha off. Supabase's captcha is one global switch across
 *   sign-up, sign-in, reset and anonymous sign-in; nothing in this file can
 *   exempt one door from it.
 */

/** The three doors. Each is its own limiter bucket. */
export const VENUE_DOORS = {
  papicSeatClaim: 'venue_papic_seat_claim',
  panoodCameraClaim: 'venue_panood_camera_claim',
  guestPick: 'venue_guest_pick',
} as const;

export type VenueDoor = (typeof VENUE_DOORS)[keyof typeof VENUE_DOORS];

/** The venue sizing — the join door's number, not a second one. */
export const VENUE_DOOR_LIMIT = JOIN_DOOR_LIMIT;
export const VENUE_DOOR_WINDOW_SECS = JOIN_DOOR_WINDOW_SECS;

/**
 * `?state=` value a claim action redirects with. Both claim pages render it as
 * a RETRYABLE notice above the claim form — never the terminal "this link isn't
 * active" screen, because the link is fine.
 */
export const VENUE_DOOR_STATE = 'throttled';

/** Guest-facing copy. Says "wait", never "blocked" — this is always temporary. */
export const VENUE_DOOR_THROTTLED_MESSAGE =
  'Lots of people are joining from this connection right now. Your link is fine — wait a minute and tap again.';

export type VenueDoorReason = 'ok' | 'no_client_ip' | 'throttled' | 'limiter_unavailable';

export type VenueDoorDecision = {
  allowed: boolean;
  retryAfterSecs: number;
  reason: VenueDoorReason;
};

/**
 * The limiter identity. `scope` is the event id for guest-pick and `null` for
 * the claim doors (see KEYING above). The IP is only ever a salted digest.
 */
export function venueDoorIdent(door: VenueDoor, scope: string | null, ip: string): string {
  const salt =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    'setnayan-venue-door-throttle';
  const digest = createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
  return scope ? `${door}:${scope}:${digest}` : `${door}:${digest}`;
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

/**
 * CONSUMES one slot. Call it — behind `venueDoorThrottleEnabled()` — immediately
 * before the door's admin-client lookup and anonymous mint:
 *
 *   if (venueDoorThrottleEnabled()) {
 *     const venueThrottle = await allowVenueDoorAttempt(VENUE_DOORS.papicSeatClaim, null, await headers());
 *     if (!venueThrottle.allowed) redirect(`/papic/claim/${token}?state=${VENUE_DOOR_STATE}`);
 *   }
 *
 * FAILS OPEN on a missing client IP (every IP-less caller would otherwise share
 * one bucket and one script could close the door on all of them) and on an
 * unreadable limiter (see NOT REUSED above). Refuses only on a real `ok: false`.
 *
 * `deps.limiter` exists so every branch is reachable in tests. Nothing in the
 * app should pass it.
 */
export async function allowVenueDoorAttempt(
  door: VenueDoor,
  scope: string | null,
  h: Headers,
  deps?: { limiter?: Limiter },
): Promise<VenueDoorDecision> {
  const ip = readJoinDoorIp(h);
  if (!ip) return { allowed: true, retryAfterSecs: 0, reason: 'no_client_ip' };

  const limiter = deps?.limiter ?? defaultLimiter;
  let raw: unknown;
  try {
    raw = await limiter(door, venueDoorIdent(door, scope, ip), {
      limit: VENUE_DOOR_LIMIT,
      windowSecs: VENUE_DOOR_WINDOW_SECS,
    });
  } catch (e) {
    console.error(`[venue-door-throttle] ${door}: limiter threw — failing open:`, e);
    return { allowed: true, retryAfterSecs: 0, reason: 'limiter_unavailable' };
  }

  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!r || typeof r.ok !== 'boolean') {
    console.error(`[venue-door-throttle] ${door}: unreadable limiter result — failing open`);
    return { allowed: true, retryAfterSecs: 0, reason: 'limiter_unavailable' };
  }
  if (!r.ok) {
    const retry =
      typeof r.retryAfterSecs === 'number' && Number.isFinite(r.retryAfterSecs) && r.retryAfterSecs > 0
        ? Math.ceil(r.retryAfterSecs)
        : VENUE_DOOR_WINDOW_SECS;
    return { allowed: false, retryAfterSecs: retry, reason: 'throttled' };
  }
  return { allowed: true, retryAfterSecs: 0, reason: 'ok' };
}
