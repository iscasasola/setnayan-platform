/**
 * 📲 THE PRELOAD FOLLOWS WHAT THE ACCOUNT HAS (`lib/app-preload-sets.ts`).
 *
 * Owner, 2026-10-02: *"when someone logs in, it has their events, and their
 * shop."* Hosts → the host app + the Maker; a shop → the supplier app; both →
 * both; guest-only → nothing. Never admin, never public pages. And the trigger
 * is mounted where a signed-in person lands — never in the admin console, never
 * on a public page — fed from what those layouts already read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stripComments } from './strip-comments';
import { SUPPLIER_BAR_ROUTES, appPreloadPlan, hostAppRoutes, hostedEventOf, isPreloadableAppRoute, makerRouteOf, supplierAppRoutes } from './app-preload-sets';
import { routeChunkUrls } from './app-preload';
import { buildEventMenuSections, eventMenuRows } from './customer-menu';

const WEB = resolve(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const E = 'S89E-TESTTESTTE';

test('a host gets the host app — Home first, the bar, every menu page, the Maker', () => {
  const plan = appPreloadPlan({ hostEventId: E, hostMenu: { websiteEnabled: true }, hasShop: false });
  assert.equal(plan.routes[0], `/dashboard/${E}`, 'Home is not first');
  for (const p of ['', '/guests', '/vendors', '/launch']) assert.ok(plan.routes.includes(`/dashboard/${E}${p}`), `the host set misses /dashboard/${E}${p}`);
  const menu = eventMenuRows(buildEventMenuSections(E, { websiteEnabled: true })).map((r) => r.href.split(/[?#]/)[0]!).filter((h) => h.startsWith(`/dashboard/${E}`));
  for (const h of menu) assert.ok(plan.routes.includes(h), `a page of the event menu is not preloaded: ${h}`);
  assert.ok(plan.routes.includes(makerRouteOf(E)));
  assert.ok(plan.routes.every((r) => !r.startsWith('/vendor-dashboard')), 'a host with no shop got the supplier app');
});

test('an event with no Maker preloads no Maker', () => {
  const plan = appPreloadPlan({ hostEventId: E, hostMenu: { websiteEnabled: false }, hasShop: false });
  assert.ok(!plan.routes.includes(makerRouteOf(E)));
});

test('a shop gets the supplier app — Today · Customers · Shop · More, then More’s rows', () => {
  const plan = appPreloadPlan({ hostEventId: null, hasShop: true });
  assert.deepEqual(plan.routes.slice(0, 4), [...SUPPLIER_BAR_ROUTES]);
  assert.deepEqual(plan.routes, supplierAppRoutes());
  assert.ok(plan.routes.every((r) => r.startsWith('/vendor-dashboard')));
});

test('both → both; guest-only → nothing at all', () => {
  const both = appPreloadPlan({ hostEventId: E, hostMenu: { websiteEnabled: true }, hasShop: true });
  assert.ok(both.routes.includes(`/dashboard/${E}/launch`) && both.routes.includes('/vendor-dashboard/customers'));
  const guest = appPreloadPlan({ hostEventId: hostedEventOf([{ event_id: 'X', role: 'guest' }]), hasShop: false });
  assert.deepEqual(guest, { routes: [] }, 'a guest-only account preloads something');
});

test('hostedEventOf: the primary hosted event, else the first hosted — never an invitation', () => {
  assert.equal(hostedEventOf([{ event_id: 'g', role: 'guest', is_primary: true }, { event_id: 'a', role: 'couple' }, { event_id: 'b', role: 'couple', is_primary: true }]), 'b');
  assert.equal(hostedEventOf([{ event_id: 'g', role: 'guest' }, { event_id: 'a', role: 'couple' }]), 'a');
  assert.equal(hostedEventOf([{ event_id: 'g', role: 'guest' }]), null);
});

test('never an admin page, never a public page, never another site', () => {
  for (const bad of ['/admin', '/admin/users', '/claire-and-indalecio', '/', '/papic/me/x', 'https://x.test/dashboard/1', '//evil.test/dashboard']) {
    assert.equal(isPreloadableAppRoute(bad), false, `${bad} would be preloaded`);
  }
  const all = [...appPreloadPlan({ hostEventId: E, hostMenu: { websiteEnabled: true }, hasShop: true }).routes];
  assert.ok(all.every(isPreloadableAppRoute));
  assert.ok(hostAppRoutes(E, { websiteEnabled: true }).every((r) => !r.includes('?')), 'a route kept its query');
});

test('the supplier bar here is the bar the supplier sees (vendor-nav-destinations.ts)', () => {
  const src = stripComments(read('app/vendor-dashboard/_components/vendor-nav-destinations.ts'));
  const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]!);
  assert.deepEqual(hrefs, [...SUPPLIER_BAR_ROUTES]);
});

test('the trigger is mounted where a signed-in person lands — and never in the admin console or a public page', () => {
  for (const f of ['app/dashboard/[eventId]/layout.tsx', 'app/dashboard/(account)/layout.tsx', 'app/dashboard/(launcher)/layout.tsx', 'app/vendor-dashboard/layout.tsx']) {
    const src = stripComments(read(f));
    assert.match(src, /<AppPreload\b[\s\S]{0,200}appPreloadPlan\(/, `${f} no longer preloads what the account has`);
  }
  assert.doesNotMatch(read('app/admin/layout.tsx'), /AppPreload|appPreloadPlan/, 'the admin console preloads');
  assert.doesNotMatch(read('app/layout.tsx'), /AppPreload|appPreloadPlan/, 'the root layout (every public page) preloads');
  const trigger = stripComments(read('app/_components/app-preload.tsx'));
  // The trigger draws nothing: the line is the Maker's alone.
  assert.match(trigger, /return null;\s*\}/);
  // 📦 It adds nothing to the shared bundle: no import() — loading Maker code by import() from these
  // layouts made the Maker page's chunks entries in the webpack runtime every page loads
  // (measured +139 to +176 B). It fetches files; webpack never hears of them.
  assert.doesNotMatch(trigger, /\bimport\(/, 'app-preload.tsx loads code with import() — the shared bundle grows');
  assert.match(trigger, /routeChunkUrls\(await res\.text\(\)\)/, 'the trigger no longer brings each page’s code');
});

test('routeChunkUrls reads the chunk files out of an RSC payload, once each, in order', () => {
  const payload = [
    '1:"$Sreact.fragment"',
    '5:I[41919,[],""]',
    'c:I[2722,["15025","static/chunks/15025-7ad4c594e92f1326.js","8124","static/chunks/app/dashboard/%5BeventId%5D/launch/page-e0c44bd4c68709d3.js"],"MakerShell"]',
    'd:I[2723,["15025","static/chunks/15025-7ad4c594e92f1326.js"],"Other"]',
    '0:{"b":"AQAB","f":[["children","static/chunks/not-a-file"]]}',
  ].join('\n');
  assert.deepEqual(routeChunkUrls(payload), [
    '/_next/static/chunks/15025-7ad4c594e92f1326.js',
    '/_next/static/chunks/app/dashboard/%5BeventId%5D/launch/page-e0c44bd4c68709d3.js',
  ]);
  assert.deepEqual(routeChunkUrls('0:{"b":"x"}'), []);
});
