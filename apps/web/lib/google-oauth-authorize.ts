/**
 * Pure builder for Google's OAuth 2.0 authorization-code consent URL.
 *
 * Deliberately has NO `server-only` import: it is the testable core shared by
 * the two server-only integration modules that used to build these params
 * inline and separately —
 *
 *   • lib/panood-youtube.ts  (Live Studio · `auth/youtube`)
 *   • lib/papic-drive.ts     (Papic photo delivery · `auth/drive.file`)
 *
 * ⚠ THE RULE THIS MODULE EXISTS TO ENFORCE — never send
 * `include_granted_scopes`. Incremental authorization asks Google to fold in
 * every scope the user has ALREADY granted, and Google refuses to issue a
 * YouTube scope alongside Drive's `drive.file`:
 *
 *     Access blocked: Authorization Error
 *     This request contains scopes that cannot be requested together:
 *     [.../auth/youtube, .../auth/drive.file]     (Error 400: invalid_request)
 *
 * Observed live 2026-07-25 on an account holding both grants; it blocked the
 * Google OAuth verification demo recording. The failure is ORDER-DEPENDENT —
 * whichever integration is connected SECOND breaks — so a fresh account tests
 * perfectly clean and the bug reads as "works on my machine".
 *
 * Neither integration ever needed the flag: Drive and YouTube keep independent
 * grants (separate `oauth_grants` rows, refresh tokens, and OAuth clients), so
 * each token only has to carry its own scope. Omitting it also matches the
 * minimum-scope posture Google reviews during verification.
 *
 * Centralised here so the rule is enforced in ONE place and asserted once, in
 * google-oauth-scope-conflict.test.ts — rather than depending on two callers
 * independently remembering not to reintroduce a parameter.
 */

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export type GoogleAuthorizeInput = {
  clientId: string;
  redirectUri: string;
  /** The scopes for THIS integration only — never another integration's. */
  scopes: readonly string[];
  state: string;
  /**
   * `consent` (the default) forces a fresh refresh_token on every reconnect.
   * Without it Google reuses the prior grant and returns only an access_token,
   * which is useless once we've discarded the refresh token on disconnect.
   * `select_account consent` additionally forces the account chooser.
   */
  prompt?: 'consent' | 'select_account consent';
};

export function buildGoogleAuthorizeUrl(input: GoogleAuthorizeInput): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: input.scopes.join(' '),
    access_type: 'offline',
    prompt: input.prompt ?? 'consent',
    state: input.state,
    // NO include_granted_scopes — see the module header. Do not re-add it.
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}
