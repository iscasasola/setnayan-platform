/**
 * Vendor Instagram connect + sync — server-side OAuth + Graph API helpers.
 *
 * Mirrors lib/panood-youtube.ts's structure (per-user OAuth authorization-code
 * flow, token exchange/refresh, inert-when-unconfigured guard) for the vendor
 * side: a vendor connects their OWN Business/Creator Instagram account and syncs
 * their recent posts into their public portfolio gallery.
 *
 * Flow: Facebook Login for Business (Instagram Graph API v21.0)
 *   AUTHORIZE   https://www.facebook.com/v21.0/dialog/oauth
 *   TOKEN       https://graph.facebook.com/v21.0/oauth/access_token
 *   LONG-LIVED  https://graph.facebook.com/v21.0/oauth/access_token
 *                 ?grant_type=fb_exchange_token
 *   PAGES       https://graph.facebook.com/v21.0/me/accounts
 *                 ?fields=instagram_business_account{id,username}
 *   MEDIA       https://graph.facebook.com/v21.0/{ig-user-id}/media
 *
 * Required env vars (owner action — Meta App with Instagram Graph API product +
 * App Review for instagram_basic + pages_show_list, which needs a Business
 * verification + 1–several-week review):
 *   META_APP_ID
 *   META_APP_SECRET
 *   META_IG_OAUTH_REDIRECT_URI  (optional — defaults to the request origin +
 *                                /api/vendor/instagram/callback)
 *
 * SECURITY: this module is server-side only. Access tokens are NEVER returned to
 * a client, NEVER logged, and NEVER placed in an error message that reaches the
 * browser. THIS MODULE IS SERVER-SIDE ONLY. Never import from a client component.
 */

import 'server-only';
import { resolveMetaAppOAuth, type MetaAppOAuthConfig } from '@/lib/integration-config';

const GRAPH_VERSION = 'v21.0';
const FB_AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const FB_TOKEN_URL = `${GRAPH_BASE}/oauth/access_token`;

/** The fixed callback path — must be registered against the Meta App. */
export const IG_OAUTH_CALLBACK_PATH = '/api/vendor/instagram/callback';

/**
 * OAuth scopes requested at consent time.
 *  - instagram_basic     → read the IG Business account's profile + media
 *  - pages_show_list     → enumerate the Pages the user manages (to find the
 *                          Page → linked instagram_business_account)
 * These require App Review before they work for accounts other than the app's
 * own testers.
 */
export const IG_OAUTH_SCOPES = ['instagram_basic', 'pages_show_list'] as const;

/**
 * Read the Meta App OAuth config from env, folding in the redirect URI. Returns
 * a status object so routes / UI can surface a clear "not configured yet"
 * message rather than throwing. `requestOrigin` is the origin the vendor hit
 * (e.g. https://www.setnayan.com); the redirect URI defaults to that origin +
 * the callback path unless META_IG_OAUTH_REDIRECT_URI overrides it.
 */
export function getMetaAppOAuthConfig(requestOrigin: string): MetaAppOAuthConfig {
  const { appId, appSecret, redirectUriOverride } = resolveMetaAppOAuth();
  const missing: string[] = [];
  if (!appId) missing.push('META_APP_ID');
  if (!appSecret) missing.push('META_APP_SECRET');
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
 * Build the Facebook OAuth consent URL. `response_type=code` gives an
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
  return `${FB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange the authorization `code` for a short-lived user access token, then
 * immediately upgrade it to a long-lived (~60-day) token. Returns the
 * long-lived token + its expiry.
 *
 * Throws on non-2xx. Callers catch and redirect with a GENERIC error reason —
 * NEVER surface the Graph error body (it can echo token fragments).
 */
export async function exchangeInstagramCodeForToken(input: {
  code: string;
  appId: string;
  appSecret: string;
  redirectUri: string;
}): Promise<{ accessToken: string; expiresInSeconds: number }> {
  // 1. code -> short-lived token
  const shortUrl = new URL(FB_TOKEN_URL);
  shortUrl.searchParams.set('client_id', input.appId);
  shortUrl.searchParams.set('client_secret', input.appSecret);
  shortUrl.searchParams.set('redirect_uri', input.redirectUri);
  shortUrl.searchParams.set('code', input.code);
  const shortRes = await fetch(shortUrl, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!shortRes.ok) {
    // Do NOT include the response body — it can leak token/secret fragments.
    throw new Error(`ig_token_exchange_failed_${shortRes.status}`);
  }
  const shortJson = (await shortRes.json()) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!shortJson.access_token) {
    throw new Error('ig_token_exchange_no_token');
  }

  // 2. short-lived -> long-lived token
  const longUrl = new URL(FB_TOKEN_URL);
  longUrl.searchParams.set('grant_type', 'fb_exchange_token');
  longUrl.searchParams.set('client_id', input.appId);
  longUrl.searchParams.set('client_secret', input.appSecret);
  longUrl.searchParams.set('fb_exchange_token', shortJson.access_token);
  const longRes = await fetch(longUrl, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache' },
  });
  if (!longRes.ok) {
    throw new Error(`ig_long_token_failed_${longRes.status}`);
  }
  const longJson = (await longRes.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!longJson.access_token) {
    throw new Error('ig_long_token_no_token');
  }
  return {
    accessToken: longJson.access_token,
    // Long-lived FB tokens default to ~60 days; fall back to 55 days if the
    // field is absent so we always have a conservative expiry to store.
    expiresInSeconds: longJson.expires_in ?? 55 * 24 * 60 * 60,
  };
}

/**
 * Refresh a long-lived token before it expires. FB long-lived user tokens can
 * be refreshed by re-running the fb_exchange_token grant with the current token
 * (it must still be valid). Returns the new token + expiry, or null on failure.
 * Best-effort — the caller keeps the old token on null and surfaces a reconnect
 * prompt when the old one has actually expired.
 */
export async function refreshInstagramToken(input: {
  accessToken: string;
  appId: string;
  appSecret: string;
}): Promise<{ accessToken: string; expiresInSeconds: number } | null> {
  try {
    const url = new URL(FB_TOKEN_URL);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', input.appId);
    url.searchParams.set('client_secret', input.appSecret);
    url.searchParams.set('fb_exchange_token', input.accessToken);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      access_token?: string;
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
 * Resolve the IG Business account linked to the user's Pages. Iterates
 * `me/accounts` and returns the FIRST Page with a linked
 * instagram_business_account. Returns null when no IG Business account is
 * linked (personal IG accounts + un-linked Pages have none) — the callback
 * surfaces a "no_ig_business_account" reason so the vendor knows to convert to
 * a Business/Creator account.
 */
export async function fetchInstagramBusinessAccount(
  accessToken: string,
): Promise<InstagramBusinessAccount | null> {
  try {
    const url = new URL(`${GRAPH_BASE}/me/accounts`);
    url.searchParams.set(
      'fields',
      'instagram_business_account{id,username}',
    );
    url.searchParams.set('access_token', accessToken);
    const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{
        instagram_business_account?: { id?: string; username?: string };
      }>;
    };
    for (const page of json.data ?? []) {
      const iga = page.instagram_business_account;
      if (iga?.id) {
        return { igUserId: iga.id, username: iga.username ?? null };
      }
    }
    return null;
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
 * Fetch the IG Business account's recent media (newest first). Capped by
 * `limit` (default 20). Best-effort — throws on a non-2xx so the sync action
 * can mark the connection as errored, but never leaks the token.
 */
export async function fetchInstagramMedia(
  igUserId: string,
  accessToken: string,
  limit = 20,
): Promise<InstagramMediaItem[]> {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(igUserId)}/media`);
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
