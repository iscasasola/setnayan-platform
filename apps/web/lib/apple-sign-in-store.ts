import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { openStoredToken, sealToken } from '@/lib/oauth-token-vault';
import {
  appleIdentity,
  appleSubject,
  exchangeAppleAuthorizationCode,
  revokeAppleToken,
  type AppleClient,
  type AppleRevokeOutcome,
} from '@/lib/apple-sign-in';

/**
 * apple-sign-in-store.ts — HOLD an Apple refresh token at sign-in, and REVOKE it
 * at erasure. The I/O half of `apple-sign-in.ts` (which is pure and tested).
 *
 * The table is `apple_sign_in_tokens` (service role only, RLS on, no policies):
 * one row per person, the latest token, SEALED with the same AES-256-GCM vault
 * as the Google keys. Why it must be held at all: Supabase hands Apple's refresh
 * token over exactly once, at the code exchange, and keeps no copy we can read —
 * see the migration `apple_sign_in_can_be_revoked`.
 *
 * Both halves are best-effort by contract: a hold that fails must never break a
 * sign-in, and a revoke that fails must never stop an erasure. Neither is
 * silent — a failed hold is logged with its reason (never the token), and every
 * revoke outcome is written to the erasure audit by `lib/erasure/purge.ts`.
 */

/** Upsert the latest token for a person. Never throws. */
export async function holdAppleRefreshToken(
  userId: string,
  client: AppleClient,
  refreshToken: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!userId || typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return { ok: false, reason: 'nothing_to_hold' };
  }
  try {
    const { error } = await createAdminClient()
      .from('apple_sign_in_tokens')
      .upsert(
        {
          user_id: userId,
          apple_client: client,
          refresh_token_sealed: sealToken(refreshToken),
          captured_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (error) {
      console.error('[apple-sign-in] hold failed', error.message);
      return { ok: false, reason: 'write_failed' };
    }
    return { ok: true };
  } catch (e) {
    // sealToken throws without ENCRYPTION_KEY; the message names the env, not the token.
    console.error('[apple-sign-in] hold failed', e instanceof Error ? e.message : 'unknown');
    return { ok: false, reason: 'seal_or_client_failed' };
  }
}

/**
 * The phone app's native sheet: trade the five-minute authorization code for a
 * refresh token and hold it — but only when the token's Apple user is the Apple
 * identity on THIS account, so nobody can park another Apple ID's grant on
 * their own row. Never throws.
 */
export async function holdNativeAppleAuthorization(
  userId: string,
  user: Parameters<typeof appleSubject>[0],
  authorizationCode: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const exchange = await exchangeAppleAuthorizationCode({
    env: process.env,
    code: authorizationCode,
    fetchImpl: fetch,
  });
  if (!exchange.ok) {
    console.error('[apple-sign-in] native code exchange failed', exchange.reason);
    return { ok: false, reason: exchange.reason };
  }
  const expected = appleSubject(user);
  if (!expected || exchange.subject !== expected) {
    console.error('[apple-sign-in] native code belongs to a different Apple ID — not held');
    return { ok: false, reason: 'subject_mismatch' };
  }
  return holdAppleRefreshToken(userId, 'ios_app', exchange.refreshToken);
}

/**
 * The erasure step (`ErasureIo.revokeAppleSignIn`). Reads the held token, asks
 * Apple to revoke it, and says what happened. NEVER THROWS — and does not delete
 * the row: the purge's OWN_ROW_DELETES loop does that afterwards, the one place
 * erasure deletes a subject's rows.
 */
export async function revokeHeldAppleSignIn(userId: string): Promise<AppleRevokeOutcome> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('apple_sign_in_tokens')
      .select('apple_client, refresh_token_sealed')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) return { status: 'failed', reason: 'token_read_failed' };
    const row = data as { apple_client?: AppleClient; refresh_token_sealed?: string } | null;
    if (!row) {
      // No token held. Say whether that MATTERS: an Apple-linked account with
      // nothing to revoke is a residual obligation; anyone else is not.
      const { data: u, error: uErr } = await admin.auth.admin.getUserById(userId);
      if (uErr) return { status: 'failed', reason: 'identity_read_failed' };
      return appleIdentity(u?.user as Parameters<typeof appleIdentity>[0])
        ? { status: 'no_token_held' }
        : { status: 'not_apple_linked' };
    }
    const client: AppleClient = row.apple_client === 'ios_app' ? 'ios_app' : 'web';
    const token = openStoredToken(row.refresh_token_sealed);
    if (!token) return { status: 'failed', client, reason: 'token_unopenable' };
    return await revokeAppleToken({ env: process.env, client, token, fetchImpl: fetch });
  } catch {
    return { status: 'failed', reason: 'unexpected_error' };
  }
}
