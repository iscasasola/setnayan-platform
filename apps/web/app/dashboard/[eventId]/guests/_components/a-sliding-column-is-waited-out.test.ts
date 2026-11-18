/**
 * a-sliding-column-is-waited-out.test.ts — 🎞 THE WIRING behind "the thumb row sits under its column after a slide".
 *
 * The CLAIM is measured in a real browser by `tests/e2e/the-thumb-row-follows-a-sliding-column.spec.ts` (the REAL
 * `AccountThumbRow` and the REAL `followColumn`, the column sliding in by a CSS animation, a CSS transition and
 * `element.animate`, at 768 and 1280: the row's edges are the column's when the slide ends). W1 on live 979ed2c
 * (RW-337): People's "Find or invite" row at 124→768 under a column at 96→744 — read mid-slide, never read again.
 * This file holds what the spec cannot reach: that `followColumn` waits out a move, and that BOTH account rows that
 * use it (People/Memories' `AccountThumbRow`, the Samahan chatroom) still hand it their host.
 *
 * 🛡 SABOTAGE (seen RED, then restored, 2026-11-16): the `getAnimations` wait removed (red: 1) · the chatroom's
 * `followColumn(el)` removed (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · followColumn reads the column again when whatever moves it ends', () => {
  const src = code('app/dashboard/[eventId]/guests/_components/dock-follows-column.ts');
  assert.match(src, /document\.getAnimations\(\)/, 'a slide already running when the row mounts is not waited out');
  assert.match(src, /a\.finished\.then\(sync, sync\)/);
  for (const ev of ['animationend', 'animationcancel', 'transitionend', 'transitioncancel', 'animationstart', 'transitionrun']) {
    assert.match(src, new RegExp(`\\['${ev}', `), `${ev} is not watched`);
  }
  assert.match(src, /removeEventListener\(type, fn, true\)/, 'the move listeners outlive the page');
  const spec = readFileSync(join(WEB, 'tests/e2e/the-thumb-row-follows-a-sliding-column.spec.ts'), 'utf8');
  assert.match(spec, /import \{ followColumn \} from '\.\.\/\.\.\/app\/dashboard\/\[eventId\]\/guests\/_components\/dock-follows-column';/);
  assert.match(spec, /window\.followColumn\(document\.querySelector\('\[data-thumb-host\]'\)\)/, 'the spec no longer mounts the row mid-slide');
});

test('2 · both account rows hand followColumn their host', () => {
  for (const rel of [
    'app/dashboard/(account)/_components/account-thumb-row.tsx',
    'app/dashboard/(account)/samahan/[communityId]/_components/group-chatroom.tsx',
  ]) {
    assert.match(code(rel), /const el = hostRef\.current;\s*return el \? followColumn\(el\) : undefined;/, `${rel} no longer follows its column`);
  }
});
