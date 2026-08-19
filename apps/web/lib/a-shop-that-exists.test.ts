/**
 * a-shop-that-exists.test.ts — a refused shop list must not read as "you have none".
 *
 * `fetchUserRoleSummary` reads the shops a person OWNS. The error was bound and
 * logged — and then `?? []` turned the refusal into an empty list anyway, so
 * `ownedShopCount` fell to 0, `canOpenAnotherShop(0)` returned true, and the
 * account menu offered **"Create your shop"** to a supplier who already has one.
 *
 * That contradicted the promise in `account-switcher.tsx`'s own docblock:
 * "a vendor who already owns one gets canOpenShop === false".
 *
 * ⚖ IT FAILS CLOSED, AND THE DIRECTION IS THE DECISION. Hiding the button for
 * one render is small and self-correcting. A duplicate shop is not: shop
 * addresses are IMMUTABLE once minted, so the mistake is permanent and needs an
 * admin to unpick. Compare the opposite ruling on the ₱2,500 photo wall, which
 * fails OPEN because an unrecognised value must not silently delete a feature
 * somebody paid for. Neither default is universal — pick by what the wrong
 * answer costs.
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const roles = stripComments(readFileSync(join(HERE, 'roles.ts'), 'utf8'));

test('the owned-shops read reports whether it happened', () => {
  assert.match(roles, /const shopsMeasured = !ownedRes\.error;/);
});

test('canOpenShop fails CLOSED on an unmeasured read', () => {
  assert.match(
    roles,
    /canOpenShop: shopsMeasured && canOpenAnotherShop\(ownedShopCount\)/,
    'an unmeasured shop list must never read as "you have none"',
  );
  // The bare form is what shipped the defect; it must not come back.
  assert.doesNotMatch(
    roles,
    /canOpenShop: canOpenAnotherShop\(ownedShopCount\)/,
    'the ungated derivation must be gone, not merely shadowed',
  );
});

test('the flag is actually returned, so a caller can see it', () => {
  assert.match(roles, /\n\s*shopsMeasured,\n/, 'shopsMeasured must be on the returned summary');
});

test('the anonymous fallback was already closed and stays closed', () => {
  const switcher = stripComments(
    readFileSync(join(HERE, '..', 'app/_components/account-switcher/get-switcher-data.ts'), 'utf8'),
  );
  assert.match(
    switcher,
    /canOpenShop: false/,
    'the signed-out/degraded fallback must not offer to open a shop either',
  );
});
