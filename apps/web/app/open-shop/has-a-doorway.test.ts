/**
 * A signed-in person with no shop can REACH /open-shop.
 *
 * ── WHY THIS EXISTS (2026-08-10) ───────────────────────────────────────────
 * /open-shop is a finished wizard whose own docblock lists "logged in, no shop
 * → the onboarding wizard" as a supported state. Every doorway to it pointed
 * somewhere a signed-in customer never goes:
 *
 *   • /vendors ....................... the PUBLIC marketing page (3 links), not
 *                                      linked from any dashboard surface
 *   • /vendor-dashboard/shop ......... requires ALREADY having a shop
 *
 * And the one apparent fallback — `if (data === 'no-vendor') redirect('/open-
 * shop')` in vendor-dashboard/shop/page.tsx — is DEAD CODE: the vendor-dashboard
 * LAYOUT redirects any non-vendor to /dashboard, and a layout runs before the
 * page it wraps. It reads like a safety net and can never fire.
 *
 * So the account could see a tile headed "Yours to run" under a Store glyph
 * with no way to run anything.
 *
 * 🔑 TWO doorways, not one, because they reach DIFFERENT people. The launcher
 * only renders for an account with 0 or 2+ active events — a couple with
 * exactly ONE is redirected straight into that event (`active.length === 1 &&
 * !hasConsole`) and never sees the launcher. The switcher is on every surface
 * and is the only one that reaches them. Prod today: of the 5 test accounts,
 * two are in exactly that single-event state.
 *
 * ⚠ DELIBERATELY NARROW, matching vendor-dashboard/activities/has-a-doorway.
 * A blanket "every route must be linked" check fires on redirect stubs, QR
 * deep-links and dynamic segments — all correct, all unlinked. A guard that
 * cries wolf teaches its reader to skim past the one time it is right. This
 * asserts two specific doorways for one specific page.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const WEB = join(HERE, '../..');

const SWITCHER = join(WEB, 'app/_components/account-switcher/account-switcher.tsx');
const LAUNCHER = join(WEB, 'app/dashboard/(launcher)/page.tsx');

test('the account switcher offers /open-shop to someone with no shop', () => {
  const src = readFileSync(SWITCHER, 'utf8');
  assert.ok(
    src.includes('href="/open-shop"'),
    'The switcher is the ONLY doorway that reaches a couple with exactly one ' +
      'event — they never see the launcher. Without this they cannot open a ' +
      'shop from inside the app at all.',
  );
  // Gated on NOT having a shop: a vendor already gets the "Shop" console tile
  // in the rail above, and offering both is two doors to two different places
  // wearing the same word.
  assert.ok(
    src.includes('!data.context.hasVendor'),
    'The open-shop link must be gated on having no shop, or a vendor sees ' +
      '"Open your shop" next to their existing Shop console.',
  );
});

test('the launcher offers /open-shop to someone with no shop', () => {
  const src = readFileSync(LAUNCHER, 'utf8');
  assert.ok(
    src.includes('href="/open-shop"'),
    'The "Yours to run" tile is headed with a Store glyph. Without this row ' +
      'it offers everything EXCEPT the shop.',
  );
  assert.ok(
    src.includes('!roles.hasVendorAccess ? <OpenShopRow />'),
    'The row must be gated on the same flag the real shop rows use, so the ' +
      'create-door and a real shop row can never both render.',
  );
});

/**
 * The reason the doorways above had to be added at all. If someone later makes
 * this redirect reachable (by moving the vendor gate out of the layout), that
 * is a real third doorway — but until then it must not be mistaken for one.
 */
test('the shop-page redirect is still unreachable, so it is not a doorway', () => {
  const layout = readFileSync(join(WEB, 'app/vendor-dashboard/layout.tsx'), 'utf8');
  assert.ok(
    layout.includes("redirect('/dashboard')"),
    'The vendor-dashboard layout no longer bounces non-vendors. Re-check ' +
      'whether vendor-dashboard/shop\'s `no-vendor` redirect now reaches ' +
      'people — if it does, this file\'s reasoning needs updating.',
  );
});
