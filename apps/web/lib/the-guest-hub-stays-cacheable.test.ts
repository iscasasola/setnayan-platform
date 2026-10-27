/**
 * THE GUEST EVENT HUB STAYS CACHEABLE — AND GUESTS HOLD NO LIVE CONNECTION (EV1, 2026-10-28).
 *
 * Owner, verbatim: *"Our priority is not crash any event hub most specially during their event"*. DECISION_LOG
 * 2026-10-28 "NO EVENT HUB MAY CRASH" (7): *a guard: no `supabase.channel(` / `setInterval` polling under
 * `app/[slug]/**` without an allow-list entry (the existing 45 s hub tick and 25 s wall poll are the first entries,
 * each with its reason).*
 *
 * WHAT BROKE BEFORE, AND HOW THIS KEEPS IT FROM BREAKING AGAIN:
 *   § 1 · `revalidate = 60` on the hub was dead for five months because ONE cookie read anywhere in its tree makes Next
 *         render it per request — and nothing said so. The cached route (`app/[slug]/cached/[key]/page.tsx`) must read
 *         nothing from the request: every `cookies()` / `headers()` / `draftMode()` / `connection()` / `noStore` in
 *         the server tree it reaches is either behind the `cachedHubViewer()` question (lib/hub-request.ts) or on this
 *         file's list with the reason it cannot run there. A new one fails here, naming the file.
 *   § 2 · the request readers that answer for the cached hub each still ask it first.
 *   § 3 · what the middleware lets into the cache (`hubRequestShape`), the key, and the refusal of the route's own path.
 *   § 4 · timers and sockets under `app/[slug]/**` — each on the list with its reason; no Realtime channel at all.
 *
 * Run: npx tsx --test lib/the-guest-hub-stays-cacheable.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { stripComments } from './strip-comments';
import { WEB_ROOT, resolveImport } from './rsc-function-props';
import {
  HUB_LIVE_PARAMS,
  HUB_LIVE_COOKIES,
  formatHubViewKey,
  hubPassMac,
  hubRequestShape,
  isHubViewPath,
  parseHubViewKey,
  sameMac,
} from './hub-view-key';
import { forgetHubStampsForTest, hubViewRewritePath } from './hub-view-route';
import { RSVP_TERMS_COOKIE } from './terms-agreement';
import { VIEW_AS_FREE_COOKIE } from './view-as-free';
import { HOST_PREVIEW_PASS_COOKIE_NAME } from './pass-account-rule';
import { DEMO_MODE_COOKIE_NAME } from './demo-mode-constants';

const rel = (abs: string) => path.relative(WEB_ROOT, abs).split(path.sep).join('/');
const abs = (p: string) => path.join(WEB_ROOT, p);
const read = (p: string) => fs.readFileSync(abs(p), 'utf8');
const code = (p: string) => stripComments(read(p));

const CACHED_ROUTE = 'app/[slug]/cached/[key]/page.tsx';

// ── § 1 · the cached route's server tree reads nothing from the request ─────────────────────────────────────────

/**
 * Imports the walk does NOT follow, and why the cached route never reaches them. Each is a branch the cached route
 * decides against BEFORE the page could take it.
 */
const PRUNED: Record<string, string> = {
  'app/v/[slug]/page.tsx':
    "the page's vendor fallback — the cached route answers 404 first for an address that is not an event with an Event Hub (`resolve` in the route)",
};

/**
 * Request reads in the tree that are NOT behind `cachedHubViewer()` in their own function, keyed `file :: the
 * function they sit in` (for the page body, a snippet of the line), with the reason they never run on the cached route.
 */
const NEVER_ON_THE_CACHED_HUB: Record<string, string> = {
  'app/[slug]/page.tsx :: isLinkPreviewFetch((await headers())':
    'only with `?invite=` on the address — a live param (HUB_LIVE_PARAMS), so such a request is never rewritten',
  'lib/guest-session.ts :: standingOfPass':
    'reads the host-preview cookie only for a SIGNED-IN account, and `signedInAccountId` answers null on the cached hub first',
  'lib/guest-session.ts :: setGuestSession': 'a WRITER — the redeem / seat claim route handlers and actions; no render calls it',
  'lib/guest-session.ts :: clearGuestSession': 'a WRITER — sign-out and leave; no render calls it',
  'lib/guest-session.ts :: readEveryGuestPass': '"sign out everywhere" — an action; no render calls it',
  'lib/guest-session.ts :: guestPassBookSize': 'only through `guestPassEvidence` (the redeem / reply doors); the hub render never calls it',
  'lib/guest-one-path.server.ts :: guestPassEvidence': 'the redeem / reply doors only; the hub render never calls it',
  'lib/live-wall.ts :: setWallDisplayCookie': 'the wall DISPLAY pairing (/wall routes); never a guest page render',
  'lib/live-wall.ts :: readWallDisplayCookie': 'the wall DISPLAY pairing (/wall routes); never a guest page render',
  'lib/custom-domain-resolve.ts :: callResolverRpc':
    "the middleware's custom-domain / paid-subdomain lookups (a `no-store` fetch) — the page imports only this file's host predicates",
  'lib/active-shop.ts :: readActiveShopCookie':
    "a SIGNED-IN supplier's shop — reached only through the vendor capability, which needs an account (none on the cached hub)",
};

/** The name of a top-level declaration (a function or a `const x = …`), for the list above. */
function declName(st: ts.Node | null): string | null {
  if (!st) return null;
  if (ts.isFunctionDeclaration(st) && st.name) return st.name.text;
  if (ts.isVariableStatement(st)) {
    const d = st.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name)) return d.name.text;
  }
  return null;
}

/** A request read — or a fetch that forbids caching, which turns an ISR render dynamic at runtime just the same. */
const REQUEST_READ = /\bcookies\(\)|\bheaders\(\)|\bdraftMode\(\)|\bconnection\(\)|\bunstable_noStore\(|\bnoStore\(\)|\bcache:\s*['"]no-store['"]|\brevalidate:\s*0\b/g;

function directive(src: string): 'client' | 'server' | null {
  const m = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use (client|server)\1/.exec(src);
  return m ? (m[2] as 'client' | 'server') : null;
}

function importsOf(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && !st.importClause?.isTypeOnly) {
      out.push(st.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && !st.isTypeOnly) {
      out.push(st.moduleSpecifier.text);
    }
  }
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}

/** Every server module the cached route reaches (no `'use client'` crossing; `'use server'` modules render nothing). */
function cachedHubTree(): string[] {
  const seen = new Set<string>();
  const stack = [abs(CACHED_ROUTE), abs('app/[slug]/layout.tsx')];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    if (directive(src)) continue;
    for (const spec of importsOf(f, src)) {
      const r = resolveImport(f, spec);
      if (!r || !/\.tsx?$/.test(r) || PRUNED[rel(r)]) continue;
      stack.push(r);
    }
  }
  return [...seen].filter((f) => directive(fs.readFileSync(f, 'utf8')) === null);
}

/** The top-level statement around `index` (the function a read sits in). */
function enclosingTopLevel(sf: ts.SourceFile, index: number): ts.Node | null {
  for (const st of sf.statements) if (st.getStart() <= index && index < st.getEnd()) return st;
  return null;
}

test('§1 · the cached hub route reads nothing from the request but its own address', () => {
  const route = code(CACHED_ROUTE);
  assert.match(route, /export const revalidate = \d+;/, 'the route must declare its ISR window as a literal');
  assert.match(route, /export function generateStaticParams\(/, 'without generateStaticParams the route renders per request');
  assert.doesNotMatch(route, REQUEST_READ, 'a request read on the cached route makes it render per request');
  assert.doesNotMatch(route, /\bsearchParams\s*\}|props\.searchParams|await searchParams/, 'the cached route must never read the query');
  const page = route.slice(route.indexOf('export default async function'));
  const hold = page.indexOf('holdCachedHubViewer(r.viewer)');
  const render = page.indexOf('PublicInvitationPage({');
  assert.ok(hold > 0 && render > hold, 'the viewer must be held BEFORE the page renders anything');
  const metadata = route.slice(route.indexOf('export async function generateMetadata'), route.indexOf('export default async function'));
  const metaHold = metadata.indexOf('holdCachedHubViewer(r.viewer);');
  const meta = metadata.indexOf('liveMetadata(');
  assert.ok(metaHold > 0 && meta > metaHold, 'the metadata must be resolved for the held viewer too');
  assert.match(route, /tags: \[liveDayTag\(eventId\)\]/, "the copy must wear the event's live-day tag (an announcement clears it)");
});

test('§1 · the [slug] layout reads no viewer — it wraps the Event Hub', () => {
  const layout = code('app/[slug]/layout.tsx');
  for (const re of [/readGuestSession\(/, /readGuestPassStanding\(/, /getCurrentUser\(/, REQUEST_READ, /createClient\(\)/]) {
    assert.doesNotMatch(layout, re, `the layout reads the request (${re}) — every page under it, the hub included, renders per request`);
  }
});

test('§1 · every request read the cached hub can reach is behind `cachedHubViewer()` or listed with its reason', () => {
  const tree = cachedHubTree();
  assert.ok(tree.length > 200, `the walk reached only ${tree.length} modules — it is not walking the hub`);
  const unexplained: string[] = [];
  const used = new Set<string>();
  for (const f of tree) {
    const src = fs.readFileSync(f, 'utf8');
    const clean = stripComments(src);
    if (!REQUEST_READ.test(clean)) continue;
    REQUEST_READ.lastIndex = 0;
    const sf = ts.createSourceFile(f, clean, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const m of clean.matchAll(REQUEST_READ)) {
      const at = m.index!;
      const stmt = enclosingTopLevel(sf, at);
      const before = stmt ? clean.slice(stmt.getStart(), at) : '';
      if (/cachedHubViewer\(\)|\bhubViewer \?/.test(before)) continue;
      const lineStart = clean.lastIndexOf('\n', at) + 1;
      const line = clean.slice(lineStart, clean.indexOf('\n', at)).trim();
      const name = declName(stmt);
      const key = Object.keys(NEVER_ON_THE_CACHED_HUB).find((k) => {
        const [file, what] = k.split(' :: ');
        return file === rel(f) && (what === name || line.includes(what!));
      });
      if (key) used.add(key);
      else unexplained.push(`${rel(f)} :: ${name ?? '?'} — ${line}`);
    }
  }
  assert.deepEqual(
    unexplained,
    [],
    'a request read the cached Event Hub can reach — guard it with `cachedHubViewer()` (lib/hub-request.ts), or list it in NEVER_ON_THE_CACHED_HUB with the reason it never runs there',
  );
  const stale = Object.keys(NEVER_ON_THE_CACHED_HUB).filter((k) => !used.has(k));
  assert.deepEqual(stale, [], 'listed reads that no longer exist — take them off the list');
});

// ── § 2 · the readers that answer for the cached hub ask it first ────────────────────────────────────────────────

test('§2 · each request reader asks `cachedHubViewer()` before it touches the request', () => {
  const firstIn = (file: string, fn: RegExp, call: RegExp) => {
    const src = code(file);
    const at = src.search(fn);
    assert.ok(at >= 0, `${file}: ${fn} is gone — update this guard`);
    const body = src.slice(at, at + 1200);
    const ask = body.search(/cachedHubViewer\(\)/);
    const touch = body.search(call);
    assert.ok(ask > 0 && (touch < 0 || ask < touch), `${file}: ${fn} reads the request before asking cachedHubViewer()`);
  };
  firstIn('lib/auth.ts', /export const getCurrentUser = cache\(/, /createClient\(\)/);
  firstIn('lib/supabase/server.ts', /export const createClient = cache\(/, /await cookies\(\)/);
  firstIn('lib/guest-session.ts', /async function readHeldPass\(/, /await cookies\(\)/);
  firstIn('lib/guest-session.ts', /const signedInAccountId = cache\(/, /createSessionClient\(\)/);
  firstIn('lib/request-platform.ts', /async function readShellSignals\(/, /await headers\(\)/);
  firstIn('lib/request-platform.ts', /export async function getRequestPlatform\(/, /await headers\(\)/);
  firstIn('lib/request-platform.ts', /export async function isStoreShellRequest\(/, /await headers\(\)/);
  firstIn('lib/view-as-free.server.ts', /async function readCookie\(/, /await cookies\(\)/);
});

test('§2 · the cached viewer is held per render, never across requests', () => {
  const src = code('lib/hub-request.ts');
  assert.match(src, /const slot = cache\(/, 'the held viewer must live in React.cache — one render, one viewer');
  assert.doesNotMatch(src, /^let |^const \w+ = \{|new Map\(/m, 'a module-level holder would hand one guest’s viewer to the next request');
});

// ── § 3 · the middleware's half ──────────────────────────────────────────────────────────────────────────────────

const shape = (over: Partial<Parameters<typeof hubRequestShape>[0]> = {}) =>
  hubRequestShape({
    method: 'GET',
    pathname: '/maria-and-jose',
    searchParams: new URLSearchParams(),
    cookieNames: [],
    clientTypeCookie: null,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    isServerAction: false,
    reserved: (s) => s === 'login',
    ...over,
  });

test('§3 · only a request the live render would draw identically is let into the cache', () => {
  assert.deepEqual(shape(), { slug: 'maria-and-jose', tab: null });
  assert.deepEqual(shape({ searchParams: new URLSearchParams('tab=schedule&fbclid=x&utm_source=m') }), { slug: 'maria-and-jose', tab: 'schedule' });
  for (const p of HUB_LIVE_PARAMS) assert.equal(shape({ searchParams: new URLSearchParams(`${p}=1`) }), null, `?${p}= must keep the live render`);
  assert.equal(shape({ cookieNames: ['sb-abc-auth-token'] }), null, 'a signed-in account keeps the live render');
  assert.equal(shape({ cookieNames: ['sb-abc-auth-token.0'] }), null, 'a chunked session too');
  // The cookies the live render reads that the cached copy cannot — named from their OWN modules, not from the list.
  for (const c of [RSVP_TERMS_COOKIE, VIEW_AS_FREE_COOKIE, HOST_PREVIEW_PASS_COOKIE_NAME, DEMO_MODE_COOKIE_NAME]) {
    assert.ok(HUB_LIVE_COOKIES.includes(c), `${c} is read by the live render and is not a live cookie`);
    assert.equal(shape({ cookieNames: [c] }), null, `${c} keeps the live render`);
  }
  assert.equal(shape({ clientTypeCookie: 'capacitor' }), null, 'the store app keeps the live render');
  assert.equal(shape({ clientTypeCookie: 'tauri' }), null, 'the desktop app keeps the live render');
  assert.equal(shape({ userAgent: 'Mozilla/5.0 SetnayanApp/ios' }), null, 'the app’s mark keeps the live render');
  assert.deepEqual(shape({ clientTypeCookie: 'pwa' }), { slug: 'maria-and-jose', tab: null }, 'an installed PWA is a browser');
  assert.equal(shape({ method: 'POST' }), null, 'a plain POST is not a page read');
  assert.deepEqual(shape({ method: 'POST', isServerAction: true }), { slug: 'maria-and-jose', tab: null }, 'an action keeps its page’s route');
  assert.equal(shape({ pathname: '/login' }), null, 'a reserved word is a real page');
  assert.equal(shape({ pathname: '/maria-and-jose/hub' }), null, 'only the hub itself');
  assert.equal(shape({ searchParams: new URLSearchParams('tab=Bad%20Tab') }), null, 'an odd tab keeps the live render');
});

test('§3 · every query the page reads is a live param (except the tab, which is in the key)', () => {
  const page = read('app/[slug]/page.tsx');
  const start = page.indexOf('searchParams: Promise<{');
  const end = page.indexOf('}>;', start);
  const block = stripComments(page.slice(start, end));
  const keys = [...block.matchAll(/^\s*([a-z_]+)\?:/gm)].map((m) => m[1]!);
  assert.ok(keys.length > 15, `read ${keys.length} params off Props — the parse is broken`);
  const missing = keys.filter((k) => k !== 'tab' && !HUB_LIVE_PARAMS.includes(k));
  assert.deepEqual(missing, [], 'a param the page reads is not a live param — a cached copy would answer it');
});

test('§3 · the key: round trip, tamper, and a stranger’s key carries nothing of a device', async () => {
  const mac = await hubPassMac('lab-secret-0123456789abcdef0123456789', '33333333-3333-4333-8333-333333333333', 'qr1');
  assert.equal(mac.length, 22);
  assert.equal(mac, await hubPassMac('lab-secret-0123456789abcdef0123456789', '33333333-3333-4333-8333-333333333333', 'qr1'));
  assert.notEqual(mac, await hubPassMac('lab-secret-0123456789abcdef0123456789', '33333333-3333-4333-8333-333333333333', 'qr2'), 'a rotated QR names another copy');
  assert.ok(sameMac(mac, mac) && !sameMac(mac, mac.replace(/^./, mac[0] === 'A' ? 'B' : 'A')));
  const k = {
    rev: '42',
    viewer: { kind: 'guest' as const, guestId: '33333333-3333-4333-8333-333333333333', mac },
    ua: { appleTouch: true, maybeIpadSafari: false, inApp: true, os: 'ios' as const },
    tab: 'schedule',
    bust: 'm1a2b3',
  };
  const s = formatHubViewKey(k);
  assert.doesNotMatch(s, /[/?%#]/, 'the key is one path segment');
  assert.deepEqual(parseHubViewKey(s), k);
  assert.deepEqual(parseHubViewKey('v1.7.a.-.-.-'), { rev: '7', viewer: { kind: 'anonymous' }, ua: null, tab: null, bust: null });
  for (const bad of ['v1.7.a.110i.-.-', 'v2.7.a.-.-.-', 'v1.x.a.-.-.-', 'v1.7.g123.-.-.-', 'v1.7.a.-.-', `${s}.x`]) {
    assert.equal(parseHubViewKey(bad), null, `${bad} must not parse`);
  }
});

test('§3 · the route’s own address is refused from outside, and the rewrite comes before the session refresh', () => {
  assert.ok(isHubViewPath('/maria-and-jose/cached/v1.7.a.-.-.-'));
  assert.ok(!isHubViewPath('/maria-and-jose'));
  const mw = code('middleware.ts');
  const refuse = mw.indexOf('if (isHubViewPath(pathname)) return new NextResponse(');
  const rewrite = mw.indexOf('const hubView = await hubViewRewritePath(request);');
  const session = mw.indexOf('const { response, user } = await updateSession(request);');
  assert.ok(refuse > 0 && rewrite > refuse && session > rewrite, 'refuse the cached path, then rewrite, then refresh the session');
  assert.match(mw, /name: HUB_BUST_COOKIE/, "a guest's own write must give them a fresh copy");
  const visits = code('lib/visits/record-visit.ts');
  assert.match(visits, /if \(isHubViewPath\(target\)\) return request\.nextUrl\.pathname;/, 'a guest key (id + seal) must never reach the visits table');
});

test('§3 · the middleware names the viewer from the pass, and anything uncertain stays live', async () => {
  const secret = 'lab-guest-session-not-a-secret-0123456789abcdef';
  const env = { ...process.env };
  process.env.GUEST_SESSION_SECRET = secret;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'lab-service-role-not-a-secret-0123456789abcdef';
  delete process.env.HUB_CACHE_DISABLED;
  delete process.env.NEXT_PUBLIC_U_NESTING_CUTOVER;
  const EV = '22222222-0001-4000-8000-000000000001';
  const G = '33330001-0001-4000-8000-000000000001';
  let asks = 0;
  const stamp = (async (_u: string | URL | Request, init?: RequestInit) => {
    asks += 1;
    const slug = JSON.parse(String(init?.body)).p_slug;
    return new Response(JSON.stringify(slug === 'lab-public' ? [{ event_id: EV, rev: 9 }] : []), { status: 200 });
  }) as typeof fetch;
  const pass = async (eventId: string) =>
    new SignJWT({ guest_id: G, event_id: eventId, qr_token: 'qr1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode(secret));
  const req = (url: string, cookie = '') => new NextRequest(url, { headers: cookie ? { cookie } : {} });
  try {
    forgetHubStampsForTest();
    assert.equal(await hubViewRewritePath(req('http://localhost/lab-public'), stamp), '/lab-public/cached/v1.9.a.-.-.-');
    const mine = await hubViewRewritePath(req('http://localhost/lab-public?tab=schedule', `setnayan_guest_session=${await pass(EV)}`), stamp);
    const mac = await hubPassMac(secret, G, 'qr1');
    assert.equal(mine, `/lab-public/cached/v1.9.g${G.replace(/-/g, '')}${mac}.000x.schedule.-`);
    assert.equal(
      await hubViewRewritePath(req('http://localhost/lab-public', `setnayan_guest_session=${await pass('22222222-0001-4000-8000-0000000000ff')}`), stamp),
      null,
      "another event's pass is the live page's to decide",
    );
    assert.equal(await hubViewRewritePath(req('http://localhost/some-shop'), stamp), null, 'not an event → the live route (a shop, a 404)');
    assert.equal(
      await hubViewRewritePath(req('http://localhost/lab-public'), (async () => new Response('', { status: 503 })) as unknown as typeof fetch),
      '/lab-public/cached/v1.9.a.-.-.-',
      'within the memo window the stamp is not asked again',
    );
    const before = asks;
    await hubViewRewritePath(req('http://localhost/lab-public'), stamp);
    assert.equal(asks, before, 'a venue of phones within a few seconds costs ONE stamp read');
    forgetHubStampsForTest();
    assert.equal(
      await hubViewRewritePath(req('http://localhost/lab-public'), (async () => new Response('', { status: 503 })) as unknown as typeof fetch),
      null,
      'a refused stamp read → the live render, never a guess',
    );
    process.env.HUB_CACHE_DISABLED = '1';
    assert.equal(await hubViewRewritePath(req('http://localhost/lab-public'), stamp), null, 'the off switch');
  } finally {
    process.env = env;
    forgetHubStampsForTest();
  }
});

// ── § 4 · timers and sockets under app/[slug]/** ─────────────────────────────────────────────────────────────────

/**
 * Every timer under the guest tree, per file, with what it costs. `network: true` = it asks the server. The two the
 * owner's ruling names first: the hub's 45 s fallback tick and the 25 s wall poll.
 */
const TIMERS: Record<string, { count: number; network: boolean; why: string }> = {
  'app/[slug]/_components/hub/hub-shell.tsx': {
    count: 2,
    network: true,
    why: 'THE HUB TICK — `useEventPulse` asks the shared, CDN-held /live-pulse (~12 s, visible only) and redraws only on a change; `useDayOfLiveTick` (45 s, visible only) only when the render had no pulse baseline',
  },
  'app/[slug]/_components/live-wall-block.tsx': {
    count: 2,
    network: true,
    why: 'THE WALL POLL — /live-wall, one remembered answer per event + 5 s CDN, every 25 s ± 20 % while visible, ×2…×8 after misses, stops for good on a 404; plus a 1 s clock for "n s ago" (no network)',
  },
  'app/[slug]/_components/day-of-announcement.tsx': {
    count: 1,
    network: true,
    why: 'the announcement — /{slug}/announcement every 30 s ± 20 % while visible, ×2… to 5 min after misses (no socket)',
  },
  'app/[slug]/find-seat/_components/name-search.tsx': {
    count: 2,
    network: true,
    why: 'the seat finder re-asks on a pulse change (fallback 45 s, visible only)',
  },
  'app/[slug]/_components/countdown.tsx': { count: 1, network: false, why: 'a 1 s countdown clock' },
  'app/[slug]/_components/hub-scrub-engine.ts': { count: 1, network: false, why: 'the scrub animation’s pulse' },
  'app/[slug]/_components/reply-panel.tsx': { count: 1, network: false, why: 'watches the side panel’s frame (150 ms, no network)' },
  'app/[slug]/_components/schedule-widget.tsx': { count: 1, network: false, why: 'a 30 s wall clock for "now"' },
  'app/[slug]/_components/watch-live-embed.tsx': {
    count: 1,
    network: true,
    why: 'the watch link — /api/live/[slug]/watch, remembered per event + CDN-held, skipped while hidden',
  },
  'app/[slug]/venue/_components/use-live-scene.ts': {
    count: 1,
    network: true,
    why: 'the venue’s live 3D scene state, while the venue page is visible',
  },
};
const TIMER = /\bsetInterval\(|\buseVisibleTick\(|\buseDayOfLiveTick\(|\buseEventPulse\(|\bjittered\(/g;
const SOCKET = /\.channel\(|postgres_changes|\.subscribe\(\s*\(?status/;

function guestTreeSources(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
  };
  walk(abs('app/[slug]'));
  return out;
}

test('§4 · no Realtime channel anywhere under app/[slug]/** — guests hold no live connection', () => {
  const sockets = guestTreeSources().filter((f) => SOCKET.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(sockets, [], 'a guest page opened a Realtime channel (owner 2026-10-28: guests never hold a live connection)');
});

test('§4 · every timer under app/[slug]/** is on the list, with its count and reason', () => {
  const found: Record<string, number> = {};
  for (const f of guestTreeSources()) {
    const n = (stripComments(fs.readFileSync(f, 'utf8')).match(TIMER) ?? []).length;
    if (n) found[rel(f)] = n;
  }
  const listed = Object.fromEntries(Object.entries(TIMERS).map(([k, v]) => [k, v.count]));
  assert.deepEqual(found, listed, 'a timer was added, removed or moved under app/[slug]/** — list it in TIMERS with its reason (and whether it asks the server)');
  for (const [file, t] of Object.entries(TIMERS)) assert.ok(t.why.length > 20, `${file}: say why`);
});

test('§4 · the guests’ run of show polls a shared answer; only the event’s workers subscribe', () => {
  const header = code('app/_components/run-of-show-header.tsx');
  const guard = header.indexOf('if (forGuests) return;');
  const channel = header.indexOf('.channel(`run-of-show-');
  assert.ok(guard > 0 && channel > guard, 'a guest’s header opens the socket again');
  assert.match(header, /fetch\(`\/api\/live\/run-of-show\/\$\{encodeURIComponent\(eventId\)\}`\)/);
  assert.match(header, /document\.visibilityState !== 'visible'/);
  const route = code('app/api/live/run-of-show/[eventId]/route.ts');
  assert.match(route, /rememberedLiveRead\(`run-of-show-guests-v\d+:\$\{eventId\}`/, 'one read per event, not per phone');
  assert.match(route, /onlyWhatGuestsMaySee\(read\)/, 'the guests’ fence');
  assert.doesNotMatch(route, /createAdminClient\(\)\s*\.from\('event_schedule_blocks'\)/, 'never the service role for the lines themselves');
});

test('§4 · the announcement: no socket, one remembered answer, the gate per phone', () => {
  const card = code('app/[slug]/_components/day-of-announcement.tsx');
  assert.doesNotMatch(card, SOCKET);
  assert.match(card, /fetch\(`\/\$\{encodeURIComponent\(slug\)\}\/announcement`\)/);
  assert.match(card, /if \(document\.visibilityState !== 'visible'\) return;/, 'a pocketed phone must ask nothing');
  const server = code('app/[slug]/_lib/latest-announcement.server.ts');
  assert.match(server, /rememberedLiveRead<[^>]*>\(\s*`announcement-v\d+:\$\{eventId\}`/);
  const route = code('app/[slug]/announcement/route.ts');
  const gate = route.indexOf('holdsThisEventsCurrentPass(event.event_id)');
  const words = route.indexOf('latestAnnouncementFor(event.event_id)');
  assert.ok(gate > 0 && words > gate, 'the gate must be asked before the words are read');
  assert.match(route, /headers: NOT_HELD/, 'a per-pass answer must never be held by a cache');
  const writer = code('app/dashboard/[eventId]/_actions/day-of-broadcast.ts');
  assert.match(writer, /revalidateTag\(liveDayTag\(eventId\)\)/, 'the send must clear the remembered words and the cached hub');
});
