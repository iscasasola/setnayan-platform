/**
 * apps/web/lib/auth-read.ts — "NO USER" IS TWO DIFFERENT ANSWERS.
 *
 * Live, 2026-09-29 (owner, on production): *"when i used the upload media on
 * the background, i went back to login"*. The Maker's first draft save of the
 * session (`hubDraftAction` → `getHostUserId`) answered `303 → /login`.
 *
 * `supabase.auth.getUser()` returns `{ user: null }` for BOTH of these:
 *   · SIGNED OUT — no session cookie, or one Supabase no longer honours
 *     (`AuthSessionMissingError`, a 4xx like `session_not_found`); and
 *   · THE CHECK DID NOT HAPPEN — the auth server was unreachable, answered 5xx,
 *     or rate-limited us (429). Measured with the shipped `@supabase/ssr`: a
 *     dropped connection and a 503 both return `AuthRetryableFetchError`, a 429
 *     returns `AuthApiError` status 429 — and none of them clears the cookie.
 *     The couple is still signed in.
 *
 * `getHostUserId` sent BOTH to `/login`: a hiccup on Supabase's side threw a
 * signed-in couple out of the Maker mid-edit. A failure rendered as "you are
 * signed out" — the disease this repo keeps meeting. Now the second answer is
 * a retryable error the Maker shows in place ("That change could not be
 * saved"), and only the first one is a sign-in.
 *
 * Pure; the caller passes `getUser()`'s `error`.
 */
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/** What a Maker save says when the sign-in check itself failed. */
export const AUTH_READ_FAILED_MESSAGE = 'We could not confirm your sign-in just now. Please try again.';

/**
 * True when `getUser()` returned no user because the CHECK failed (network,
 * 5xx, 429) — never because the visitor is signed out.
 */
export function authReadFailed(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  if (isAuthApiError(error)) return error.status === 429 || error.status >= 500;
  return false;
}
