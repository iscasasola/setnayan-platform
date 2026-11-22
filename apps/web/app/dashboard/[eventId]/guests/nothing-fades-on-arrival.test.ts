/**
 * 🔒 ON EVERY VIEW, NOTHING FADES (Guests redesign drawing, "On every view", owner 20 Nov "Yes, your picks"): *"the top
 * row and thumb row draw at full colour at once; rows arrive as grey placeholder lines of the same height, then fill."*
 *
 *   1 · The thumb row is on from the first paint (it no longer waits out the page's build-up — on Guests only).
 *   2 · The arrival motion moves, it never fades (`gs-up` holds no opacity).
 *   3 · The wait is drawn in the List's own shape: the pinned row's known words, then row placeholders — no tile grid.
 *
 * Sabotage (each seen red, then restored): `barOn` back on the shared wait → 1 · `opacity: 0` back in `gs-up` → 2 ·
 * loading.tsx back on `GridPageSkeleton` → 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

test('1 · the thumb row is on at once', () => {
  const screen = read('_components/guests-screen.tsx');
  assert.match(screen, /const barOn = true;/);
  assert.doesNotMatch(screen, /useThumbRowArrivesLast\(/, 'Guests waits again before drawing its thumb row');
});

test('2 · the arrival moves, never fades', () => {
  const css = read('_components/guests-screen.module.css');
  const up = css.slice(css.indexOf('@keyframes gs-up'), css.indexOf('@keyframes gs-popin'));
  assert.ok(up.length > 0, 'gs-up was not found');
  assert.doesNotMatch(up, /opacity/, 'the arrival fades again');
});

test('3 · the wait is the List’s shape — known words, then row placeholders', () => {
  const loading = read('loading.tsx');
  assert.doesNotMatch(loading, /GridPageSkeleton/, 'the wait is a tile grid again');
  assert.match(loading, /<Ghost known="Guests · List"/, 'the pinned row’s known words are not drawn at once');
  assert.match(loading, /data-guests-skeleton-rows=""/);
  assert.match(loading, /border-t border-ink\/10 py-3/, 'a placeholder row is not the list row’s height');
  assert.match(loading, /<GuestsLastCopy>/, 'the kept copy no longer draws first');
});
