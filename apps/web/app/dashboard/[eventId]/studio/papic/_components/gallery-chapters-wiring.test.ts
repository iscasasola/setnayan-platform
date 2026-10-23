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
/*
  🗂 THE CHAPTERS MOVED WITH THE PHOTOS (owner 2026-10-23, PR-B): the event's photos live on its Memories tab, where
  "Follow moments in order" groups them by the day's moments in schedule order. The Papic page is the camera only.
  PAGE is the Memories page (it computes the moments); GRID is the Memories gallery and the grouping it calls.
*/
const PAGE = stripComments(readFileSync(resolve(HERE, '..', '..', '..', 'memories', 'page.tsx'), 'utf8'));
const GRID =
  stripComments(readFileSync(resolve(HERE, '..', '..', '..', '..', '..', '_components', 'memories', 'event-memories-gallery.tsx'), 'utf8')) +
  stripComments(readFileSync(resolve(HERE, '..', '..', '..', '..', '..', '..', 'lib', 'memories-albums.ts'), 'utf8'));

test('the Memories page actually computes the moments and hands them to the gallery', () => {
  assert.ok(/groupIntoChapters\(/.test(PAGE), 'the engine is never called');
  assert.ok(/moments=\{moments\}/.test(PAGE), 'the result never reaches the gallery');
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
    /catch\s*\{[\s\S]{0,140}moments = null/.test(PAGE),
    'A failed schedule read must fall back to the flat stream. Memories is ' +
      "somebody's wedding; it must never be a blank page because a heading " +
      'could not be computed.',
  );
  assert.ok(/fetchScheduleBlocks\(supabase, eventId\)\.catch\(\(\) => null\)/.test(PAGE), 'a refused schedule throws the page');
});

test('one chapter over everything is not offered', () => {
  assert.ok(
    /flat\.length > 1/.test(PAGE),
    'A single chapter spanning the whole gallery is a heading over everything, ' +
      'which tells the couple nothing they cannot already see.',
  );
});

test('the gallery renders the moments’ headings, in schedule order, from the VISIBLE photos', () => {
  assert.ok(/data-memories-section-head=""/.test(GRID), 'no heading is ever rendered');
  assert.ok(/for \(const m of moments\)/.test(GRID), 'the moments no longer set the order — a story reads forward');
  // A moment whose photos were all searched away must print nothing.
  assert.ok(/if \(list\.length > 0\) out\.push/.test(GRID), 'an empty moment prints a heading over nothing');
  assert.ok(/momentGroups\(\s*shown\.map/.test(GRID), 'headings must come from the VISIBLE photos (the album after the search), or a search leaves empty headings');
});

test('a photo in no moment is still shown', () => {
  assert.ok(/label: 'Other moments'/.test(GRID), 'A photo outside every moment must come last, not vanish.');
});

test('without moments the gallery is unchanged', () => {
  assert.ok(/moments\?: Moment\[\] \| null;/.test(GRID), 'the prop must be OPTIONAL so every caller keeps its behaviour');
  assert.ok(/return \[\{ key: 'all', label: null, items: shown \}\];/.test(GRID), 'with no moments the stream must pass through untouched');
});
