import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scoreTier,
  scorePlausibility,
  PLAUSIBILITY_REASON_LABEL,
  FLAG_THRESHOLD,
  TIER1_INCLUSION_RATIO,
  TIER2_BAND_LOW_RATIO,
  TIER2_WEIGHT,
  TIER3_SELF_RATIO,
  type PlausibilityInputs,
} from './plausibility-scoring';

// ---------------------------------------------------------------------------
// scoreTier — the shared ratio scorer
// ---------------------------------------------------------------------------

test('scoreTier: null / non-positive / non-finite ref → noData, never fires', () => {
  for (const ref of [null, 0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const t = scoreTier(10_000, ref as number | null, 0.4, 1);
    assert.equal(t.noData, true);
    assert.equal(t.fired, false);
    assert.equal(t.severity, 0);
    assert.equal(t.weighted, 0);
  }
});

test('scoreTier: bad lock (NaN / negative) → noData, never fires', () => {
  const t = scoreTier(Number.NaN, 100_000, 0.4, 1);
  assert.equal(t.noData, true);
  assert.equal(t.fired, false);
});

test('scoreTier: lock at/above the trigger ratio → evaluated but does NOT fire', () => {
  // ratio 0.4 is NOT < 0.4 (boundary) → plausible, not fired, and noData=false
  const boundary = scoreTier(40_000, 100_000, 0.4, 1);
  assert.equal(boundary.fired, false);
  assert.equal(boundary.noData, false);
  assert.equal(boundary.severity, 0);
  // clearly above
  const above = scoreTier(90_000, 100_000, 0.4, 1);
  assert.equal(above.fired, false);
});

test('scoreTier: below trigger → severity is % below the full reference, weighted applied', () => {
  // lock 20k vs ref 100k → ratio 0.2 → severity 80
  const t = scoreTier(20_000, 100_000, 0.4, 0.6);
  assert.equal(t.fired, true);
  assert.equal(t.severity, 80);
  assert.equal(t.weighted, 80 * 0.6);
  assert.equal(t.refPhp, 100_000);
});

// ---------------------------------------------------------------------------
// scorePlausibility — combined scoring + flag decision
// ---------------------------------------------------------------------------

const NONE: PlausibilityInputs = {
  lockPricePhp: 50_000,
  inclusionWorthPhp: null,
  bandLowPhp: null,
  ownMedianPhp: null,
};

test('no reference data at all → score 0, not flagged, reason plausible', () => {
  const r = scorePlausibility(NONE);
  assert.equal(r.score, 0);
  assert.equal(r.flagged, false);
  assert.equal(r.reason, 'plausible');
  assert.deepEqual(r.detail.fired_tiers, []);
});

test('below-min-sample (ownMedian null) with no other signal → NO flag', () => {
  // Thin market: the vendor has too few other locks for a verified median, and
  // there is no band and no inclusion worth → nothing fires.
  const r = scorePlausibility({ ...NONE, lockPricePhp: 1_000 });
  assert.equal(r.flagged, false);
  assert.equal(r.detail.tiers.self_consistency.noData, true);
});

test('Tier 3 self-consistency: a >60% discount off own median flags alone', () => {
  // lock 15k vs own median 100k → ratio 0.15 → severity 85, weight 1.0 → 85
  const r = scorePlausibility({
    lockPricePhp: 15_000,
    inclusionWorthPhp: null,
    bandLowPhp: null,
    ownMedianPhp: 100_000,
  });
  assert.equal(r.detail.tiers.self_consistency.fired, true);
  assert.equal(r.score, 85);
  assert.equal(r.flagged, true);
  assert.equal(r.reason, 'self_consistency');
  assert.deepEqual(r.detail.fired_tiers, ['self_consistency']);
});

test('Tier 3: a legit 50%-off booking (ratio 0.5) does NOT fire', () => {
  // 0.5 is above the 0.4 trigger → not fired → not flagged.
  const r = scorePlausibility({
    lockPricePhp: 50_000,
    inclusionWorthPhp: null,
    bandLowPhp: null,
    ownMedianPhp: 100_000,
  });
  assert.equal(r.detail.tiers.self_consistency.fired, false);
  assert.equal(r.flagged, false);
  assert.ok(TIER3_SELF_RATIO === 0.4);
});

test('HONEST BUDGET VENDOR: consistently cheap + below peers → NOT flagged', () => {
  // A genuinely cheap vendor whose EVERY lock is ~₱50k. Their own median ≈ the
  // lock (internally consistent → tier 3 silent), and they sit below the market
  // band (peers pricier → tier 2 fires) — but tier 2 is capped and can't flag
  // alone. This is the core guarantee: cheap-but-honest is never punished.
  const r = scorePlausibility({
    lockPricePhp: 50_000,
    inclusionWorthPhp: null, // (no inclusion worth stated)
    bandLowPhp: 120_000, // peers start at ₱120k
    ownMedianPhp: 52_000, // their own typical price is ~₱50k too
  });
  assert.equal(r.detail.tiers.self_consistency.fired, false);
  assert.equal(r.detail.tiers.category_median.fired, true); // below band
  assert.equal(r.flagged, false, 'a consistent cheap vendor must never be flagged');
  assert.ok(r.score <= TIER2_WEIGHT * 100);
});

test('COMPETITION-LAW: Tier 2 alone can NEVER cross the flag threshold', () => {
  // Even a lock at ~₱0 vs a band low → tier-2 severity ~100, weighted ~35 < 50.
  const r = scorePlausibility({
    lockPricePhp: 1,
    inclusionWorthPhp: null,
    bandLowPhp: 500_000,
    ownMedianPhp: null,
  });
  assert.equal(r.detail.tiers.category_median.fired, true);
  assert.ok(r.score <= TIER2_WEIGHT * 100);
  assert.ok(r.score < FLAG_THRESHOLD);
  assert.equal(r.flagged, false);
});

test('Tier 1 inclusion floor: an extreme price/inclusion mismatch can flag alone', () => {
  // lock 10k vs stated inclusion worth 100k → ratio 0.1 → severity 90 → 90*0.6=54
  const r = scorePlausibility({
    lockPricePhp: 10_000,
    inclusionWorthPhp: 100_000,
    bandLowPhp: null,
    ownMedianPhp: null,
  });
  assert.equal(r.detail.tiers.inclusion_floor.fired, true);
  assert.ok(r.flagged);
  assert.equal(r.reason, 'inclusion_floor');
});

test('Tier 1: mild "value" puffery (lock just under worth) does NOT fire', () => {
  // lock 90k vs stated worth 100k → ratio 0.9, above the 0.33 trigger → silent.
  const r = scorePlausibility({
    lockPricePhp: 90_000,
    inclusionWorthPhp: 100_000,
    bandLowPhp: null,
    ownMedianPhp: null,
  });
  assert.equal(r.detail.tiers.inclusion_floor.fired, false);
  assert.equal(r.flagged, false);
  assert.ok(TIER1_INCLUSION_RATIO === 0.33);
});

test('Tier 2 CORROBORATES a borderline self-referential signal over the line', () => {
  // Tier 1 alone: lock 25k vs worth 100k → ratio 0.25 sev 75 → 45 (< 50, no flag).
  const t1Only = scorePlausibility({
    lockPricePhp: 25_000,
    inclusionWorthPhp: 100_000,
    bandLowPhp: null,
    ownMedianPhp: null,
  });
  assert.equal(t1Only.flagged, false);
  // Add a band the lock sits well below → tier 2 nudges it over the threshold.
  const withBand = scorePlausibility({
    lockPricePhp: 25_000,
    inclusionWorthPhp: 100_000,
    bandLowPhp: 60_000, // 25k/60k = 0.417 < 0.5 → tier2 fires
    ownMedianPhp: null,
  });
  assert.equal(withBand.detail.tiers.category_median.fired, true);
  assert.ok(withBand.score > t1Only.score);
  assert.equal(withBand.flagged, true);
  // Reason is still the self-referential tier (strongest weighted), not tier 2.
  assert.equal(withBand.reason, 'inclusion_floor');
  assert.ok(TIER2_BAND_LOW_RATIO === 0.5);
});

test('reason = strongest WEIGHTED fired tier; fired_tiers lists all that fired', () => {
  // All three fire; self-consistency has the highest weight → wins the reason.
  const r = scorePlausibility({
    lockPricePhp: 10_000,
    inclusionWorthPhp: 100_000, // sev 90 * 0.6 = 54
    bandLowPhp: 100_000, // sev 90 * 0.35 = 31.5
    ownMedianPhp: 100_000, // sev 90 * 1.0 = 90
  });
  assert.deepEqual([...r.detail.fired_tiers].sort(), [
    'category_median',
    'inclusion_floor',
    'self_consistency',
  ]);
  assert.equal(r.reason, 'self_consistency');
  assert.equal(r.score, 100); // clamped
});

test('score is clamped to 0..100', () => {
  const r = scorePlausibility({
    lockPricePhp: 1,
    inclusionWorthPhp: 1_000_000,
    bandLowPhp: 1_000_000,
    ownMedianPhp: 1_000_000,
  });
  assert.ok(r.score <= 100 && r.score >= 0);
});

// ---------------------------------------------------------------------------
// Competition-law / copy discipline — the reason labels are INTERNAL-only
// ---------------------------------------------------------------------------

test('category_median label is explicitly framed as INTERNAL, never couple-facing', () => {
  const label = PLAUSIBILITY_REASON_LABEL.category_median ?? '';
  assert.match(label, /internal/i);
  assert.match(label, /never surfaced to couples/i);
});

test('no reason label tells a vendor they are "cheap" / "too low" / "below market" as a verdict', () => {
  // The cross-vendor phrasing may only appear inside the explicitly-internal
  // category_median label; no label may carry a couple/vendor-facing judgement.
  for (const [key, label] of Object.entries(PLAUSIBILITY_REASON_LABEL)) {
    assert.doesNotMatch(label, /you('|’)?re (too )?cheap/i, `${key} must not call a vendor cheap`);
    assert.doesNotMatch(label, /priced too low/i, `${key} must not say "priced too low"`);
  }
});

test('every fired-tier reason key has human copy', () => {
  for (const key of ['self_consistency', 'inclusion_floor', 'category_median', 'plausible']) {
    assert.ok(PLAUSIBILITY_REASON_LABEL[key], `missing label for ${key}`);
  }
});
