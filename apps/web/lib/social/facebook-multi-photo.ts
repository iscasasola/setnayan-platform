/**
 * apps/web/lib/social/facebook-multi-photo.ts — one Facebook post with several photos, in order, or nothing.
 * Pure over an injected Graph call, so the order and the all-or-nothing rule are unit-tested without the network.
 * The real call (Page token, timeout) is in `lib/social/facebook.ts`.
 *
 * Controller, 28 Nov 2026: many library posts carry several photos ("Images, in this order"). The Graph API way:
 *   1. POST /{page-id}/photos { url, published: false } for each image, in order → a media_fbid each;
 *   2. POST /{page-id}/feed { message, attached_media[i] = {"media_fbid": …} } in that same order.
 * If any upload fails, the feed post is never made (no half posts), the error is returned, and the unpublished
 * photos already uploaded are deleted. A delete that fails is logged and returned (`cleanupFailures`), so the flush
 * records it in platform_results — an unpublished photo is never shown on the Page, but it is not gone either.
 * At most 10 photos (owner); more is refused before anything uploads. With `scheduleAt` the feed post is a
 * Facebook SCHEDULED post (owner 2026-11-28: Facebook holds the schedule).
 */
import { formatCount } from '@/lib/format-number';
import { isPostableImageUrl, scheduledPostFields } from '@/lib/social/facebook-request';

export type GraphResult = { ok: true; body: Record<string, unknown> } | { ok: false; error: string };

/** One Graph API request against a path like `/{page-id}/photos`: `GET` (query), `POST` (form body) or `DELETE`. */
export type GraphCall = (
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, string>,
) => Promise<GraphResult>;

/** An unpublished photo the clean-up could not delete (it is never shown on the Page, but it is not gone). */
export type CleanupFailure = { photo_id: string; error: string };

export type MultiPhotoResult =
  | { ok: true; externalId: string; mediaIds: string[] }
  | { ok: false; error: string; uploaded: number; cleanupFailures: CleanupFailure[] };

/** The owner's rule: at most 10 photos in one post. More is refused before any upload. */
export const FACEBOOK_MAX_ATTACHED_PHOTOS = 10;

/** Which images a row posts as one multi-photo post: 2 or more public http(s) URLs, in order. */
export function multiPhotoUrls(mediaUrls: readonly string[] | null | undefined): string[] | null {
  const urls = (mediaUrls ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u.trim()));
  return urls.length >= 2 ? urls.map((u) => u.trim()) : null;
}

/**
 * Which photos go as unpublished uploads attached to ONE /feed post: two or more `mediaUrls` always; and for a
 * SCHEDULED post, a single postable image too, so every scheduled post is a /feed post that
 * GET /{page-id}/scheduled_posts lists with its text. `null` = not a photo-attachment post.
 */
export function attachedPhotoUrls(input: {
  mediaUrls?: readonly string[] | null;
  mediaUrl?: string | null;
  scheduleAt?: Date | null;
}): string[] | null {
  const many = multiPhotoUrls(input.mediaUrls);
  if (many) return many;
  return input.scheduleAt && isPostableImageUrl(input.mediaUrl) ? [input.mediaUrl] : null;
}

export async function publishMultiPhoto(
  call: GraphCall,
  pageId: string,
  message: string,
  urls: readonly string[],
  opts: { scheduleAt?: Date | null; deadline?: number; clock?: () => number } = {},
): Promise<MultiPhotoResult> {
  // A scheduled post takes one photo too (it must be a /feed post, which /scheduled_posts lists); a post sent now
  // with one photo uses /photos directly.
  if (urls.length < (opts.scheduleAt ? 1 : 2)) {
    return { ok: false, error: 'A multi-photo post needs at least two photos.', uploaded: 0, cleanupFailures: [] };
  }
  if (urls.length > FACEBOOK_MAX_ATTACHED_PHOTOS) {
    return { ok: false, error: `A post holds at most ${formatCount(FACEBOOK_MAX_ATTACHED_PHOTOS)} photos; this one has ${formatCount(urls.length)}.`, uploaded: 0, cleanupFailures: [] };
  }

  const mediaIds: string[] = [];
  /** Delete every unpublished upload; each one that will not delete is logged and returned for platform_results. */
  const cleanUp = async (): Promise<CleanupFailure[]> => {
    const failures: CleanupFailure[] = [];
    for (const id of mediaIds) {
      const res = await call('DELETE', `/${id}`, {}).catch(
        (err: unknown): GraphResult => ({ ok: false, error: err instanceof Error ? err.message : 'delete threw' }),
      );
      if (!res.ok) {
        console.warn(`[social] could not delete unpublished Facebook photo ${id}: ${res.error}`);
        failures.push({ photo_id: id, error: res.error.slice(0, 300) });
      }
    }
    return failures;
  };

  const clock = opts.clock ?? Date.now;
  const pastDeadline = () => opts.deadline !== undefined && clock() >= opts.deadline;
  const outOfTime = async (): Promise<MultiPhotoResult> => ({
    ok: false,
    error: 'The flush ran out of time before this post was handed over; nothing was posted, and the next visit tries again.',
    uploaded: mediaIds.length,
    cleanupFailures: await cleanUp(),
  });

  // Sequential on purpose: the media_fbid order IS the photo order on the post.
  for (const [i, url] of urls.entries()) {
    if (i > 0 && pastDeadline()) return outOfTime();
    // Unpublished, so no photo shows on the Page on its own. For a scheduled post Facebook also wants the uploads
    // marked temporary — they live only as the post's attachments.
    const res = await call('POST', `/${pageId}/photos`, {
      url,
      published: 'false',
      ...(opts.scheduleAt ? { temporary: 'true' } : {}),
    });
    const id = res.ok && typeof res.body.id === 'string' ? res.body.id : null;
    if (!id) {
      const cleanupFailures = await cleanUp();
      const why = res.ok ? 'no photo id returned' : res.error;
      return {
        ok: false,
        error: `Photo ${formatCount(i + 1)} of ${formatCount(urls.length)} did not upload (${why}); nothing was posted.`.slice(0, 500),
        uploaded: mediaIds.length,
        cleanupFailures,
      };
    }
    mediaIds.push(id);
  }

  // A scheduled post (owner 2026-11-28): published=false + scheduled_publish_time on the feed post itself.
  const params: Record<string, string> = { message, ...(opts.scheduleAt ? scheduledPostFields(opts.scheduleAt) : {}) };
  mediaIds.forEach((id, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  if (pastDeadline()) return outOfTime();
  const feed = await call('POST', `/${pageId}/feed`, params);
  const postId = feed.ok && typeof feed.body.id === 'string' ? feed.body.id : null;
  if (!postId) {
    const cleanupFailures = await cleanUp();
    const why = feed.ok ? 'no post id returned' : feed.error;
    return {
      ok: false,
      error: `The post with ${formatCount(urls.length)} photos was refused (${why}); nothing was posted.`.slice(0, 500),
      uploaded: mediaIds.length,
      cleanupFailures,
    };
  }
  return { ok: true, externalId: postId, mediaIds };
}
