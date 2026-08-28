/**
 * The stacking rule, pinned against the SHIPPED function.
 *
 * ⚠ THE FIRST DRAFT OF THIS FILE WAS DECORATION and is worth recording. It
 * declared `const held = (b, f) => b + f` beside the assertions and tested
 * that — its own copy of the rule. Gutting the dial would have left it green.
 * A guard has to run the code it guards; anything else is a test of the test.
 *
 * The rule itself is the owner's correction of 2026-08-29: a top-up STACKS on
 * the free grant, so ₱50 leaves the celebration holding 150, not 100.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { papicCreditsHeld, papicVideosAffordable } from './papic-credits-held';
import { PAPIC_POINTS_PER_CLIP, PAPIC_POINTS_PER_PHOTO } from './papic-cameras-pure';

test('a top-up STACKS on the free grant — 100 bought + 50 free holds 150', () => {
  assert.equal(papicCreditsHeld(100, 50), 150);
});

test('buying nothing still holds the free grant', () => {
  assert.equal(papicCreditsHeld(0, 50), 50);
});

test('the grant is carried at EVERY rung, not only the first', () => {
  for (const bought of [100, 200, 1_000, 20_000, 50_000]) {
    assert.equal(
      papicCreditsHeld(bought, 50),
      bought + 50,
      `rung ${bought} dropped the free grant — every rung must carry it`,
    );
  }
});

test('a missing or nonsense grant never produces NaN on a price surface', () => {
  // A read that degrades must show a smaller true number, never "NaN credits".
  assert.equal(papicCreditsHeld(100, Number.NaN), 100);
  assert.equal(papicCreditsHeld(Number.NaN, 50), 50);
  assert.equal(papicCreditsHeld(-5, -5), 0);
});

test('videos are derived from the shipped clip weight, never a literal divisor', () => {
  assert.ok(
    PAPIC_POINTS_PER_CLIP > PAPIC_POINTS_PER_PHOTO,
    'a ten-second video must cost more than a photograph',
  );
  const held = papicCreditsHeld(1_000, 50);
  assert.equal(papicVideosAffordable(held, PAPIC_POINTS_PER_CLIP), Math.floor(held / PAPIC_POINTS_PER_CLIP));
});

test('a zero or missing clip weight cannot divide by zero', () => {
  assert.equal(papicVideosAffordable(1_000, 0), 0);
  assert.equal(papicVideosAffordable(1_000, Number.NaN), 0);
});

test('the dial actually USES the shared rule — it does not re-add inline', async () => {
  /*
    The regression this file exists to catch is someone "simplifying"
    `papicCreditsHeld(bought, free)` back to `bought` on the display line. That
    is invisible on screen (the number just gets smaller) and no arithmetic test
    above would notice, because they test the helper rather than the caller.
  */
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const dial = readFileSync(
    join(here, '..', 'app', '(shell)', 'papic', '_papic-dial.tsx'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  const uses = (dial.match(/papicCreditsHeld\(/g) ?? []).length;
  assert.ok(
    uses >= 3,
    `The credit dial calls papicCreditsHeld ${uses} time(s). It needs it for the ` +
      'headline total, the recommendation search and the recommendation label — ' +
      'a missing one means that surface silently dropped the free grant.',
  );
  assert.match(
    dial,
    /papicVideosAffordable\(/,
    'The dial stopped deriving its video count from the clip weight.',
  );
});
