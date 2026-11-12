/**
 * 🧾 THE FILTER ONLY FILTERS (owner, 3 Nov 2026: approved `docs/prototypes/guests_filter_popup_2026-11-03.html`, then
 * "so fix their locations" — remove "Do more" from the popup and move each action where it belongs).
 *
 *   1. The List's ≡ is the "Show & sort" sheet (`guests-filter-sheet.tsx`) — a `GuestPopup` from the bottom, mounted only
 *      while open: two topics (Who you see · How it is laid out), Show ▾ · +1s ▾ · Group by ▾ · Sort ▾ each ONE dropdown
 *      (`ChosenRow`), "· N applied" in the title, Clear all + "Show N guests" at the foot.
 *   2. It holds NO action: no Select, no Excel, no way to add.
 *   3. Every option the old ≡ held is still offered (Show's five + Asking to join, +1s' two, Group by's five, Sort's three).
 *   4. The four actions live in their new homes: ＋ Add ▾ (Type a name · From your people · Import a file), ☑ Select on the
 *      top row, ⚙ › Download as Excel.
 *   5. "N applied" counts exactly the choices that differ from the plain list.
 *
 * Run: cd apps/web && npx tsx --test 'app/dashboard/*\/guests/_components/the-filter-sheet-only-filters.test.ts'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { GUESTS_SHOW, GUESTS_SORTS, NO_GUESTS_FILTER, guestsFilterApplied, guestsFilterOptions } from '@/lib/guests-filter';
import { PLUS_ONE_FILTERS, ROSTER_VIEWS } from '@/lib/guest-roster-view';

const read = (f: string) => stripComments(readFileSync(join(__dirname, f), 'utf8'));
const ROUND = read('guests-filter-sheet.tsx');
const PANEL = read('guests-filter-panel.tsx');
// The sheet's frame (handle · title · Clear all | Show N) was extracted 2026-11-08 so the supplier's Clients list draws
// the SAME sheet (B1 step 4) — the Guests sheet re-mounts on it, byte-identical; its frame is still this sheet's.
const FRAME = stripComments(readFileSync(join(__dirname, '../../../../_components/show-sort-sheet.tsx'), 'utf8'));
const SHEET = ROUND + PANEL + FRAME;
const SCREEN = read('guests-screen.tsx');
const ROWS = stripComments(readFileSync(join(__dirname, '../../_components/guest-setup/guest-setup-rows.tsx'), 'utf8'));

test('1 · the sheet: a GuestPopup mounted only while open, two topics, four dropdowns, the count, Clear all, Show N (its panel loaded on first tap)', () => {
  assert.match(ROUND, /\{open \? <GuestsFilterPanel /, 'the sheet is not mounted only while open');
  assert.match(ROUND, /dynamic\(\(\) => import\('\.\/guests-filter-panel'\)/, 'the open sheet ships with the List again (the Maker draws the List — first-load budget)');
  assert.match(PANEL, /return \(\s*<ShowSortSheet\b/, 'the sheet is not the shared Show & sort frame');
  assert.match(FRAME, /return \(\s*<GuestPopup/, 'the sheet is not the shared pop-up');
  assert.match(SHEET, /absolute inset-x-0 bottom-0/, 'the sheet does not rise from the bottom (thumb reach)');
  assert.match(SHEET, /export const FILTER_SHEET_TOPICS = \['Who you see', 'How it is laid out'\] as const;/);
  for (const name of ['Show', '+1s', 'Group by', 'Sort']) {
    assert.match(SHEET, new RegExp(`<ChosenRow[\\s\\S]{0,80}name="${name.replace('+', '\\+')}"[\\s\\S]{0,60}line=\\{`), `${name} is not ONE dropdown with its one line`);
  }
  // Four fixed dropdowns + the per-head services' one row shape (2026-11-12, drawn once per service) — each with its ⓘ.
  assert.equal((SHEET.match(/about=\{\{ words: /g) ?? []).length, 5, 'a dropdown lost its ⓘ');
  assert.match(SHEET, /Show &amp; sort/);
  assert.match(SHEET, /· \{applied\} applied/, 'the title does not say how many choices are applied');
  assert.match(SHEET, /label="Clear all" disabled=\{applied === 0\} onClick=\{onClearAll\}/, 'Clear all is missing (or live with nothing applied)');
  assert.match(PANEL, /showLabel=\{`Show \$\{formatCount\(shown\)\} \$\{shown === 1 \? 'guest' : 'guests'\}`\}/, '"Show N guests" is missing');
  assert.match(FRAME, /label=\{showLabel\} onClick=\{onClose\}/, 'the frame does not draw the "Show N" it is given');
  assert.match(SCREEN, /right=\{\[\{ node: filterSheet \}\]\}/, 'the List’s thumb row does not seat the sheet');
});

test('2 · it only filters — no action inside', () => {
  assert.doesNotMatch(SHEET, /Select…|Save as Excel|Download|From your people|Import a file|ADD_WAYS|openAddWay|setSelectMode/, 'an action is back inside the filter');
  assert.doesNotMatch(SHEET, /Do more/, 'the "Do more" topic is back');
});

test('3 · every option the old ≡ held is still offered', () => {
  const list = guestsFilterOptions('list', NO_GUESTS_FILTER, { hasSides: true });
  assert.deepEqual(list.filter((o) => o.group === 'Show').map((o) => o.label), GUESTS_SHOW.map((s) => s.label));
  assert.deepEqual(list.filter((o) => o.group === 'Group by').map((o) => o.label), ROSTER_VIEWS.map((v) => v.label));
  assert.deepEqual(list.filter((o) => o.group === 'Sort').map((o) => o.label), GUESTS_SORTS.map((s) => s.label));
  assert.match(SHEET, /of\('Show'\)\.concat\(asking \? \[\{ key: 'asking', label: asking\.label \}\] : \[\]\)/, '“Asking to join” left Show');
  assert.match(SHEET, /PLUS_ONE_FILTERS\.map\(/, 'the +1s choices are not the shipped ones');
  assert.equal(PLUS_ONE_FILTERS.length, 2);
  // A new Group by still clears the +1 narrowing: the sheet hands its picks to the screen's `pickFilter`.
  assert.match(SCREEN, /<GuestsFilterSheet\s+filter=\{filter\}\s+onFilter=\{pickFilter\}/, 'the sheet bypasses pickFilter (a new Group by would keep +1s)');
  assert.match(SCREEN, /const pickFilter = [\s\S]{0,200}setPlusFilter\(null\);/);
});

test('4 · each action in its new home', () => {
  const add = SCREEN.slice(SCREEN.indexOf('const addMenu: ThumbMenu | null'), SCREEN.indexOf('const arrangeMenu: ThumbMenu'));
  assert.match(add, /key: 'add:type', label: 'Type a name'/, '＋ Add ▾ has no “Type a name”');
  assert.match(add, /\.\.\.addWays\.map\(/, '＋ Add ▾ lost From your people · Import a file');
  assert.match(SCREEN, /action=\{addMenu\}/, '＋ Add ▾ is not seated on the List row');
  assert.match(SCREEN, /label="Select" onClick=\{\(\) => setSelectMode\(true\)\} data-testid="guests-select"/, '☑ Select is not on the top row');
  assert.match(ROWS, /<DownloadExcelRow \/>/, 'Guests ⚙ has no Download as Excel');
});

test('5 · "N applied" counts exactly what differs from the plain list', () => {
  const plain = NO_GUESTS_FILTER;
  assert.equal(guestsFilterApplied(plain), 0);
  assert.equal(guestsFilterApplied({ ...plain, group: 'role' }), 0, 'Role picked back is the plain list');
  assert.equal(guestsFilterApplied({ ...plain, show: 'attending' }), 1);
  assert.equal(guestsFilterApplied(plain, { plus: false, asking: true }), 1, 'Asking to join is a Show');
  assert.equal(guestsFilterApplied({ show: 'none', group: 'side', sort: 'name' }, { plus: true, asking: false }), 4);
});
