/**
 * lib/apple-sign-in.test.ts — the shapes Apple requires, as tests.
 *
 * App Store 5.1.1(v): erasure revokes the Sign in with Apple grant
 * (POST appleid.apple.com/auth/revoke). Apple answers `invalid_client` to a
 * client secret with the wrong claims or a DER signature, and the request goes
 * nowhere if the form body is wrong — so each is pinned here against a real
 * P-256 key generated for the test (never the owner's).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import {
  APPLE_ISSUER,
  APPLE_REVOKE_URL,
  APPLE_SIGN_IN_ENV,
  APPLE_TOKEN_URL,
  CLIENT_SECRET_TTL_S,
  appleWasJustUsed,
  buildAppleClientSecret,
  exchangeAppleAuthorizationCode,
  readAppleSignInConfig,
  revokeAppleToken,
} from './apple-sign-in';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const ENV = {
  [APPLE_SIGN_IN_ENV.teamId]: 'TEAM123456',
  [APPLE_SIGN_IN_ENV.keyId]: 'KEY1234567',
  // Stored on one line with literal \n, the way a Vercel paste often lands.
  [APPLE_SIGN_IN_ENV.privateKey]: PEM.replace(/\n/g, '\\n'),
  [APPLE_SIGN_IN_ENV.webClientId]: 'com.example.web',
  [APPLE_SIGN_IN_ENV.appClientId]: 'com.example.app',
};
const NOW = new Date('2026-10-19T00:00:00.000Z');

function decodePart(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

type Call = { url: string; init: { method: string; headers: Record<string, string>; body: string } };
function fakeFetch(status: number, body: string, calls: Call[]) {
  return async (url: string, init: Call['init']) => {
    calls.push({ url, init });
    return { status, ok: status >= 200 && status < 300, text: async () => body };
  };
}

test('client secret: ES256 header with the Key ID, Apple’s claims, five-minute life', () => {
  const jwt = buildAppleClientSecret({
    teamId: 'TEAM123456',
    keyId: 'KEY1234567',
    privateKey: PEM,
    clientId: 'com.example.web',
    now: NOW,
  });
  const parts = jwt.split('.');
  assert.equal(parts.length, 3, 'a JWT has three parts');
  assert.deepEqual(decodePart(parts[0]!), { alg: 'ES256', kid: 'KEY1234567' });
  const iat = Math.floor(NOW.getTime() / 1000);
  assert.deepEqual(decodePart(parts[1]!), {
    iss: 'TEAM123456',
    iat,
    exp: iat + CLIENT_SECRET_TTL_S,
    aud: APPLE_ISSUER,
    sub: 'com.example.web',
  });
  assert.ok(CLIENT_SECRET_TTL_S <= 15_777_000, 'Apple caps a client secret at six months');
});

test('client secret: the signature is raw r‖s (64 bytes) and verifies with the key — not DER', () => {
  const jwt = buildAppleClientSecret({
    teamId: 'T',
    keyId: 'K',
    privateKey: PEM.replace(/\n/g, '\\n'), // the escaped form signs too
    clientId: 'com.example.app',
    now: NOW,
  });
  const [h, c, s] = jwt.split('.') as [string, string, string];
  const sig = Buffer.from(s, 'base64url');
  assert.equal(sig.length, 64, 'ES256 in a JWT is 64 bytes; a DER signature is ~70 and Apple refuses it');
  assert.equal(
    verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, sig),
    true,
  );
});

test('config: each client needs only its own id; a missing value is named, never guessed', () => {
  assert.equal(readAppleSignInConfig(ENV, 'web').ok, true);
  const noApp = { ...ENV, [APPLE_SIGN_IN_ENV.appClientId]: '' };
  assert.equal(readAppleSignInConfig(noApp, 'web').ok, true, 'a web revoke does not need the bundle id');
  assert.deepEqual(readAppleSignInConfig(noApp, 'ios_app'), {
    ok: false,
    missing: [APPLE_SIGN_IN_ENV.appClientId],
  });
  assert.deepEqual(readAppleSignInConfig({}, 'web'), {
    ok: false,
    missing: [
      APPLE_SIGN_IN_ENV.teamId,
      APPLE_SIGN_IN_ENV.keyId,
      APPLE_SIGN_IN_ENV.privateKey,
      APPLE_SIGN_IN_ENV.webClientId,
    ],
  });
});

test('revoke: POSTs the form Apple documents, for the client that issued the token', async () => {
  const calls: Call[] = [];
  const out = await revokeAppleToken({
    env: ENV,
    client: 'ios_app',
    token: 'r.held-token',
    fetchImpl: fakeFetch(200, '', calls),
    now: NOW,
  });
  assert.deepEqual(out, { status: 'revoked', client: 'ios_app' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, APPLE_REVOKE_URL);
  assert.equal(calls[0]!.init.method, 'POST');
  assert.equal(calls[0]!.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(calls[0]!.init.body);
  assert.equal(form.get('client_id'), 'com.example.app');
  assert.equal(form.get('token'), 'r.held-token');
  assert.equal(form.get('token_type_hint'), 'refresh_token');
  const secret = form.get('client_secret') ?? '';
  assert.equal(decodePart(secret.split('.')[1]!).sub, 'com.example.app', 'the secret names the same client');
});

test('revoke: Apple’s refusal, a network error and a missing env are OUTCOMES, never throws', async () => {
  const refused = await revokeAppleToken({
    env: ENV,
    client: 'web',
    token: 't',
    fetchImpl: fakeFetch(400, '{"error":"invalid_client"}', []),
  });
  assert.deepEqual(refused, { status: 'failed', client: 'web', httpStatus: 400, reason: 'invalid_client' });

  const down = await revokeAppleToken({
    env: ENV,
    client: 'web',
    token: 't',
    fetchImpl: async () => {
      throw new Error('ECONNRESET');
    },
  });
  assert.deepEqual(down, { status: 'failed', client: 'web', reason: 'network_error' });

  const calls: Call[] = [];
  const unset = await revokeAppleToken({ env: {}, client: 'web', token: 't', fetchImpl: fakeFetch(200, '', calls) });
  assert.equal(unset.status, 'not_configured');
  assert.equal(calls.length, 0, 'nothing is sent to Apple without a key');

  const badKey = await revokeAppleToken({
    env: { ...ENV, [APPLE_SIGN_IN_ENV.privateKey]: 'not a key' },
    client: 'web',
    token: 't',
    fetchImpl: fakeFetch(200, '', []),
  });
  assert.deepEqual(badKey, { status: 'failed', client: 'web', reason: 'client_secret_unsignable' });
});

test('revoke: an error body never leaks into the outcome beyond Apple’s error code', async () => {
  const out = await revokeAppleToken({
    env: ENV,
    client: 'web',
    token: 'secret-token-value',
    fetchImpl: fakeFetch(500, 'upstream said secret-token-value', []),
  });
  assert.deepEqual(out, { status: 'failed', client: 'web', httpStatus: 500, reason: 'apple_refused' });
});

test('native code exchange: authorization_code grant for the app’s bundle id → the refresh token + Apple sub', async () => {
  const calls: Call[] = [];
  const idToken = `x.${Buffer.from(JSON.stringify({ sub: '001234.abcd' })).toString('base64url')}.y`;
  const out = await exchangeAppleAuthorizationCode({
    env: ENV,
    code: 'c.five-minute-code',
    fetchImpl: fakeFetch(200, JSON.stringify({ refresh_token: 'r.new', id_token: idToken }), calls),
    now: NOW,
  });
  assert.deepEqual(out, { ok: true, refreshToken: 'r.new', subject: '001234.abcd' });
  assert.equal(calls[0]!.url, APPLE_TOKEN_URL);
  const form = new URLSearchParams(calls[0]!.init.body);
  assert.equal(form.get('grant_type'), 'authorization_code');
  assert.equal(form.get('client_id'), 'com.example.app');
  assert.equal(form.get('code'), 'c.five-minute-code');
});

test('which sign-in was it: only the most recently used identity counts; no timestamps → not Apple', () => {
  const apple = { provider: 'apple', last_sign_in_at: '2026-10-19T10:00:00Z' };
  const google = { provider: 'google', last_sign_in_at: '2026-10-19T09:00:00Z' };
  assert.equal(appleWasJustUsed({ identities: [google, apple] }), true);
  assert.equal(
    appleWasJustUsed({ identities: [apple, { ...google, last_sign_in_at: '2026-10-19T11:00:00Z' }] }),
    false,
    'a Google sign-in on an account that also has Apple must not hold Google’s token as Apple’s',
  );
  assert.equal(appleWasJustUsed({ identities: [{ provider: 'apple' }] }), false);
  assert.equal(appleWasJustUsed(null), false);
});
