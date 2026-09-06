/**
 * Wiring suite for the vendor Papic tier DERIVATION (lib/vendor-papic-grants.ts).
 * Unlike vendor-papic-tier.test.ts (the pure model), this proves the DB reads
 * translate correctly: vendor_event_unlocks.comp_reason → base tier, and a
 * vendor_papic_capture_grants 'unli' row (money-verified) → Unli. Tokens retired
 * (2026-07-21) — a historical token-burn row no longer earns Ltd. Uses a stub
 * Supabase client so no live DB is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deriveVendorPapicTier,
  fetchVendorAcceptProvenance,
  fetchVendorPapicPortfolioCredits,
  hasPaidUnliUpgrade,
} from './vendor-papic-grants';

type Result = { data: unknown; error?: unknown };

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
    for (const m of ['select', 'eq', 'in', 'gt', 'is', 'order', 'limit']) {
      builder[m] = () => builder;
    }
    builder.maybeSingle = async () => result;
    builder.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  };
  return { from: (t: string) => build(t) } as unknown as SupabaseClient;
}

test('derive: no unlock row → Lite (the floor)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: null },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('derive: founder-comped accept → Ltd (as-if-paid)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: 'founder', tokens_burned: 0 } },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'ltd');
});

test('derive: a historical token-burn row is now IGNORED → Lite (tokens retired)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 2 } },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('derive: an ordinary booked accept (not founder) → Lite', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null } },
    vendor_papic_capture_grants: { data: null },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('derive: an admin-comped unli grant (no order) → Unli', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null } },
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: null } },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'unli');
});

test('derive: an unli grant with a PAID order → Unli', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null } },
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: 'o1' } },
    orders: { data: { status: 'paid' } },
  });
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'unli');
});

test('derive: an unli grant with an UNPAID order does NOT open Unli (fail-closed)', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: { comp_reason: null, tokens_burned: 0 } },
    lead_token_holds: { data: null },
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: 'o1' } },
    orders: { data: { status: 'submitted' } },
  });
  // Falls back to the derived base tier (Lite here), never Unli.
  assert.equal(await deriveVendorPapicTier(c, 'v1', 'e1'), 'lite');
});

test('provenance: a read error fails closed to no-unlock', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: null, error: { message: 'boom' } },
  });
  const p = await fetchVendorAcceptProvenance(c, 'v1', 'e1');
  assert.deepEqual(p, {
    hasUnlock: false,
    founderComp: false,
  });
});

test('hasPaidUnliUpgrade: a non-unli grant row → false', async () => {
  const c = stubClient({
    vendor_papic_capture_grants: { data: { tier: 'ltd', upgrade_order_id: null } },
  });
  assert.equal(await hasPaidUnliUpgrade(c, 'v1', 'e1'), false);
});

// ── fetchVendorPapicPortfolioCredits: ONE meter, TWO doors (G3) ──────────────
// The riskiest new logic in G3 is arithmetic, not a query — capture spend and
// portfolio-import spend must both come out of the SAME "left" total, and a
// sign error here would silently over- or under-meter every supplier. These
// stub the whole read graph rather than hitting a database, mirroring the
// derivation tests above.

test('spend and left fold BOTH doors: on-the-day capture AND portfolio imports', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: null }, // → base tier Lite (50 pts)
    vendor_papic_capture_grants: { data: null }, // → no paid Unli upgrade
    vendor_papic_captures: { data: [{ media_type: 'photo' }, { media_type: 'photo' }] }, // 2 pts spent
    vendor_papic_portfolio_credit_grants: { data: [{ credits: 60 }] }, // credits held
    vendor_billing_catalog: { data: { price_php: '500.00', is_active: true } },
    vendor_papic_portfolio_photos: {
      data: [
        { credits_spent: 1, hidden_at: null },
        { credits_spent: 1, hidden_at: null },
        // A hidden (NSFW-blocked/taken-down) import does not count — mirrors
        // how a hidden capture is filtered before it reaches this table.
        { credits_spent: 1, hidden_at: '2026-01-01T00:00:00Z' },
      ],
    },
  });

  const r = await fetchVendorPapicPortfolioCredits(c, 'v1', 'e1');
  // allowancePointsFor('lite', 60) = max(50, 60) = 60; capture pointsLeft = 60 - 2 = 58.
  assert.equal(r.credits, 60);
  assert.equal(r.spent, 4, 'capture spend (2) + portfolio spend (2, the hidden row excluded)');
  assert.equal(r.left, 56, '58 (capture-only left) minus 2 more spent importing');
  assert.equal(r.packPricePhp, 500);
  assert.equal(r.offerPack, true, '60 credits is under a pack’s worth (100)');
});

test('left never goes negative — a portfolio-import race cannot show a negative balance', async () => {
  // Lite's floor is 50 points regardless of the ledger (allowancePointsFor is a
  // MAX), so drive the CAPTURE side close to that cap first — 48 photos spent
  // leaves only 2 points of capture-allowance "left" for a big portfolio spend
  // to overrun.
  const c = stubClient({
    vendor_event_unlocks: { data: null },
    vendor_papic_capture_grants: { data: null },
    vendor_papic_captures: { data: Array.from({ length: 48 }, () => ({ media_type: 'photo' })) },
    vendor_papic_portfolio_credit_grants: { data: [{ credits: 5 }] },
    vendor_billing_catalog: { data: null }, // pack unavailable — unrelated to this assertion
    // Six imports against only 2 points of capture-allowance-left overruns it —
    // the route re-checks per request, but the READOUT must still clamp
    // rather than print a number that would confuse a supplier mid-race.
    vendor_papic_portfolio_photos: {
      data: Array.from({ length: 6 }, () => ({ credits_spent: 1, hidden_at: null })),
    },
  });
  const r = await fetchVendorPapicPortfolioCredits(c, 'v1', 'e1');
  assert.equal(r.left, 0, 'left must clamp at 0, never go negative');
});

test('Unli stays unlimited: a portfolio import never introduces a ceiling', async () => {
  const c = stubClient({
    vendor_event_unlocks: { data: null },
    // An admin-comped Unli grant (no order to verify).
    vendor_papic_capture_grants: { data: { tier: 'unli', upgrade_order_id: null } },
    vendor_papic_captures: { data: [] },
    vendor_papic_portfolio_credit_grants: { data: [] },
    vendor_billing_catalog: { data: null },
    vendor_papic_portfolio_photos: { data: [{ credits_spent: 1, hidden_at: null }] },
  });
  const r = await fetchVendorPapicPortfolioCredits(c, 'v1', 'e1');
  assert.equal(r.left, null, 'Unli has nothing to subtract a portfolio import from');
});
