/**
 * lib/hub-view-key.ts — WHICH CACHED COPY OF AN EVENT HUB A REQUEST MAY BE SERVED (EV1, 2026-10-28).
 *
 * Owner, verbatim: *"Our priority is not crash any event hub most specially during their event."* The guest Event Hub
 * (`app/[slug]/page.tsx`) rendered on EVERY request — its `revalidate = 60` was dead, because the page reads the
 * viewer's cookies and the address's query. On the day that is one full server render per guest per open.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────────────────────────────────────────────
 * The page's output depends on the request in only a few ways, and each is named here:
 *   · WHO is looking — nobody (a stranger), or a guest holding THIS event's pass, or somebody signed in;
 *   · the device, but only for one decision (the "Add to Apple Wallet" offer — `HubUaFacts`);
 *   · which menu tab the address names (`?tab=`);
 *   · the event's own state (the database stamp `event_public_stamp` — `rev`).
 * The middleware (`middleware.ts`) reads those from the request and rewrites `/{slug}` to
 * `/{slug}/cached/{key}` (`app/[slug]/cached/[key]/page.tsx`), a route that reads NOTHING from the request but its
 * address — so Next renders it once per key and serves it from the cache (ISR) until the stamp moves, an announcement
 * clears its tag, or `revalidate` passes. Everyone else (a signed-in account, a host's preview, a one-shot flash in
 * the query, the native app) keeps the live render, exactly as before.
 *
 * 🔒 A GUEST'S COPY IS KEYED BY A SEAL OF THEIR PASS, never by the pass itself: `g{guest id}{mac}` where the mac is an
 * HMAC of (guest id, QR token) under the guest-session secret. Only the holder of the pass can name the copy, and the
 * route re-checks the seal against the guest's CURRENT QR token before it draws anything for them — a rotated QR names
 * a copy nobody can open. A stranger's copy (`a`) carries nothing of any guest: it is what the page draws for nobody.
 *
 * Pure and edge-safe: the middleware imports it. Held by `lib/the-guest-hub-stays-cacheable.test.ts`.
 */
import { isAppleTouchDevice, mightBeIpadSafari, deviceOs } from './apple-device';
import { isInAppWebview } from './guest-one-path';
import { RSVP_TERMS_COOKIE } from './terms-agreement';
import { VIEW_AS_FREE_COOKIE } from './view-as-free';
import { HOST_PREVIEW_PASS_COOKIE_NAME } from './pass-account-rule';
import { DEMO_MODE_COOKIE_NAME } from './demo-mode-constants';

/** The route segment the middleware rewrites to: `app/[slug]/cached/[key]`. Never reachable from outside. */
export const HUB_VIEW_SEGMENT = 'cached';

/** Is this path the cached route itself (`/{slug}/cached/…`)? Refused from outside; never recorded as a visit path. */
export function isHubViewPath(pathname: string): boolean {
  return new RegExp(`^/[a-z0-9][a-z0-9-]{0,62}/${HUB_VIEW_SEGMENT}(/|$)`, "i").test(pathname);
}

/** The cookie a guest's OWN write sets (middleware, on any write carrying a pass), so their next open is drawn fresh. */
export const HUB_BUST_COOKIE = 'sn_hub_bust';

/**
 * Writes that change NOTHING the guest's Event Hub draws, so they must not move `HUB_BUST_COOKIE`. The "someone is
 * looking" beacon (`/api/hub/seen`, Who's here 2026-10-29) is posted on every guest's open: were it a "write", every
 * open would bust that guest's copy and their NEXT open would render live — the cache defeated by the act of reading.
 * ⚠ Only a path whose write no guest page shows belongs here.
 */
export const HUB_BUST_EXEMPT_PATHS: readonly string[] = ['/api/hub/seen'];

/**
 * EVERY query parameter the Event Hub page reads (its `Props.searchParams`, plus `generateMetadata`). Any of them on
 * the request — except `tab`, which is part of the key — keeps the live render: they are hosts' previews and one-shot
 * flashes (`?rsvp=ok`, `?save=`, `?invite=`…), and a cached copy must never answer them. A parameter the page does NOT
 * read (`fbclid`, `utm_*`) changes nothing it draws, so it does not cost the cache. ⚠ Add a new param to `Props` →
 * add it here; the guard test compares the two.
 */
export const HUB_LIVE_PARAMS: readonly string[] = [
  'invite', 'k', 'invite_error', 'phase', 'editor', 'preview', 'bars', 'tabs', 'only', 'style', 'theme', 'palette',
  'board', 'scene', 'tool', 'film', 'save', 'rsvp', 'added', 'from', 'keep', 'as', 'asrole', 'src',
];

/**
 * Cookies the live render reads that the cached copy cannot — any of them present keeps the live render. The Supabase
 * session (`sb-…-auth-token…`) is matched by shape below. ⚠ The guard test fails when the hub's tree reads a cookie
 * that is neither here nor one of the pass cookies the key already accounts for.
 */
export const HUB_LIVE_COOKIES: readonly string[] = [
  RSVP_TERMS_COOKIE,
  VIEW_AS_FREE_COOKIE,
  HOST_PREVIEW_PASS_COOKIE_NAME,
  DEMO_MODE_COOKIE_NAME,
];

/** A Supabase session cookie (`sb-<ref>-auth-token`, possibly chunked `.0`, `.1`, or the code verifier). */
export function isAuthCookieName(name: string): boolean {
  return name.startsWith('sb-') && name.includes('-auth-token');
}

/** The ONE device decision the hub makes — the Apple Wallet offer (`appleWalletLink`), as four facts. */
export type HubUaFacts = {
  /** iPhone / iPad (`isAppleTouchDevice`). */
  appleTouch: boolean;
  /** A "Macintosh" that may be iPad Safari (`mightBeIpadSafari`). */
  maybeIpadSafari: boolean;
  /** Inside Messenger / Instagram / … (`isInAppWebview`). */
  inApp: boolean;
  /** `deviceOs` as the in-app hand-off reads it. */
  os: 'ios' | 'android' | 'other';
};

export function hubUaFacts(userAgent: string | null | undefined): HubUaFacts {
  const os = deviceOs(userAgent);
  return {
    appleTouch: isAppleTouchDevice(userAgent),
    maybeIpadSafari: mightBeIpadSafari(userAgent),
    inApp: isInAppWebview(userAgent),
    os: os === 'iphone' || os === 'ipad' ? 'ios' : os === 'android' ? 'android' : 'other',
  };
}

const OS_CODE = { ios: 'i', android: 'a', other: 'x' } as const;
function uaCode(f: HubUaFacts): string {
  return `${f.appleTouch ? 1 : 0}${f.maybeIpadSafari ? 1 : 0}${f.inApp ? 1 : 0}${OS_CODE[f.os]}`;
}
function uaFromCode(code: string): HubUaFacts | null {
  const m = /^([01])([01])([01])([iax])$/.exec(code);
  if (!m) return null;
  return {
    appleTouch: m[1] === '1',
    maybeIpadSafari: m[2] === '1',
    inApp: m[3] === '1',
    os: m[4] === 'i' ? 'ios' : m[4] === 'a' ? 'android' : 'other',
  };
}

export type HubViewer = { kind: 'anonymous' } | { kind: 'guest'; guestId: string; mac: string };

export type HubViewKey = {
  /** The event's stamp (`event_public_revs.rev`) when the copy was asked for — a write moves it, and the key with it. */
  rev: string;
  viewer: HubViewer;
  /** The device facts — a guest's copy only (a stranger is offered no ticket, so no wallet). */
  ua: HubUaFacts | null;
  /** `?tab=` — the menu tab the page draws first. */
  tab: string | null;
  /** The guest's own last write (`HUB_BUST_COOKIE`). */
  bust: string | null;
};

const UUID_HEX = /^[0-9a-f]{32}$/;
const MAC = /^[A-Za-z0-9_-]{22}$/;
const TAB = /^[a-z][a-z0-9-]{0,23}$/;
const BUST = /^[a-z0-9]{1,16}$/;
const REV = /^[0-9]{1,19}$/;

const hexOf = (uuid: string) => uuid.replace(/-/g, '').toLowerCase();
const uuidOf = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

/** `v1.{rev}.{a | g<hex32><mac22>}.{ua | -}.{tab | -}.{bust | -}` — one path segment, no `/`, `?` or `%`. */
export function formatHubViewKey(k: HubViewKey): string {
  const viewer = k.viewer.kind === 'anonymous' ? 'a' : `g${hexOf(k.viewer.guestId)}${k.viewer.mac}`;
  return ['v1', k.rev, viewer, k.ua ? uaCode(k.ua) : '-', k.tab ?? '-', k.bust ?? '-'].join('.');
}

/** The inverse — `null` for anything not made by `formatHubViewKey` (the route then answers 404). */
export function parseHubViewKey(raw: string): HubViewKey | null {
  const parts = decodeURIComponent(raw).split('.');
  if (parts.length !== 6 || parts[0] !== 'v1') return null;
  const [, rev, v, ua, tab, bust] = parts as [string, string, string, string, string, string];
  if (!REV.test(rev)) return null;
  let viewer: HubViewer;
  if (v === 'a') viewer = { kind: 'anonymous' };
  else {
    const hex = v.slice(1, 33);
    const mac = v.slice(33);
    if (v[0] !== 'g' || !UUID_HEX.test(hex) || !MAC.test(mac)) return null;
    viewer = { kind: 'guest', guestId: uuidOf(hex), mac };
  }
  const uaFacts = ua === '-' ? null : uaFromCode(ua);
  if (ua !== '-' && !uaFacts) return null;
  if (viewer.kind === 'anonymous' && uaFacts) return null;
  if (tab !== '-' && !TAB.test(tab)) return null;
  if (bust !== '-' && !BUST.test(bust)) return null;
  return { rev, viewer, ua: uaFacts, tab: tab === '-' ? null : tab, bust: bust === '-' ? null : bust };
}

/**
 * The seal of one guest's pass — HMAC-SHA256(secret, "hub-view-v1|guest|qr"), first 128 bits, base64url (22 chars).
 * WebCrypto, so the middleware (edge) and the route (node) compute the same value.
 */
export async function hubPassMac(secret: string, guestId: string, qrToken: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`hub-view-v1|${guestId.toLowerCase()}|${qrToken}`)));
  let bin = '';
  for (const b of sig.slice(0, 16)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time compare of two seals. */
export function sameMac(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Is this request one a cached copy may answer — and if so, for which event address and tab? `null` = the live render.
 * Pure: the middleware hands it what it read. (Who the viewer is, and the stamp, are asked after — they cost a read.)
 */
export function hubRequestShape(req: {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  cookieNames: readonly string[];
  clientTypeCookie: string | null;
  userAgent: string | null;
  isServerAction: boolean;
  reserved: (slug: string) => boolean;
}): { slug: string; tab: string | null } | null {
  const reads = req.method === 'GET' || req.method === 'HEAD';
  // A Server Action posted from the cached page keeps the same route tree (the client's router holds it).
  if (!reads && !(req.method === 'POST' && req.isServerAction)) return null;
  const m = /^\/([a-z0-9][a-z0-9-]{0,62})\/?$/i.exec(req.pathname);
  if (!m) return null;
  const slug = m[1]!;
  if (req.reserved(slug.toLowerCase())) return null;
  for (const p of HUB_LIVE_PARAMS) if (req.searchParams.has(p)) return null;
  const tabRaw = req.searchParams.get('tab');
  if (tabRaw !== null && !TAB.test(tabRaw)) return null;
  if (req.cookieNames.some((n) => isAuthCookieName(n) || HUB_LIVE_COOKIES.includes(n))) return null;
  // The native shells (store app, desktop app) keep the live render — the page decides things there by their marks.
  if (req.clientTypeCookie === 'capacitor' || req.clientTypeCookie === 'tauri') return null;
  if (/SetnayanApp/i.test(req.userAgent ?? '')) return null;
  return { slug, tab: tabRaw };
}
