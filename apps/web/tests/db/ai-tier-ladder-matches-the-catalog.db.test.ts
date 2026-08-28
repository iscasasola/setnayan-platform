/**
 * THE SETNAYAN AI TIER LADDER MUST MATCH THE CATALOG IT MIRRORS.
 *
 * 🚨 THE LAST PLACE A HIDDEN PRICE COULD STILL DRIFT SILENTLY. Every other
 * hardcoded fallback in `lib/` is a single constant paired with a single SKU
 * code, and `fallback-prices-match-the-catalog.db.test.ts` compares those
 * automatically. The Setnayan AI fallback is shaped differently — a per-TIER
 * LADDER (`AI_TIER_FALLBACK_PHP` + `AI_TIER_ONBOARDING_FALLBACK_PHP`) keyed by
 * tier rather than by SKU — so that scan structurally cannot see it, and the
 * file is listed in its `UNPAIRED` exemptions with that reason.
 *
 * Honest, but it left the ladder as the one set of prices that could diverge
 * from the admin pricing screen with nothing complaining. On the product with
 * the only real sale this platform has ever taken. This file closes that.
 *
 * ⚖ IT PASSES TODAY, AND THAT IS THE POINT. Verified against production
 * 2026-08-27: all four tier rows exist and match the ladder exactly. Its value
 * is entirely in the day somebody reprices a tier on the admin screen and the
 * code ladder stays behind — which is precisely what happened to four other
 * constants on 2026-08-27 (the Custom base, the Custom branch axis, the branch
 * fee and the 3D booth fallback).
 *
 * ── HOW THE ONBOARDING COMPARISON IS DERIVED ───────────────────────────────
 * It mirrors `resolveSetnayanAiTypePriceResolution` rather than reading one
 * column: a NULL `onboarding_price_php` means "no sign-up discount", and the
 * resolver then charges the REGULAR price. So the catalog's EFFECTIVE sign-up
 * price is `usable(onboarding) ? onboarding : retail`, and that is what the
 * ladder is compared against. Comparing the raw column instead would call a
 * legitimate no-discount row "drift", and — worse — would MISS the case where a
 * discount is dropped from the catalog while the code still promises one.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_TIER_SKU,
  AI_TIER_FALLBACK_PHP,
  AI_TIER_ONBOARDING_FALLBACK_PHP,
  type AiPriceTier,
} from '../../lib/setnayan-ai-type-pricing';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

/** The same "is this a real price" test the resolver applies. */
const usable = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0;

type CatalogRow = { retail_price_php: string | null; onboarding_price_php: string | null };

/**
 * A tier's catalog row. `is_active` is deliberately NOT filtered — the B/C/D
 * rows are price SOURCES, not sellable cards, and ship inactive on purpose.
 * Filtering it would make every one of them look absent and quietly gut this.
 */
async function catalogRow(sku: string): Promise<CatalogRow | null> {
  const r = await db.query<CatalogRow>(
    `SELECT retail_price_php, onboarding_price_php
       FROM public.platform_retail_catalog_v2
      WHERE service_code = $1`,
    [sku],
  );
  return r.rows[0] ?? null;
}

test('the ladder imported intact — this guard cannot run on an empty module', () => {
  // 🪤 THE REPO'S KNOWN `tsx --test` TRAP: an import has been observed returning
  // EMPTY named exports, at which point every loop below iterates nothing and
  // the file reports a clean pass while checking zero prices.
  for (const [name, map] of [
    ['AI_TIER_SKU', AI_TIER_SKU],
    ['AI_TIER_FALLBACK_PHP', AI_TIER_FALLBACK_PHP],
    ['AI_TIER_ONBOARDING_FALLBACK_PHP', AI_TIER_ONBOARDING_FALLBACK_PHP],
  ] as const) {
    assert.ok(map && typeof map === 'object', `${name} did not import`);
    assert.ok(
      Object.keys(map).length >= 5,
      `${name} imported with ${Object.keys(map).length} tiers — expected the full A–E ladder`,
    );
  }
});

test('Tier E is priced without touching the database, on both ladders', () => {
  // Tier E has no SKU: with no vendors Setnayan AI is not present, so there is
  // nothing to price and no read to fail. Modelled here rather than treated as
  // an unresolvable tier — otherwise the "must resolve" rule below would demand
  // a catalog row that must never exist.
  assert.equal(AI_TIER_SKU.E, null, 'Tier E must have no SKU — it is not a product');
  assert.equal(AI_TIER_FALLBACK_PHP.E, 0);
  assert.equal(AI_TIER_ONBOARDING_FALLBACK_PHP.E, 0);
});

test('every priced tier resolves to a catalog row — an unresolvable tier FAILS', async () => {
  /*
    ⛔ FAIL, NEVER SKIP. If a tier's row cannot be found, the comparison below
    would simply not run for it, and the guard would shrink silently as the
    ladder grows — the same failure mode the general guard's `UNPAIRED` rule
    exists to prevent. So a missing row is its own red test, with the tier named.
  */
  const priced = (Object.entries(AI_TIER_SKU) as [AiPriceTier, string | null][])
    .filter(([, sku]) => sku !== null) as [AiPriceTier, string][];

  assert.ok(
    priced.length >= 4,
    `only ${priced.length} priced tiers found — the comparison would be near-vacuous`,
  );

  const missing: string[] = [];
  for (const [tier, sku] of priced) {
    if ((await catalogRow(sku)) === null) missing.push(`${tier} (${sku})`);
  }
  assert.deepEqual(
    missing,
    [],
    `these Setnayan AI tiers name a catalog row that does not exist: ${missing.join(', ')}. ` +
      `The tier ladder prices off these rows, so a missing one means the hardcoded fallback is ` +
      `the ONLY price — with nothing checking it. Seed the row or retire the tier.`,
  );
});

test('the REGULAR ladder matches the catalog, tier by tier', async () => {
  const drift: string[] = [];
  let compared = 0;

  for (const [tier, sku] of Object.entries(AI_TIER_SKU) as [AiPriceTier, string | null][]) {
    if (sku === null) continue; // Tier E — covered above.
    const row = await catalogRow(sku);
    if (row === null) continue; // already a failure in the test above
    compared += 1;

    const live = Number(row.retail_price_php);
    const ladder = AI_TIER_FALLBACK_PHP[tier];
    if (!usable(live)) {
      drift.push(`${tier} (${sku}): catalog retail is ${row.retail_price_php}, not a usable price`);
      continue;
    }
    if (live !== ladder) {
      drift.push(`${tier} (${sku}): catalog ₱${live} vs ladder ₱${ladder}`);
    }
  }

  assert.ok(compared >= 4, `only ${compared} tiers were compared — near-vacuous`);
  assert.deepEqual(
    drift,
    [],
    `THE SETNAYAN AI REGULAR LADDER HAS DRIFTED FROM THE CATALOG — ${drift.join('; ')}. ` +
      `That ladder is what the product charges when a catalog row is unreadable, so a stale rung ` +
      `bills yesterday's price with the admin screen showing today's. Update ` +
      `lib/setnayan-ai-type-pricing.ts in the SAME change as the reprice.`,
  );
});

test('the SIGN-UP ladder matches the catalog, tier by tier', async () => {
  /*
    Derived exactly as the resolver derives it: a NULL onboarding price means
    "no sign-up discount", and the resolver then charges the regular price. So
    the catalog's effective sign-up figure is `usable(onboarding) ? onboarding
    : retail`.

    🔑 THIS IS THE HALF THAT CATCHES A DROPPED DISCOUNT. If somebody clears
    `onboarding_price_php` on the admin screen, the catalog starts charging the
    REGULAR price at sign-up while the code ladder still promises the discount —
    a real divergence that reading the raw column would have called "NULL, fine".
  */
  const drift: string[] = [];
  let compared = 0;

  for (const [tier, sku] of Object.entries(AI_TIER_SKU) as [AiPriceTier, string | null][]) {
    if (sku === null) continue;
    const row = await catalogRow(sku);
    if (row === null) continue;
    compared += 1;

    const onboarding = Number(row.onboarding_price_php);
    const retail = Number(row.retail_price_php);
    const effective = usable(onboarding) ? onboarding : retail;
    const ladder = AI_TIER_ONBOARDING_FALLBACK_PHP[tier];

    if (!usable(effective)) {
      drift.push(`${tier} (${sku}): no usable sign-up price on the row at all`);
      continue;
    }
    if (effective !== ladder) {
      drift.push(
        `${tier} (${sku}): catalog sign-up ₱${effective}` +
          `${usable(onboarding) ? '' : ' (no discount on the row, so the regular price)'}` +
          ` vs ladder ₱${ladder}`,
      );
    }
  }

  assert.ok(compared >= 4, `only ${compared} tiers were compared — near-vacuous`);
  assert.deepEqual(
    drift,
    [],
    `THE SETNAYAN AI SIGN-UP LADDER HAS DRIFTED FROM THE CATALOG — ${drift.join('; ')}. ` +
      `Update lib/setnayan-ai-type-pricing.ts in the SAME change as the reprice.`,
  );
});

test('the two ladders never cross — sign-up is always a discount', () => {
  // Not drift, but the invariant that makes the sign-up ladder meaningful: a
  // sign-up price ABOVE its regular twin would punish a customer for buying
  // early, the opposite of the 2026-08-12 decision. Cheap to assert here while
  // both maps are in hand.
  const bad: string[] = [];
  for (const tier of Object.keys(AI_TIER_FALLBACK_PHP) as AiPriceTier[]) {
    if (AI_TIER_ONBOARDING_FALLBACK_PHP[tier] > AI_TIER_FALLBACK_PHP[tier]) {
      bad.push(
        `${tier}: sign-up ₱${AI_TIER_ONBOARDING_FALLBACK_PHP[tier]} > regular ₱${AI_TIER_FALLBACK_PHP[tier]}`,
      );
    }
  }
  assert.deepEqual(bad, [], `a sign-up rung is dearer than its regular twin — ${bad.join('; ')}`);
});
