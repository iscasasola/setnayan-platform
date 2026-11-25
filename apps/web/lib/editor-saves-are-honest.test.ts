/**
 * editor-saves-are-honest.test.ts — final check, area 3, batch 2.
 *
 * Each Event Hub editor write below used to report "Saved" when nothing was written, or to write over the couple's
 * work after a read it could not trust:
 *
 *   E-10 · Our story merged the form into the stored blob even when that read failed, dropping the moments.
 *   E-11 · Photo moments and section visibility / order / mode updated with no `.select()`: RLS refuses by matching
 *          ZERO rows with no error, so a refused write said "Saved".
 *   E-17 · Set the mood showed Save (and then "Saved") with both parts locked; a zero-row write also read as saved.
 *
 * 🔒 Source assertions on the comment-stripped actions; each was seen red against the old line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const HERE = join(WEB, 'app/dashboard/[eventId]/website');
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('E-10 · Our story refuses to save when the stored story could not be read', () => {
  const src = read('our-story/actions.ts');
  assert.match(src, /error: currentError \}/);
  assert.match(src, /if \(!draftedStory\?\.drafted && \(currentError \|\| !current\)\)/);
  // The refusal comes BEFORE the merge.
  assert.ok(src.indexOf('currentError || !current') < src.indexOf('mergeStoryWords(base'));
});

test('E-11 · photo moments count the rows they wrote', () => {
  const src = read('photo-moments/actions.ts');
  assert.match(src, /\.update\(\{ photo_moments_config: config \}\)\s*\.eq\('event_id', eventIdRaw\)\s*\.select\('event_id'\)/);
  assert.match(src, /savedRows\.length === 0/);
});

test('E-11 · section visibility, mode and order count the rows they wrote', () => {
  const src = read('widgets/actions.ts');
  assert.match(src, /visibleRows\.length === 0/);
  assert.match(src, /modeRows\.length === 0/);
  assert.match(src, /!moved1\?\.length \|\| !moved2\?\.length/);
});

test('E-17 · Set the mood: no Save when both parts are locked; a zero-row write is a failure', () => {
  assert.match(read('site-chrome/page.tsx'), /musicGated && videoGated \? null :/);
  assert.match(read('site-chrome/actions.ts'), /if \(error \|\| \(hasWrite && !event\)\)/);
});

test('M-08 · the stories density read throws on a failed read, and Alaala turns that into "Couldn\'t read"', () => {
  const lib = stripComments(readFileSync(join(WEB, 'lib/kwento-density.ts'), 'utf8'));
  assert.match(lib, /const \{ data: counts, error: countsError \} = await admin/);
  assert.match(lib, /if \(countsError\) throw new Error\(/);
  assert.match(lib, /const \{ data: previews, error: previewsError \} = await admin/);
  assert.match(lib, /if \(previewsError\) throw new Error\(/);
  const page = read('../alaala/page.tsx');
  assert.match(page, /getKwentoDensity\(eventId, 5\)\.catch\(\(\) => \{\s*densityFailed = true;/);
});
