/**
 * legacy-redirects.test.ts — a retired redirect-only page is GONE as a route
 * and its old URL STILL FORWARDS, through the middleware, for free.
 *
 * Slice C1 of the 2026-10-02 cleanup deleted ten `page.tsx` files whose only job
 * was `redirect(...)`. Each was a deployed route against Vercel's 2,048 cap, and
 * a `next.config` `redirects()` rule would have cost one too. The old paths live
 * on in other people's emails, bookmarks and stored notification links, so the
 * forward has to survive the deletion. These tests hold the three halves:
 *   1. the map says where each old path goes (the destinations the stubs had),
 *   2. the middleware actually calls it, as a 308, ahead of the session work,
 *      and its matcher covers every old path,
 *   3. the pages really are gone and no next.config rule re-spends the route.
 *
 * 🧭 Since 2026-10-02 it also holds the full-page More Services' removal (owner,
 * tracker d1: "remove the old page — the More menu is the one place; old links
 * forward"): `/suite` and `/studio` forward to the More menu on Home
 * (`studioHubHref`), and both menus open on that address.
 *
 * SABOTAGE (run 2026-10-02): deleting the `['suite', MORE_MENU]` row turns the
 * first test red ("/dashboard/…/suite no longer forwards").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { LEGACY_REDIRECT_OLD_PATHS, legacyRedirectTarget } from './legacy-redirects';
import { asksForMoreServices, studioHubHref } from './studio-hub';
import { stripComments } from './strip-comments';

const WEB = path.resolve(import.meta.dirname, '..');
const EID = 'S89E-ABCDEFGHIJ';
const MORE = studioHubHref(EID);

/** [old path, the destination the deleted stub redirected to]. */
const FORWARDS: readonly (readonly [string, string])[] = [
  [`/dashboard/${EID}/for-you`, `/dashboard/${EID}/vendors`],
  // /design went to /studio, which is itself retired (d1) — one hop to the More menu.
  [`/dashboard/${EID}/design`, MORE],
  [`/dashboard/${EID}/today`, `/dashboard/${EID}`],
  [`/dashboard/${EID}/studio/animated-monogram`, `/dashboard/${EID}/monogram`],
  [`/dashboard/${EID}/website/launch`, `/dashboard/${EID}/website/editor`],
  ['/admin/refinements', '/admin/taxonomy'],
  ['/admin/marketing', '/admin/studio'],
  ['/vendor-dashboard/funnel', '/vendor-dashboard/performance'],
  ['/vendor-dashboard/tax-documents', '/vendor-dashboard'],
  ['/explore/categories', '/explore'],
  [`/dashboard/${EID}/suite`, MORE],
  [`/dashboard/${EID}/studio`, MORE],
];

/** The page file each old path used to be (relative to app/). */
const DELETED_PAGES: readonly string[] = [
  'dashboard/[eventId]/for-you/page.tsx',
  'dashboard/[eventId]/design/page.tsx',
  'dashboard/[eventId]/today/page.tsx',
  'dashboard/[eventId]/studio/animated-monogram/page.tsx',
  'dashboard/[eventId]/website/launch/page.tsx',
  'admin/refinements/page.tsx',
  'admin/marketing/page.tsx',
  'vendor-dashboard/funnel/page.tsx',
  'vendor-dashboard/tax-documents/page.tsx',
  'explore/categories/page.tsx',
  'dashboard/[eventId]/suite/page.tsx',
  'dashboard/[eventId]/studio/page.tsx',
];

test('every retired path forwards to the destination its stub had', () => {
  for (const [from, to] of FORWARDS) {
    assert.equal(legacyRedirectTarget(from), to, `${from} no longer forwards to ${to}`);
  }
});

test('a trailing slash still forwards; a child path or a live path does not', () => {
  assert.equal(legacyRedirectTarget('/admin/marketing/'), '/admin/studio');
  assert.equal(legacyRedirectTarget(`/dashboard/${EID}/today/`), `/dashboard/${EID}`);
  assert.equal(legacyRedirectTarget('/admin/marketing/extra'), null);
  assert.equal(legacyRedirectTarget(`/dashboard/${EID}/design/extra`), null);
  // live neighbours that merely share a word with a retired path
  for (const live of [
    // The product pages under /studio are live — only the index retired (d1).
    `/dashboard/${EID}/studio/papic`,
    `/dashboard/${EID}/studio/about/papic`,
    `/dashboard/${EID}/galleries`,
    `/dashboard/${EID}/launch`, // the controller — NOT website/launch
    `/dashboard/${EID}/website/editor`,
    `/dashboard/${EID}/website/what-to-bring`, // still a page (a guarded /website door)
    '/explore',
    '/explore/compare',
    '/vendor-dashboard/performance',
    '/admin/taxonomy',
    '/',
  ]) {
    assert.equal(legacyRedirectTarget(live), null, `${live} is live and must not be forwarded`);
  }
});

test('the map and this test agree on the full list (nothing forwards unpinned)', () => {
  assert.equal(LEGACY_REDIRECT_OLD_PATHS.length, FORWARDS.length);
  assert.equal(DELETED_PAGES.length, FORWARDS.length);
});

test('the middleware forwards them as a 308, before the session work', () => {
  const src = readFileSync(path.join(WEB, 'middleware.ts'), 'utf8');
  assert.match(src, /from '@\/lib\/legacy-redirects'/);
  const call = src.indexOf('legacyRedirectTarget(pathname)');
  assert.ok(call > 0, 'middleware no longer reads the legacy map');
  const after = src.slice(call, call + 400);
  assert.match(after, /NextResponse\.redirect\(new URL\(retiredTarget, request\.url\), 308\)/);
  assert.ok(
    call < src.indexOf('await updateSession(request)'),
    'the forward must run before updateSession — a retired URL needs no session work',
  );
});

test('the middleware matcher covers every retired path', () => {
  const src = readFileSync(path.join(WEB, 'middleware.ts'), 'utf8');
  const m = /matcher:\s*\[\s*'([^']+)'/.exec(src);
  assert.ok(m, 'could not find the middleware matcher');
  // Next anchors a matcher source to the whole path.
  const re = new RegExp(`^${m![1]!.replace(/\\\\/g, '\\')}$`);
  for (const [from] of FORWARDS) {
    assert.ok(re.test(from), `the middleware matcher skips ${from}, so it would 404 instead of forward`);
  }
});

test('the pages are gone, and no next.config rule re-spends the route', () => {
  for (const f of DELETED_PAGES) {
    assert.ok(!existsSync(path.join(WEB, 'app', f)), `app/${f} is back — a redirect-only page is a route`);
  }
  const cfg = readFileSync(path.join(WEB, 'next.config.ts'), 'utf8');
  for (const [from] of FORWARDS) {
    const generic = from.replace(EID, ':eventId');
    assert.ok(
      !cfg.includes(`'${generic}'`) && !cfg.includes(`"${generic}"`) && !cfg.includes(`\`${generic}\``),
      `next.config.ts redirects ${generic} — that costs a Vercel route; add the pair to lib/legacy-redirects.ts instead`,
    );
  }
});

/* ── 🧭 d1 — the More menu is the one place (owner 2026-10-02) ───────────── */

const read = (p: string) => stripComments(readFileSync(path.join(WEB, p), 'utf8'));

test('d1 · the More menu address opens the menu', () => {
  assert.equal(MORE, `/dashboard/${EID}?more=services`);
  assert.ok(asksForMoreServices(new URL(MORE, 'https://x').search), 'the forward does not open the More menu');
});

test('d1 · both menus open on the address: the rail row and the phone sheet', () => {
  const rail = read('app/dashboard/[eventId]/_components/event-rail-context.tsx');
  assert.match(rail, /asksForMoreServices\(search\)\) setOpen\(true\)/, 'the rail does not open More Services on its address');
  const bar = read('app/dashboard/[eventId]/_components/customer-bottom-nav.tsx');
  assert.match(bar, /hasServices && asksForMoreServices\(search\)\) openMore\(\)/, 'the phone does not open the More sheet on its address');
});

test('d1 · nothing hand-types the old hub address — every door goes through studioHubHref', () => {
  const files = [
    'app/dashboard/[eventId]/_components/after/finished-event-summary.tsx',
    'app/dashboard/[eventId]/alaala/page.tsx',
    'app/dashboard/[eventId]/launch/page.tsx',
    'app/dashboard/[eventId]/live/page.tsx',
    'app/dashboard/[eventId]/documents/page.tsx',
    'app/dashboard/[eventId]/orders/new/page.tsx',
    'app/vendor-dashboard/recommendations/share-actions.ts',
    'app/panood/control/[eventId]/actions.ts',
    'app/panood/control/[eventId]/screens-actions.ts',
    'app/dashboard/[eventId]/details/page.tsx',
  ];
  for (const f of files) {
    const src = read(f);
    assert.ok(!/\/(suite|studio)`/.test(src), `${f} hand-types the retired hub address`);
    assert.match(src, /studioHubHref\(eventId\)/, `${f} lost its door to the services`);
  }
});

test('d1 · a service with no door is not listed in the More menu (it used to open the gone page)', async () => {
  const { ADD_ONS } = await import('./add-ons-catalog');
  const { buildOurServices, ourServicesMenuChildren } = await import('./our-services');
  const cards = buildOurServices({
    eventId: EID,
    catalogue: ADD_ONS,
    owned: { active: new Set(), pending: new Set() },
    prices: new Map(),
    offered: () => true,
    // Every day-of service: the day has passed, nothing bought.
    sellableNow: (e) => !e.dayOfOnly,
    aiSellable: true,
    papicOwnedBy: ['PAPIC_UNLOCK'],
    refusesPath: () => false,
  });
  const doorless = cards.filter((c) => !c.href).map((c) => c.key);
  assert.ok(doorless.length > 0, 'no doorless card in the fixture — this proves nothing');
  const kids = ourServicesMenuChildren(cards);
  for (const k of doorless) assert.ok(!kids.some((c) => c.key === k), `${k} is listed with nowhere to go`);
  for (const c of kids) assert.ok(c.href && !c.href.includes('/suite'), `${c.key} opens the gone page`);
});
