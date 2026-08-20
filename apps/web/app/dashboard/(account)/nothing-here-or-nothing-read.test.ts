/**
 * nothing-here-or-nothing-read.test.ts — three account pages, one sentence.
 *
 * Each of these tells the person something about THEIR OWN record:
 *
 *   Your year ......... "Nothing on your calendar yet."
 *   Your chapters ..... "Your chapters (0)"
 *   Featured .......... "Nothing here — when you allow a creation to be featured…"
 *
 * All three were computed from a read whose failure degraded to an empty list.
 * Two of them BOUND the error and logged it — which is the whole point:
 *
 * 🔑 A LOG LINE NEVER CHANGED A PIXEL. Binding is not fixing. The measurement
 * has to reach the render or the person still reads a false sentence.
 *
 * ⚠ THE FEATURED ONE IS THE WORST OF THE THREE and it is not obvious why. Those
 * rows are CONSENTS the person granted, and that block is where they go to
 * REVOKE one — so a false "nothing here" does not merely misinform, it removes
 * the control. The same shape as a guest list that hides the guests: the absence
 * takes the actions with it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('Your year gates its empty state on whether the read happened', () => {
  const src = read('year/page.tsx');
  assert.match(src, /const momentsMeasured = !rowsError;/, 'the flag must exist');
  assert.match(src, /\{!momentsMeasured \? \(/, 'and must gate the sentence');
  assert.match(src, /We couldn’t load your year just now/, 'and say so');
});

test('Your chapters drops the count it could not take', () => {
  const src = read('creator/page.tsx');
  assert.match(src, /error: chaptersError/, 'the error must be bound at the read');
  assert.match(src, /const chaptersMeasured = !chaptersError;/);
  assert.match(
    src,
    /chaptersMeasured \? `Your chapters \(\$\{chapters\.length\}\)` : 'Your chapters'/,
    'a headcount of zero over somebody’s published work must not be stated',
  );
});

test('Featured consents say so rather than reporting none', () => {
  const src = read('profile/page.tsx');
  assert.match(src, /const shareConsentsMeasured = !shareConsentRowsProbeError;/);
  assert.match(src, /\{!shareConsentsMeasured \? \(/);
  assert.match(src, /We couldn’t load these just now/);
});

test('none of the three lost its genuine empty state', () => {
  // The honest sentence must survive for the person who really has none —
  // replacing it with the error text everywhere would be the opposite defect.
  assert.match(read('year/page.tsx'), /Nothing on your calendar yet/);
  assert.match(read('profile/page.tsx'), /Nothing here — when you allow a creation/);
  assert.match(read('creator/page.tsx'), /chapters\.length === 0/);
});
