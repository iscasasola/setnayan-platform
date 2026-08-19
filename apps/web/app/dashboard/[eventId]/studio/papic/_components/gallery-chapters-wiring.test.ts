/**
 * gallery-chapters-wiring.test.ts — the chapters are actually reachable.
 *
 * The engine is pure and covered by `lib/alaala-chapters.test.ts`. This is the
 * OTHER half, and it is the half this repo keeps losing: a mechanism that is
 * built, tested, correct — and never mounted, or mounted with a prop nothing
 * fills. `lib/alaala-chapters.ts` typechecks and passes 11 tests whether or not
 * a single photograph ever reaches it.
 *
 * 🛡 Every assertion mutation-checked by occurrence count, each confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8'));
const GRID = stripComments(readFileSync(resolve(HERE, 'papic-gallery-grid.tsx'), 'utf8'));

test('the studio page actually computes chapters and hands them to the grid', () => {
  assert.ok(/groupIntoChapters\(/.test(PAGE), 'the engine is never called');
  assert.ok(/chapters=\{galleryChapters\}/.test(PAGE), 'the result never reaches the grid');
  assert.ok(/fetchScheduleBlocks\(/.test(PAGE), 'the run of show is never read');
});

test('the schedule is converted, never compared raw', () => {
  // The engine owns the conversion; the page must not hand it something it
  // already mangled, and must not reach past it to compare times itself.
  assert.equal(
    /captured_at\s*[<>]=?\s*\w*start_at|start_at\s*[<>]=?\s*\w*captured_at/.test(PAGE),
    false,
    'The page compares a schedule time to a capture time directly. That is the ' +
      'eight-hour bug: a wall clock measured against a real instant.',
  );
  assert.ok(
    /tz: DEFAULT_EVENT_TZ/.test(PAGE),
    'the venue zone must be passed — without it nothing can be converted',
  );
});

test('a schedule that cannot be read leaves the gallery whole', () => {
  assert.ok(
    /catch\s*\{[\s\S]{0,80}galleryChapters = undefined/.test(PAGE),
    'A failed schedule read must fall back to the flat gallery. A gallery is ' +
      "somebody's wedding; it must never be a blank page because a heading " +
      'could not be computed.',
  );
});

test('one chapter over everything is not offered', () => {
  assert.ok(
    /flat\.length > 1/.test(PAGE),
    'A single chapter spanning the whole gallery is a heading over everything, ' +
      'which tells the couple nothing they cannot already see.',
  );
});

test('the grid renders headings and lets the filter bar still rule', () => {
  assert.ok(/headingFor/.test(GRID), 'no heading is ever rendered');
  assert.ok(
    /const ordered =\s*\n?\s*chapters && chapters\.length > 0/.test(GRID),
    'chapters must set the order — a story reads forward, the flat gallery does not',
  );
  // A chapter whose frames were all filtered away must print nothing.
  assert.ok(
    /for \(const photo of ordered\)/.test(GRID),
    'headings must be assigned from the VISIBLE frames, or filtering leaves empty headings',
  );
});

test('a frame in no chapter is still shown', () => {
  assert.ok(
    /Number\.MAX_SAFE_INTEGER/.test(GRID),
    'An unchaptered frame must sort last, not vanish. Nothing in this gallery ' +
      'is ever silently dropped.',
  );
});

test('without chapters the gallery is unchanged', () => {
  assert.ok(
    /chapters\?: \{ key: string; label: string; photoIds: string\[\] \}\[\];/.test(GRID),
    'the prop must be OPTIONAL so every existing caller keeps its behaviour',
  );
  assert.ok(/: shown;/.test(GRID), 'with no chapters the original order must pass through untouched');
});
