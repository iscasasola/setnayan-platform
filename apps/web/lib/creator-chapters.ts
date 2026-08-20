/**
 * Creator "Adventure Chapter" — embed allowlist + normalization (CP-1/CP-2).
 *
 * THE MODEL (owner 2026-08-12, superseding the original lock): a Chapter is a
 * STORY — the creator's own writing, in `creator_chapters.body`. It MAY also
 * carry a video, and when it does that video stays hosted on THEIR platform and
 * is embedded here (Setnayan never hosts the full video).
 *
 * ⚠ THE ORIGINAL LOCK READ "a Chapter EMBEDS the creator's finished edit", full
 * stop, and that sentence is the single most expensive line in this subsystem.
 * Read literally at four different layers it produced: a publish gate that
 * required an external video account, three read paths that hid a written story
 * from its own author, an admin control that never rendered, a route the
 * middleware ate, and public copy telling visitors to "Watch" an essay. Prod
 * held ZERO chapters for the entire life of the feature as a direct result.
 * Nobody re-litigated it; everybody just believed it.
 *
 * Embeds remain an XSS/clickjacking surface, so this module is still the single
 * choke point for the OPTIONAL video half:
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
 * when a Chapter DOES carry a video it is played inline, so we resolve real
 * embed srcs for all three allowlisted providers.
 *
 * ⚠ THIS SAID "a Chapter's whole point is the embed" until 2026-08-13. It
 * stopped being true on 2026-08-12 — a chapter's point is the STORY, and the
 * video is optional. The old sentence is the premise that, read at three
 * different layers, hid a publish button, a route, an admin control and four
 * pieces of public copy. It is corrected here because this file is where a
 * reader goes to learn what a chapter is.
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

/**
 * WHO READS A CHAPTER — three answers, one column (owner 2026-08-20:
 * *"they also get to choose whether it is only me, private (all in that event
 * only), public"*).
 *
 *   draft      →  only me
 *   event      →  the people of the attached celebration
 *   published  →  everyone
 *
 * 🔑 THE STORED WORDS ARE NOT THE WORDS ON SCREEN, and that is deliberate. Ten
 * shipped read paths ask `status = 'published'`, so keeping the audience inside
 * `status` means every one of them — and every one written in future — refuses
 * an event-only chapter WITHOUT being edited. Forgetting hides; forgetting
 * cannot leak. What a person reads is `CHAPTER_AUDIENCE_LABEL`.
 */
export const CHAPTER_STATUSES = ['draft', 'event', 'published'] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

/** The three choices, in the order the composer offers them. */
export const CHAPTER_AUDIENCES = ['draft', 'event', 'published'] as const;

export const CHAPTER_AUDIENCE_LABEL: Record<ChapterStatus, string> = {
  draft: 'Only me',
  event: 'The people of this celebration',
  published: 'Everyone',
};

/** What each choice actually does, said before it is pressed. */
export const CHAPTER_AUDIENCE_NOTE: Record<ChapterStatus, string> = {
  draft: 'Nobody else can open it. You can keep writing and choose later.',
  event:
    'The people of that day can read it — the hosts, the guests who have a seat, ' +
    'and the suppliers who worked it. It stays off your public page and off Setnayan’s ' +
    'Stories.',
  published:
    'Anyone with your address can read it, and Setnayan may feature it on Stories.',
};

/**
 * Is this chapter readable by somebody other than its author?
 *
 * The single question behind "needs a story before you can share it" and behind
 * every this-is-live badge. Never `status !== 'draft'` written out by hand at
 * each call site — that is the comparison that gets one call site wrong.
 */
export function chapterIsShared(status: ChapterStatus): boolean {
  return status === 'event' || status === 'published';
}

/**
 * May this chapter be shared with the celebration's people?
 *
 * Only when there IS a celebration. The composer hides the choice rather than
 * offering one that would be refused, and the database refuses it anyway
 * (`creator_chapters_event_audience_needs_event`).
 */
export function canShareWithEvent(eventId: string | null | undefined): boolean {
  return typeof eventId === 'string' && eventId.length > 0;
}

export function isChapterStatus(v: unknown): v is ChapterStatus {
  return typeof v === 'string' && (CHAPTER_STATUSES as readonly string[]).includes(v);
}

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

/**
 * 🛑 `ChapterRanking` + `rankChaptersByPublishedAt` LIVED HERE AND ARE GONE
 * (2026-08-20). They numbered a person's chapters by the day each was
 * PUBLISHED, so writing up a 2019 engagement today made it the newest chapter
 * of that person's life. Numbering now follows the day the celebration
 * HAPPENED — `lib/creator-chronicle.ts`, which carries the same NULLS-FIRST
 * protection (rank from parsed days, never from array position) and its tests.
 */
