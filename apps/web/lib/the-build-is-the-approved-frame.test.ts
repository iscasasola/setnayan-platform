/**
 * GUARD — SUPPLIERS › BUILD IS THE APPROVED FINAL FRAME (owner 2026-10-30, "that is the last rule for the suppliers.
 * we are done and good"; `carry-2026-10-29/suppliers-final-proto/` frames 12-build · 12b-build-with-pick ·
 * 13-build-compare · 14-build-book). Owner 2026-10-31, live iPhone: *"I also previously saw you design the Build with a
 * better interpretation where they can create and load build and compare them safely all in one screen."*
 *
 * One test per property, read from the source (no DOM — the look is held by the side-by-sides):
 *   1. THE ROW — `This build ▾` (one PickMenu of every saved build: loading one is the shipped Use) · `＋ New build`
 *      (a SNAPSHOT: the shipped save-as-new into `budget_builds`, no new table) · one ⓘ.
 *   2. ONE COMPARE — one table, drawn in the phone's sheet and in the computer's "All builds" pane: 2 side by side on a
 *      phone, 3 on a computer, "Hide what's the same", green = the lowest total.
 *   3. BOOK ASKS FIRST — the button opens the ask (frame 14); only its "Yes, book them" sends anything.
 *   4. ONE POP-UP TEMPLATE — every Build pop-up is the house sheet (`ScheduleSheet` + `SheetFoot`), never a bare Sheet.
 *   5. THE BAR — Save is the quiet answer, Book this build the main one (frame 12).
 *
 * Sabotage (2026-10-31, each red once, then restored): the row's PickMenu swapped for a plain label (1 red); a second
 * table drawn for the pane (2 red); the button's `onClick={press}` → `onClick={start}` (3 red); the compare sheet as a
 * bare `<Sheet` (4 red); Save given `main` (5 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const VENDORS = join(process.cwd(), 'app/dashboard/[eventId]/vendors');
const read = (rel: string) => stripComments(readFileSync(join(VENDORS, rel), 'utf8'));
const BODY = read('_components/build-body.tsx');
const BOOK = read('_components/book-this-build.tsx');

/** The JSX of the first element opening with `open`, up to its first `>` at depth 0 (enough for its props). */
function slice(src: string, from: string, len = 2600): string {
  const at = src.indexOf(from);
  assert.ok(at >= 0, `${from} is gone`);
  return src.slice(at, at + len);
}

test('1 · the row: This build ▾ (load a saved build) · ＋ New build (a snapshot) · one ⓘ', () => {
  const row = slice(BODY, 'data-build-head=""', 1600);
  assert.match(row, /<PickMenu\s+label="Your builds"/, 'This build ▾ is not the one dropdown of saved builds');
  assert.match(row, /\.\.\.saved\.map\(\(c\) => \(\{ key: c\.id, label: c\.name/, 'the dropdown does not list every saved build');
  assert.match(row, /onPick=\{choose\}/);
  assert.match(row, /label="New build"[\s\S]{0,200}onClick=\{\(\) => setSheet\(true\)\}/, '＋ New build does not open the save sheet');
  assert.equal((row.match(/<Explain\b/g) ?? []).length, 1, 'the row ends with ONE ⓘ');
  // Loading = the shipped Use; New build = the shipped save-as-new (no new table, no new action).
  const choose = slice(BODY, 'const choose = (key: string) => {', 600);
  assert.match(choose, /load\(card\);/, 'loading a build is not the shipped Use');
  assert.match(slice(BODY, 'const load = (card: BuildCard) => {', 400), /writes\.use\(\{ eventId, picks: card\.apply/);
  assert.match(BODY, /rawName: typed \|\| null, overwriteBuildId: null, snapshot: view\.snapshot/, 'New build is not a snapshot of this build');
  const imports = [...BODY.matchAll(/from '\.\.\/([\w-]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['build-actions', 'build-pick-actions'], 'the Build body writes through something new');
});

test('2 · one Compare: the same table in the phone’s sheet and the computer’s pane — 2 / 3 side by side, hide-same, green lowest', () => {
  assert.equal((BODY.match(/<CompareTable\b/g) ?? []).length, 1, 'a second compare table was drawn');
  assert.equal((BODY.match(/\btable\(\)/g) ?? []).length, 2, 'the sheet and the pane do not both draw the one table');
  assert.match(BODY, /cap=\{compareCap\(wide\)\}/, 'how many sit side by side is not the width’s answer');
  const t = slice(BODY, 'function CompareTable(', 9000);
  assert.match(t, /<SwitchRow name="Hide what’s the same" on=\{hideSame\} onChange=\{setHideSame\}/);
  assert.match(t, /compareRowIndexes\(shown, hideSame\)/);
  assert.match(t, /lowestTotalIds\(shown\)/);
  assert.match(t, /lowest\.has\(c\.id\) \? 'bg-success-50/, 'the lowest total is not drawn green');
  for (const k of ['Total', 'Budget left', 'Free on']) assert.ok(t.includes(`>\n              ${k}\n`), `the ${k} row is gone`);
  // The sheet only on a phone; the pane only from 1024.
  assert.match(BODY, /open=\{comparing && !wide\}/);
  assert.match(BODY, /\) : wide \? \(\s*<div className="mt-3">\{table\(\)\}<\/div>/);
});

test('3 · Book this build asks first — only "Yes, book them" sends', () => {
  assert.match(BOOK, /label="Book this build" onClick=\{press\}/, 'the button sends without asking');
  const press = slice(BOOK, 'const press = () => {', 300);
  assert.doesNotMatch(press, /\bstart\(\)|loop\(/, 'the press itself books');
  assert.match(press, /setAsking\(true\);/);
  const calls = [...BOOK.matchAll(/onClick=\{start\}/g)];
  assert.equal(calls.length, 1, 'something other than the ask starts the booking');
  assert.match(slice(BOOK, 'id="book-ask-h"', 900), /label="Yes, book them" onClick=\{start\}/, '"Yes, book them" is not what starts it');
});

test('4 · every Build pop-up is the one house template — never a bare Sheet', () => {
  for (const [name, src, min] of [
    ['build-body.tsx', BODY, 3],
    ['book-this-build.tsx', BOOK, 2],
  ] as const) {
    assert.doesNotMatch(src, /<Sheet\b/, `${name}: a pop-up of its own`);
    assert.doesNotMatch(src, /from '@\/app\/_components\/sheet'/, `${name}: imports the bare sheet`);
    assert.ok((src.match(/<ScheduleSheet\b/g) ?? []).length >= min, `${name}: fewer pop-ups on the house template than it opens`);
    assert.match(src, /<SheetFoot>/, `${name}: the answers are not in the thumb zone`);
  }
});

test('5 · the bar: Save is the quiet answer, Book this build the main one', () => {
  const bar = slice(BODY, 'function BarButtons(', 2400);
  const saves = [...bar.matchAll(/<ActionButton ([^>]*)label="(Saved|Save|Save this build)"/g)];
  assert.equal(saves.length, 3, 'a Save state is gone from the bar');
  for (const m of saves) {
    assert.match(m[1]!, /tone="neutral"/, `${m[2]} is not the quiet answer`);
    assert.doesNotMatch(m[1]!, /\bmain\b/, `${m[2]} is drawn as the main answer — Book is`);
  }
  assert.match(bar, /\{bookSlot\}/);
  assert.match(BOOK, /<ActionButton tone="brand" main icon=\{CalendarCheck\} label="Book this build"/);
});
