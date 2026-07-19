/**
 * Phase-A inquiry velocity gate — pure decision logic.
 * The load-bearing guarantee: the gate NEVER blocks a couple below the caps
 * (presumption-of-a-real-couple), blocks exactly at/over each cap, and reports
 * which cap tripped. Caps themselves are asserted so a careless retune that
 * drops them into real-couple territory is caught here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateInquiryVelocity,
  INQUIRY_DAILY_CAP,
  INQUIRY_CONCURRENT_OPEN_CAP,
} from './inquiry-gate';

test('lets a normal couple through well under both caps', () => {
  const v = evaluateInquiryVelocity({ dailyCount: 6, concurrentOpenCount: 9 });
  assert.equal(v.ok, true);
});

test('lets a couple through at exactly cap-minus-one (never blocks below the cap)', () => {
  const v = evaluateInquiryVelocity({
    dailyCount: INQUIRY_DAILY_CAP - 1,
    concurrentOpenCount: INQUIRY_CONCURRENT_OPEN_CAP - 1,
  });
  assert.equal(v.ok, true);
});

test('blocks on the daily cap and says so', () => {
  const v = evaluateInquiryVelocity({
    dailyCount: INQUIRY_DAILY_CAP,
    concurrentOpenCount: 0,
  });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.reason, 'daily');
  assert.ok(v.ok === false && v.message.length > 0);
});

test('blocks on the concurrent cap and says so', () => {
  const v = evaluateInquiryVelocity({
    dailyCount: 0,
    concurrentOpenCount: INQUIRY_CONCURRENT_OPEN_CAP,
  });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.reason, 'concurrent');
});

test('daily cap is checked before the concurrent cap when both trip', () => {
  const v = evaluateInquiryVelocity({
    dailyCount: INQUIRY_DAILY_CAP + 5,
    concurrentOpenCount: INQUIRY_CONCURRENT_OPEN_CAP + 5,
  });
  assert.equal(v.ok === false && v.reason, 'daily');
});

test('caps stay in bot-catching territory, never real-couple territory', () => {
  // Guardrail: a thorough real couple can plausibly open ~15-20 threads across a
  // planning session. If a retune drops these below that, this test fails on
  // purpose — the caps must stay generous.
  assert.ok(INQUIRY_DAILY_CAP >= 20, 'daily cap must stay >= 20');
  assert.ok(INQUIRY_CONCURRENT_OPEN_CAP >= 30, 'concurrent cap must stay >= 30');
});
