/**
 * The store shell (Capacitor iOS/Android) must never SHOW a paid digital
 * feature — App Review 2026-06-30, guideline 3.1.1 via 3.1.3(b). These tests
 * hold three things:
 *
 *   1. the predicate tells the App Store shell apart from the desktop .dmg —
 *      the bug this file exists to prevent is darkening Papic on macOS;
 *   2. the hidden-key set is DERIVED from the catalog, so a new paid add-on
 *      cannot ship visible in the store shell without failing here;
 *   3. the middleware route gate covers every hidden key's Studio home and
 *      every pure purchase route.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isStoreShellInBrowser,
  isStoreShellSignals,
  isStoreShellWebOnlyPath,
  storeShellAllowsPaidFeature,
  storeShellRefusesPayable,
  STORE_SHELL_HIDDEN_ADDON_KEYS,
  STORE_SHELL_WEB_ONLY_DOORWAYS,
  STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS,
} from './store-shell';
import { EVERY_ADD_ON } from './add-ons-catalog';

const CAPACITOR_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp';
const TAURI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 SetnayanApp/desktop';
const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';

test('the Capacitor shell is the store shell — by cookie or by bare UA marker', () => {
  assert.equal(isStoreShellSignals(SAFARI_UA, 'capacitor'), true, 'cookie alone suffices');
  assert.equal(isStoreShellSignals(CAPACITOR_UA, ''), true, 'first request, before the cookie exists');
  assert.equal(isStoreShellSignals(CAPACITOR_UA, 'capacitor'), true);
});

test('the desktop .dmg/.msi is NOT the store shell — Apple never reviews it', () => {
  // src-tauri/tauri.conf.json appends `SetnayanApp/desktop`; getRequestPlatform()
  // would call this 'ios'. That is the trap.
  assert.equal(isStoreShellSignals(TAURI_UA, ''), false, 'SetnayanApp/desktop UA');
  assert.equal(isStoreShellSignals(TAURI_UA, 'tauri'), false);
  assert.equal(isStoreShellSignals(CAPACITOR_UA, 'tauri'), false, 'the tauri cookie wins over a bare marker');
});

test('a plain browser is not the store shell', () => {
  assert.equal(isStoreShellSignals(SAFARI_UA, ''), false);
  assert.equal(isStoreShellSignals('', ''), false);
  assert.equal(isStoreShellSignals(null, undefined), false);
});

test('the UA marker the predicate reads is the one the Capacitor shell actually appends', () => {
  const cfg = readFileSync(join(__dirname, '../../mobile/capacitor.config.ts'), 'utf8');
  const m = cfg.match(/appendUserAgent:\s*'([^']+)'/);
  assert.ok(m, 'capacitor.config.ts must declare appendUserAgent');
  assert.equal(isStoreShellSignals(`Mozilla/5.0 ${m![1]}`, ''), true);
});

test('the desktop UA the predicate excludes is the one src-tauri actually sends', () => {
  const cfg = readFileSync(join(__dirname, '../../../src-tauri/tauri.conf.json'), 'utf8');
  const ua = (JSON.parse(cfg) as { app: { windows: { userAgent: string }[] } }).app.windows[0]!.userAgent;
  assert.match(ua, /SetnayanApp\/desktop/, 'tauri.conf.json must keep the /desktop suffix — it is what tells the .dmg apart');
  assert.equal(isStoreShellSignals(ua, ''), false);
});

test('every paid or upgrade-selling add-on is hidden in the store shell (derived from the catalog)', () => {
  // EVERY_ADD_ON, not ADD_ONS: the Live Studio tile joins ADD_ONS only while
  // its launch flag is on, so deriving from ADD_ONS passed with the flag off
  // and would have let the tile into the store shell the day it flipped.
  const mustHide = EVERY_ADD_ON.filter((a) => a.tier !== 'free' || a.serviceKey).map((a) => a.key);
  const missing = mustHide.filter((k) => !STORE_SHELL_HIDDEN_ADDON_KEYS.has(k));
  assert.deepEqual(
    missing,
    [],
    `add-ons that sell something but are not in STORE_SHELL_HIDDEN_ADDON_KEYS: ${missing.join(', ')}`,
  );
  // And nothing in the set is a phantom — every hidden key is a real catalog key.
  const catalogKeys = new Set(EVERY_ADD_ON.map((a) => a.key));
  for (const k of STORE_SHELL_HIDDEN_ADDON_KEYS) {
    assert.ok(catalogKeys.has(k), `hidden key "${k}" is not in ADD_ONS`);
  }
});

test('the free planning tools stay visible in the store shell', () => {
  for (const key of ['save-the-date', 'rsvp', 'mood-board', 'seating', 'indoor-blueprint', 'playlist', 'orders']) {
    assert.equal(STORE_SHELL_HIDDEN_ADDON_KEYS.has(key), false, `${key} must remain`);
  }
});

test('the route gate covers every hidden key\'s Studio home', () => {
  for (const key of STORE_SHELL_HIDDEN_ADDON_KEYS) {
    assert.ok(STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS.has(key), `no route gate for /studio/${key}`);
    assert.equal(isStoreShellWebOnlyPath(`/dashboard/S89E-ABCDEFGHIJ/studio/${key}`), true, key);
    assert.equal(isStoreShellWebOnlyPath(`/dashboard/S89E-ABCDEFGHIJ/studio/${key}/anything`), true, `${key} subpath`);
  }
});

test('the route gate covers the pure purchase routes and the feature pages whose URL differs from its key', () => {
  for (const p of [
    '/dashboard/S89E-ABCDEFGHIJ/studio/live-studio-control',
    '/dashboard/S89E-ABCDEFGHIJ/studio/editorial-pro',
    '/dashboard/S89E-ABCDEFGHIJ/orders/new',
    '/dashboard/S89E-ABCDEFGHIJ/checkout',
    '/papic/order/abc123',
  ]) {
    assert.equal(isStoreShellWebOnlyPath(p), true, p);
  }
});

test('the paid features whose home is NOT under /studio are refused too', () => {
  // The 2026-09-06 audit found eight paid surfaces the /studio-only gate could
  // not see. These two are the ones whose whole page IS the paid thing.
  for (const p of [
    '/vendor-dashboard/subscription',
    '/dashboard/S89E-ABCDEFGHIJ/live',
    '/dashboard/S89E-ABCDEFGHIJ/live/anything',
  ]) {
    assert.equal(isStoreShellWebOnlyPath(p), true, p);
  }
  // The rest of the vendor dashboard is a working surface, not a shop.
  for (const p of ['/vendor-dashboard', '/vendor-dashboard/bookings', '/vendor-dashboard/profile']) {
    assert.equal(isStoreShellWebOnlyPath(p), false, p);
  }
});

test('🔴 nothing steers a store-shell user OUT of the app to pay', () => {
  // THE SINGLE WORST THING THAT WAS IN THE TREE. `web-nudge-banner.tsx`
  // rendered ONLY when isNativeApp() was true, said "Buy on our website for
  // less — up to 33% off", and linked to setnayan.com with target="_blank".
  // That is App Review guideline 3.1.1 external steering, verbatim, and the
  // component's own docblock justified it with a post-2024 Apple ruling that
  // applies to the UNITED STATES storefront only — never to ours.
  //
  // This asserts the SHAPE, not the filename: any component that both gates on
  // native-ness and points at an external setnayan.com URL fails here, so the
  // pattern cannot come back under a new name.
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const root = join(__dirname, '..');
  const files = execSync(
    'grep -rl "isNativeApp\\|isStoreShell" app lib --include="*.tsx" --include="*.ts" || true',
    { cwd: root },
  )
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'));

  assert.ok(files.length > 0, 'grep found no native-aware files — the anchor moved');

  // Files the shape matches that are NOT steering, each with the reason. Adding
  // one is a claim a reviewer can check against the file.
  const NOT_STEERING: Record<string, string> = {
    // `SITE_URL` is the NEXT_PUBLIC_APP_URL fallback used to print the shop's
    // own address; the one target=_blank is "View as couple" → the shop's
    // public page (`publicPath`). It became native-aware on 2026-09-24 only
    // because its Branch panel now hides the paid branch add-on in the store shell.
    'app/vendor-dashboard/shop/page.tsx': "opens the shop's own public page, not a checkout",
  };
  const offenders: string[] = [];
  for (const f of files) {
    if (f in NOT_STEERING) continue;
    const src = readFileSync(join(root, f), 'utf8');
    // An absolute link to our own web checkout, in a file that knows whether it
    // is running natively, is the steering shape.
    if (/https?:\/\/(www\.)?setnayan\.com/.test(src) && /target=["']_blank["']/.test(src)) {
      offenders.push(f);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these open an external setnayan.com link from a native-aware component (3.1.1 steering): ${offenders.join(', ')}`,
  );
});

test('the store shell is never shown a second, marked-up price', () => {
  // Vendor plan cards used to multiply the admin-set price by 1.5 for native
  // users, then point them at the cheaper web page. One price, from the
  // catalogue, everywhere.
  const src = readFileSync(
    join(__dirname, '../app/vendor-dashboard/subscription/_components/subscription-cards.tsx'),
    'utf8',
  );
  // Match the multiplier, not the digits: `1.5` alone hits Tailwind spacing
  // classes (`gap-1.5`, `py-1.5`) all over the file and fails on a clean tree.
  assert.ok(
    !/MOBILE_SRP|mobileSrp|SRP_MULTIPLIER/.test(src),
    'a channel-dependent price multiplier is back',
  );
  assert.ok(!/isNativeApp/.test(src), 'plan cards should no longer branch on native-ness at all');
});

test('the build number is past the one App Review rejected', () => {
  // Apple rejected 1.0 (1) on 2026-06-30. App Store Connect refuses a duplicate
  // build number outright, so shipping the same one means the upload fails
  // before a human ever looks at it.
  const ios = readFileSync(
    join(__dirname, '../../mobile/ios/App/App.xcodeproj/project.pbxproj'),
    'utf8',
  );
  const builds = [...ios.matchAll(/CURRENT_PROJECT_VERSION = (\d+);/g)].map((m) => Number(m[1]));
  assert.ok(builds.length > 0, 'no CURRENT_PROJECT_VERSION found — the anchor moved');
  for (const b of builds) {
    assert.ok(b > 1, `iOS build number ${b} is the rejected one (or older)`);
  }
  const android = readFileSync(join(__dirname, '../../mobile/android/app/build.gradle'), 'utf8');
  const vc = android.match(/versionCode\s+(\d+)/);
  assert.ok(vc, 'no versionCode found — the anchor moved');
  assert.ok(Number(vc![1]) > 1, `Android versionCode ${vc![1]} is the rejected one`);
});

test('the route gate leaves the planning surface open', () => {
  for (const p of [
    '/dashboard',
    '/dashboard/S89E-ABCDEFGHIJ',
    '/dashboard/S89E-ABCDEFGHIJ/studio',
    '/dashboard/S89E-ABCDEFGHIJ/studio/save-the-date',
    '/dashboard/S89E-ABCDEFGHIJ/studio/mood-board',
    '/dashboard/S89E-ABCDEFGHIJ/guests',
    '/dashboard/S89E-ABCDEFGHIJ/vendors',
    '/dashboard/S89E-ABCDEFGHIJ/orders',
    '/dashboard/profile',
    '/papic/guest',
    '/papic/seat/abc123',
    '/login',
  ]) {
    assert.equal(isStoreShellWebOnlyPath(p), false, p);
  }
});

test('every page that embeds InlineCheckoutDrawer is either route-gated or an allowed free tool (the drawer is inert on native)', () => {
  // The allowlist names the free tools whose page merely embeds the (inert on
  // native) drawer. Adding a NEW page that imports the drawer forces a choice
  // here: gate its route, or add it to this list with a reason.
  const ALLOWED_FREE_TOOL_PAGES = new Set([
    'app/dashboard/[eventId]/studio/save-the-date/page.tsx',
    'app/dashboard/[eventId]/studio/indoor-blueprint/page.tsx',
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx', // supplier bookings — real-world services, 3.1.3(e)
  ]);
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const root = join(__dirname, '..');
  const files = execSync('grep -rl "InlineCheckoutDrawer" app --include="page.tsx"', { cwd: root })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);
  assert.ok(files.length > 0, 'grep found no drawer pages — the anchor moved');
  const unhandled = files.filter((f) => {
    if (ALLOWED_FREE_TOOL_PAGES.has(f)) return false;
    const url = '/' + f.replace(/^app\//, '').replace(/\/page\.tsx$/, '').replace('[eventId]', 'S89E-ABCDEFGHIJ');
    return !isStoreShellWebOnlyPath(url);
  });
  assert.deepEqual(unhandled, [], `drawer pages the store shell can still open: ${unhandled.join(', ')}`);
});

// ─── 2026-09-24 · "the app sells nothing" — re-audit on current main ─────────
// Every leak class below was found reachable in the store shell on origin/main
// da1bb7f75. Each test EXECUTES the predicate the gate calls; the wiring tests
// after them hold the one line per page that asks it.

const EV = '/dashboard/S89E-ABCDEFGHIJ';

test('the browser twin of the predicate reads the same two signals (client components)', () => {
  // The inline checkout drawer used `/SetnayanApp/i.test(navigator.userAgent)`,
  // which is TRUE on the desktop .dmg — so desktop could not buy anything there.
  assert.equal(isStoreShellInBrowser(TAURI_UA, ''), false, 'desktop UA');
  assert.equal(isStoreShellInBrowser(TAURI_UA, 'a=1; setnayan-client-type=tauri'), false);
  assert.equal(isStoreShellInBrowser(CAPACITOR_UA, ''), true, 'bare marker, before the cookie exists');
  assert.equal(isStoreShellInBrowser(SAFARI_UA, 'x=y; setnayan-client-type=capacitor; z=1'), true, 'cookie among others');
  assert.equal(isStoreShellInBrowser(CAPACITOR_UA, 'setnayan-client-type=tauri'), false, 'tauri cookie wins');
  assert.equal(isStoreShellInBrowser(SAFARI_UA, 'not-setnayan-client-type=capacitor'), false, 'name must match exactly');
  assert.equal(isStoreShellInBrowser(SAFARI_UA, ''), false);
  assert.equal(isStoreShellInBrowser(undefined, undefined), false);
});

test('every order page except the ledger is refused — each is a pay-now screen for a paid SKU', () => {
  for (const p of [`${EV}/orders/new`, `${EV}/orders/3f1c2b7e-0000-4000-8000-000000000000`, `${EV}/orders/abc/`]) {
    assert.equal(isStoreShellWebOnlyPath(p), true, p);
  }
  // The ledger stays: seeing what you already have is not a purchase.
  assert.equal(isStoreShellWebOnlyPath(`${EV}/orders`), false);
  assert.equal(isStoreShellWebOnlyPath(`${EV}/orders/`), false, 'trailing slash is still the ledger');
});

test('vendor Deep Search (a paid per-run service) is refused; the rest of the shop is not', () => {
  assert.equal(isStoreShellWebOnlyPath('/vendor-dashboard/deep-search'), true);
  assert.equal(isStoreShellWebOnlyPath('/vendor-dashboard/deep-search/result'), true);
  for (const p of ['/vendor-dashboard/booking-fees', '/vendor-dashboard/booking-fees/abc', '/vendor-dashboard/clients/S89E-ABCDEFGHIJ']) {
    assert.equal(isStoreShellWebOnlyPath(p), false, `${p} — booking fees are a real-world service`);
  }
});

test('the Studio "About" page of every paid feature is refused like its home; free ones stay', () => {
  for (const key of STORE_SHELL_HIDDEN_ADDON_KEYS) {
    assert.equal(isStoreShellWebOnlyPath(`${EV}/studio/about/${key}`), true, `about/${key}`);
  }
  for (const key of ['save-the-date', 'mood-board', 'seating', 'rsvp', 'playlist']) {
    assert.equal(isStoreShellWebOnlyPath(`${EV}/studio/about/${key}`), false, `about/${key} is free`);
  }
  assert.equal(isStoreShellWebOnlyPath(`${EV}/studio/about`), false, 'no key → nothing to refuse');
});

test('the marketing doorways of paid features are refused; the guest and helper side is not', () => {
  for (const p of STORE_SHELL_WEB_ONLY_DOORWAYS) {
    assert.equal(isStoreShellWebOnlyPath(p), true, p);
    assert.equal(isStoreShellWebOnlyPath(`${p}/`), true, `${p}/`);
  }
  // EXACT paths: these share a prefix with a doorway and are event surfaces.
  for (const p of ['/papic/guest', '/papic/seat/abc', '/papic/join/abc', '/papic/claim/abc', '/panood/cam/abc', '/pa3d-something']) {
    assert.equal(isStoreShellWebOnlyPath(p), false, p);
  }
});

test('the Live Studio control room and program output are refused (the paid unlock, in use)', () => {
  for (const p of ['/panood/control/S89E-ABCDEFGHIJ', '/panood/program/S89E-ABCDEFGHIJ']) {
    assert.equal(isStoreShellWebOnlyPath(p), true, p);
  }
});

test('/pay/<reference>: the store shell may pay a booking fee and nothing else', () => {
  assert.equal(storeShellRefusesPayable({ isBookingFee: false }, true), true, 'a paid SKU, in the app');
  assert.equal(storeShellRefusesPayable({ isBookingFee: true }, true), false, 'a booking fee, in the app');
  assert.equal(storeShellRefusesPayable({ isBookingFee: false }, false), false, 'web / desktop pay anything');
  assert.equal(storeShellRefusesPayable({ isBookingFee: true }, false), false);
  // And the path is NOT refused wholesale — the fee lane runs through it.
  assert.equal(isStoreShellWebOnlyPath('/pay/SN-ABC123'), false);
});

test('a web-bought feature does not light up in the store shell — unless it is free for everyone', () => {
  assert.equal(storeShellAllowsPaidFeature(true, true), false, 'store shell + paywall on → off');
  assert.equal(storeShellAllowsPaidFeature(true, false), true, 'paywall off → Sai is free planning → on');
  assert.equal(storeShellAllowsPaidFeature(false, true), true, 'web / desktop → on');
  assert.equal(storeShellAllowsPaidFeature(false, false), true);
});

test('the free venue shortlist reports its result without pitching the paid Sai', () => {
  const { firstVenueShortlistConfirmation } = require('./setnayan-ai-free-assist') as typeof import('./setnayan-ai-free-assist');
  const quiet = firstVenueShortlistConfirmation(3, 4999, { sell: false });
  assert.match(quiet, /Sai shortlisted 3 venues/);
  assert.doesNotMatch(quiet, /₱|full Sai|one-time/, quiet);
  // Off the store shell the pitch is unchanged.
  assert.match(firstVenueShortlistConfirmation(3, 4999), /full Sai/);
});

// ── Wiring: one line per page asks the question above, BEFORE the priced thing.
// Anchored per page on the symbol that renders the price, so moving the gate
// below it (or deleting it) goes red here.

function src(rel: string): string {
  return readFileSync(join(__dirname, '..', rel), 'utf8');
}
function before(file: string, gate: RegExp, priced: string): void {
  const s = src(file);
  const g = s.search(gate);
  const p = s.indexOf(priced);
  assert.ok(g >= 0, `${file}: the store-shell gate is gone (${gate})`);
  assert.ok(p >= 0, `${file}: anchor "${priced}" moved — re-point this test, do not delete it`);
  assert.ok(g < p, `${file}: the gate must run before "${priced}"`);
}

test('wiring: /pay refuses a paid SKU before it paints a QR', () => {
  before('app/pay/[reference]/page.tsx', /storeShellRefusesPayable\(payable, await isStoreShellRequest\(\)\)/, 'mintedQrImage(');
});

test('wiring: the orders ledger drops its buy button and its links to the refused detail page', () => {
  const s = src('app/dashboard/[eventId]/orders/page.tsx');
  assert.match(s, /storeShell \? undefined : \(\s*<Link\s+href=\{`\/dashboard\/\$\{eventId\}\/orders\/new`\}/);
  // The row stays (the record) but is not a link; the web keeps the literal
  // Link so lint-port-no-lost-controls still sees the door.
  assert.match(s, /\{storeShell \? \(\s*<div className=\{ORDER_ROW_CLASS\}>\{row\}<\/div>\s*\) : \(\s*<Link\s+href=\{`\/dashboard\/\$\{eventId\}\/orders\/\$\{o\.order_id\}`\}/);
});

test('wiring: the vendor 3D Booth card never mounts in the store shell', () => {
  before(
    'app/vendor-dashboard/clients/[eventId]/_components/booth-event-section.tsx',
    /if \(await isStoreShellRequest\(\)\) return null;/,
    '<BoothEventBuyForm',
  );
});

test('wiring: Mood Board "Make it real" (paid render credits) is not mounted in the store shell', () => {
  const s = src('app/dashboard/[eventId]/studio/mood-board/page.tsx');
  assert.equal((s.match(/<MakeItReal\b/g) ?? []).length, 1, 'one mount — every mount must be gated');
  assert.match(s, /\{storeShell \? null : \(\s*<MakeItReal\b/);
  assert.match(s, /\.\.\.\(storeShell \? \[\] : \[\{ href: '#make-it-real'/, 'the jump link would point at nothing');
});

test('wiring: the dashboard withholds the Sai pitch and a web-bought Sai in the store shell', () => {
  const s = src('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  assert.match(s, /const aiActive =[^;]*storeShellAllowsPaidFeature\(storeShell, aiPaywallEnabled\)/);
  const mounts = s.match(/<FreeVenueShortlistOffer\b[^>]*\/>/g) ?? [];
  assert.ok(mounts.length > 0, 'anchor moved');
  for (const m of mounts) assert.match(m, /sell=\{!storeShell\}/, m);
  const v = src('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(v, /const aiActive =[^;]*storeShellAllowsPaidFeature\(storeShell, paywallEnabled\)/);
  assert.match(v, /const aiOffer = !storeShell && shouldOfferSetnayanAiPurchaseForEvent/);
});

test('wiring: a plan sheet (a price list) withdraws itself in the store shell', () => {
  const s = src('app/_components/app-store/choose-plan-sheet.tsx');
  before('app/_components/app-store/choose-plan-sheet.tsx', /if \(storeShell\) return null;/, '{priceFromLabel ? (');
  assert.match(s, /const storeShell = useIsStoreShell\(\);/);
});

test('no client component asks "native?" with a regex that also matches the desktop .dmg', () => {
  // `/SetnayanApp/i.test(navigator.userAgent)` is true on `SetnayanApp/desktop`.
  // A client that needs the store-shell answer uses useIsStoreShell().
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const root = join(__dirname, '..');
  const files = execSync('grep -rlE "SetnayanApp/?i?\\.test\\(navigator" app lib || true', { cwd: root })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean)
    .filter((f) => !/\.test\.tsx?$/.test(f));
  const offenders = files.filter((f) => {
    const s = readFileSync(join(root, f), 'utf8');
    // detect-oauth-shell.ts tells desktop apart explicitly first — that is fine.
    return !/SetnayanApp\/desktop/.test(s);
  });
  assert.deepEqual(offenders, [], `desktop-blind native checks: ${offenders.join(', ')}`);
});

test('every public page that sends a reader to /pricing is a refused doorway (or listed here with a reason)', () => {
  // The doorway set is hand-kept, so this derives the rule from the pages:
  // a (shell) page that links to /pricing is advertising something paid.
  const NOT_A_DOORWAY: Record<string, string> = {
    // The company page. Its one "See transparent pricing" button lands on
    // /pricing, which middleware already bounces for every app shell.
    '/about': 'links to /pricing, which the app bounces; quotes no price itself',
  };
  const { execSync } = require('node:child_process') as typeof import('node:child_process');
  const root = join(__dirname, '..');
  const files = execSync(`grep -rlE "href[=:] *[\\"'{]*/pricing" "app/(shell)" || true`, { cwd: root })
    .toString()
    .trim()
    .split('\n')
    .filter((f) => f.endsWith('/page.tsx'));
  assert.ok(files.length > 0, 'grep found no /pricing links — the anchor moved');
  const missing = files
    .map((f) => '/' + f.replace(/^app\/\(shell\)\//, '').replace(/\/page\.tsx$/, ''))
    .filter((route) => !STORE_SHELL_WEB_ONLY_DOORWAYS.has(route) && !(route in NOT_A_DOORWAY));
  assert.deepEqual(missing, [], `public pages advertising a paid feature, open in the store shell: ${missing.join(', ')}`);
});

test('the link guard hides exactly the doors the middleware would refuse, on our own origin', () => {
  const { storeShellHidesHref } = require('./store-shell') as typeof import('./store-shell');
  const here = 'https://www.setnayan.com/vendor-dashboard/messages/abc';
  for (const href of [
    '/vendor-dashboard/subscription',
    '/vendor-dashboard/subscription?credit-expiring=x',
    'https://www.setnayan.com/vendor-dashboard/deep-search',
    `${EV}/studio/website-pro`,
    `${EV}/studio/papic#buy`,
    `${EV}/orders/new`,
    '/setnayan-ai',
  ]) {
    assert.equal(storeShellHidesHref(href, here), true, href);
  }
  for (const href of [
    '/vendor-dashboard',
    `${EV}/orders`,
    `${EV}/studio/mood-board`,
    '/web-only',
    '#top',
    'mailto:hello@setnayan.com',
    'https://example.com/vendor-dashboard/subscription', // another origin is not our route
    '',
    null,
  ]) {
    assert.equal(storeShellHidesHref(href as string | null, here), false, String(href));
  }
});

test('wiring: the link guard is mounted once, in the root layout, and hides with !important', () => {
  const layout = src('app/layout.tsx');
  assert.equal((layout.match(/<StoreShellLinkGuard \/>/g) ?? []).length, 1);
  const guard = src('app/_components/store-shell-link-guard.tsx');
  assert.match(guard, /if \(!isStoreShellInBrowser\(navigator\.userAgent, document\.cookie\)\) return;/, 'must be a no-op off the store shell');
  assert.match(guard, /setProperty\('display', 'none', 'important'\)/, '`hidden` alone loses to utility classes');
  assert.match(guard, /storeShellHidesHref\(/, 'must key on the registry, not a list of its own');
});

test('wiring: wedding onboarding drops every priced screen in the store shell', () => {
  const shell = src('app/onboarding/wedding/_components/onboarding-shell.tsx');
  const set = shell.match(/STORE_SHELL_DROPPED_SCREENS: ReadonlySet<ScreenId> = new Set\(\[([^\]]*)\]\)/);
  assert.ok(set, 'STORE_SHELL_DROPPED_SCREENS moved');
  for (const id of ['plan', 'services', 'summary', 'services_step']) {
    assert.ok(set![1]!.includes(`'${id}'`), `${id} must be dropped in the store shell`);
  }
  assert.match(shell, /!\(storeShell && STORE_SHELL_DROPPED_SCREENS\.has\(id\)\)/);
  // Every call passes the flag — a call without it would count a different
  // sequence and resume onto a screen the app does not show.
  const calls = shell.match(/buildSequence\([^)]*\)/g) ?? [];
  assert.ok(calls.length >= 6, 'anchor moved');
  // `buildSequence()` is prose in a comment; `buildSequence(kind…` is the definition.
  for (const c of calls.filter((c) => c !== 'buildSequence()' && !c.startsWith('buildSequence(kind'))) {
    assert.match(c, /, storeShell\)$/, c);
  }
  const page = src('app/onboarding/wedding/page.tsx');
  assert.match(page, /storeShell=\{storeShell\}/);
  assert.match(page, /onboardingServicesStepEnabled\(\) && !storeShell/);
  for (const f of ['app/onboarding/simple/page.tsx', 'app/onboarding/[type]/page.tsx']) {
    assert.match(src(f), /onboardingServicesStepEnabled\(\) && !\(await isStoreShellRequest\(\)\)/, f);
  }
});

test('wiring: the vendor side shows no plan upsell, add-on price or pack in the store shell', () => {
  const gate = src('app/vendor-dashboard/_components/tier-gate.tsx');
  assert.match(gate, /export async function VendorTierGate/);
  assert.match(gate, /\{storeShell \? \(/);
  assert.match(gate, /export async function VendorTierTeaser[\s\S]*?if \(await isStoreShellRequest\(\)\) return null;/);
  before('app/vendor-dashboard/shop/page.tsx', /\{storeShell \? null : isEnterprise \? \(/, '<BranchManager');
  assert.match(src('app/vendor-dashboard/team/page.tsx'), /\{canBuySeats && !storeShell \? \(/);
  const recs = src('app/vendor-dashboard/recommendations/page.tsx');
  assert.equal((recs.match(/formatSkuPriceLabel\(/g) ?? []).length, 1, 'every price label goes through priceLabelFor');
  assert.match(recs, /storeShell \? null : formatSkuPriceLabel\(row, null\)/);
  assert.match(
    src('app/vendor-dashboard/on-the-day/live/[eventId]/papic/page.tsx'),
    /offerPack=\{portfolioCredits\.offerPack && !\(await isStoreShellRequest\(\)\)\}/,
  );
  assert.match(src('app/vendor-dashboard/layout.tsx'), /planHref=\{storeShell \? null : '\/vendor-dashboard\/subscription'\}/);
});

test('wiring: couple-side upsells and web-bought features stay out of the store shell', () => {
  assert.match(src('app/dashboard/[eventId]/studio/save-the-date/page.tsx'), /\) : storeShell \? null \/\*/);
  assert.match(src('app/dashboard/[eventId]/monogram/page.tsx'), /owned=\{ownsAnimated && !storeShell\}/);
  assert.match(src('app/papic/seat/[token]/page.tsx'), /buyOffered=\{canReloadOwnCamera && !storeShell\}/);
});
