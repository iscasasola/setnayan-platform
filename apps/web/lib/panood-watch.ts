/**
 * lib/panood-watch.ts — pure YouTube watch-URL parsing for Panood.
 *
 * React-free and environment-free so the parser is directly unit-tested
 * (tests/e2e/panood-watch-math.spec.ts) — same pattern as
 * lib/spatial-backdrop.ts / live-wall-logic.ts.
 *
 * The couple pastes whatever YouTube hands them (watch?v=, youtu.be share
 * links, /live/ URLs, even /embed/ or /shorts/); we extract the 11-char video
 * id, persist the CANONICAL watch URL, and embed via youtube-nocookie
 * (privacy-enhanced mode — no tracking cookies until playback starts).
 * Anything that isn't a YouTube URL with a plausible id is rejected — this
 * value renders inside an iframe on the public wedding page, so the
 * normalize-or-reject gate is the injection barrier.
 */

/** YouTube video ids are exactly 11 chars of [A-Za-z0-9_-]. */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

export function isYouTubeVideoId(v: unknown): v is string {
  return typeof v === 'string' && VIDEO_ID_RE.test(v);
}

/**
 * Extract the video id from any common YouTube URL shape, or null.
 * Accepts missing scheme ("youtu.be/<id>") and upgrades to https mentally —
 * the PARSE is scheme-tolerant; the canonical output is always https.
 */
export function parseYouTubeVideoId(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return isYouTubeVideoId(id) ? id : null;
  }

  if (!YOUTUBE_HOSTS.has(host)) return null;

  // watch?v=<id>
  const v = url.searchParams.get('v');
  if (isYouTubeVideoId(v)) return v;

  // /live/<id> · /embed/<id> · /shorts/<id> · /v/<id>
  const segs = url.pathname.split('/').filter(Boolean);
  if (segs.length >= 2 && ['live', 'embed', 'shorts', 'v'].includes(segs[0] ?? '')) {
    const id = segs[1] ?? '';
    return isYouTubeVideoId(id) ? id : null;
  }

  return null;
}

/** Canonical persisted form, or null when the input isn't a YouTube video URL. */
export function normalizeYouTubeWatchUrl(raw: string): string | null {
  const id = parseYouTubeVideoId(raw);
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Privacy-enhanced embed URL for the guest page iframe. */
export function youTubeEmbedUrl(videoId: string): string {
  if (!isYouTubeVideoId(videoId)) throw new Error('invalid video id');
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}
