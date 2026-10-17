import 'server-only';

import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveGuestSessionSecret } from '@/lib/guest-session';
import { enforceRateLimit } from '@/lib/with-rate-limit';
import { joinDoorIdent, readJoinDoorIp } from '@/lib/join-door-throttle';
import { normalizeNamePart, type FormalName } from '@/lib/formal-name';
import type { FindableRow } from '@/lib/find-me';

/**
 * The server half of "THE GENERIC QR FINDS YOU" (lib/find-me.ts holds the
 * rules). Three things live here, and nothing else:
 *
 *   1. THE FIND STATE — what this browser typed and what the door answered,
 *      held for 15 minutes in ONE httpOnly cookie that is ENCRYPTED (not just
 *      signed): it carries the matched guest's internal id, and the browser
 *      must not be able to read it, let alone choose it. It is NOT a guest
 *      session and opens nothing — no guest page reads it. The only thing that
 *      lets anybody in is the redeem hop, the personal QR's own door.
 *   2. THE CANDIDATE READ — every row of the event the rules could match, in
 *      ONE query whatever was typed, so "found" and "not found" cost the same.
 *   3. THE BUDGETS — the durable two-layer limiter (lib/with-rate-limit.ts),
 *      no second mechanism. Its L2 writes each attempt into
 *      `public.rate_limit_hits`, which is also the attempt log.
 */

export const FIND_ME_COOKIE = 'sn_find_me';
const FIND_ME_MAX_AGE_SECS = 15 * 60;

/**
 * 📶 THIS PHONE, FOR THE BUDGETS (event-day L1·5 — see lib/find-me.ts). A random
 * id in an httpOnly cookie, SIGNED so nobody can pick another phone's id and
 * spend its budget. It identifies nothing and opens nothing: it is only the key
 * the per-phone limits are counted under. Kept a day — longer than any arrival.
 */
export const FIND_DEVICE_COOKIE = 'sn_find_device';
const FIND_DEVICE_MAX_AGE_SECS = 24 * 60 * 60;
const DEVICE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function deviceMac(id: string): string | null {
  const r = resolveGuestSessionSecret();
  if (!r.ok) return null;
  return createHmac('sha256', `setnayan-find-device:${r.material}`).update(id).digest('base64url');
}

/**
 * This phone's id — read from its signed cookie, or minted and set now. Null
 * only when no secret is configured (then the per-connection budget is the
 * only one, at the per-phone numbers: the old behaviour, fail-tight).
 */
export async function findDeviceId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(FIND_DEVICE_COOKIE)?.value ?? '';
  const [id, mac] = raw.split('.');
  if (id && mac && DEVICE_ID.test(id)) {
    const want = deviceMac(id);
    if (want && want.length === mac.length && timingSafeEqual(Buffer.from(want), Buffer.from(mac))) return id;
  }
  const fresh = randomUUID();
  const sig = deviceMac(fresh);
  if (!sig) return null;
  jar.set(FIND_DEVICE_COOKIE, `${fresh}.${sig}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: FIND_DEVICE_MAX_AGE_SECS,
  });
  return fresh;
}

export type FindState = {
  eventId: string;
  parts: FormalName;
  /** The door's answer. `confirm` is also where too many wrong digits land. */
  outcome: 'none' | 'digits' | 'confirm';
  /** The one matched guest — `digits`, or `confirm` with a single match. */
  guestId: string | null;
};

function findKey(): Uint8Array | null {
  const r = resolveGuestSessionSecret();
  if (!r.ok) return null;
  // A key of its own, derived from the seal — a find cookie can never be read
  // as (or forged into) a guest session, which is a signed JWT of another shape.
  return new Uint8Array(createHash('sha256').update(`setnayan-find-me:${r.material}`).digest());
}

export async function writeFindState(state: FindState): Promise<void> {
  const key = findKey();
  if (!key) return;
  const token = await new EncryptJWT({
    e: state.eventId,
    p: state.parts,
    o: state.outcome,
    g: state.guestId,
  })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${FIND_ME_MAX_AGE_SECS}s`)
    .encrypt(key);
  const jar = await cookies();
  jar.set(FIND_ME_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: FIND_ME_MAX_AGE_SECS,
  });
}

export async function forgetFindState(): Promise<void> {
  const jar = await cookies();
  jar.delete(FIND_ME_COOKIE);
}

const OUTCOMES = new Set(['none', 'digits', 'confirm']);

/** This browser's find state FOR THIS EVENT, or null (absent, expired, tampered, another event). */
export async function readFindState(eventId: string): Promise<FindState | null> {
  const jar = await cookies();
  const raw = jar.get(FIND_ME_COOKIE)?.value;
  const key = raw ? findKey() : null;
  if (!raw || !key) return null;
  try {
    const { payload } = await jwtDecrypt(raw, key);
    if (payload.e !== eventId || typeof payload.o !== 'string' || !OUTCOMES.has(payload.o)) return null;
    const p = (payload.p ?? {}) as Record<string, unknown>;
    const parts: FormalName = {
      name_prefix: normalizeNamePart(p.name_prefix),
      first_name: normalizeNamePart(p.first_name),
      middle_name: normalizeNamePart(p.middle_name),
      last_name: normalizeNamePart(p.last_name),
      name_suffix: normalizeNamePart(p.name_suffix),
    };
    if (!parts.first_name || !parts.last_name) return null;
    return {
      eventId,
      parts,
      outcome: payload.o as FindState['outcome'],
      guestId: typeof payload.g === 'string' ? payload.g : null,
    };
  } catch {
    return null;
  }
}

/**
 * What the find-me door reads of a guest — a narrow, purpose-built list, NOT
 * a canonical `guests` shape (so not exported, and not named `*_COLUMNS`: the
 * dup-rule lint would hold every other `guests` read to it).
 */
const findableSelect =
  'guest_id, first_name, middle_name, last_name, name_suffix, role, extra_roles, entry_source, deleted_at, passed_away, mobile, qr_token';

/** One guest, LIVE, for the last-4 check — the row and whether an account holds it. */
export async function readFindableRow(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
): Promise<{ row: FindableRow | null; bound: Set<string> }> {
  const [{ data: row }, { data: holder }] = await Promise.all([
    admin.from('guests').select(findableSelect).eq('guest_id', guestId).eq('event_id', eventId).maybeSingle(),
    admin.from('event_members').select('guest_id').eq('event_id', eventId).eq('guest_id', guestId).maybeSingle(),
  ]);
  return { row: (row as unknown as FindableRow | null) ?? null, bound: new Set<string>(holder ? [guestId] : []) };
}

/**
 * Every row of the event the door may look at, and which of them an account
 * already holds. ONE shape of read whatever the name — the same two queries
 * run for a hit and a miss. `null` when either read failed: the caller then
 * treats it as "not found" (the ask-to-join form), never as a match.
 */
export async function loadFindableRows(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<{ rows: FindableRow[]; bound: Set<string> } | null> {
  const [{ data: rows, error }, { data: members, error: memberError }] = await Promise.all([
    admin
      .from('guests')
      .select(findableSelect)
      .eq('event_id', eventId)
      .eq('entry_source', 'host_seeded')
      .is('deleted_at', null)
      .limit(3000),
    admin.from('event_members').select('guest_id').eq('event_id', eventId).not('guest_id', 'is', null),
  ]);
  if (error || memberError || !rows || !members) {
    console.error('[supabase-error] lib/find-me.server.ts · loadFindableRows', error ?? memberError);
    return null;
  }
  return {
    rows: rows as unknown as FindableRow[],
    bound: new Set(members.map((m) => m.guest_id as string)),
  };
}

/**
 * Spend ONE slot of a budget. FAILS CLOSED when the limiter throws (it never
 * answers "help yourself" to a guessing loop). ⚠ The limiter's own L2 fails
 * OPEN on a database hiccup (lib/with-rate-limit.ts, by design) — the per-
 * instance L1 still counts then.
 */
/** The limiter's shape — `enforceRateLimit`, or a test's in-memory one. */
export type FindLimiter = (bucket: string, ident: string, opts: { limit: number; windowSecs: number }) => Promise<{ ok: boolean }>;

async function spend(bucket: string, ident: string, limit: number, windowSecs: number, limiter: FindLimiter = enforceRateLimit): Promise<boolean> {
  try {
    const r = await limiter(bucket, ident, { limit, windowSecs });
    return r.ok === true;
  } catch (e) {
    console.error(`[find-me] limiter threw on ${bucket} — failing closed`, e);
    return false;
  }
}

export type FindBudgets = {
  /** Per phone (the signed device cookie). */
  device: number;
  /** Per connection — sized for a whole venue on one Wi-Fi address. */
  venue: number;
  windowSecs: number;
};

/**
 * One name look-up from this PHONE and this CONNECTION on this event — both
 * budgets are spent, both must allow it. No IP readable → only the phone's
 * (see join-door-throttle). No phone id (no secret) → the connection is held to
 * the PHONE's number, exactly the budget this door had before.
 */
export async function spendNameLookup(
  eventId: string,
  h: Headers,
  device: string | null,
  limits: FindBudgets,
  limiter?: FindLimiter,
): Promise<boolean> {
  const ip = readJoinDoorIp(h);
  const [byDevice, byIp] = await Promise.all([
    device ? spend('guest_find_me_name_device', `${eventId}:${device}`, limits.device, limits.windowSecs, limiter) : Promise.resolve(true),
    ip ? spend('guest_find_me_name', joinDoorIdent(eventId, ip), device ? limits.venue : limits.device, limits.windowSecs, limiter) : Promise.resolve(true),
  ]);
  return byDevice && byIp;
}

/**
 * One last-4 try: spends THIS PHONE's budget, the CONNECTION's budget on this
 * event (sized for a venue — see lib/find-me.ts), and the matched guest's own
 * budget (every connection together — a botnet guessing one guest's digits
 * still gets 5 tries). Any one out → false.
 */
export async function spendDigitsTry(
  eventId: string,
  guestId: string,
  h: Headers,
  device: string | null,
  limits: FindBudgets & { row: number },
  limiter?: FindLimiter,
): Promise<boolean> {
  const ip = readJoinDoorIp(h);
  const [byDevice, byIp, byRow] = await Promise.all([
    device ? spend('guest_find_me_digits_device', `${eventId}:${device}`, limits.device, limits.windowSecs, limiter) : Promise.resolve(true),
    ip ? spend('guest_find_me_digits_ip', joinDoorIdent(eventId, ip), device ? limits.venue : limits.device, limits.windowSecs, limiter) : Promise.resolve(true),
    spend('guest_find_me_digits_row', `${eventId}:${guestId}`, limits.row, limits.windowSecs, limiter),
  ]);
  return byDevice && byIp && byRow;
}

/** The attempt log line — never a digit, never a name. */
export function logFindAttempt(entry: {
  eventId: string;
  guestId: string | null;
  step: 'name' | 'digits';
  outcome: string;
}): void {
  console.info(`[find-me] ${JSON.stringify(entry)}`);
}
