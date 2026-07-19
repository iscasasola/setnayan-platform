/**
 * papic-adaptive-quality invariants (Node built-in test runner, run via tsx —
 * `pnpm test:unit`). In Node there's no `navigator`, so the tier is driven
 * purely by the measured-throughput EMA — exactly the iOS-Safari cold path
 * (no Network Information API) we self-correct into from the first sample.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  recordUploadSample,
  measuredKbps,
  getPapicQualityTier,
  photoJpegQuality,
  clipVideoBitsPerSecond,
  __resetAdaptiveQualityForTest,
} from './papic-adaptive-quality';

test('no samples yet → optimistic full tier, null measurement', () => {
  __resetAdaptiveQualityForTest();
  assert.equal(measuredKbps(), null);
  assert.equal(getPapicQualityTier(), 'full');
});

test('throughput thresholds map to tiers', () => {
  __resetAdaptiveQualityForTest();
  recordUploadSample(1_000_000, 1_000); // 8000 kbps
  assert.equal(getPapicQualityTier(), 'full');

  __resetAdaptiveQualityForTest();
  recordUploadSample(100_000, 1_000); // 800 kbps
  assert.equal(getPapicQualityTier(), 'reduced');

  __resetAdaptiveQualityForTest();
  recordUploadSample(10_000, 1_000); // 80 kbps
  assert.equal(getPapicQualityTier(), 'queue_only');
});

test('recordUploadSample ignores degenerate inputs', () => {
  __resetAdaptiveQualityForTest();
  recordUploadSample(0, 1_000);
  recordUploadSample(1_000, 0);
  recordUploadSample(-5, -5);
  assert.equal(measuredKbps(), null);
});

test('EMA blends toward the newest sample', () => {
  __resetAdaptiveQualityForTest();
  recordUploadSample(1_000_000, 1_000); // 8000
  const first = measuredKbps();
  assert.ok(first !== null && Math.abs(first - 8000) < 1e-6);
  recordUploadSample(100_000, 1_000); // 800 → EMA 0.4*800 + 0.6*8000 = 5120
  const second = measuredKbps();
  assert.ok(second !== null && Math.abs(second - 5120) < 1e-6);
});

test('encode params per tier', () => {
  assert.equal(photoJpegQuality('full'), 0.9);
  assert.equal(photoJpegQuality('reduced'), 0.72);
  assert.equal(photoJpegQuality('queue_only'), 0.72);
  assert.equal(clipVideoBitsPerSecond('full'), undefined);
  assert.equal(clipVideoBitsPerSecond('reduced'), 2_500_000);
  assert.equal(clipVideoBitsPerSecond('queue_only'), 2_500_000);
});
