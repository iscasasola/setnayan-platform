/**
 * portfolio-count.test.ts — the one "N of 50 free photos" read (THE ONE BUILD §9 #17) says the uploader's numbers
 * and never invents a zero: a refused read answers `{ ok: false }`, which Today and Portfolio print as "Couldn't load".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { portfolioCountLabel } from './portfolio-count-label';
import { PORTFOLIO_FREE_BASE } from './vendor-tier-caps';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = stripComments(readFileSync(join(HERE, 'portfolio-count.ts'), 'utf8'));

test('inside the free room it reads "N of FREE free photos"', () => {
  assert.equal(portfolioCountLabel(12, PORTFOLIO_FREE_BASE), `12 of ${PORTFOLIO_FREE_BASE} free photos`);
  assert.equal(portfolioCountLabel(0, PORTFOLIO_FREE_BASE), `0 of ${PORTFOLIO_FREE_BASE} free photos`);
  assert.equal(
    portfolioCountLabel(PORTFOLIO_FREE_BASE, PORTFOLIO_FREE_BASE),
    `${PORTFOLIO_FREE_BASE} of ${PORTFOLIO_FREE_BASE} free photos`,
  );
});

test('past the free room it says the free room is used — never "62 of 50"', () => {
  assert.equal(portfolioCountLabel(62, 50), '62 photos · 50 free used');
  assert.equal(portfolioCountLabel(1200, 100), '1,200 photos · 100 free used');
});

test('it reads the same cap the uploader uses (portfolioPhotoCap + the allowance read + the page gallery)', () => {
  assert.match(SRC, /portfolioPhotoCap\(/);
  assert.match(SRC, /readPortfolioAllowance\(/);
  assert.match(SRC, /portfolio_r2_keys/);
});

test('a refused read, a missing row or an unread allowance answers { ok: false } — never photos: 0', () => {
  assert.match(SRC, /if \(error\) \{[\s\S]{0,160}return \{ ok: false \}/);
  assert.match(SRC, /if \(!data \|\| !allowance\.ok\) return \{ ok: false \}/);
  assert.doesNotMatch(SRC, /photos:\s*0\b/);
});
