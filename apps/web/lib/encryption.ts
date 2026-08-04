import 'server-only';
import {
  decryptWithFallback,
  encryptWithKey,
  parseKey,
  parseKeyOrNull,
  tryDecryptWithKey,
} from './encryption-core';

// AES-256-GCM helpers for at-rest encryption of OAuth refresh tokens (and
// any future small server-side secrets). First consumer: iteration 0009
// Photo Delivery — `events.photo_delivery_oauth_token_encrypted`.
//
// Format of the returned string: base64( iv (12B) || ciphertext (N) || authTag (16B) ).
// Single-string round-trip keeps Postgres TEXT storage trivial. The crypto
// itself lives in ./encryption-core (pure, key-as-argument); this module is the
// env-reading wrapper.
//
// Key contract:
//   - process.env.ENCRYPTION_KEY MUST be 32 random bytes, base64-encoded.
//   - Validation is lazy (on first encrypt/decrypt call) so missing keys
//     don't crash build/dev environments that never exercise the path.
//   - Generate with: `openssl rand -base64 32`
//
// DUAL-KEY ROTATION (2026-07-25 · /admin/secrets).
//   Rotating ENCRYPTION_KEY used to be a silent catastrophe: every stored
//   integration secret and OAuth token became undecryptable the moment the env
//   var changed, and nothing surfaced it — email just stopped.
//
//   Now: set ENCRYPTION_KEY_PREVIOUS to the OLD key alongside the new
//   ENCRYPTION_KEY, and decryptToken() falls back to it when the primary's GCM
//   auth tag fails. encryptToken() ALWAYS writes under the primary, so data
//   drifts forward on its own; lib/secrets/reencrypt.ts sweeps the rest. Once
//   the sweep reports failed=0, delete ENCRYPTION_KEY_PREVIOUS.
//
//   The key caches are keyed on the RAW env string, so changing the env var
//   invalidates them automatically — no manual reset hook is needed, in prod
//   or in tests.

let primaryCache: { raw: string; key: Buffer } | null = null;
let previousCache: { raw: string | null; key: Buffer | null } | null = null;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (primaryCache && raw === primaryCache.raw) return primaryCache.key;
  const key = parseKey(raw, 'ENCRYPTION_KEY');
  primaryCache = { raw: raw as string, key };
  return key;
}

/**
 * The previous key, when a rotation is in flight. Never throws — a malformed
 * ENCRYPTION_KEY_PREVIOUS degrades to "no fallback", it must not take the app
 * down (the primary is what the app actually runs on).
 */
function getPreviousKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY_PREVIOUS ?? null;
  if (previousCache && raw === previousCache.raw) return previousCache.key;
  const key = parseKeyOrNull(raw);
  previousCache = { raw, key };
  return key;
}

export function encryptToken(plaintext: string): string {
  return encryptWithKey(getKey(), plaintext);
}

export function decryptToken(payload: string): string {
  return decryptWithFallback(payload, getKey(), getPreviousKey());
}

/**
 * Decrypt ONLY under the current primary key; null when it doesn't apply.
 * The re-encrypt sweep uses this to tell "already current" from "needs a
 * rewrite" — decryptToken()'s fallback deliberately hides that distinction.
 */
export function decryptUnderPrimary(payload: string): string | null {
  return tryDecryptWithKey(getKey(), payload);
}

/** Decrypt ONLY under ENCRYPTION_KEY_PREVIOUS; null when unset or wrong. */
export function decryptUnderPrevious(payload: string): string | null {
  return tryDecryptWithKey(getPreviousKey(), payload);
}

/**
 * Which keys the runtime currently holds. Booleans ONLY — this feeds the
 * ENCRYPTION_KEY card on /admin/secrets and must never carry key material.
 */
export function encryptionKeyStatus(): { primarySet: boolean; previousSet: boolean } {
  return {
    primarySet: Boolean(process.env.ENCRYPTION_KEY),
    previousSet: Boolean(process.env.ENCRYPTION_KEY_PREVIOUS),
  };
}
