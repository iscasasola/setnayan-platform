/**
 * doors.test.ts — the business doors (supplier.setnayan.com, coordinator.setnayan.com; business.setnayan.com is an
 * alias). Owner 24 Nov 2026, drawing "Business door drawing" v7.
 *
 *   · every label in the ONE map is reserved — middleware answers it before the paid event subdomain, and no event or
 *     shop address can take it;
 *   · a door host's `/` is an internal rewrite to its front page; legal pages open inside; anything else 308s to the
 *     site; the alias forwards to the supplier door;
 *   · every sign-in on a door goes to `/login?door=X` on the ONE auth origin;
 *   · the landing rule is `landingForAccount` with the door, per door × account (no shop → the shop set-up);
 *   · the door survives every way of signing in, because it rides `next`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  DOOR_HOSTS,
  DOOR_LABELS,
  DOORS,
  doorFrontHref,
  doorLabelOfHost,
  doorLandingHref,
  doorOpenShopHref,
  doorRoute,
  doorSignInHref,
  parseDoor,
} from './doors';
import { landingForAccount } from './auth-confirm-link';
import { RESERVED_SLUGS } from './reserved-slugs';
import { safeNext } from './safe-next';
import { buildOAuthCallbackUrl } from './oauth-signup';
import { POLICY_LINKS } from './policy-links';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SITE = 'https://www.setnayan.com';

test('every label in the one map is reserved, and middleware answers it before the event subdomain', () => {
  assert.deepEqual([...DOOR_LABELS].sort(), ['business', 'coordinator', 'supplier']);
  for (const label of DOOR_LABELS) {
    assert.ok(RESERVED_SLUGS.has(label), `${label} is not reserved as an address`);
    assert.equal(doorLabelOfHost(`${label}.setnayan.com`), label);
  }
  const mw = read('middleware.ts');
  assert.match(mw, /\.\.\.DOOR_LABELS/, 'the middleware reserved-subdomain set does not take the door labels from the map');
  const door = mw.indexOf('doorRoute(');
  const event = mw.indexOf('detectVendorSubdomain(hostname)');
  assert.ok(door > 0 && event > 0 && door < event, 'a door host must be answered before the paid event-subdomain rewrite');
  // No second copy of a label: "business" (and the others) are written only in the map.
  for (const f of ['middleware.ts', 'app/_components/frontdoor/front-door-shell.tsx', 'app/login/_components/login-data.ts']) {
    assert.doesNotMatch(read(f), /['"`](?:business|supplier|coordinator)\.setnayan\.com/, `${f} spells a door host`);
  }
});

test('a door host: `/` rewrites to its front page, legal pages open inside, anything else goes to the site', () => {
  assert.deepEqual(doorRoute('supplier.setnayan.com', '/', '', SITE), { kind: 'front', door: 'supplier', rewrite: '/for-suppliers' });
  assert.deepEqual(doorRoute('coordinator.setnayan.com', '/', '?utm_source=x', SITE), {
    kind: 'front',
    door: 'coordinator',
    rewrite: '/for-coordinators',
  });
  for (const p of POLICY_LINKS) {
    assert.deepEqual(doorRoute('supplier.setnayan.com', p.href, '', SITE), { kind: 'inside', door: 'supplier' });
  }
  assert.deepEqual(doorRoute('supplier.setnayan.com', '/_next/data/x.json', '', SITE), { kind: 'inside', door: 'supplier' });
  assert.deepEqual(doorRoute('supplier.setnayan.com', '/open-shop', '?plan=pro', SITE), {
    kind: 'away',
    to: 'https://www.setnayan.com/open-shop?plan=pro',
  });
  assert.deepEqual(doorRoute('coordinator.setnayan.com', '/login', '?door=coordinator', SITE), {
    kind: 'away',
    to: 'https://www.setnayan.com/login?door=coordinator',
  });
  // business is an alias: a 308 to the supplier door, same path
  assert.deepEqual(doorRoute('business.setnayan.com', '/', '', SITE), { kind: 'away', to: 'https://supplier.setnayan.com/' });
  assert.deepEqual(doorRoute('business.setnayan.com', '/terms', '?a=1', SITE), { kind: 'away', to: 'https://supplier.setnayan.com/terms?a=1' });
  // dev hosts
  assert.deepEqual(doorRoute('supplier.localhost:3000', '/', '', 'http://localhost:3000'), {
    kind: 'front',
    door: 'supplier',
    rewrite: '/for-suppliers',
  });
  // not a door
  for (const h of ['www.setnayan.com', 'setnayan.com', 'maria-and-jose.setnayan.com', 'localhost:3000', 'supplier.example.com']) {
    assert.equal(doorRoute(h, '/', '', SITE), null, h);
  }
  // middleware rewrites (never redirects) the front page and 308s the rest
  const mw = read('middleware.ts');
  assert.match(mw, /route\.kind === 'away'\)[\s\S]{0,120}NextResponse\.redirect\(route\.to, 308\)/);
  assert.match(mw, /route\.kind === 'front'[\s\S]{0,400}NextResponse\.rewrite\(/);
  assert.match(mw, /headers\.set\(DOOR_HEADER, route\.door\)/);
});

test('every sign-in on a door goes to /login?door=X on the one auth origin; ✕ goes back to the door', () => {
  for (const door of DOORS) {
    assert.equal(doorSignInHref(door, SITE), `https://www.setnayan.com/login?door=${door}`);
    assert.equal(parseDoor(door), door);
  }
  // an alias in the one map counts as its door: an old /login?door=business link lands on the supplier card
  assert.equal(parseDoor('business'), 'supplier', 'door=business shows the couple card');
  assert.equal(parseDoor(' Business '), 'supplier');
  assert.equal(parseDoor('constructor'), null, 'only labels in the map, never an inherited key');
  assert.equal(parseDoor('admin'), null);
  assert.equal(doorFrontHref('supplier', SITE), 'https://supplier.setnayan.com/');
  assert.equal(doorFrontHref('coordinator', 'http://localhost:3000'), 'http://coordinator.localhost:3000/');
  // The shell's door bar signs in through doorSignInHref — never the in-place panel on a door host.
  const shell = read('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /<a href=\{door\.signInHref\} className="fd-btn-quiet">/);
  assert.match(read('app/_components/frontdoor/app-rail-shell.tsx'), /signInHref: doorSignInHref\(door, siteOrigin\(\)\)/);
  // The front page reads no couple-side link on a door: "Couple pricing" is left off.
  const route = read('app/(shell)/for-suppliers/page.tsx');
  assert.match(route, /afterPlans=\{\s*door \? undefined :/);
});

test('one landing rule with the door: a shop → the supplier dashboard; no shop → the shop set-up on the same account', () => {
  const at = (door: 'supplier' | 'coordinator', hasShop: boolean | null) => ({ door, hasShop });
  for (const door of DOORS) {
    // owns or is on a shop team (account type does not matter)
    assert.equal(landingForAccount('/', 'vendor', at(door, true)), '/vendor-dashboard');
    assert.equal(landingForAccount('/', 'customer', at(door, true)), '/vendor-dashboard');
    // measured: no shop → onboarding, on this door's words
    assert.equal(landingForAccount('/', 'customer', at(door, false)), doorOpenShopHref(door));
    assert.equal(landingForAccount('/', 'vendor', at(door, false)), doorOpenShopHref(door));
    // the shop list could not be read → the account type decides
    assert.equal(landingForAccount('/', 'vendor', at(door, null)), '/vendor-dashboard');
    assert.equal(landingForAccount('/', 'customer', at(door, null)), doorOpenShopHref(door));
    // a real destination is honoured as given, door or not
    assert.equal(landingForAccount('/vendor-dashboard/chat', 'vendor', at(door, true)), '/vendor-dashboard/chat');
  }
  assert.equal(doorOpenShopHref('supplier'), '/open-shop');
  assert.equal(doorOpenShopHref('coordinator'), '/open-shop?as=coordinator');
  // no door → the shipped rule, unchanged
  assert.equal(landingForAccount('/', 'vendor'), landingForAccount('/', 'vendor', null));
  // the route asks this rule, never a copy of it
  const route = read('app/auth/door/route.ts');
  assert.match(route, /landingForAccount\('\/', accountType, \{ door, hasShop \}\)/);
  assert.doesNotMatch(route, /['"]\/open-shop|['"]\/vendor-dashboard/, 'the door route spells a landing of its own');
});

test('the door survives every way of signing in, because it rides `next`', () => {
  for (const door of DOORS) {
    const next = doorLandingHref(door);
    assert.equal(safeNext(next), next, 'safeNext drops the door landing');
    // Google / Apple: the callback URL carries it, and a vendor intent with a real `next` keeps it
    const { next: carried, url } = buildOAuthCallbackUrl({ appUrl: SITE, rawNext: next, accountType: 'vendor' });
    assert.equal(carried, next);
    assert.equal(new URL(url).searchParams.get('next'), next);
  }
  // /login?door=X hands the card that `next`, and someone already signed in goes straight on
  const data = read('app/login/_components/login-data.ts');
  assert.match(data, /const landsAt = door && next === '\/' \? doorLandingHref\(door\) : next;/);
  assert.match(data, /const signupHref = door \? doorOpenShopHref\(door\) :/);
  const page = read('app/login/page.tsx');
  assert.match(page, /if \(view\.door && signedIn\) redirect\(doorLandingHref\(view\.door\)\)/);
  // the card's Google / Apple carry the supplier intent on a door, so a brand-new account opens a shop
  const card = read('app/login/_components/sign-in-card.tsx');
  assert.match(card, /<OAuthButtonRow next=\{next\} withAccountType=\{!!door\} defaultAccountType=\{door \? 'vendor' : 'customer'\} \/>/);
  // the map's front pages are real pages
  for (const label of DOOR_LABELS) {
    const h = DOOR_HOSTS[label] as { front?: string };
    if (h.front) assert.ok(readFileSync(join(WEB, 'app', '(shell)', h.front.slice(1), 'page.tsx'), 'utf8').length > 0);
  }
});

test('the ONE door flag draws the door chrome: no rail, no search, no couple links; the dashboard keeps only its menu', () => {
  const shell = read('app/_components/frontdoor/front-door-shell.tsx');
  const start = shell.indexOf('if (door && !inApp) {');
  assert.ok(start > 0, 'the shell has no public door branch');
  const branch = shell.slice(start, shell.indexOf('\n  return (', start + 30));
  assert.doesNotMatch(branch, /fd-rail|SearchBox|fd-searchrow|onSignInPress|DISCOVER_HREF|\/dashboard|aria-controls/, 'the door branch draws a way out');
  assert.match(branch, /\{topBarEl\}/, 'the door branch draws a second top bar');
  assert.match(shell, /\{door \? \(\s*<span className=\{inApp \? 'fd-wordmark fd-wordmark-app' : 'fd-wordmark'\} data-door-mark="">/, 'the wordmark is a way out on the door');
  assert.match(branch, /POLICY_LINKS\.map/, 'the door has no legal line');
  // signed in with the flag (an app shell): the rail's own rows, the way back and the company links are gone
  assert.match(shell, /\{door \? null : \(<>\s*\{focused && focus \? \(/);
  assert.match(shell, /\{door \? null : \(\s*<div className="fd-sp-col" role="group" aria-label="Company">/);
  // no search on a door, from the shell's one search rule; the public door has no rail, so no Menu button
  assert.match(shell, /onADoor: door !== null,/);
  assert.match(shell, /const railDrawn = !\(door && !inApp\);/);
  // the flag: a door host, or an app shell's user agent / cookie — always overwritten on the site
  const mw = read('middleware.ts');
  assert.match(mw, /if \(appDoor\) request\.headers\.set\(DOOR_HEADER, appDoor\);\s*else request\.headers\.delete\(DOOR_HEADER\);/);
});

test('the door landing never pulls the route table into the client (Maker bundle budget, #8263)', async () => {
  const { routes } = await import('./routes');
  const { doorShopHomeHref } = await import('./doors');
  assert.equal(doorShopHomeHref(), routes.vendorDashboard.index(), 'the door lands somewhere the route table does not know');
  for (const f of ['lib/auth-confirm-link.ts', 'lib/doors.ts', 'lib/door-map.ts', 'lib/sign-in-landing.ts']) {
    assert.doesNotMatch(read(f), /from '(?:\.\/|@\/lib\/)routes'/, `${f} imports the route table, which reaches the client shell`);
  }
  // the map and the client-reached links are a leaf; the modules on every page's first load import only the leaf
  assert.doesNotMatch(read('lib/door-map.ts'), /^\s*import\s/m, 'door-map.ts is no longer a leaf');
  for (const f of ['lib/auth-confirm-link.ts', 'lib/reserved-slugs.ts']) {
    assert.doesNotMatch(read(f), /from '(?:\.\/|@\/lib\/)doors'/, `${f} pulls the door routing into every page's bundle`);
    assert.match(read(f), /from '\.\/door-map'/);
  }
  // one map: DOOR_HOSTS is written once, in the leaf
  assert.doesNotMatch(read('lib/doors.ts'), /export const DOOR_HOSTS/);
});

test('the one search rule answers "no box" on a door, signed in or out', async () => {
  const { topBarSearch } = await import('../app/_components/frontdoor/shell-page-search');
  assert.equal(topBarSearch({ handed: undefined, signedIn: false, pageHasOwnSearch: false, onADoor: true }), false);
  assert.equal(topBarSearch({ handed: 'x', signedIn: true, pageHasOwnSearch: false, onADoor: true }), false);
  assert.equal(topBarSearch({ handed: undefined, signedIn: false, pageHasOwnSearch: false }), undefined);
});

test('an app shell turns the same flag on (DECISION_LOG 866cebc5) — never a second switch', async () => {
  const { appShellDoor } = await import('./doors');
  assert.equal(appShellDoor('Mozilla/5.0 (iPhone) SetnayanBusiness', null), 'supplier');
  assert.equal(appShellDoor('Mozilla/5.0 SetnayanBusiness/coordinator', null), 'coordinator');
  assert.equal(appShellDoor('Mozilla/5.0 SetnayanApp/ios', null), null, 'the couple app is not a door');
  assert.equal(appShellDoor('Mozilla/5.0', 'coordinator'), 'coordinator');
  assert.equal(appShellDoor('Mozilla/5.0', 'admin'), null);
  assert.equal(appShellDoor(null, null), null);
});
