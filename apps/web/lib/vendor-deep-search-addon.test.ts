import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import {
  deepSearchEligibility,
  deepSearchIncluded,
  deepSearchMonth,
  deepSearchRunsLeft,
  type DeepSearchEligibilityInput,
} from './vendor-deep-search-addon';

// ⚖ Owner 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH"): never sold;
// Plus, Pro and Ultra include the admin's number of runs each PAID month; Free and Verified none. The never-sold half is
// lib/deep-search-is-never-sold.test.ts; this file pins the pure decisions.

// ── deepSearchEligibility ────────────────────────────────────────────────────

const OK: DeepSearchEligibilityInput = { tier: 'solo', verification: 'verified' };

test('eligible: any verified paid plan (Plus, Pro, Ultra) passes', () => {
  for (const tier of ['solo', 'pro', 'enterprise']) {
    assert.deepEqual(deepSearchEligibility({ ...OK, tier }), { ok: true }, tier);
    assert.equal(deepSearchIncluded(tier), true, tier);
  }
});

test('ineligible: Free and Verified get no runs — denied tier_too_low', () => {
  for (const tier of ['free', 'verified', null, undefined, 'garbage']) {
    assert.deepEqual(deepSearchEligibility({ tier, verification: 'verified' }), { ok: false, reason: 'tier_too_low' }, String(tier));
    assert.equal(deepSearchIncluded(tier), false, String(tier));
  }
});

test('denied: paid plan but unverified → unverified (gate order plan → verification)', () => {
  assert.deepEqual(deepSearchEligibility({ tier: 'pro', verification: 'pending' }), { ok: false, reason: 'unverified' });
  assert.deepEqual(deepSearchEligibility({ tier: 'pro', verification: null }), { ok: false, reason: 'unverified' });
  assert.deepEqual(deepSearchEligibility({ tier: 'free', verification: null }), { ok: false, reason: 'tier_too_low' });
});

// ── deepSearchMonth — "resets each paid month" ───────────────────────────────

const at = (iso: string) => new Date(iso).getTime();

test('the paid month runs from one month before the paid-through date', () => {
  const m = deepSearchMonth('2026-12-10T05:00:00.000Z', at('2026-11-24T00:00:00Z'));
  assert.deepEqual(m, { startIso: '2026-11-10T05:00:00.000Z', resetsAtIso: '2026-12-10T05:00:00.000Z' });
});

test('paid several months ahead → the EARLIEST unexpired month, stepped from the expiry (a 31st never drifts)', () => {
  const m = deepSearchMonth('2027-03-31T00:00:00.000Z', at('2026-12-15T00:00:00Z'));
  assert.deepEqual(m, { startIso: '2026-11-30T00:00:00.000Z', resetsAtIso: '2026-12-31T00:00:00.000Z' });
  const feb = deepSearchMonth('2027-03-31T00:00:00.000Z', at('2027-03-05T00:00:00Z'));
  assert.deepEqual(feb, { startIso: '2027-02-28T00:00:00.000Z', resetsAtIso: '2027-03-31T00:00:00.000Z' });
});

test('the same month key on every read inside one paid month (the claim and the count agree)', () => {
  const a = deepSearchMonth('2026-12-10T05:00:00.000Z', at('2026-11-10T05:00:00Z'));
  const b = deepSearchMonth('2026-12-10T05:00:00.000Z', at('2026-12-10T04:59:59Z'));
  assert.equal(a.startIso, b.startIso);
  const next = deepSearchMonth('2027-01-10T05:00:00.000Z', at('2026-12-10T05:00:00Z'));
  assert.equal(next.startIso, '2026-12-10T05:00:00.000Z', 'a renewal does not open the new month at its start');
});

test('no future expiry (comp plan, lapsed or unread) → the Manila calendar month', () => {
  for (const exp of [null, undefined, 'not-a-date', '2026-01-01T00:00:00Z']) {
    const m = deepSearchMonth(exp, at('2026-11-30T17:00:00Z')); // 1 Dec, 01:00 in Manila
    assert.deepEqual(m, { startIso: '2026-11-30T16:00:00.000Z', resetsAtIso: '2026-12-31T16:00:00.000Z' }, String(exp));
  }
});

// ── deepSearchRunsLeft — unused runs don't carry over ────────────────────────

test('runs left: the allowance less this month’s runs, never below 0; not set = none', () => {
  assert.equal(deepSearchRunsLeft(1, 0), 1);
  assert.equal(deepSearchRunsLeft(1, 1), 0);
  assert.equal(deepSearchRunsLeft(3, 1), 2);
  assert.equal(deepSearchRunsLeft(1, 9), 0);
  for (const v of [null, 0, -1, Number.NaN]) assert.equal(deepSearchRunsLeft(v, 0), 0, String(v));
});

test('🔒 no number governs the allowance in code — it is read from platform_settings', () => {
  const src = stripComments(readFileSync(fileURLToPath(new URL('./vendor-deep-search-addon.ts', import.meta.url)), 'utf8'));
  assert.doesNotMatch(src, /RUNS_PER_MONTH\s*=\s*\d|perMonth\s*\?\?\s*\d|DEFAULT_RUNS/, 'a typed allowance is back');
  assert.match(src, /\.select\('deep_search_runs_per_month'\)/);
});
