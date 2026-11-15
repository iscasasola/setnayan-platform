import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import * as addon from './vendor-deep-search-addon';
import {
  deepSearchEligibility,
  resolveDeepSearchPricePhp,
  VENDOR_DEEP_SEARCH_FALLBACK_PHP,
  type DeepSearchEligibilityInput,
} from './vendor-deep-search-addon';

// ── deepSearchEligibility ────────────────────────────────────────────────────

const OK: DeepSearchEligibilityInput = { tier: 'solo', verification: 'verified' };

test('eligible: any verified PAID tier (Supplier Plus/Pro/Ultra) passes', () => {
  for (const tier of ['solo', 'pro', 'enterprise']) {
    assert.deepEqual(
      deepSearchEligibility({ tier, verification: 'verified' }),
      { ok: true },
      `paid+verified tier ${tier} must be eligible`,
    );
  }
});

test('ineligible: free / verified (free) tiers are denied tier_too_low', () => {
  for (const tier of ['free', 'verified', null, undefined, 'garbage']) {
    assert.deepEqual(
      deepSearchEligibility({ tier, verification: 'verified' }),
      { ok: false, reason: 'tier_too_low' },
      `free tier ${String(tier)} must be denied`,
    );
  }
});

test('denied: paid tier but unverified → unverified (gate order tier → verification)', () => {
  assert.deepEqual(deepSearchEligibility({ tier: 'pro', verification: 'pending' }), {
    ok: false,
    reason: 'unverified',
  });
  assert.deepEqual(deepSearchEligibility({ tier: 'pro', verification: null }), {
    ok: false,
    reason: 'unverified',
  });
  // tier is checked BEFORE verification: a free unverified vendor surfaces
  // tier_too_low (matches what the action rejects with first).
  assert.deepEqual(deepSearchEligibility({ tier: 'free', verification: null }), {
    ok: false,
    reason: 'tier_too_low',
  });
});

// ── resolveDeepSearchPricePhp — owner 2026-11-09 (DECISION_LOG 🔎💳 "DEEP SEARCH = ₱499, ONE USE, EVERY PLAN — NO
//    FREE SEARCH ON PRO/ULTRA"): the catalogue price on every run, never ₱0 ──────────────────────────────────────────

test('price: the catalogue price on every run — never ₱0, the free search is gone', () => {
  assert.equal(resolveDeepSearchPricePhp({ cyclePricePhp: 499 }), 499);
  assert.equal(resolveDeepSearchPricePhp({ cyclePricePhp: 750 }), 750, 'an admin reprice flows straight through');
});

test('price: missing/invalid catalogue value falls back — and still never ₱0', () => {
  for (const v of [undefined, null, 0, -5, Number.NaN]) {
    assert.equal(resolveDeepSearchPricePhp({ cyclePricePhp: v }), VENDOR_DEEP_SEARCH_FALLBACK_PHP, String(v));
  }
  assert.ok(VENDOR_DEEP_SEARCH_FALLBACK_PHP > 0);
});

test('🔒 no free-search allowance survives — no allowance helper, no cycle, no was_free claim in the run action', () => {
  for (const gone of ['deepSearchHasFreeAllowance', 'deepSearchCycleStartMs', 'countDeepSearchUsesSince', 'VENDOR_DEEP_SEARCH_PERIOD_DAYS']) {
    assert.equal(gone in addon, false, `${gone} is exported again — the Pro/Ultra free search is back`);
  }
  const action = stripComments(
    readFileSync(fileURLToPath(new URL('../app/vendor-dashboard/deep-search/actions.ts', import.meta.url)), 'utf8'),
  );
  assert.doesNotMatch(action, /was_free:\s*true/, 'the run action claims a free search again');
  assert.doesNotMatch(action, /wasFree:\s*true/, 'the run action runs a free search again');
  assert.match(action, /requested_total_php:\s*pricePhp/, 'the one order no longer carries the resolved price');
});
