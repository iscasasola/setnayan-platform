/**
 * THE FEATURE CONTROL MUST EXIST FOR A CHAPTER TOLD IN WRITING.
 *
 * 🚨 THE REGRESSION THIS LOCKS. On 2026-08-12 the server action stopped
 * refusing to feature a chapter with no YouTube video — but the admin surface
 * still rendered the Feature button only inside `r.thumbUrl ? (…)`, so every
 * written story showed a greyed-out "Not featurable" and there was nothing to
 * click. The refusal was lifted at one layer and the control was never restored
 * at the other: **a fix nobody can reach is no fix.**
 *
 * This is a SOURCE guard, and the honest limits are stated rather than implied:
 * it proves the control is not gated on a thumbnail and that the dead-end copy
 * is gone. It cannot prove the button renders in a browser. It is anchored on a
 * POSITIVE assertion first — if the file moves or the markup is renamed, the
 * anchor fails loudly instead of the guard passing because its searches quietly
 * matched nothing. A search that cannot match is not a negative result.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FILE = join(
  process.cwd(),
  'app',
  'admin',
  'studio',
  '_surfaces',
  'storytellers-surface.tsx',
);

function source(): string {
  return readFileSync(FILE, 'utf8');
}

test('ANCHOR: the Feature control is in this file (else every check below is vacuous)', () => {
  const src = source();
  const featureLabels = src.split('confirmLabel="Feature"').length - 1;
  assert.equal(
    featureLabels,
    1,
    'expected exactly one Feature confirm control — if this moved, the ' +
      'assertions below are searching a file that no longer owns the button ' +
      'and would pass no matter how broken it is.',
  );
  assert.ok(
    src.includes('action={setChapterFeatured}'),
    'the Feature control must still submit to setChapterFeatured',
  );
});

test('the Feature button is NOT gated on a YouTube thumbnail', () => {
  const src = source();
  // The exact shape of the regression: `) : r.thumbUrl ? (` wrapping the
  // Feature ConfirmForm, so only video chapters got a button.
  const gated = src.split(': r.thumbUrl ? (').length - 1;
  assert.equal(
    gated,
    0,
    'the Feature control is gated on r.thumbUrl again — a chapter told in ' +
      'writing has no thumbnail, so this hides the button and the owner ' +
      'cannot feature a written story at all.',
  );
});

test('the "Not featurable" dead end is gone — including in comments', () => {
  const src = source();
  // Deliberately matches comments too. This is not over-reach: the sentence
  // itself is what made a missing control read as an intentional rule, so it
  // should not be re-introduced anywhere in this file, prose included. (It
  // caught this very PR's first draft, where the explanatory comment quoted it.)
  const deadEnd = src.split('Not featurable').length - 1;
  assert.equal(
    deadEnd,
    0,
    'the surface tells the operator a written chapter is "Not featurable". ' +
      'That has been untrue since 2026-08-12 and it is the copy that made the ' +
      'missing button look intentional.',
  );
});

test('a written chapter still gets an honest preview chip, not "no embed"', () => {
  const src = source();
  assert.ok(
    src.includes("'Written'"),
    'the thumbnail-less preview should read "Written" — "no embed" describes ' +
      'a chapter by what it lacks.',
  );
});
