/**
 * Creator "Adventure Chapter" — embed allowlist + normalization (CP-1/CP-2).
 *
 * The locked model: a Chapter EMBEDS the creator's finished edit hosted on
 * THEIR platform (Setnayan never hosts the full video). Embeds are an
 * XSS/clickjacking surface, so this module is the single choke point:
 *
 *   • PROVIDER ALLOWLIST — only youtube / instagram / tiktok. Anything else is
 *     rejected (returns null) and never stored or rendered.
 *   • NORMALIZE — a pasted watch/share/profile URL is reduced to a canonical,
 *     privacy-enhanced EMBED src (youtube-nocookie, instagram /embed,
 *     tiktok /embed/v2). We store ONLY this normalized URL — never the raw
 *     paste — so a rendered <iframe src> can only ever be one of these exact
 *     shapes.
 *   • RENDER (elsewhere) — always in a sandboxed iframe (see ChapterEmbedFrame).
 *
 * Pure + side-effect-free so it runs in the server action AND is unit-testable.
 * Deliberately stricter than lib/video-embed.ts (which link-outs IG/TikTok):
 * a Chapter's whole point is the embed, so we resolve real embed srcs for all
 * three allowlisted providers.
 */

export const CHAPTER_KINDS = ['wedding', 'travel', 'food', 'lifestyle'] as const;
export type ChapterKind = (typeof CHAPTER_KINDS)[number];

export const EMBED_PROVIDERS = ['youtube', 'instagram', 'tiktok'] as const;
export type EmbedProvider = (typeof EMBED_PROVIDERS)[number];

export const CHAPTER_STATUSES = ['draft', 'published'] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export type NormalizedEmbed = {
  provider: EmbedProvider;
  /** Canonical privacy-enhanced embed src. Safe to place in an iframe `src`. */
  embedUrl: string;
};

export function isChapterKind(v: unknown): v is ChapterKind {
  return typeof v === 'string' && (CHAPTER_KINDS as readonly string[]).includes(v);
}

/** A YouTube video id is 11 chars of [A-Za-z0-9_-]. */
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
/** Instagram / TikTok shortcodes + numeric ids are alphanumeric (+ _ -). */
const IG_CODE = /^[A-Za-z0-9_-]{1,40}$/;
const TT_ID = /^\d{5,32}$/;

/**
 * Parse a single pasted URL into a normalized embed descriptor, or `null` if it
 * is not a usable http(s) URL from an ALLOWLISTED provider. This is the ONLY
 * function that should decide what embed_url/embed_provider get persisted.
 */
export function normalizeEmbed(input: string): NormalizedEmbed | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (raw.length === 0) return null;

  // Parse via URL(). Prepend https:// for bare `host/path` inputs, but NEVER
  // for an explicit non-http(s) scheme (javascript:, data:, …) — reject those.
  let parsed: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
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
  const segs = parsed.pathname.split('/').filter(Boolean);

  // ── YouTube ────────────────────────────────────────────────────────────────
  if (host === 'youtu.be') {
    const id = segs[0];
    if (id && YT_ID.test(id)) return yt(id);
    return null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const v = parsed.searchParams.get('v');
    if (segs[0] === 'watch' && v && YT_ID.test(v)) return yt(v);
    if (
      (segs[0] === 'shorts' || segs[0] === 'embed' || segs[0] === 'v' || segs[0] === 'live') &&
      segs[1] &&
      YT_ID.test(segs[1])
    ) {
      return yt(segs[1]);
    }
    return null;
  }
  if (host === 'youtube-nocookie.com') {
    if (segs[0] === 'embed' && segs[1] && YT_ID.test(segs[1])) return yt(segs[1]);
    return null;
  }

  // ── Instagram ────────────────────────────────────────────────────────────────
  // Post/reel/tv permalinks embed via /{type}/{code}/embed. Only these three
  // media types are embeddable; a bare profile URL is not a Chapter embed.
  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    const type = segs[0];
    const code = segs[1];
    if (
      (type === 'p' || type === 'reel' || type === 'reels' || type === 'tv') &&
      code &&
      IG_CODE.test(code)
    ) {
      // Normalize 'reels' → 'reel' for the canonical embed path.
      const t = type === 'reels' ? 'reel' : type;
      return {
        provider: 'instagram',
        embedUrl: `https://www.instagram.com/${t}/${code}/embed`,
      };
    }
    return null;
  }

  // ── TikTok ────────────────────────────────────────────────────────────────
  // Canonical video URL is tiktok.com/@user/video/{id}. The privacy-enhanced
  // inline player is /embed/v2/{id}. Short vm.tiktok.com links can't be resolved
  // without a network hop, so we require the full numeric-id form (reject vm.*).
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    if (host === 'vm.tiktok.com') return null;
    // /@user/video/{id}
    const videoIdx = segs.findIndex((s) => s === 'video');
    const fromPath = videoIdx >= 0 ? segs[videoIdx + 1] : undefined;
    // /embed/v2/{id} or /embed/{id}
    const fromEmbed = segs[0] === 'embed' ? segs[segs.length - 1] : undefined;
    const id = fromPath && TT_ID.test(fromPath) ? fromPath : fromEmbed && TT_ID.test(fromEmbed) ? fromEmbed : undefined;
    if (id) {
      return { provider: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${id}` };
    }
    return null;
  }

  return null;
}

function yt(id: string): NormalizedEmbed {
  return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
}

export const EMBED_PROVIDER_LABEL: Record<EmbedProvider, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export const CHAPTER_KIND_LABEL: Record<ChapterKind, string> = {
  wedding: 'Wedding',
  travel: 'Travel',
  food: 'Food',
  lifestyle: 'Lifestyle',
};
