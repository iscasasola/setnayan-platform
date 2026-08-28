/**
 * Setnayan AI per-event-type pricing — the locked ladders + classification
 * invariants (node:test via tsx). Pure map, no I/O.
 *
 * TWO LADDERS since 2026-08-12 (owner):
 *   SIGN-UP  ₱1,499 / ₱899 / ₱539 / ₱119 / ₱0 — buying while creating the event.
 *   REGULAR  ₱2,499 / ₱1,499 / ₱899 / ₱199 / ₱0 — switching it on afterwards.
 *
 * ⚠ THE SIGN-UP LADDER IS THE OLD 2026-07-22 ONE, UNCHANGED. That is the point:
 * nobody buying at sign-up pays a peso more than before, and these assertions
 * are what prove it rather than a sentence in a PR. `setnayanAiTierFallbackPhp`
 * DEFAULTS to regular, so a call site that forgets the context over-charges
 * rather than under-charges — the safe direction, and pinned below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  setnayanAiTierForEventType,
  setnayanAiTierSkuForEventType,
  setnayanAiTierFallbackPhp,
  AI_TIER_FALLBACK_PHP,
  AI_TIER_ONBOARDING_FALLBACK_PHP,
  AI_TIER_SKU,
} from './setnayan-ai-type-pricing';

test('the locked ladder values', () => {
  assert.deepEqual(AI_TIER_FALLBACK_PHP, { A: 2499, B: 1499, C: 899, D: 199, E: 0 });
  assert.deepEqual(AI_TIER_ONBOARDING_FALLBACK_PHP, { A: 1499, B: 899, C: 539, D: 119, E: 0 });
  assert.deepEqual(AI_TIER_SKU, {
    A: 'SETNAYAN_AI',
    B: 'SETNAYAN_AI_B',
    C: 'SETNAYAN_AI_C',
    D: 'SETNAYAN_AI_D',
    E: null,
  });
});

test('every canonical event type maps to its locked tier + price', () => {
  // The third column is the SIGN-UP price (unchanged from the 2026-07-22 lock).
  const cases: Array<[string, string, number]> = [
    ['wedding', 'A', 1499],
    ['debut', 'B', 899],
    ['corporate', 'B', 899],
    ['christening', 'C', 539],
    ['birthday', 'C', 539],
    ['celebration', 'C', 539],
    ['travel', 'C', 539],
    ['tournament', 'D', 119],
    ['anniversary', 'C', 539],
    ['graduation', 'C', 539],
    ['reunion', 'C', 539],
    ['gala_night', 'B', 899],
    ['gender_reveal', 'D', 119],
    ['date', 'D', 119],
    ['hangout', 'D', 119],
    ['simple_event', 'E', 0],
  ];
  for (const [type, tier, php] of cases) {
    assert.equal(setnayanAiTierForEventType(type), tier, `${type} → tier ${tier}`);
    assert.equal(setnayanAiTierFallbackPhp(type, 'onboarding'), php, `${type} → ₱${php}`);
  }
});

test('Tier E (no vendors) has no sellable SKU — nothing to charge', () => {
  assert.equal(setnayanAiTierSkuForEventType('simple_event'), null);
  assert.equal(setnayanAiTierFallbackPhp('simple_event'), 0);
});

test('the sellable door for a priced tier is the tier SKU (A = SETNAYAN_AI)', () => {
  assert.equal(setnayanAiTierSkuForEventType('wedding'), 'SETNAYAN_AI');
  assert.equal(setnayanAiTierSkuForEventType('debut'), 'SETNAYAN_AI_B');
  assert.equal(setnayanAiTierSkuForEventType('birthday'), 'SETNAYAN_AI_C');
  assert.equal(setnayanAiTierSkuForEventType('gender_reveal'), 'SETNAYAN_AI_D');
});

test('unknown / null / empty types fall back to the standard tier C, never free or wedding', () => {
  for (const t of ['unheard_of_type', '', null, undefined]) {
    assert.equal(setnayanAiTierForEventType(t as string | null | undefined), 'C');
    // Regular by default; the sign-up discount only when explicitly asked for.
    assert.equal(setnayanAiTierFallbackPhp(t as string | null | undefined), 899);
    assert.equal(setnayanAiTierFallbackPhp(t as string | null | undefined, 'onboarding'), 539);
    assert.equal(setnayanAiTierSkuForEventType(t as string | null | undefined), 'SETNAYAN_AI_C');
  }
});

/* ── Regression guard for the 2026-08-01 per-USER retirement ─────────────────
 * The change that removed `user_ai_subscription`, the
 * `setnayan_ai_per_user_enabled` flag and the `SETNAYAN_AI_SUB` term pass was
 * required to leave the PER-EVENT price ladder byte-identical. This pins the
 * complete triple — tier · catalog SKU · fallback ₱ — for every event type in
 * ONE assertion, so "we did not change what anyone is charged or shown" is a
 * test result rather than a claim in a PR description.
 * ------------------------------------------------------------------------- */
test('per-EVENT pricing is UNCHANGED by the per-user retirement (every tier)', () => {
  const expected: Record<string, [string, string | null, number]> = {
    wedding: ['A', 'SETNAYAN_AI', 1499],
    debut: ['B', 'SETNAYAN_AI_B', 899],
    corporate: ['B', 'SETNAYAN_AI_B', 899],
    gala_night: ['B', 'SETNAYAN_AI_B', 899],
    christening: ['C', 'SETNAYAN_AI_C', 539],
    birthday: ['C', 'SETNAYAN_AI_C', 539],
    celebration: ['C', 'SETNAYAN_AI_C', 539],
    travel: ['C', 'SETNAYAN_AI_C', 539],
    anniversary: ['C', 'SETNAYAN_AI_C', 539],
    graduation: ['C', 'SETNAYAN_AI_C', 539],
    reunion: ['C', 'SETNAYAN_AI_C', 539],
    tournament: ['D', 'SETNAYAN_AI_D', 119],
    gender_reveal: ['D', 'SETNAYAN_AI_D', 119],
    date: ['D', 'SETNAYAN_AI_D', 119],
    hangout: ['D', 'SETNAYAN_AI_D', 119],
    simple_event: ['E', null, 0],
  };

  for (const [type, [tier, sku, php]] of Object.entries(expected)) {
    assert.equal(setnayanAiTierForEventType(type), tier, `${type} tier`);
    assert.equal(setnayanAiTierSkuForEventType(type), sku, `${type} SKU`);
    assert.equal(setnayanAiTierFallbackPhp(type, 'onboarding'), php, `${type} fallback ₱`);
  }

  // Papic's travel exclusion was dropped in the SAME change. Confirm that did
  // NOT leak into AI pricing — travel is still Tier C, exactly as before.
  // ⚠ DERIVED FROM TIER C, NOT TYPED. What this test is actually about is that
  // travel stayed in tier C — it must fail if travel moves TIER, and must not
  // fail merely because the owner reprices tier C (as he did on 2026-08-28,
  // when the single 40% family discount took C's sign-up price ₱499 → ₱539).
  // A hardcoded number here conflated those two, and the reprice broke a test
  // whose subject was never the price.
  assert.equal(
    setnayanAiTierFallbackPhp('travel', 'onboarding'),
    AI_TIER_ONBOARDING_FALLBACK_PHP.C,
    'travel must still be priced as tier C',
  );
});
