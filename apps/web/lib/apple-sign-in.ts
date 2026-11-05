/**
 * apple-sign-in.ts — TALKING TO APPLE ABOUT A SIGN IN WITH APPLE GRANT:
 * the client secret, the revoke, and the native code exchange.
 *
 * WHY THIS EXISTS. App Store Review Guideline 5.1.1(v): an app that offers Sign
 * in with Apple must revoke the person's Apple grant when they delete their
 * account (POST https://appleid.apple.com/auth/revoke). Apple-readiness check
 * 2026-10-19, row 19, found nothing that did. The erasure purge now calls
 * `revokeAppleToken` (through `ErasureIo.revokeAppleSignIn`) for every account
 * it erases; the token it revokes was held at sign-in
 * (`apple_sign_in_tokens`, migration `apple_sign_in_can_be_revoked`).
 *
 * Pure: NO `server-only`, NO env read at import, NO database — every input is a
 * parameter and `fetch` is injected, so the shapes Apple requires are unit tests
 * rather than hopes. The half that holds the database and the sealed token is
 * `apple-sign-in-store.ts`.
 *
 * ─── WHICH CLIENT ─────────────────────────────────────────────────────────
 * Apple only revokes a token when the request names the SAME client_id that the
 * token was issued to, so every held token records which client issued it:
 *   'web'     → the Services ID configured in Supabase's Apple provider. Used by
 *               the web sign-in AND the Android app (both go through Supabase's
 *               redirect flow).
 *   'ios_app' → the iPhone app's bundle ID. The native Sign in with Apple sheet
 *               issues its codes to the app itself.
 * One key (the Sign in with Apple .p8) signs the client secret for both, as long
 * as the Services ID is grouped under the app's primary App ID.
 *
 * ─── THE SECRETS ARE THE OWNER'S ──────────────────────────────────────────
 * The .p8 private key and the IDs live in Vercel env, never in the repo. When
 * any is missing the revoke answers `not_configured` and erasure goes on — the
 * outcome is recorded, never silent. 🔒 Nothing here logs a token, the key, or
 * the signed secret, and no error text from Apple is echoed with a token in it.
 */

import { createPrivateKey, sign } from 'node:crypto';

export const APPLE_ISSUER = 'https://appleid.apple.com';
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke';
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token';

/** Apple caps a client secret at six months; ours lives five minutes. */
export const CLIENT_SECRET_TTL_S = 300;

export type AppleClient = 'web' | 'ios_app';

/** Env names the owner sets in Vercel. Listed once, read once. */
export const APPLE_SIGN_IN_ENV = {
  teamId: 'APPLE_SIGNIN_TEAM_ID',
  keyId: 'APPLE_SIGNIN_KEY_ID',
  privateKey: 'APPLE_SIGNIN_PRIVATE_KEY',
  webClientId: 'APPLE_SIGNIN_SERVICES_ID',
  appClientId: 'APPLE_SIGNIN_BUNDLE_ID',
} as const;

export type AppleSignInConfig = {
  teamId: string;
  keyId: string;
  /** PKCS#8 PEM (the .p8 file's contents). */
  privateKey: string;
  clientIds: Record<AppleClient, string>;
};

export type AppleConfigRead =
  | { ok: true; config: AppleSignInConfig }
  | { ok: false; missing: string[] };

function clean(v: string | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * The .p8 as Vercel stores it: pasted with real newlines, or on one line with
 * literal `\n`s. Both become a PEM `createPrivateKey` accepts.
 */
export function normalisePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n').trim();
}

/**
 * Read the config for ONE client. A revoke for a web-issued token does not need
 * the bundle ID and vice versa, so only what that client needs is required.
 */
export function readAppleSignInConfig(
  env: Readonly<Record<string, string | undefined>>,
  client: AppleClient,
): AppleConfigRead {
  const teamId = clean(env[APPLE_SIGN_IN_ENV.teamId]);
  const keyId = clean(env[APPLE_SIGN_IN_ENV.keyId]);
  const privateKey = normalisePrivateKey(clean(env[APPLE_SIGN_IN_ENV.privateKey]));
  const web = clean(env[APPLE_SIGN_IN_ENV.webClientId]);
  const app = clean(env[APPLE_SIGN_IN_ENV.appClientId]);
  const missing: string[] = [];
  if (!teamId) missing.push(APPLE_SIGN_IN_ENV.teamId);
  if (!keyId) missing.push(APPLE_SIGN_IN_ENV.keyId);
  if (!privateKey) missing.push(APPLE_SIGN_IN_ENV.privateKey);
  if (client === 'web' && !web) missing.push(APPLE_SIGN_IN_ENV.webClientId);
  if (client === 'ios_app' && !app) missing.push(APPLE_SIGN_IN_ENV.appClientId);
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, config: { teamId, keyId, privateKey, clientIds: { web, ios_app: app } } };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

/**
 * The client secret Apple's REST endpoints require: an ES256 JWT signed with the
 * Sign in with Apple key.
 *   header  { alg: 'ES256', kid: <Key ID> }
 *   claims  { iss: <Team ID>, iat, exp (≤ 6 months), aud: 'https://appleid.apple.com',
 *             sub: <the client_id the token was issued to> }
 * The signature is the raw 64-byte r‖s (JOSE), NOT DER — `dsaEncoding:
 * 'ieee-p1363'`. A DER signature is the classic reason Apple answers
 * `invalid_client` to a secret that "looks right".
 */
export function buildAppleClientSecret(input: {
  teamId: string;
  keyId: string;
  privateKey: string;
  clientId: string;
  now?: Date;
}): string {
  const iat = Math.floor((input.now ?? new Date()).getTime() / 1000);
  const header = { alg: 'ES256', kid: input.keyId };
  const claims = {
    iss: input.teamId,
    iat,
    exp: iat + CLIENT_SECRET_TTL_S,
    aud: APPLE_ISSUER,
    sub: input.clientId,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const key = createPrivateKey(normalisePrivateKey(input.privateKey));
  const signature = sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return `${signingInput}.${b64url(signature)}`;
}

/** What one revoke came to. Every value is recorded by the erasure purge. */
export type AppleRevokeOutcome =
  /** Apple answered 200 — the grant is gone. */
  | { status: 'revoked'; client: AppleClient }
  /** The account has no Apple identity — nothing to revoke, nothing to record. */
  | { status: 'not_apple_linked' }
  /** An Apple-linked account, but no token was ever held (signed in before this
   *  shipped, or the capture failed). Nothing CAN be revoked — recorded. */
  | { status: 'no_token_held' }
  /** The owner has not set the env Apple needs. Recorded; erasure goes on. */
  | { status: 'not_configured'; client: AppleClient; missing: string[] }
  /** Apple refused, the network failed, or the held token could not be opened. */
  | { status: 'failed'; client?: AppleClient; httpStatus?: number; reason: string };

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  status: number;
  ok: boolean;
  text(): Promise<string>;
}>;

/** Apple's error code from a JSON error body, and nothing else from it. */
function appleErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: unknown };
    return typeof parsed?.error === 'string' && /^[a-z_]{1,64}$/.test(parsed.error) ? parsed.error : null;
  } catch {
    return null;
  }
}

/**
 * POST /auth/revoke for one held token. Never throws — a network failure is an
 * outcome like any other, because erasure must not stop on it.
 */
export async function revokeAppleToken(input: {
  env: Readonly<Record<string, string | undefined>>;
  client: AppleClient;
  token: string;
  tokenTypeHint?: 'refresh_token' | 'access_token';
  fetchImpl: FetchLike;
  now?: Date;
}): Promise<AppleRevokeOutcome> {
  const read = readAppleSignInConfig(input.env, input.client);
  if (!read.ok) return { status: 'not_configured', client: input.client, missing: read.missing };
  const clientId = read.config.clientIds[input.client];
  let clientSecret: string;
  try {
    clientSecret = buildAppleClientSecret({ ...read.config, clientId, now: input.now });
  } catch {
    // A malformed .p8. The error text is not echoed — it can quote key bytes.
    return { status: 'failed', client: input.client, reason: 'client_secret_unsignable' };
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    token: input.token,
    token_type_hint: input.tokenTypeHint ?? 'refresh_token',
  }).toString();
  try {
    const res = await input.fetchImpl(APPLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (res.ok) return { status: 'revoked', client: input.client };
    const code = appleErrorCode(await res.text().catch(() => ''));
    return { status: 'failed', client: input.client, httpStatus: res.status, reason: code ?? 'apple_refused' };
  } catch {
    return { status: 'failed', client: input.client, reason: 'network_error' };
  }
}

/** The `sub` claim of an id_token Apple handed us directly over TLS. */
export function idTokenSubject(idToken: unknown): string | null {
  if (typeof idToken !== 'string') return null;
  const part = idToken.split('.')[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { sub?: unknown };
    return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
  } catch {
    return null;
  }
}

export type AppleCodeExchange =
  | { ok: true; refreshToken: string; subject: string | null }
  | { ok: false; reason: string };

/**
 * The phone app's native sheet yields a five-minute authorization code. Trading
 * it at /auth/token (grant_type=authorization_code, client = the bundle ID) is
 * the ONLY way to get a refresh token for a native sign-in — and so the only way
 * that sign-in can ever be revoked. No redirect_uri: native codes carry none.
 */
export async function exchangeAppleAuthorizationCode(input: {
  env: Readonly<Record<string, string | undefined>>;
  code: string;
  fetchImpl: FetchLike;
  now?: Date;
}): Promise<AppleCodeExchange> {
  const read = readAppleSignInConfig(input.env, 'ios_app');
  if (!read.ok) return { ok: false, reason: `not_configured:${read.missing.join(',')}` };
  const clientId = read.config.clientIds.ios_app;
  let clientSecret: string;
  try {
    clientSecret = buildAppleClientSecret({ ...read.config, clientId, now: input.now });
  } catch {
    return { ok: false, reason: 'client_secret_unsignable' };
  }
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    grant_type: 'authorization_code',
  }).toString();
  try {
    const res = await input.fetchImpl(APPLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await res.text().catch(() => '');
    if (!res.ok) return { ok: false, reason: appleErrorCode(text) ?? `http_${res.status}` };
    const parsed = JSON.parse(text) as { refresh_token?: unknown; id_token?: unknown };
    if (typeof parsed.refresh_token !== 'string' || parsed.refresh_token.length === 0) {
      return { ok: false, reason: 'no_refresh_token' };
    }
    return { ok: true, refreshToken: parsed.refresh_token, subject: idTokenSubject(parsed.id_token) };
  } catch {
    return { ok: false, reason: 'network_error' };
  }
}

type IdentityLike = {
  provider?: unknown;
  id?: unknown;
  identity_id?: unknown;
  identity_data?: { sub?: unknown } | null;
  last_sign_in_at?: unknown;
};
type UserLike = { identities?: IdentityLike[] | null } | null | undefined;

/** The person's Apple identity, if they have one. */
export function appleIdentity(user: UserLike): IdentityLike | null {
  return (user?.identities ?? []).find((i) => i?.provider === 'apple') ?? null;
}

/** The Apple user id (`sub`) on that identity. */
export function appleSubject(user: UserLike): string | null {
  const ident = appleIdentity(user);
  if (!ident) return null;
  const sub = ident.identity_data?.sub ?? ident.id;
  return typeof sub === 'string' && sub.length > 0 ? sub : null;
}

/**
 * Was THIS sign-in the Apple one? A code exchange does not say which provider it
 * came from, and a person may have Google and Apple both linked — so
 * `provider_refresh_token` is only Apple's when the Apple identity is the one
 * signed in most recently. Fails closed: no timestamps → false → nothing held.
 */
export function appleWasJustUsed(user: UserLike): boolean {
  const ids = (user?.identities ?? []).filter(Boolean);
  let latest: IdentityLike | null = null;
  let latestAt = -Infinity;
  for (const i of ids) {
    const at = typeof i.last_sign_in_at === 'string' ? Date.parse(i.last_sign_in_at) : NaN;
    if (Number.isFinite(at) && at > latestAt) {
      latest = i;
      latestAt = at;
    }
  }
  return latest?.provider === 'apple';
}
