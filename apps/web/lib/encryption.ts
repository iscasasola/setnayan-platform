import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM helpers for at-rest encryption of OAuth refresh tokens (and
// any future small server-side secrets). First consumer: iteration 0009
// Photo Delivery — `events.photo_delivery_oauth_token_encrypted`.
//
// Format of the returned string: base64( iv (12B) || ciphertext (N) || authTag (16B) ).
// Single-string round-trip keeps Postgres TEXT storage trivial.
//
// Key contract:
//   - process.env.ENCRYPTION_KEY MUST be 32 random bytes, base64-encoded.
//   - Validation is lazy (on first encrypt/decrypt call) so missing keys
//     don't crash build/dev environments that never exercise the path.
//   - Generate with: `openssl rand -base64 32`

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY env var is not set. Generate with `openssl rand -base64 32`.'
    );
  }
  let decoded: Buffer;
  try {
    decoded = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('ENCRYPTION_KEY env var is not valid base64.');
  }
  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_BYTES} bytes; got ${decoded.length}.`
    );
  }
  cachedKey = decoded;
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString('base64');
}

export function decryptToken(payload: string): string {
  const key = getKey();
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
