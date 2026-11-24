/**
 * 🏪 THE SUPPLIER PLANS WAIT FOR THEIR APP VERSION — 1.0 (build 9) never shows or sells them.
 *
 * The "Supplier plans" subscriptions (`com.setnayan.app.supplier_*_monthly`, lib/iap/supplier-plans.ts) are NOT part of
 * the 1.0 App Store submission: pre-submit list 22 Nov, "Not part of the 1.0 submit"; corpus
 * SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md, "Does not gate the 1.0 App Store submit; ships with the next app
 * version". A reviewer of 1.0 who opened Shop ⚙ › Plan and billing must not meet Subscribe buttons for products the
 * submission does not carry (Apple 2.1: every in-app purchase the app offers is submitted with it). So:
 *
 *   1 · the door and the server both key on `iapSubscriptions` — `SetnayanIAP/4` or higher — never on plain `iap`;
 *   2 · the build on main (1.0 build 9) announces `/3`, which is NOT enough. The build that ships the plans with its
 *       version bumps apps/mobile/capacitor.config.ts to `/4` and changes test 2 and
 *       lib/the-app-opens-what-apple-sells.test.ts together.
 *
 * 🛡 Sabotaged 2026-11-24, each red then restored (PR body): the Shop ⚙ read keyed on `gate.iap` again turns 1 red;
 * the action's plan branch without the `iapSubscriptions` refusal turns 1 red; `hasStoreSubscriptions` matching `/3`
 * turns 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../strip-comments';
import { hasNativeStore, hasStoreQuantity, hasStoreSubscriptions, NATIVE_STORE_SUBSCRIPTION_UA_MARKER } from './iap-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the plan door and the plan purchase key on iapSubscriptions, never on plain iap', () => {
  const gear = code('app/vendor-dashboard/shop/_components/shop-settings-body.tsx');
  assert.match(gear, /gate\.iapSubscriptions \? readAppleShopPlan\(/, 'Shop ⚙ reads the Apple plan only where Apple sells the plans');
  assert.doesNotMatch(gear, /gate\.iap \? readAppleShopPlan\(/, 'Shop ⚙ draws the plan door in 1.0 again');

  const actions = code('lib/iap/iap-actions.ts');
  assert.match(actions, /const \{ iap, iapQuantity, iapSubscriptions \} = await getIapGate\(\);/);
  assert.match(actions, /if \(plan\) \{\s*if \(!iapSubscriptions\) return startRefusal\('unavailable'\);/, 'the server sells a plan to 1.0');

  const gate = code('lib/request-platform.ts');
  assert.match(gate, /iapSubscriptions: iap && hasStoreSubscriptions\(signals\.ua\)/);
  assert.match(gate, /if \(!signals\) return \{ storeShell: false, iap: false, iapQuantity: false, iapSubscriptions: false \};/);
});

test('2 · the build on main (1.0 build 9, /3) sells couple products and gifts, but not the plans', () => {
  assert.equal(NATIVE_STORE_SUBSCRIPTION_UA_MARKER, 'SetnayanIAP/4');
  for (const ua of ['', 'Mozilla SetnayanApp', 'Mozilla SetnayanApp SetnayanIAP/1', 'Mozilla SetnayanApp SetnayanIAP/2', 'Mozilla SetnayanApp SetnayanIAP/3']) {
    assert.equal(hasStoreSubscriptions(ua), false, `${ua || '(none)'} may sell the supplier plans`);
  }
  assert.equal(hasStoreSubscriptions('Mozilla SetnayanApp SetnayanIAP/4'), true);
  assert.equal(hasStoreSubscriptions('Mozilla SetnayanApp SetnayanIAP/12'), true, '/12 read as /1');

  const cfg = readFileSync(join(WEB, '..', 'mobile', 'capacitor.config.ts'), 'utf8');
  const ua = /ios:\s*\{[\s\S]*?appendUserAgent:\s*'([^']+)'/.exec(cfg)?.[1] ?? null;
  assert.ok(ua, 'the iOS build announces no user-agent tokens');
  assert.equal(hasNativeStore(ua), true, 'the build on main cannot sell through Apple at all');
  assert.equal(hasStoreQuantity(ua), true, 'the build on main cannot sell gifts');
  assert.equal(
    hasStoreSubscriptions(ua),
    false,
    'the build on main would show the supplier plans: only the app version that carries them in App Store Connect bumps to /4',
  );
});
