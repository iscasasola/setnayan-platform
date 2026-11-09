/**
 * the-date-sheet.test.ts — 📆 THE ONE DATE SHEET (Build 3 · Lane D part 1) holds its approved shape.
 *
 * Contract: prototype v3.1 (`Setnayan-specs/prototypes/date_picker_2026-11-09/`, artifact MfhZ3LUJpns19SDzFGDtTx v4) and
 * `plans/supplier_build_3_2026-11-08/03-FINAL-RULINGS-2026-11-09.md` § "Date picker (Lane D)" + § Motion. Owner, 9 Nov
 * 2026: *"date picker approved"* · *"why can i tap on the not available?"* · *"0.7 second animation is our default"*.
 *
 * Holds:
 *   1. NEVER STRETCHED — the month is the sheet minus its 16-px sides, never more than 360 (the prototype's own measured
 *      table, 320 → 1280), and whole greyed neighbours appear only where they fit;
 *   2. QUICK CHOICES FIRST — the right answers per use; one past the last allowed day is HIDDEN;
 *   3. A NOT-AVAILABLE DAY CAN NEVER BE CHOSEN — drawn by the shipped grid out of the tab order, never the chosen
 *      circle (even when the screen says it is), a tap reaches `onRefused` and never `onPick`; Set never lights for it;
 *      the reason reads "Fri 20 Nov — Lumina is not available";
 *   4. MEETINGS — a busy time says who, your own conflict names itself, Set only on a time free for everyone;
 *   5. MOTION — the glide and the rise read `--sn-pill-dur` (through `press-feel.tsx`'s `pressMs`) and `--sn-pill-spring`;
 *      no duration is written in the sheet; "reduce motion" moves nothing;
 *   6. CANCEL | SET at equal widths, Set the only way out with an answer;
 *   7. LAZY — no file but the one door imports the sheet's code, and the door is a `lazy(() => import(…))`;
 *      the shared layouts never reach it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import * as S from '@/lib/date-sheet';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SHEET = 'app/_components/date-sheet.tsx';
const DOOR = 'app/_components/date-sheet-lazy.tsx';
const CAL = 'app/_components/calendar.tsx';
const ROW = 'app/_components/form-row-date.tsx';
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

/* ── (1) never stretched ──────────────────────────────────────────────── */

test('(1) never stretched: the month is the sheet minus 16-px sides, capped at 360; whole neighbours only where they fit', () => {
  /* The prototype's own measured table (Chromium, 9 Nov 2026): centre month · left gap = right gap. */
  const measured: Array<[number, number, number, number]> = [
    [320, 288, 16, 0],
    [360, 328, 16, 0],
    [375, 343, 16, 0],
    [390, 358, 16, 0],
    [768, 360, 204, 0],
    [1280, 360, 460, 1],
  ];
  for (const [sheet, month, gap, side] of measured) {
    assert.equal(S.dateSheetMonthPx(sheet), month, `month at ${sheet}`);
    assert.equal((sheet - S.dateSheetMonthPx(sheet)) / 2, gap, `the gaps at ${sheet} are not equal and ${gap}`);
    assert.equal(S.dateSheetNeighbours(sheet), side, `neighbours a side at ${sheet}`);
  }
  assert.equal(S.DATE_SHEET_MONTH_MAX_PX, 360);
  assert.equal(S.DATE_SHEET_SIDE_PX, 16);
  for (let w = 300; w <= 2400; w += 7) {
    const month = S.dateSheetMonthPx(w);
    assert.ok(month <= 360 && (w - month) / 2 >= 16, `stretched or squeezed at ${w}`);
    const n = S.dateSheetNeighbours(w);
    /* Every month drawn — the centre and n a side, with their gaps — fits inside the sheet's 16-px sides. */
    assert.ok((2 * n + 1) * month + 2 * n * S.DATE_SHEET_MONTH_GAP_PX <= w - 2 * S.DATE_SHEET_SIDE_PX, `a squeezed neighbour at ${w}`);
  }
  /* The head and the foot keep the month's column: its cap plus the two sides. */
  const src = read(SHEET);
  assert.match(src, /const COLUMN = 'mx-auto w-full max-w-\[392px\] px-4';/, 'the column is not 360 + 2 × 16');
  assert.match(src, /style=\{\{ width: monthPx \}\}/, 'the centre month is not drawn at its one width');
});

/* ── (2) quick choices first ──────────────────────────────────────────── */

test('(2) quick choices: per use, none pre-selected, a choice past the last allowed day hidden', () => {
  const today = '2026-11-09';
  assert.deepEqual(S.validUntilChoices(today, '2026-11-28'), [
    { day: '2026-11-16', label: '7 days' },
    { day: '2026-11-23', label: '14 days' },
  ]);
  assert.equal(S.validUntilChoices(today, null).length, 3, '30 days is offered when no event bounds it');
  assert.deepEqual(
    S.meetingChoices(today, '2026-11-27').map((c) => [c.label, c.day]),
    [
      ['Today', '2026-11-09'],
      ['Tomorrow', '2026-11-10'],
      ['This Saturday', '2026-11-14'],
    ],
  );
  assert.equal(S.nextWeekday('2026-11-14', 6), '2026-11-21', '"This Saturday" on a Saturday is next week');
  assert.deepEqual(S.paymentAskChoices(today).map((c) => c.label), ['Today', 'Tomorrow', 'In a week']);
  const src = read(SHEET);
  assert.match(src, /useState<Step>\(hasChoices \? 'choices' : 'month'\)/, 'it does not open on the choices (or on the month when there are none)');
  assert.match(src, /data-date-sheet-pick=""[^>]*onClick=\{onMonth\}/, '"Pick a date" does not open the month');
});

/* ── (3) a not-available day can never be chosen ──────────────────────── */

test('(3) a refused day: out of the tab order, never the chosen circle, a tap says why and never picks', async () => {
  const { CalendarGrid } = await import(`../../${CAL}`);
  const refuse = (d: string) => (d === '2026-11-20' ? 'Lumina is not available' : null);
  /* The screen even claims the refused day is picked — the grid must still refuse to draw it chosen. */
  const html = await paint(h(CalendarGrid, { value: '2026-11-20', today: '2026-11-09', refuse, onPick: () => {} }));
  const day = html.match(/<button[^>]*data-calendar-day="2026-11-20"[^>]*>/)?.[0] ?? '';
  assert.ok(day, 'anti-vacuity: Nov 20 was not drawn');
  assert.match(day, /aria-disabled="true"/);
  assert.match(day, /tabindex="-1"/);
  assert.match(day, /aria-pressed="false"/, 'a refused day is drawn as chosen');
  assert.doesNotMatch(day, /bg-sn-accent/, 'a refused day wears the chosen fill');
  assert.match(day, /line-through/, 'a refused day is not struck');
  assert.match(day, /aria-label="November 20, 2026 — Lumina is not available"/);
  const free = html.match(/<button[^>]*data-calendar-day="2026-11-12"[^>]*>/)?.[0] ?? '';
  assert.doesNotMatch(free, /aria-disabled|tabindex/, 'an ordinary day was refused too');
  /* Without `refuse`, the grid is exactly as before: the picked day is the circle. */
  const plain = await paint(h(CalendarGrid, { value: '2026-11-20', onPick: () => {} }));
  assert.match(plain.match(/<button[^>]*data-calendar-day="2026-11-20"[^>]*>/)?.[0] ?? '', /aria-pressed="true"/);

  const cal = read(CAL);
  assert.match(cal, /onClick=\{\(\) => \(why !== null \? onRefused\?\.\(day, why\) : onPick\(day\)\)\}/, 'a refused day reaches onPick');
  assert.match(cal, /const look = why \? \{ \.\.\.raw, picked: false, inRange: false \} : raw;/, 'a refused day can be drawn chosen');

  assert.equal(S.refusalLine('2026-11-20', 'Lumina is not available'), 'Fri 20 Nov — Lumina is not available');
  assert.equal(S.dateSheetCanSet({ day: '2026-11-20', refuse }), false, 'Set lights on a refused day');
  assert.equal(S.dateSheetCanSet({ day: '2026-11-12', refuse }), true);
  assert.equal(S.dateSheetCanSet({ day: '2026-11-08', min: '2026-11-09' }), false, 'Set lights out of range');
  assert.equal(S.dateSheetCanSet({ day: null }), false);

  const src = read(SHEET);
  assert.match(src, /onClick=\{\(\) => \(why === null \? onChoose\(c\.day\) : undefined\)\}/, 'a refused quick choice can be chosen');
  assert.match(src, /onRefused=\{\(d, reason\) => say\(refusalLine\(d, reason\)\)\}/, 'a refused tap does not say why on the hint line');
  assert.match(src, /DATE_SHEET_REASON_MS/, 'the reason does not leave the hint line');
  assert.match(src, /const fair = \(day: CalendarDay \| null\) => \(day && !\(refuse && refuse\(day\) !== null\) \? day : null\);/, 'a refused day can arrive chosen');
});

/* ── (4) meetings: both sides ─────────────────────────────────────────── */

test('(4) meetings: a busy time says who, your own conflict names itself, Set only on a time free for everyone', () => {
  assert.equal(S.busyWords({ who: 'Lumina' }), 'Lumina is not available this date');
  assert.equal(S.busyWords({ who: 'Maria' }, '14:00'), 'Maria is not available at 2 PM');
  assert.equal(S.busyWords({ who: 'You', what: 'the florist meeting' }, '15:00'), 'You have the florist meeting at 3 PM');
  assert.equal(S.busyWords({ who: 'Lumina', what: 'a wedding' }), 'Lumina is not available this date', 'the other side said what it is');
  assert.equal(S.missingScheduleWords(['Tita Lu']), "Tita Lu hasn't added their schedule — check with them");
  assert.equal(S.slotsHeadWords('2026-11-12', ['Lumina', 'Maria', 'You']), 'Free for Lumina, Maria, You on Thursday, Nov 12');
  const slots: S.DateSheetSlots = { times: ['13:30', '14:00'], busy: (_d, t) => (t === '14:00' ? { who: 'Maria' } : null), free: [] };
  assert.equal(S.dateSheetCanSet({ day: '2026-11-12', time: '14:00', slots }), false, 'Set lights on a busy time');
  assert.equal(S.dateSheetCanSet({ day: '2026-11-12', time: null, slots }), false, 'Set lights with no time');
  assert.equal(S.dateSheetCanSet({ day: '2026-11-12', time: '09:15', slots }), false, 'Set lights on a time off the list');
  assert.equal(S.dateSheetCanSet({ day: '2026-11-12', time: '13:30', slots }), true);
  const src = read(SHEET);
  assert.match(src, /onClick=\{\(\) => \(busy \? undefined : onChoose\(t\)\)\}/, 'a busy time can be chosen');
  assert.match(src, /label=\{twoSteps \? 'Next' : 'Set'\}/, 'a meeting is not two steps');
});

/* ── (5) motion ───────────────────────────────────────────────────────── */

test('(5) motion: the family speed and spring from the tokens, no duration written, nothing moves under reduce motion', () => {
  const src = read(SHEET);
  assert.match(src, /import \{ pressMs \} from '\.\/press-feel';/);
  assert.match(src, /pressMs\(token\('--sn-pill-dur'\)\)/, 'the glide does not read --sn-pill-dur');
  assert.match(src, /token\('--sn-pill-spring'\)/, 'the glide does not read the family spring');
  assert.match(src, /prefers-reduced-motion: reduce/);
  assert.equal((src.match(/if \(!from \|\| !el\?\.animate \|\| still\(\)\) return;/g) ?? []).length, 1, 'the month glide moves under reduce motion');
  assert.equal((src.match(/if \(!el\?\.animate \|\| still\(\)\) return;/g) ?? []).length, 1, 'the rise moves under reduce motion');
  assert.doesNotMatch(src, /duration:\s*\d|\d+\s*ms\b|cubic-bezier\(/, 'a duration or an ease is written in the sheet');
  assert.match(src, /\{ duration: familyMs\(\), easing: familyEase\(\) \}/, 'the month glide is not the full family speed');
});

/* ── (6) Cancel | Set ─────────────────────────────────────────────────── */

test('(6) Cancel | Set: one row at equal widths, Set off until the answer may be kept, and the only way out with one', () => {
  const src = read(SHEET);
  const foot = src.slice(src.indexOf('data-date-sheet-foot'), src.indexOf('</div>', src.indexOf('"date-sheet-set"')));
  assert.ok(foot.length > 100, 'anti-vacuity: the foot was not found');
  assert.match(foot, /grid[^"]*grid-cols-2/, 'Cancel | Set are not equal widths');
  assert.ok(foot.indexOf('label="Cancel"') < foot.indexOf("'Set'"), 'Cancel is not first');
  assert.match(foot, /tone="neutral" icon=\{X\} label="Cancel"/);
  assert.match(foot, /tone="brand"\s+main/);
  assert.match(foot, /disabled=\{!ok\}/);
  assert.equal((src.match(/onSet\(/g) ?? []).length, 1, 'an answer leaves the sheet by more than one road');
  assert.match(src, /<OverlayBackdrop onClose=\{onCancel\}/, 'a tap on the dark keeps something');
  assert.doesNotMatch(src, /type="date"|datetime-local|<input\b|<select\b/, 'the sheet holds a native field');
});

/* ── (7) lazy, and never in the shared bundle ─────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('(7) lazy: the sheet is its own chunk, reached through ONE door; the shared layouts never reach it', () => {
  const door = read(DOOR);
  assert.match(door, /export const loadDateSheet = \(\) => import\('\.\/date-sheet'\);/);
  assert.match(door, /lazy\(\(\) => loadDateSheet\(\)\.then/);
  const files = ['app', 'components', 'lib'].flatMap((d) => walk(join(WEB, d)));
  assert.ok(files.length > 500, `anti-vacuity: only ${files.length} files walked`);
  const code: string[] = [];
  for (const f of files) {
    const rel = relative(WEB, f);
    if (rel === DOOR) continue;
    const src = stripComments(readFileSync(f, 'utf8'));
    /* An import of the sheet's module that is not `import type` pulls its code into that file's chunk. */
    /* (`lib/date-sheet.ts` is the pure rules — small, and meant to be imported anywhere.) */
    for (const m of src.matchAll(/import\s+(type\s+)?[^;]*?from\s+'([^']*\/date-sheet)'/g)) if (!m[1] && !/lib\/date-sheet$/.test(m[2] ?? '')) code.push(rel);
    if (/import\(\s*'[^']*\/date-sheet'\s*\)/.test(src)) code.push(rel);
  }
  assert.deepEqual(code, [], 'these files load the date sheet without its lazy door');
  for (const layout of ['app/layout.tsx', 'app/(shell)/layout.tsx', 'app/_components/press-feel.tsx']) {
    assert.doesNotMatch(read(layout), /date-sheet/, `${layout} (every page) reaches the date sheet`);
  }
  /* The shipped DateRow opens it only through the door, and only when the screen asks (`sheet`). */
  const row = read(ROW);
  assert.match(row, /import \{ LazyDateSheet \} from '\.\/date-sheet-lazy';/);
  assert.match(row, /\{open && sheet \? \(/);
  assert.match(row, /<OneOpenScope id=\{oneOpenId\}>/, "the sheet's own ⓘ would close the row that opened it");
});
