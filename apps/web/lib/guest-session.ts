import { cache } from 'react';
import { guestSessionSurvivesTokenCheck } from '@/lib/guest-session-token-rule';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  GUEST_PASS_BOOK_COOKIE_NAME,
  bookEntryForPath,
  bookExp,
  bookFromWire,
  bookToWire,
  bookWithExp,
  bookWithout,
  mergeIntoBook,
  type GuestPassBookEntry,
} from '@/lib/guest-pass-book';

const COOKIE_NAME = 'setnayan_guest_session';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60; // 60 days — covers up-to-30-day post-event window

/**
 * The cookie is set ONCE — at redeem/claim/rotate — and never again. A guest
 * who first opens the site well before the wedding (a save-the-date QR, a
 * save-the-seat link) and keeps returning through the up-to-30-day post-event
 * window can still run past 60 days total elapsed since that first mint, even
 * though every visit in between was active use. Nothing re-sets the cookie on
 * an ordinary page read, so that guest is signed out mid-event with no way
 * back in but a fresh QR scan.
 *
 * The fix is a sliding window, applied in middleware (the only place a
 * request can both read and rewrite a cookie without landing in a Server
 * Component or Server Action): once less than half the max age remains on a
 * verified cookie, re-sign the SAME payload with a fresh 60-day expiry. A
 * guest who returns at least once every 30 days never sees the boundary; one
 * who doesn't falls back to the QR, same as today.
 *
 * Deliberately DB-free — `readGuestSession()`'s qr_token/deleted_at
 * revalidation stays the one chokepoint that can revoke a session; this only
 * decides whether to extend a cookie that a real page read will still
 * re-check on its own next use. Extending the cookie of a session that gets
 * revoked a moment later does not restore anything the DB check would have
 * blocked.
 */
export const GUEST_SESSION_COOKIE_NAME = COOKIE_NAME;
export const GUEST_SESSION_COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_SECONDS;
const REFRESH_WINDOW_SECONDS = COOKIE_MAX_AGE_SECONDS / 2; // 30 days

/**
 * QR-rotation session revocation (build ④ · council § 5.11). The 60-day JWT
 * embeds the guest's qr_token at mint time; without this check a session
 * minted from a LEAKED QR survives up to 60 days after the host/guest rotates
 * the token. Every readGuestSession() additionally verifies the embedded
 * qr_token still matches guests.qr_token — a mismatch means the token was
 * rotated since this session was minted, and the session is treated as signed
 * out.
 *
 * ⚠ UNCONDITIONAL SINCE 2026-09-17. This was gated on GUEST_SESSION_TOKEN_CHECK,
 * which is NOT SET in production, so the check never ran and rotation did not
 * revoke anything — the leaked browser stayed signed in and was then shown the
 * REPLACEMENT code. The flag was deleted rather than set: a flag whose prod
 * value nobody can read is how this shipped dark.
 *
 * COST (measured shape): exactly one primary-key SELECT on guests per
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
      // ⚠ `error` is a lookup that did not COMPLETE — fail open. A completed
      // lookup that found no row is `data === null`, which is a definitive
      // answer and revokes. The pure rule keeps those two apart.
      if (error) {
        return guestSessionSurvivesTokenCheck({
          cookieToken: qrToken,
          dbToken: null,
          lookupFailed: true,
        });
      }
      return guestSessionSurvivesTokenCheck({
        cookieToken: qrToken,
        dbToken: (data?.qr_token as string | null | undefined) ?? null,
        lookupFailed: false,
      });
    } catch {
      // Admin client unavailable (e.g. a CI build with no service key) — the
      // lookup never happened, so this is fail-open territory too.
      return guestSessionSurvivesTokenCheck({
        cookieToken: qrToken,
        dbToken: null,
        lookupFailed: true,
      });
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

/** The same pass, expiring at an ABSOLUTE time — a pass from the book keeps its own expiry. */
export async function signGuestSessionUntil(
  payload: GuestSessionPayload,
  expSeconds: number,
): Promise<string> {
  return await new SignJWT({
    guest_id: payload.guest_id,
    event_id: payload.event_id,
    qr_token: payload.qr_token,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expSeconds))
    .sign(getSecret());
}

/**
 * The guest pass this request carries — the ACTIVE pass (`setnayan_guest_session`).
 *
 * 🔑 `{ eventId }` (2026-10-12, one pass per event — lib/guest-pass-book.ts): when
 * the active pass is not this event's, this event's pass is looked up in the
 * PASS BOOK by its event id, and answered with the same DB check. With no pass
 * for this event anywhere, the answer is exactly what it was without the option
 * (the active pass, whichever event it names) — callers still compare.
 */
export async function readGuestSession(
  opts?: { eventId?: string | null },
): Promise<GuestSessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  const wanted = opts?.eventId ?? null;
  const bookToken = wanted ? cookieStore.get(GUEST_PASS_BOOK_COOKIE_NAME)?.value : undefined;
  if (!cookie?.value && !bookToken) return null;

  // Resolve the seal OUTSIDE the catch-all below. A misconfigured seal and a
  // forged cookie both end in "signed out", but they are not the same event and
  // must not look the same to whoever is reading the logs at the time. Left
  // inside the try, a missing secret was swallowed by `catch { return null }` —
  // silence, on every request, for a deploy-wide fault.
  const resolution = resolveGuestSessionSecret();
  warnOnce(resolution);
  if (!resolution.ok) return null; // fail closed, but now it is on the record

  const active = cookie?.value ? await sessionFromToken(cookie.value, resolution.material) : null;
  if (!wanted || active?.event_id === wanted || !bookToken) return active;

  // This event's pass, from the book — verified by the same seal, DB-checked the same way.
  const entry = (await verifyGuestPassBook(bookToken)).find(
    (e) => e.event_id === wanted && e.exp > Date.now() / 1000,
  );
  if (!entry) return active;
  const fromBook = await checkedSession({
    guest_id: entry.guest_id,
    event_id: entry.event_id,
    qr_token: entry.qr_token,
  });
  return fromBook ?? active;
}

async function sessionFromToken(token: string, material: string): Promise<GuestSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(material));
    if (
      typeof payload.guest_id !== 'string' ||
      typeof payload.event_id !== 'string' ||
      typeof payload.qr_token !== 'string'
    ) {
      return null;
    }
    return await checkedSession({
      guest_id: payload.guest_id,
      event_id: payload.event_id,
      qr_token: payload.qr_token,
    });
  } catch {
    return null;
  }
}

async function checkedSession(session: GuestSessionPayload): Promise<GuestSessionPayload | null> {
  /*
    DB re-validation at the chokepoint — UNCONDITIONAL since 2026-09-17.
    Every consumer passes through here (24 files import this reader), so
    validating once means none can be missed. A pass taken from the pass book
    (lib/guest-pass-book.ts) passes through here too.

    🔴 IT USED TO BE GATED ON `GUEST_SESSION_TOKEN_CHECK`, WHICH IS NOT SET IN
    PRODUCTION. `envFlagEnabled` returns false for a non-string, so the check
    never ran — and the consequence inverted the feature it belonged to: a
    couple rotating a LEAKED guest QR left the leaked browser signed in, and
    that still-valid session was then shown the REPLACEMENT code. Revoking
    the leak handed the leak the new key.

    ⚠ THE FLAG WAS DELETED RATHER THAN SET. A flag whose production value
    nobody can read is how this shipped dark for months; setting it would
    leave the same mechanism for the next person. Turning this off is now a
    code change a reviewer can see.
  */
  const ok = await sessionTokenMatchesDb(session.guest_id, session.qr_token);
  if (!ok) return null;
  return session;
}

export type VerifiedGuestSessionToken = {
  payload: GuestSessionPayload;
  expiresAtSeconds: number;
};

/**
 * Signature-only verification, with the token's `exp` claim, for middleware's
 * sliding-window refresh. No DB call — see the comment above
 * REFRESH_WINDOW_SECONDS for why that is deliberate. Never use this as a
 * substitute for readGuestSession()'s DB-backed check when deciding whether a
 * request is allowed to act as a guest.
 */
export async function verifyGuestSessionToken(
  token: string,
): Promise<VerifiedGuestSessionToken | null> {
  const resolution = resolveGuestSessionSecret();
  warnOnce(resolution);
  if (!resolution.ok) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(resolution.material));
    if (
      typeof payload.guest_id !== 'string' ||
      typeof payload.event_id !== 'string' ||
      typeof payload.qr_token !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    return {
      payload: {
        guest_id: payload.guest_id,
        event_id: payload.event_id,
        qr_token: payload.qr_token,
      },
      expiresAtSeconds: payload.exp,
    };
  } catch {
    return null;
  }
}

/**
 * Pure so it can be tested against a fixed clock without minting real JWTs.
 * True once fewer than REFRESH_WINDOW_SECONDS remain before `exp`.
 */
export function shouldRefreshGuestSession(
  expiresAtSeconds: number,
  nowMs: number = Date.now(),
): boolean {
  const remainingSeconds = expiresAtSeconds - nowMs / 1000;
  return remainingSeconds < REFRESH_WINDOW_SECONDS;
}


/* ══ ONE PASS PER EVENT — THE PASS BOOK (2026-10-12, lib/guest-pass-book.ts) ══
   The active pass above is unchanged. Beside it, `setnayan_guest_passes` holds
   one pass per event (the same seal), so opening event B's link never evicts
   event A's pass. Every writer below keeps the two in step. */

export { GUEST_PASS_BOOK_COOKIE_NAME };

const PASS_COOKIE = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };

/** A cookie value to write, or `null` to delete that cookie. */
export type PassCookieWrite = { value: string; maxAge: number } | null;

/** The pass book's own token: a distinct claim (`pb`), so it can never pass for a pass. */
export async function signGuestPassBook(entries: readonly GuestPassBookEntry[]): Promise<string> {
  return await new SignJWT({ pb: bookToWire(entries) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(bookExp(entries)))
    .sign(getSecret());
}

/** The book's passes (signature only — every pass taken from it is DB-checked on use). */
export async function verifyGuestPassBook(
  token: string | null | undefined,
): Promise<GuestPassBookEntry[]> {
  if (!token) return [];
  const resolution = resolveGuestSessionSecret();
  warnOnce(resolution);
  if (!resolution.ok) return [];
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(resolution.material));
    return bookFromWire(payload.pb);
  } catch {
    return [];
  }
}

async function bookWrite(entries: readonly GuestPassBookEntry[], nowSeconds: number): Promise<PassCookieWrite> {
  if (entries.length === 0) return null;
  return {
    value: await signGuestPassBook(entries),
    maxAge: Math.max(1, Math.floor(bookExp(entries) - nowSeconds)),
  };
}

/** A browser's two pass cookies, as the request carries them. */
export type PassJar = { active?: string | null; book?: string | null };

/** Event id → slug, for the book's routing hints. A failed lookup answers what it could. */
export type SlugLookup = (eventIds: readonly string[]) => Promise<Record<string, string>>;

/**
 * THE PASS WRITE — pure over the jar, so the guard can run it with no request:
 * the new pass becomes the active one AND this event's entry in the book; the
 * pass it replaces (a legacy single cookie too) moves into the book.
 */
export async function nextPassCookies(
  jar: PassJar,
  payload: GuestSessionPayload,
  lookupSlugs: SlugLookup,
  nowMs: number = Date.now(),
): Promise<{ active: { value: string; maxAge: number }; book: PassCookieWrite }> {
  const nowSeconds = Math.floor(nowMs / 1000);
  const exp = nowSeconds + COOKIE_MAX_AGE_SECONDS;
  const active = { value: await signGuestSessionUntil(payload, exp), maxAge: COOKIE_MAX_AGE_SECONDS };

  const book = await verifyGuestPassBook(jar.book);
  const prior = jar.active ? await verifyGuestSessionToken(jar.active) : null;
  const incoming: Omit<GuestPassBookEntry, 'slug'>[] = [{ ...payload, exp }];
  if (prior && prior.payload.event_id !== payload.event_id) {
    incoming.push({ ...prior.payload, exp: prior.expiresAtSeconds });
  }
  // The new event's slug is always asked (a renamed slug heals); the prior's only when the book lacks it.
  const known = new Map(book.filter((e) => e.slug).map((e) => [e.event_id, e.slug!]));
  const ask = incoming.filter((e, i) => i === 0 || !known.has(e.event_id)).map((e) => e.event_id);
  let slugs: Record<string, string> = {};
  try {
    slugs = await lookupSlugs(ask);
  } catch {
    slugs = {};
  }
  const entries: GuestPassBookEntry[] = incoming.map((e) => ({
    ...e,
    slug: (slugs[e.event_id] ?? known.get(e.event_id) ?? null)?.toLowerCase() ?? null,
  }));
  return { active, book: await bookWrite(mergeIntoBook(book, entries, nowSeconds), nowSeconds) };
}

/**
 * THE PASS CLEAR — one event's pass leaves the book; the active pass goes only
 * when it IS that event's (or cannot be read, or the event could not be told —
 * then the old answer, signed out). Another event's active pass stays. When the
 * active pass goes and the book still holds another event's pass, the newest of
 * those becomes the active one — so a sign-out on A never leaves B's open tab
 * (or its Papic pages, which have no slug) without its pass.
 *
 * ⚠ On the sign-out hop the middleware has swapped the REQUEST's active pass to
 * this event's (never the response's — one writer per hop), so the browser's own
 * active cookie may be B's while this sees A's. Deleting it is then repaired by
 * the same rule: B, still in the book, is written back as the active pass.
 */
export async function clearedPassCookies(
  jar: PassJar,
  scope: { eventId: string | null; slug?: string | null },
  nowMs: number = Date.now(),
): Promise<{ active: 'keep' | 'delete' | { value: string; maxAge: number }; book: PassCookieWrite | 'keep' }> {
  const nowSeconds = Math.floor(nowMs / 1000);
  const prior = jar.active ? await verifyGuestSessionToken(jar.active) : null;
  // A slug whose event could not be told clears by slug alone (and signs the active pass out).
  const eventId = scope.eventId ?? (scope.slug ? null : (prior?.payload.event_id ?? null));
  const keepActive = Boolean(jar.active && prior && eventId && prior.payload.event_id !== eventId);
  const book = await verifyGuestPassBook(jar.book);
  const remaining = mergeIntoBook([], bookWithout(book, { eventId, slug: scope.slug }), nowSeconds);
  const bookNext: PassCookieWrite | 'keep' = jar.book ? await bookWrite(remaining, nowSeconds) : 'keep';
  if (keepActive) return { active: 'keep', book: bookNext };
  const heir = remaining[0];
  if (!heir) return { active: 'delete', book: bookNext };
  return {
    active: {
      value: await signGuestSessionUntil(
        { guest_id: heir.guest_id, event_id: heir.event_id, qr_token: heir.qr_token },
        heir.exp,
      ),
      maxAge: Math.max(1, Math.floor(heir.exp - nowSeconds)),
    },
    book: bookNext,
  };
}

/**
 * THE MIDDLEWARE'S SWAP — on a request for one event's pages, that event's pass
 * from the book, signed as the active pass with ITS OWN expiry; `null` when the
 * book has none for this address, or the active pass already is this event's.
 */
export async function passSwapForPath(input: {
  jar: PassJar;
  pathname: string;
  nowMs?: number;
}): Promise<{ value: string; maxAge: number } | null> {
  if (!input.jar.book) return null;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const entry = bookEntryForPath(await verifyGuestPassBook(input.jar.book), input.pathname, nowSeconds);
  if (!entry) return null;
  if (input.jar.active) {
    const active = await verifyGuestSessionToken(input.jar.active);
    if (active && active.payload.event_id === entry.event_id) return null;
  }
  return {
    value: await signGuestSessionUntil(
      { guest_id: entry.guest_id, event_id: entry.event_id, qr_token: entry.qr_token },
      entry.exp,
    ),
    maxAge: Math.max(1, Math.floor(entry.exp - nowSeconds)),
  };
}

/** The book with one refreshed pass's new expiry (the middleware's sliding refresh); null = unchanged. */
export async function refreshedPassBook(
  bookToken: string | null | undefined,
  pass: GuestSessionPayload,
  exp: number,
): Promise<PassCookieWrite | 'keep'> {
  if (!bookToken) return 'keep';
  const next = bookWithExp(await verifyGuestPassBook(bookToken), pass, exp);
  if (!next) return 'keep';
  return await bookWrite(next, Math.floor(Date.now() / 1000));
}

/** Event id → slug from the database (the book's routing hints). */
async function eventSlugs(eventIds: readonly string[]): Promise<Record<string, string>> {
  if (eventIds.length === 0) return {};
  const { data, error } = await createAdminClient()
    .from('events')
    .select('event_id, slug')
    .in('event_id', [...eventIds]);
  if (error) {
    // The pass itself is written regardless; an entry with no slug is still found by event id.
    console.error('[supabase-error] lib/guest-session.ts · from:events.select (pass book slugs)', error);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (typeof row.event_id === 'string' && typeof row.slug === 'string') out[row.event_id] = row.slug;
  }
  return out;
}

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** A slug → its event id; `null` when it cannot be told (unsafe, unknown, or the read failed). */
export async function eventIdForSlug(slug: string): Promise<string | null> {
  const s = slug.trim().toLowerCase();
  if (!SAFE_SLUG.test(s)) return null;
  const { data, error } = await createAdminClient()
    .from('events')
    .select('event_id')
    .ilike('slug', s)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/guest-session.ts · from:events.select (sign-out event)', error);
    return null;
  }
  return typeof data?.event_id === 'string' ? data.event_id : null;
}

export async function setGuestSession(payload: GuestSessionPayload): Promise<void> {
  const cookieStore = await cookies();
  const jar: PassJar = {
    active: cookieStore.get(COOKIE_NAME)?.value,
    book: cookieStore.get(GUEST_PASS_BOOK_COOKIE_NAME)?.value,
  };
  const next = await nextPassCookies(jar, payload, eventSlugs);
  cookieStore.set({ name: COOKIE_NAME, value: next.active.value, ...PASS_COOKIE, maxAge: next.active.maxAge });
  if (next.book) {
    cookieStore.set({ name: GUEST_PASS_BOOK_COOKIE_NAME, value: next.book.value, ...PASS_COOKIE, maxAge: next.book.maxAge });
  }
}

/**
 * A guest's sign-out on ONE event (`/{slug}/sign-out`, the plus-one's "not me"):
 * THAT event's pass goes — from the book, and as the active pass when it is the
 * active one. Every other event's pass stays. ("Sign out everywhere" —
 * `/auth/sign-out` — deletes both cookies itself.) With no slug, the active
 * pass's own event is the one cleared.
 */
export async function clearGuestSession(
  scope?: { slug?: string | null; eventId?: string | null },
): Promise<{ eventId: string | null }> {
  const cookieStore = await cookies();
  const jar: PassJar = {
    active: cookieStore.get(COOKIE_NAME)?.value,
    book: cookieStore.get(GUEST_PASS_BOOK_COOKIE_NAME)?.value,
  };
  const eventId = scope?.eventId ?? (scope?.slug ? await eventIdForSlug(scope.slug) : null);
  const next = await clearedPassCookies(jar, { eventId, slug: scope?.slug ?? null });
  if (next.active === 'delete') cookieStore.delete(COOKIE_NAME);
  else if (next.active !== 'keep') {
    cookieStore.set({ name: COOKIE_NAME, value: next.active.value, ...PASS_COOKIE, maxAge: next.active.maxAge });
  }
  if (next.book === null) cookieStore.delete(GUEST_PASS_BOOK_COOKIE_NAME);
  else if (next.book !== 'keep') {
    cookieStore.set({ name: GUEST_PASS_BOOK_COOKIE_NAME, value: next.book.value, ...PASS_COOKIE, maxAge: next.book.maxAge });
  }
  return { eventId };
}

/** Every pass this browser holds that still checks out — the active one first (for "sign out everywhere"). */
export async function readEveryGuestPass(): Promise<GuestSessionPayload[]> {
  const cookieStore = await cookies();
  const active = await readGuestSession();
  const out: GuestSessionPayload[] = active ? [active] : [];
  for (const e of await verifyGuestPassBook(cookieStore.get(GUEST_PASS_BOOK_COOKIE_NAME)?.value)) {
    if (out.some((p) => p.event_id === e.event_id && p.guest_id === e.guest_id)) continue;
    if (e.exp <= Date.now() / 1000) continue;
    const checked = await checkedSession({ guest_id: e.guest_id, event_id: e.event_id, qr_token: e.qr_token });
    if (checked) out.push(checked);
  }
  return out;
}

/** How many passes the book holds (a COUNT — the Problems log's evidence, never a value). */
export async function guestPassBookSize(): Promise<number> {
  const cookieStore = await cookies();
  return (await verifyGuestPassBook(cookieStore.get(GUEST_PASS_BOOK_COOKIE_NAME)?.value)).length;
}
