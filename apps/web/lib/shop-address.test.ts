/**
 * shop-address.test.ts — A SHOP LIVES AT `/{shop}` (the address move, PR 1 · owner 2026-11-15, specs DECISION_LOG
 * d7910b5d, map `ADDRESS_MOVE_MAP_2026-11-15_fable.md`).
 *
 * Held here, each with the regression it stops:
 *   1. every redirect pair — `/v/{shop}[/sub]` → `/{shop}[/sub]` (307), `/vendor-invite/{shop}` → `/{shop}/invite` (308);
 *   2. the bare shop sub-pages render from the route files under `/v/` (internal rewrite), never for a reserved word;
 *   3. the middleware wires them: GET/HEAD only for the 307, the query is kept, the cached copy is never redirected;
 *   4. 🛑 THE OWNER'S HARD RULE: `/cale-ice` and `/maria-and-jose` (events) are never treated as a shop — no redirect,
 *      no sub-page rewrite, and the bare-word shop copy is refused for any word whose stamp names an event, or whose
 *      stamp read failed;
 *   5. no file builds a `/v/${…}` link by hand any more — every shop link goes through `shopPath`.
 *
 * MUTATIONS (each turns this red): change the 307 to 308 or drop the GET/HEAD check in middleware.ts; make
 * `legacyShopRedirect` match `/v/x/cached`; make `bareWordIsNoEvent` return true on an unread stamp; delete the
 * `reserved` check in `shopSubPageRewrite`; type `` `/v/${slug}` `` into any lib/ or app/ file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';

import {
  SHOP_SUB_PAGES,
  legacyShopInviteRedirect,
  legacyShopRedirect,
  shopInvitePath,
  shopPath,
  shopSubPageRewrite,
} from './shop-address';
import { RESERVED_SLUGS } from './reserved-slugs';
import { bareWordIsNoEvent, forgetHubStampsForTest } from './hub-view-route';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const reserved = (w: string) => RESERVED_SLUGS.has(w);

test('1 · /v/{shop} and its sub-pages redirect to the bare address — nothing else under /v/ does', () => {
  const pairs: Array<[string, string | null]> = [
    ['/v/titanena', '/titanena'],
    ['/v/titanena/', '/titanena'],
    ['/v/titanena/dates', '/titanena/dates'],
    ['/v/titanena/booth', '/titanena/booth'],
    ['/v/titanena/review', '/titanena/review'],
    ['/v/titanena/guest-review', '/titanena/guest-review'],
    ['/v/titanena/cached', null], // the internal cached copy — never addressed, never redirected
    ['/v/titanena/story/our-day', null], // a sub-page the move has not given a bare form
    ['/v/', null],
    ['/vendors/titanena', null],
  ];
  for (const [from, to] of pairs) assert.equal(legacyShopRedirect(from), to, from);
  assert.deepEqual([...SHOP_SUB_PAGES], ['dates', 'booth', 'review', 'guest-review']);
});

test('1b · /vendor-invite/{shop} → /{shop}/invite, and the builders name the new door', () => {
  assert.equal(legacyShopInviteRedirect('/vendor-invite/titanena'), '/titanena/invite');
  assert.equal(legacyShopInviteRedirect('/vendor-invite/titanena/'), '/titanena/invite');
  assert.equal(legacyShopInviteRedirect('/vendor-invite/'), null);
  assert.equal(legacyShopInviteRedirect('/vendor-invite/a/b'), null);
  assert.equal(shopInvitePath('titanena'), '/titanena/invite');
  assert.equal(shopPath('titanena', '/dates?src=own'), '/titanena/dates?src=own');
  assert.match(read('lib/vendor-couple-invite.ts'), /\$\{shopInvitePath\(slug\)\}/, 'the shop QR builds /{shop}/invite');
  for (const f of ['app/vendor-invite/[slug]/page.tsx', 'app/vendor-invite/[slug]/actions.ts']) {
    assert.doesNotMatch(read(f), /`\/vendor-invite\//, `${f} still sends people to the old invite address`);
  }
});

test('2 · a bare shop sub-page renders from /v/, never for a reserved word', () => {
  assert.equal(shopSubPageRewrite('/titanena/dates', reserved), '/v/titanena/dates');
  assert.equal(shopSubPageRewrite('/titanena/guest-review', reserved), '/v/titanena/guest-review');
  assert.equal(shopSubPageRewrite('/titanena', reserved), null);
  assert.equal(shopSubPageRewrite('/titanena/invite', reserved), null, 'the invite door is app/[slug]/invite — the word decides');
  for (const w of ['admin', 'dashboard', 'vendor-dashboard', 'api', 'v', 'u']) {
    assert.ok(reserved(w), `${w} must be reserved`);
    assert.equal(shopSubPageRewrite(`/${w}/review`, reserved), null, `/${w}/review must not become a shop page`);
  }
});

test('3 · the middleware wires the move: 307 on reads only, 308 for the invite, query kept, the copy gated', () => {
  const mw = read('middleware.ts');
  assert.match(
    mw,
    /if \(\(request\.method === 'GET' \|\| request\.method === 'HEAD'\) && pathname\.startsWith\('\/v\/'\)\) \{\s*const bare = legacyShopRedirect\(pathname\);\s*if \(bare\) return NextResponse\.redirect\(new URL\(`\$\{bare\}\$\{search\}`, request\.url\), 307\);/,
    '/v/{shop} must 307 (the map: a 308 comes later) on GET/HEAD only — a Server Action POST is never redirected',
  );
  assert.match(
    mw,
    /const invite = legacyShopInviteRedirect\(pathname\);\s*if \(invite\) return NextResponse\.redirect\(new URL\(`\$\{invite\}\$\{search\}`, request\.url\), 308\);/,
    '/vendor-invite/{shop} must 308 with its query (et, cat)',
  );
  assert.match(mw, /shopSubPageRewrite\(pathname, \(w\) => RESERVED_SLUGS\.has\(w\)\)/);
  assert.match(mw, /if \(bareShop && \(await bareWordIsNoEvent\(request\)\)\)/, 'the bare shop copy only for a word that is clearly no event');
  // The redirects run AFTER the subdomain / custom-domain rewrites returned (they target /v/ internally).
  const sub = mw.indexOf('detectVendorSubdomain(hostname)');
  const moved = mw.indexOf('const bare = legacyShopRedirect(pathname)');
  assert.ok(sub > 0 && moved > sub, 'the /v/ redirect must sit below the subdomain rewrite');
  // The cached shop copy's own address still 404s from outside.
  assert.match(mw, /if \(isShopViewPath\(pathname\) && process\.env\.HUB_VIEW_LAB_DIRECT !== '1'\) return new NextResponse\('Not found', \{ status: 404 \}\);/);
});

test('4 · 🛑 /cale-ice and /maria-and-jose stay events: never redirected, never rewritten, never the shop copy', async () => {
  for (const word of ['cale-ice', 'maria-and-jose']) {
    assert.equal(legacyShopRedirect(`/${word}`), null);
    assert.equal(shopSubPageRewrite(`/${word}`, reserved), null);
    assert.equal(shopSubPageRewrite(`/${word}/invite`, reserved), null, 'the guest invite stays the event invite');
  }
  const env = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:9';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'lab-service-role-not-a-secret-0123456789abcdef';
  delete process.env.NEXT_PUBLIC_U_NESTING_CUTOVER;
  const EVENTS = new Set(['cale-ice', 'maria-and-jose']);
  const stamp = (async (_u: string | URL | Request, init?: RequestInit) => {
    const slug = JSON.parse(String(init?.body)).p_slug as string;
    if (slug === 'flaky') return new Response('boom', { status: 503 });
    return new Response(JSON.stringify(EVENTS.has(slug) ? [{ event_id: '22222222-0001-4000-8000-000000000001', rev: 3 }] : []), { status: 200 });
  }) as typeof fetch;
  const req = (url: string, cookie = '') => new NextRequest(url, { headers: cookie ? { cookie } : {} });
  try {
    forgetHubStampsForTest();
    assert.equal(await bareWordIsNoEvent(req('http://localhost/cale-ice'), stamp), false, '/cale-ice is an event — the live hub, never the shop copy');
    assert.equal(await bareWordIsNoEvent(req('http://localhost/maria-and-jose'), stamp), false, '/maria-and-jose is an event');
    assert.equal(await bareWordIsNoEvent(req('http://localhost/Cale-Ice'), stamp), false, 'a capital letter does not make it a shop');
    assert.equal(await bareWordIsNoEvent(req('http://localhost/flaky'), stamp), false, 'an unread stamp is NOT "no event"');
    assert.equal(await bareWordIsNoEvent(req('http://localhost/login'), stamp), false, 'a reserved word is never a shop copy');
    assert.equal(await bareWordIsNoEvent(req('http://localhost/titanena'), stamp), true, 'a word no event has may be answered from the shop copy');
  } finally {
    process.env = env;
    forgetHubStampsForTest();
  }
});

test('5 · no file builds a /v/ shop link by hand — every one goes through shopPath', () => {
  const ALLOWED = new Set([
    'lib/shop-address.ts', // the rewrite target itself
    'middleware.ts', // the cached copy and the subdomain / custom-domain rewrites (internal)
    'lib/shop-view.ts', // the cached copy's own address
    'lib/custom-domain-resolve.ts', // the custom-domain rewrite target (internal)
  ]);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|mjs)$/.test(n) && !/\.test\.(tsx?|mjs)$/.test(n)) files.push(p);
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  files.push(join(WEB, 'middleware.ts'));
  assert.ok(files.length > 2000, `only ${files.length} files walked — the scan is blind`);
  const offenders: string[] = [];
  for (const f of files) {
    const r = relative(WEB, f).split(sep).join('/');
    if (ALLOWED.has(r)) continue;
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/`\/v\/\$\{/g)) offenders.push(`${r}:${text.slice(0, m.index).split('\n').length}`);
  }
  assert.deepEqual(offenders, [], `build shop links with shopPath (lib/shop-address.ts):\n  ${offenders.join('\n  ')}`);
});
