/**
 * the-day-plays-through.test.ts — a samahan's day can be watched, not just
 * sampled.
 *
 * WHAT WAS WRONG. The viewer opened ONE clip, played it on `loop`, and left you
 * to close it and tap the next thumbnail. So a day made of 3-second clips — the
 * whole point of the Setlog rhythm — could never be watched through. `loop` is
 * the exact attribute that made it impossible: a looping clip has no end, so
 * there is no moment at which anything could come next.
 *
 * 🔑 NOTHING IS STITCHED AND NOTHING IS KEPT. These are the same clips that
 * already expire in 24 hours, played one after another. What a samahan KEEPS
 * after 24 hours is an OWNER DECISION (WHATS_NEXT_Samahan_2026-08-24.md § 3.1)
 * and this file must not be read as having answered it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderTheDay } from '../../../../../../lib/samahan-reel';
import { stripComments } from '../../../../../../lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, 'samahan-stories.tsx'), 'utf8');

/**
 * 🪤 THE COMMENT STRIPPER IS THE SHARED ONE, AND WRITING A SECOND WAS THE FIRST
 * MISTAKE HERE. My own version — regexes, then a hand-rolled state machine —
 * ate 8,350 characters of this component before it worked, because the
 * attribute `accept="video/*"` opens a comment as far as a regex is concerned
 * and it ran to the next `*​/` thousands of characters later; the guard then
 * reported that the "Play the day" button did not exist. lib/strip-comments.ts
 * already existed, is string-aware, and its own docblock records that exact
 * trap measured at 5,104 lines across 1,031 files. Find it before you build it.
 */
/** Comments name the very attributes this file bans — strip before matching. */
const code = stripComments(src);

test('the day runs forwards, oldest first — never in strip order', () => {
  const rows = [
    { story_id: 'c', created_at: '2026-08-25T09:00:00Z' },
    { story_id: 'a', created_at: '2026-08-25T07:00:00Z' },
    { story_id: 'b', created_at: '2026-08-25T08:00:00Z' },
  ];
  assert.deepEqual(
    orderTheDay(rows).map((r) => r.story_id),
    ['a', 'b', 'c'],
  );
});

test('ordering never mutates what the page was given', () => {
  // The strip renders `stories` newest-first. Sorting in place would silently
  // reorder the strip too, which is a design change nobody asked for.
  const rows = [
    { story_id: 'b', created_at: '2026-08-25T08:00:00Z' },
    { story_id: 'a', created_at: '2026-08-25T07:00:00Z' },
  ];
  orderTheDay(rows);
  assert.deepEqual(
    rows.map((r) => r.story_id),
    ['b', 'a'],
  );
});

test('a clip in the viewer plays once and hands over to the next', () => {
  assert.ok(
    !/^\s+loop$/m.test(code),
    'the viewer video is looping again — a looping clip never ends, so the day never advances',
  );
  assert.match(code, /onEnded=\{\(\) => goTo\(at \+ 1\)\}/, 'nothing advances when a clip ends');
});

test('the whole day is reachable without a keyboard and with one', () => {
  assert.match(code, /Play the day/, 'no way to start at the beginning');
  assert.match(code, /goTo\(0\)/, '"Play the day" does not start at the first clip');
  assert.match(code, /ArrowRight/, 'no keyboard way forward');
  assert.match(code, /ArrowLeft/, 'no keyboard way back');
  assert.match(code, /Escape/, 'no keyboard way out');
});

test('taking your own clip down does not end everybody else’s day', () => {
  // 🪤 SCOPED TO onRemove, NOT TO THE FILE. The first version of this assertion
  // matched `setPlayingId(next ? next.story_id : null)` anywhere in the source —
  // and `goTo` contains that exact line, so gutting the remove handler left the
  // guard GREEN (measured: 2 occurrences → 1, still passing). A file-level match
  // cannot say WHICH function still does the thing.
  const from = code.indexOf('async function onRemove');
  assert.ok(from > 0, 'onRemove not found — did it move or get renamed?');
  const body = code.slice(from, code.indexOf('\n  }', from));
  assert.match(
    body,
    /setPlayingId\(next \? next\.story_id : null\)/,
    'removing a clip drops the viewer out of the reel instead of stepping past it',
  );
  assert.ok(
    !/setPlayingId\(null\)/.test(body),
    'removing a clip still closes the whole viewer',
  );
});
