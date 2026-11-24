/**
 * ⭐ THE SHOP'S REVIEW COUNT IS THE BARS' COUNT (supplier walk on live, 24 Nov 2026; controller brief).
 *
 * Measured on live (/setnaprod › Reviews): "— overall · 0 reviews across all their services" directly over bars
 * reading 5★ = 2 · 4★ = 1 and a printed 4★ review. The count read `trusted_review_count` (anti-fraud aggregate) while
 * the bars and the list read the raw `vendor_review_stats`. Two readers, one fact, two answers.
 *
 * Fails if the count stops summing the bars, or the trusted gap stops being said.
 * The star AVERAGE stays on the trusted aggregate (anti-fraud ruling 2026-07-05) — this guard does not move it.
 * SABOTAGE (seen red, restored): put `formatCount(trustedCount)} review` back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '..', 'app/v/[slug]/page.tsx'), 'utf8');
const hero = SRC.slice(SRC.indexOf('function ReviewHeroMetrics('), SRC.indexOf('function ReviewRow('));

test('the count line sums the same star totals the bars draw', () => {
  assert.match(hero, /const reviewCount = totals\.reduce\(\(sum, t\) => sum \+ t\.count, 0\);/);
  assert.match(hero, /\{formatCount\(reviewCount\)\} review\{reviewCount === 1/);
  assert.doesNotMatch(hero, /formatCount\(trustedCount\)\} review/);
});

test('the headline stars stay trusted, and a gap is said', () => {
  assert.match(hero, /const hero = trusted\.trusted_avg_rating;/);
  assert.match(hero, /data-review-stars-count="trusted"/);
});
