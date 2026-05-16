/**
 * Iteration 0017 Phase 3 — TikTok OAuth helpers (server-side only).
 *
 * Implements the OAuth 2.0 authorization-code flow against TikTok's v2 API
 * for Personal-tier Patiktok couples (₱1,999/day). Setnayan-tier couples
 * (₱999/day) post to @SetnayanWeddings using platform-owned credentials
 * held separately on the worker; this module does not handle that path.
 *
 * TikTok endpoints (per developers.tiktok.com/doc/oauth-user-access-token-management):
 *   AUTHORIZE  https://www.tiktok.com/v2/auth/authorize/
 *   TOKEN      https://open.tiktokapis.com/v2/oauth/token/
 *   USERINFO   https://open.tiktokapis.com/v2/user/info/
 *
 * Required env vars (owner action — sign up at developers.tiktok.com and
 * register an app):
 *   TIKTOK_CLIENT_KEY        — public client key
 *   TIKTOK_CLIENT_SECRET     — secret used at token exchange
 *   TIKTOK_OAUTH_REDIRECT_URI — must exactly match the Redirect URI registered
 *                              on the TikTok app (e.g.
 *                              https://www.setnayan.com/api/tiktok/auth/callback)
 *
 * Setnayan-tier (master handle) credentials are managed separately on the
 * worker side and do not flow through this module:
 *   TIKTOK_SETNAYAN_REFRESH_TOKEN — long-lived refresh for @SetnayanWeddings
 *
 * THIS MODULE IS SERVER-SIDE ONLY. Never import from a client component.
 */

import 'server-only';

const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

const SPEC_SCOPES = ['user.info.basic', 'video.upload', 'video.publish'] as const;

export type PatiktokTiktokConfigStatus =
  | { ready: true; clientKey: string; redirectUri: string }
  | { ready: false; missing: ReadonlyArray<string> };

/**
 * Read the TikTok OAuth config from env. Returns a status object that lets
 * routes / UI surface a clear "TikTok not yet configured — owner action
 * required" message rather than throwing at request time.
 */
export function getTiktokOAuthConfig(): PatiktokTiktokConfigStatus {
  const clientKey = process.env.TIKTOK_CLIENT_KEY ?? '';
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET ?? '';
  const redirectUri = process.env.TIKTOK_OAUTH_REDIRECT_URI ?? '';
  const missing: string[] = [];
  if (!clientKey) missing.push('TIKTOK_CLIENT_KEY');
  if (!clientSecret) missing.push('TIKTOK_CLIENT_SECRET');
  if (!redirectUri) missing.push('TIKTOK_OAUTH_REDIRECT_URI');
  if (missing.length > 0) return { ready: false, missing };
  return { ready: true, clientKey, redirectUri };
}

export function buildAuthorizeUrl(input: {
  clientKey: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_key: input.clientKey,
    scope: SPEC_SCOPES.join(','),
    response_type: 'code',
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`;
}

export type TiktokTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in?: number;
  scope: string;
  open_id: string;
  token_type: 'Bearer';
};

/**
 * Exchange the authorization `code` returned by TikTok for an access + refresh
 * token pair. Throws on non-200 responses or malformed bodies; the callback
 * route catches and redirects with a user-visible error.
 */
export async function exchangeCodeForToken(input: {
  code: string;
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<TiktokTokenResponse> {
  const body = new URLSearchParams({
    client_key: input.clientKey,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
  });
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TikTok token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as TiktokTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (json.error) {
    throw new Error(
      `TikTok token exchange error: ${json.error} ${json.error_description ?? ''}`,
    );
  }
  return json;
}

export type TiktokUserInfo = {
  open_id: string;
  union_id?: string;
  display_name?: string;
};

/**
 * Fetch the authenticated TikTok user's profile so we can store their handle
 * alongside the OAuth grant. Best-effort — failure here doesn't block grant
 * persistence, since the access_token alone is enough for posting.
 */
export async function fetchTiktokUserInfo(
  accessToken: string,
): Promise<TiktokUserInfo | null> {
  const url = new URL(TIKTOK_USERINFO_URL);
  url.searchParams.set('fields', 'open_id,union_id,display_name');
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { user?: TiktokUserInfo };
    };
    return json?.data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Phase 3 stub for the post-render video-upload step. The real implementation
 * posts the rendered MP4 to TikTok via the Content Posting API (chunked
 * `/v2/post/publish/inbox/video/init/` → `/upload/` → `/publish/inbox/video/`
 * sequence). Phase 2's render worker calls this once the compilation MP4 is
 * available in R2.
 *
 * TODO(0017-phase3): wire the real chunked upload flow against the TikTok
 *   Content Posting API. For Personal tier, reads the per-event access_token
 *   from `patiktok_oauth_grants` (refreshing if expired). For Setnayan tier,
 *   uses TIKTOK_SETNAYAN_REFRESH_TOKEN on the master account.
 */
export async function publishPatiktokCompilation(_input: {
  tier: 'setnayan' | 'personal';
  eventId: string;
  renderedMp4Url: string;
  caption: string;
}): Promise<{ ok: false; reason: 'not-implemented' }> {
  return { ok: false, reason: 'not-implemented' };
}
