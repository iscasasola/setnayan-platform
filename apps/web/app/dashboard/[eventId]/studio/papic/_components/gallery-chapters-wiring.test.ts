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
// 📍 The library moved to Memories (2026-10-23): the day's moments are computed in its one read
// (`lib/event-memories.server.ts`) and handed to the Memories page's gallery. Same rules, new address.
const PAGE = stripComments(readFileSync(resolve(HERE, '..', '..', '..', '..', '..', '..', 'lib', 'event-memories.server.ts'), 'utf8'));
const MEMORIES = stripComments(readFileSync(resolve(HERE, '..', '..', '..', 'memories', 'page.tsx'), 'utf8'));
// The grid these tests also read (`papic-gallery-grid.tsx`) was deleted 2026-10-31: unmounted since 2026-10-23, its
// last import (PapicLightbox) replaced by the shared PhotoViewer (#7108). Its heading tests went with it.

test('the studio page actually computes chapters and hands them to the grid', () => {
  assert.ok(/groupIntoChapters\(/.test(PAGE), 'the engine is never called');
  assert.ok(/chapters=\{read\.chapters\}/.test(MEMORIES), 'the result never reaches the gallery');
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
    /fetchScheduleBlocks\(supabase, eventId\)\.catch\(\(\) => null\)/.test(PAGE) && /if \(blocksRes && blocksRes\.length > 0/.test(PAGE),
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

