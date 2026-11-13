/**
 * 🏅 THE EARNED LINE SITS UNDER THE TODAY PHOTO — owner 13 Nov, live shot of Today: the "You earned SETNAYAN
 * Verified" line was drawn between the top bar and the Today photo, so the photo started lower and the header looked
 * cut. Ruling: *"Under the Today photo"*.
 *
 * Held:
 *   1 · Today's page hands the line to the screen as its `earned` slot — it is no longer drawn on its own above it.
 *   2 · The screen draws the cover (the photo) FIRST and the line right after it, inside the same cover slot.
 *   3 · A new shop (the six steps, no photo) still gets the line — above its steps, never dropped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(import.meta.dirname, rel), 'utf8'));
const PAGE = read('../page.tsx');
const SCREEN = read('supplier-today-screen.tsx');

test('1 · Today hands the line to the screen; nothing draws it above the photo', () => {
  assert.match(PAGE, /earned=\{<BadgeEarnedLine \/>\}/, 'the page no longer hands the line to the Today screen');
  const bare = PAGE.match(/<BadgeEarnedLine \/>/g) ?? [];
  assert.equal(bare.length, 1, `the line is drawn ${bare.length} times on Today — once, as the screen's earned slot`);
});

test('2 · the cover is drawn first, the line right under it', () => {
  const cover = SCREEN.match(/cover=\{\s*<>\s*\{top\}\s*\{earned\}\s*<\/>\s*\}/);
  assert.ok(cover, 'the cover slot is not "photo, then the earned line"');
});

test('3 · a new shop still gets the line above its six steps', () => {
  assert.match(SCREEN, /setup \?\s*\(\s*<>\s*\{earned\}\s*\{setup\}\s*<\/>\s*\)\s*:\s*null/, 'a new shop lost the earned line');
});
