/**
 * add-category-row.test.ts — ＋ ADD A CATEGORY IS THE LIST'S LAST ROW (owner 2026-10-26, verbatim: "yes. this will
 * apply to the inspiration board as well"; prototype `prototypes/suppliers_add_category_row_2026-10-26/index.html`;
 * DECISION_LOG "ADD A CATEGORY IS THE LIST'S LAST ROW"). Suppliers half only — the Mood Board half is a later plan.
 *
 *   R1  the second line is EXECUTED: the first three labels in the list's order, the first capitalised, the rest
 *       lower-cased word by word (an acronym kept), "…" only when more wait behind them;
 *   R2  the row is ONE button — the PickMenu's own, dressed by `trigger` — holding the ＋ disc, the title, that
 *       second line and a › chevron; the old sentence + ▾ pill do not also draw;
 *   R3  the row wears the category rows' own measures (56 px, the 36 px disc, 12 px gap, 15 px name, the template's
 *       second line) and a dashed edge only because it is pressable; the list's rule sits above it;
 *   R4  PickMenu's `trigger` replaces the pill's words AND its look — a row inside a pill would be a frame in a frame.
 *
 * Source assertions are anchored to the add block alone (`data-add-to-event` … `<FindThumbRow`), comments stripped.
 * T4 in `find-rows.test.ts` keeps the dropdown's options / onPick / error line.
 *
 * SABOTAGE, seen red (2026-10-26, this PR): put the old "Need something else?" sentence back beside the row → R2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { ADD_CATEGORY_PREVIEW_COUNT, ADD_CATEGORY_TITLE, addCategoryPreview } from '@/lib/explore-info-copy';

const BENCH = stripComments(
  readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx'), 'utf8'),
);
const PICK = stripComments(
  readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'pick-menu.tsx'), 'utf8'),
);
const start = BENCH.indexOf('data-add-to-event=""');
const ROW = BENCH.slice(start, BENCH.indexOf('<FindThumbRow', start));
const rule = (sel: string) => new RegExp(`\\.slcat \\.${sel}\\{([^}]*)\\}`).exec(BENCH)?.[1] ?? '';

test('R1 · the second line names the first three, in order, and trails off only when more wait', () => {
  assert.equal(ADD_CATEGORY_TITLE, 'Add a category');
  assert.equal(ADD_CATEGORY_PREVIEW_COUNT, 3);
  assert.equal(addCategoryPreview(['Food Trucks', 'Photo Booth', 'Fireworks', 'Choir']), 'Food Trucks, photo booth, fireworks…');
  assert.equal(addCategoryPreview(['Food trucks', 'Photo booth', 'Fireworks']), 'Food trucks, photo booth, fireworks');
  assert.equal(addCategoryPreview(['Florist', 'Hair & Makeup (HMUA)']), 'Florist, hair & makeup (HMUA)');
  assert.equal(addCategoryPreview(['Cake', 'DJ', 'LED Wall', 'Band']), 'Cake, DJ, LED wall…');
  assert.equal(addCategoryPreview([]), '');
});

test('R2 · ONE button: the ＋ disc, the title, the second line and a › — the old sentence and pill are gone', () => {
  assert.ok(start > -1 && ROW.length > 0, 'the add row moved — re-anchor');
  assert.equal((ROW.match(/<PickMenu\b/g) ?? []).length, 1);
  assert.match(BENCH, /<div className=\{`addmore \$\{FORM_ROW_RULE\}`\} data-add-to-event="">\s*<PickMenu\b/);
  assert.match(ROW, /dataAttr="data-add-category"/);
  assert.match(ROW, /label=\{ADD_CATEGORY_TITLE\}/);
  assert.match(ROW, /buttonText=\{addCategoryLine\}/);
  assert.match(ROW, /className="addcat sn-press sn-press-ring"/);
  assert.match(
    ROW,
    /trigger=\{\s*<>\s*<span className="addcat-ic" aria-hidden>\s*<Plus size=\{18\} strokeWidth=\{1\.75\} \/>\s*<\/span>\s*<span className="addcat-t">\s*<span className="addcat-nm">\{ADD_CATEGORY_TITLE\}<\/span>\s*<span className=\{FORM_ROW_SUBLINE\}>\{addCategoryLine\}<\/span>\s*<\/span>\s*<ChevronRight className="addcat-chev" size=\{16\} strokeWidth=\{1\.75\} aria-hidden \/>\s*<\/>\s*\}/,
  );
  // The line is the list's own order — the same `poolRows` the dropdown lists.
  assert.match(BENCH, /const addCategoryLine = addCategoryPreview\(poolRows\.map\(\(\{ t \}\) => t\.label\)\);/);
  // The old shape: a sentence before a ▾ pill.
  assert.doesNotMatch(ROW, /ADD_TO_EVENT_ASK|ADD_TO_PLAN_HEADING|Need something else|Add to your event/);
  assert.doesNotMatch(ROW, /<span>\{/);
});

test('R3 · the category row\'s own measures, a dashed edge because it is pressed, the list\'s rule above', () => {
  const row = rule('addcat');
  for (const m of ['width:100%', 'min-height:56px', 'gap:12px', 'border:1px dashed var(--line)', 'border-radius:var(--m-r-md)', 'background:transparent']) {
    assert.ok(row.includes(m), `.addcat lost ${m}`);
  }
  // The disc is the flat row's disc (36 px, round), outlined in the accent.
  const flatIc = rule('fold\\.flat \\.cat-ic');
  assert.match(flatIc, /width:36px;height:36px/);
  const ic = rule('addcat-ic');
  assert.match(ic, /width:36px;height:36px/);
  assert.match(ic, /border-radius:var\(--m-r-full\)/);
  assert.match(ic, /border:1\.5px solid rgb\(var\(--sn-accent\)\)/);
  // The name's size is the flat row's name size.
  assert.match(rule('fold\\.flat \\.cat-nm'), /font-size:15px/);
  assert.match(rule('addcat-nm'), /font-size:15px/);
  assert.match(rule('addcat-chev'), /color:var\(--ink-soft\)/);
});

test('R4 · PickMenu draws `trigger` in place of the pill — its words, its arrow AND its look', () => {
  assert.match(PICK, /className=\{trigger \? className : `\$\{pickButtonClass\(compact\)\} \$\{className\}`\}/);
  assert.match(PICK, /\{trigger \?\? \(\s*<>/);
});
