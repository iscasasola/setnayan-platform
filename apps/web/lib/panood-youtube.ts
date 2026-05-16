/**
 * Iteration 0011 Panood — YouTube OAuth helpers (server-side only).
 *
 * Shipped 2026-05-16 alongside the V1 scope expansion that wires real
 * OAuth on the V1.5+ scaffold pages (see CLAUDE.md decision log row
 * 2026-05-16 "OAuth wiring for V1.5+ scaffold setup pages shipped early").
 *
 * Implements Google's OAuth 2.0 authorization-code flow against the YouTube
 * Data API v3 for per-couple BYO YouTube broadcasting. Couples connect their
 * own channel here; the V1.5+ broadcaster (still TODO(0011)) will use the
 * stored refresh token to create + push the live broadcast.
 *
 * Google endpoints
 *   (per developers.google.com/identity/protocols/oauth2/web-server):
 *   AUTHORIZE      https://accounts.google.com/o/oauth2/v2/auth
 *   TOKEN          https://oauth2.googleapis.com/token
 *   REVOKE         https://oauth2.googleapis.com/revoke
 *   USERINFO       https://www.googleapis.com/youtube/v3/channels?mine=true
 *
 * Required env vars (owner action — Google Cloud project + YouTube Data API
 * v3 enabled + OAuth consent screen verified, 1-4wk Google review):
 *   YOUTUBE_OAUTH_CLIENT_ID
 *   YOUTUBE_OAUTH_CLIENT_SECRET
 *   YOUTUBE_OAUTH_REDIRECT_URI — must exactly match the entry registered on
 *                                the Google Cloud OAuth client (e.g.
 *                                https://www.setnayan.com/api/oauth/youtube/callback)
 *
 * THIS MODULE IS SERVER-SIDE ONLY. Never import from a client component.
 */

import 'server-only';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const YOUTUBE_CHANNELS_URL = 'https://www.googleapis.com/youtube/v3/channels';

/**
 * Scopes requested at consent time. `youtube` gives broadcast lifecycle
 * (create/start/end live broadcasts via the LiveBroadcasts resource);
 * `youtube.upload` is included so the future "Upload the same-day-edit
 * back to the channel" feature (TODO(0011)) doesn't require a re-consent.
 */
export const YOUTUBE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.upload',
] as const;

export type PanoodYoutubeConfigStatus =
  | { ready: true; clientId: string; clientSecret: string; redirectUri: string }
  | { ready: false; missing: ReadonlyArray<string> };

/**
 * Read the YouTube OAuth config from env. Returns a status object that lets
 * routes / UI surface a clear "YouTube OAuth not yet configured — owner
 * action required" message rather than throwing at request time. This is
 * the graceful-fallback hook: until the owner finishes Google Cloud setup
 * (verified-app review 1-4wk), every Connect CTA degrades to a "coming
 * soon" placeholder.
 */
export function getYoutubeOAuthConfig(): PanoodYoutubeConfigStatus {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID ?? '';
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? '';
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? '';
  const missing: string[] = [];
  if (!clientId) missing.push('YOUTUBE_OAUTH_CLIENT_ID');
  if (!clientSecret) missing.push('YOUTUBE_OAUTH_CLIENT_SECRET');
  if (!redirectUri) missing.push('YOUTUBE_OAUTH_REDIRECT_URI');
  if (missing.length > 0) return { ready: false, missing };
  return { ready: true, clientId, clientSecret, redirectUri };
}

/**
 * Build the Google OAuth consent URL. `access_type=offline` + `prompt=consent`
 * forces a refresh_token to be returned every time (without prompt=consent,
 * a returning user who already approved the same scopes does NOT get a fresh
 * refresh_token — Google reuses the prior grant and only returns
 * access_token, which is useless to us since we discarded the prior refresh
 * token on disconnect).
 */
export function buildYoutubeAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_OAUTH_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
  });
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

export type YoutubeTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: 'Bearer';
};

/**
 * Exchange the authorization `code` returned by Google for an access +
 * refresh token pair. Throws on non-200 responses; the callback route
 * catches and redirects with a user-visible error.
 *
 * Note: `refresh_token` is only present on the FIRST consent. With
 * `prompt=consent` forced in buildYoutubeAuthorizeUrl above we should
 * always get one — but the caller still narrows the type defensively.
 */
export async function exchangeYoutubeCodeForToken(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<YoutubeTokenResponse> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube token exchange failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as YoutubeTokenResponse & {
    error?: string;
    error_description?: string;
  };
  if (json.error) {
    throw new Error(
      `YouTube token exchange error: ${json.error} ${json.error_description ?? ''}`,
    );
  }
  return json;
}

/**
 * Refresh an expired access_token using the long-lived refresh_token.
 * Called by the /api/cron/oauth-refresh worker.
 */
export async function refreshYoutubeAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`YouTube token refresh failed: ${res.status} ${text}`);
  }
  return res.json();
}

export type YoutubeChannel = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
};

/**
 * Fetch the authenticated user's primary YouTube channel so we can store
 * the channel id + display name alongside the OAuth grant. Best-effort —
 * if the API call fails (quota, transient), the callback still persists
 * the grant with external_account_id=null and a "Connected channel" label.
 */
export async function fetchYoutubeChannel(
  accessToken: string,
): Promise<YoutubeChannel | null> {
  const url = new URL(YOUTUBE_CHANNELS_URL);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('mine', 'true');
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet?: {
          title?: string;
          thumbnails?: { default?: { url?: string } };
        };
      }>;
    };
    const channel = json.items?.[0];
    if (!channel) return null;
    return {
      id: channel.id,
      title: channel.snippet?.title ?? 'Connected channel',
      thumbnailUrl: channel.snippet?.thumbnails?.default?.url ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * POST the refresh token to Google's revoke endpoint. Best-effort — Google
 * returns 200 if the token was valid, 400 if it was already revoked. We
 * treat both as success (revoked_at is set regardless on our side).
 */
export async function revokeYoutubeToken(refreshToken: string): Promise<void> {
  const body = new URLSearchParams({ token: refreshToken });
  await fetch(GOOGLE_REVOKE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: body.toString(),
  }).catch(() => {
    // Swallow network errors — the local revoked_at update is the source
    // of truth for whether we'll ever use this token again.
  });
}

/**
 * Generate a high-entropy random state token for the OAuth CSRF check.
 * 24 bytes → 48 hex chars. Same scheme as the patiktok/tiktok OAuth flow
 * so the shared `oauth_state` table sees uniform-looking nonces.
 */
export function generateYoutubeStateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
