/**
 * ENCRYPTION_KEY dual-key rotation (node:test via tsx · `pnpm test:unit`).
 *
 * THE BUG THIS LOCKS: before 2026-07-25, swapping ENCRYPTION_KEY made every
 * stored integration secret and OAuth token permanently undecryptable — with no
 * error surfaced anywhere. Transactional email simply stopped. The dual-key read
 * (primary, then ENCRYPTION_KEY_PREVIOUS) is what makes a rotation survivable,
 * and lib/secrets/reencrypt.ts then walks the data forward.
 *
 * Tested against ./encryption-core rather than ./encryption because the latter
 * carries `import 'server-only'`, which does not resolve under the Node test
 * runner (same reason bucket-routing.test.ts targets the pure module). The core
 * takes keys as arguments, so the swap is expressed directly instead of by
 * mutating process.env.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

import {
  KEY_BYTES,
  decryptWithFallback,
  decryptWithKey,
  encryptWithKey,
  parseKey,
  parseKeyOrNull,
  tryDecryptWithKey,
} from './encryption-core';

const KEY_A = randomBytes(KEY_BYTES); // the OLD key
const KEY_B = randomBytes(KEY_BYTES); // the NEW key
// Deliberately NOT shaped like any real credential (a provider-prefixed string
// here trips the gitleaks CI scan even as an obvious test fixture).
const SECRET = 'round-trip plaintext fixture 0123456789';

test('round-trip under a single key is unchanged (wire format is byte-compatible)', () => {
  const enc = encryptWithKey(KEY_A, SECRET);
  assert.equal(decryptWithKey(KEY_A, enc), SECRET);
  // iv(12) + tag(16) + payload, base64 — never the plaintext itself.
  assert.ok(!enc.includes(SECRET));
});

test('THE ROTATION: ciphertext written under key A still reads after the swap to B', () => {
  const writtenUnderA = encryptWithKey(KEY_A, SECRET);

  // Naive rotation — primary is now B, no previous key configured.
  assert.equal(tryDecryptWithKey(KEY_B, writtenUnderA), null);

  // Dual-key rotation — primary B, previous A.
  assert.equal(decryptWithFallback(writtenUnderA, KEY_B, KEY_A), SECRET);
});

test('a FRESH encrypt during the rotation uses the new key only', () => {
  const writtenUnderB = encryptWithKey(KEY_B, SECRET);
  // Reads under the primary without needing the fallback…
  assert.equal(tryDecryptWithKey(KEY_B, writtenUnderB), SECRET);
  // …and is NOT readable under the old key, which is what lets the sweep tell
  // "already current" from "still needs a rewrite".
  assert.equal(tryDecryptWithKey(KEY_A, writtenUnderB), null);
});

test('the sweep contract: re-encrypting under B makes the previous key unnecessary', () => {
  const before = encryptWithKey(KEY_A, SECRET);
  const plaintext = decryptWithFallback(before, KEY_B, KEY_A);
  const after = encryptWithKey(KEY_B, plaintext);

  // After the sweep, primary alone suffices — ENCRYPTION_KEY_PREVIOUS can go.
  assert.equal(decryptWithFallback(after, KEY_B, null), SECRET);
  assert.notEqual(after, before);
});

test('a value under NEITHER key throws (fallback never silently returns garbage)', () => {
  const KEY_C = randomBytes(KEY_BYTES);
  const writtenUnderC = encryptWithKey(KEY_C, SECRET);
  assert.throws(() => decryptWithFallback(writtenUnderC, KEY_B, KEY_A));
  assert.equal(tryDecryptWithKey(KEY_B, writtenUnderC), null);
  assert.equal(tryDecryptWithKey(KEY_A, writtenUnderC), null);
});

test('no previous key configured behaves exactly like the old single-key path', () => {
  const enc = encryptWithKey(KEY_B, SECRET);
  assert.equal(decryptWithFallback(enc, KEY_B, null), SECRET);
  assert.throws(() => decryptWithFallback(encryptWithKey(KEY_A, SECRET), KEY_B, null));
});

test('tampered ciphertext is rejected by the GCM auth tag, under either key', () => {
  const enc = encryptWithKey(KEY_A, SECRET);
  const buf = Buffer.from(enc, 'base64');
  // Flip a bit in the auth tag (the last 16 bytes).
  buf.writeUInt8(buf.readUInt8(buf.length - 1) ^ 0xff, buf.length - 1);
  const tampered = buf.toString('base64');
  assert.equal(tryDecryptWithKey(KEY_A, tampered), null);
  assert.throws(() => decryptWithFallback(tampered, KEY_B, KEY_A));
});

test('parseKey enforces 32 raw bytes of base64 and names the offending variable', () => {
  const good = randomBytes(KEY_BYTES).toString('base64');
  assert.equal(parseKey(good).length, KEY_BYTES);

  assert.throws(() => parseKey(undefined), /ENCRYPTION_KEY env var is not set/);
  assert.throws(
    () => parseKey(randomBytes(16).toString('base64')),
    /must decode to exactly 32 bytes/,
  );
  assert.throws(
    () => parseKey(undefined, 'ENCRYPTION_KEY_PREVIOUS'),
    /ENCRYPTION_KEY_PREVIOUS env var is not set/,
  );
});

test('parseKeyOrNull degrades instead of throwing — a bad PREVIOUS must not down the app', () => {
  assert.equal(parseKeyOrNull(undefined), null);
  assert.equal(parseKeyOrNull(''), null);
  assert.equal(parseKeyOrNull('not-32-bytes'), null);
  assert.ok(parseKeyOrNull(randomBytes(KEY_BYTES).toString('base64')));
});

test('tryDecryptWithKey tolerates a null key and malformed payloads', () => {
  assert.equal(tryDecryptWithKey(null, encryptWithKey(KEY_A, SECRET)), null);
  assert.equal(tryDecryptWithKey(KEY_A, ''), null);
  assert.equal(tryDecryptWithKey(KEY_A, 'not base64 at all !!!'), null);
});
