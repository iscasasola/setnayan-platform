/**
 * the-guests-see-sheet-is-lazy.test.ts — "WHAT GUESTS SEE", step 2: where the sheet lives and how it is reached.
 *
 *   1. NOTHING OF IT IS IN THE MAKER'S FIRST LOAD: the sheet is imported by ONE file, `stages-studio-parts.tsx` — a
 *      piece the Maker reaches only through its lazy stand-ins (`details-lazy.tsx`; `details-pieces-are-lazy` walks the
 *      server graph and holds that) — and the table's BUILDER, which carries the page's rules, is imported by no
 *      client file at all: the sheet's chunk carries only the words and the handlers;
 *   2. the sheet reaches no server module itself: its draft door and its table are the work area's (asked through
 *      `MAKER_PART_OPS_EVENT`, as the block tools ask) — and its save is `makerSave` with the Maker's one refresh;
 *   3. it is opened from ONE row in Studio ▾, drawn only where the work area can answer, and it is a sheet — the
 *      Maker's own (`MakerSheet`), never a twelfth Studio page;
 *   4. the sheet draws what it is handed and decides nothing: it imports no rule of the page;
 *   5. only colour tokens: no white, no black, no hex.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STUDIO_TILE_KEYS } from './studio-tile-defs';

const WEB = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(join(WEB, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(join(WEB, rel)).isDirectory() ? walk(rel) : /\.tsx?$/.test(name) && !/\.test\./.test(name) ? [rel] : [];
  });
const FILES = ['app', 'lib', 'components'].flatMap(walk);
const SHEET = 'app/dashboard/[eventId]/launch/_components/guests-see-sheet.tsx';
const PARTS = 'app/dashboard/[eventId]/launch/_components/stages-studio-parts.tsx';

test('1 · the sheet has one importer — a lazy piece — and the builder has no client importer', () => {
  assert.ok(FILES.length > 2000 && FILES.includes(SHEET), `anti-vacuity: walked ${FILES.length} files`);
  const importers = (needle: RegExp) => FILES.filter((f) => needle.test(stripComments(read(f))));
  assert.deepEqual(importers(/from ['"][^'"]*\/guests-see-sheet['"]/), [PARTS]);
  // …and that piece is reached through the lazy stand-ins only (never a static import from a first-load file).
  const lazy = read('app/dashboard/[eventId]/launch/_components/details-lazy.tsx');
  assert.match(lazy, /export const StudioSideSwitch = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/stages-studio-parts'\)/);
  const builders = importers(/from ['"][^'"]*\/guests-see-build['"]/);
  assert.deepEqual(builders, ['app/dashboard/[eventId]/website/editor/_components/maker-navigator-data.ts']);
  for (const f of builders) assert.doesNotMatch(read(f), /^'use client'/, `${f} is a client file`);
  // What the sheet's chunk carries of the table is rule-free.
  assert.doesNotMatch(stripComments(read('lib/guests-see-table.ts')), /from '\.\/(what-guests-see|site-body-plan|maker-scene-list|invitation-welcome|stage-scenes)'/);
});

test('2 · the sheet reaches no server module: the work area lends the table and the draft door', () => {
  const src = stripComments(read(SHEET));
  assert.doesNotMatch(src, /hub-draft-actions|server-only|supabase|router\.refresh\(/);
  assert.match(src, /window\.dispatchEvent\(new CustomEvent\(MAKER_PART_OPS_EVENT, \{ detail: \(raw: MakerPartRaw\) => \(got = raw\) \}\)\);/);
  assert.match(src, /const table = raw\?\.navigator\?\.guestsSee;/);
  assert.match(src, /const door = raw\?\.elementEditing\?\.draftAction;\s*if \(!raw \|\| !table \|\| !door\) return null;/);
  assert.match(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(patch\)\);/);
  assert.match(src, /makerSave\(\(\) => area\.door\(area\.eventId, fd\), requestMakerRefresh\)/);
  assert.match(src, /const patch = guestsSeePatch\(writes\);\s*if \(!patch\) return setLine\(W\.nothingToApply\);/, 'Apply is not exactly the pending ticks');
});

test('3 · one row in Studio ▾, only where the work area answers — and a sheet, never a twelfth Studio page', () => {
  const src = stripComments(read(PARTS));
  assert.equal((src.match(/data-pick-option="guests-see"/g) ?? []).length, 1);
  assert.match(src, /\{guestsSeeWorkArea\(\) \? \(\s*<li role="none">\s*<button[\s\S]{0,260}?data-pick-option="guests-see"/);
  assert.match(src, /\{guestsSee && typeof document !== 'undefined' \? createPortal\(<GuestsSeeSheet onClose=\{\(\) => setGuestsSee\(false\)\} \/>, document\.body\) : null\}/);
  assert.match(stripComments(read(SHEET)), /<MakerSheet label=\{W\.title\} onClose=\{close\} everyWidth tall>/);
  assert.equal(STUDIO_TILE_KEYS.length, 11, 'a Studio page was added for it');
});

test('4 · the sheet decides nothing: it imports the table’s handlers and no rule of the page', () => {
  const src = stripComments(read(SHEET));
  assert.doesNotMatch(src, /what-guests-see|guests-see-build|site-body-plan|maker-scene-list|invitation-widgets|stage-scenes/);
  for (const handler of ['guestsSeeToggle(table, writes, row.key, col)', 'guestsSeeBackToPicks(table, writes)', 'guestsSeeOn(row, col, writes)']) assert.ok(src.includes(handler), handler);
  // A cell that is not a box is never drawn as one.
  assert.match(src, /cell\.kind === 'box' \? \(\s*<button[\s\S]{0,120}?role="checkbox"/);
  assert.equal((src.match(/role="checkbox"/g) ?? []).length, 1);
});

test('5 · colour tokens only', () => {
  const src = stripComments(read(SHEET));
  assert.doesNotMatch(src, /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b|#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  assert.match(src, /border-ink bg-ink text-paper/);
});
