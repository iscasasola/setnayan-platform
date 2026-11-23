/**
 * 🏠 A SIGNED-IN VISIT TO SETNAYAN.COM OPENS HOME — AND DISCOVER IS STILL ONE TAP AWAY.
 *
 * Owner, 23 Nov 2026, verbatim: *"Yes, go to Home"* (DECISION_LOG 2026-11-23 "A signed-in visit to setnayan.com opens
 * Home", closing the open call in the 22 Nov row "A SIGN-IN STARTS ON THE PROFILE PAGE"). setnayan.com, the installed
 * app's start (`manifest.json` `start_url: "/"`, the Capacitor and Tauri shells) and the logo all open `/`.
 *
 * WHAT IS HELD:
 *   · signed in, the bare `/` → `landingForAccount('/', type)` — Home `?hub=1`, a supplier's on Shop — the SAME rule as
 *     a sign-in, never a second one; tracking tags alone (`utm_*`, `fbclid`, `gclid`) do not count as asking for Discover;
 *   · signed out, a failed session read, or an anonymous session → the page draws (the public front page, untouched);
 *   · Discover stays reachable: its own door `DISCOVER_HREF` (`/?discover=1`), its `?q=` search and its filters all
 *     draw Discover; every press that MEANS Discover uses the door, never the bare `/`, which would now open Home;
 *   · the page asks the (hub) layout's own cached session read, registers the cron-free jobs BEFORE it redirects, and
 *     keeps its canonical the bare `/` (signed-out HTML and metadata unchanged).
 *
 * SABOTAGE (run 23 Nov 2026, each RED, then restored):
 *   · `signedInRootLanding` ignoring params (always Home when signed in)  → "Discover's own door" RED
 *   · the bar's Discover tab put back to `href: '/'`                     → "every Discover press" RED
 *   · the page's `redirect(home)` removed                                → "the root page asks the one rule" RED
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { landingForAccount } from '@/lib/auth-confirm-link';
import { signedInRootLanding } from '@/lib/sign-in-landing';
import { DISCOVER_HREF, DISCOVER_PARAM } from '@/lib/discover-href';
import { DISCOVER_WAY_BACK, coldWayBack } from '@/lib/discover-way-back';
import { homeSegHref } from '@/lib/home-segments';
import { shopBackDoor, SHOP_BACK_COLD, SHOP_ARRIVAL_SRC } from '@/lib/shop-back';
import { discoverFollowingHref } from '@/lib/discover-pin';
import { stayOnPageSearchHref } from '@/lib/shell-search';
import { exploreRedirectTarget } from '@/lib/legacy-redirects';
import { accountBarItems } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (p: string) => {
  const raw = readFileSync(resolve(WEB, p), 'utf8');
  assert.ok(raw.length > 500, `${p} is missing or a stub — a guard pointed at the wrong file passes forever.`);
  return stripComments(raw);
};

const SIGNED_IN = (accountType: string | null) => ({ signedIn: true, isAnonymous: false, accountType });

test('signed in, the bare `/` lands where a sign-in lands — the one rule, every account type', () => {
  for (const type of ['customer', 'admin', 'vendor', null]) {
    const want = landingForAccount('/', type);
    assert.equal(signedInRootLanding({}, SIGNED_IN(type)), want, `${type}: a signed-in bare / must open ${want}`);
    assert.notEqual(want, '/', `${type} must never stay on Discover`);
  }
  assert.equal(signedInRootLanding({}, SIGNED_IN('customer')), homeSegHref('events'));
  assert.equal(signedInRootLanding({}, SIGNED_IN('vendor')), homeSegHref('shop'));
  // A marketing link carries only tracking tags — that is still "nowhere of my own".
  assert.equal(signedInRootLanding({ utm_source: 'fb', utm_campaign: 'x', fbclid: 'a', gclid: 'b' }, SIGNED_IN(null)), homeSegHref('events'));
});

test('signed out, a failed session read or an anonymous session — the page draws, nothing forwards', () => {
  assert.equal(signedInRootLanding({}, { signedIn: false, isAnonymous: false, accountType: null }), null);
  assert.equal(signedInRootLanding({}, { signedIn: false, isAnonymous: false, accountType: 'vendor' }), null);
  assert.equal(signedInRootLanding({}, { signedIn: true, isAnonymous: true, accountType: 'customer' }), null);
});

test("Discover's own door, its search and its filters still draw Discover when signed in", () => {
  assert.equal(DISCOVER_HREF, `/?${DISCOVER_PARAM}=1`);
  for (const params of [{ [DISCOVER_PARAM]: '1' }, { q: 'seda' }, { q: '' }, { category: 'photo' }, { following: '1' }]) {
    assert.equal(signedInRootLanding(params, SIGNED_IN('customer')), null, `${JSON.stringify(params)} asks for Discover`);
    assert.equal(signedInRootLanding(params, SIGNED_IN('vendor')), null, `${JSON.stringify(params)} asks for Discover`);
  }
});

test('every press that MEANS Discover uses its own door — never the bare `/`, which now opens Home', () => {
  const tab = accountBarItems(['home', 'discover']).find((i) => i.key === 'discover');
  assert.equal(tab?.href, DISCOVER_HREF, 'the account bar’s Discover tab');
  assert.equal(DISCOVER_WAY_BACK.href, DISCOVER_HREF);
  assert.equal(SHOP_BACK_COLD.href, DISCOVER_HREF, '"See more suppliers"');
  assert.equal(shopBackDoor({ src: SHOP_ARRIVAL_SRC.discover, eventId: null }).href, DISCOVER_HREF);
  assert.equal(shopBackDoor({ src: SHOP_ARRIVAL_SRC.explore, eventId: null }).href, DISCOVER_HREF);
  assert.equal(shopBackDoor({ src: SHOP_ARRIVAL_SRC.search, eventId: null }).href, DISCOVER_HREF, 'Back to Discover with no words');
  assert.equal(discoverFollowingHref(true), DISCOVER_HREF, 'Following off stays on Discover');
  assert.equal(stayOnPageSearchHref('https://x.test/?q=seda', ''), DISCOVER_HREF, 'clearing a search stays on Discover');
  assert.equal(stayOnPageSearchHref('https://x.test/dashboard/people?q=a', ''), '/dashboard/people', 'other pages untouched');
  assert.equal(exploreRedirectTarget(''), DISCOVER_HREF, 'a bare /explore is Discover');
  // Signed out the cold door keeps the clean `/` — it IS Discover for a stranger.
  assert.deepEqual(coldWayBack(false), { href: '/', label: 'Discover' });

  const bareDiscover = /href=(?:"\/"|\{'\/'\})/;
  for (const f of [
    'app/[slug]/_components/discover-arrival-back.tsx',
    'app/admin/studio/_surfaces/real-stories-surface.tsx',
    'app/admin/studio/_surfaces/storytellers-surface.tsx',
    'app/_components/frontdoor/front-door-discover.tsx',
    'app/_components/frontdoor/discover-six-parts.tsx',
    'app/_components/frontdoor/front-door-results.tsx',
  ]) {
    assert.ok(!bareDiscover.test(read(f)), `${f} links Discover with the bare "/" — signed in, that opens Home now`);
  }
  assert.match(read('app/_components/frontdoor/front-door-shell.tsx'), /href=\{account\.signedIn \? DISCOVER_HREF : '\/'\}/, 'the ☰ Discover row');
});

test('the root page asks the one rule, with the layout’s session, after the cron-free jobs', () => {
  const page = read('app/(hub)/page.tsx');
  assert.match(page, /const user = await hubDrawsTheShell\(\);/, 'the (hub) layout’s own cached session read');
  assert.match(page, /signedInRootLanding\(params, \{ \.\.\.who, accountType \}\)/);
  assert.match(page, /if \(home\) redirect\(home\);/);
  assert.ok(!/landingForAccount|homeSegHref|'\/dashboard/.test(page), 'no second copy of the rule in the page');
  const lastJob = page.lastIndexOf('after(() =>');
  assert.ok(lastJob > 0 && lastJob < page.indexOf('redirect(home)'), 'every cron-free job is registered before the redirect');
  // Signed-out HTML and metadata: the canonical stays the bare `/`.
  assert.match(page, /alternates:\s*\{\s*canonical:\s*'\/'\s*\}/);
  // The middleware still never bounces `/` (signed-in-can-see-it.test.ts) — Discover is reached by its door.
  assert.ok(!/user\s*&&\s*pathname\s*===\s*['"]\/['"]/.test(read('middleware.ts')));
});
