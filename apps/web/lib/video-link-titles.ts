/**
 * 🎬 A TITLE PER VIDEO LINK (Supplier Build 2 leftovers, 9 Nov — v118 draws a Title on each Portfolio › Video link).
 *
 * Stored in `vendor_profiles.gallery_video_titles` (migration 20271334860034): a jsonb map keyed by the link EXACTLY as
 * `gallery_video_links` stores it. Keyed by the link, never by position, so a writer that reorders or rewrites the links
 * can never move a title onto the wrong video — a link with no key simply has no title, and its row says its host.
 *
 * Pure: no I/O. 🔒 lib/video-link-titles.test.ts
 */

/** The longest title a link may carry (the column's CHECK says the same). */
export const VIDEO_TITLE_MAX = 80;

/** A stored map, made safe to read: only string titles, trimmed, 1–80 characters. Anything else reads as no title. */
export function videoTitlesOf(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'string') continue;
    const t = v.trim().slice(0, VIDEO_TITLE_MAX);
    if (t) out[k] = t;
  }
  return out;
}

/**
 * The map to store with a list of links: one entry per link that has a title, keyed by that link. Titles for links not
 * in `links` are dropped (a removed link takes its title with it). `pairs` are [link as stored, title as typed].
 */
export function videoTitlesFor(links: readonly string[], pairs: readonly (readonly [string, string])[]): Record<string, string> {
  const keep = new Set(links);
  const out: Record<string, string> = {};
  for (const [link, title] of pairs) {
    if (!keep.has(link) || link in out) continue;
    const t = title.trim().slice(0, VIDEO_TITLE_MAX);
    if (t) out[link] = t;
  }
  return out;
}

/** "youtube.com" — the link's host without "www.", or the link itself when it is not a URL. */
export function videoLinkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '') || url;
  } catch {
    return url;
  }
}

/** What a video link's row is called: its title, else its host. */
export function videoRowName(url: string, titles: Readonly<Record<string, string>> | null | undefined): string {
  return titles?.[url]?.trim() || videoLinkHost(url);
}
