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
    join(__dirname, '../app/vendor-dashboard/subscription/_components/plan-picker.tsx'),
    'utf8',
  );
  // Match the multiplier, not the digits: `1.5` alone hits Tailwind spacing
  // classes (`gap-1.5`, `py-1.5`) all over the file and fails on a clean tree.
  assert.ok(
    !/MOBILE_SRP|mobileSrp|SRP_MULTIPLIER/.test(src),
    'a channel-dependent price multiplier is back',
  );
  assert.ok(!/isNativeApp/.test(src), 'the plan picker should not branch on native-ness at all');
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
  // The board moved into one component (Details part 3) — the page and the Maker's Details both draw it.
  const s = src('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  assert.equal((s.match(/<MakeItReal\b/g) ?? []).length, 1, 'one mount — every mount must be gated');
  // Since Details part 3 the board's parts are nodes, drawn by the page and the Maker alike.
  // 🍎 …except where Apple sells the pack (2026-10-23): `appleIap` is false whenever the gate is (the store shell
  // AND the build AND the switch), so with the gate off the store shell still mounts nothing.
  assert.match(s, /const appleIap = storeShell && \(await getIapGate\(\)\)\.iap;/);
  assert.match(s, /const makeItReal = storeShell && !appleIap \? null : \(\s*<MakeItReal\b/);
  assert.match(s, /\.\.\.\(storeShell && !appleIap \? \[\] : \[\{ href: '#make-it-real'/, 'the jump link would point at nothing');
});

test('wiring: the dashboard withholds the Sai pitch and a web-bought Sai in the store shell', () => {
  const s = src('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  // 🍎 The third argument is `iap` (2026-10-23) — false unless Apple sells Sai in this app.
  assert.match(s, /const aiActive =[^;]*storeShellAllowsPaidFeature\(storeShell, aiPaywallEnabled, storeShell && \(await appleIapRead\) === true\)/);
  assert.match(s, /const appleIapRead = startAhead\(getIapGate\(\)\.then\(\(g\) => g\.iap, \(\) => false\)\);/);
  const mounts = s.match(/<FreeVenueShortlistOffer\b[^>]*\/>/g) ?? [];
  assert.ok(mounts.length > 0, 'anchor moved');
  for (const m of mounts) assert.match(m, /sell=\{!storeShell\}/, m);
  const v = src('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(v, /const aiActive =[^;]*storeShellAllowsPaidFeature\(storeShell, paywallEnabled, appleIap\)/);
  assert.match(v, /const appleIap = storeShell && \(await appleIapRead\) === true;/);
  assert.match(
    v,
    /const aiOffer =\s*shouldOfferSetnayanAiPurchaseForEvent\(ev, aiGateOpts\) &&\s*\(!storeShell \|\| \(appleIap && \(await setnayanAiSoldInApp\(createAdminClient\(\), eventId\)\) === 'sellable'\)\);/,
    'the Sai banner shows in the store shell beyond where Apple sells it',
  );
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
  /* RE-AIMED 2026-10-21: the work is its own chunk (`store-shell-link-guard-run.ts`), fetched only after that check —
     the Maker's first load sits at its ceiling. Same three properties, read across the two files. */
  const after = guard.slice(guard.indexOf('if (!isStoreShellInBrowser('));
  assert.match(after, /import\('\.\/store-shell-link-guard-run'\)\.then\(\(m\) => \{\s*if \(!gone\) stop = m\.guardStoreShellLinks\(\);/, 'the work is not started after the store-shell check');
  assert.doesNotMatch(guard, /^import[^;]*store-shell-link-guard-run/m, 'the work is imported statically — back in every first load');
  const run = src('app/_components/store-shell-link-guard-run.ts');
  assert.match(run, /setProperty\('display', 'none', 'important'\)/, '`hidden` alone loses to utility classes');
  assert.match(run, /storeShellHidesHref\(/, 'must key on the registry, not a list of its own');
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
  // Try-first (2026-09-30): the manager mounts for every plan on the web, and
  // still never in the store shell.
  // Since step 5 (2026-10-14) the branch panel is its own file, mounted on Your details.
  before('app/vendor-dashboard/shop/_components/branch-panel.tsx', /\{storeShell \? null : \(/, '<BranchManager');
  // The Helpers screen moved into `helpers-view.tsx` (simpler supplier dashboard step 6); the page hands it storeShell.
  assert.match(src('app/vendor-dashboard/team/_components/helpers-view.tsx'), /\{canBuySeats && !storeShell \? \(/);
  assert.match(src('app/vendor-dashboard/team/page.tsx'), /storeShell=\{storeShell\}/);
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

test('/for-suppliers — the supplier price-ladder marketing page — is a refused doorway (2026-09-25 drawer-footer audit)', () => {
  // Probed both ways: true for the page that quotes live vendor tier prices,
  // false for the couple's own event marketplace route that merely shares a
  // path SEGMENT with it (isStoreShellWebOnlyPath matches full paths).
  assert.equal(isStoreShellWebOnlyPath('/for-suppliers'), true);
  assert.equal(isStoreShellWebOnlyPath('/for-suppliers/'), true);
  assert.equal(STORE_SHELL_WEB_ONLY_DOORWAYS.has('/for-suppliers'), true);
  assert.equal(isStoreShellWebOnlyPath(`${EV}/vendors`), false, "the couple's in-event marketplace is not this page");
  assert.equal(isStoreShellWebOnlyPath('/vendor-dashboard'), false, "a shared prefix is not a shared path");

  const { storeShellHidesHref } = require('./store-shell') as typeof import('./store-shell');
  const here = 'https://www.setnayan.com/';
  assert.equal(storeShellHidesHref('/for-suppliers', here), true, 'the ☰ drawer footer\'s "For suppliers" link');
  assert.equal(storeShellHidesHref(`${EV}/vendors`, here), false);
});

test('wiring: the Mood Board back-link to the paid add-ons hub is withheld in the store shell', () => {
  // The destination (/studio) already filters its own grid to free tiles for
  // a store-shell visitor (STORE_SHELL_HIDDEN_ADDON_KEYS), but a native
  // reviewer should never be one tap from a screen framed as "add-ons" —
  // so the link itself, not just the paid tiles behind it, withdraws.
  // The board is one component since Details part 3; only its PAGE view carries the link (the Maker's never does).
  const page = src('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  // The services' address is `studioHubHref` since the full-page hub went
  // (owner 2026-10-02, tracker d1) — still withheld in the store shell.
  assert.match(page, /\{storeShell \? null : \(\s*<Link\s*\n\s*href=\{studioHubHref\(eventId\)\}/);
  assert.match(page, /‹ Back to add-ons/, 'anchor moved — the link text this test is guarding');
});

// ─── Sweep 2026-10-19 (rows A1 · C10 · C14) ────────────────────────────────

test('A1 — every /features page that sells is refused in the store shell, found by walking the registry', () => {
  // NOT a hand list: the registry decides. A feature priced anything but
  // `free` quotes a ₱ figure and an "Unlock …" step — the store shell showed
  // "PRICE ₱2,500 · Unlock Live Watch" before this. A `free` feature is a
  // planning page and stays open.
  const { FEATURE_PAGES } = require('./feature-pages') as typeof import('./feature-pages');
  const { STORE_SHELL_WEB_ONLY_FEATURE_SLUGS } = require('./store-shell') as typeof import('./store-shell');
  assert.ok(FEATURE_PAGES.length >= 20, `the registry walked only ${FEATURE_PAGES.length} pages — the anchor moved`);
  const sells = FEATURE_PAGES.filter((f) => f.price.kind !== 'free');
  assert.ok(sells.length > 0, 'no paid feature found — the anchor moved');
  const leaks: string[] = [];
  const overreach: string[] = [];
  for (const f of FEATURE_PAGES) {
    for (const path of [`/features/${f.slug}`, `/tl/features/${f.slug}`, `/features/${f.slug}/`]) {
      const refused = isStoreShellWebOnlyPath(path);
      if (f.price.kind !== 'free' && !refused) leaks.push(`${path} (${f.price.kind})`);
      if (f.price.kind === 'free' && refused) overreach.push(path);
    }
  }
  assert.deepEqual(leaks, [], `feature pages that quote a price, open in the store shell: ${leaks.join(', ')}`);
  assert.deepEqual(overreach, [], `free planning feature pages refused in the store shell: ${overreach.join(', ')}`);
  // No phantom slugs: every hand-listed slug is a real, selling registry page.
  const selling = new Set(sells.map((f) => f.slug as string));
  for (const s of STORE_SHELL_WEB_ONLY_FEATURE_SLUGS) assert.ok(selling.has(s), `"${s}" is not a selling feature page`);
  // Both hubs list every price. /features is bounced by the native brochure
  // rule in middleware; its Tagalog twin is a doorway here.
  assert.equal(isStoreShellWebOnlyPath('/tl/features'), true, '/tl/features lists prices');
  assert.match(src('middleware.ts'), /APP_EXCLUDED_MARKETING_PATHS = new Set\(\[[^\]]*'\/features',/, '/features must stay in the brochure bounce');
  // And the link guard hides a "Works with" link to one from a free page.
  const { storeShellHidesHref } = require('./store-shell') as typeof import('./store-shell');
  assert.equal(storeShellHidesHref('/features/live-watch', 'https://www.setnayan.com/features/budget'), true);
  assert.equal(storeShellHidesHref('/features/budget', 'https://www.setnayan.com/features/guest-list'), false);
});

test('C10 — /web-only offers a signed-out visitor Sign in, never a dashboard they do not have', () => {
  const page = src('app/(shell)/web-only/page.tsx');
  assert.match(page, /const user = await getCurrentUser\(\);/);
  assert.match(page, /user\s*\?\s*\{ href: '\/dashboard', label: 'Back to your dashboard' \}\s*:\s*\{ href: '\/login', label: 'Sign in' \}/);
  assert.equal((page.match(/href="\/dashboard"/g) ?? []).length, 0, 'an unconditional dashboard link is back');
});

test('C14 — the upsell lines whose links the guard hid say nothing in the store shell', () => {
  const lock = src('app/dashboard/[eventId]/website/_components/website-pro-lock.tsx');
  assert.match(lock, /if \(await isStoreShellRequest\(\)\) \{\s*if \(variant === 'inline'\) return null;/);
  // The store-shell branch returns before the card, and names no PRO, price or unlock.
  const shellBranch = lock.slice(lock.indexOf('if (await isStoreShellRequest())'), lock.indexOf('const upsellHref'));
  assert.ok(shellBranch.length > 0, 'anchor moved');
  assert.doesNotMatch(shellBranch, /PRO|Unlock|unlock|₱|studio\/website-pro/);
  assert.match(
    src('app/vendor-dashboard/shop/_components/voice-match-section.tsx'),
    /if \(!advancedActive && \(await isStoreShellRequest\(\)\)\) return null;/,
  );
  assert.match(src('app/_components/thread-call-launcher.tsx'), /if \(viewerRole !== 'vendor' \|\| storeShell\) return null;/);
  const otd = src('app/vendor-dashboard/on-the-day/page.tsx');
  assert.match(otd, /\{storeShell\s*\?\s*'Your booking and shop listing are unaffected\.'/);
  assert.match(otd, /\{storeShell \? null : \(\s*<Link\s*href="\/vendor-dashboard\/subscription"/);
  // The Suppliers search overlay's last-minute "Unlock with Setnayan AI" (sweep
  // 2026-10-19 leftover): its button points at a refused Studio page, so the link
  // guard would leave the pitch with no button. In the app the plain empty line shows.
  const overlay = src('app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx');
  assert.match(overlay, /const storeShell = useIsStoreShell\(\);/);
  assert.match(overlay, /results\.length === 0 && lastMinuteLocked && !storeShell \?/);
});

const STORE_SHELL_CASES: ReadonlyArray<{ ua: string; cookie: string }> = [
  { ua: CAPACITOR_UA, cookie: '' },
  { ua: CAPACITOR_UA, cookie: 'a=1; setnayan-client-type=capacitor' },
  { ua: CAPACITOR_UA, cookie: 'setnayan-client-type=tauri' },
  { ua: SAFARI_UA, cookie: 'setnayan-client-type=capacitor; b=2' },
  { ua: SAFARI_UA, cookie: '' },
  { ua: SAFARI_UA, cookie: 'other=capacitor' },
  { ua: TAURI_UA, cookie: '' },
  { ua: TAURI_UA, cookie: 'setnayan-client-type=tauri' },
  { ua: '', cookie: '' },
];

test('"Coming soon" — the <head> mark answers exactly what isStoreShellInBrowser answers (the .dmg is never marked)', () => {
  const { storeShellMarkScript, STORE_SHELL_HTML_ATTR } = require('./store-shell') as typeof import('./store-shell');
  let sawTrue = false;
  let sawFalse = false;
  for (const c of STORE_SHELL_CASES) {
    const attrs = new Map<string, string>();
    const documentFake = {
      cookie: c.cookie,
      documentElement: { setAttribute: (k: string, v: string) => attrs.set(k, v) },
    };
    new Function('navigator', 'document', storeShellMarkScript)({ userAgent: c.ua }, documentFake);
    const expected = isStoreShellInBrowser(c.ua, c.cookie);
    if (expected) sawTrue = true;
    else sawFalse = true;
    assert.equal(attrs.has(STORE_SHELL_HTML_ATTR), expected, `ua=${c.ua.slice(-24)} cookie=${c.cookie}`);
  }
  assert.ok(sawTrue && sawFalse, 'the table must exercise both answers');
});

test('"Coming soon" — wiring: the mark runs in <head> and one CSS rule hides every [data-coming-soon] under it', () => {
  const layout = src('app/layout.tsx');
  assert.equal((layout.match(/__html: storeShellMarkScript/g) ?? []).length, 1, 'mounted exactly once');
  assert.ok(
    layout.indexOf('__html: storeShellMarkScript') < layout.indexOf('</head>'),
    'the mark must run in <head>, before the first paint',
  );
  const css = src('app/globals.css');
  assert.match(css, /html\[data-store-shell\] \[data-coming-soon\] \{\s*display: none !important;\s*\}/);
});

test('"Coming soon" — every one the store shell can open sits inside a [data-coming-soon] element', () => {
  // A PROPERTY of the tree, not a list of files: every JSX text, string or
  // template inside JSX that says "coming soon" must have an ancestor element
  // carrying `data-coming-soon`. Routes the store shell is refused anyway
  // (/pricing, /studio/papic, the vendor subscription page…) are skipped —
  // found by asking `isStoreShellWebOnlyPath`, not by name — and so are the
  // admin console and API routes (no JSX the app shows).
  const ts = require('typescript') as typeof import('typescript');
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const root = join(__dirname, '..');
  const appDir = join(root, 'app');
  const SAYS = /coming\s+soon/i;
  // A bare "soon" LABEL says the same thing in one word — the onboarding faith
  // chip, Alaala's "· soon", the download overlay's store tiles (sweep
  // 2026-10-19). Only a whole label counts ("soon" alone, or "… · soon"), never
  // prose that happens to contain the word ("we'll reply soon").
  const SAYS_LABEL = /^\s*(?:·\s*)?soon\s*$|·\s*soon\s*$/i;
  const FILE_SAYS = /coming\s+soon|\bsoon\b/i;
  // A bare "soon" that is a STATUS of something real, not a roadmap pill.
  // Each line is a reason; a new entry needs one.
  const SOON_IS_A_STATUS = new Map<string, string>([
    ['app/[slug]/find-seat/page.tsx', 'a guest\'s seat is shown on the event day — "Find your seat · soon" is a true date fact'],
    ['app/vendor-dashboard/performance/_components/verified-median-card.tsx', 'the verified price appears once enough locked bookings exist — a metric status'],
  ]);

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name === '.next') continue;
        walk(p);
      } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) files.push(p);
    }
  };
  walk(appDir);
  assert.ok(files.length > 500, `walked only ${files.length} .tsx files — the anchor moved`);

  /** The URL a file renders under: route groups dropped, private folders end it. */
  const routeOf = (abs: string): string => {
    const parts = abs.slice(appDir.length + 1).split('/').slice(0, -1);
    const segs: string[] = [];
    for (const s of parts) {
      if (s.startsWith('_')) break;
      if (s.startsWith('(') && s.endsWith(')')) continue;
      segs.push(s.startsWith('[') ? 'x' : s);
    }
    return '/' + segs.join('/');
  };

  const offenders: string[] = [];
  let scanned = 0;
  let marked = 0;
  for (const abs of files) {
    const rel = abs.slice(root.length + 1);
    if (/^app\/(admin|api)\//.test(rel)) continue;
    const text = readFileSync(abs, 'utf8');
    if (!FILE_SAYS.test(text)) continue;
    if (isStoreShellWebOnlyPath(routeOf(abs))) continue;
    scanned++;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const hasMark = (attrs: import('typescript').JsxAttributes) =>
      attrs.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === 'data-coming-soon');
    const inJsx = (n: import('typescript').Node): boolean => {
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxFragment(p)) return true;
        if (ts.isFunctionLike(p)) return false;
      }
      return false;
    };
    const markedAbove = (n: import('typescript').Node): boolean => {
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isJsxElement(p) && hasMark(p.openingElement.attributes)) return true;
        if (ts.isJsxSelfClosingElement(p) && hasMark(p.attributes)) return true;
      }
      return false;
    };
    const visit = (n: import('typescript').Node) => {
      const says =
        (ts.isJsxText(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
        (SAYS.test(n.text) || (ts.isJsxText(n) && SAYS_LABEL.test(n.text)))
          ? true
          : ts.isTemplateExpression(n) && SAYS.test(n.getText(sf));
      if (says && inJsx(n) && !(SOON_IS_A_STATUS.has(rel) && !SAYS.test(n.getText(sf)))) {
        if (markedAbove(n)) marked++;
        else {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          offenders.push(`${rel}:${line + 1}`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  assert.ok(scanned >= 10, `only ${scanned} open files say "coming soon" — the anchor moved`);
  assert.ok(marked >= 12, `only ${marked} marked "coming soon" found — the scan is not reaching them`);
  assert.deepEqual(
    offenders,
    [],
    `"Coming soon" the store shell would show — wrap it (or its card) in an element with data-coming-soon: ${offenders.join(', ')}`,
  );
});

// ─── 🍎 Apple check 2026-10-19 (rows #5 · #14 · #26) ──────────────────────────
// What the iPhone app SHOWS on a page it can open, not only which pages it may
// open. Read: ~/Documents/Claude/Projects/shots-2026-10-19/apple-check/.

test('🍎 #5/#26 — the marketing header shows no Prices · Download · Suppliers in the store shell, and HomeOverlays opens only Sign in there', () => {
  const ts = require('typescript') as typeof import('typescript');
  // 1. Every header button that opens an overlay other than Sign in sits
  //    inside a [data-web-only] element — found by walking the JSX, not by label.
  const navText = src('app/_components/marketing/site-nav.tsx');
  const nav = ts.createSourceFile('site-nav.tsx', navText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hasAttr = (attrs: import('typescript').JsxAttributes, name: string) =>
    attrs.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(nav) === name);
  const opened: string[] = [];
  const unhidden: string[] = [];
  const visit = (n: import('typescript').Node) => {
    if (ts.isCallExpression(n) && n.expression.getText(nav) === 'press' && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      const id = n.arguments[0].text;
      if (id !== 'signin') {
        opened.push(id);
        let hidden = false;
        for (let p = n.parent; p; p = p.parent) {
          if (ts.isJsxElement(p) && hasAttr(p.openingElement.attributes, 'data-web-only')) hidden = true;
        }
        if (!hidden) unhidden.push(id);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(nav);
  assert.ok(opened.length >= 3, `found only ${opened.length} header overlay buttons — the anchor moved`);
  assert.deepEqual(unhidden, [], `header buttons that open a selling overlay and still show in the app: ${unhidden.join(', ')}`);

  // 2. HomeOverlays' store-shell branch renders Sign in and nothing else —
  //    compared against EVERY overlay the web branch mounts, derived from it.
  const ov = src('app/_components/home/HomeOverlays.tsx');
  const fnAt = ov.indexOf('export function HomeOverlays(');
  assert.ok(fnAt > 0, 'HomeOverlays moved');
  const body = ov.slice(fnAt);
  const gate = body.search(/const storeShell = useIsStoreShell\(\);\s*if \(storeShell\) \{/);
  assert.ok(gate > 0, 'HomeOverlays no longer asks the store-shell question');
  const branch = body.slice(gate, body.indexOf('}', body.indexOf('if (storeShell) {', gate)) + 1);
  const webBranch = body.slice(gate + branch.length);
  const tag = /<([A-Z][A-Za-z0-9]*(?:Overlay|Panel))\b/g;
  const everyOverlay = new Set([...webBranch.matchAll(tag)].map((m) => m[1]!));
  assert.ok(everyOverlay.size >= 8, `the web branch mounts only ${everyOverlay.size} overlays — the anchor moved`);
  assert.ok(everyOverlay.has('SignInHerePanel') && everyOverlay.has('PricesOverlay') && everyOverlay.has('DownloadOverlay'));
  assert.deepEqual(
    [...branch.matchAll(tag)].map((m) => m[1]),
    ['SignInHerePanel'],
    'the store-shell branch of HomeOverlays mounts something other than Sign in',
  );
  assert.ok(webBranch.indexOf('<PricesOverlay') > 0, 'a selling overlay now mounts BEFORE the store-shell gate');

  // 3. The CSS halves: web-only hidden in the app, app-only hidden off it.
  const css = src('app/globals.css');
  assert.match(css, /html\[data-store-shell\] \[data-web-only\] \{\s*display: none !important;\s*\}/);
  assert.match(css, /html:not\(\[data-store-shell\]\) \[data-app-only\] \{\s*display: none !important;\s*\}/);
});

test('🍎 #14 — /web-only, where every refused route in the app lands, names no other platform and no other place to buy', () => {
  const { stripComments } = require('./strip-comments') as typeof import('./strip-comments');
  const page = stripComments(src('app/(shell)/web-only/page.tsx'));
  const jsx = page.slice(page.indexOf('export default'));
  assert.ok(jsx.includes('LegalLayout'), 'anchor moved');
  assert.doesNotMatch(jsx, /Android|Google Play|Windows|\bMac\b|desktop/i, '/web-only names another platform inside the iOS app');
  assert.doesNotMatch(jsx, /setnayan\.com|on the web|website|pricing|₱/i, '/web-only points to where else to buy — the steering 3.1.1 forbids');
});

test('🍎 #5/#14 — nothing that sells or names Android renders on a route the app can open (every route walked)', () => {
  // A PROPERTY of the tree. Every .tsx under app/ is walked; a file is skipped
  // only when the app can never render it: admin and API routes, the dev labs
  // (404 in production — the-lab-never-ships.test.ts), routes middleware
  // refuses (`isStoreShellWebOnlyPath`), and route files of the brochure pages
  // middleware bounces to /login (`APP_EXCLUDED_MARKETING_PATHS`, read from
  // middleware.ts). Shared components (`_*` folders) are never skipped — they
  // render everywhere.
  //
  // A hit — "Buy …", "Upgrade …", "Unlock Pro / Setnayan AI / Event Hub /
  // Animation / with …" (the selling uses; a layer's Lock/Unlock or "Unlock
  // my service" is not a sale), "Android", "Google Play",
  // "setnayan.com/pricing", "one-time purchase" in JSX text or a string — is
  // fine when ANY of these holds:
  //   · it sits inside a [data-web-only] or [data-coming-soon] element (hidden
  //     before first paint in the store shell);
  //   · it sits inside a <Link>/<a> whose href the app refuses — a literal, a
  //     template, or a const in the same file holding one — so the link guard
  //     hides that element (storeShellHidesHref);
  //   · a function it sits in asks the store-shell question (storeShell,
  //     isStoreShellRequest, useIsStoreShell, the IAP gate, isNativeShell) —
  //     the component decides, and its own wiring test holds the decision;
  //   · its file is listed below with WHERE the decision is made instead —
  //     and that gate is asserted to still be there, so a reason cannot rot.
  const ts = require('typescript') as typeof import('typescript');
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  const root = join(__dirname, '..');
  const appDir = join(root, 'app');
  const SELLS =
    /\b(?:Buy|Upgrade)\b|\bUnlock (?:Pro|Setnayan|Event Hub|Animation|with)\b|\bAndroid\b|Google Play|setnayan\.com\/pricing|one-time purchase/;
  const FILE_SELLS = /Buy|Upgrade|Unlock|Android|Google Play|setnayan\.com\/pricing|one-time purchase/;
  const ASKS = /\bstoreShell\b|isStoreShell|useIsStoreShell|StoreShell|iapAvailable|getIapGate|\biap\b|isNative(?:Shell|App)\b/;
  type Why = { why: string; gate?: { file: string; re: RegExp } };
  const DECIDED_ELSEWHERE = new Map<string, Why>([
    ['app/_components/home/HomeOverlays.tsx', { why: 'the Download overlay names Android; HomeOverlays mounts it only off the store shell', gate: { file: 'app/_components/home/HomeOverlays.tsx', re: /const storeShell = useIsStoreShell\(\);\s*if \(storeShell\) \{/ } }],
    ['app/_components/nfc-write-button.tsx', { why: '"…or Chrome on Android" is the title only when NO NFC writer exists; the app carries the native writer, so that branch never renders there' }],
    ['app/_components/app-store/layout.tsx', { why: '"Buy what you need" heads the plans of a PAID Studio feature; every paid /studio/about/<key> and its home is refused in the app, and a free key has no plans' }],
    ['app/_components/app-store/studio-card-demo.tsx', { why: 'drawn only inside app-store/layout.tsx (above)', gate: { file: 'app/_components/app-store/layout.tsx', re: /<StudioCardDemo\b/ } }],
    ['app/_components/iap/iap-papic-sheet.tsx', { why: 'the Apple In-App Purchase sheet — selling through Apple is what 3.1.1 asks for; it mounts only when iapAvailable' }],
    ['app/_components/iap/apple-pro-screen.tsx', { why: 'the Apple In-App Purchase screen (/apple-pro); it sends the user back unless iapAvailable' }],
    ['app/_components/maker-media-meter.tsx', { why: '"Unlock Pro" needs a proHref; the Maker passes none in the store shell (an IAP build gets /apple-pro)', gate: { file: 'lib/hub-draft-store.ts', re: /proHref: iap \? [^:]+ : storeShell \? null :/ } }],
    ['app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx', { why: '"Unlock Pro and Apply" renders only with a proHref — same Maker gate', gate: { file: 'lib/hub-draft-store.ts', re: /proHref: iap \? [^:]+ : storeShell \? null :/ } }],
    ['app/dashboard/[eventId]/_components/setnayan-ai-comeback-offer.tsx', { why: 'the event dashboard mounts it only off the store shell', gate: { file: 'app/dashboard/[eventId]/page.tsx', re: /aiOffer && aiOfferSettings && !storeShell \? \(\s*<SetnayanAiComebackOffer\b/ } }],
    ['app/dashboard/[eventId]/monogram/animate-rows.tsx', { why: 'its "Unlock Animation & Apply" drawer needs a `checkout`, which the page builds only off the store shell', gate: { file: 'app/dashboard/[eventId]/monogram/page.tsx', re: /if \(!ownsAnimated && !storeShell\) \{/ } }],
    ['app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx', { why: 'mounted only off the store shell', gate: { file: 'app/dashboard/[eventId]/monogram/page.tsx', re: /unlock=\{!storeShell && ownsAnimated \? <AnimatedMonogramUpgrade\b/ } }],
    ['app/dashboard/[eventId]/studio/mood-board/_components/make-it-real.tsx', { why: '"Buy more credits" lives in Make it real, which the board mounts in the store shell ONLY where Apple sells the pack (2026-10-23) — and there its Buy is Apple\'s sheet (`apple`)', gate: { file: 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx', re: /const makeItReal = storeShell && !appleIap \? null : \(\s*<MakeItReal\s+apple=\{appleIap\}/ } }],
    ['app/vendor-dashboard/shop/_components/voice-match-card.tsx', { why: 'drawn only by voice-match-section, which returns null in the store shell', gate: { file: 'app/vendor-dashboard/shop/_components/voice-match-section.tsx', re: /if \(!advancedActive && \(await isStoreShellRequest\(\)\)\) return null;/ } }],
  ]);

  const exclMatch = src('middleware.ts').match(/APP_EXCLUDED_MARKETING_PATHS = new Set\(\[([^\]]*)\]/);
  assert.ok(exclMatch, 'APP_EXCLUDED_MARKETING_PATHS moved out of middleware.ts');
  const bounced = new Set([...exclMatch![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!));
  assert.ok(bounced.has('/') && bounced.size >= 5, 'the brochure bounce list looks wrong');

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name === 'node_modules' || name === '.next') continue;
        walk(p);
      } else if (name.endsWith('.tsx') && !name.endsWith('.test.tsx')) files.push(p);
    }
  };
  walk(appDir);
  assert.ok(files.length > 500, `walked only ${files.length} .tsx files — the anchor moved`);

  const placeOf = (abs: string): { route: string; shared: boolean } => {
    const parts = abs.slice(appDir.length + 1).split('/').slice(0, -1);
    const segs: string[] = [];
    let shared = false;
    for (const s of parts) {
      if (s.startsWith('_')) {
        shared = true;
        break;
      }
      if (s.startsWith('(') && s.endsWith(')')) continue;
      segs.push(s.startsWith('[') ? 'x' : s);
    }
    return { route: '/' + segs.join('/'), shared };
  };

  const offenders: string[] = [];
  let scanned = 0;
  let gated = 0;
  let listed = 0;
  for (const abs of files) {
    const rel = abs.slice(root.length + 1);
    if (/^app\/(admin|api|dev)\//.test(rel)) continue;
    const text = readFileSync(abs, 'utf8');
    if (!FILE_SELLS.test(text)) continue;
    const { route, shared } = placeOf(abs);
    if (isStoreShellWebOnlyPath(route)) continue;
    if (!shared && bounced.has(route)) continue;
    scanned++;
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const attrNamed = (attrs: import('typescript').JsxAttributes, name: string) =>
      attrs.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === name) as
        | import('typescript').JsxAttribute
        | undefined;
    const openingOf = (p: import('typescript').Node) =>
      ts.isJsxElement(p) ? p.openingElement : ts.isJsxSelfClosingElement(p) ? p : null;
    /** The path an href names: a literal, a template (`${…}` → a segment), or a same-file const holding either. */
    const literalPath = (e: import('typescript').Node | undefined): string | null => {
      if (!e) return null;
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
      if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((sp) => 'x' + sp.literal.text).join('');
      return null;
    };
    const constInit = (name: string): import('typescript').Expression | undefined => {
      let found: import('typescript').Expression | undefined;
      const look = (k: import('typescript').Node) => {
        if (!found && ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.name.text === name) found = k.initializer;
        ts.forEachChild(k, look);
      };
      look(sf);
      return found;
    };
    const hrefPath = (init: import('typescript').JsxAttributeValue): string | null => {
      let e: import('typescript').Node | undefined = init;
      if (ts.isJsxExpression(init)) e = init.expression;
      if (e && ts.isIdentifier(e)) e = constInit(e.text);
      const p = literalPath(e);
      return p === null ? null : p.split(/[?#]/)[0]!;
    };
    const isGated = (n: import('typescript').Node): boolean => {
      for (let p = n.parent; p; p = p.parent) {
        const o = openingOf(p);
        if (o) {
          if (attrNamed(o.attributes, 'data-web-only') || attrNamed(o.attributes, 'data-coming-soon')) return true;
          const tagName = o.tagName.getText(sf);
          const href = attrNamed(o.attributes, 'href');
          if ((tagName === 'Link' || tagName === 'a') && href?.initializer) {
            const path = hrefPath(href.initializer);
            if (path && isStoreShellWebOnlyPath(path)) return true;
          }
        }
        if (ts.isFunctionLike(p) && ASKS.test(p.getText(sf))) return true;
      }
      return false;
    };
    const inJsx = (n: import('typescript').Node): boolean => {
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxFragment(p) || ts.isJsxAttribute(p)) return true;
        if (ts.isFunctionLike(p)) return false;
      }
      return false;
    };
    const visit = (n: import('typescript').Node) => {
      const says =
        (ts.isJsxText(n) || ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && SELLS.test(n.text);
      if (says && inJsx(n)) {
        if (isGated(n)) gated++;
        else if (DECIDED_ELSEWHERE.has(rel)) listed++;
        else {
          const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
          offenders.push(`${rel}:${line + 1} "${n.getText(sf).trim().slice(0, 60)}"`);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  console.log(`[store-shell sells-scan] ${scanned} app-reachable files say it · ${gated} gated · ${listed} listed · ${offenders.length} open`);
  assert.ok(scanned >= 15, `only ${scanned} files scanned — the anchor moved`);
  assert.ok(gated >= 10, `only ${gated} gated hits — the scan is not reaching them`);
  assert.deepEqual(
    offenders,
    [],
    'Words that sell (or name Android) on a page the iPhone app can open. Gate them on the store shell, mark them data-web-only, or list them in DECIDED_ELSEWHERE with where the decision is made:\n  ' +
      offenders.join('\n  '),
  );
  // No stale reasons: every listed file still says it, and every cited gate is still where it is said to be.
  for (const [rel, { gate }] of DECIDED_ELSEWHERE) {
    assert.match(src(rel), FILE_SELLS, `${rel} no longer says it — drop it from DECIDED_ELSEWHERE`);
    if (gate) assert.match(src(gate.file), gate.re, `${rel}: the gate it relies on moved out of ${gate.file}`);
  }
});
