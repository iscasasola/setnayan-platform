import { cache } from 'react';
import { guestSessionSurvivesTokenCheck } from '@/lib/guest-session-token-rule';
import { insideRender } from '@/lib/request-once';
import { cachedHubViewer } from '@/lib/hub-request';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import {
  HOST_PREVIEW_PASS_COOKIE_NAME,
  hostPreviewGuestFor,
  passIsHonoured,
  passStanding,
  type PassAccountFacts,
  type PassStanding,
} from '@/lib/pass-account-rule';
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


/**
 * ⏱ A RECENT "YES" IS REMEMBERED FOR AT MOST 30 SECONDS — ON ONE SERVER
 * INSTANCE, IN A RENDER ONLY (event-day load L3, 2026-10-18).
 *
 * Every page a guest opened paid this check again: one `guests` read per view,
 * for a token that had not changed in weeks. Inside a RENDER, a token this
 * instance found current less than `RECENT_YES_MS` ago is taken as current
 * without asking.
 *
 * 🔑 THE WINDOW, STATED: a rotation or a removal revokes a session on its very
 * next check — EXCEPT that a render on an instance that saw the old token
 * current within the last 30 seconds may still draw that guest's page once
 * more, until those 30 seconds end. Nothing else changes:
 *   · a SERVER ACTION never uses it (`insideRender()` is false there): every
 *     write a guest makes is checked against the database, as before — there an
 *     absence denies;
 *   · only a COMPLETED lookup that matched is remembered — never a mismatch,
 *     never a missing row, never the fail-open answer to a lookup that failed;
 *   · the key is the guest and a SHA-256 of the token (the token itself is not
 *     kept), so a rotated token is a different key and is always asked;
 *   · at most `RECENT_YES_MAX` entries; the oldest leaves first.
 * Held by `lib/guest-session-recent-yes.test.ts`.
 */
export const RECENT_YES_MS = 30_000;
const RECENT_YES_MAX = 5_000;
const recentYes = new Map<string, number>();

async function recentYesKey(guestId: string, qrToken: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(qrToken));
    return `${guestId}:${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return null;
  }
}

/**
 * Is this guest's session token still the one on their row? — the chokepoint's
 * question, exported so its memory can be held by a test
 * (`lib/guest-session-recent-yes.test.ts`). Every caller in the app goes
 * through `readGuestSession`.
 */
export function guestSessionTokenStillCurrent(guestId: string, qrToken: string): Promise<boolean> {
  return sessionTokenMatchesDb(guestId, qrToken);
}

/** TEST ONLY — forget every remembered answer. */
export function forgetRecentGuestSessionChecksForTest(): void {
  recentYes.clear();
}

const sessionTokenMatchesDb = cache(
  async (guestId: string, qrToken: string): Promise<boolean> => {
    const key = insideRender() ? await recentYesKey(guestId, qrToken) : null;
    if (key) {
      const until = recentYes.get(key);
      if (until !== undefined && until > Date.now()) return true;
      if (until !== undefined) recentYes.delete(key);
    }
    const remember = (answer: boolean, completed: boolean): boolean => {
      if (key && answer && completed) {
        recentYes.delete(key);
        recentYes.set(key, Date.now() + RECENT_YES_MS);
        if (recentYes.size > RECENT_YES_MAX) recentYes.delete(recentYes.keys().next().value as string);
      }
      return answer;
    };
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
      return remember(
        guestSessionSurvivesTokenCheck({
          cookieToken: qrToken,
          dbToken: (data?.qr_token as string | null | undefined) ?? null,
          lookupFailed: false,
        }),
        true,
      );
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
 * code, is the wrong lever. Production had no dedicated GUEST_SESSION_SECRET
 * when this was written, so deleting the fallback would not "improve" anything;
 * it would sign out every live guest the moment the deploy landed.
 *
 * 🔁 SETTING THE DEDICATED KEY NO LONGER SIGNS ANYBODY OUT (2026-10-25). It used
 * to: the moment GUEST_SESSION_SECRET appeared, every live cookie — all of them
 * sealed with the service-role key — failed to verify. Now there is ONE SIGNER
 * and up to TWO VERIFIERS (`resolveGuestSessionVerifiers`):
 *
 *   · SIGN — always and only with the seal `resolveGuestSessionSecret` picks
 *     (the dedicated key whenever it is present and long enough). Unchanged.
 *   · VERIFY — that same seal first; then, ONLY while a dedicated key is the
 *     signer, the service-role key as a LEGACY verifier. With no dedicated key
 *     there is exactly one verifier and nothing about the old behaviour moved.
 *   · RE-ISSUE — a pass the legacy verifier accepted is re-signed with the
 *     dedicated key on the same response, by the middleware's existing refresh
 *     path (`guestPassRefreshFor` below, applied in middleware.ts). Same payload,
 *     same expiry; only the seal changes. So old cookies migrate as guests visit.
 *
 * Every fail-closed rule below still holds for BOTH seals: a blank, whitespace or
 * too-short service-role key is never used as a legacy verifier, and a dedicated
 * key that is present but too short still refuses outright (it does NOT quietly
 * fall back to the legacy seal for signing — never sign with a non-secret).
 * Which seal verified is logged by NAME only — never a value.
 *
 * 🗓 RETIRING THE LEGACY VERIFIER (not now — record of when it becomes safe):
 * every cookie sealed with the service-role key was minted BEFORE the deploy that
 * first carried GUEST_SESSION_SECRET, and no guest cookie is ever minted with a
 * lifetime longer than COOKIE_MAX_AGE_SECONDS (60 days; the pass book's own
 * expiry is the newest of its passes', so it is bounded the same way). So:
 *   retire it once BOTH hold —
 *     (1) 60 days (COOKIE_MAX_AGE_SECONDS) plus a day of margin have passed since
 *         the first production deploy that had GUEST_SESSION_SECRET set, and
 *     (2) the line "[guest-session] re-sealed a guest pass" has stopped
 *         appearing in production logs.
 * Retiring = delete the legacy branch of `resolveGuestSessionVerifiers` (and the
 * service-role fallback with it, in the same change). Until then, rotating the
 * database key still signs out the guests who have not yet been re-sealed — and
 * only them.
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

export type GuestSessionSeal = { material: string; source: SecretSource };

export type GuestSessionVerifiers =
  | { ok: true; seals: GuestSessionSeal[] }
  | { ok: false; reason: string };

/**
 * The seals a guest token may be VERIFIED with, in order (see "SETTING THE
 * DEDICATED KEY NO LONGER SIGNS ANYBODY OUT" above):
 *
 *   · the signer, always first — exactly `resolveGuestSessionSecret`'s pick, so
 *     an unusable signer leaves NO verifier (fail closed, as before);
 *   · then the service-role key as the LEGACY verifier — only when the signer is
 *     the dedicated key, only when the service-role key itself passes the same
 *     blank/whitespace/too-short judgement, and never when it is byte-identical
 *     to the signer (that would be one seal listed twice).
 *
 * With no dedicated key the list is the single service-role seal: unchanged.
 */
export function resolveGuestSessionVerifiers(env: SecretEnv = process.env): GuestSessionVerifiers {
  const signer = resolveGuestSessionSecret(env);
  if (!signer.ok) return { ok: false, reason: signer.reason };
  const seals: GuestSessionSeal[] = [{ material: signer.material, source: signer.source }];
  if (signer.source === 'dedicated') {
    const legacy = presentValue(env.SUPABASE_SERVICE_ROLE_KEY);
    if (legacy && legacy.trim().length >= MIN_SECRET_CHARS && legacy !== signer.material) {
      seals.push({ material: legacy, source: 'service_role' });
    }
  }
  return { ok: true, seals };
}

/**
 * Every material a guest-seal token or tag may be CHECKED against — signer first.
 * For the other short-lived tokens keyed with this seal (the live-screen pairing,
 * the venue wall's cookie, the Papic queued-shot tag), so setting the dedicated
 * key does not unpair a screen or strand a queued shot either. Empty when no
 * usable seal exists. Never use this to SIGN.
 */
export function guestSessionVerifyMaterials(env: SecretEnv = process.env): string[] {
  const v = resolveGuestSessionVerifiers(env);
  return v.ok ? v.seals.map((s) => s.material) : [];
}

/** The env var's NAME for a seal — the only thing about a seal that is ever logged. */
function sealName(source: SecretSource): string {
  return source === 'dedicated' ? 'GUEST_SESSION_SECRET' : 'SUPABASE_SERVICE_ROLE_KEY';
}

/**
 * Verify `token` against each seal in order; the first that accepts it wins.
 * `legacy` = it was accepted by the service-role seal WHILE a dedicated key is
 * the signer — i.e. it should be re-sealed. A token no seal accepts → null.
 */
async function verifyUnderSeals(
  token: string,
  seals: readonly GuestSessionSeal[],
): Promise<{ payload: JWTPayload; source: SecretSource; legacy: boolean } | null> {
  for (let i = 0; i < seals.length; i += 1) {
    const seal = seals[i]!;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(seal.material));
      const legacy = i > 0;
      if (legacy) noteLegacyVerify(seal.source);
      return { payload, source: seal.source, legacy };
    } catch {
      // not this seal — try the next
    }
  }
  return null;
}

/** One line per process: the legacy seal is still answering (its NAME only). */
let legacyNoted = false;
function noteLegacyVerify(source: SecretSource): void {
  if (legacyNoted) return;
  legacyNoted = true;
  console.warn(
    `[guest-session] a guest pass verified with the legacy seal ${sealName(source)} — honoured, and re-sealed ` +
      'with GUEST_SESSION_SECRET on that guest’s next page visit.',
  );
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
 *
 * 🪪 THE ACCOUNT OUTRANKS THE PASS (owner bug 2026-10-19 — lib/pass-account-rule.ts).
 * When somebody is SIGNED IN, a pass answers here only when it is the account's own
 * row (or a row nobody holds, for an account with no standing on that event — the
 * claim prompt's case), or when a HOST pressed "Open as <name>". A pass that is
 * somebody else's answers NULL — so every one of this reader's callers (the event
 * page, Me, the reply, plus-ones, the seat, Papic, the check-in pass…) sees the
 * account, never the other guest. ONE rule, here, because every pass reader comes
 * through this function (held by `lib/the-account-outranks-the-pass.test.ts`, which
 * also fails a new file that reads the pass cookies around it). Signed out, nothing
 * changes. `readGuestPassStanding` says what was set aside, for the page's one line.
 */
export async function readGuestSession(
  opts?: { eventId?: string | null },
): Promise<GuestSessionPayload | null> {
  return (await readGuestPassStanding(opts)).session;
}

/** A pass this browser holds that was NOT allowed to speak for the signed-in viewer, and why. */
export type SetAsidePass = { pass: GuestSessionPayload; standing: PassStanding };

/**
 * The same answer as `readGuestSession`, with what was SET ASIDE kept: the pass this
 * browser holds that the account outranked (null when nothing was), so a page can say
 * "This browser also holds <name>'s invitation. Viewing as you." `standing` is also
 * returned for an honoured pass ('own' · 'claimant' · 'host_preview' · 'signed_out').
 */
export async function readGuestPassStanding(
  opts?: { eventId?: string | null },
): Promise<{ session: GuestSessionPayload | null; standing: PassStanding | null; setAside: SetAsidePass | null }> {
  const held = await readHeldPass(opts);
  if (!held) return { session: null, standing: null, setAside: null };
  const standing = await standingOfPass(held);
  if (passIsHonoured(standing)) return { session: held, standing, setAside: null };
  return { session: null, standing, setAside: { pass: held, standing } };
}

/**
 * The pass as the COOKIES say it — before the account is asked. Only this file reads it
 * raw: for clearing (sign-out everywhere) and for the account rule itself.
 */
async function readHeldPass(
  opts?: { eventId?: string | null },
): Promise<GuestSessionPayload | null> {
  // 🗄 THE CACHED EVENT HUB (lib/hub-request.ts): the pass its address names, already checked against the guest's
  // CURRENT QR token by the route (the same `sessionTokenMatchesDb` question `checkedSession` asks) — or none.
  const hub = cachedHubViewer();
  if (hub) return hub.pass;
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
  const verifiers = resolveGuestSessionVerifiers();
  if (!resolution.ok || !verifiers.ok) return null; // fail closed, but now it is on the record

  const active = cookie?.value ? await sessionFromToken(cookie.value, verifiers.seals) : null;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The signed-in account's id — `null` signed out, `undefined` when it could not be told
 * (a transport fault). A refused/expired session (any 4xx) is SIGNED OUT, never "unknown":
 * a guest whose old Setnayan sign-in lapsed must keep their invitation.
 */
const signedInAccountId = cache(async (): Promise<string | null | undefined> => {
  // 🗄 The cached Event Hub's viewer carries no Supabase session (lib/hub-request.ts): signed out.
  if (cachedHubViewer()) return null;
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const status = (error as { status?: number }).status;
      if (error.name === 'AuthSessionMissingError' || (typeof status === 'number' && status >= 400 && status < 500)) {
        return null;
      }
      console.error('[guest-session] auth.getUser failed — a held pass is set aside for this request', error.name);
      return undefined;
    }
    return data.user?.id ?? null;
  } catch (err) {
    console.error('[guest-session] auth.getUser threw — a held pass is set aside for this request', err);
    return undefined;
  }
});

/**
 * What the database says about this account and this pass, on the PASS's own event — two
 * primary-key-shaped reads (memoized per request), or null when either failed.
 */
const passAccountFacts = cache(
  async (eventId: string, guestId: string, userId: string): Promise<PassAccountFacts | null> => {
    if (!UUID.test(eventId) || !UUID.test(guestId) || !UUID.test(userId)) return null;
    const admin = createAdminClient();
    const [members, moderators] = await Promise.all([
      admin
        .from('event_members')
        .select('user_id, guest_id, member_type')
        .eq('event_id', eventId)
        .or(`user_id.eq.${userId},guest_id.eq.${guestId}`),
      admin
        .from('event_moderators')
        .select('moderator_id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .not('accepted_at', 'is', null)
        .is('removed_at', null)
        .limit(1),
    ]);
    if (members.error || moderators.error) {
      console.error(
        '[supabase-error] lib/guest-session.ts · pass-account facts',
        members.error ?? moderators.error,
      );
      return null;
    }
    const rows = (members.data ?? []) as Array<{ user_id: string | null; guest_id: string | null; member_type: string | null }>;
    const mine = rows.filter((r) => r.user_id === userId);
    return {
      ownGuestIds: mine.map((r) => r.guest_id).filter((g): g is string => typeof g === 'string'),
      isHost:
        mine.some((r) => r.member_type === 'couple' || r.member_type === 'coordinator') ||
        (moderators.data ?? []).length > 0,
      passRowHolders: rows
        .filter((r) => r.guest_id === guestId)
        .map((r) => r.user_id)
        .filter((u): u is string => typeof u === 'string'),
    };
  },
);

async function standingOfPass(pass: GuestSessionPayload): Promise<PassStanding> {
  const userId = await signedInAccountId();
  if (userId === null) return 'signed_out';
  if (userId === undefined) return 'set_aside_unread';
  const facts = await passAccountFacts(pass.event_id, pass.guest_id, userId);
  const hostPreviewGuestId = hostPreviewGuestFor(
    (await cookies()).get(HOST_PREVIEW_PASS_COOKIE_NAME)?.value,
    pass.event_id,
  );
  return passStanding({ userId, passGuestId: pass.guest_id, facts, hostPreviewGuestId });
}

async function sessionFromToken(
  token: string,
  seals: readonly GuestSessionSeal[],
): Promise<GuestSessionPayload | null> {
  try {
    const verified = await verifyUnderSeals(token, seals);
    if (!verified) return null;
    const { payload } = verified;
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
  /**
   * True when only the LEGACY seal (the service-role key, while a dedicated key
   * signs) accepted it — the middleware re-seals such a pass with the dedicated
   * key on the same response (`guestPassRefreshFor`). Always false with no
   * dedicated key.
   */
  legacySeal: boolean;
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
  const verifiers = resolveGuestSessionVerifiers();
  if (!resolution.ok || !verifiers.ok) return null;

  try {
    const verified = await verifyUnderSeals(token, verifiers.seals);
    if (!verified) return null;
    const { payload } = verified;
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
      legacySeal: verified.legacy,
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
  return (await verifyGuestPassBookSealed(token)).entries;
}

/** The same, saying whether only the LEGACY seal accepted the book (→ re-seal it). */
async function verifyGuestPassBookSealed(
  token: string | null | undefined,
): Promise<{ entries: GuestPassBookEntry[]; legacySeal: boolean }> {
  if (!token) return { entries: [], legacySeal: false };
  const resolution = resolveGuestSessionSecret();
  warnOnce(resolution);
  const verifiers = resolveGuestSessionVerifiers();
  if (!resolution.ok || !verifiers.ok) return { entries: [], legacySeal: false };
  try {
    const verified = await verifyUnderSeals(token, verifiers.seals);
    if (!verified) return { entries: [], legacySeal: false };
    return { entries: bookFromWire(verified.payload.pb), legacySeal: verified.legacy };
  } catch {
    return { entries: [], legacySeal: false };
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

/**
 * THE MIDDLEWARE'S REFRESH, PURE OVER THE JAR — what to write back on a plain
 * page read (the caller has already checked `mayRefreshGuestPass`):
 *
 *   · the sliding window (unchanged): a verified pass with under 30 days left is
 *     re-signed with a fresh 60-day expiry, and its book entry slides with it;
 *   · 🔁 THE RE-SEAL (2026-10-25): a pass, or a book, that only the LEGACY seal
 *     accepted is re-signed with the signer (the dedicated key) — same payload,
 *     SAME expiry — so it migrates off the service-role key without anybody
 *     being signed out. A re-seal is logged by seal NAME, never a value.
 *
 * `null` / 'keep' = leave that cookie alone. An unverifiable pass is never
 * touched (a real page read signs that guest out on its own terms).
 */
export async function guestPassRefreshFor(input: {
  jar: PassJar;
  nowMs?: number;
}): Promise<{ active: { value: string; maxAge: number } | null; book: PassCookieWrite | 'keep' }> {
  const nowMs = input.nowMs ?? Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);
  let active: { value: string; maxAge: number } | null = null;
  let book: PassCookieWrite | 'keep' = 'keep';

  const verified = input.jar.active ? await verifyGuestSessionToken(input.jar.active) : null;
  if (verified && shouldRefreshGuestSession(verified.expiresAtSeconds, nowMs)) {
    const exp = nowSeconds + COOKIE_MAX_AGE_SECONDS;
    active = { value: await signGuestSessionUntil(verified.payload, exp), maxAge: COOKIE_MAX_AGE_SECONDS };
    book = await refreshedPassBook(input.jar.book, verified.payload, exp);
  } else if (verified?.legacySeal) {
    active = {
      value: await signGuestSessionUntil(verified.payload, verified.expiresAtSeconds),
      maxAge: Math.max(1, Math.floor(verified.expiresAtSeconds - nowSeconds)),
    };
  }
  if (verified?.legacySeal) {
    console.info('[guest-session] re-sealed a guest pass: verified by SUPABASE_SERVICE_ROLE_KEY (legacy), re-signed with GUEST_SESSION_SECRET');
  }

  // The book re-seals on its own — it may be legacy while the active pass is not (or is absent).
  if (book === 'keep' && input.jar.book) {
    const sealed = await verifyGuestPassBookSealed(input.jar.book);
    const live = sealed.entries.filter((e) => e.exp > nowSeconds);
    if (sealed.legacySeal && live.length > 0) {
      book = await bookWrite(live, nowSeconds);
      console.info('[guest-session] re-sealed a guest pass book: verified by SUPABASE_SERVICE_ROLE_KEY (legacy), re-signed with GUEST_SESSION_SECRET');
    }
  }
  return { active, book };
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
  // RAW, on purpose: this is for CLEARING every pass the browser holds, whoever it stands for.
  const active = await readHeldPass();
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
