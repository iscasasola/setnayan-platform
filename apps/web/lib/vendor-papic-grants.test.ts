/**
 * Wiring suite for the supplier Papic reads (lib/vendor-papic-grants.ts), with a stub Supabase client.
 *
 * 📸 Since 2026-11-23 the on-the-day camera's allowance is the shop's PLAN (TIER_CAPS — Free · Verified 10 photos,
 * no videos; Plus and up no limit): this proves the plan and the photo count are read honestly (an unread read is
 * `null`, never a number) and that the portfolio-import credits (G3) no longer share a meter with the camera.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchShopPlan,
  fetchVendorEventCaptureAllowance,
  fetchVendorEventPhotosTaken,
  fetchVendorPapicPortfolioCredits,
} from './vendor-papic-grants';

type Result = { data: unknown; error?: unknown; count?: number | null };

/**
 * A chainable stub: every query method returns the builder; the terminal
 * `.maybeSingle()` resolves to the result configured for that table, and the
 * builder is ALSO thenable so a list query (`.select().eq()…`, awaited with no
 * terminal call — how `fetchVendorPapicCreditsGranted` and the two spend
 * readers query) resolves to the same configured result. Each table is read at
 * most once per derivation, so keying by table name is sufficient.
 */
function stubClient(byTable: Record<string, Result>): SupabaseClient {
  const build = (table: string) => {
    const result = byTable[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gt', 'is', 'order', 'limit', 'like']) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = async () => result;
    // A `count: 'exact', head: true` read answers `{ count, error }` — configured as `count` on the result.
    builder.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  };
  return { from: (t: string) => build(t) } as unknown as SupabaseClient;
}

test('the plan is read from the shop row; an unread row is null, never a plan', async () => {
  assert.equal(await fetchShopPlan(stubClient({ vendor_profiles: { data: { tier_state: 'pro' } } }), 'v1'), 'pro');
  assert.equal(await fetchShopPlan(stubClient({ vendor_profiles: { data: { tier_state: null } } }), 'v1'), 'free');
  assert.equal(await fetchShopPlan(stubClient({ vendor_profiles: { data: null, error: { message: 'refused' } } }), 'v1'), null);
});

test('the photo count is the not-hidden photos; a refused count is null, never 0', async () => {
  assert.equal(await fetchVendorEventPhotosTaken(stubClient({ vendor_papic_captures: { data: null, count: 7 } as Result }), 'v1', 'e1'), 7);
  assert.equal(
    await fetchVendorEventPhotosTaken(stubClient({ vendor_papic_captures: { data: null, count: null, error: { message: 'refused' } } as Result }), 'v1', 'e1'),
    null,
  );
});

test('the allowance: Free at 10 has none left; Plus has no limit; an unread plan draws Free’s rule', async () => {
  const free = await fetchVendorEventCaptureAllowance(
    stubClient({ vendor_profiles: { data: { tier_state: 'free' } }, vendor_papic_captures: { data: null, count: 10 } as Result }),
    'v1',
    'e1',
  );
  assert.equal(free.plan, 'free');
  assert.equal(free.allowance.rule.photoLimit, 10);
  assert.equal(free.allowance.photosLeft, 0);

  const plus = await fetchVendorEventCaptureAllowance(
    stubClient({ vendor_profiles: { data: { tier_state: 'solo' } }, vendor_papic_captures: { data: null, count: 900 } as Result }),
    'v1',
    'e1',
  );
  assert.equal(plus.allowance.rule.photoLimit, null);
  assert.equal(plus.allowance.rule.videos, true);

  const unread = await fetchVendorEventCaptureAllowance(
    stubClient({ vendor_profiles: { data: null, error: { message: 'refused' } }, vendor_papic_captures: { data: null, count: 0 } as Result }),
    'v1',
    'e1',
  );
  assert.equal(unread.plan, null, 'an unread plan must say so — the route refuses on it');
  assert.equal(unread.allowance.rule.photoLimit, 10, 'an unread plan never draws the most generous rule');
});

test('portfolio-import credits: the ledger minus what the album spent — the camera spends nothing', async () => {
  const c = stubClient({
    vendor_papic_portfolio_credit_grants: { data: [{ credits: 60 }] },
    platform_retail_catalog_v2: {
      data: [
        { service_code: 'PAPIC_GUEST_A', title: 'Pack A', retail_price_php: '11.00', is_active: true, retired_at: null },
        { service_code: 'PAPIC_GUEST_B', title: 'Pack B', retail_price_php: '22.00', is_active: false, retired_at: null },
      ],
    },
    papic_pass_tiers: {
      data: [
        { service_code: 'PAPIC_GUEST_A', points: 7, is_active: true, is_topup: false },
        { service_code: 'PAPIC_GUEST_B', points: 70, is_active: true, is_topup: false },
      ],
    },
    vendor_papic_portfolio_photos: {
      data: [
        { credits_spent: 1, hidden_at: null },
        { credits_spent: 1, hidden_at: null },
        { credits_spent: 1, hidden_at: '2026-01-01T00:00:00Z' },
      ],
    },
  });
  const r = await fetchVendorPapicPortfolioCredits(c, 'v1', 'e1');
  assert.equal(r.credits, 60);
  assert.equal(r.spent, 2, 'the album’s two imports (the hidden one excluded) — no capture spend any more');
  assert.equal(r.left, 58);
  assert.deepEqual(r.packs, [{ code: 'PAPIC_GUEST_A', title: 'Pack A', credits: 7, pricePhp: 11 }]);
  assert.equal(r.offerPack, true, '60 credits is under a pack’s worth (100)');
});

test('portfolio-import credits: left clamps at 0, and an unread ledger leaves nothing to spend', async () => {
  const over = await fetchVendorPapicPortfolioCredits(
    stubClient({
      vendor_papic_portfolio_credit_grants: { data: [{ credits: 5 }] },
      vendor_papic_portfolio_photos: { data: Array.from({ length: 6 }, () => ({ credits_spent: 1, hidden_at: null })) },
    }),
    'v1',
    'e1',
  );
  assert.equal(over.left, 0, 'left must clamp at 0, never go negative');
  const unread = await fetchVendorPapicPortfolioCredits(
    stubClient({ vendor_papic_portfolio_credit_grants: { data: null, error: { message: 'refused' } } }),
    'v1',
    'e1',
  );
  assert.equal(unread.credits, null, 'an unread ledger is null — the card says it could not read');
  assert.equal(unread.left, 0, 'a metering outage never mints credits');
});
