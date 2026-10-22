/**
 * VISITS ARE PRIVATE — the four promises the Visits tab was built on (owner
 * 2026-10-22: traffic in our own admin, not Vercel; no cookies, no banner).
 * Each is held by what the code DOES, run end to end, not by how it is worded:
 *
 *   1. NOTHING IS COUNTED INSIDE THE STORE SHELL (App Privacy: no analytics) —
 *      nor bots, nor /admin, nor prefetches, nor redirects.
 *   2. NO RAW ID LEAVES THE MIDDLEWARE. The one request `recordSiteVisit`
 *      makes carries no IP, no user-agent, no cookie, no URL, no slug — only a
 *      route pattern, a domain, a word, a class, a country and a 64-hex key.
 *      And it sets no cookie.
 *   3. A PRIVATE ADDRESS BECOMES ITS TEMPLATE. Every dynamic route the app has
 *      (`screens.generated.json`) is opened with a real-looking slug, uuid and
 *      public id; the stored path is the route template and carries none of
 *      them. Public marketing pages stay exact.
 *   4. A REFUSED READ SAYS "COULDN'T READ", NEVER 0 — the tab's real view,
 *      rendered.
 *
 * Plus the database half: tests/db/site-visits.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

import { stripComments } from '@/lib/strip-comments';
import screens from '@/lib/ugat/screens.generated.json';
import {
  deviceFromUserAgent,
  hitKind,
  isBot,
  referrerDomain,
  shouldCount,
} from '@/lib/visits/visit-capture';
import { recordSiteVisit, visitRoutePattern, visitWritesAllowed } from '@/lib/visits/record-visit';
import { buildDemoVisitStats, type VisitStats } from '@/lib/visits/visit-stats';

const WEB = join(import.meta.dirname, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const DOC = { 'sec-fetch-dest': 'document', accept: 'text/html,application/xhtml+xml' };

function hdrs(h: Record<string, string>): Headers {
  return new Headers(h);
}

// ── 1 · the store shell, bots, admin, prefetches ────────────────────────────

test('the store shell is never counted — by its cookie or by its bare user-agent marker', () => {
  const page = { method: 'GET', pathname: '/explore', status: 200 };
  assert.equal(shouldCount({ ...page, headers: hdrs({ ...DOC, 'user-agent': IPHONE_SAFARI }) }), 'page', 'positive control: a phone browser IS counted');
  assert.equal(
    shouldCount({ ...page, headers: hdrs({ ...DOC, 'user-agent': IPHONE_SAFARI }), clientTypeCookie: 'capacitor' }),
    null,
    'the Capacitor cookie must stop the count',
  );
  assert.equal(
    shouldCount({ ...page, headers: hdrs({ ...DOC, 'user-agent': `${IPHONE_SAFARI} SetnayanApp` }) }),
    null,
    'the bare SetnayanApp marker (a fresh install, before the cookie) must stop the count',
  );
});

test('the store-shell check sits in front of every write — the middleware passes the cookie it reads', () => {
  const rec = src('lib/visits/record-visit.ts');
  assert.match(rec, /clientTypeCookie: request\.cookies\.get\(STORE_SHELL_CLIENT_TYPE_COOKIE\)\?\.value/);
  const kindAt = rec.indexOf('const kind = shouldCount(');
  const fetchAt = rec.indexOf('await fetch(');
  assert.ok(kindAt > 0 && fetchAt > kindAt && rec.indexOf('if (!kind) return;') > kindAt, 'the write must sit behind shouldCount');
  const mw = src('middleware.ts');
  assert.match(mw, /after\(\(\) => recordSiteVisit\(request, response\)\)/, 'the middleware no longer hands the view to after()');
});

test('bots, /admin, prefetches, server actions and redirects are never views', () => {
  const ok = { method: 'GET', pathname: '/pricing', status: 200, headers: hdrs({ ...DOC, 'user-agent': DESKTOP_CHROME }) };
  assert.equal(shouldCount(ok), 'page');
  for (const bot of ['Googlebot/2.1 (+http://www.google.com/bot.html)', 'facebookexternalhit/1.1', 'curl/8.4.0', `${DESKTOP_CHROME} Chrome-Lighthouse`, '', 'Mozilla']) {
    assert.equal(isBot(bot), true, `not treated as a bot: ${bot}`);
  }
  assert.equal(isBot(IPHONE_SAFARI), false);
  assert.equal(shouldCount({ ...ok, pathname: '/admin/app-performance' }), null, '/admin is our own work, not traffic');
  assert.equal(shouldCount({ ...ok, pathname: '/admin' }), null);
  assert.equal(shouldCount({ ...ok, pathname: '/api/telemetry/client-fault' }), null);
  assert.equal(shouldCount({ ...ok, status: 307 }), null, 'a redirect is not a view');
  assert.equal(shouldCount({ ...ok, method: 'POST' }), null);
  assert.equal(shouldCount({ ...ok, headers: hdrs({ ...DOC, 'user-agent': DESKTOP_CHROME, 'next-router-prefetch': '1' }) }), null);
  assert.equal(shouldCount({ ...ok, headers: hdrs({ ...DOC, 'user-agent': DESKTOP_CHROME, 'sec-purpose': 'prefetch' }) }), null);
});

test('an in-app move to another page counts; a refresh of the same page does not', () => {
  const base = { method: 'GET', pathname: '/explore', status: 200 };
  assert.equal(hitKind({ ...base, headers: hdrs({ rsc: '1', referer: 'https://setnayan.com/' }) }), 'move');
  assert.equal(hitKind({ ...base, headers: hdrs({ rsc: '1', referer: 'https://setnayan.com/explore' }) }), null, 'router.refresh() is not a view');
  assert.equal(hitKind({ ...base, headers: hdrs({ 'sec-fetch-dest': 'image' }) }), null);
});

test('device class and referrer domain', () => {
  assert.equal(deviceFromUserAgent(IPHONE_SAFARI), 'phone');
  assert.equal(deviceFromUserAgent(DESKTOP_CHROME), 'desktop');
  assert.equal(deviceFromUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)'), 'tablet');
  assert.equal(referrerDomain('https://l.facebook.com/l.php?u=https%3A%2F%2Fsetnayan.com%2Fmaria', 'setnayan.com'), 'facebook.com');
  assert.equal(referrerDomain('https://www.google.com/search?q=maria+santos+wedding', 'setnayan.com'), 'google.com');
  assert.equal(referrerDomain('https://setnayan.com/maria-and-jose', 'setnayan.com'), '', 'our own site is not a source');
  assert.equal(referrerDomain('not a url', 'setnayan.com'), '');
});

// ── 2 · no raw id leaves the middleware ─────────────────────────────────────

async function captureOneVisit(url: string, headers: Record<string, string>, cookie = ''): Promise<{ bodies: string[]; urls: string[]; response: NextResponse }> {
  const saved = { ...process.env };
  const realFetch = globalThis.fetch;
  const bodies: string[] = [];
  const urls: string[] = [];
  Object.assign(process.env, {
    NODE_ENV: 'production',
    VERCEL_ENV: 'production',
    NEXT_PUBLIC_SUPABASE_URL: 'https://lab.supabase.test',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-lab-key',
  });
  globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
    urls.push(String(u));
    bodies.push(String(init?.body ?? ''));
    return new Response('true', { status: 200 });
  }) as typeof fetch;
  try {
    const request = new NextRequest(url, { headers: { ...headers, ...(cookie ? { cookie } : {}) } });
    const response = NextResponse.next();
    await recordSiteVisit(request, response);
    return { bodies, urls, response };
  } finally {
    globalThis.fetch = realFetch;
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

test('the one write carries no IP, no user-agent, no cookie, no URL and no slug — and sets no cookie', async () => {
  const ip = '203.177.42.19';
  const userId = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const { bodies, urls, response } = await captureOneVisit(
    'https://setnayan.com/v/bituin-catering?utm_source=FB&fbclid=IwAR0secretclick',
    {
      ...DOC,
      'user-agent': IPHONE_SAFARI,
      'x-forwarded-for': `${ip}, 10.0.0.1`,
      'x-vercel-ip-country': 'ph',
      referer: 'https://m.facebook.com/groups/manila-brides-private/posts/123456789',
      host: 'setnayan.com',
    },
    `sb-abcdefgh-auth-token=base64-${userId}; other=1`,
  );
  assert.equal(bodies.length, 1, 'positive control: exactly one write was made');
  assert.match(urls[0]!, /\/rest\/v1\/rpc\/record_site_visit$/);
  const body = JSON.parse(bodies[0]!) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ['p_country', 'p_device', 'p_key', 'p_path', 'p_signed_in', 'p_source', 'p_utm_source']);
  assert.equal(body.p_path, '/v/[slug]', 'the shop’s name must become its template');
  assert.equal(body.p_source, 'facebook.com', 'a referrer is stored as its domain only');
  assert.equal(body.p_utm_source, 'fb');
  assert.equal(body.p_device, 'phone');
  assert.equal(body.p_country, 'PH');
  assert.equal(body.p_signed_in, true);
  assert.match(String(body.p_key), /^[0-9a-f]{64}$/, 'the visitor key is a hash');
  const raw = bodies[0]!;
  for (const leak of [ip, '203.177', userId, 'iPhone', 'Safari', 'bituin', 'catering', 'manila-brides', '123456789', 'IwAR0secretclick', 'base64']) {
    assert.ok(!raw.includes(leak), `the write carries "${leak}"`);
  }
  assert.equal(response.headers.get('set-cookie'), null, 'counting a visit must never set a cookie');
});

test('the capture code sets no cookie and touches no browser storage', () => {
  for (const rel of ['lib/visits/record-visit.ts', 'lib/visits/visit-capture.ts']) {
    const s = src(rel);
    assert.doesNotMatch(s, /cookies\.set\(|\.cookies\.set\b|set-cookie|localStorage|sessionStorage|document\.cookie|randomUUID/i, `${rel} stores something in the browser`);
    assert.doesNotMatch(s, /^'use client'/m, `${rel} must stay server-side`);
  }
});

test('the same visit twice sends the same key; a different person sends a different one', async () => {
  const h = { ...DOC, 'user-agent': DESKTOP_CHROME, host: 'setnayan.com' };
  const a = await captureOneVisit('https://setnayan.com/pricing', { ...h, 'x-forwarded-for': '198.51.100.7' });
  const b = await captureOneVisit('https://setnayan.com/features', { ...h, 'x-forwarded-for': '198.51.100.7' });
  const c = await captureOneVisit('https://setnayan.com/pricing', { ...h, 'x-forwarded-for': '198.51.100.8' });
  const key = (r: { bodies: string[] }) => (JSON.parse(r.bodies[0]!) as { p_key: string }).p_key;
  assert.equal(key(a), key(b));
  assert.notEqual(key(a), key(c));
});

test('a store-shell visit and a preview deployment make no write at all', async () => {
  const shell = await captureOneVisit('https://setnayan.com/explore', { ...DOC, 'user-agent': IPHONE_SAFARI, host: 'setnayan.com' }, 'setnayan-client-type=capacitor');
  assert.equal(shell.bodies.length, 0, 'the store shell was counted');
  assert.equal(visitWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }), false, 'a preview shares the production database');
  assert.equal(visitWritesAllowed({ NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co' }), false, 'a builder’s next dev points at production');
  assert.equal(visitWritesAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'production' }), true);
});

// ── 3 · path templating hides private slugs ─────────────────────────────────

const SAMPLE: Record<string, string> = {
  uuid: '6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b',
  publicId: 'S89E-7K3M9QW2XR',
  slug: 'maria-and-jose-forever',
  opaque: 'tk_9f8e7d6c5b4a39281706',
  number: '20261212',
};
function fill(route: string, kind: keyof typeof SAMPLE): string {
  return route
    .split('/')
    .map((seg) => (/^\[\[?\.\.\./.test(seg) ? `${SAMPLE[kind]}/${SAMPLE.slug}` : /^\[.+\]$/.test(seg) ? SAMPLE[kind] : seg))
    .join('/');
}

test('every dynamic route the app has is stored as its template, never with the value', async () => {
  const routes = (screens as { screens: Array<{ route: string }> }).screens.map((s) => s.route).filter((r) => r.includes('['));
  assert.ok(routes.length > 50, `only ${routes.length} dynamic routes — the route list did not load`);
  let checked = 0;
  for (const route of routes) {
    for (const kind of Object.keys(SAMPLE) as (keyof typeof SAMPLE)[]) {
      const raw = fill(route, kind);
      const got = await visitRoutePattern(raw);
      assert.ok(got, `no pattern for ${raw}`);
      for (const v of Object.values(SAMPLE)) {
        assert.ok(!got!.includes(v), `${raw} was stored as ${got} — it carries "${v}"`);
      }
      checked++;
    }
  }
  assert.ok(checked > 250, `only ${checked} paths checked`);
});

test('an unknown address keeps only route words; public marketing pages stay exact', async () => {
  assert.equal(await visitRoutePattern('/maria-and-jose-forever'), '/[slug]');
  assert.equal(await visitRoutePattern('/v/bituin-catering'), '/v/[slug]');
  const unknown = await visitRoutePattern('/nobody-knows/maria-santos-private/09171234567');
  assert.ok(unknown && !/maria|santos|0917/.test(unknown), `an unknown path leaked: ${unknown}`);
  for (const p of ['/', '/pricing', '/features', '/for-suppliers', '/explore', '/privacy', '/terms', '/login']) {
    assert.equal(await visitRoutePattern(p), p, `${p} must stay exact`);
  }
});

// ── 4 · a refused read says "couldn't read", never 0 ────────────────────────

async function renderView(stats: VisitStats): Promise<string> {
  // tsx compiles .tsx with the classic runtime; the app's JSX expects React in scope.
  (globalThis as { React?: typeof React }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VisitsView } = await import('@/app/admin/app-performance/_surfaces/visits-view');
  return renderToStaticMarkup(React.createElement(VisitsView, { stats, range: '3m' }));
}

test('a refused visits read prints "Couldn’t read the visits" and dashes — never a 0', async () => {
  const demo = buildDemoVisitStats(90, '2026-10-22');
  const html = await renderView({ ...demo, demo: false, summary: null, signUps: null, paidOrders: null });
  assert.match(html, /Couldn.rsquo;t read the visits|Couldn’t read the visits/);
  assert.match(html, /Couldn.rsquo;t read the sign-ups|Couldn’t read the sign-ups/);
  assert.match(html, /Couldn.rsquo;t read the paid orders|Couldn’t read the paid orders/);
  const figures = html.slice(html.indexOf('data-testid="visits-figures"'), html.indexOf('</dl>'));
  assert.ok(figures.length > 0, 'the four figures are gone');
  assert.doesNotMatch(figures, />0</, 'a refused read printed 0');
  assert.equal((figures.match(/>—</g) ?? []).length, 4, 'every unread figure must read —');
  assert.doesNotMatch(html, /No visits counted|No pages counted|No visitors counted/, 'an empty state was printed over a refused read');
  assert.doesNotMatch(html, /data-testid="visits-funnel"/, 'the funnel line was drawn over a refused read');
});

test('one refused count does not zero the funnel; a read that worked draws everything', async () => {
  const demo = buildDemoVisitStats(90, '2026-10-22');
  const partial = await renderView({ ...demo, signUps: null });
  assert.match(partial, /Couldn.rsquo;t read the sign-ups|Couldn’t read the sign-ups/);
  assert.doesNotMatch(partial, /data-testid="visits-funnel"/);
  const full = await renderView(demo);
  assert.doesNotMatch(full, /Couldn/);
  assert.match(full, /data-testid="visits-funnel"/);
  assert.match(full, /data-testid="visits-chart"/);
  assert.match(full, /\/v\/\[slug\]/);
});

test('the surface reads through requireAdmin, and the read keeps each refusal its own null', () => {
  const s = src('app/admin/app-performance/_surfaces/visits-surface.tsx');
  assert.match(s, /await requireAdmin\(\);/);
  const r = src('lib/visits/visit-stats.server.ts');
  assert.equal((r.match(/return null;/g) ?? []).length >= 6, true, 'a refused read must return null, not a number');
  assert.doesNotMatch(r, /\?\? 0\b|count \?\? 0|\|\| 0\b/, 'a refused count must never become 0');
});
