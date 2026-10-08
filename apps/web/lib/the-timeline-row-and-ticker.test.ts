/**
 * the-timeline-row-and-ticker.test.ts — THE TIMELINE ROW AND ITS TICKER, the shared pieces.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9; approved gallery `prototypes/control_templates_2026-10-08.html`
 * § 13): *"tap the time start and time end and name of that schedule"* · *"the popup exceeded the screen … center
 * the time. how about a ticker instead so it does not eat too much space"* · *"can also be love story form"* ·
 * *"add optional for the day it can be month and year only or month year and day or year only"* · on editing a
 * row: *"cannot edit the other. no more check just (X) tapping out is auto accept or pressing enter"*.
 *
 *   (1) A TIME — moving the start keeps the length; an end at or before the start is THE NEXT DAY and says so; the
 *       line reads "5:00 PM – 6:00 PM · 1 h"; rows sort by start; an overlap is one line; "Add" starts where the
 *       last one ended, one hour long.
 *   (2) A WHEN — a precision is the SHAPE of the date: going coarser drops the part, never invents a day; a
 *       year-only chapter sorts at the start of its year; the words are only as exact as the date.
 *   (3) THE TICKER, RENDERED — time: hour · minute in 5-minute steps · AM/PM, the value in the centre band's
 *       choice, one line above, Done. When: the Year · Month · Full date pill and ONLY the columns that precision
 *       needs. A minute that is not a multiple of five is offered, never rounded away.
 *   (4) THE POP — a desktop pop sits under its button, flips up with no room below, and is never taller than the
 *       screen; the phone sheet is capped under the screen's height and scrolls inside.
 *   (5) THE ROW, RENDERED — when · name · trailing; open, the field takes the row with ONLY ✕ (no ✓).
 *   (6) THE WATCH — the shared pieces import nothing of the Maker's and write no accent colour of their own (no
 *       hex, no colour name but the ones this test lists).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import * as T from './timeline';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));
const TICKER = 'app/_components/ticker.tsx';
const ROW = 'app/_components/timeline-row.tsx';
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

test('(1) a time: the start carries the end, an end at or before the start is the next day, the line says the length', () => {
  const ceremony = { startMin: 15 * 60, endMin: 16 * 60 };
  // Moving the start moves the end with it — the hour is kept.
  assert.deepEqual(T.moveStart(ceremony, 17 * 60), { startMin: 17 * 60, endMin: 18 * 60 });
  assert.equal(T.spanLine(T.moveStart(ceremony, 17 * 60)), '5:00 PM – 6:00 PM · 1 h');
  // Picking an end later the same day: only the end moves.
  assert.deepEqual(T.pickEnd(ceremony, 16 * 60 + 30), { startMin: 900, endMin: 990 });
  assert.equal(T.spanLine(T.pickEnd(ceremony, 16 * 60 + 30)), '3:00 PM – 4:30 PM · 1 h 30 min');
  // An end BEFORE the start, and an end AT the start: the next day, said — never a moment that ends before it began.
  const party = { startMin: 22 * 60, endMin: 23 * 60 };
  const late = T.pickEnd(party, 60);
  assert.deepEqual(late, { startMin: 1320, endMin: 1500 });
  assert.ok(T.endsNextDay(late));
  assert.equal(T.spanLine(late), '10:00 PM – 1:00 AM · 3 h · ends next day');
  assert.equal(T.pickEnd(party, 22 * 60).endMin - party.startMin, 24 * 60, 'an end AT the start is a whole day later, not zero long');
  assert.ok(!T.endsNextDay(ceremony));
  assert.doesNotMatch(T.spanLine(ceremony), /next day/);
  // The clock: 12 AM is 0 and 12 PM is 720, both ways.
  for (const m of [0, 5, 60, 719, 720, 725, 1439]) assert.equal(T.minutesOfClock(T.clockPartsOf(m)), m);
  assert.equal(T.clockWords(0), '12:00 AM');
  assert.equal(T.clockWords(720), '12:00 PM');
  assert.equal(T.lengthWords(30), '30 min');
  assert.equal(T.lengthWords(60), '1 h');
  // Rows sort by start; a tie keeps the order it came in.
  const rows = [{ n: 'b', s: 900 }, { n: 'a', s: 600 }, { n: 'c', s: 900 }];
  assert.deepEqual(T.byStart(rows, (r) => r.s).map((r) => r.n), ['a', 'b', 'c']);
  // An overlap names the row above and when it ends — and only where there is one.
  const day = [{ n: 'Ceremony', startMin: 900, endMin: 960 }, { n: 'Photos', startMin: 930, endMin: 990 }, { n: 'Dinner', startMin: 1080, endMin: 1200 }];
  const clash = T.overlapsAbove(day, (r) => r);
  assert.deepEqual([...clash.keys()], [1]);
  assert.equal(T.overlapLine(clash.get(1)!.above.n, clash.get(1)!.endMin), 'Starts before Ceremony ends (4:00 PM).');
  assert.equal(T.overlapLine('', 960), 'Starts before the moment above ends (4:00 PM).');
  // Add: where the last one ended, one hour long; 2 PM on an empty day.
  assert.deepEqual(T.nextMomentSpan(day), { startMin: 1200, endMin: 1260 });
  assert.deepEqual(T.nextMomentSpan([]), { startMin: 840, endMin: 900 });
});

test('(2) a when: the precision is the shape — coarser drops the part, nothing invents a day; sorting and words follow', () => {
  const full: T.TimelineWhen = { y: 2021, m: 2, d: 14 };
  assert.equal(T.precisionOf(full), 'day');
  assert.equal(T.precisionOf({ y: 2019, m: 6 }), 'month');
  assert.equal(T.precisionOf({ y: 2019 }), 'year');
  // Coarser: the day, then the month, are GONE from the value — not kept as 1.
  assert.deepEqual(T.whenAt(full, 'month'), { y: 2021, m: 2 });
  assert.deepEqual(T.whenAt(full, 'year'), { y: 2021 });
  assert.ok(!('d' in T.whenAt(full, 'month')) && !('m' in T.whenAt(full, 'year')));
  // Finer: what this ticker last showed comes back; with nothing to bring back, the first — which is ON SCREEN.
  assert.deepEqual(T.whenAt({ y: 2021 }, 'day', { m: 2, d: 14 }), full);
  assert.deepEqual(T.whenAt({ y: 2021 }, 'month'), { y: 2021, m: 1 });
  // A month that rolls to a shorter one pulls the day back inside it (and a leap year is known).
  assert.deepEqual(T.clampWhen({ y: 2021, m: 2, d: 31 }), { y: 2021, m: 2, d: 28 });
  assert.deepEqual(T.clampWhen({ y: 2024, m: 2, d: 31 }), { y: 2024, m: 2, d: 29 });
  assert.equal(T.daysInMonth(2019, 6), 30);
  // Words: only as exact as it is.
  assert.equal(T.whenWords({ y: 2019 }), '2019');
  assert.equal(T.whenWords({ y: 2019, m: 6 }), 'Jun 2019');
  assert.equal(T.whenWords(full), 'Feb 14, 2021');
  assert.equal(T.whenWords({ y: 2019, m: 6 }, true), 'June 2019');
  assert.equal(T.whenWords(full, true), 'February 14, 2021');
  assert.doesNotMatch(T.whenWords({ y: 2019, m: 6 }, true), /\b1\b/, 'a month never reads as its first day');
  // A year alone sorts at the start of its year; a month at the start of its month.
  const order = [{ y: 2019, m: 6 }, { y: 2019 }, { y: 2019, m: 6, d: 2 }, { y: 2018, m: 12, d: 31 }].sort((a, b) => T.whenKey(a) - T.whenKey(b));
  assert.deepEqual(order, [{ y: 2018, m: 12, d: 31 }, { y: 2019 }, { y: 2019, m: 6 }, { y: 2019, m: 6, d: 2 }]);
  // The year column always holds the chapter's own year, however old.
  assert.ok(T.yearChoices(1931, 2026).includes(1931) && T.yearChoices(1931, 2026).includes(2026));
});

test('(3) the ticker, rendered: time = hour · 5-minute steps · AM/PM with one line and Done; when = the pill and only the columns it needs', async () => {
  const { TimeTicker, WhenTicker } = await import('../app/_components/ticker');
  const noop = () => {};
  const time = await paint(React.createElement(TimeTicker, { minutes: 15 * 60 + 5, onChange: noop, line: '3:05 PM – 4:05 PM · 1 h', onDone: noop }));
  assert.equal(count(time, /data-ticker-column="/g), 3);
  for (const col of ['Hour', 'Minute', 'AM or PM']) assert.match(time, new RegExp(`role="listbox"[^>]*aria-label="${col}"`), `no ${col} column`);
  // Five-minute steps: twelve minutes, twelve hours, two halves.
  assert.equal(count(time, /data-ticker-choice="/g), 12 + 12 + 2);
  // The value is the SELECTED choice of each column (the one the centre band holds).
  assert.equal(count(time, /aria-selected="true"/g), 3);
  assert.match(time, /aria-selected="true" data-ticker-choice="3"/);
  assert.match(time, /aria-selected="true" data-ticker-choice="5"[^>]*>05</);
  assert.match(time, /aria-selected="true" data-ticker-choice="true"[^>]*>PM</);
  assert.match(time, /data-ticker-band=""/);
  assert.match(time, /data-ticker-line=""[^>]*aria-live="polite"[^>]*>3:05 PM – 4:05 PM · 1 h</);
  assert.match(time, /data-ticker-done=""[^>]*>Done</);
  assert.match(time, /snap-y snap-mandatory/, 'the columns do not snap');
  // A 2:07 written elsewhere is OFFERED (13 minutes), so rolling the hour never rounds it.
  const odd = await paint(React.createElement(TimeTicker, { minutes: 14 * 60 + 7, onChange: noop, line: '', onDone: noop }));
  assert.match(odd, /aria-selected="true" data-ticker-choice="7"[^>]*>07</);
  assert.deepEqual(T.minuteChoices(7).length, 13);
  assert.deepEqual(T.minuteChoices(10).length, 12);

  const cols = (html: string) => [...html.matchAll(/data-ticker-column="([^"]+)"/g)].map((m) => m[1]);
  const when = (value: T.TimelineWhen) => paint(React.createElement(WhenTicker, { value, onChange: noop, onDone: noop, thisYear: 2026 }));
  const year = await when({ y: 2019 });
  assert.deepEqual(cols(year), ['Year']);
  assert.match(year, /data-ticker-line=""[^>]*>2019</);
  const month = await when({ y: 2019, m: 6 });
  assert.deepEqual(cols(month), ['Month', 'Year']);
  assert.match(month, /data-ticker-line=""[^>]*>June 2019</);
  const fullDate = await when({ y: 2021, m: 2, d: 14 });
  assert.deepEqual(cols(fullDate), ['Month', 'Day', 'Year']);
  assert.match(fullDate, /data-ticker-line=""[^>]*>February 14, 2021</);
  // February 2021 offers 28 days — never a 30th to roll to.
  assert.equal(count(fullDate.split('data-ticker-column="Day"')[1]!.split('data-ticker-column="Year"')[0]!, /data-ticker-choice="/g), 28);
  // The three-way pill, in the gallery's words, the picked one pressed.
  for (const html of [year, month, fullDate]) {
    assert.match(html, /data-pill-selector="when-precision"/);
    assert.deepEqual([...html.matchAll(/data-seg="(year|month|day)"[^>]*>([^<]+)</g)].map((m) => m[2]), ['Year', 'Month', 'Full date']);
    assert.equal(count(html, /aria-pressed="true"/g), 1);
  }
  assert.match(month, /aria-pressed="true"[^>]*data-seg="month"|data-seg="month"[^>]*aria-pressed="true"/);
  // Which choice the centre band holds, from a scroll offset — clamped at both ends.
  assert.equal(T.settledIndex(0, 12), 0);
  assert.equal(T.settledIndex(T.TICKER_ROW_PX * 3 + 12, 12), 3);
  assert.equal(T.settledIndex(T.TICKER_ROW_PX * 3 + 28, 12), 4);
  assert.equal(T.settledIndex(99999, 12), 11);
  assert.equal(T.settledIndex(-50, 12), 0);
});

test('(4) the pop: under its button, flipped up with no room, never taller than the screen; the phone sheet is capped and scrolls inside', () => {
  const viewport = { width: 1280, height: 720 };
  const pop = { width: 286, height: 300 };
  const under = T.placeTickerPop({ button: { top: 100, bottom: 140, left: 200, right: 288 }, pop, viewport });
  assert.deepEqual({ top: under.top, left: under.left }, { top: 146, left: 200 });
  // No room below: it goes above, wholly on screen.
  const up = T.placeTickerPop({ button: { top: 600, bottom: 640, left: 200, right: 288 }, pop, viewport });
  assert.equal(up.top, 600 - 6 - 300);
  // At the right edge it is pulled back inside; `end` lines its right edge up with the button's.
  assert.equal(T.placeTickerPop({ button: { top: 100, bottom: 140, left: 1200, right: 1270 }, pop, viewport }).left, 1280 - 8 - 286);
  assert.equal(T.placeTickerPop({ button: { top: 100, bottom: 140, left: 900, right: 1000 }, pop, viewport, align: 'end' }).left, 1000 - 286);
  // A pop taller than the screen is CAPPED to it (and scrolls inside) — on a short window too.
  const short = { width: 800, height: 260 };
  const tall = T.placeTickerPop({ button: { top: 100, bottom: 140, left: 20, right: 108 }, pop: { width: 286, height: 900 }, viewport: short });
  assert.equal(tall.maxHeight, 260 - 16);
  assert.ok(tall.top >= 8 && tall.top + tall.maxHeight <= short.height - 8 + 0.001, 'the pop leaves the screen');
  const src = read(TICKER);
  // The desktop panel wears the placement's cap and scrolls inside itself.
  assert.match(src, /maxHeight: at\?\.maxHeight/);
  assert.match(src, /data-ticker-pop=""[\s\S]{0,400}overflow-y-auto/);
  // The phone sheet: a gap stays at the top, long content scrolls inside, the dark part closes it.
  assert.match(src, /max-h-\[calc\(100dvh-24px\)\][^"']*overflow-y-auto/);
  assert.match(src, /data-ticker-scrim=""\s+onClick=\{onClose\}/);
  assert.match(src, /bg-ink\/40 backdrop-blur-sm/, 'the rest of the screen is not darkened and blurred');
  // The phone line is the app's one line (1024), and a handed-in sheet wins over this file's own.
  assert.equal(T.TICKER_SHEET_BELOW_PX, 1024);
  assert.match(src, /asSheet\s*\?\s*sheet\s*\?\s*sheet\(\{ label: title, onClose: close/);
  // Whoever rolled it is told ONCE when it closes — the one moment a write is owed.
  assert.match(src, /if \(was\.current && !open\) closed\.current\?\.\(\)/);
});

test('(5) the row, rendered: when · name · trailing — and open, the field takes the whole row with ONLY ✕', async () => {
  const { TimelineRow } = await import('../app/_components/timeline-row');
  const when = React.createElement('span', { 'data-when': '' }, '3:00 PM');
  const trailing = React.createElement('span', { 'data-trailing': '' }, '⋯');
  const base = { when, trailing, name: 'Ceremony', placeholder: 'Name this moment', nameLabel: 'Name of this moment', as: 'div' as const };
  const closed = await paint(React.createElement(TimelineRow, base));
  // In order: the when, the name (a button), the trailing slot.
  const at = (s: string) => closed.indexOf(s);
  assert.ok(at('data-when') > -1 && at('data-when') < at('data-timeline-name=""') && at('data-timeline-name=""') < at('data-trailing'));
  assert.match(closed, /<button[^>]*data-timeline-name=""[^>]*><span[^>]*>Ceremony</);
  // THE NAME MAY RUN TO A SECOND LINE, never a third, and its type is not shrunk to fit (owner's review at 375 px:
  // "Entourage ph…" — the name is the point of the row).
  const nameBtn = /<button[^>]*data-timeline-name=""[^>]*>(<span[^>]*>)/.exec(closed)!;
  assert.match(nameBtn[1]!, /class="[^"]*\bline-clamp-2\b[^"]*\bbreak-words\b/, 'a long name cannot wrap to a second line');
  assert.doesNotMatch(nameBtn[0]!, /\btruncate\b|whitespace-nowrap|line-clamp-1\b/, 'the name is cut to one line');
  assert.match(nameBtn[0]!, /text-\[15px\]/, 'the name’s type was shrunk');
  assert.match(nameBtn[0]!, /\bmin-h-11\b/, 'the name is under a 44-px target');
  assert.match(closed, /class="flex min-h-\[58px\] items-center /, 'the when is not centred beside a two-line name');
  assert.doesNotMatch(closed, /<input/);
  // Not named yet: the placeholder, quieter.
  const unnamed = await paint(React.createElement(TimelineRow, { ...base, name: '' }));
  assert.match(unnamed, /data-timeline-name=""[^>]*text-ink\/45[^>]*><span[^>]*>Name this moment</);
  // View only: words, nothing to press.
  const view = await paint(React.createElement(TimelineRow, { ...base, canEdit: false }));
  assert.doesNotMatch(view, /<button[^>]*data-timeline-name/);
  // OPEN: the field is alone on the row — the when and the trailing slot have stepped aside.
  const open = await paint(React.createElement(TimelineRow, { ...base, editing: true }));
  assert.match(open, /data-timeline-row-editing=""/);
  assert.match(open, /<input[^>]*aria-label="Name of this moment"[^>]*value="Ceremony"|<input[^>]*value="Ceremony"[^>]*aria-label="Name of this moment"/);
  assert.doesNotMatch(open, /data-when|data-trailing/);
  // ONLY ✕: one button in the open row, and it is "as it was". No ✓, no Save.
  assert.equal(count(open, /<button/g), 1);
  assert.match(open, /<button[^>]*aria-label="Leave it as it was"/);
  assert.doesNotMatch(open, /Save|Keep|lucide-check/);
  // The one amber line and the one problem line.
  const noted = await paint(React.createElement(TimelineRow, { ...base, note: 'Starts before Ceremony ends (4:00 PM).', problem: 'That change did not save.' }));
  assert.match(noted, /data-timeline-note=""[^>]*text-warn-700[^>]*>Starts before Ceremony ends \(4:00 PM\)\.</);
  assert.match(noted, /role="alert"[^>]*data-timeline-problem=""[^>]*>That change did not save\.</);
  // Tap out keeps, Enter keeps, ✕ and Esc leave — and ✕ is decided BEFORE the blur that follows it.
  const src = read(ROW);
  assert.match(src, /onBlur=\{\(\) => end\(true\)\}/);
  assert.match(src, /e\.key === 'Enter'[\s\S]{0,80}end\(true\)/);
  assert.match(src, /e\.key === 'Escape'[\s\S]{0,120}end\(false\)/);
  assert.match(src, /onPointerDown=\{\(e\) => \{\s*e\.preventDefault\(\);\s*end\(false\);/);
  assert.match(src, /if \(done\.current\) return;/, 'a ✕ could also be read as the tap-out that keeps');
});

test('(6) the watch: the shared pieces are neutral and write no accent of their own', () => {
  for (const rel of [TICKER, ROW, 'lib/timeline.ts']) {
    const src = read(rel);
    // Neutral: nothing of the Maker's, the Schedule's or the Love Story's.
    assert.doesNotMatch(src, /from ['"][^'"]*(dashboard|launch|maker|schedule|love-story|our-story)[^'"]*['"]/i, `${rel} imports a surface`);
    // No colour written by hand: no hex, no rgb() of its own (a shadow's ink is not an accent), no brand colour name.
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `${rel} holds a hex colour`);
    assert.doesNotMatch(src, /\b(?:bg|text|ring|border|fill|stroke|from|to|via|outline|decoration)-(?:terracotta|gild|gold|wine|rose|red|orange|amber|emerald|green|blue)\b/, `${rel} names a colour`);
  }
  // THE ACCENT, LISTED — until the accent token lands, exactly these `mulberry` uses and no others (the fill and its
  // words come from the pill selector's `PILL_ON_CLASS`). A new one must be added HERE, on purpose.
  const accent = (rel: string) => [...read(rel).matchAll(/[\w:-]*mulberry[\w/-]*/g)].map((m) => m[0]).sort();
  assert.deepEqual(accent(TICKER), ['aria-expanded:ring-mulberry', 'text-mulberry']);
  assert.deepEqual(accent(ROW), []);
  assert.match(read(TICKER), /rounded-full text-\[15px\] font-semibold \$\{PILL_ON_CLASS\}/, 'Done is not the one "on" fill');
  // The ticker joins ONE-OPEN-AT-A-TIME, and its precision is the house pill selector — not a hand-made one.
  assert.match(read(TICKER), /useOneOpen\(open, setOpen\)/);
  assert.match(read(TICKER), /<PillSelector<WhenPrecision>/);
});
