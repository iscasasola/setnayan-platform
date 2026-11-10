/**
 * THE SHOP PAGE STAYS CACHEABLE — AND EVERY SAVE THAT CHANGES A SHOP CLEARS ITS COPY (speed, 2026-11-10).
 *
 * `app/v/[slug]/page.tsx` is `force-dynamic` (it reads the session, the demo cookie and the query), so every open of
 * every shop was a full server render over ~90 tables. A stranger's open is now answered from a cached copy
 * (`app/v/[slug]/cached/page.tsx`, the EV1 hub's shape — `lib/shop-view.ts`). Same lesson as the hub's own guard
 * (`lib/the-guest-hub-stays-cacheable.test.ts`): ONE request read anywhere in the copy's tree makes Next render it per
 * request again — or fail it mid-ISR — and nothing says so. So:
 *   § 1 · the cached route reads nothing from the request, and every request read its tree reaches asks
 *         `onTheCachedHub()` first (or is on the list below with the reason it never runs there);
 *   § 2 · inside a render of the cached route, the readers it reaches answer without touching the request;
 *   § 3 · what the middleware lets into the cache (`shopRequestShape`) and the order it does it in;
 *   § 4 · a cached copy still counts every open (the beacon), and the live render still counts with after();
 *   § 5 · every save (a Server Action or a supplier route handler) that writes a table the shop page draws from calls
 *         `revalidateShopPage` — or is listed with the reason it changes nothing a stranger's copy shows.
 *
 * Run: npx tsx --test lib/the-shop-page-stays-cacheable.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import ts from 'typescript';
import { stripComments } from './strip-comments';
import { WEB_ROOT, resolveImport } from './rsc-function-props';
import {
  SHOP_BEACON_PARAMS,
  SHOP_LIVE_PARAMS,
  SHOP_VIEW_SEGMENT,
  isShopViewPath,
  shopPageTag,
  shopRequestShape,
  shopSlugTag,
} from './shop-view';
import { HUB_LIVE_COOKIES } from './hub-view-key';
import { DEMO_MODE_COOKIE_NAME } from './demo-mode-constants';

/* ── `server-only` shim + AsyncLocalStorage (the shape of lib/the-cached-hub-reads-no-cookie-before-its-viewer.test.ts) */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const SERVER_ONLY_STUB = path.join(process.cwd(), '__server_only_stub_cached_shop__.js');
{
  const stub = new CjsModule(SERVER_ONLY_STUB);
  stub.filename = SERVER_ONLY_STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[SERVER_ONLY_STUB] = stub;
  const originalResolve = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return SERVER_ONLY_STUB;
    return originalResolve.call(this, request, ...rest);
  };
}
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:9';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'lab-anon-not-a-key';
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= (nodeRequire('node:async_hooks') as typeof import('node:async_hooks')).AsyncLocalStorage;

const rel = (abs: string) => path.relative(WEB_ROOT, abs).split(path.sep).join('/');
const abs = (p: string) => path.join(WEB_ROOT, p);
const read = (p: string) => fs.readFileSync(abs(p), 'utf8');
const code = (p: string) => stripComments(read(p));

const CACHED_ROUTE = 'app/v/[slug]/cached/page.tsx';
const SHOP_PAGE = 'app/v/[slug]/page.tsx';

// ── § 1 · the cached route reads nothing from the request ────────────────────────────────────────────────────────

/** Request reads the copy's tree reaches that are NOT behind `onTheCachedHub()`, with the reason they never run there. */
const NEVER_ON_THE_CACHED_SHOP: Record<string, string> = {};

const REQUEST_READ = /\bcookies\(\)|\bheaders\(\)|\bdraftMode\(\)|\bconnection\(\)|\bunstable_noStore\(|\bnoStore\(\)|\bcache:\s*['"]no-store['"]|\brevalidate:\s*0\b/g;

function directive(src: string): 'client' | 'server' | null {
  const m = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(['"])use (client|server)\1/.exec(src);
  return m ? (m[2] as 'client' | 'server') : null;
}

function importsOf(file: string, src: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && !st.importClause?.isTypeOnly) out.push(st.moduleSpecifier.text);
    if (ts.isExportDeclaration(st) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier) && !st.isTypeOnly) out.push(st.moduleSpecifier.text);
  }
  for (const m of src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]!);
  return out;
}

/** Every server module the cached shop route reaches (no `'use client'` crossing; `'use server'` modules render nothing). */
function cachedShopTree(): string[] {
  const seen = new Set<string>();
  const stack = [abs(CACHED_ROUTE)];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, 'utf8');
    if (directive(src)) continue;
    for (const spec of importsOf(f, src)) {
      const r = resolveImport(f, spec);
      if (!r || !/\.tsx?$/.test(r)) continue;
      stack.push(r);
    }
  }
  return [...seen].filter((f) => directive(fs.readFileSync(f, 'utf8')) === null);
}

function declName(st: ts.Node | null): string | null {
  if (!st) return null;
  if (ts.isFunctionDeclaration(st) && st.name) return st.name.text;
  if (ts.isVariableStatement(st)) {
    const d = st.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name)) return d.name.text;
  }
  return null;
}

function enclosingTopLevel(sf: ts.SourceFile, index: number): ts.Node | null {
  for (const st of sf.statements) if (st.getStart() <= index && index < st.getEnd()) return st;
  return null;
}

test('§1 · the cached shop route reads nothing from the request but its own address', () => {
  const route = code(CACHED_ROUTE);
  assert.match(route, /export const revalidate = \d+;/, 'the route must declare its ISR window as a literal');
  assert.match(route, /export function generateStaticParams\(/, 'without generateStaticParams the route renders per request');
  assert.doesNotMatch(route, /export const dynamic\s*=/, 'a dynamic switch on the cached route defeats it');
  assert.doesNotMatch(route, REQUEST_READ, 'a request read on the cached route makes it render per request');
  assert.doesNotMatch(route, /searchParams\s*\}|props\.searchParams|await searchParams/, 'the cached route must never read the query');
  assert.match(route, /renderVendorBySlug\(\{ slug, searchParams: Promise\.resolve\(\{\}\), cachedCopy: true \}\)/);
  assert.match(route, /await wearShopPageTags\(\{ slug \}\)/, "the copy must wear its address's tag (a 404 copy clears when the shop opens)");
  // The body wears the SHOP's tag before any gate can 404 it.
  const page = code(SHOP_PAGE);
  const wear = page.indexOf('if (cachedCopy) await wearShopPageTags({ vendorProfileId: vendor.vendor_profile_id });');
  const gate = page.indexOf('const publicGate = shopPageGate(');
  assert.ok(wear > 0 && gate > wear, "the shop's tag must be worn before the visibility gate can answer 404");
});

test('§1 · every request read the cached shop can reach asks `onTheCachedHub()` first, or is listed with its reason', () => {
  const tree = cachedShopTree();
  assert.ok(tree.length > 150, `the walk reached only ${tree.length} modules — it is not walking the shop page`);
  const unexplained: string[] = [];
  const used = new Set<string>();
  for (const f of tree) {
    const clean = stripComments(fs.readFileSync(f, 'utf8'));
    REQUEST_READ.lastIndex = 0;
    if (!REQUEST_READ.test(clean)) continue;
    // 🪤 `test` on a /g regex moves lastIndex, and `matchAll` starts from it — reset, or the FIRST read is skipped.
    REQUEST_READ.lastIndex = 0;
    const sf = ts.createSourceFile(f, clean, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    for (const m of clean.matchAll(REQUEST_READ)) {
      const at = m.index!;
      const stmt = enclosingTopLevel(sf, at);
      const before = stmt ? clean.slice(stmt.getStart(), at) : '';
      if (/onTheCachedHub\(\)/.test(before)) continue;
      const lineStart = clean.lastIndexOf('\n', at) + 1;
      const line = clean.slice(lineStart, clean.indexOf('\n', at)).trim();
      const name = declName(stmt);
      const key = Object.keys(NEVER_ON_THE_CACHED_SHOP).find((k) => {
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
    'a request read the cached shop page can reach — ask `onTheCachedHub()` first (lib/hub-request.ts), or list it in ' +
      'NEVER_ON_THE_CACHED_SHOP with the reason it never runs there. Otherwise Next renders every stranger per request again.',
  );
  assert.deepEqual(Object.keys(NEVER_ON_THE_CACHED_SHOP).filter((k) => !used.has(k)), [], 'listed reads that no longer exist');
});

// ── § 2 · inside a render of the cached route, the readers answer without the request ───────────────────────────

const { workAsyncStorage } = nodeRequire('next/dist/server/app-render/work-async-storage.external') as typeof import('next/dist/server/app-render/work-async-storage.external');
const { CACHED_SHOP_ROUTE, onTheCachedHub } = nodeRequire('./hub-request') as typeof import('./hub-request');
const { cookies } = nodeRequire('next/headers') as typeof import('next/headers');
const { getCurrentUser } = nodeRequire('./auth') as typeof import('./auth');
const { createClient } = nodeRequire('./supabase/server') as typeof import('./supabase/server');

async function inRender<T>(route: string, run: () => Promise<T>): Promise<{ value: T; touched: boolean }> {
  const asked: string[] = [];
  const store = new Proxy(
    { route, forceStatic: true },
    {
      get(target, prop) {
        if (prop !== 'route' && typeof prop === 'string') asked.push(prop);
        return Reflect.get(target, prop);
      },
    },
  );
  const value = await workAsyncStorage.run(store as never, run);
  return { value, touched: asked.includes('forceStatic') };
}

test('§2 · the route id is the one Next gives the cached shop page', () => {
  const { normalizeAppPath } = nodeRequire('next/dist/shared/lib/router/utils/app-paths') as { normalizeAppPath: (p: string) => string };
  assert.equal(CACHED_SHOP_ROUTE, normalizeAppPath('/v/[slug]/cached/page'));
  assert.equal(`app${CACHED_SHOP_ROUTE}/page.tsx`, CACHED_ROUTE);
});

test('§2 · the probe can hit, and the cached shop is known from the first moment of its render', async () => {
  assert.ok((await inRender(CACHED_SHOP_ROUTE, async () => (await cookies()).getAll())).touched, 'the probe saw nothing');
  assert.equal((await inRender('/v/[slug]', async () => onTheCachedHub())).value, false, 'the live shop page is not the cached one');
  assert.equal((await inRender(CACHED_SHOP_ROUTE, async () => onTheCachedHub())).value, true);
});

for (const [name, run] of Object.entries({
  'the account (getCurrentUser)': () => getCurrentUser(),
  'the cookie-scoped Supabase client (createClient)': () => createClient(),
}) as Array<[string, () => Promise<unknown>]>) {
  test(`§2 · on the cached shop, ${name} reads nothing from the request`, async () => {
    const { touched } = await inRender(CACHED_SHOP_ROUTE, async () => {
      try {
        await run();
      } catch {
        /* a refusal is fine; touching the request is not */
      }
    });
    assert.equal(touched, false, `${name} read the request on the cached shop — every stranger's open would render live again`);
  });
}

// ── § 3 · the middleware's half ──────────────────────────────────────────────────────────────────────────────────

const shape = (over: Partial<Parameters<typeof shopRequestShape>[0]> = {}) =>
  shopRequestShape({
    method: 'GET',
    pathname: '/v/setnaprod',
    searchParams: new URLSearchParams(),
    cookieNames: [],
    clientTypeCookie: null,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1',
    isServerAction: false,
    ...over,
  });

test('§3 · only a request the live render would draw identically for anybody is let into the cache', () => {
  assert.deepEqual(shape(), { slug: 'setnaprod' });
  assert.deepEqual(shape({ pathname: '/v/setnaprod/' }), { slug: 'setnaprod' });
  assert.deepEqual(shape({ searchParams: new URLSearchParams('utm_source=fb&fbclid=x') }), { slug: 'setnaprod' }, 'campaign tags draw nothing');
  for (const p of SHOP_LIVE_PARAMS) assert.equal(shape({ searchParams: new URLSearchParams(`${p}=1`) }), null, `?${p}= must keep the live render`);
  assert.equal(shape({ searchParams: new URLSearchParams('demo=1') }), null, "the middleware's own demo flag");
  assert.equal(shape({ cookieNames: ['sb-abc-auth-token'] }), null, 'a signed-in account keeps the live render');
  assert.equal(shape({ cookieNames: ['sb-abc-auth-token.0'] }), null, 'a chunked session too');
  assert.ok(HUB_LIVE_COOKIES.includes(DEMO_MODE_COOKIE_NAME));
  assert.equal(shape({ cookieNames: [DEMO_MODE_COOKIE_NAME] }), null, "an admin's demo mode keeps the live render (isAdminInDemoMode)");
  assert.equal(shape({ clientTypeCookie: 'capacitor' }), null, 'the store app keeps the live render');
  assert.equal(shape({ clientTypeCookie: 'tauri' }), null, 'the desktop app keeps the live render');
  assert.equal(shape({ userAgent: 'Mozilla/5.0 SetnayanApp/ios' }), null);
  assert.equal(shape({ method: 'POST' }), null, 'a plain POST is not a page read');
  assert.deepEqual(shape({ method: 'POST', isServerAction: true }), { slug: 'setnaprod' }, 'an action keeps its page’s route');
  for (const p of ['/v/setnaprod/booth', '/v/setnaprod/review', '/v/setnaprod/dates', '/setnaprod', '/v/', '/v/a/b'])
    assert.equal(shape({ pathname: p }), null, `${p} is not the shop page`);
});

test('§3 · every query the shop page reads is a live param or a beacon param', () => {
  const page = code(SHOP_PAGE);
  const body = page.slice(page.indexOf('export async function renderVendorBySlug('));
  const reads = new Set([...body.matchAll(/\bsearch\??\.([a-zA-Z_]+)/g)].map((m) => m[1]!));
  assert.ok(reads.size >= 8, `read ${reads.size} params off the page — the parse is broken`);
  const unknown = [...reads].filter((k) => !SHOP_LIVE_PARAMS.includes(k) && !SHOP_BEACON_PARAMS.includes(k));
  assert.deepEqual(unknown, [], 'a param the page reads would be answered from a stranger’s cached copy — add it to SHOP_LIVE_PARAMS');
  // The beacon params draw nothing: their only reader is the view's attribution.
  for (const p of SHOP_BEACON_PARAMS) {
    const uses = [...body.matchAll(new RegExp(`\\bsearch\\??\\.${p}\\b`, 'g'))].map((m) => m.index!);
    const attribution = body.indexOf('const utmParam =');
    const end = body.indexOf("const viewSource = search.src ?? 'profile_direct';");
    for (const at of uses) assert.ok(at > attribution && at < end, `?${p}= is read outside the view's attribution — it is a live param`);
  }
});

test('§3 · the route’s own address is refused from outside, and the rewrite comes before the session refresh', () => {
  assert.ok(isShopViewPath('/v/setnaprod/cached'));
  assert.ok(!isShopViewPath('/v/setnaprod'));
  assert.equal(SHOP_VIEW_SEGMENT, 'cached');
  const mw = code('middleware.ts');
  const refuse = mw.indexOf("if (isShopViewPath(pathname) && process.env.HUB_VIEW_LAB_DIRECT !== '1') return new NextResponse(");
  const rewrite = mw.indexOf('const shopView = envFlagEnabled(process.env.SHOP_CACHE_DISABLED)');
  const session = mw.indexOf('const { response, user } = await updateSession(request);');
  assert.ok(refuse > 0 && rewrite > refuse && session > rewrite, 'refuse the cached path, then rewrite, then refresh the session');
  assert.match(mw, /rewrite\.pathname = `\/v\/\$\{shopView\.slug\}\/\$\{SHOP_VIEW_SEGMENT\}`;/);
  const visits = code('lib/visits/record-visit.ts');
  assert.match(visits, /if \(isShopViewPath\(target\)\) return request\.nextUrl\.pathname;/, 'a cached open is still counted as /v/{slug}');
  assert.equal(shopPageTag('x'), 'shop-page:x');
  assert.equal(shopSlugTag('SetnaProd'), 'shop-page-slug:setnaprod');
});

// ── § 4 · every open is still counted ────────────────────────────────────────────────────────────────────────────

test('§4 · the live render counts with after(); a cached copy counts each open with the beacon', () => {
  const page = code(SHOP_PAGE);
  assert.match(page, /if \(!cachedCopy\) \{\s*after\(\(\) =>\s*recordVendorProfileView\(/, 'the live render keeps its after() count');
  assert.match(page, /const countViewInBrowser = cachedCopy && !isDemoVendor && teamPreview === null;/);
  assert.match(page, /\{countViewInBrowser \? <ShopViewBeacon vendorProfileId=\{vendor\.vendor_profile_id\} \/> : null\}/);
  const beacon = code('app/v/[slug]/_components/shop-view-beacon.tsx');
  assert.match(beacon, /^\s*'use client';/);
  assert.match(beacon, /recordVendorProfileView\(\{ vendorProfileId, source: 'profile_direct', utm, eventId: null \}\)/);
  assert.doesNotMatch(beacon, /return \(|<[a-z]/, 'the beacon draws nothing');
});

// ── § 5 · every save that changes a shop clears its copy ─────────────────────────────────────────────────────────

/**
 * Entry points (`file :: function`) that write a table the shop page reads but change nothing a stranger's copy draws,
 * with the reason. Everything else that writes one MUST reach `revalidateShopPage`.
 */
const NOT_A_SHOP_SAVE: Record<string, string> = {
  'app/admin/vendor-partnerships/actions.ts :: createPartnershipHq':
    "a PROPOSAL (status 'proposed') — no shop shows it until the recommended shop accepts (`respondToPartnership`, which revalidates)",
  'app/admin/spotlight-awards/actions.ts :: toggleHomepageFeatured':
    "the homepage strip's own flag — the shop page names a shop's awards (`fetchVendorCurrentAwards` reads `award_type`), not whether `/` features them",
  'app/admin/reviews/actions.ts :: dismissReviewFlag':
    "a flag is the admin queue's — the shop page draws no flag (lib/reviews.ts only INSERTS them); the action's guest-review hide/show branch clears the shop's copy inside `setGuestReviewHidden` (lib/guest-reviews.ts)",
  'app/api/vendor/papic-capture/route.ts :: POST':
    "the event-day camera's raw captures, one write per photo during an event — a shop page shows the portfolio photos a supplier IMPORTS (`papic-portfolio-import`, which revalidates); the copy's 60 s window covers the rest",
};

/** Every table the shop page tree reads (`.from('…')`), restricted to the shop's own `vendor_*` tables. */
function shopTables(): Set<string> {
  const out = new Set<string>();
  for (const f of cachedShopTree()) {
    for (const m of stripComments(fs.readFileSync(f, 'utf8')).matchAll(/\.from\(\s*['"](vendor_[a-z_0-9]+)['"]/g)) out.add(m[1]!);
  }
  return out;
}

const WRITE = (tables: Set<string>) =>
  new RegExp(`\\.from\\(\\s*['"](${[...tables].join('|')})['"]\\s*\\)(?=(?:(?!\\.from\\()[\\s\\S]){0,600}?\\.(?:insert|update|upsert|delete)\\()`, 'g');

type Fn = { name: string; exported: boolean; body: string };

function topLevelFunctions(file: string, src: string): Fn[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Fn[] = [];
  for (const st of sf.statements) {
    const exported = !!(ts.canHaveModifiers(st) && ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
    if (ts.isFunctionDeclaration(st) && st.name) out.push({ name: st.name.text, exported, body: src.slice(st.getStart(), st.getEnd()) });
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer) || ts.isCallExpression(d.initializer)))
          out.push({ name: d.name.text, exported, body: src.slice(st.getStart(), st.getEnd()) });
      }
    }
  }
  return out;
}

/** Does `fn` (or a same-file function it calls, transitively) match `re`? */
function reaches(fns: Map<string, Fn>, start: string, re: RegExp): boolean {
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    const f = fns.get(n)!;
    re.lastIndex = 0;
    if (re.test(f.body)) return true;
    for (const other of fns.keys()) if (other !== n && new RegExp(`\\b${other}\\(`).test(f.body)) stack.push(other);
  }
  return false;
}

test('§5 · every save that writes what a shop page draws calls revalidateShopPage, or says why it need not', () => {
  const tables = shopTables();
  assert.ok(tables.has('vendor_profiles') && tables.has('vendor_services') && tables.has('vendor_packages'), 'the table walk is broken');
  const files = execSync(
    `grep -rlE "^['\\"]use server['\\"]" app lib --include='*.ts' --include='*.tsx'; find app/api/vendor -name 'route.ts'`,
    { cwd: WEB_ROOT, encoding: 'utf8' },
  )
    .trim()
    .split('\n')
    .filter((f) => f && !f.includes('.test.'));
  assert.ok(files.length > 100, `found ${files.length} save modules — the scan is broken`);
  const missing: string[] = [];
  const used = new Set<string>();
  let checked = 0;
  for (const f of files) {
    const src = stripComments(read(f));
    const fns = new Map(topLevelFunctions(f, src).map((x) => [x.name, x]));
    for (const fn of fns.values()) {
      if (!fn.exported) continue;
      if (!reaches(fns, fn.name, WRITE(tables))) continue;
      checked++;
      const key = `${f} :: ${fn.name}`;
      if (NOT_A_SHOP_SAVE[key]) {
        used.add(key);
        continue;
      }
      if (!reaches(fns, fn.name, /\brevalidate(?:ShopPage|AllShopPages)\(/g)) missing.push(key);
    }
  }
  assert.ok(checked > 60, `only ${checked} saves write a shop table — the scan is broken`);
  assert.deepEqual(
    missing,
    [],
    "a save writes what a shop's public page draws and never clears the shop's cached copy — strangers would see the " +
      'old page until the 60 s window passes. Call `revalidateShopPage(<vendor_profile_id>)` (lib/shop-page-cache.ts) ' +
      'after the write, or list it in NOT_A_SHOP_SAVE with the reason no stranger can see the change.',
  );
  assert.deepEqual(Object.keys(NOT_A_SHOP_SAVE).filter((k) => !used.has(k)), [], 'listed saves that no longer write a shop table');
});
