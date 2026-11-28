import 'server-only';
import { resolveMetaConfig } from '@/lib/integration-config';
import { multiPhotoUrls, publishMultiPhoto, type GraphCall } from '@/lib/social/facebook-multi-photo';
import { buildSinglePostRequest, parseScheduledPosts } from '@/lib/social/facebook-request';
import type { FbOps, FbScheduledPost } from '@/lib/social/fb-queue';
import { socialCardUrl } from '@/lib/social/urls';

/**
 * apps/web/lib/social/facebook.ts
 *
 * Facebook Page publishing client (Phase A of the social auto-publish
 * pipeline — corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8).
 * Thin wrapper over the Graph API v21.0 page-publishing endpoints:
 *
 *   • photo posts  → POST /{page-id}/photos  { url, caption }
 *   • multi-photo  → each image POST /{page-id}/photos { published: false }, in order, then
 *                    POST /{page-id}/feed { message, attached_media } — all or nothing
 *                    (lib/social/facebook-multi-photo.ts, controller 2026-11-28)
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
  // The token goes in the Authorization header, never the query string — a URL ends up in proxy and server logs.
  const url = `${GRAPH_API_BASE}/${pageId}?fields=access_token`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${configuredToken}` },
      signal: controller.signal,
    });
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
  | {
      ok: false;
      error: string;
      /** Multi-photo only: unpublished uploads the clean-up could not delete (photo id + Graph error). */
      cleanupFailures?: Array<{ photo_id: string; error: string }>;
    };

/**
 * True once the Meta credential is set (Integration Console DB or Vercel env).
 * Async because it resolves DB-first; byte-identical to the env check when the
 * DB is empty.
 */
export async function isFacebookConfigured(): Promise<boolean> {
  const { pageId, accessToken } = await resolveMetaConfig();
  return Boolean(pageId && accessToken);
}

/** The Page id plus a Graph caller holding the Page token, or why Facebook cannot be reached. */
async function pageGraph(): Promise<{ ok: true; pageId: string; call: GraphCall } | { ok: false; error: string }> {
  const { pageId, accessToken } = await resolveMetaConfig();
  if (!pageId || !accessToken) {
    return { ok: false, error: 'Facebook is not configured (META_PAGE_ID / META_PAGE_ACCESS_TOKEN missing).' };
  }
  // Exchange a System User token for the Page token (no-op for a real Page token). On exchange failure, fall back to
  // the configured token — the call will surface any genuine auth problem itself.
  const resolved = await resolvePageAccessToken(pageId, accessToken);
  return { ok: true, pageId, call: graphCaller(resolved.ok ? resolved.token : accessToken) };
}

/**
 * Publish one post to the Setnayan Facebook Page — or, with `scheduleAt`, hand it to Facebook as a SCHEDULED post
 * that Facebook publishes at that time (owner 2026-11-28: Facebook holds the schedule; 10 min to ~30 days ahead).
 * Two or more `mediaUrls` make ONE multi-photo post, all or nothing; else a photo post when `mediaUrl` is a public
 * image (better reach), else a feed post with an optional link. `externalId` is the post's id on Facebook — keep it
 * to delete or edit a scheduled post. Never throws.
 */
export async function postToFacebookPage({
  message,
  linkUrl,
  mediaUrl,
  mediaUrls,
  scheduleAt,
}: {
  message: string;
  linkUrl?: string | null;
  mediaUrl?: string | null;
  /** Two or more public images, in order → ONE multi-photo post, or nothing. */
  mediaUrls?: readonly string[] | null;
  /** Hand it to Facebook as a scheduled post for this time instead of publishing now. */
  scheduleAt?: Date | null;
}): Promise<FacebookPostResult> {
  const page = await pageGraph();
  if (!page.ok) return { ok: false, error: page.error };

  const photos = multiPhotoUrls(mediaUrls);
  if (photos) {
    const multi = await publishMultiPhoto(page.call, page.pageId, message, photos, { scheduleAt });
    return multi.ok
      ? { ok: true, externalId: multi.externalId, postUrl: `https://www.facebook.com/${multi.externalId}` }
      : { ok: false, error: multi.error, cleanupFailures: multi.cleanupFailures };
  }

  const request = buildSinglePostRequest({ pageId: page.pageId, message, linkUrl, mediaUrl, scheduleAt });
  const res = await page.call('POST', request.path, request.params);
  if (!res.ok) return { ok: false, error: res.error.slice(0, 500) };
  // /photos returns { id, post_id } — post_id is the feed-story id, the better permalink and delete/edit target;
  // /feed returns { id } (already "{page}_{post}").
  const postId = typeof res.body.post_id === 'string' ? res.body.post_id : null;
  const id = typeof res.body.id === 'string' ? res.body.id : null;
  const externalId = postId ?? id;
  if (!externalId) return { ok: false, error: 'Graph API returned no post id.' };
  return { ok: true, externalId, postUrl: `https://www.facebook.com/${externalId}` };
}

export type FacebookOpResult = { ok: true } | { ok: false; error: string };

/** Delete a post on the Page — a scheduled one before it goes out, or a live one. Never throws. */
export async function deleteFacebookPost(postId: string): Promise<FacebookOpResult> {
  const page = await pageGraph();
  if (!page.ok) return page;
  const res = await page.call('DELETE', `/${encodeURIComponent(postId)}`, {});
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Replace a post's text on the Page (a scheduled post keeps its time). Never throws. */
export async function updateFacebookPostMessage(postId: string, message: string): Promise<FacebookOpResult> {
  const page = await pageGraph();
  if (!page.ok) return page;
  const res = await page.call('POST', `/${encodeURIComponent(postId)}`, { message });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Has Facebook published this post yet? `null` = could not ask (the post may be gone). Never throws. */
export async function isFacebookPostPublished(
  postId: string,
): Promise<{ ok: true; published: boolean } | { ok: false; error: string }> {
  const page = await pageGraph();
  if (!page.ok) return page;
  const res = await page.call('GET', `/${encodeURIComponent(postId)}`, { fields: 'is_published' });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, published: res.body.is_published === true };
}

/**
 * The Page's posts still waiting on Facebook's clock — GET /{page-id}/scheduled_posts, up to 4 pages of 100.
 * Used to find a post whose schedule call timed out or whose id was never saved, so it is never scheduled twice.
 * Never throws.
 */
export async function listScheduledFacebookPosts(): Promise<{ ok: true; posts: FbScheduledPost[] } | { ok: false; error: string }> {
  const page = await pageGraph();
  if (!page.ok) return page;
  const posts: FbScheduledPost[] = [];
  let after: string | null = null;
  for (let i = 0; i < 4; i += 1) {
    const params: Record<string, string> = { fields: 'id,message,scheduled_publish_time', limit: '100' };
    if (after) params.after = after;
    const res = await page.call('GET', `/${encodeURIComponent(page.pageId)}/scheduled_posts`, params);
    if (!res.ok) return { ok: false, error: res.error };
    posts.push(...parseScheduledPosts(res.body));
    const paging = res.body.paging as { cursors?: { after?: string }; next?: string } | undefined;
    after = paging?.next && paging.cursors?.after ? paging.cursors.after : null;
    if (!after) break;
  }
  return { ok: true, posts };
}

export type FacebookCommentResult = { ok: true; commentId: string } | { ok: false; error: string };

/**
 * Post the first comment under a Page post we just published (owner, 28 Nov 2026: the library's "Pinned first
 * comment"): POST /{post-id}/comments { message } with the Page token. The Graph API has NO call to pin a comment on
 * a Page post, so the caller records "pin by hand" — the owner pins it in Meta. Never throws.
 */
export async function commentOnFacebookPost(postId: string, message: string): Promise<FacebookCommentResult> {
  const page = await pageGraph();
  if (!page.ok) return page;
  const res = await page.call('POST', `/${encodeURIComponent(postId)}/comments`, { message });
  if (!res.ok) return { ok: false, error: res.error.slice(0, 500) };
  return typeof res.body.id === 'string' ? { ok: true, commentId: res.body.id } : { ok: false, error: 'Graph API returned no comment id.' };
}

/**
 * One Graph request with the Page token and the same timeout as a post. Never throws. The token never travels in a
 * URL (a URL ends up in proxy and server logs): it is in the form BODY for POST and DELETE, and in the
 * Authorization header for GET.
 */
function graphCaller(token: string): GraphCall {
  return async (method, path, params) => {
    const body = new URLSearchParams({ ...params, access_token: token });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
    try {
      const res =
        method === 'GET'
          ? await fetch(`${GRAPH_API_BASE}${path}?${new URLSearchParams(params).toString()}`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            })
          : await fetch(`${GRAPH_API_BASE}${path}`, {
              method,
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
              signal: controller.signal,
            });
      const payload = (await res.json().catch(() => null)) as (Record<string, unknown> & { error?: { message?: string } }) | null;
      if (!res.ok || !payload || payload.error) {
        return { ok: false, error: (payload?.error?.message ?? `Graph API HTTP ${res.status}`).slice(0, 300) };
      }
      return { ok: true, body: payload };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error && err.name === 'AbortError'
            ? `Graph API call timed out after ${GRAPH_TIMEOUT_MS / 1000}s.`
            : err instanceof Error
              ? err.message.slice(0, 300)
              : 'Unknown Graph API error.',
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

/**
 * The real Facebook calls for `lib/social/fb-queue.ts`. A scheduled post carries the same media rule as a post sent
 * now: the row's own image wins, else the branded card; two or more photos make one multi-photo post.
 */
export const facebookOps: FbOps = {
  schedule: (row, at) =>
    postToFacebookPage({
      message: row.body,
      linkUrl: row.link_url,
      mediaUrl: row.media_url || socialCardUrl(row.post_id),
      mediaUrls: row.media_urls,
      scheduleAt: at,
    }),
  remove: deleteFacebookPost,
  editMessage: updateFacebookPostMessage,
  isPublished: isFacebookPostPublished,
  comment: commentOnFacebookPost,
  listScheduled: listScheduledFacebookPosts,
};
