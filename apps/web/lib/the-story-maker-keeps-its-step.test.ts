import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { STORY_STEPS } from '@/app/dashboard/[eventId]/story/_components/story-rail';

/**
 * ST-4 · two things a host feels and neither shows up in a screenshot.
 *
 * 1. A reload used to throw them back to "The desk" from wherever they were.
 * 2. The ENTIRE living-moment tile was the sound toggle, so tapping a photo to
 *    look at it turned the audio on. The visible 32 px speaker was decorative
 *    and controlled nothing.
 *
 * Asserted against source with comments stripped — the docblocks explaining both
 * defects necessarily quote the old shapes.
 */

const WEB = process.cwd();
const EDITOR = join(WEB, 'app/dashboard/[eventId]/story/_components/editorial-editor.tsx');
const MOMENTS = join(WEB, 'app/[slug]/_components/editorial/living-moments.tsx');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(stripped.length > raw.length * 0.15, `stripping ${path} removed too much`);
  return stripped;
}

test('the open step survives a reload, and Back still works', () => {
  const src = code(EDITOR);
  assert.match(src, /window\.addEventListener\('hashchange', readHash\)/, 'no hashchange listener');
  assert.match(
    src,
    /window\.removeEventListener\('hashchange', readHash\)/,
    'the hashchange listener is never removed',
  );
  assert.match(src, /window\.history\.replaceState\(null, '', `#\$\{k\}`\)/, 'the step is not written to the hash');
});

test('choosing a step does not stack history entries', () => {
  // `location.hash = x` pushes an entry, so six rail clicks would need six Back
  // presses to leave the page. replaceState is the whole reason this is safe.
  const src = code(EDITOR);
  assert.doesNotMatch(
    src,
    /window\.location\.hash\s*=/,
    'assigning location.hash pushes history and fires no hashchange',
  );
});

test('an unknown hash is refused — the rail never opens on nothing', () => {
  const src = code(EDITOR);
  assert.match(
    src,
    /\(STORY_STEPS as readonly string\[\]\)\.includes\(raw\)/,
    'the hash is trusted without checking it is a real step',
  );
  // And the fallback is a real step, not empty.
  assert.match(src, /useState<StoryStepKey>\('desk'\)/);
  assert.ok(STORY_STEPS.includes('desk'), 'the default is not one of the steps');
});

test('the sound control is a BUTTON, and the tile is not', () => {
  // The defect was a <button className="block w-full"> wrapping the clip: the
  // hit area was the whole moment, and the drawn circle was aria-hidden.
  const src = code(MOMENTS);
  assert.match(src, /<figure/, 'the tile is still an interactive element');
  assert.doesNotMatch(
    src,
    /<button[^>]*\n?[^>]*onClick=\{toggleSound\}[^>]*className="group relative block w-full/,
    'the whole tile is the sound toggle again',
  );
  // The toggle must be on a real button that is not the tile.
  const at = src.indexOf('onClick={toggleSound}');
  assert.ok(at > -1, 'toggleSound is no longer wired to anything');
  const open = src.lastIndexOf('<', at);
  assert.equal(src.slice(open, open + 7), '<button', 'toggleSound is not on a button');
});

test('the sound target meets the 44 px floor while the circle stays small', () => {
  /*
    Grow the TARGET, not the decoration. Round 3 removed the halos on this page
    because they stole presses, so the drawn circle must stay 32 px (h-8 w-8)
    while the button box is 44 px (h-11 w-11).
  */
  const src = code(MOMENTS);
  const at = src.indexOf('onClick={toggleSound}');
  const box = src.slice(at, at + 400);
  assert.match(box, /h-11 w-11/, `the sound button is under the 44 px touch floor: ${box.slice(0, 160)}`);
  assert.match(src, /h-8 w-8 items-center justify-center rounded-full/, 'the drawn circle grew — that is a halo');
});
