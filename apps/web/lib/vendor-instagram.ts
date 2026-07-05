/**
 * Vendor Instagram connect + sync — server-side OAuth + Graph API helpers.
 *
 * Mirrors lib/panood-youtube.ts's structure (per-user OAuth authorization-code
 * flow, token exchange/refresh, inert-when-unconfigured guard) for the vendor
 * side: a vendor connects their OWN Business/Creator Instagram account and syncs
 * their recent posts into their public portfolio gallery.
 *
 * Flow: "Instagram API with Instagram Login" (Instagram Graph API — NO Facebook
 * Page required, better for PH vendors who run Instagram without a linked Page):
 *   AUTHORIZE   https://www.instagram.com/oauth/authorize
 *                 ?client_id&redirect_uri&response_type=code&scope&state
 *   TOKEN       POST https://api.instagram.com/oauth/access_token
 *                 (form: client_id, client_secret, grant_type=authorization_code,
 *                  redirect_uri, code) → { access_token, user_id, permissions }
 *   LONG-LIVED  GET  https://graph.instagram.com/access_token
 *                 ?grant_type=ig_exchange_token&client_secret&access_token
 *                 → { access_token, token_type, expires_in }  (~60 days)
 *   REFRESH     GET  https://graph.instagram.com/refresh_access_token
 *                 ?grant_type=ig_refresh_token&access_token
 *   PROFILE     GET  https://graph.instagram.com/me?fields=user_id,username
 *   MEDIA       GET  https://graph.instagram.com/me/media?fields=...
 *
 * Required env vars (owner action — an Instagram app with the "Instagram API
 * with Instagram Login" product; the redirect URI below is registered under the
 * product's "Valid OAuth Redirect URIs"):
 *   IG_APP_ID                   — the Instagram app's own app id.
 *   IG_APP_SECRET               — the Instagram app's own app secret.
 *   META_IG_OAUTH_REDIRECT_URI  (optional — defaults to the request origin +
 *                                /api/vendor/instagram/callback)
 *
 * SECURITY: this module is server-side only. Access tokens are NEVER returned to
 * a client, NEVER logged, and NEVER placed in an error message that reaches the
 * browser. THIS MODULE IS SERVER-SIDE ONLY. Never import from a client component.
 */

import 'server-only';
import { resolveMetaAppOAuth, type MetaAppOAuthConfig } from '@/lib/integration-config';

/** Instagram-Login OAuth endpoints (NOT the facebook.com / graph.facebook.com Page flow). */
const IG_AUTHORIZE_URL = 'https://www.instagram.com/oauth/authorize';
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_BASE = 'https://graph.instagram.com';
const IG_LONG_TOKEN_URL = `${GRAPH_BASE}/access_token`;
const IG_REFRESH_TOKEN_URL = `${GRAPH_BASE}/refresh_access_token`;

/** The fixed callback path — must be registered against the Instagram app. */
export const IG_OAUTH_CALLBACK_PATH = '/api/vendor/instagram/callback';

/**
 * OAuth scopes requested at consent time (Instagram Login product scopes —
 * comma-delimited if more are added).
 *  - instagram_business_basic → read the IG Business/Creator account's profile
 *                               + media. All we need for a read-only portfolio
 *                               sync.
 */
export const IG_OAUTH_SCOPES = ['instagram_business_basic'] as const;

/**
 * Read the Instagram app OAuth config from env, folding in the redirect URI.
 * Returns a status object so routes / UI can surface a clear "not configured
 * yet" message rather than throwing. `requestOrigin` is the origin the vendor
 * hit (e.g. https://www.setnayan.com); the redirect URI defaults to that origin
 * + the callback path unless META_IG_OAUTH_REDIRECT_URI overrides it.
 */
export function getMetaAppOAuthConfig(requestOrigin: string): MetaAppOAuthConfig {
  const { appId, appSecret, redirectUriOverride } = resolveMetaAppOAuth();
  const missing: string[] = [];
  if (!appId) missing.push('IG_APP_ID');
  if (!appSecret) missing.push('IG_APP_SECRET');
  if (missing.length > 0) return { ready: false, missing };
  const redirectUri =
    redirectUriOverride || `${requestOrigin.replace(/\/+$/, '')}${IG_OAUTH_CALLBACK_PATH}`;
  return { ready: true, appId, appSecret, redirectUri };
}

/** True when the feature is armed (App ID + Secret both present). */
export function isInstagramConnectConfigured(): boolean {
  const { appId, appSecret } = resolveMetaAppOAuth();
  return Boolean(appId && appSecret);
}

/**
 * Build the Instagram-Login OAuth consent URL. `response_type=code` gives an
 * authorization code we exchange server-side for a token.
 */
export function buildInstagramAuthorizeUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: IG_OAUTH_SCOPES.join(','),
    state: input.state,
  });
  return `${IG_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization `code` for a short-lived user access token, then
 * immediately upgrade it to a long-lived (~60-day) token. Returns the
 * long-lived token + its expiry.
 *
 * Throws on non-2xx. Callers catch and redirect with a GENERIC error reason —
 * NEVER surface the token-exchange body (it can echo token fragments).
 */
export async function exchangeInstagramCodeForToken(input: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  // 1. code -> short-lived token (form-urlencoded POST to api.instagram.com).
  const form = new URLSearchParams({
    client_id: input.appId,
    client_secret: input.appSecret,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
    code: input.code,
  });
  const shortRes = await fetch(IG_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: form.toString(),
  });
  if (!shortRes.ok) {
    // Do NOT include the response body — it can leak token/secret fragments.
    throw new Error(`ig_token_exchange_failed_${shortRes.status}`);
  }
  const shortJson = (await shortRes.json()) as {
    access_token?: string;
    user_id?: string | number;
    permissions?: string;
  };
  if (!shortJson.access_token) {
    throw new Error('ig_token_exchange_no_token');
  }

  // 2. short-lived -> long-lived token (GET graph.instagram.com/access_token).
  const longUrl = new URL(IG_LONG_TOKEN_URL);
  longUrl.searchParams.set('grant_type', 'ig_exchange_token');
  longUrl.searchParams.set('client_secret', input.appSecret);
  longUrl.searchParams.set('access_token', shortJson.access_token);
  const longRes = await fetch(longUrl, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!longRes.ok) {
    throw new Error(`ig_long_token_failed_${longRes.status}`);
  }
  const longJson = (await longRes.json()) as {
    access_token?: string;
    token_type?: string;
    expires_in?: number;
  };
  if (!longJson.access_token) {
    throw new Error('ig_long_token_no_token');
  }
  return {
    accessToken: longJson.access_token,
    // Long-lived IG tokens default to ~60 days; fall back to 55 days if the
    // field is absent so we always have a conservative expiry to store.
    expiresInSeconds: longJson.expires_in ?? 55 * 24 * 60 * 60,
  };
}

/**
 * Refresh a long-lived token before it expires. IG long-lived tokens are
 * refreshed with the ig_refresh_token grant while still valid (and at least a
 * day old). Returns the new token + expiry, or null on failure. Best-effort —
 * the caller keeps the old token on null and surfaces a reconnect prompt when
 * the old one has actually expired.
 */
export async function refreshInstagramToken(input: {
  accessToken: string;
  appId: string;
  appSecret: string;
}): Promise<{ accessToken: string; expiresInSeconds: number } | null> {
  try {
    const url = new URL(IG_REFRESH_TOKEN_URL);
    url.searchParams.set('grant_type', 'ig_refresh_token');
    url.searchParams.set('access_token', input.accessToken);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      access_token?: string;
      token_type?: string;
      expires_in?: number;
    };
    if (!json.access_token) return null;
    return {
      accessToken: json.access_token,
      expiresInSeconds: json.expires_in ?? 55 * 24 * 60 * 60,
    };
  } catch {
    return null;
  }
}

export type InstagramBusinessAccount = { igUserId: string; username: string | null };

/**
 * Resolve the connected IG account's profile (id + username) via the
 * Instagram-Login /me endpoint. With Instagram Login the token itself is scoped
 * to the vendor's own IG Business/Creator account — no Facebook Page walk is
 * needed. Returns null when the profile call fails; the callback surfaces a
 * generic reason so the vendor can retry.
 */
export async function fetchInstagramBusinessAccount(
  accessToken: string,
): Promise<InstagramBusinessAccount | null> {
  try {
    const url = new URL(`${GRAPH_BASE}/me`);
    url.searchParams.set('fields', 'user_id,username');
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      user_id?: string | number;
      username?: string;
    };
    // Instagram Login returns the IG-scoped account id as `user_id`.
    const rawId = json.user_id;
    const igUserId =
      typeof rawId === 'number' ? String(rawId) : typeof rawId === 'string' ? rawId : '';
    if (!igUserId) return null;
    return { igUserId, username: json.username ?? null };
  } catch {
    return null;
  }
}

export type InstagramMediaItem = {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  caption: string | null;
  timestamp: string | null;
};

/**
 * Fetch the connected IG account's recent media (newest first) via the
 * Instagram-Login /me/media endpoint. Capped by `limit` (default 20).
 * Best-effort — throws on a non-2xx so the sync action can mark the connection
 * as errored, but never leaks the token.
 *
 * `_igUserId` is retained in the signature (callers pass the stored id) but the
 * Instagram-Login media read is token-scoped, so it hits /me/media directly.
 */
export async function fetchInstagramMedia(
  _igUserId: string,
  accessToken: string,
  limit = 20,
): Promise<InstagramMediaItem[]> {
  const url = new URL(`${GRAPH_BASE}/me/media`);
  url.searchParams.set(
    'fields',
    'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp',
  );
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 1), 50)));
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) {
    throw new Error(`ig_media_fetch_failed_${res.status}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      permalink?: string;
      caption?: string;
      timestamp?: string;
    }>;
  };
  const items: InstagramMediaItem[] = [];
  for (const m of json.data ?? []) {
    if (!m.id) continue;
    const t = m.media_type;
    const mediaType: InstagramMediaItem['mediaType'] =
      t === 'VIDEO' ? 'VIDEO' : t === 'CAROUSEL_ALBUM' ? 'CAROUSEL_ALBUM' : 'IMAGE';
    items.push({
      id: m.id,
      mediaType,
      mediaUrl: m.media_url ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      permalink: m.permalink ?? null,
      caption: m.caption ?? null,
      timestamp: m.timestamp ?? null,
    });
  }
  return items;
}

/**
 * Generate a high-entropy random state token for the OAuth CSRF check.
 * 24 bytes → 48 hex chars. Matches the panood/patiktok nonce scheme.
 */
export function generateInstagramStateToken(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
