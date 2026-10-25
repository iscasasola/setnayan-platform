/**
 * 🍎 A payload switches nothing on unless Apple signed it.
 *
 * The fixture chain is a THROWAWAY test root ("Setnayan TEST Root (not Apple)")
 * generated 2026-10-18 with openssl; its private keys were never committed.
 * Production trusts ONLY Apple Root CA - G3 (`APPLE_ROOT_CA_G3_SHA256`), so the
 * very first test proves these fixtures are refused there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLE_ROOT_CA_G3_SHA256, verifyAppleJws } from './apple-jws';
import { FIXTURE_ROOTS, fixtureJws as jwsOf } from './apple-jws-fixture';

const TEST_ROOTS = FIXTURE_ROOTS;

test('production trusts ONLY Apple Root CA - G3 — a test-signed purchase is refused there', () => {
  const v = verifyAppleJws(jwsOf('txPro'), { trustedRootSha256: [APPLE_ROOT_CA_G3_SHA256] });
  assert.deepEqual(v, { ok: false, reason: 'untrusted_root' });
});

test('a correctly signed transaction verifies, and its payload is returned', () => {
  const v = verifyAppleJws<{ productId: string; appAccountToken: string }>(jwsOf('txPro'), {
    trustedRootSha256: TEST_ROOTS,
  });
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.payload.productId, 'com.setnayan.app.event_hub_pro');
    assert.equal(v.payload.appAccountToken, '11111111-1111-4111-8111-111111111111');
  }
});

test('a changed payload (one character) is refused — the signature no longer matches', () => {
  const [h, p, s] = jwsOf('txPro').split('.') as [string, string, string];
  const body = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
  body.productId = 'com.setnayan.app.papic_credits_10000';
  const forged = [h, Buffer.from(JSON.stringify(body)).toString('base64url'), s].join('.');
  assert.deepEqual(verifyAppleJws(forged, { trustedRootSha256: TEST_ROOTS }), { ok: false, reason: 'bad_signature' });
});

test('a certificate Apple issued for another purpose (no receipt-signing OID) cannot sign a purchase', () => {
  assert.deepEqual(verifyAppleJws(jwsOf('txProPlainLeaf'), { trustedRootSha256: TEST_ROOTS }), {
    ok: false,
    reason: 'not_apple_purpose',
  });
});

test('a header that is not ES256, or a chain that is not three certificates, is refused', () => {
  const [, p, s] = jwsOf('txPro').split('.') as [string, string, string];
  const none = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
  assert.deepEqual(verifyAppleJws([none, p, s].join('.'), { trustedRootSha256: TEST_ROOTS }), {
    ok: false,
    reason: 'bad_header',
  });
  const [h] = jwsOf('txPro').split('.') as [string];
  const hdr = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  hdr.x5c = hdr.x5c.slice(0, 2);
  const short = Buffer.from(JSON.stringify(hdr)).toString('base64url');
  assert.deepEqual(verifyAppleJws([short, p, s].join('.'), { trustedRootSha256: TEST_ROOTS }), {
    ok: false,
    reason: 'bad_header',
  });
});

test('a swapped chain (leaf presented as the intermediate) is refused', () => {
  const [h, p, s] = jwsOf('txPro').split('.') as [string, string, string];
  const hdr = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  hdr.x5c = [hdr.x5c[1], hdr.x5c[0], hdr.x5c[2]];
  const swapped = Buffer.from(JSON.stringify(hdr)).toString('base64url');
  assert.deepEqual(verifyAppleJws([swapped, p, s].join('.'), { trustedRootSha256: TEST_ROOTS }), {
    ok: false,
    reason: 'bad_chain',
  });
});

test('garbage is refused, never thrown', () => {
  for (const junk of ['', 'a.b', 'a.b.c', '...', 'x'.repeat(70_000)]) {
    const v = verifyAppleJws(junk, { trustedRootSha256: TEST_ROOTS });
    assert.equal(v.ok, false, junk.slice(0, 10));
  }
});

test('the pinned Apple root is the G3 fingerprint, 64 hex characters', () => {
  assert.match(APPLE_ROOT_CA_G3_SHA256, /^[0-9A-F]{64}$/);
  assert.equal(APPLE_ROOT_CA_G3_SHA256.slice(0, 8), '63343ABF');
});
