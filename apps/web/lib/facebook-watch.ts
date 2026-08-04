/**
 * lib/facebook-watch.ts — pure Facebook watch-URL parsing for the DUAL-STREAM
 * option (owner-approved 2026-07-26: a couple may stream to YouTube AND
 * Facebook at the same time and show both on their event page).
 *
 * ── WHY A SEPARATE FILE FROM lib/panood-watch.ts ────────────────────────────
 * panood-watch.ts is the injection barrier for an IFRAME SRC. This one is the
 * barrier for an HREF ONLY — Facebook is never embedded (see below). Keeping
 * them in separate modules means "did the Facebook work loosen the YouTube
 * validator?" is answered by an EMPTY diff on panood-watch.ts, not by reading a
 * merged file. The ~8 lines of scheme-tolerant URL parsing are deliberately
 * duplicated rather than shared: a helper reaching into the YouTube barrier is
 * exactly the coupling this split exists to prevent.
 *
 * ── WHY FACEBOOK IS A LINK, NOT AN EMBED ────────────────────────────────────
 *   1. The only embed Meta offers is facebook.com/plugins/video.php, which is a
 *      third-party Meta frame with Meta cookies on a public wedding page. The
 *      YouTube path deliberately uses youtube-nocookie for exactly that reason.
 *   2. next.config.ts pins `frame-src 'self' https://www.youtube-nocookie.com
 *      https://www.youtube.com https://player.vimeo.com https://www.instagram.com
 *      https://www.tiktok.com` — facebook.com is NOT on it, so a Facebook iframe
 *      would be CSP-blocked anyway. We are not adding it.
 * So the contract is: YouTube = the embedded player, Facebook = a link out.
 *
 * ── NORMALIZE-OR-REJECT IS THE SECURITY CONTRACT ────────────────────────────
 * Callers must run stored values back through `normalizeFacebookWatchUrl` ON
 * READ, not just on write. `events` UPDATE RLS is ROW-level and the Supabase
 * anon key is public, so a host can PATCH this column straight through
 * PostgREST; re-normalising on read makes that pointless. The returned string is
 * REBUILT from validated parts and therefore always begins with
 * `https://www.facebook.com/` or `https://fb.watch/` — a `javascript:` or
 * attacker-hosted URL can never survive the round trip, and userinfo
 * (`https://evil.com@www.facebook.com/…`) is dropped by the rebuild.
 */

/** Hosts whose paths we understand. Exact match — `facebook.com.evil.com` fails. */
const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
]);

/** The share-sheet short-link host. */
const FB_WATCH_HOSTS = new Set(['fb.watch', 'www.fb.watch']);

/** Facebook video ids are long numerics (15–17 digits in practice). */
const VIDEO_ID_RE = /^[0-9]{6,25}$/;

/** The opaque tail of `fb.watch/<code>` and `/share/v/<code>`. */
const SHARE_CODE_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** Page usernames and numeric page ids in `/<page>/videos/<id>`. */
const PAGE_SLUG_RE = /^[A-Za-z0-9.-]{1,64}$/;

/** Paths whose `?v=<id>` query carries the video id. */
const V_PARAM_PATHS = new Set(['watch', 'watch/live', 'video.php']);

/**
 * ⚠ MANDATORY HONESTY (owner directive 2026-07-26). Meta deletes Facebook Live
 * replays after roughly 30 days, so Facebook can never be the only copy of a
 * wedding. Surfaced wherever the couple SETS the link. Exported as a constant so
 * both setup surfaces show the identical sentence and a test can assert it ships.
 */
export const FACEBOOK_REPLAY_WARNING =
  'Facebook deletes live replays after about 30 days. Your YouTube stream is the copy that lasts — treat Facebook as the second screen, not the archive.';

/** Scheme-tolerant parse to an http(s) URL, or null. */
function toHttpUrl(raw: string): URL | null {
  const input = raw.trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return url;
}

/**
 * Canonical persisted form of a Facebook live/video URL, or null when the input
 * is not one. Accepts the shapes Facebook's own share sheet produces:
 *
 *   facebook.com/watch/?v=<id> · /watch?v=<id> · /watch/live/?v=<id>
 *   facebook.com/video.php?v=<id>
 *   facebook.com/<page>/videos/<id>  (and /<page>/videos/<slug>/<id>)
 *   facebook.com/reel/<id>
 *   facebook.com/share/v/<code>  ·  /share/r/<code>
 *   fb.watch/<code>
 *   …on facebook.com / www. / m. / web. , with or without a scheme.
 *
 * The output preserves the SHAPE the couple pasted (a /videos/ link stays a
 * /videos/ link) — a "smarter" rewrite to one universal form risks a dead link
 * at the wedding — but is rebuilt from validated parts, with the query string
 * and fragment dropped.
 */
export function normalizeFacebookWatchUrl(raw: string): string | null {
  const url = toHttpUrl(raw);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  const segs = url.pathname.split('/').filter(Boolean);

  // fb.watch/<code> — the share-sheet short link.
  if (FB_WATCH_HOSTS.has(host)) {
    const code = segs[0] ?? '';
    return segs.length === 1 && SHARE_CODE_RE.test(code) ? `https://fb.watch/${code}/` : null;
  }

  if (!FACEBOOK_HOSTS.has(host)) return null;

  const path = segs.join('/').toLowerCase();
  const first = (segs[0] ?? '').toLowerCase();

  // /watch/?v=<id> · /watch?v=<id> · /watch/live/?v=<id> · /video.php?v=<id>
  if (V_PARAM_PATHS.has(path)) {
    const v = url.searchParams.get('v') ?? '';
    return VIDEO_ID_RE.test(v) ? `https://www.facebook.com/watch/?v=${v}` : null;
  }

  // /share/v/<code> · /share/r/<code> — the current "Copy link" form.
  if (first === 'share' && segs.length === 3) {
    const kind = (segs[1] ?? '').toLowerCase();
    const code = segs[2] ?? '';
    if ((kind === 'v' || kind === 'r') && SHARE_CODE_RE.test(code)) {
      return `https://www.facebook.com/share/${kind}/${code}/`;
    }
    return null;
  }

  // /reel/<id>
  if (first === 'reel' && segs.length === 2) {
    const id = segs[1] ?? '';
    return VIDEO_ID_RE.test(id) ? `https://www.facebook.com/reel/${id}/` : null;
  }

  // /<page>/videos/<id> and /<page>/videos/<slug>/<id>
  if (segs.length >= 3 && segs.length <= 4 && (segs[1] ?? '').toLowerCase() === 'videos') {
    const page = segs[0] ?? '';
    const id = segs[segs.length - 1] ?? '';
    // `.` / `..` satisfy PAGE_SLUG_RE but are path traversal, not a page name.
    if (!/^\.+$/.test(page) && PAGE_SLUG_RE.test(page) && VIDEO_ID_RE.test(id)) {
      return `https://www.facebook.com/${page}/videos/${id}/`;
    }
    return null;
  }

  // Anything else — a bare page URL, /<page>/live, a story permalink, a profile —
  // does not identify a broadcast. Rejected: a link that resolves to "some page"
  // during a wedding is worse than an honest "that doesn't look like a link".
  return null;
}
