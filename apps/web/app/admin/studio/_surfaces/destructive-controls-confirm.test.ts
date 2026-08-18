/**
 * destructive-controls-confirm.test.ts — an irreversible admin control must say
 * what it is about to do, and name the thing, not its id.
 *
 * 🚨 FOUND BY THE OWNER LOOKING AT THE SCREEN, 2026-08-18, minutes after the
 * same catalogue was found to have silently lost 93 songs. Both controls on it
 * shipped with NO confirmation:
 *
 *   · a bare bin icon on every row of a 391-row list — one tap, gone, on a phone
 *   · Merge took TWO HAND-TYPED NUMBERS, deleted one song and re-pointed every
 *     couple's pick to the other, with nothing on screen naming which songs
 *     those numbers were
 *
 * 🔑 A DESTRUCTIVE CONTROL DRIVEN BY AN ID MUST SHOW THE THING, NOT THE ID. A
 * number cannot be sanity-checked by the person typing it; a title can. Typing
 * 688 where you meant 686 destroys the wrong song and silently rewrites what
 * couples chose, with no undo.
 *
 * ⚠ SCOPE, STATED. This reads SOURCE, so it proves the confirmation is wired,
 * not that a browser shows it. That is the honest ceiling of a static check and
 * is why the assertions below are anchored to the ACT (a confirm gating the
 * submit) rather than to the presence of a word.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTROLS = join(HERE, 'songs-danger-controls.tsx');
const SURFACE = join(HERE, 'songs-surface.tsx');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('the anchor: both files exist and are not stubs', () => {
  for (const p of [CONTROLS, SURFACE]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 400,
      `${p} is missing or a stub — every assertion below would pass vacuously`,
    );
  }
});

test('deleting a song is gated by a confirmation that names the song', () => {
  const src = read(CONTROLS);
  const fn = /export function DeleteSongButton\([\s\S]*?\n}/.exec(src);
  assert.ok(fn, 'DeleteSongButton should exist');
  const body = fn[0];

  assert.match(body, /window\.confirm\(/, 'delete must ask before it destroys');
  // The confirmation must carry the SONG, not just a warning sentence — an id
  // the operator cannot check is the whole defect.
  assert.match(
    body,
    /describe\(song\)|\$\{song\.title\}/,
    'the confirmation must name the song being deleted, not just warn in general',
  );
  // …and refusing must actually stop the submit.
  assert.match(
    body,
    /if \(!ok\) e\.preventDefault\(\)/,
    'pressing Cancel must stop the form — a confirm whose answer is ignored is decoration',
  );
});

test('merging two songs is gated by a confirmation that names BOTH', () => {
  const src = read(CONTROLS);
  const fn = /export function MergeSongsFields\([\s\S]*?\n}\n/.exec(src);
  assert.ok(fn, 'MergeSongsFields should exist');
  const body = fn[0];

  assert.match(body, /window\.confirm\(/, 'merge must ask before it destroys');
  assert.match(
    body,
    /describe\(dup!?\)[\s\S]{0,400}?describe\(canon!?\)/,
    'the confirmation must name BOTH songs — the deleted one and the kept one. ' +
      'Two typed numbers cannot be checked by the person typing them.',
  );
  assert.match(
    body,
    /if \(!ok\) e\.preventDefault\(\)/,
    'pressing Cancel must stop the merge',
  );
  // An id that is not on screen is exactly where a typo hides.
  assert.match(
    body,
    /not in the\s*\n?\s*`? ?\+?\s*`?list on screen|not in the list on screen/,
    'an id the page cannot resolve must be called out, not merged silently',
  );
});

test('the surface renders the confirming controls, not a bare submit', () => {
  const src = read(SURFACE);
  assert.match(src, /<DeleteSongButton\b/, 'the row must use the confirming delete');
  assert.match(src, /<MergeSongsFields\b/, 'the merge form must use the confirming fields');
  // The regression is a bare button coming back — that is what shipped.
  assert.doesNotMatch(
    src,
    /aria-label=\{`Delete \$\{s\.title\}`\}/,
    'a bare unconfirmed delete button is back on the row',
  );
});
