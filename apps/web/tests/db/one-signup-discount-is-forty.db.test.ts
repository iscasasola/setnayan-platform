/**
 * ⚖ Owner tracker d18 (2026-10-02): 40% off everything bought during sign-up,
 * ONE admin number — `platform_settings.onboarding_discount_pct`.
 *
 * Pins, against the replayed schema: the number is 40; every stored derived
 * sign-up copy (Papic rungs, Setnayan AI bands) is exactly what the TypeScript
 * `signupPriceFor` produces at that number — so the admin save and the migration
 * can never disagree; and Event Hub Pro's own ₱3,000 is untouched.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb } from './replay-migrations';
import { signupPriceFor, familyForServiceCode } from '../../lib/onboarding-family-discount';
import { readOnboardingDiscountPct, DEFAULT_ONBOARDING_DISCOUNT_PCT } from '../../lib/onboarding-discount';

let db: PGlite;
before(async () => {
  db = (await createReplayedDb()).db;
});

test('the one sign-up number is 40, and the code fallback agrees', async () => {
  const { rows } = await db.query<{ pct: string }>(
    `SELECT onboarding_discount_pct AS pct FROM public.platform_settings WHERE id = 1`,
  );
  assert.equal(rows.length, 1, 'platform_settings row 1 must exist');
  assert.equal(readOnboardingDiscountPct(rows[0]!.pct), 40);
  assert.equal(DEFAULT_ONBOARDING_DISCOUNT_PCT, 40, 'a failed read must not quote a different number');
});

test('every stored derived sign-up price is exactly signupPriceFor(regular, the number)', async () => {
  const { rows } = await db.query<{ code: string; regular: string; signup: string | null }>(
    `SELECT service_code AS code, retail_price_php AS regular, onboarding_price_php AS signup
       FROM public.platform_retail_catalog_v2
      WHERE service_code LIKE 'PAPIC_GUEST%' OR service_code LIKE 'SETNAYAN_AI%'`,
  );
  let checked = 0;
  for (const r of rows) {
    if (familyForServiceCode(r.code) === null || Number(r.regular) <= 0) continue;
    checked += 1;
    assert.equal(
      r.signup == null ? null : Number(r.signup),
      signupPriceFor(Number(r.regular), 40),
      `${r.code}: stored sign-up price disagrees with the one number`,
    );
  }
  console.log(`[signup-discount] ${checked} derived rows checked`);
  assert.ok(checked > 0, 'nothing was checked — a zero that looked nowhere');
});

test('Event Hub Pro keeps its own owner-set sign-up price', async () => {
  const { rows } = await db.query<{ signup: string | null }>(
    `SELECT onboarding_price_php AS signup FROM public.platform_retail_catalog_v2
      WHERE service_code = 'COUPLE_WEBSITE_PRO'`,
  );
  if (rows.length > 0) assert.equal(Number(rows[0]!.signup), 3000);
});
