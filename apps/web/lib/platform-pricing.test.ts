/**
 * Platform-aware pricing markup invariants (Node built-in test runner via tsx —
 * `pnpm test:unit`).
 *
 * Locks the native (iOS/Android) store-cut markup:
 *   • web → base, unchanged (the price floor — we never undercharge);
 *   • native → +NATIVE_PRICE_MARKUP_PCT, rounded to whole pesos;
 *   • centavos + pesos wrappers agree.
 * (getRequestPlatform reads headers() and is exercised at the integration layer,
 * not here — these tests cover the pure markup math.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  NATIVE_PRICE_MARKUP_PCT,
  isNativePlatform,
  applyPlatformMarkupCentavos,
  applyPlatformMarkupPesos,
} from './platform-pricing';

test('markup constant is 30%', () => {
  assert.equal(NATIVE_PRICE_MARKUP_PCT, 30);
});

test('isNativePlatform classifies ios/android as native, web as not', () => {
  assert.equal(isNativePlatform('ios'), true);
  assert.equal(isNativePlatform('android'), true);
  assert.equal(isNativePlatform('web'), false);
});

test('web price is the base, unchanged', () => {
  assert.equal(applyPlatformMarkupCentavos(399900, 'web'), 399900); // ₱3,999
  assert.equal(applyPlatformMarkupPesos(999, 'web'), 999); // ₱999
});

test('native price is base ×1.30, rounded to whole pesos', () => {
  // ₱3,999 → ₱5,198.7 → ₱5,199
  assert.equal(applyPlatformMarkupCentavos(399900, 'ios'), 519900);
  assert.equal(applyPlatformMarkupPesos(3999, 'android'), 5199);
  // ₱999 → ₱1,298.7 → ₱1,299
  assert.equal(applyPlatformMarkupPesos(999, 'ios'), 1299);
  // ₱2,999 → ₱3,898.7 → ₱3,899
  assert.equal(applyPlatformMarkupPesos(2999, 'android'), 3899);
});

test('ios and android markup are identical', () => {
  assert.equal(
    applyPlatformMarkupCentavos(249900, 'ios'),
    applyPlatformMarkupCentavos(249900, 'android'),
  );
});

test('centavos and pesos wrappers agree', () => {
  const pesos = applyPlatformMarkupPesos(4999, 'ios');
  const centavos = applyPlatformMarkupCentavos(499900, 'ios');
  assert.equal(centavos, pesos * 100);
});
