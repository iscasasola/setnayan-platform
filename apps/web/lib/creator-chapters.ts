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

/**
 * How long a chapter's editorial may be. The old cap was 4000 — set when this
 * text was `substrate.itinerary`, a supporting note beside the video. It is now
 * the STORY (owner 2026-08-12), and 4000 characters is roughly 700 words: short
 * for a wedding told properly. 20000 is ~3500 words, past any reasonable
 * single-sitting write-up, and is a runaway-write backstop rather than a
 * product rule the writer should ever feel.
 */
export const CHAPTER_BODY_MAX = 20000;

/**
 * Normalize a submitted editorial body for storage.
 *
 * PARAGRAPHS ARE THE POINT. The old field was rendered as a single `<p>`, so a
 * couple who pressed Enter twice got one grey slab back. We store the writer's
 * blank lines verbatim (capped at one blank line between blocks so a wall of
 * Enter presses can't stretch the page), normalize CRLF, and trim the ends.
 *
 * Returns '' for anything empty/whitespace — callers treat that as "no body".
 */
export function normalizeChapterBody(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\r\n?/g, '\n') // CRLF (Windows paste) → LF
    .replace(/[ \t]+$/gm, '') // trailing spaces per line
    .replace(/\n{3,}/g, '\n\n') // at most ONE blank line between blocks
    .trim()
    .slice(0, CHAPTER_BODY_MAX);
}

/**
 * Split a stored body into render-ready paragraphs. Pure, so the chapter page
 * and the tests agree by construction rather than by eye.
 *
 * A blank line starts a new paragraph; single newlines inside a paragraph are
 * preserved by the caller's CSS (`white-space: pre-line`), which is what lets a
 * writer keep a line break inside a stanza without inventing markup. We do NOT
 * parse markdown — a chapter body is plain writing, and rendering user text as
 * markup is an injection surface we have no reason to open.
 */
export function splitChapterParagraphs(body: string | null | undefined): string[] {
  if (typeof body !== 'string') return [];
  return body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * A short, plain-text lede for a chapter — the shelf/tile excerpt when there is
 * no video to derive a thumbnail from. Takes the FIRST paragraph (a writer's
 * opening line is a better lede than an arbitrary prefix of the whole body) and
 * truncates on a word boundary so a tile never ends mid-word.
 *
 * Returns null when there is nothing to show — callers must not render an empty
 * excerpt block, and must never substitute the title (that would print the same
 * sentence twice on one tile).
 */
export function chapterExcerpt(
  body: string | null | undefined,
  max = 180,
): string | null {
  const first = splitChapterParagraphs(body)[0];
  if (!first) return null;
  const flat = first.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return null;
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Does this chapter carry something a reader can actually read?
 *
 * 🔑 THIS REPLACES `!!embed_url` AS THE PUBLISHABILITY TEST. Requiring an embed
 * meant only someone who already posts video on YouTube/Instagram/TikTok could
 * ever be a storyteller — the measured reason prod held 0 chapters and 0 public
 * profiles on 2026-08-12. The writing is the story now; a video is a companion.
 */
export function chapterHasReadableContent(chapter: {
  body?: string | null;
  embed_url?: string | null;
}): boolean {
  const body = typeof chapter.body === 'string' ? chapter.body.trim() : '';
  if (body.length > 0) return true;
  return typeof chapter.embed_url === 'string' && chapter.embed_url.trim().length > 0;
}

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

/**
 * Derive a YouTube poster/thumbnail URL from a STORED (already-normalized)
 * embed_url. V1 thumbnail rule (owner-ratified 2026-07-16, Storytellers
 * council decision #6): IMAGE thumbnails are YouTube-derived ONLY — a chapter
 * whose normalized embed is not the canonical youtube-nocookie shape returns
 * null here.
 *
 * ⚠ RETURNING NULL NO LONGER MEANS "NOT FEATURABLE" (owner 2026-08-12). When a
 * chapter's story is WRITING, there is no video to derive a poster from, and
 * the old reading of this rule made every editorial chapter permanently
 * unfeaturable — a silent second wall behind the publish gate. The shelf now
 * renders a TEXT-LED tile for these. What did not change: we still never
 * fabricate an image. In particular a rendered teaser is NOT used as a shelf
 * poster — its R2 URL is presigned and expires, and /realstories is an ISR
 * page, so a baked-in presigned poster would 404 a day later with nothing to
 * blame. Pure + side-effect-free, like everything else in this module.
 */
export function youtubeThumbFromEmbedUrl(embedUrl: string | null | undefined): string | null {
  if (typeof embedUrl !== 'string' || embedUrl.length === 0) return null;
  const m = /^https:\/\/www\.youtube-nocookie\.com\/embed\/([A-Za-z0-9_-]{11})$/.exec(
    embedUrl.trim(),
  );
  if (!m) return null;
  return `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
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

/** What `rankChaptersByPublishedAt` knows about a rendered chapter list. */
export type ChapterRanking = {
  /**
   * 1-based CHRONOLOGICAL number (oldest = 1) keyed by the row's index in the
   * input array. A row with no parseable `published_at` is ABSENT — numbering is
   * a claim about sequence, and without a date we do not have one to make.
   */
  numberByIndex: Map<number, number>;
  /** Input index of the newest DATED row, or -1 when nothing is dated. */
  newestIndex: number;
  /** Whether "latest" carries information — false in a set of one dated row. */
  showLatest: boolean;
};

/**
 * Rank a rendered chapter list by `published_at` (E5 — profile timeline
 * numbering + the latest-chapter poster).
 *
 * 🔑 WHY THIS IS NOT `index 0`. `fetchPublishedChapters` orders
 * `published_at` DESC, and Postgres DESC is **NULLS FIRST** — a published row
 * with a NULL `published_at` sorts ABOVE the genuine newest. Taking the first
 * element as "latest" would hand the number and the poster to an undated row.
 * Rank is therefore derived from PARSED DATES, oldest first, and undated rows
 * are excluded from numbering entirely rather than guessed at.
 *
 * `publishChapter` always stamps `published_at`, so an undated published row is
 * only reachable by a direct DB write — which is exactly the case a rendered
 * page must survive without lying.
 *
 * Pure: takes the dates, returns positions. Ties keep input order (Array#sort is
 * stable), so two rows published in the same millisecond stay newest-first as
 * the query returned them, and the LAST of them by that order is not promoted.
 */
export function rankChaptersByPublishedAt(
  publishedAt: ReadonlyArray<string | null | undefined>,
): ChapterRanking {
  const dated = publishedAt
    .map((iso, i) => ({ i, t: iso ? Date.parse(iso) : Number.NaN }))
    .filter((x) => !Number.isNaN(x.t))
    .sort((a, b) => a.t - b.t); // oldest → newest
  const numberByIndex = new Map<number, number>();
  dated.forEach((x, k) => numberByIndex.set(x.i, k + 1));
  return {
    numberByIndex,
    newestIndex: dated.length > 0 ? dated[dated.length - 1]!.i : -1,
    showLatest: dated.length > 1,
  };
}
