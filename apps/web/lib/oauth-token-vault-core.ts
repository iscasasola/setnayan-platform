/**
 * oauth-token-vault-core.ts — IS THIS STORED VALUE ONE OF OUR SEALED ENVELOPES,
 * OR A TOKEN SOMEBODY WROTE IN PLAINTEXT BEFORE WE SEALED THEM?
 *
 * Pure, client-safe (NO `server-only`, NO env, NO crypto key) so the decision is
 * a real unit test rather than a source scan — the same pure-core/server-wrapper
 * split as `encryption-core.ts` ↔ `encryption.ts` and `cleanup-delete-scope.ts`
 * ↔ `cleanup-delete.ts`. The half that holds the key is `oauth-token-vault.ts`.
 *
 * ─── WHY THE QUESTION EXISTS AT ALL ────────────────────────────────────────
 * Setnayan's own privacy filings tell people their Google Drive, YouTube and
 * TikTok connection keys are stored encrypted. Measured against production on
 * 2026-09-13 they were not: five live rows across `oauth_grants` and
 * `live_studio_channel_grants` held Google access and refresh tokens as
 * plaintext (`ya29.…` / `1//…`). Sealing them is CP-3 / LAU-6.
 *
 * Those five rows belong to real, working connections, and there is no
 * migration that can seal them — the key lives in the application, not the
 * database. So the readers must accept BOTH shapes for a while: open a sealed
 * value, pass a legacy plaintext one through, and re-seal it in place the first
 * time it is used. That transitional window is the whole reason this file has a
 * decision in it, and it is why the decision has to be exactly right.
 *
 * ─── THE TWO WAYS TO GET IT WRONG, AND WHICH ONE IS WORSE ──────────────────
 * 1. A sealed value mistaken for plaintext → we hand base64 ciphertext to Google
 *    as a bearer token. It fails, the couple is told to reconnect, and the
 *    reconnect overwrites a token we could have opened. Recoverable but rude.
 * 2. A plaintext token mistaken for a sealed value we cannot open → we refuse to
 *    use a token that was perfectly good. The connection looks broken while
 *    nothing is wrong.
 *
 * 🔒 THE PRIMARY TEST IS NOT A HEURISTIC — the server half TRIES TO DECRYPT, and
 * AES-GCM's authentication tag settles it: a wrong guess fails with
 * overwhelming probability, no pattern-matching required. This module is only
 * consulted for the case decryption CANNOT settle — when it failed and we must
 * say why. Failure means either "legacy plaintext" or "our envelope, but the key
 * is missing or has rotated past its fallback". Those two demand opposite
 * actions, and only the shape can tell them apart.
 *
 * ⚠ A GOOGLE REFRESH TOKEN IS BASE64-SHAPED. `1//0eXa…` uses only base64
 * characters and decodes cleanly, so "looks like base64 and is long enough" says
 * SEALED for a plaintext Google refresh token — the exact misclassification (2)
 * above. The provider prefixes below are therefore not decoration; they are the
 * half of the rule that makes it correct.
 */

/**
 * How a stored token is written by the provider, in plaintext.
 *
 * ⛔ NEVER REMOVE ONE OF THESE TO MAKE A TEST PASS. Each is a documented,
 * observed prefix, and each is what stops a real token from being mistaken for
 * ciphertext we cannot open:
 *   • `ya29.`  Google OAuth 2 access token (Drive, YouTube) — seen on all five
 *              production rows measured 2026-09-13.
 *   • `1//`    Google OAuth 2 refresh token (offline access) — likewise.
 *   • `act.`   TikTok access token.
 *   • `rft.`   TikTok refresh token.
 */
export const PLAINTEXT_TOKEN_PREFIXES = ['ya29.', '1//', 'act.', 'rft.'] as const;

/**
 * The wire format `encryption-core.ts` produces:
 *   base64( iv (12B) || ciphertext (>=1B) || authTag (16B) )
 * so the shortest possible envelope is 29 bytes → 40 base64 characters.
 */
const MIN_SEALED_BYTES = 12 + 1 + 16;

/** Standard base64 (the alphabet `Buffer.toString('base64')` emits). */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Could `value` be one of our sealed envelopes?
 *
 * Consulted ONLY after a decryption attempt has already failed — see the
 * docblock. `true` means "our shape, and we could not open it", which the caller
 * must treat as a key problem and FAIL CLOSED. `false` means "a token written
 * before sealing existed", which the caller may use as-is and re-seal.
 *
 * 🔑 A provider prefix wins over the base64 shape, always. That is the whole
 * point: a plaintext Google refresh token satisfies every structural test here
 * and is still not ciphertext.
 */
export function looksSealed(value: string | null | undefined): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  // A known provider prefix is decisive — this is plaintext, whatever its shape.
  for (const prefix of PLAINTEXT_TOKEN_PREFIXES) {
    if (trimmed.startsWith(prefix)) return false;
  }
  if (!BASE64_RE.test(trimmed)) return false;
  // Length in BYTES after decoding, not characters: 4 base64 chars → 3 bytes.
  const padding = trimmed.endsWith('==') ? 2 : trimmed.endsWith('=') ? 1 : 0;
  if (trimmed.length % 4 !== 0) return false;
  const bytes = (trimmed.length / 4) * 3 - padding;
  return bytes >= MIN_SEALED_BYTES;
}

/** What a read decided about one stored token. */
export type TokenReadOutcome =
  /** Opened from a sealed envelope. Nothing to do. */
  | { readonly status: 'sealed'; readonly value: string }
  /** Usable plaintext written before sealing existed — the caller re-seals it. */
  | { readonly status: 'legacy_plaintext'; readonly value: string }
  /** Our envelope, and we could not open it. NEVER usable as a token. */
  | { readonly status: 'unopenable' }
  /** Nothing stored. */
  | { readonly status: 'absent' };

/**
 * Turn "what is stored" plus "did decryption work" into what the caller must do.
 *
 * Pure: the decryption itself is injected, so this — the branch that decides
 * whether a value may be sent to Google — is exercised directly by tests with no
 * key, no env and no network.
 *
 * @param stored  the column value as read from the database
 * @param decrypt returns the plaintext, or null when it could not open `stored`
 */
export function classifyStoredToken(
  stored: string | null | undefined,
  decrypt: (payload: string) => string | null,
): TokenReadOutcome {
  if (typeof stored !== 'string' || stored.trim().length === 0) {
    return { status: 'absent' };
  }
  const value = stored.trim();

  const opened = decrypt(value);
  if (opened !== null && opened.length > 0) {
    return { status: 'sealed', value: opened };
  }

  /*
    Decryption could not settle it. Shape decides, and it fails CLOSED: an
    envelope we cannot open is never handed onward as a bearer token, because
    the one thing worse than a broken connection is a confusing one.
  */
  if (looksSealed(value)) return { status: 'unopenable' };
  return { status: 'legacy_plaintext', value };
}
