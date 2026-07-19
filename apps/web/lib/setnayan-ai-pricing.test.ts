/**
 * Per-EVENT Setnayan AI pricing math (node:test via tsx).
 *
 * Locks the intro-vs-renewal price decision (owner 2026-07-02: ₱499 first
 * 28-day cycle per event, ₱799 every cycle after) and the catalog-authoritative
 * rule (passed-in catalog prices win; fallbacks only cover a missing/corrupt
 * read — never a hardcoded live price).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AI_EVENT_CYCLE_DAYS,
  SETNAYAN_AI_INTRO_FALLBACK_PHP,
  SETNAYAN_AI_RENEWAL_FALLBACK_PHP,
  resolveSetnayanAiOrderPricePhp,
  setnayanAiEventPricing,
} from './setnayan-ai-pricing';

test('constants: 28-day cycle, ₱499 intro / ₱799 renewal fallbacks', () => {
  assert.equal(AI_EVENT_CYCLE_DAYS, 28);
  assert.equal(SETNAYAN_AI_INTRO_FALLBACK_PHP, 499);
  assert.equal(SETNAYAN_AI_RENEWAL_FALLBACK_PHP, 799);
});

test('resolveSetnayanAiOrderPricePhp: intro on the first cycle, renewal after', () => {
  // First cycle (intro not yet used) → catalog intro price.
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: false, introPricePhp: 499, renewalPricePhp: 799 }),
    499,
  );
  // Renewal (intro already used) → catalog renewal price.
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: true, introPricePhp: 499, renewalPricePhp: 799 }),
    799,
  );
});

test('resolveSetnayanAiOrderPricePhp: catalog values win over the fallbacks', () => {
  // Admin repriced the catalog → those numbers are used, not the constants.
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: false, introPricePhp: 399, renewalPricePhp: 899 }),
    399,
  );
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: true, introPricePhp: 399, renewalPricePhp: 899 }),
    899,
  );
});

test('resolveSetnayanAiOrderPricePhp: missing/invalid catalog price falls back safely (never ₱0)', () => {
  assert.equal(resolveSetnayanAiOrderPricePhp({ introUsed: false }), 499);
  assert.equal(resolveSetnayanAiOrderPricePhp({ introUsed: true }), 799);
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: false, introPricePhp: 0 }),
    499,
  ); // zero → fallback
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: true, renewalPricePhp: -5 }),
    799,
  ); // negative → fallback
  assert.equal(
    resolveSetnayanAiOrderPricePhp({ introUsed: true, renewalPricePhp: Number.NaN }),
    799,
  ); // NaN → fallback
});

test('setnayanAiEventPricing: centralizes the two-tier pair for buy + copy', () => {
  assert.deepEqual(setnayanAiEventPricing(499, 799), {
    introPhp: 499,
    renewalPhp: 799,
    cycleDays: 28,
  });
  // Fallbacks when the catalog read is absent.
  assert.deepEqual(setnayanAiEventPricing(null, undefined), {
    introPhp: 499,
    renewalPhp: 799,
    cycleDays: 28,
  });
});
