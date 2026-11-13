/**
 * 🔴 THE BOOKING GATE READS HIDE, SUSPEND AND BAN — Lane G item 1 (Build 5 plan · audit C1, 2026-11-10).
 *
 * The gate (`isMarketplaceVendorBookable` + the DB trigger `enforce_booking_requires_verified_vendor`) read ONLY
 * `verification_state`. Admin hide (`public_visibility`), the fraud auto-suspend (`fraud_suspended_at`) and the
 * fraud wipe+ban (`fraud_banned_at`) never touch that column — so a shop that had vanished from Find could still
 * be locked by a couple who had it shortlisted, and the couple was charged a booking fee.
 *
 * What this holds (the DB behaviour itself is `tests/db/booking-requires-verified.db.test.ts`):
 *   1. the pure rule `shopBookingRefusal` refuses each of the three, and fails closed on an absent column;
 *   2. the app gate selects ALL the rule's columns (a select that drops one silently fails closed for everybody,
 *      and a select that drops one AND a rule that tolerated `undefined` would let the shop through);
 *   3. the LATEST migration that defines the trigger function asks the same columns (it refuses suspend, ban and
 *      archived; 'hidden' is a documented gap — see 20271335513615's header and the pinned DB test);
 *   4. the wipe+ban demotes a verified shop, so every state-only reader agrees with the gate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { isShopBookable, SHOP_BOOKABLE_COLUMNS, shopBookingRefusal } from './vendor-visibility';

const WEB = join(__dirname, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

const LIVE = {
  verification_state: 'verified',
  public_visibility: 'verified',
  fraud_suspended_at: null,
  fraud_banned_at: null,
  papers_lapsed_at: null,
};

test('1 · only a verified, listed shop with no fraud stamp is bookable', () => {
  assert.equal(shopBookingRefusal(LIVE), null);
  assert.equal(isShopBookable(LIVE), true);
  assert.equal(shopBookingRefusal({ ...LIVE, public_visibility: 'hidden' }), 'not_listed');
  assert.equal(shopBookingRefusal({ ...LIVE, public_visibility: 'archived' }), 'not_listed');
  assert.equal(shopBookingRefusal({ ...LIVE, fraud_suspended_at: '2026-11-10T00:00:00Z' }), 'suspended');
  assert.equal(
    shopBookingRefusal({ ...LIVE, fraud_suspended_at: '2026-11-10T00:00:00Z', fraud_banned_at: '2026-11-10T00:00:00Z' }),
    'banned',
  );
  assert.equal(shopBookingRefusal({ ...LIVE, verification_state: 'demoted' }), 'not_verified');
  assert.equal(shopBookingRefusal(null), 'missing');
  // 📄 "Keep them, block new" (owner 2026-11-14): a lapsed shop takes no NEW ask.
  assert.equal(shopBookingRefusal({ ...LIVE, papers_lapsed_at: '2027-03-30T16:00:00Z' }), 'papers_lapsed');
});

test('1b · an absent column (not selected) is a refusal, never "clear"', () => {
  for (const col of Object.keys(LIVE)) {
    const row: Record<string, unknown> = { ...LIVE };
    delete row[col];
    assert.equal(isShopBookable(row), false, `dropping ${col} must not leave the shop bookable`);
  }
});

test('2 · the app gate selects every column the rule reads', () => {
  for (const col of Object.keys(LIVE)) {
    assert.ok(SHOP_BOOKABLE_COLUMNS.includes(col), `SHOP_BOOKABLE_COLUMNS must name ${col}`);
  }
  const src = stripComments(readFileSync(join(WEB, 'lib/vendor-verification.ts'), 'utf8'));
  const fn = src.slice(src.indexOf('export async function marketplaceVendorBookingRefusal'));
  assert.ok(fn.length > 0, 'marketplaceVendorBookingRefusal must exist');
  assert.match(fn.slice(0, 900), /\.select\(SHOP_BOOKABLE_COLUMNS\)/, 'the gate must select SHOP_BOOKABLE_COLUMNS');
  assert.match(fn.slice(0, 900), /shopBookingRefusal\(/, 'the gate must decide through shopBookingRefusal');
  const bool = src.slice(src.indexOf('export async function isMarketplaceVendorBookable'));
  assert.match(bool.slice(0, 400), /marketplaceVendorBookingRefusal\(/, 'the boolean gate must be the refusal gate');
});

test('3 · the latest definition of the DB trigger function asks all four columns', () => {
  const defining = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) =>
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_booking_requires_verified_vendor\s*\(/i.test(
        readFileSync(join(MIGRATIONS, f), 'utf8'),
      ),
    );
  const latest = defining.at(-1);
  assert.ok(latest, 'some migration must define enforce_booking_requires_verified_vendor');
  const sql = readFileSync(join(MIGRATIONS, latest!), 'utf8');
  const body = sql.slice(sql.search(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_booking_requires_verified_vendor/i));
  const fnBody = body.slice(0, body.indexOf('$$;'));
  for (const col of ['verification_state', 'public_visibility', 'fraud_suspended_at', 'fraud_banned_at', "'archived'"]) {
    assert.ok(fnBody.includes(col), `${latest} must read vendor_profiles.${col}`);
  }
  // Four app paths match the refusal on this prefix — the reason is named after it, never instead of it.
  assert.ok(fnBody.includes("'vendor_not_verified: "), 'the refusal keeps the vendor_not_verified: prefix');
});

test('4 · the fraud wipe+ban demotes a verified shop', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/admin/fraud/actions.ts'), 'utf8'));
  const start = src.indexOf('export async function executeFraudWipeBan');
  assert.ok(start >= 0, 'executeFraudWipeBan must exist');
  const fn = src.slice(start, src.indexOf('\nexport ', start + 10) === -1 ? undefined : src.indexOf('\nexport ', start + 10));
  const ban = fn.slice(fn.indexOf('fraud_banned_at: nowIso'));
  assert.ok(ban.length > 0, 'the ban write must stamp fraud_banned_at');
  assert.match(
    ban.slice(0, 900),
    /verification_state:\s*'demoted'/,
    'the ban write must also set verification_state to demoted (it bumps demotion_count)',
  );
});
