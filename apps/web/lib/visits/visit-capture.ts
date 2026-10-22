/**
 * VISITS · the pure half of the capture — what counts as a page view, and what
 * a counted view is reduced to before anything leaves the middleware.
 * (Owner 2026-10-22: site traffic in our own admin, not Vercel; no cookies.)
 *
 * Pure and edge-safe: no `next/*`, no Node built-ins. The middleware hands in
 * the request's headers; this module answers. Held by
 * `lib/visits/visits-are-private.test.ts`.
 *
 * 🔒 WHAT IS NEVER COUNTED
 *   · the App Store / Play Store shell — its App Privacy answer is "no
 *     analytics" (`isStoreShellSignals`, the same predicate the paywall uses);
 *   · bots, crawlers, link previewers, headless browsers, Lighthouse;
 *   · /admin (our own work is not traffic), /api, /auth, /dev, /monitoring;
 *   · prefetches, server actions, anything that is not a GET for a page.
 *
 * 🔒 WHAT A VIEW IS REDUCED TO — a route PATTERN (via the app's own route list:
 * `/v/[slug]`, never the shop's name), a referrer DOMAIN (never the URL), a
 * utm_source word, phone / tablet / desktop, a two-letter country, and a
 * signed-in flag. The visitor key is built by the caller from IP + user-agent
 * and is hashed before it is sent; no cookie, no browser id, nothing stored in
 * the browser.
 */
import { isStoreShellSignals } from '@/lib/store-shell';

export type VisitDevice = 'phone' | 'tablet' | 'desktop';

/** The one shape `record_site_visit` accepts (minus the hashed key). */
export type VisitFacts = {
  path: string;
  source: string;
  utmSource: string;
  device: VisitDevice;
  country: string;
  signedIn: boolean;
};

/** Paths that are never traffic. Prefixes end in `/` or are exact. */
const NEVER_PREFIXES = ['/admin/', '/api/', '/auth/', '/dev/', '/monitoring', '/_next/', '/ingest/'] as const;
const NEVER_EXACT = new Set(['/admin', '/api', '/auth', '/dev', '/robots.txt', '/sitemap.xml', '/favicon.ico']);

/** A file (`/og.png`, `/llms.txt`) is not a page. */
const FILE_EXT = /\.[a-z0-9]{2,5}$/i;

export function isNeverCountedPath(pathname: string): boolean {
  if (!pathname.startsWith('/')) return true;
  if (NEVER_EXACT.has(pathname)) return true;
  if (NEVER_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return FILE_EXT.test(pathname);
}

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|archiver|facebookexternalhit|facebookcatalog|embedly|quora link preview|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|pinterest|skypeuripreview|vercel|lighthouse|pagespeed|headlesschrome|phantomjs|puppeteer|playwright|python-requests|python-urllib|curl\/|wget\/|go-http-client|okhttp|java\/|axios\/|node-fetch|undici|httpclient|uptime|pingdom|statuscake|monitor|preview/i;

export function isBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  if (ua.length < 12) return true; // no real browser sends an empty or stub UA
  return BOT_UA.test(ua);
}

/** Phone / tablet / desktop from the user-agent alone (no client hints, no JS). */
export function deviceFromUserAgent(userAgent: string | null | undefined): VisitDevice {
  const ua = userAgent ?? '';
  if (/iPad|Tablet|PlayBook|Silk|Kindle|SM-T\d|Nexus (7|9|10)/i.test(ua)) return 'tablet';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|BlackBerry|Opera Mini/i.test(ua)) return 'phone';
  return 'desktop';
}

/** Our own hosts — a referrer from these is an in-app move, not a source. */
function isOwnHost(host: string, requestHost: string): boolean {
  const h = host.toLowerCase();
  const r = requestHost.toLowerCase().replace(/:\d+$/, '');
  return h === r || h === 'setnayan.com' || h.endsWith('.setnayan.com') || h.endsWith('.vercel.app');
}

/**
 * A referrer URL → its bare domain (`www.`, `m.`, `l.`, `lm.` dropped), or ''
 * for direct / own-site / unreadable. NEVER the path or the query — a referrer
 * URL can carry a search phrase or a private link.
 */
export function referrerDomain(referer: string | null | undefined, requestHost: string): string {
  if (!referer) return '';
  let host = '';
  try {
    host = new URL(referer).hostname.toLowerCase();
  } catch {
    return '';
  }
  if (!host || isOwnHost(host, requestHost)) return '';
  host = host.replace(/^(www|m|l|lm|mobile|amp)\./, '');
  return /^[a-z0-9.-]{1,80}$/.test(host) ? host : '';
}

/** utm_source as one lowercase word, or ''. */
export function utmSourceOf(search: URLSearchParams): string {
  const raw = (search.get('utm_source') ?? '').trim().toLowerCase();
  return /^[a-z0-9._-]{1,40}$/.test(raw) ? raw : '';
}

/** The platform geo header → a two-letter country, or ''. */
export function countryOf(header: string | null | undefined): string {
  const c = (header ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== 'XX' ? c : '';
}

export type CountInput = {
  method: string;
  pathname: string;
  headers: Headers;
  /** Status the middleware answered with (a redirect is not a view). */
  status: number;
};

/** Which kind of hit this is: a full page load, an in-app move, or neither. */
export type HitKind = 'page' | 'move' | null;

/**
 * Is this request a page view? A full page load (the browser asked for a
 * document) always is. An in-app move (Next's RSC fetch) is one only when it
 * goes to a DIFFERENT page than the one it came from — so `router.refresh()`
 * on a live screen, which re-asks for the page it is on, is never a view.
 */
export function hitKind({ method, pathname, headers, status }: CountInput): HitKind {
  if (method !== 'GET') return null;
  if (status >= 300 && status < 400) return null;
  if (isNeverCountedPath(pathname)) return null;
  if (headers.get('next-router-prefetch') || headers.get('next-router-segment-prefetch')) return null;
  const purpose = `${headers.get('purpose') ?? ''} ${headers.get('sec-purpose') ?? ''}`.toLowerCase();
  if (purpose.includes('prefetch') || purpose.includes('prerender')) return null;
  if (headers.get('next-action')) return null;

  if (headers.get('rsc') === '1') {
    const from = headers.get('referer');
    if (!from) return null;
    try {
      if (new URL(from).pathname === pathname) return null;
    } catch {
      return null;
    }
    return 'move';
  }

  const dest = headers.get('sec-fetch-dest');
  if (dest && dest !== 'document') return null;
  if (!dest && !(headers.get('accept') ?? '').includes('text/html')) return null;
  return 'page';
}

/** The store shell, read exactly as the paywall reads it. */
export function isStoreShellRequest(headers: Headers, clientTypeCookie: string | null | undefined): boolean {
  return isStoreShellSignals(headers.get('user-agent'), clientTypeCookie);
}

/**
 * Should this request be counted at all? Everything that is never counted is
 * decided here, before any hashing or network.
 */
export function shouldCount(input: CountInput & { clientTypeCookie?: string | null }): HitKind {
  if (isStoreShellRequest(input.headers, input.clientTypeCookie)) return null;
  if (isBot(input.headers.get('user-agent'))) return null;
  return hitKind(input);
}

/** The IP the platform saw — the first `x-forwarded-for` hop, else `x-real-ip`. */
export function clientIp(headers: Headers): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return (headers.get('x-real-ip') ?? '').trim();
}

/**
 * The facts of a counted view. `toPattern` is the app's route matcher; a path
 * it cannot name keeps only literal segments (`route-pattern.ts`), so a slug
 * never survives either way. An in-app move has no source — the visitor's
 * source is the one they arrived with, on their first view of the day.
 */
export function visitFacts(args: {
  kind: Exclude<HitKind, null>;
  pathname: string;
  search: URLSearchParams;
  headers: Headers;
  host: string;
  signedIn: boolean;
  toPattern: (path: string) => string | null;
}): VisitFacts | null {
  const path = args.toPattern(args.pathname);
  if (!path) return null;
  const page = args.kind === 'page';
  return {
    path,
    source: page ? referrerDomain(args.headers.get('referer'), args.host) : '',
    utmSource: page ? utmSourceOf(args.search) : '',
    device: deviceFromUserAgent(args.headers.get('user-agent')),
    country: countryOf(args.headers.get('x-vercel-ip-country')),
    signedIn: args.signedIn,
  };
}

/** sha256 as lowercase hex — Web Crypto, so it runs on the edge. */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The visitor key the database salts again with TODAY's salt. Built from the
 * IP and the user-agent only; the raw values never leave the caller.
 */
export async function visitorKey(headers: Headers): Promise<string> {
  return sha256Hex(`${clientIp(headers)}|${headers.get('user-agent') ?? ''}`);
}

/** Is there a Supabase session cookie? A flag, not an identity. */
export function hasSessionCookie(names: readonly string[]): boolean {
  return names.some((n) => /^sb-.+-auth-token(?:\.\d+)?$/.test(n));
}
