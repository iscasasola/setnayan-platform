/**
 * ⚖ OWNER 2026-11-03 (DECISION_LOG "PAPIC IS THREE PACKS … AND NO 40% SIGN-UP PRICE ON ANYTHING"):
 * *"drop the 40% on all then"*.
 *
 * Pins, against the replayed schema: the one sign-up number (`platform_settings.onboarding_discount_pct`) and its two
 * retired twins are 0; the code fallback agrees, so a failed read can never bring a discount back; NO catalogue row
 * carries a stored sign-up price; and every sign-up price the TypeScript would compute equals the regular price.
 *
 * Was `one-signup-discount-is-forty.db.test.ts` (owner tracker d18, 2026-10-02: 40% off everything at sign-up).
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb } from './replay-migrations';
import { storedSignupPriceFor } from '../../lib/onboarding-family-discount';
import { readOnboardingDiscountPct, DEFAULT_ONBOARDING_DISCOUNT_PCT, setupPricePhp } from '../../lib/onboarding-discount';

let db: PGlite;
before(async () => {
  db = (await createReplayedDb()).db;
});

test('the one sign-up number is 0 — and its retired twins and the code fallback agree', async () => {
  const { rows } = await db.query<{ pct: string; papic: string; ai: string }>(
    `SELECT onboarding_discount_pct AS pct, papic_signup_discount_pct AS papic, ai_signup_discount_pct AS ai
       FROM public.platform_settings WHERE id = 1`,
  );
  assert.equal(rows.length, 1, 'platform_settings row 1 must exist');
  assert.equal(readOnboardingDiscountPct(rows[0]!.pct), 0);
  assert.equal(Number(rows[0]!.papic), 0);
  assert.equal(Number(rows[0]!.ai), 0);
  assert.equal(DEFAULT_ONBOARDING_DISCOUNT_PCT, 0, 'a failed read must not bring a discount back');
});

test('no catalogue row stores a sign-up price, and every product sets up at its regular price', async () => {
  const { rows } = await db.query<{ code: string; regular: string; signup: string | null }>(
    `SELECT service_code AS code, retail_price_php AS regular, onboarding_price_php AS signup
       FROM public.platform_retail_catalog_v2`,
  );
  assert.ok(rows.length > 0, 'nothing was checked — a zero that looked nowhere');
  const carrying = rows.filter((r) => r.signup !== null).map((r) => `${r.code} (₱${r.signup})`);
  assert.deepEqual(carrying, [], `these rows still carry a sign-up price: ${carrying.join(', ')}`);
  for (const r of rows) {
    const regular = Number(r.regular);
    if (!(regular > 0)) continue;
    assert.equal(setupPricePhp(regular, null, 0), regular, `${r.code}: the set-up price is not the regular price`);
    assert.equal(storedSignupPriceFor(regular, 0), null, `${r.code}: a Save at 0% would store a sign-up price`);
  }
});
