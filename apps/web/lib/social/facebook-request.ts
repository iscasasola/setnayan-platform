/**
 * apps/web/lib/social/facebook-request.ts — what we send Facebook, built in one pure place so it can be tested
 * without the network. The real call (Page token, timeout) is in `lib/social/facebook.ts`.
 *
 * Owner, 28 Nov 2026: "schedule posts on Facebook itself and stay cron-free". A slot post is handed to Facebook as a
 * SCHEDULED post — `published=false` + `scheduled_publish_time` (Unix seconds) — and Facebook publishes it at the
 * slot with nobody on our site. Facebook accepts a scheduled time from 10 minutes to about 30 days ahead; we hand
 * posts over at most 7 days ahead (`FB_HANDOFF_HORIZON_MS`) and never inside the last 10 minutes.
 */

/** Facebook refuses a scheduled time closer than 10 minutes. */
export const FB_SCHEDULE_MIN_LEAD_MS = 10 * 60 * 1000;
/** …or further than about 30 days. */
export const FB_SCHEDULE_MAX_LEAD_MS = 30 * 24 * 60 * 60 * 1000;
/** How far ahead the flush tops the Facebook queue up (owner/controller: the next ~7 days). */
export const FB_HANDOFF_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/** True when Facebook will accept `at` as a scheduled time, asked at `now`. */
export function canScheduleOnFacebook(at: Date, now: Date): boolean {
  const lead = at.getTime() - now.getTime();
  return lead >= FB_SCHEDULE_MIN_LEAD_MS && lead <= FB_SCHEDULE_MAX_LEAD_MS;
}

/** A Graph API path from its parts (`graphPath(pageId, 'feed')` → `/{pageId}/feed`). Facebook's, not one of our routes. */
export function graphPath(...parts: string[]): string {
  return ['', ...parts].join('/');
}

/** The two fields that turn a post into a scheduled post. */
export function scheduledPostFields(at: Date): Record<string, string> {
  return { published: 'false', scheduled_publish_time: String(Math.floor(at.getTime() / 1000)) };
}

/** A fetchable public image Facebook can download itself (a data: URI or a non-image would fail on its side). */
export function isPostableImageUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url) && /\.(jpe?g|png|gif|webp)(\?|#|$)/i.test(url);
}

/**
 * One single-image or text/link post: a photo post (`/{page}/photos`, the message as caption — photo posts reach
 * further) when `mediaUrl` is a postable image, else a feed post with an optional link. `scheduleAt` makes it a
 * scheduled post. The token is added by the caller, never here.
 */
export function buildSinglePostRequest(input: {
  pageId: string;
  message: string;
  linkUrl?: string | null;
  mediaUrl?: string | null;
  scheduleAt?: Date | null;
}): { path: string; params: Record<string, string> } {
  const schedule = input.scheduleAt ? scheduledPostFields(input.scheduleAt) : {};
  if (isPostableImageUrl(input.mediaUrl)) {
    return { path: graphPath(input.pageId, 'photos'), params: { url: input.mediaUrl, caption: input.message, ...schedule } };
  }
  const params: Record<string, string> = { message: input.message, ...schedule };
  if (input.linkUrl && /^https?:\/\//i.test(input.linkUrl)) params.link = input.linkUrl;
  return { path: graphPath(input.pageId, 'feed'), params };
}
