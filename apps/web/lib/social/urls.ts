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

/** Card output format — see lib/social/card.ts `CardFormat`. */
export type SocialCardFormat = 'square' | 'story';

/**
 * Public, fetchable URL of the branded card for a post. Deterministic per
 * (post id, format) — the route sets `Cache-Control: immutable` — so passing
 * it as the Graph / TikTok `image_url` lets the platform download the same
 * image every time. `format` defaults to 'square' (1080×1080, FB/IG feed); the
 * default emits NO query string so FB/IG keep their exact square URLs. Pass
 * 'story' for the 1080×1920 9:16 card (TikTok Photo Mode + assisted-manual).
 */
export function socialCardUrl(postId: string, format: SocialCardFormat = 'square'): string {
  const base = `${siteUrl().replace(/\/$/, '')}/api/social/card/${encodeURIComponent(postId)}`;
  return format === 'story' ? `${base}?format=story` : base;
}
