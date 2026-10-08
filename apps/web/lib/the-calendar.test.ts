/**
 * the-calendar.test.ts — THE CALENDAR (kind 8) AND THE FORM ROW WITH A DATE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 6 "Reply by" and § 8): *"form row with date"* · the gallery he approved — **"Three uses, one look. Pick one day.
 * Pick a range of days. See what is on each day. The picked day is terracotta; a dot means something is on that
 * day."** · the pop-up rule: *"when there is a pop up. the rest of the screen darkens … The darkened area will be
 * blurred and nothing behind it will work. pressing on the dark part removes the pop up."*
 *
 *   (1) A DAY IS THE DATE ITSELF — `YYYY-MM-DD`: what is not a real day is refused, and the grid, its title and a
 *       day's words are the same in every timezone (EXECUTED under two zones a day apart).
 *   (2) THE GRID'S RULES — the empty cells before the 1st (Sunday first), the month's days, ‹ › across a year's end.
 *   (3) WHAT MAY BE PICKED — every day, past ones too, unless the screen gives an earliest or a latest.
 *   (4) THREE USES, ONE LOOK — the picked day; a range (a later tap closes it, anything else starts over; its ends
 *       are circles and the days between fill softly); a dot where something is on.
 *   (5) THE GRID, RENDERED — the month and year between ‹ and ›, seven letters, one button per day named in full
 *       words; ONE day pressed, wearing the pill selector's own "on"; today a ring; 44 px on a phone, 40 on a
 *       computer; a day that may not be picked cannot be pressed.
 *   (6) THE POP — a sheet from the bottom below 1024 px, a panel under the pill from it. The sheet keeps the pop-up
 *       rule (dark + blur, nothing behind works, Esc and a tap on the dark close, never taller than the screen);
 *       the panel is attached and darkens nothing.
 *   (7) THE MOTION — transform and opacity only, at shares of the family's one speed, and none under reduce motion.
 *   (8) THE FORM ROW WITH A DATE, RENDERED — the list's own pill with a calendar mark, reading the day in words (a
 *       default that applies is read, quiet words when there is none); nothing open and nothing written on arrival;
 *       a tap on the day already picked sends nothing; a save that did not land says so with Try again.
 *   (9) THE WATCH — the calendar and the date row know no screen, write no accent, and hold no native date field.
 *
 * Mutations seen RED (2026-10-08), each restored: `dayParts` accepting 30 February → (1); the grid built on the
 * device's local time (`getDay()`) → (1); Sunday-first dropped (lead + 1) → (2); `dayAllowed` refusing past days →
 * (3); an EARLIER tap closing a range → (4); the picked day wearing a hand-written fill instead of the "on" look →
 * (5); a second day pressed (today counted as picked) → (4) and (5); the sheet's dark layer removed → (6); the
 * sheet no longer locking what is behind it → (6); `calendarOpensAs` giving a phone the panel → (6); an animation
 * that ignores reduce motion → (7); the pill sending the day it already holds → (8); a native `<input type="date">`
 * back in the date row → (8) and (9).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import * as C from './calendar-grid';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CAL = 'app/_components/calendar.tsx';
const ROW = 'app/_components/form-row-date.tsx';
const RULES = 'lib/calendar-grid.ts';
const FORM_ROW = 'app/_components/form-row.tsx';
const PILL = 'app/_components/pill-selector.tsx';
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const h = React.createElement;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
/** One function's own source, from its declaration to the next top-level one. */
function fn(src: string, name: string): string {
  const at = Math.max(src.indexOf(`function ${name}(`), src.indexOf(`function ${name}<`));
  assert.ok(at >= 0, `anti-vacuity: ${name} was not found`);
  const rest = src.slice(at + 10);
  const end = rest.search(/\n(?:export )?(?:function |const [A-Z_]+ = )/);
  return src.slice(at, end < 0 ? undefined : at + 10 + end);
}

/* ── (1) a day is the date itself ─────────────────────────────────────── */

test('(1) a day is the date itself: only a real YYYY-MM-DD, and the same grid and words in every timezone', () => {
  assert.deepEqual(C.dayParts('2026-11-12'), { y: 2026, m: 11, d: 12 });
  for (const bad of ['2026-02-30', '2026-13-01', '2026-00-10', '2026-11-00', '2026-11-31', '26-11-12', '2026-11-12T00:00:00Z', 'November 12, 2026', '', null, undefined]) {
    assert.equal(C.dayParts(bad as string), null, `${String(bad)} was read as a day`);
  }
  assert.deepEqual(C.dayParts('2028-02-29'), { y: 2028, m: 2, d: 29 });
  assert.equal(C.dayParts('2027-02-29'), null);
  assert.equal(C.dayOf(2026, 3, 5), '2026-03-05');
  assert.equal(C.dayWords('2026-11-12'), 'November 12, 2026');
  assert.equal(C.dayWords('nope'), '');
  // EXECUTED under two zones 26 hours apart: a date column's day must not become the day before or after.
  const was = process.env.TZ;
  const seen: string[] = [];
  try {
    for (const tz of ['Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Asia/Manila']) {
      process.env.TZ = tz;
      assert.equal(new Date(2026, 0, 1).getTimezoneOffset() !== 0 || tz === 'UTC', true, 'anti-vacuity: the zone did not change');
      seen.push(JSON.stringify([C.monthCells({ y: 2026, m: 11 }), C.monthCells({ y: 2026, m: 3 }), C.dayWords('2026-11-01'), C.monthTitle({ y: 2026, m: 11 }), C.daysIn(2026, 2)]));
    }
  } finally {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
  }
  assert.equal(new Set(seen).size, 1, `the grid differs by timezone: ${seen.join(' | ')}`);
  assert.doesNotMatch(read(RULES), /\.getDay\(\)|\.getDate\(\)|\.getMonth\(\)|\.getFullYear\(\)|new Date\(\s*[a-z]\w*\s*,/, 'the rules read the device’s local time');
});

/* ── (2) the grid's rules ─────────────────────────────────────────────── */

test('(2) the grid: the empty cells before the 1st (Sunday first), the days, and ‹ › across a year’s end', () => {
  // 1 November 2026 is a Sunday; 1 December 2026 a Tuesday; 1 February 2026 a Sunday; 1 August 2026 a Saturday.
  assert.deepEqual(C.monthCells({ y: 2026, m: 11 }), { lead: 0, days: 30 });
  assert.deepEqual(C.monthCells({ y: 2026, m: 12 }), { lead: 2, days: 31 });
  assert.deepEqual(C.monthCells({ y: 2026, m: 8 }), { lead: 6, days: 31 });
  assert.deepEqual(C.monthCells({ y: 2028, m: 2 }), { lead: 2, days: 29 });
  assert.equal(C.CALENDAR_WEEKDAYS.map((w) => w.letter).join(''), 'SMTWTFS');
  assert.equal(C.CALENDAR_WEEKDAYS[0].name, 'Sunday');
  assert.equal(C.monthTitle({ y: 2026, m: 11 }), 'November 2026');
  assert.deepEqual(C.stepMonth({ y: 2026, m: 12 }, 1), { y: 2027, m: 1 });
  assert.deepEqual(C.stepMonth({ y: 2026, m: 1 }, -1), { y: 2025, m: 12 });
  assert.deepEqual(C.stepMonth({ y: 2026, m: 11 }, 14), { y: 2028, m: 1 });
  assert.deepEqual(C.stepMonth({ y: 2026, m: 3 }, -15), { y: 2024, m: 12 });
  // It opens on the picked day's month — else on the first fallback that is a day.
  assert.deepEqual(C.monthOf('2026-11-12', '2025-01-01'), { y: 2026, m: 11 });
  assert.deepEqual(C.monthOf(null, '', '2026-12-18'), { y: 2026, m: 12 });
  assert.equal(C.monthOf(null, undefined), null);
});

/* ── (3) what may be picked ───────────────────────────────────────────── */

test('(3) every day may be picked — past ones too — unless the screen gives an earliest or a latest', () => {
  assert.equal(C.dayAllowed('1999-01-01'), true, 'a past day is refused although no screen asked for that');
  assert.equal(C.dayAllowed('2099-12-31'), true);
  assert.equal(C.dayAllowed('2026-02-30'), false, 'a day that does not exist may be picked');
  assert.equal(C.dayAllowed('2026-11-11', { min: '2026-11-12' }), false);
  assert.equal(C.dayAllowed('2026-11-12', { min: '2026-11-12' }), true);
  assert.equal(C.dayAllowed('2026-12-19', { max: '2026-12-18' }), false);
  assert.equal(C.dayAllowed('2026-12-18', { min: '2026-11-12', max: '2026-12-18' }), true);
  // A bound that is not a day bounds nothing.
  assert.equal(C.dayAllowed('2026-11-11', { min: 'soon' }), true);
});

/* ── (4) three uses, one look ─────────────────────────────────────────── */

test('(4) three uses, one look: the picked day · a range · a dot where something is on', () => {
  // ONE DAY.
  const one = (day: string) => C.dayLook(day, { value: '2026-11-12', today: '2026-11-09' });
  assert.deepEqual(one('2026-11-12'), { picked: true, inRange: false, today: false, marked: false, out: false });
  assert.deepEqual(one('2026-11-09'), { picked: false, inRange: false, today: true, marked: false, out: false });
  assert.equal(one('2026-11-13').picked, false);
  // A RANGE — the gallery's rule: with a first day and no last, a LATER day closes it; anything else starts over.
  let r = C.pickInRange(null, '2026-12-10');
  assert.deepEqual(r, { from: '2026-12-10', to: null });
  assert.deepEqual(C.pickInRange(r, '2026-12-08'), { from: '2026-12-08', to: null }, 'an earlier tap closed the range backwards');
  assert.deepEqual(C.pickInRange(r, '2026-12-10'), { from: '2026-12-10', to: null });
  r = C.pickInRange(r, '2026-12-14');
  assert.deepEqual(r, { from: '2026-12-10', to: '2026-12-14' });
  assert.deepEqual(C.pickInRange(r, '2026-12-20'), { from: '2026-12-20', to: null }, 'a closed range did not start over');
  const inR = (day: string) => C.dayLook(day, { range: r });
  assert.deepEqual([inR('2026-12-09'), inR('2026-12-10'), inR('2026-12-12'), inR('2026-12-14'), inR('2026-12-15')].map((l) => `${+l.picked}${+l.inRange}`), ['00', '11', '01', '11', '00']);
  // Still being picked: its first day is the circle, nothing is filled yet.
  assert.deepEqual(C.dayLook('2026-12-11', { range: { from: '2026-12-10', to: null } }).inRange, false);
  assert.equal(C.dayLook('2026-12-10', { range: { from: '2026-12-10', to: null } }).picked, true);
  // WHAT IS ON.
  assert.equal(C.dayLook('2026-12-05', { marks: new Set(['2026-12-05']) }).marked, true);
  assert.equal(C.dayLook('2026-12-06', { marks: new Set(['2026-12-05']) }).marked, false);
  // Outside what may be picked.
  assert.equal(C.dayLook('2026-11-11', { min: '2026-11-12' }).out, true);
});

/* ── (5) the grid, rendered ───────────────────────────────────────────── */

test('(5) the grid, rendered: ‹ November 2026 ›, seven letters, a named button per day; ONE pressed, in the "on" look; today a ring', async () => {
  const { CalendarGrid, CALENDAR_DAY_CLASS } = await import(`../${CAL}`);
  const { PILL_ON_CLASS } = await import(`../${PILL}`);
  const html = await paint(h(CalendarGrid, { value: '2026-11-12', today: '2026-11-09', onPick: () => {} }));
  assert.match(html, /aria-label="Earlier month"[\s\S]*?<b [^>]*>November 2026<\/b>[\s\S]*?aria-label="Later month"/);
  assert.equal(count(html, /data-calendar-weekday=""/g), 7);
  assert.equal(count(html, /data-calendar-day="2026-11-\d\d"/g), 30);
  assert.equal(count(html, /<i aria-hidden="true"><\/i>/g), 0, 'November 2026 starts on a Sunday — no empty cell');
  // Every day is a button named in full words (never a bare number to a screen reader).
  assert.match(html, /<button type="button" aria-pressed="true" aria-label="November 12, 2026" data-calendar-day="2026-11-12"/);
  // ONE day pressed — and it wears the pill selector's own "on", never a colour of its own.
  assert.equal(count(html, /aria-pressed="true"/g), 1, 'more than one day is pressed (or none)');
  const picked = /data-calendar-day="2026-11-12" class="([^"]*)"/.exec(html)?.[1] ?? '';
  for (const cls of PILL_ON_CLASS.split(' ')) assert.ok(picked.split(' ').includes(cls), `the picked day does not wear the "on" look (${cls})`);
  assert.ok(picked.split(' ').includes('rounded-full'));
  // Today: said to a screen reader, and a hairline ring — not the accent.
  assert.match(html, /aria-pressed="false" aria-current="date" aria-label="November 9, 2026"/);
  const today = /data-calendar-day="2026-11-09" class="([^"]*)"/.exec(html)?.[1] ?? '';
  assert.ok(today.includes('ring-1') && !today.includes('bg-sn-accent'), 'today is not the hairline ring');
  // 44 px on a phone, 40 px on a computer; never under the app's 44-px floor by accident (the floor is set here).
  const day = CALENDAR_DAY_CLASS.split(' ');
  for (const cls of ['h-11', 'min-h-11', 'lg:h-10', 'lg:min-h-10']) assert.ok(day.includes(cls), `a day is not ${cls}`);
  // December 2026 starts on a Tuesday: two empty cells first.
  const dec = await paint(h(CalendarGrid, { value: '2026-12-18', onPick: () => {} }));
  assert.equal(count(dec, /<i aria-hidden="true"><\/i>/g), 2);
  assert.equal(count(dec, /data-calendar-day="2026-12-\d\d"/g), 31);
  // No day picked yet: it opens on `startAt`'s month, and nothing is pressed.
  const none = await paint(h(CalendarGrid, { startAt: '2027-02-01', onPick: () => {} }));
  assert.match(none, /February 2027/);
  assert.equal(count(none, /aria-pressed="true"/g), 0);
  // A day that may not be picked cannot be pressed; a marked day carries its dot; a range fills softly between its ends.
  const bound = await paint(h(CalendarGrid, { value: '2026-11-12', min: '2026-11-10', marks: new Set(['2026-11-20']), onPick: () => {} }));
  assert.match(bound, /<button type="button" disabled="" aria-pressed="false" aria-label="November 9, 2026"/);
  assert.equal(count(bound, /disabled=""/g), 9);
  assert.match(bound, /aria-label="November 20, 2026 — something is on" data-calendar-day="2026-11-20"[^>]*>20<span aria-hidden="true" data-calendar-dot=""/);
  const range = await paint(h(CalendarGrid, { range: { from: '2026-11-10', to: '2026-11-13' }, onPick: () => {} }));
  assert.equal(count(range, /aria-pressed="true"/g), 2, 'a range’s two ends are not both circles');
  assert.equal(count(range, /data-calendar-in-range=""/g), 4);
  assert.match(/data-calendar-day="2026-11-11" data-calendar-in-range="" class="([^"]*)"/.exec(range)?.[1] ?? '', /rounded-none bg-sn-accent\/\[0\.14\]/);
  assert.doesNotMatch(html, /<input|<select/);
});

/* ── (6) the pop ──────────────────────────────────────────────────────── */

test('(6) the pop: a sheet from the bottom on a phone (dark, blurred, locked, a tap on the dark closes), a panel under the pill on a computer', () => {
  assert.equal(C.calendarOpensAs(375), 'sheet');
  assert.equal(C.calendarOpensAs(1023), 'sheet');
  assert.equal(C.calendarOpensAs(1024), 'panel');
  assert.equal(C.calendarOpensAs(1280), 'panel');
  const src = read(CAL);
  assert.match(fn(src, 'CalendarPop'), /calendarOpensAs\(window\.innerWidth\)/);
  const sheet = fn(src, 'CalendarSheet');
  // THE POP-UP RULE, each part.
  assert.match(sheet, /<span aria-hidden className="sn-popup-dark pointer-events-none absolute inset-0" \/>/, 'the rest of the screen is not dark and blurred');
  assert.match(sheet, /return el \? inertBehind\(el\) : undefined;/, 'what is behind the sheet still works');
  assert.match(sheet, /useModalA11y\(\{ open: true, onClose, containerRef: panel \}\);/, 'Esc does not close it, or the page behind scrolls');
  assert.match(sheet, /<button type="button" aria-label="Close" data-calendar-scrim="" onClick=\{onClose\}/, 'a tap on the dark does not close it');
  assert.match(sheet, /role="dialog"\s+aria-modal="true"\s+aria-labelledby=\{headId\}/);
  assert.match(sheet, /absolute inset-x-0 bottom-0 [^"]*max-h-\[calc\(100dvh-48px\)\][^"]*overflow-y-auto/, 'the sheet can be taller than the screen');
  // The panel is attached to its pill: it darkens nothing and locks nothing; a press elsewhere or Esc closes it.
  const panel = fn(src, 'CalendarPanel');
  assert.doesNotMatch(panel, /sn-popup-dark|inertBehind|aria-modal|useModalA11y/, 'a computer’s panel darkens or locks the page');
  assert.match(panel, /placeTickerPop\(\{ button: b, pop: \{ width: p\.offsetWidth, height: p\.scrollHeight \}/);
  assert.match(panel, /if \(!pop\.current\?\.contains\(t\) && !anchor\.current\?\.contains\(t\)\) shut\.current\(\);/);
  assert.match(panel, /if \(e\.key !== 'Escape'\) return;\s*e\.stopPropagation\(\);\s*shut\.current\(\);\s*anchor\.current\?\.focus\(\);/);
});

/* ── (7) the motion ───────────────────────────────────────────────────── */

test('(7) the motion: transform and opacity only, at shares of the family’s speed — and none under reduce motion', () => {
  const src = read(CAL);
  const moves = src.match(/\.animate\(/g) ?? [];
  assert.equal(moves.length, 3, 'anti-vacuity: the month, the sheet and the panel each move once');
  // Each one stands down under reduce motion, in the statement just before it.
  assert.equal(count(src, /\|\| still\(\)\) return;\s*el\.animate\(/g), 3, 'an animation runs under reduce motion');
  assert.match(src, /const still = \(\) => typeof window !== 'undefined' && window\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)\.matches === true;/);
  // Only transform and opacity are animated.
  const frames = [...src.matchAll(/\{ (opacity|transform)[^}]*\}/g)].map((m) => m[0]);
  assert.ok(frames.length >= 5, 'anti-vacuity');
  assert.doesNotMatch(src, /\.animate\(\s*\[[^\]]*(?:height|width|top|left|margin|padding)\s*:/, 'the calendar animates layout');
  // …at the family's one speed (the gallery's shares of its 230).
  assert.equal(count(src, /duration: familyMs\(\) \* CALENDAR_MOTION\.(month|sheet|panel)/g), 3);
  assert.deepEqual(C.CALENDAR_MOTION, { sheet: 220 / 230, panel: 160 / 230, month: 120 / 230 });
  assert.match(src, /pressMs\(getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--sn-pill-dur'\)\)/);
  assert.equal(C.CALENDAR_CLOSE_AFTER_PICK_MS, 260);
});

/* ── (8) the Form row with a date ─────────────────────────────────────── */

test('(8) the Form row with a date: the list’s own pill with a calendar mark; nothing open on arrival; the same day sends nothing; a failure says so', async () => {
  const { DateRow } = await import(`../${ROW}`);
  const { FormRows, TypedRow, FORM_PILL_WIDTH } = await import(`../${FORM_ROW}`);
  const draw = (props: Record<string, unknown>, width: 'short' | 'wide' = 'wide') =>
    paint(h(FormRows, { width }, h(TypedRow, { name: 'Event name', value: 'Maria & Jose', onKeep: () => {} }), h(DateRow, { name: 'Reply by', onKeep: () => {}, ...props } as Record<string, unknown>)));
  const html = await draw({ value: '2026-11-12' });
  assert.match(html, /data-form-row-kind="date"/);
  assert.match(html, /<button type="button" data-form-row-pill="date" aria-haspopup="dialog" aria-expanded="false" aria-label="Reply by: November 12, 2026\. Tap to change"/);
  assert.match(html, />November 12, 2026<\/span><svg[^>]*data-form-row-mark="calendar"/);
  // The SAME pill as the typed row beside it: the list's one width, both.
  for (const width of ['short', 'wide'] as const) {
    const both = await draw({ value: '2026-11-12' }, width);
    const pills = [...both.matchAll(/data-form-row-pill="(typed|date)"[^>]*class="([^"]*)"/g)].map((m) => m[2]!.split(' '));
    assert.equal(pills.length, 2, 'anti-vacuity: the two pills were not found');
    for (const p of pills) assert.ok(p.includes(FORM_PILL_WIDTH[width]), `a pill is not the list’s ${width} width`);
    for (const cls of ['h-10', 'rounded-full', 'bg-white', 'border']) assert.ok(pills[1]!.includes(cls), `the date pill is not the row’s pill (${cls})`);
  }
  // A default that applies is READ (never sent by itself); with no day at all the words are quiet.
  const byDefault = await draw({ value: null, shown: '2026-11-18' });
  assert.match(byDefault, /aria-label="Reply by: November 18, 2026\. Tap to change"/);
  const none = await draw({ value: '', empty: 'Pick a date' });
  assert.match(none, /aria-label="Reply by: not set yet\. Tap to change"/);
  assert.match(none, /class="[^"]*text-ink\/45[^"]*">Pick a date<\/span>/);
  // On arrival: no calendar, no field, no Save — opening a page opens nothing and writes nothing.
  assert.doesNotMatch(html, /role="dialog"|data-calendar|<input|>\s*Save\s*<|>\s*Saved\s*</);
  const src = read(ROW);
  // THE CLAIM: a tap on the day the row already holds keeps nothing; any other day is kept ONCE.
  assert.match(src, /if \(day !== \(picked \?\? own\)\) send\(day\);/, 'the day it already holds is sent again');
  assert.equal(count(src, /onKeep\(/g), 1, 'more than one write per pick');
  assert.doesNotMatch(src, /useEffect\(\(\) => \{[^}]*onKeep/, 'something keeps a day without a tap');
  // It opens the app's ONE calendar, in its pop, only while open — and joins "one open at a time".
  assert.match(src, /\{open \? \(\s*<CalendarPop title=\{name\} anchor=\{pill\} onClose=\{close\}>[\s\S]*?<CalendarGrid data="row" value=\{reads\}/);
  assert.match(src, /useOneOpen\(open, setOpen\);/);
  // A save that did not land SAYS so, with Try again — and the tick is only for one that landed.
  assert.match(src, /else if \(answer && answer\.ok === false\) setState\(\{ kind: 'failed', day, reason: answer\.error \?\? null \}\);/);
  assert.match(src, /<span>\{saveFailedWords\(name, state\.reason\)\}<\/span>\s*<button type="button" data-form-row-retry="" onClick=\{\(\) => send\(state\.day\)\}/);
  assert.match(src, /\{state\.kind === 'saved' \? \(\s*<Check [^>]*data-form-row-mark="tick"/);
});

/* ── (9) the watch ────────────────────────────────────────────────────── */

test('(9) the watch: the calendar and the date row know no screen, write no accent, and hold no native date field', () => {
  for (const file of [CAL, ROW, RULES]) {
    const src = read(file);
    assert.ok(src.length > 400, `anti-vacuity: ${file} was not read`);
    assert.doesNotMatch(src, /\/launch\/|maker-|\/dashboard\/|hub-draft|rsvp/i, `${file} knows a screen`);
    assert.doesNotMatch(src, /type="date"|<input\b|<select\b/, `${file} holds a native field`);
    assert.doesNotMatch(src, /mulberry|#[0-9a-fA-F]{3,8}\b|\btext-white\b/, `${file} writes a colour for the accent`);
  }
  // …and both are on the list of template files no accent may be written in.
  const watch = readFileSync(join(WEB, 'lib/the-accent-is-one-token.test.ts'), 'utf8');
  for (const file of [CAL, ROW]) assert.ok(watch.includes(`'${file}'`), `${file} is not on the accent watch (TEMPLATE_FILES)`);
});
