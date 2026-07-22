import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deepSearchEligibility,
  deepSearchHasFreeAllowance,
  deepSearchCycleStartMs,
  resolveDeepSearchPricePhp,
  VENDOR_DEEP_SEARCH_FALLBACK_PHP,
  VENDOR_DEEP_SEARCH_PERIOD_DAYS,
  type DeepSearchEligibilityInput,
} from './vendor-deep-search-addon';

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS = VENDOR_DEEP_SEARCH_PERIOD_DAYS * DAY_MS;

// ── deepSearchEligibility ────────────────────────────────────────────────────

const OK: DeepSearchEligibilityInput = { tier: 'solo', verification: 'verified' };

test('eligible: any verified PAID tier (Solo/Pro/Enterprise/Custom) passes', () => {
  for (const tier of ['solo', 'pro', 'enterprise', 'custom']) {
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

// ── deepSearchHasFreeAllowance ───────────────────────────────────────────────

test('free allowance: Pro/Enterprise/Custom yes; Solo no', () => {
  assert.equal(deepSearchHasFreeAllowance('pro'), true);
  assert.equal(deepSearchHasFreeAllowance('enterprise'), true);
  assert.equal(deepSearchHasFreeAllowance('custom'), true);
  assert.equal(deepSearchHasFreeAllowance('solo'), false);
  assert.equal(deepSearchHasFreeAllowance('free'), false);
  assert.equal(deepSearchHasFreeAllowance(null), false);
});

// ── resolveDeepSearchPricePhp ────────────────────────────────────────────────

test('price: Solo ALWAYS pays ₱500 — free allowance never applies', () => {
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 0, cyclePricePhp: 500 }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 1, cyclePricePhp: 500 }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 9, cyclePricePhp: 500 }), 500);
});

test('price: Pro first search of the cycle is FREE (₱0), then ₱500', () => {
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 0, cyclePricePhp: 500 }), 0);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 1, cyclePricePhp: 500 }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 2, cyclePricePhp: 500 }), 500);
});

test('price: Enterprise + Custom also get the first-free-then-₱500 allowance', () => {
  assert.equal(resolveDeepSearchPricePhp({ tier: 'enterprise', usesThisCycle: 0, cyclePricePhp: 500 }), 0);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'enterprise', usesThisCycle: 1, cyclePricePhp: 500 }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'custom', usesThisCycle: 0, cyclePricePhp: 500 }), 0);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'custom', usesThisCycle: 3, cyclePricePhp: 500 }), 500);
});

test('price: an admin reprice flows straight through on a paid run', () => {
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 0, cyclePricePhp: 750 }), 750);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 1, cyclePricePhp: 750 }), 750);
});

test('price: missing/invalid catalog value falls back to ₱500 on a paid run', () => {
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 0 }), VENDOR_DEEP_SEARCH_FALLBACK_PHP);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 0, cyclePricePhp: 0 }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'solo', usesThisCycle: 0, cyclePricePhp: -5 }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 1, cyclePricePhp: null }), 500);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 1, cyclePricePhp: Number.NaN }), 500);
  // A Pro vendor's FREE first search is ₱0 regardless of a missing catalog price.
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: 0, cyclePricePhp: null }), 0);
});

// ── deepSearchCycleStartMs ───────────────────────────────────────────────────

test('cycle: current cycle start is the most recent 28-day boundary at/before now', () => {
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  // Monthly plan: expiry a few days out. Boundaries fall on expiry − k·28d.
  const exp = new Date(now + 5 * DAY_MS).toISOString();
  const start = deepSearchCycleStartMs(exp, now);
  // Nearest boundary ≤ now is expiry − 28d = now + 5d − 28d = now − 23d.
  assert.equal(start, now - 23 * DAY_MS);
  // now sits inside [start, start + 28d).
  assert.ok(start <= now && now < start + PERIOD_MS);
});

test('cycle: annual plan (expiry many months out) still resets every 28 days', () => {
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  const exp = new Date(now + 300 * DAY_MS).toISOString();
  const start = deepSearchCycleStartMs(exp, now);
  // now must land inside a 28-day window, and the window must be phase-aligned to
  // expiry (expiry − start is a whole number of periods).
  assert.ok(start <= now && now < start + PERIOD_MS);
  assert.equal((Date.parse(exp) - start) % PERIOD_MS, 0);
});

test('cycle: exactly on a boundary — now === expiry keeps expiry as the start', () => {
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  const exp = new Date(now).toISOString();
  assert.equal(deepSearchCycleStartMs(exp, now), now);
});

test('cycle: missing/invalid expiry → rolling 28-day window ending now', () => {
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  assert.equal(deepSearchCycleStartMs(null, now), now - PERIOD_MS);
  assert.equal(deepSearchCycleStartMs(undefined, now), now - PERIOD_MS);
  assert.equal(deepSearchCycleStartMs('not-a-date', now), now - PERIOD_MS);
});

// ── integration: cycle-start + count feeding the price ───────────────────────

test('integration: a Pro vendor with a use inside the cycle now pays ₱500', () => {
  const now = Date.parse('2026-07-22T00:00:00.000Z');
  const exp = new Date(now + 5 * DAY_MS).toISOString();
  const start = deepSearchCycleStartMs(exp, now); // now − 23d
  // A use 2 days ago is inside the current cycle → counts → price ₱500.
  const usedAt = now - 2 * DAY_MS;
  const usesThisCycle = usedAt >= start ? 1 : 0;
  assert.equal(usesThisCycle, 1);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle, cyclePricePhp: 500 }), 500);

  // A use 25 days ago is BEFORE this cycle's start (now − 23d) → doesn't count →
  // the free search is available again.
  const oldUse = now - 25 * DAY_MS;
  const usesThisCycle2 = oldUse >= start ? 1 : 0;
  assert.equal(usesThisCycle2, 0);
  assert.equal(resolveDeepSearchPricePhp({ tier: 'pro', usesThisCycle: usesThisCycle2, cyclePricePhp: 500 }), 0);
});
