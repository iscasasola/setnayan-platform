import 'server-only';

/**
 * apps/web/lib/social/facebook.ts
 *
 * Facebook Page publishing client (Phase A of the social auto-publish
 * pipeline — corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8).
 * Thin wrapper over the Graph API v21.0 page-publishing endpoints:
 *
 *   • photo posts  → POST /{page-id}/photos  { url, caption }
 *   • text/link    → POST /{page-id}/feed    { message, link }
 *
 * Env contract (owner pastes these when flipping autopublish on):
 *   META_PAGE_ID           — the Setnayan Facebook Page id
 *   META_PAGE_ACCESS_TOKEN — either a long-lived System User token (the
 *                            Meta-recommended credential for automated
 *                            posting — never-expiring, asset-scoped) OR a
 *                            Page token, with pages_manage_posts +
 *                            pages_read_engagement. A System User token CANNOT
 *                            publish to /{page}/feed directly, so we exchange
 *                            it for the Page token first — see
 *                            resolvePageAccessToken().
 *
 * NEVER THROWS — every failure path (missing env, timeout, HTTP error,
 * Graph error payload) returns `{ ok: false, error }` so the flush engine
 * can stamp the row 'failed' and move on without try/catch gymnastics.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/** Abort a hung Graph call after ~15s — a flush must never wedge a request. */
const GRAPH_TIMEOUT_MS = 15_000;

/**
 * Per-process memo of the resolved Page token, keyed by the configured source
 * token. A Page token derived from a never-expiring System User token is itself
 * non-expiring, so caching across invocations of a warm serverless instance is
 * safe; the source-token key auto-invalidates if the env var is rotated.
 */
let cachedPageToken: { source: string; token: string } | null = null;

/**
 * Exchange the configured META_PAGE_ACCESS_TOKEN for the Page's OWN access
 * token. The Graph page-publish endpoints (/{page}/feed, /{page}/photos) reject
 * a System User token with a (#200) "requires … as an admin" error — they need
 * the page token, obtained via GET /{page-id}?fields=access_token. If the
 * configured token is ALREADY a Page token this returns it unchanged, so the
 * call is safe for either credential type. On any exchange failure the caller
 * falls back to the configured token (no worse than posting it raw).
 */
async function resolvePageAccessToken(
  pageId: string,
  configuredToken: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  if (cachedPageToken && cachedPageToken.source === configuredToken) {
    return { ok: true, token: cachedPageToken.token };
  }
  const url =
    `${GRAPH_API_BASE}/${pageId}?fields=access_token&access_token=` +
    encodeURIComponent(configuredToken);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const payload = (await res.json().catch(() => null)) as
      | { access_token?: string; error?: { message?: string } }
      | null;
    const pageToken = payload?.access_token;
    if (!res.ok || !pageToken) {
      const detail =
        payload?.error?.message ?? `page-token exchange HTTP ${res.status}`;
      return { ok: false, error: detail.slice(0, 300) };
    }
    cachedPageToken = { source: configuredToken, token: pageToken };
    return { ok: true, token: pageToken };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'page-token exchange failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export type FacebookPostResult =
  | { ok: true; externalId: string; postUrl: string }
  | { ok: false; error: string };

/** True once the owner has pasted the Meta env vars (Vercel project env). */
export function isFacebookConfigured(): boolean {
  return Boolean(process.env.META_PAGE_ID && process.env.META_PAGE_ACCESS_TOKEN);
}

/**
 * Publish one post to the Setnayan Facebook Page. When `mediaUrl` is a
 * public http(s) image, posts it as a photo with the message as caption
 * (photo posts get materially better reach); otherwise a plain feed post
 * with an optional link attachment.
 */
export async function postToFacebookPage({
  message,
  linkUrl,
  mediaUrl,
}: {
  message: string;
  linkUrl?: string | null;
  mediaUrl?: string | null;
}): Promise<FacebookPostResult> {
  const pageId = process.env.META_PAGE_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!pageId || !accessToken) {
    return { ok: false, error: 'Facebook is not configured (META_PAGE_ID / META_PAGE_ACCESS_TOKEN missing).' };
  }

  // Exchange a System User token for the Page token (no-op for a real Page
  // token). On exchange failure, fall back to the configured token — the post
  // will surface any genuine auth problem itself.
  const resolved = await resolvePageAccessToken(pageId, accessToken);
  const postToken = resolved.ok ? resolved.token : accessToken;

  // Photo route only for fetchable http(s) images — Graph downloads the URL
  // itself, so a data: URI or a non-image would just fail server-side there.
  const asPhoto =
    typeof mediaUrl === 'string' &&
    /^https?:\/\//i.test(mediaUrl) &&
    /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(mediaUrl);

  const params = new URLSearchParams({ access_token: postToken });
  let endpoint: string;
  if (asPhoto && mediaUrl) {
    endpoint = `${GRAPH_API_BASE}/${pageId}/photos`;
    params.set('url', mediaUrl);
    params.set('caption', message);
  } else {
    endpoint = `${GRAPH_API_BASE}/${pageId}/feed`;
    params.set('message', message);
    if (linkUrl && /^https?:\/\//i.test(linkUrl)) params.set('link', linkUrl);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });

    const payload = (await res.json().catch(() => null)) as
      | { id?: string; post_id?: string; error?: { message?: string; code?: number } }
      | null;

    if (!res.ok || !payload || payload.error) {
      const detail =
        payload?.error?.message ??
        `Graph API HTTP ${res.status}${payload ? '' : ' (non-JSON body)'}`;
      return { ok: false, error: detail.slice(0, 500) };
    }

    // /photos returns { id, post_id } — post_id is the feed-story id, the
    // better permalink target; /feed returns { id } (already "{page}_{post}").
    const externalId = payload.post_id ?? payload.id;
    if (!externalId) {
      return { ok: false, error: 'Graph API returned no post id.' };
    }
    return {
      ok: true,
      externalId,
      postUrl: `https://www.facebook.com/${externalId}`,
    };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `Graph API call timed out after ${GRAPH_TIMEOUT_MS / 1000}s.`
        : err instanceof Error
          ? err.message
          : 'Unknown Facebook publish error.';
    return { ok: false, error: message.slice(0, 500) };
  } finally {
    clearTimeout(timeout);
  }
}
