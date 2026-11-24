/**
 * 📏 A PAID WIDGET'S PRICE META SITS UNDER ITS TITLE (supplier re-walk on live, 24 Nov 2026; controller GO).
 *
 * Measured on live: "One-time · Plus, Pro or Ultra" sat in the tile's foot beside "Buy ₱…" and wrapped to 4 short
 * lines, at 390 and on a computer. Now it is the tile's own full-width line under the title, clamped to 2 lines, and the
 * foot holds the button alone.
 *
 * SABOTAGE (seen red, restored): put the "One-time" words back into `foot` · drop `line-clamp-2` from the meta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const VIEWS = readFileSync(join(__dirname, '_components/store-views.tsx'), 'utf8');

test('the meta is under the title, full width, at most 2 lines', () => {
  const tile = VIEWS.slice(VIEWS.indexOf('export function StoreTile('), VIEWS.indexOf('export function ToolArt('));
  const title = tile.indexOf('{title}</b>');
  const meta = tile.indexOf('data-store-tile-meta=""');
  const foot = tile.indexOf('mt-auto flex items-center justify-between');
  assert.ok(title > 0 && meta > title && foot > meta, 'the meta is not between the title and the foot');
  assert.match(tile, /<span className="line-clamp-2 text-sn-sm[^"]*" data-store-tile-meta="">/);
});

test('a paid widget says its price meta there, and its foot holds only the button', () => {
  const tool = VIEWS.slice(VIEWS.indexOf('export function StoreToolTile('), VIEWS.indexOf('export function toolShowTags('));
  assert.match(tool, /const meta = s\.kind === 'buy' \? \(s\.needsPlan \? `One-time · \$\{PAID_WIDGET_PLAN_WORDS\}` : 'One-time'\) : null;/);
  assert.match(tool, /s\.kind === 'buy' \? null : toolFootWords\(s, php\)/, 'the One-time words are back in the foot');
  assert.match(tool, /meta=\{meta\}/);
  const foot = /const foot = ([^;]+);/.exec(tool)?.[1] ?? '';
  assert.doesNotMatch(foot, /One-time/);
});
