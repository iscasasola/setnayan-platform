/**
 * portfolio-count.test.ts — the one portfolio count read (THE ONE BUILD §9 #17). Since 2026-11-23 there is no free room
 * and no cap (owner: storage is the only limit), so it says "N photos" and never invents a zero: a refused read answers
 * `{ ok: false }`, which Today and Portfolio print as "Couldn't load".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { portfolioCountLabel } from './portfolio-count-label';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'portfolio-count.ts'), 'utf8'));

test('it reads "N photos" — no "of 50", no "free"', () => {
  assert.equal(portfolioCountLabel(12), '12 photos');
  assert.equal(portfolioCountLabel(1), '1 photo');
  assert.equal(portfolioCountLabel(0), '0 photos');
  assert.equal(portfolioCountLabel(1200), '1,200 photos');
});

test('it reads the page gallery and nothing about a cap', () => {
  assert.match(SRC, /portfolio_r2_keys/);
  assert.doesNotMatch(SRC, /portfolioPhotoCap|readPortfolioAllowance|portfolio_photo_allowance|tier_state/);
});

test('a refused read or a missing row answers { ok: false } — never photos: 0', () => {
  assert.match(SRC, /if \(error\) \{[\s\S]{0,160}return \{ ok: false \}/);
  assert.match(SRC, /if \(!data\) return \{ ok: false \}/);
  assert.doesNotMatch(SRC, /photos:\s*0\b/);
});
