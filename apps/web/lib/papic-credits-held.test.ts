/**
 * The dial's credit arithmetic, pinned against the SHIPPED function.
 *
 * 🎁 UPDATED 27 Nov 2026: the stacking rule (a top-up STACKS on the free grant)
 * went with the free first-event grant (owner 16 Nov 2026, DECISION_LOG "Free 50
 * Papic credits REMOVED"). The dial now shows what the money buys, and the last
 * test below holds that no free grant creeps back onto it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { papicVideosAffordable } from './papic-credits-held';
import { PAPIC_POINTS_PER_SNIPPET, PAPIC_POINTS_PER_PHOTO } from './papic-cameras-pure';

test('videos are derived from the shipped clip weight, never a literal divisor', () => {
  assert.ok(
    PAPIC_POINTS_PER_SNIPPET > PAPIC_POINTS_PER_PHOTO,
    'a ten-second video must cost more than a photograph',
  );
  const held = 1_000;
  assert.equal(papicVideosAffordable(held, PAPIC_POINTS_PER_SNIPPET), Math.floor(held / PAPIC_POINTS_PER_SNIPPET));
});

test('a zero or missing clip weight cannot divide by zero', () => {
  assert.equal(papicVideosAffordable(1_000, 0), 0);
  assert.equal(papicVideosAffordable(1_000, Number.NaN), 0);
});

test('the dial adds no free grant — it shows what the money buys (owner 16 Nov 2026)', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const dial = readFileSync(join(here, '..', 'app', '(shell)', 'papic', '_papic-dial.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(dial, /freeCredits|papicCreditsHeld|PAPIC_FREE_CREDIT_CONDITION/, 'the free first-event grant is back on the dial');
  assert.doesNotMatch(dial, />\s*free\b|\bfree\s*\{/i, 'the dial says "free" again');
  assert.match(dial, /papicVideosAffordable\(/, 'The dial stopped deriving its video count from the clip weight.');
});
