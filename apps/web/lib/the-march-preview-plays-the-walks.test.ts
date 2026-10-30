/**
 * ▶ GUESTS › MARCH › PREVIEW PLAYS THE MARCH (owner 2026-10-29, prototype v12 `startPreview` — *"maybe we can use this
 * row to add the preview walk so it is not lost?"*). Until today the tile was there, DISABLED, saying "The walk preview is
 * coming".
 *
 * The PROPERTIES:
 *   1. The steps are every walk, section by section, numbered as the march numbers them, named "N. A & B", the line the
 *      section (+ "walks alone" for one walker); an empty walk says "—"; the closing card counts the walks.
 *   2. The tile is live (disabled only when nobody walks), turns into Stop while playing, opens every section first.
 *   3. The bar floats under the pinned row (h-0 sticky slot — it takes no room), slides in and out, still under reduced
 *      motion; the walk being played is ringed (`data-march-walk-now`) and scrolled to the middle.
 *   4. The timer is cleared on every step and when the march leaves (the effect's cleanup) — a preview never keeps
 *      running behind another view.
 *
 * SABOTAGE (each seen RED, then restored): `disabled: true` back on the tile · the reset of `folded` dropped · the
 * cleanup `clearTimeout` dropped · "walks alone" on two walkers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARCH_PREVIEW_END_MS, MARCH_PREVIEW_STEP_MS, marchPreviewEnd, marchPreviewSteps } from '@/lib/march-preview';
import { acrossTheAisle, type MarchSection } from '@/lib/march-drag';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MARCH = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/_components/details-march.tsx'), 'utf8'));

const p = (id: string, name: string) => ({ id, name, role: 'principal_sponsor' });
const SECTIONS: MarchSection[] = [
  { key: 'groom', label: 'The groom', rows: [[p('g', 'Jose'), null]] },
  { key: 'ps', label: 'Principal Sponsors', rows: [[p('a', 'Tito Ben'), p('b', 'Tita Cora')], [null, p('c', 'Lola Nena')]] },
  { key: 'own', label: 'Our barkada', rows: [[null, null]] },
];

test('1 · every walk, in the march’s order and numbering, named and placed', () => {
  assert.deepEqual(marchPreviewSteps(SECTIONS), [
    { no: 1, title: '1. Jose', line: 'The groom · walks alone' },
    { no: 2, title: '2. Tito Ben & Tita Cora', line: 'Principal Sponsors' },
    { no: 3, title: '3. Lola Nena', line: 'Principal Sponsors · walks alone' },
    { no: 4, title: '4. —', line: 'Our barkada' },
  ]);
  assert.deepEqual(marchPreviewEnd(4), { title: 'That is the whole march', line: '4 walks' });
  assert.equal(marchPreviewEnd(1).line, '1 walk');
  assert.equal(MARCH_PREVIEW_STEP_MS, 1100);
  assert.equal(MARCH_PREVIEW_END_MS, 1800);
});

test('2 · the tile plays (Stop while playing), disabled only when nobody walks, every section opened first', () => {
  const tile = MARCH.slice(MARCH.indexOf("key: 'preview'"), MARCH.indexOf("key: 'preview'") + 900);
  assert.doesNotMatch(tile, /disabled: true/, 'the Preview tile is disabled again');
  assert.match(tile, /disabled: walks === 0/);
  assert.match(tile, /word: play === null \? 'Preview' : 'Stop'/);
  assert.match(tile, /playSteps\.current = marchPreviewSteps\(shown\);\s*setFolded\(new Set\(\)\);\s*setPlay\(0\);/, 'the preview does not open every section first');
  assert.doesNotMatch(MARCH, /The walk preview is coming/);
});

test('3 · the bar floats (no room), slides, and the walk being played is ringed and centred', () => {
  assert.match(MARCH, /sticky top-\[calc\(var\(--gs-top,0px\)\+var\(--gs-stick-h,60px\)\)\] z-\[6\] h-0" data-march-play-slot=""/);
  assert.match(MARCH, /motion-reduce:transition-none \$\{\s*play === null \? 'pointer-events-none -translate-y-2\.5 opacity-0'/);
  assert.match(MARCH, /data-march-walk-now=\{play !== null && playSteps\.current\[play\]\?\.no === step \? '' : undefined\}/);
  assert.match(MARCH, /querySelector\(`\[data-march-walk="\$\{now\.no\}"\]`\)\?\.scrollIntoView\(\{ block: 'center'/);
  assert.match(MARCH, /prefers-reduced-motion: reduce/);
});

test('4 · the timer never outlives a step or the march', () => {
  const eff = MARCH.slice(MARCH.indexOf('if (play === null) return;'), MARCH.indexOf('}, [play]);'));
  assert.match(eff, /const t = setTimeout\(/);
  assert.match(eff, /return \(\) => clearTimeout\(t\);/, 'the preview keeps running behind another view');
});

test('1b · a pair is named in the order the walk is DRAWN — across the aisle, never the raw row order', () => {
  const pair = (r: MarchSection['rows'][number]) => [{ key: 'ps', label: 'Principal Sponsors', rows: [r] }] as MarchSection[];
  const man = { id: 'f', name: 'Mr. Fidel Santos', role: 'principal_sponsor_ninong', side: 'groom' };
  const woman = { id: 'c', name: 'Ms. Carmen Reyes', role: 'principal_sponsor_ninang', side: 'bride' };
  for (const row of [[man, woman], [woman, man]] as MarchSection['rows']) {
    const drawn = acrossTheAisle(row).filter((x) => x !== null).map((x) => x!.name).join(' & ');
    assert.equal(marchPreviewSteps(pair(row))[0]!.title, `1. ${drawn}`);
  }
});
