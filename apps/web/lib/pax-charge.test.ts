/**
 * SEC-3 · the pax money bug — charge-time invariants.
 *
 * ── THE BUG ────────────────────────────────────────────────────────────────
 * `events` UPDATE RLS is ROW-level, never column-level, and the anon key is
 * public. `estimated_pax` is legitimately host-written, so it stays in the
 * column GRANT allow-list of 20271005100000 — a host can PATCH it straight
 * through PostgREST. Checkout used to re-read that raw value at charge time
 * (lib/v2-catalog.ts · resolvePaxPricedOrderCentavos), so:
 *
 *     estimated_pax → 1  ·  buy the pax-priced SKU  ·  estimated_pax → 500
 *
 * These tests pin the two halves of the fix:
 *   1. computePaxPriceCentavos — the curve, and the pax_floor clamp that
 *      bounds how much a deflate could ever have been worth.
 *   2. resolveLivePax — the resolver checkout now charges against. A deflated
 *      estimate must not be able to move the price below the guest list the
 *      host actually has, and a FROZEN list must ignore the estimate entirely.
 *
 * NOTE ON STATE OF PLAY: no catalog row currently has is_pax_priced = TRUE —
 * the PAPIC_GUEST curve was retired by 20270828140000_papic_one_tiers.sql. The
 * hole is armed-but-unloaded, and one admin UPDATE flipping the flag re-arms
 * it with no code change. That is exactly why these tests exist: there were
 * none covering the pricing curve at all.
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import { computePaxPriceCentavos, type PaxPricingConfig } from './v2-catalog';
import { resolveLivePax } from './pax';

// The historical PAPIC_GUEST curve: floor 100 @ ₱2,999 · +₱350 per 50.
const CURVE: PaxPricingConfig = {
  retail_price_php: 2999,
  is_pax_priced: true,
  pax_floor: 100,
  pax_floor_price_php: 2999,
  pax_increment_size: 50,
  pax_increment_price_php: 350,
};

/* ── 1. The curve ───────────────────────────────────────────────────────────*/

test('pax curve prices as documented', () => {
  assert.equal(computePaxPriceCentavos(CURVE, 100), 299_900);
  assert.equal(computePaxPriceCentavos(CURVE, 150), 334_900);
  assert.equal(computePaxPriceCentavos(CURVE, 200), 369_900);
  assert.equal(computePaxPriceCentavos(CURVE, 500), 579_900);
});

test('the floor clamp bounds what a deflate could ever win', () => {
  // This is the size of the money bug: a host who got pax down to 1 paid the
  // FLOOR (₱2,999), not ₱1 — Math.max(0, guests - pax_floor). Worth ~₱2,800 on
  // a 500-pax event, which is the figure the audit quoted.
  assert.equal(computePaxPriceCentavos(CURVE, 1), 299_900);
  assert.equal(computePaxPriceCentavos(CURVE, 0), 299_900);
  assert.equal(computePaxPriceCentavos(CURVE, -9999), 299_900);
  assert.equal(computePaxPriceCentavos(CURVE, null), 299_900);
});

test('a non-pax SKU is unaffected by pax entirely', () => {
  const flat: PaxPricingConfig = { ...CURVE, is_pax_priced: false };
  assert.equal(computePaxPriceCentavos(flat, 1), 299_900);
  assert.equal(computePaxPriceCentavos(flat, 5000), 299_900);
});

/* ── 2. The resolver checkout now charges against ───────────────────────────*/

type EventRow = {
  estimated_pax: number | null;
  headcount_basis?: string | null;
  guest_list_edit_deadline?: string | null;
  guest_count_locked_at?: string | null;
  final_pax?: number | null;
  event_date?: string | null;
};

/**
 * Minimal Supabase stub: `events` single-row reads and the `guests` head-count.
 * Deliberately throws on any table it does not know about, so a future change
 * that starts reading somewhere else fails loudly instead of silently passing.
 */
function stubClient(event: EventRow, attendingGuests: number): SupabaseClient {
  const client = {
    from(table: string) {
      if (table === 'events') {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          maybeSingle: async () => ({ data: event, error: null }),
        };
        return chain;
      }
      if (table === 'guests') {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
          is: () => chain,
          in: () => chain,
          neq: () => chain,
          then: (resolve: (v: unknown) => unknown) =>
            resolve({ count: attendingGuests, error: null }),
        };
        return chain;
      }
      throw new Error(`unexpected table read: ${table}`);
    },
  };
  return client as unknown as SupabaseClient;
}

test('a deflated estimate cannot price below the real guest list', () => {
  // THE EXPLOIT, replayed. Host PATCHes estimated_pax to 1 while 250 guests
  // are on the roster as attending.
  return resolveLivePax(stubClient({ estimated_pax: 1 }, 250), 'evt').then((pax) => {
    assert.equal(pax, 250, 'the live headcount must floor the deflated estimate');
    assert.equal(
      computePaxPriceCentavos(CURVE, pax),
      404_900, // 2999 + ceil(150/50) × 350 — vs 299_900 if the PATCH had held
      'the charge follows the real roster, not the PATCHed estimate',
    );
  });
});

test('an honest estimate above the roster still wins (no undercharge either)', () => {
  return resolveLivePax(stubClient({ estimated_pax: 300 }, 40), 'evt').then((pax) => {
    assert.equal(pax, 300);
  });
});

test('a FROZEN guest list ignores estimated_pax completely', () => {
  // Once guest_count_locked_at is set, final_pax is authoritative — and
  // final_pax is a LOCKED column (guard_pax_finalize_columns reverts any
  // non-service_role write), so this branch is not host-reachable at all.
  return resolveLivePax(
    stubClient(
      {
        estimated_pax: 1,
        guest_count_locked_at: '2026-07-01T00:00:00Z',
        final_pax: 480,
      },
      0,
    ),
    'evt',
  ).then((pax) => {
    assert.equal(pax, 480, 'the frozen binding count wins over a PATCHed estimate');
  });
});

test('an event with nothing to anchor on resolves null → the floor price', () => {
  return resolveLivePax(stubClient({ estimated_pax: null }, 0), 'evt').then((pax) => {
    assert.equal(pax, null);
    // Null is not a discount — computePaxPriceCentavos charges the floor.
    assert.equal(computePaxPriceCentavos(CURVE, pax), 299_900);
  });
});

test('headcount_basis widens the floor rather than narrowing it', () => {
  // 'invited' counts everyone not declined, so a host cannot shrink the
  // charged pax by widening the basis — only grow it.
  return resolveLivePax(
    stubClient({ estimated_pax: 10, headcount_basis: 'invited' }, 320),
    'evt',
  ).then((pax) => {
    assert.equal(pax, 320);
  });
});
