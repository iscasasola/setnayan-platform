/**
 * Setnayan AI intro-vs-renewal pricing (Node built-in test runner via tsx —
 * `pnpm test:unit`).
 *
 * ⚠ WHY THIS FILE EXISTS — `is_active` is OVERLOADED in
 * platform_retail_catalog_v2:
 *   · on COUPLE_WEBSITE_PRO, `is_active=false` means RETIRED — do not sell.
 *   · on SETNAYAN_AI_RENEW (₱799), `is_active=false` means NOT INDEPENDENTLY
 *     SELLABLE — it is the LIVE renewal price for every AI subscriber past
 *     their first cycle.
 *
 * The 2026-07-21 gap audit recommended "make every catalog reader honor
 * is_active". `lib/setnayan-ai-event-pricing.ts` reads BOTH rows UNFILTERED on
 * purpose, and must keep doing so.
 *
 * ── SCOPE CORRECTION (checked against the code, 2026-07-21) ────────────────
 * The audit claimed filtering that read would collapse renewals to the ₱1,499
 * intro price — an "88% overcharge". **That is not what happens.**
 * `setnayanAiEventPricing` coerces each side independently against its OWN
 * constant (`SETNAYAN_AI_INTRO_FALLBACK_PHP = 499`,
 * `SETNAYAN_AI_RENEWAL_FALLBACK_PHP = 799`), so a missing renewal row falls
 * back to 799 — the correct renewal price. There is no overcharge, and no
 * intro/renewal crossover.
 *
 * The real (milder) risk is silent DRIFT: with the row filtered out, the
 * renewal price detaches from the catalog, so an owner repricing renewals in
 * /admin/pricing would change nothing and never be told. These tests pin the
 * intro/renewal split and that independence, without asserting a defect that
 * doesn't exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSetnayanAiOrderPricePhp,
  setnayanAiEventPricing,
  SETNAYAN_AI_INTRO_FALLBACK_PHP,
  SETNAYAN_AI_RENEWAL_FALLBACK_PHP,
} from './setnayan-ai-pricing';

const CATALOG_INTRO = 499;
const CATALOG_RENEWAL = 799;

test('first cycle charges the intro price', () => {
  assert.equal(
    resolveSetnayanAiOrderPricePhp({
      introUsed: false,
      introPricePhp: CATALOG_INTRO,
      renewalPricePhp: CATALOG_RENEWAL,
    }),
    CATALOG_INTRO,
  );
});

test('DESIGN PIN: once the intro is used, the RENEWAL price wins', () => {
  // SETNAYAN_AI_RENEW is is_active=false in prod and that is CORRECT — it means
  // "not standalone-sellable", not "retired". The read that resolves it is
  // deliberately unfiltered.
  assert.equal(
    resolveSetnayanAiOrderPricePhp({
      introUsed: true,
      introPricePhp: CATALOG_INTRO,
      renewalPricePhp: CATALOG_RENEWAL,
    }),
    CATALOG_RENEWAL,
  );
});

test('intro and renewal fall back INDEPENDENTLY — losing one never charges the other', () => {
  // The property that makes filtering non-catastrophic. If someone ever
  // collapses these to a single shared fallback, a missing renewal row would
  // start billing the intro price and this test fails first.
  const noRenewal = setnayanAiEventPricing(CATALOG_INTRO, undefined);
  assert.equal(noRenewal.renewalPhp, SETNAYAN_AI_RENEWAL_FALLBACK_PHP);
  assert.notEqual(noRenewal.renewalPhp, noRenewal.introPhp);

  const noIntro = setnayanAiEventPricing(undefined, CATALOG_RENEWAL);
  assert.equal(noIntro.introPhp, SETNAYAN_AI_INTRO_FALLBACK_PHP);
});

test('a renewal charge is never CHEAPER than the intro by accident', () => {
  // Cheap invariant on the two-tier model: renewal >= intro in every
  // combination of catalog-present / catalog-missing.
  for (const intro of [CATALOG_INTRO, undefined]) {
    for (const renewal of [CATALOG_RENEWAL, undefined]) {
      const p = setnayanAiEventPricing(intro, renewal);
      assert.ok(
        p.renewalPhp >= p.introPhp,
        `renewal ${p.renewalPhp} < intro ${p.introPhp} for (${intro}, ${renewal})`,
      );
    }
  }
});

test('invalid catalog values (0, negative, NaN) coerce to the fallbacks, never to 0', () => {
  // A ₱0 charge would look like a comp and skip the payment flow entirely.
  for (const bad of [0, -1, Number.NaN, null]) {
    const p = setnayanAiEventPricing(bad as number | null, bad as number | null);
    assert.equal(p.introPhp, SETNAYAN_AI_INTRO_FALLBACK_PHP);
    assert.equal(p.renewalPhp, SETNAYAN_AI_RENEWAL_FALLBACK_PHP);
  }
});
