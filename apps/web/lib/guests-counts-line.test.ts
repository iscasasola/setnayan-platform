/**
 * 🔒 A7-35 (final check 25 Nov; drawing `prototypes/final-check-area-7_2026-11-25/` § 1, approved): the Guests pinned
 * row's counts take their own line ONLY when they do not fit beside the menu and the rounds — at 375 on Seats › 3D the
 * three counts (~138 px) had ~73 px and the last slid under the ⋯ round. When they fit, the row stays one line.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { countsNeedOwnLine } from './guests-counts-line';

// 375 px phone: 343 px row, "Seats · 3D ▾" pill 112, three 40-px rounds, 6 px row gap, counts 46 + 46 + 40, no gap (⚙).
const PHONE = { rowWidth: 343, menuWidth: 112, otherWidths: [40, 40, 40], rowGap: 6, countWidths: [46, 46, 40], countGap: 0 };

test('at 375 the three Seats counts do not fit beside the rounds → their own line', () => {
  assert.equal(countsNeedOwnLine(PHONE), true);
});

test('at 1280 they fit → today\'s one line', () => {
  assert.equal(countsNeedOwnLine({ ...PHONE, rowWidth: 768 }), false);
});

test('no counts (a view with none) never takes a second line', () => {
  assert.equal(countsNeedOwnLine({ ...PHONE, countWidths: [] }), false);
});

test('exactly enough room stays one line (no flip on a half pixel)', () => {
  const needed = 46 + 46 + 40;
  const fixed = 112 + 120 + 6 * 4;
  assert.equal(countsNeedOwnLine({ ...PHONE, rowWidth: needed + fixed }), false);
  assert.equal(countsNeedOwnLine({ ...PHONE, rowWidth: needed + fixed - 2 }), true);
});

test('the screen writes data-counts-wrap from the rule, and the CSS moves only the counts to line 2', () => {
  const dir = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components');
  const tsx = stripComments(readFileSync(join(dir, 'guests-screen.tsx'), 'utf8'));
  const css = readFileSync(join(dir, 'guests-screen.module.css'), 'utf8');
  assert.match(tsx, /countsNeedOwnLine\(\{/);
  assert.match(tsx, /row\.toggleAttribute\('data-counts-wrap', wrap\)/);
  assert.match(tsx, /<div ref=\{topRowRef\} className=\{styles\.topRow\}/);
  assert.match(css, /\.topRow\[data-counts-wrap\] \.pinCounts \{\s*order: 99;\s*flex: 1 0 100%;\s*justify-content: flex-start;\s*gap: 12px;\s*min-height: 44px;/);
  assert.match(css, /\.topRow\[data-counts-wrap\] \.face \{\s*display: contents;/);
});
