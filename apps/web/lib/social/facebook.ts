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
 *   META_PAGE_ACCESS_TOKEN — a long-lived Page access token with
 *                            pages_manage_posts
 *
 * NEVER THROWS — every failure path (missing env, timeout, HTTP error,
 * Graph error payload) returns `{ ok: false, error }` so the flush engine
 * can stamp the row 'failed' and move on without try/catch gymnastics.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/** Abort a hung Graph call after ~15s — a flush must never wedge a request. */
const GRAPH_TIMEOUT_MS = 15_000;

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

  // Photo route only for fetchable http(s) images — Graph downloads the URL
  // itself, so a data: URI or a non-image would just fail server-side there.
  const asPhoto =
    typeof mediaUrl === 'string' &&
    /^https?:\/\//i.test(mediaUrl) &&
    /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(mediaUrl);

  const params = new URLSearchParams({ access_token: accessToken });
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
