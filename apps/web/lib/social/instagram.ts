import 'server-only';

/**
 * apps/web/lib/social/instagram.ts
 *
 * Instagram feed publishing client (Phase B of the social auto-publish
 * pipeline — corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` § 8).
 * Mirrors lib/social/facebook.ts: same NEVER-THROWS contract, same ~15s
 * timeouts, same result shape.
 *
 * Instagram's Content Publishing API is a TWO-STEP flow on Graph v21.0:
 *   1. POST /{ig-user-id}/media          { image_url, caption } → creation_id
 *   2. POST /{ig-user-id}/media_publish  { creation_id }        → media id
 * Then GET /{media-id}?fields=permalink for the real post URL (media_publish
 * doesn't return a shortcode).
 *
 * Env contract (owner pastes these when flipping Instagram on):
 *   IG_USER_ID             — the Instagram Business account id linked to the
 *                            Setnayan Facebook Page.
 *   META_PAGE_ACCESS_TOKEN — the SAME Page access token Facebook uses; it
 *                            authorizes the IG endpoints when the app has
 *                            instagram_basic + instagram_content_publish +
 *                            pages_show_list.
 *
 * IG REQUIRES a public, reachable JPEG/PNG image_url (no text-only posts) and
 * a caption ≤2200 chars — our on-the-fly card route satisfies both. The flush
 * always passes the branded card URL as image_url, so this never has to guard
 * against a missing image at the dispatch layer.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/** Abort a hung Graph call after ~15s — a flush must never wedge a request. */
const GRAPH_TIMEOUT_MS = 15_000;

/** IG caption hard cap (Graph rejects longer). */
const IG_CAPTION_MAX = 2200;

export type InstagramPostResult =
  | { ok: true; externalId: string; postUrl: string }
  | { ok: false; error: string };

/** True once the owner has pasted IG_USER_ID + the Page token (Vercel env). */
export function isInstagramConfigured(): boolean {
  return Boolean(process.env.META_PAGE_ACCESS_TOKEN && process.env.IG_USER_ID);
}

/** One Graph POST with a shared timeout; returns parsed JSON or a typed error. */
async function graphPost(
  endpoint: string,
  params: URLSearchParams,
): Promise<
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string }
> {
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
      | (Record<string, unknown> & { error?: { message?: string } })
      | null;
    if (!res.ok || !payload || payload.error) {
      const detail =
        payload?.error?.message ??
        `Graph API HTTP ${res.status}${payload ? '' : ' (non-JSON body)'}`;
      return { ok: false, error: detail.slice(0, 500) };
    }
    return { ok: true, payload };
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'AbortError'
        ? `Graph API call timed out after ${GRAPH_TIMEOUT_MS / 1000}s.`
        : err instanceof Error
          ? err.message
          : 'Unknown Instagram publish error.';
    return { ok: false, error: message.slice(0, 500) };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Publish one single-image post to the Setnayan Instagram feed. Two-step
 * container create → publish, then a best-effort permalink fetch.
 */
export async function postToInstagramFeed({
  imageUrl,
  caption,
}: {
  imageUrl: string;
  caption: string;
}): Promise<InstagramPostResult> {
  const igUserId = process.env.IG_USER_ID;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  if (!igUserId || !accessToken) {
    return {
      ok: false,
      error: 'Instagram is not configured (IG_USER_ID / META_PAGE_ACCESS_TOKEN missing).',
    };
  }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return { ok: false, error: 'Instagram requires a public http(s) image URL.' };
  }

  // Step 1 — create the media container.
  const createParams = new URLSearchParams({
    access_token: accessToken,
    image_url: imageUrl,
    caption: caption.slice(0, IG_CAPTION_MAX),
  });
  const created = await graphPost(`${GRAPH_API_BASE}/${igUserId}/media`, createParams);
  if (!created.ok) return { ok: false, error: created.error };
  const creationId =
    typeof created.payload.id === 'string' ? created.payload.id : undefined;
  if (!creationId) {
    return { ok: false, error: 'Instagram media create returned no creation id.' };
  }

  // Step 2 — publish the container.
  const publishParams = new URLSearchParams({
    access_token: accessToken,
    creation_id: creationId,
  });
  const published = await graphPost(
    `${GRAPH_API_BASE}/${igUserId}/media_publish`,
    publishParams,
  );
  if (!published.ok) return { ok: false, error: published.error };
  const mediaId =
    typeof published.payload.id === 'string' ? published.payload.id : undefined;
  if (!mediaId) {
    return { ok: false, error: 'Instagram media_publish returned no media id.' };
  }

  // Step 3 — best-effort permalink (media_publish doesn't return a shortcode).
  const postUrl = await fetchPermalink(mediaId, accessToken);
  return { ok: true, externalId: mediaId, postUrl };
}

/**
 * GET /{media-id}?fields=permalink for the real post URL. Falls back to the
 * IG home URL on any failure — we never throw, and a missing permalink must
 * not fail an otherwise-successful publish.
 */
async function fetchPermalink(mediaId: string, accessToken: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${GRAPH_API_BASE}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`,
      { signal: controller.signal },
    );
    const payload = (await res.json().catch(() => null)) as
      | { permalink?: string }
      | null;
    if (res.ok && payload?.permalink) return payload.permalink;
  } catch {
    // swallow — fall through to the home URL.
  } finally {
    clearTimeout(timeout);
  }
  return 'https://www.instagram.com/';
}
