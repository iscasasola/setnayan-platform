/**
 * apps/web/lib/social/urls.ts — shared URL helpers for the social pipeline.
 *
 * The branded card route (Phase B) renders on the fly at a PUBLIC GET endpoint
 * — no R2 storage. Both the Facebook /photos and Instagram /media Graph
 * endpoints pull this URL at publish time, so it must be absolute + reachable.
 */

/** Absolute site origin — Vercel env, falling back to the production domain. */
export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'https://www.setnayan.com'
  );
}

/**
 * Public, fetchable URL of the branded 1080×1080 card for a post. Deterministic
 * per post id (the route sets `Cache-Control: immutable`), so passing it as the
 * Graph `media_url` lets FB/IG download the same image every time.
 */
export function socialCardUrl(postId: string): string {
  return `${siteUrl().replace(/\/$/, '')}/api/social/card/${encodeURIComponent(postId)}`;
}
