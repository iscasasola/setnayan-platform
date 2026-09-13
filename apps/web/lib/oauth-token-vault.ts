import 'server-only';

import { decryptToken, encryptToken } from '@/lib/encryption';
import { classifyStoredToken, type TokenReadOutcome } from '@/lib/oauth-token-vault-core';

/**
 * oauth-token-vault.ts — THE ONE PLACE A COUPLE'S CONNECTION KEY IS SEALED AND
 * OPENED.
 *
 * Setnayan's privacy filings tell people their Google Drive, YouTube and TikTok
 * connection keys are stored encrypted. Measured against production 2026-09-13
 * they were not — five live rows held Google access and refresh tokens as
 * plaintext. This module makes the filing true. CP-3 / LAU-6.
 *
 * The decision half is `oauth-token-vault-core.ts`, pure and unit-tested; this
 * half holds the key and does the I/O. The crypto itself is `encryption.ts`
 * (AES-256-GCM with dual-key rotation) — unchanged, and deliberately reused
 * rather than re-implemented: it is already what seals the platform's own API
 * keys, it already survives a key rotation, and `secrets/reencrypt.ts` already
 * knows how to re-seal what it wrote.
 *
 * ─── WHY THERE IS NO MIGRATION AND NO NEW COLUMN ───────────────────────────
 * The key lives in the application, so no SQL statement can seal an existing
 * value — a migration could only add an empty column beside a plaintext one and
 * leave the plaintext exactly where it is. Sealing happens in place instead:
 * ciphertext is text, the column is text, and a new column would additionally
 * inherit the public grant and need an exposure-baseline line for no benefit.
 *
 * ─── WHAT HAPPENS TO A COUPLE WHO IS ALREADY CONNECTED ─────────────────────
 * 🔑 NOTHING THEY CAN SEE. Their existing token still works: a read that finds
 * plaintext uses it and re-seals it in place, and a Google access token is
 * refreshed roughly hourly anyway, so live rows convert on their own within a
 * normal day of use. No reconnect, no interruption, no reauthorisation prompt.
 *
 * ⚠ THE UPGRADE IS BEST-EFFORT AND MUST STAY THAT WAY. If the re-seal write
 * fails, the caller has already got a working token and the operation must
 * continue — a failed bookkeeping write must never break a photo upload or a
 * broadcast. The row stays plaintext and the next read tries again.
 */

/** Seal a token for storage. Plaintext in, ciphertext out. */
export function sealToken(plaintext: string): string {
  return encryptToken(plaintext);
}

/** Seal only when there is something to seal — `null` passes through. */
export function sealTokenOrNull(plaintext: string | null | undefined): string | null {
  if (typeof plaintext !== 'string' || plaintext.length === 0) return null;
  return encryptToken(plaintext);
}

/**
 * Decrypt, without throwing. `null` means "this key could not open it" — which
 * is a normal answer during the transitional window (the value is plaintext) and
 * an alarming one afterwards (the key is missing or rotated past its fallback).
 * Telling those apart is `classifyStoredToken`'s job, not this one's.
 *
 * 🔒 NOTHING HERE LOGS THE VALUE, opened or sealed, and no error text from the
 * crypto layer is propagated — a decrypt failure can quote its input back.
 */
function tryOpen(payload: string): string | null {
  try {
    const opened = decryptToken(payload);
    return typeof opened === 'string' && opened.length > 0 ? opened : null;
  } catch {
    return null;
  }
}

/** What one stored token is, and whether it still needs sealing. */
export function readStoredToken(stored: string | null | undefined): TokenReadOutcome {
  return classifyStoredToken(stored, tryOpen);
}

/**
 * The usable token, or null.
 *
 * 🔒 `unopenable` returns NULL rather than the stored bytes. Handing base64
 * ciphertext to Google as a bearer token would produce a puzzling 401 and
 * prompt a reconnect that overwrites a value we might still have recovered by
 * restoring the key.
 */
export function openStoredToken(stored: string | null | undefined): string | null {
  const outcome = readStoredToken(stored);
  return outcome.status === 'sealed' || outcome.status === 'legacy_plaintext'
    ? outcome.value
    : null;
}

/** Does this stored value still need sealing in place? */
export function needsSealing(stored: string | null | undefined): boolean {
  return readStoredToken(stored).status === 'legacy_plaintext';
}

/**
 * Re-seal any legacy plaintext columns on one row, in place. Best-effort by
 * contract — see the module docblock.
 *
 * Returns the number of columns rewritten (0 when there was nothing to do or the
 * write failed), so a caller that wants to report progress can, and one that
 * does not can ignore it.
 *
 * @param patchRow applies the sealed values; supplied by the caller so this
 *                 module needs no table knowledge and stays testable.
 */
export type SealPatchResult = { readonly error: unknown; readonly rows: number };

export async function upgradeLegacyTokens(
  columns: Readonly<Record<string, string | null | undefined>>,
  patchRow: (patch: Record<string, string>) => Promise<SealPatchResult>,
): Promise<number> {
  const patch: Record<string, string> = {};
  for (const [column, stored] of Object.entries(columns)) {
    const outcome = readStoredToken(stored);
    if (outcome.status === 'legacy_plaintext') patch[column] = sealToken(outcome.value);
  }
  const count = Object.keys(patch).length;
  if (count === 0) return 0;
  try {
    const { error, rows } = await patchRow(patch);
    if (error) {
      console.warn('[oauth-token-vault] could not seal a legacy token in place');
      return 0;
    }
    /*
      ⚠ A ZERO-ROW UPDATE IS SUCCESS-SHAPED. PostgREST returns NO error when the
      filter matches nothing, so without counting the rows it returned this
      would report a key sealed that is still sitting in plaintext. The caller's
      token still works either way — the next read simply tries again — but the
      number this function returns has to be true.

      🔑 `patchRow` therefore returns a ROW COUNT, not just an error, and the
      contract is enforced by the type: a caller cannot forget to ask for it.
    */
    if (rows === 0) {
      console.warn('[oauth-token-vault] the re-seal matched no row');
      return 0;
    }
    return count;
  } catch {
    // The caller already holds a working token; a failed re-seal must not break
    // the operation it was doing. The next read tries again.
    console.warn('[oauth-token-vault] sealing a legacy token in place threw');
    return 0;
  }
}
