/**
 * papic-storage-jobs-ask-first.test.ts — final check area 8, A8·P-B-22 (checker 8-1, batch 12).
 *
 * Admin › Insights › Papic storage has two one-press jobs. Each started at once on the press, and the tile job was
 * labelled like a repair ("Fill in missing …"). The claim held here: each job is named for what it does, its press
 * opens the house confirm box (`useConfirm`, `app/_components/confirm-dialog.tsx`) and the action runs only after a
 * yes, and the box says the per-press number from its one home, never a typed copy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { TILES_PER_PRESS } from '@/lib/papic-tile-backfill';

const HERE = join(dirname(fileURLToPath(import.meta.url)), 'papic-storage');
const read = (name: string) => stripComments(readFileSync(join(HERE, name), 'utf8'));

/** The press handler `run`: it must ask, stop on a no, and only then call the action. */
function assertAsksBeforeRunning(src: string, action: string) {
  assert.match(src, /import \{ useConfirm \} from '@\/app\/_components\/confirm-dialog'/, 'uses the house confirm box');
  assert.match(src, /const \{ confirm, dialog \} = useConfirm\(\)/);
  assert.match(src, /\{dialog\}/, 'the confirm box is mounted');
  const at = src.indexOf('async function run()');
  assert.ok(at >= 0, 'a press handler `run` exists');
  const runBody = src.slice(at, src.indexOf('\n  }\n', at));
  const asked = runBody.indexOf('await confirm(');
  const stop = runBody.indexOf('if (!ok) return;');
  const ran = runBody.indexOf(`${action}()`);
  assert.ok(asked >= 0 && stop > asked && ran > stop, `${action} runs only after the confirm says yes`);
  // The press reaches the action only through `run` — no second, unasked path.
  assert.equal(src.split(`${action}()`).length - 1, 1, `${action} is called once, inside run`);
  assert.match(src, /onClick=\{run\}/);
}

test('A8·P-B-22 · "Make Memory lane copies" asks first and is named for what it does', () => {
  const src = read('backfill-tiles-button.tsx');
  assertAsksBeforeRunning(src, 'backfillTileDerivativesAction');
  assert.doesNotMatch(src, /Fill in missing/, 'no word for a repair on a press that starts a job');
  assert.match(src, /'Make Memory lane copies'/);
  assert.match(src, /This starts as soon as you confirm\. Up to \$\{TILES_PER_PRESS\}/);
});

test('A8·P-B-22 · "Make small copies of old photos" asks first too', () => {
  const src = read('old-photos-button.tsx');
  assertAsksBeforeRunning(src, 'makeSmallCopiesOfOldPhotosAction');
  assert.match(src, /This starts as soon as you confirm\. Up to \$\{COPIES_PER_PRESS\}/);
});

test('A8·P-B-22 · the tile job\'s per-press number has one home, read by the action, the page and the box', () => {
  assert.equal(typeof TILES_PER_PRESS, 'number');
  const action = read('actions.ts');
  assert.match(action, /const MAX_BATCH = TILES_PER_PRESS;/);
  assert.match(action, /\.limit\(MAX_BATCH\)/);
  for (const file of ['backfill-tiles-button.tsx', 'page.tsx']) {
    const src = read(file);
    assert.doesNotMatch(src, new RegExp(`\\b${TILES_PER_PRESS} per press|up to ${TILES_PER_PRESS}\\b`, 'i'), `${file} types the number`);
    assert.match(src, /\$\{TILES_PER_PRESS\}|\{TILES_PER_PRESS\}/, `${file} reads TILES_PER_PRESS`);
  }
});
