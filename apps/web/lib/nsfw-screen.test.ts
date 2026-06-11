/**
 * decideNsfw threshold invariants (Node built-in test runner, run via tsx).
 *
 * Guards the locked block policy of the always-on NSFW screen:
 *   Porn ≥ 0.7  OR  Hentai ≥ 0.75  OR  (Porn + Hentai) ≥ 0.8  → 'nsfw_blocked'
 * and the wedding-critical carve-out: "Sexy" alone NEVER blocks (dancing,
 * gowns, beachwear are normal wedding content).
 *
 * Run: `pnpm test:unit`  (CI: the "unit tests" step).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideNsfw,
  NSFW_COMBINED_THRESHOLD,
  NSFW_HENTAI_THRESHOLD,
  NSFW_PORN_THRESHOLD,
} from './nsfw-screen';

test('blocks high-confidence porn (0.9)', () => {
  assert.equal(
    decideNsfw({ Porn: 0.9, Neutral: 0.05, Sexy: 0.03, Hentai: 0.01, Drawing: 0.01 }),
    'nsfw_blocked',
  );
});

test('blocks high-confidence hentai (0.8)', () => {
  assert.equal(
    decideNsfw({ Hentai: 0.8, Drawing: 0.15, Neutral: 0.03, Porn: 0.01, Sexy: 0.01 }),
    'nsfw_blocked',
  );
});

test('blocks combined porn 0.45 + hentai 0.4 (sum ≥ 0.8)', () => {
  assert.equal(
    decideNsfw({ Porn: 0.45, Hentai: 0.4, Neutral: 0.1, Sexy: 0.04, Drawing: 0.01 }),
    'nsfw_blocked',
  );
});

test('does NOT block sexy alone, even at 0.99', () => {
  assert.equal(
    decideNsfw({ Sexy: 0.99, Neutral: 0.005, Porn: 0.003, Hentai: 0.001, Drawing: 0.001 }),
    'clean',
  );
});

test('does NOT block neutral content', () => {
  assert.equal(
    decideNsfw({ Neutral: 0.97, Drawing: 0.01, Sexy: 0.01, Porn: 0.005, Hentai: 0.005 }),
    'clean',
  );
});

test('boundary: porn exactly at threshold blocks; just below does not', () => {
  assert.equal(decideNsfw({ Porn: NSFW_PORN_THRESHOLD }), 'nsfw_blocked');
  assert.equal(decideNsfw({ Porn: NSFW_PORN_THRESHOLD - 0.001 }), 'clean');
});

test('boundary: hentai exactly at threshold blocks; just below does not', () => {
  assert.equal(decideNsfw({ Hentai: NSFW_HENTAI_THRESHOLD }), 'nsfw_blocked');
  assert.equal(decideNsfw({ Hentai: NSFW_HENTAI_THRESHOLD - 0.001 }), 'clean');
});

test('boundary: combined sum exactly at threshold blocks; just below does not', () => {
  assert.equal(
    decideNsfw({ Porn: NSFW_COMBINED_THRESHOLD / 2, Hentai: NSFW_COMBINED_THRESHOLD / 2 }),
    'nsfw_blocked',
  );
  assert.equal(
    decideNsfw({
      Porn: NSFW_COMBINED_THRESHOLD / 2,
      Hentai: NSFW_COMBINED_THRESHOLD / 2 - 0.001,
    }),
    'clean',
  );
});

test('missing classes count as zero (empty scores → clean)', () => {
  assert.equal(decideNsfw({}), 'clean');
});
