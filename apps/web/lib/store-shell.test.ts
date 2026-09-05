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
  isStoreShellSignals,
  isStoreShellWebOnlyPath,
  STORE_SHELL_HIDDEN_ADDON_KEYS,
  STORE_SHELL_WEB_ONLY_STUDIO_SEGMENTS,
} from './store-shell';
import { ADD_ONS } from './add-ons-catalog';

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
  const mustHide = ADD_ONS.filter((a) => a.tier !== 'free' || a.serviceKey).map((a) => a.key);
  const missing = mustHide.filter((k) => !STORE_SHELL_HIDDEN_ADDON_KEYS.has(k));
  assert.deepEqual(
    missing,
    [],
    `add-ons that sell something but are not in STORE_SHELL_HIDDEN_ADDON_KEYS: ${missing.join(', ')}`,
  );
  // And nothing in the set is a phantom — every hidden key is a real catalog key.
  const catalogKeys = new Set(ADD_ONS.map((a) => a.key));
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
