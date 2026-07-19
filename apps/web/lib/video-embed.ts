/**
 * Featured-videos link parser (vendor public profile · additive 2026-07-05).
 *
 * A vendor pastes external video URLs into their profile's "Featured videos"
 * field; the public page renders each one. This pure module classifies a single
 * pasted URL:
 *
 *   • YouTube / Vimeo  → `kind: 'iframe'` with a privacy-preserving `embedUrl`
 *     (youtube-nocookie · player.vimeo.com) the page mounts as a responsive
 *     16:9 player.
 *   • Instagram / Facebook / TikTok → `kind: 'link'` — these platforms don't
 *     give a stable, CSP-friendly inline player for arbitrary vendor posts, so
 *     we render a click-through card that opens in a new tab instead.
 *   • any other valid http(s) URL → `platform: 'other'`, `kind: 'link'`.
 *
 * Non-URLs, empty strings, and non-http(s) schemes (`javascript:`, `data:`, …)
 * return `null` and are dropped — never rendered.
 *
 * NOTE: this is deliberately independent of the Enterprise "Films" rack
 * (`lib/vendor-microsite.ts` videoEmbedUrl), which is a curated microsite
 * feature. Featured videos are a simpler, all-tier, paste-a-link gallery.
 */

export type VideoPlatform =
  | 'youtube'
  | 'vimeo'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'other';

export type ParsedVideoLink = {
  platform: VideoPlatform;
  /** 'iframe' → embeddable inline player; 'link' → click-through card. */
  kind: 'iframe' | 'link';
  /** Present only for `kind: 'iframe'` — the privacy-preserving player src. */
  embedUrl?: string;
  /** The original URL the vendor pasted (normalized to include a scheme). */
  originalUrl: string;
  /** Human label for the platform, used for titles + card copy. */
  label: string;
};

const PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  other: 'Video',
};

/** A YouTube video id is 11 chars of [A-Za-z0-9_-]. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Parse a single pasted URL into a render descriptor, or `null` if it isn't a
 * usable http(s) video/link URL. Pure + side-effect-free.
 */
export function parseVideoLink(url: string): ParsedVideoLink | null {
  if (typeof url !== 'string') return null;
  const raw = url.trim();
  if (raw.length === 0) return null;

  // Parse via URL(). Prepend https:// for bare `host/path` inputs so a vendor
  // pasting "youtu.be/abc" still resolves — but NEVER for an explicit
  // non-http(s) scheme (javascript:, data:, mailto:, …), which must be rejected.
  let parsed: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      // Has an explicit scheme — only http(s) is allowed.
      if (!/^https?:\/\//i.test(raw)) return null;
      parsed = new URL(raw);
    } else {
      parsed = new URL(`https://${raw}`);
    }
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const originalUrl = parsed.toString();

  const iframe = (platform: VideoPlatform, embedUrl: string): ParsedVideoLink => ({
    platform,
    kind: 'iframe',
    embedUrl,
    originalUrl,
    label: PLATFORM_LABEL[platform],
  });
  const link = (platform: VideoPlatform): ParsedVideoLink => ({
    platform,
    kind: 'link',
    originalUrl,
    label: PLATFORM_LABEL[platform],
  });

  // ── YouTube ──────────────────────────────────────────────────────────────
  // watch?v=ID · youtu.be/ID · /shorts/ID · /embed/ID
  if (host === 'youtu.be') {
    const id = parsed.pathname.split('/').filter(Boolean)[0];
    if (id && YT_ID.test(id)) return iframe('youtube', ytEmbed(id));
    return null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const segs = parsed.pathname.split('/').filter(Boolean);
    // /watch?v=ID
    const vParam = parsed.searchParams.get('v');
    if (segs[0] === 'watch' && vParam && YT_ID.test(vParam)) {
      return iframe('youtube', ytEmbed(vParam));
    }
    // /shorts/ID · /embed/ID · /v/ID · /live/ID
    if (
      (segs[0] === 'shorts' || segs[0] === 'embed' || segs[0] === 'v' || segs[0] === 'live') &&
      segs[1] &&
      YT_ID.test(segs[1])
    ) {
      return iframe('youtube', ytEmbed(segs[1]));
    }
    return null;
  }

  // ── Vimeo ────────────────────────────────────────────────────────────────
  // vimeo.com/ID (numeric). player.vimeo.com/video/ID is already an embed.
  if (host === 'vimeo.com') {
    const segs = parsed.pathname.split('/').filter(Boolean);
    // First purely-numeric segment is the video id (handles /ID and /user/ID).
    const id = segs.find((s) => /^\d+$/.test(s));
    if (id) return iframe('vimeo', `https://player.vimeo.com/video/${id}`);
    return null;
  }
  if (host === 'player.vimeo.com') {
    const segs = parsed.pathname.split('/').filter(Boolean);
    if (segs[0] === 'video' && segs[1] && /^\d+$/.test(segs[1])) {
      return iframe('vimeo', `https://player.vimeo.com/video/${segs[1]}`);
    }
    return null;
  }

  // ── Instagram (link-out) ─────────────────────────────────────────────────
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    const segs = parsed.pathname.split('/').filter(Boolean);
    if (segs[0] === 'p' || segs[0] === 'reel' || segs[0] === 'reels' || segs[0] === 'tv') {
      return link('instagram');
    }
    // A plain profile link still counts as an Instagram video link-out.
    return link('instagram');
  }

  // ── Facebook (link-out) ──────────────────────────────────────────────────
  if (
    host === 'facebook.com' ||
    host.endsWith('.facebook.com') ||
    host === 'fb.com' ||
    host === 'fb.watch' ||
    host === 'fb.me'
  ) {
    return link('facebook');
  }

  // ── TikTok (link-out) ────────────────────────────────────────────────────
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com') || host === 'vm.tiktok.com') {
    return link('tiktok');
  }

  // ── Anything else valid → generic link-out ───────────────────────────────
  return link('other');
}

function ytEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
