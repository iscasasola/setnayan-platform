/**
 * lib/legacy-redirects.test.ts — retired pages forward through ONE map, read
 * by the middleware; and the full-page More Services stays gone (owner
 * 2026-10-02, tracker d1: "remove the old page — the More menu is the one
 * place; old links forward").
 *
 * SABOTAGE (run 2026-10-02): deleting the `['suite', MORE_MENU]` row turns
 * test 1 red ("/dashboard/E/suite no longer forwards").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { legacyRedirectTarget, LEGACY_REDIRECT_OLD_PATHS } from './legacy-redirects';
import { asksForMoreServices, studioHubHref } from './studio-hub';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));
const E = 'S89E-ABCDEFGHJK';

test('1 · the two retired hub paths forward to the More menu (Home, ?more=services)', () => {
  const more = studioHubHref(E);
  assert.equal(more, `/dashboard/${E}?more=services`);
  for (const p of [`/dashboard/${E}/suite`, `/dashboard/${E}/suite/`, `/dashboard/${E}/studio`, `/dashboard/${E}/studio/`]) {
    assert.equal(legacyRedirectTarget(p), more, `${p.replace(E, 'E')} no longer forwards`);
  }
  assert.ok(asksForMoreServices(new URL(more, 'https://x').search), 'the forward does not open the More menu');
});

test('2 · exact paths only — the product pages under /studio are live and never forwarded', () => {
  for (const p of [
    `/dashboard/${E}/studio/papic`,
    `/dashboard/${E}/studio/setnayan-ai`,
    `/dashboard/${E}/studio/about/papic`,
    `/dashboard/${E}`,
    `/dashboard/${E}/galleries`,
    '/studio',
    '/suite',
  ]) {
    assert.equal(legacyRedirectTarget(p), null, `${p} must not be forwarded`);
  }
  assert.ok(LEGACY_REDIRECT_OLD_PATHS.includes('/dashboard/<eventId>/suite'));
  assert.ok(LEGACY_REDIRECT_OLD_PATHS.includes('/dashboard/<eventId>/studio'));
});

test('3 · the middleware answers the map with a 308, and no next.config rule spends a route on it', () => {
  const mw = read('middleware.ts');
  assert.match(mw, /legacyRedirectTarget\(pathname\)/, 'the middleware does not read the map');
  assert.match(mw, /NextResponse\.redirect\(new URL\(retiredTarget, request\.url\), 308\)/);
  const cfg = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
  assert.ok(!/['"`]\/dashboard\/:[^'"`]*\/suite['"`]/.test(cfg), 'next.config redirects /suite — a route spent');
});

test('4 · the full-page More Services is gone, and stays gone', () => {
  for (const p of [
    'app/dashboard/[eventId]/suite/page.tsx',
    'app/dashboard/[eventId]/studio/page.tsx',
  ]) {
    assert.equal(existsSync(join(WEB, p)), false, `${p} came back — the More menu is the one place (owner d1)`);
  }
});

test('5 · both menus open on the address: the rail row and the phone sheet', () => {
  const rail = read('app/dashboard/[eventId]/_components/event-rail-context.tsx');
  assert.match(rail, /asksForMoreServices\(search\)\) setOpen\(true\)/, 'the rail does not open More Services on its address');
  const bar = read('app/dashboard/[eventId]/_components/customer-bottom-nav.tsx');
  assert.match(bar, /hasServices && asksForMoreServices\(search\)\) openMore\(\)/, 'the phone does not open the More sheet on its address');
});

test('6 · nothing hand-types the old hub address — every door goes through studioHubHref', () => {
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

test('7 · a service with no door is not listed in the More menu (it used to open the gone page)', async () => {
  const { ADD_ONS } = await import('./add-ons-catalog');
  const { buildOurServices, ourServicesMenuChildren } = await import('./our-services');
  const cards = buildOurServices({
    eventId: E,
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
