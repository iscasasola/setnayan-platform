/**
 * apps/web/lib/social/facebook-multi-photo.ts — one Facebook post with several photos, in order, or nothing.
 * Pure over an injected Graph call, so the order and the all-or-nothing rule are unit-tested without the network.
 * The real call (Page token, timeout) is in `lib/social/facebook.ts`.
 *
 * Controller, 28 Nov 2026: many library posts carry several photos ("Images, in this order"). The Graph API way:
 *   1. POST /{page-id}/photos { url, published: false } for each image, in order → a media_fbid each;
 *   2. POST /{page-id}/feed { message, attached_media[i] = {"media_fbid": …} } in that same order.
 * If any upload fails, the feed post is never made (no half posts), the error is returned, and the unpublished
 * photos already uploaded are deleted (best effort: an unpublished photo is never shown on the Page either way).
 */
import { formatCount } from '@/lib/format-number';

export type GraphResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

/** One Graph API request: `POST` (form params) or `DELETE`, against a path like `/{page-id}/photos`. */
export type GraphCall = (method: 'POST' | 'DELETE', path: string, params: Record<string, string>) => Promise<GraphResult>;

export type MultiPhotoResult =
  | { ok: true; externalId: string; mediaIds: string[] }
  | { ok: false; error: string; uploaded: number };

/** Graph caps a feed post's attached photos; past this, the post is refused before any upload. */
export const FACEBOOK_MAX_ATTACHED_PHOTOS = 30;

/** Which images a row posts as one multi-photo post: 2 or more public http(s) URLs, in order. */
export function multiPhotoUrls(mediaUrls: readonly string[] | null | undefined): string[] | null {
  const urls = (mediaUrls ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()));
  return urls.length >= 2 ? urls.map((u) => u.trim()) : null;
}

export async function publishMultiPhoto(
  call: GraphCall,
  pageId: string,
  message: string,
  urls: readonly string[],
): Promise<MultiPhotoResult> {
  if (urls.length < 2) return { ok: false, error: 'A multi-photo post needs at least two photos.', uploaded: 0 };
  if (urls.length > FACEBOOK_MAX_ATTACHED_PHOTOS) {
    return { ok: false, error: `A post holds at most ${formatCount(FACEBOOK_MAX_ATTACHED_PHOTOS)} photos; this one has ${formatCount(urls.length)}.`, uploaded: 0 };
  }

  const mediaIds: string[] = [];
  const cleanUp = async () => {
    for (const id of mediaIds) await call('DELETE', `/${id}`, {}).catch(() => undefined);
  };

  // Sequential on purpose: the media_fbid order IS the photo order on the post.
  for (const [i, url] of urls.entries()) {
    const res = await call('POST', `/${pageId}/photos`, { url, published: 'false' });
    const id = res.ok && typeof res.body.id === 'string' ? res.body.id : null;
    if (!id) {
      await cleanUp();
      const why = res.ok ? 'no photo id returned' : res.error;
      return { ok: false, error: `Photo ${formatCount(i + 1)} of ${formatCount(urls.length)} did not upload (${why}); nothing was posted.`.slice(0, 500), uploaded: mediaIds.length };
    }
    mediaIds.push(id);
  }

  const params: Record<string, string> = { message };
  mediaIds.forEach((id, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  const feed = await call('POST', `/${pageId}/feed`, params);
  const postId = feed.ok && typeof feed.body.id === 'string' ? feed.body.id : null;
  if (!postId) {
    await cleanUp();
    const why = feed.ok ? 'no post id returned' : feed.error;
    return { ok: false, error: `The post with ${formatCount(urls.length)} photos was refused (${why}); nothing was posted.`.slice(0, 500), uploaded: mediaIds.length };
  }
  return { ok: true, externalId: postId, mediaIds };
}
