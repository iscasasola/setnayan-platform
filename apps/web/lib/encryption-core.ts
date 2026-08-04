import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM primitives, PURE — every key is passed in, nothing is read from
// process.env here.
//
// Split out of lib/encryption.ts when the dual-key rotation landed (2026-07-25).
// encryption.ts keeps its `import 'server-only'` (it reads env), which makes it
// unimportable under the Node test runner; this module has no such guard, so the
// rotation behaviour that actually matters — "ciphertext written under the OLD
// key must still decrypt after the key is swapped" — is unit-testable. Same
// pure-core/server-wrapper split as bucket-routing.ts ↔ storage.ts.
//
// Wire format (UNCHANGED — byte-compatible with everything already stored):
//   base64( iv (12B) || ciphertext (N) || authTag (16B) )

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
export const KEY_BYTES = 32;

/**
 * Decode a base64 32-byte key. Throws with the ORIGINAL, unchanged error text
 * (parameterised only by var name) so existing operator runbooks still match.
 */
export function parseKey(raw: string | undefined | null, varName = 'ENCRYPTION_KEY'): Buffer {
  if (!raw) {
    throw new Error(
      `${varName} env var is not set. Generate with \`openssl rand -base64 32\`.`,
    );
  }
  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, 'base64');
  } catch {
    throw new Error(`${varName} env var is not valid base64.`);
  }
  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `${varName} must decode to exactly ${KEY_BYTES} bytes; got ${decoded.length}.`,
    );
  }
  return decoded;
}

/** Same as parseKey but returns null instead of throwing — for optional keys. */
export function parseKeyOrNull(raw: string | undefined | null): Buffer | null {
  if (!raw) return null;
  try {
    return parseKey(raw);
  } catch {
    return null;
  }
}

export function encryptWithKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

export function decryptWithKey(key: Buffer, payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_BYTES + AUTH_TAG_BYTES + 1) {
    throw new Error('Encrypted payload is shorter than the minimum (iv + tag + 1B).');
  }
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(buf.length - AUTH_TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES, buf.length - AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Decrypt, returning null instead of throwing on a wrong key / corrupt payload.
 * GCM's auth tag makes "wrong key" a clean, cheap failure — that is the whole
 * mechanism the dual-key rotation rides on.
 *
 * Never logs. The caller decides what a null means.
 */
export function tryDecryptWithKey(key: Buffer | null, payload: string): string | null {
  if (!key) return null;
  try {
    return decryptWithKey(key, payload);
  } catch {
    return null;
  }
}

/**
 * Dual-key read: primary first, then the PREVIOUS key when one is configured.
 * This is what keeps stored secrets readable across an ENCRYPTION_KEY swap
 * while the re-encrypt sweep catches up.
 */
export function decryptWithFallback(
  payload: string,
  primary: Buffer,
  previous: Buffer | null,
): string {
  const viaPrimary = tryDecryptWithKey(primary, payload);
  if (viaPrimary !== null) return viaPrimary;
  const viaPrevious = tryDecryptWithKey(previous, payload);
  if (viaPrevious !== null) return viaPrevious;
  // Re-run under the primary so the caller gets the real crypto error (bad
  // payload length vs bad auth tag) rather than a synthesised one.
  return decryptWithKey(primary, payload);
}
