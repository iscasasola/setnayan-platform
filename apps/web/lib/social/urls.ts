/**
 * apps/web/lib/social/urls.ts — shared URL helpers for the social pipeline.
 *
 * The branded card route (Phase B) renders on the fly at a PUBLIC GET endpoint
 * — no R2 storage. Both the Facebook /photos and Instagram /media Graph
 * endpoints pull this URL at publish time, so it must be absolute + reachable.
 */

import { siteOrigin } from '@/lib/site-origin';

/**
 * Absolute site origin. Delegates to the single resolver in lib/site-origin.ts
 * (2026-08-06) — this used to read NEXT_PUBLIC_SITE_URL / SITE_URL only, so on a
 * Vercel PREVIEW deploy (where those are unset but NEXT_PUBLIC_APP_URL is set) it
 * returned the PRODUCTION origin and the social pipeline published card URLs
 * pointing at the live site. Kept as a re-export so the four existing importers
 * are untouched.
 */
export function siteUrl(): string {
  return siteOrigin();
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
