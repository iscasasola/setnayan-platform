/**
 * Setnayan AI per-event-type pricing — the locked ladder + classification
 * invariants (node:test via tsx). Owner-locked 2026-07-22: ₱1,499 / ₱999 / ₱499
 * / ₱99 / ₱0 by AI load. Pure map, no I/O.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  setnayanAiTierForEventType,
  setnayanAiTierSkuForEventType,
  setnayanAiTierFallbackPhp,
  AI_TIER_FALLBACK_PHP,
  AI_TIER_SKU,
} from './setnayan-ai-type-pricing';

test('the locked ladder values', () => {
  assert.deepEqual(AI_TIER_FALLBACK_PHP, { A: 1499, B: 999, C: 499, D: 99, E: 0 });
  assert.deepEqual(AI_TIER_SKU, {
    A: 'SETNAYAN_AI',
    B: 'SETNAYAN_AI_B',
    C: 'SETNAYAN_AI_C',
    D: 'SETNAYAN_AI_D',
    E: null,
  });
});

test('every canonical event type maps to its locked tier + price', () => {
  const cases: Array<[string, string, number]> = [
    ['wedding', 'A', 1499],
    ['debut', 'B', 999],
    ['corporate', 'B', 999],
    ['christening', 'C', 499],
    ['birthday', 'C', 499],
    ['celebration', 'C', 499],
    ['travel', 'C', 499],
    ['tournament', 'D', 99],
    ['anniversary', 'C', 499],
    ['graduation', 'C', 499],
    ['reunion', 'C', 499],
    ['gala_night', 'C', 499],
    ['gender_reveal', 'D', 99],
    ['dinner_date', 'D', 99],
    ['simple_event', 'E', 0],
  ];
  for (const [type, tier, php] of cases) {
    assert.equal(setnayanAiTierForEventType(type), tier, `${type} → tier ${tier}`);
    assert.equal(setnayanAiTierFallbackPhp(type), php, `${type} → ₱${php}`);
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
    assert.equal(setnayanAiTierFallbackPhp(t as string | null | undefined), 499);
    assert.equal(setnayanAiTierSkuForEventType(t as string | null | undefined), 'SETNAYAN_AI_C');
  }
});
