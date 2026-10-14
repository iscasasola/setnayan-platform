/**
 * dates-is-one-calendar.test.ts — Customers › Dates (S-PR3): ONE calendar, its day states, its tools, its day — and
 * the shop's codes on ONE page.
 *
 * Record: corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 (Customers: "`#calendar` + `calendar/surface.tsx`
 * (second renderer …) — Merge into Customers › Dates: one month grid (booked · holding · blocked), the day's rows
 * under it, then three folds: Block days · Waitlist · Capacity"; "`/invite` + `/locked-qr` — Merge: one 'QR codes'
 * (Shortlist · Booked — one dropdown), ledger inside") · § 8 gap 11 (the day sheet at `?seg=dates&day=`) · prototype
 * frames 04 · 29 · 35 · 10 · 40 · control templates round 2 (owner "APPROVE ALL" 2026-10-12): kind 31 calendar day
 * states (answer 4: a blocked day = a hatched grey square), kind 24 QR card (answer 3: Share main, Download second),
 * kind 17 Counter · calendar truth (owner 2026-10-10, P5): "Not set", never "Free".
 *
 *   1 · KIND 31 ON THE SHARED GRID — dots (green Booked · amber Holding), a hatched square for a blocked day, a bold
 *       full day; the picked day stays the ONE circle; every mark has its word (the day's name and the legend).
 *   2 · THE DAY'S TRUTH, ONE SOURCE — `buildCustomerCalendarMonth` folded by `dayStateOf`; nothing on Dates counts a
 *       booking, and nothing draws a second grid.
 *   3 · NEVER "FREE" — a quiet day says "Nothing on this day"; a shop with no calendar says "Not set".
 *   4 · HOLDING IS REAL — read from `events` (admin, this shop's own threads), never the thread embed (always null
 *       for a supplier — the shipped month's "N asking" could never appear).
 *   5 · THE TOOLS COME BACK TO DATES — every Dates form posts `return_to=dates`, and the actions send it there.
 *   6 · ONE DAY — the old `/calendar/[date]` forwards to the day sheet; its Block switch is a real submit; opening a
 *       multi-day block asks first and names the days.
 *   7 · COUNTER (kind 17) — 44-px signs; the minus greys at the lowest; it saves itself after a pause.
 *   8 · ONE QR PAGE — one dropdown (Shortlist · free | Booked · one-use); the code is the QR card: dark on white,
 *       Share (main) before Download; `/locked-qr` is its Issued fold; the old surface and second card are gone.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { buildCustomerCalendarMonth } from '@/lib/vendor-customers';
import { asksByDate, capacityLine, dayAnswerOf, dayRowsOf, dayStateOf, openAsksOf } from '@/lib/vendor-dates';
import { dayStateWords } from '@/lib/calendar-grid';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const VD = join(HERE, '..');
const APP = join(VD, '..');
const WEB = join(APP, '..');
const code = (abs: string) => stripComments(readFileSync(abs, 'utf8'));
const PAGE = code(join(HERE, 'page.tsx'));
const MONTH = code(join(HERE, '_components', 'customers-calendar.tsx'));
const FOLDS = code(join(HERE, '_components', 'dates-folds.tsx'));
const SHEETS = code(join(HERE, '_components', 'dates-sheets.tsx'));
const DAY = code(join(HERE, '_components', 'day-sheet.tsx'));
const ACTIONS = code(join(VD, 'calendar', 'actions.ts'));
const RULES = code(join(WEB, 'lib', 'vendor-dates.ts'));
const h = React.createElement;
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

async function paint(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}

/** One function's body — from its name to the next top-level function. */
function body(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at > 0, `${name} is gone — the scan is blind`);
  const ends = [src.indexOf('\nfunction ', at + 10), src.indexOf('\nasync function ', at + 10), src.indexOf('\nexport default', at + 10)].filter((n) => n > 0);
  return src.slice(at, Math.min(...ends));
}

/* ── 1 · kind 31 on the shared grid ───────────────────────────────────── */

test('1 · the shared grid draws kind 31: dots, a hatched blocked square, a bold full day — the picked day stays the one circle', async () => {
  const { CalendarGrid, CalendarLegend } = await import('../../_components/calendar');
  const states = new Map([
    ['2026-10-03', { dots: ['booked' as const] }],
    ['2026-10-24', { dots: ['booked' as const, 'asking' as const], full: true }],
    // A booking from outside: its OWN grey dot (owner 2026-10-14); a morning not available: the top half hatched.
    ['2026-10-11', { dots: ['outside' as const], part: true }],
    // A closed day with a booking on it (an outside client taken before the closure): the hatch says it, no dot.
    ['2026-10-14', { blocked: true, dots: ['booked' as const] }],
    ['2026-10-15', { blocked: true }],
  ]);
  const html = await paint(h(CalendarGrid, { value: '2026-10-15', today: '2026-10-02', states, onPick: () => {} }));
  // A dot per meaning, coloured by the MEANING tokens (never a hex, never the accent for booked/asking).
  const three = /data-calendar-day="2026-10-03"[^>]*>3<span aria-hidden="true" data-calendar-dots=""[^>]*>(.*?)<\/span>/.exec(html)?.[1] ?? '';
  assert.match(three, /data-calendar-dot="booked"[^>]*style="background:rgb\(var\(--color-ok\)\)"/, 'Booked is not the green dot');
  const busy = /data-calendar-day="2026-10-24"[^>]*>24<span aria-hidden="true" data-calendar-dots=""[^>]*>(.*?)<\/span>/.exec(html)?.[1] ?? '';
  assert.equal(count(busy, /data-calendar-dot=/g), 2, 'two things on a day are not two dots');
  assert.match(busy, /data-calendar-dot="asking"[^>]*style="background:rgb\(var\(--color-warn\)\)"/, 'Asking is not the amber dot');
  const sunday = /data-calendar-day="2026-10-11"[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(sunday, /data-calendar-part=""/, 'a part-day block is not marked on its day');
  assert.match(sunday, /background-size:100% 50%/, 'a part-day block hatches the whole day — it must be the top half only');
  assert.match(html, /data-calendar-dot="outside"[^>]*style="background:rgb\(var\(--color-ink\) \/ 0\.45\)"/, 'a booking from outside lost its own grey dot');
  assert.match(html, /aria-label="October 11, 2026 — Outside and some hours not available"/);
  // Full = bold; its words say so.
  assert.match(html, /aria-label="October 24, 2026 — Booked here and Asking, full" data-calendar-day="2026-10-24" data-calendar-full=""[^>]*class="[^"]*font-bold/);
  // Not available = the hatched square with a grey number, no dots; said in words.
  assert.match(html, /aria-label="October 14, 2026 — not available" data-calendar-day="2026-10-14" data-calendar-blocked="" style="background-image:repeating-linear-gradient\(135deg, transparent 0 3px, rgb\(var\(--color-ink\) \/ 0\.16\) 3px 4px\)" class="[^"]*rounded text-ink\/45/);
  assert.doesNotMatch(/data-calendar-day="2026-10-14"[^]*?<\/button>/.exec(html)?.[0] ?? '', /data-calendar-dot/, 'a blocked day carries a dot');
  // The picked day — even a blocked one — is the ONE circle, in the "on" look, no hatch.
  assert.equal(count(html, /aria-pressed="true"/g), 1);
  const picked = /<button[^>]*aria-pressed="true"[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(picked, /rounded-full/);
  assert.doesNotMatch(picked, /background-image/, 'the picked day wears the hatch instead of the circle');
  // The legend (owner 2026-10-14 plain words): Booked here · Outside · Asking · Not available · Full.
  const legend = await paint(h(CalendarLegend, { dots: ['booked', 'outside', 'asking'], blocked: true, full: true }));
  for (const w of ['Booked here', 'Outside', 'Asking', 'Not available']) assert.match(legend, new RegExp(`</i>${w}</span>`), `the legend lost "${w}"`);
  assert.match(legend, /data-calendar-legend-full=""[^>]*><b[^>]*>12<\/b>Full</, 'the legend does not say what a bold day means');
  assert.doesNotMatch(legend, /Holding|Blocked/, 'the legend still says an old word');
  assert.equal(dayStateWords({ dots: ['asking', 'booked'] }), 'Booked here and Asking', 'the words do not follow the legend’s order');
});

/* ── 2 · one source for the day's truth ───────────────────────────────── */

test('2 · the month folds the ONE derivation — it counts nothing itself, and Dates draws no second grid', () => {
  assert.match(MONTH, /buildCustomerCalendarMonth\(/, 'the month stopped using the shared derivation');
  assert.match(MONTH, /dayStateOf\(d\)/, 'the month decides its own marks');
  assert.match(MONTH, /<CalendarGrid\b[\s\S]{0,200}states=\{states\}/, 'the month is not the shared grid');
  for (const src of [MONTH, FOLDS, DAY, PAGE]) {
    assert.doesNotMatch(src, /consumed\s*\+=|\.length\s*>=\s*p\.capacity/, 'a Dates file counts seats itself');
    assert.doesNotMatch(src, /grid-cols-7/, 'a second month grid is drawn on Dates');
  }
  assert.equal(existsSync(join(VD, 'calendar', 'surface.tsx')), false, 'calendar/surface.tsx (the second renderer) is back');
  assert.equal(existsSync(join(HERE, '_components', 'customers-filter-bar.tsx')), false, 'the filter bar is back — Dates has ONE dropdown');
  assert.match(MONTH, /<PickMenu label="Schedules"/, 'the month lost its ONE dropdown — "All schedules ▾"');
  assert.match(MONTH, /\{ key: 'all', label: 'All schedules' \}/, 'the dropdown does not say "All schedules"');
  assert.match(MONTH, /monthPicker=\{\(view, go\) => \(\s*<PickMenu\s+label="Month"/, 'the month is not a dropdown between ‹ and ›');
  // The pure fold, executed: blocked and held are blocked; a seat is booked; an ask or a waiter is holding.
  const base = { state: null, consumed: 0, inquiryCount: 0, waitlistCount: 0 } as const;
  assert.deepEqual(dayStateOf({ ...base, state: 'blocked', consumed: 1 }), { blocked: true });
  assert.deepEqual(dayStateOf({ ...base, state: 'locked' }), { blocked: true });
  assert.deepEqual(dayStateOf({ ...base, state: 'booked', consumed: 1 }), { dots: ['booked'] });
  assert.deepEqual(dayStateOf({ ...base, state: 'full', consumed: 2, inquiryCount: 1 }), { dots: ['booked', 'asking'], full: true });
  // An outside booking is its own grey dot; the waiting list is no longer amber (it has its own fold).
  assert.deepEqual(dayStateOf({ ...base, state: 'booked', consumed: 2, setnayanConsumed: 1 }), { dots: ['booked', 'outside'] });
  assert.deepEqual(dayStateOf({ ...base, state: 'booked', consumed: 1, setnayanConsumed: 0 }), { dots: ['outside'] });
  assert.equal(dayStateOf({ ...base, state: 'waitlist' }), null, 'the waiting list is drawn amber again');
  assert.deepEqual(dayStateOf({ ...base, partBlocked: true }), { part: true }, 'a morning not available draws nothing');
  assert.equal(dayStateOf({ ...base, state: 'whitelist' }), null, 'approve-first with nothing on it draws a mark');
  // …through the real builder: an outside client consumes a seat (booked), a closure blocks.
  const m = buildCustomerCalendarMonth(
    [{ poolId: 'p', label: 'Main', capacity: 1, categories: [], calendarName: null, isVendorCreated: false, serviceIds: [] }],
    [{ poolId: 'p', bookedDate: '2026-10-03', eventName: 'Reyes' }],
    [
      { poolId: 'p', source: 'external_client', startDate: '2026-10-17', endDate: '2026-10-17' },
      { poolId: null, source: 'manual', startDate: '2026-10-14', endDate: '2026-10-14' },
      // Every Monday, all day, from Sep 7 — a REPEAT closes October's Mondays; every Sunday morning leaves Sundays open.
      { poolId: null, source: 'manual', startDate: '2026-09-07', endDate: '2026-09-07', repeat: 'weekly', dayPart: 'all_day' },
      { poolId: null, source: 'manual', startDate: '2026-09-06', endDate: '2026-09-06', repeat: 'weekly', dayPart: 'morning' },
    ],
    [],
    [],
    '2026-10',
    '2026-10-02',
    [{ requestedDate: '2026-10-24', count: 2 }],
  );
  const st = (d: string) => dayStateOf(m.days.find((x) => x.date === d)!);
  assert.deepEqual(st('2026-10-03'), { dots: ['booked'], full: true });
  assert.deepEqual(st('2026-10-17'), { dots: ['outside'], full: true });
  assert.deepEqual(st('2026-10-14'), { blocked: true });
  assert.deepEqual(st('2026-10-24'), { dots: ['asking'] });
  assert.deepEqual(st('2026-10-05'), { blocked: true }, 'a weekly all-day block did not close a later Monday');
  assert.deepEqual(st('2026-10-11'), { part: true }, 'a weekly morning block did not mark a later Sunday — or closed it');
  assert.equal(st('2026-10-06'), null);
});

/* ── 3 · never "Free" ─────────────────────────────────────────────────── */

// Re-pointed 2026-10-14 (owner ✅ "APPROVE": the day's answer line "Free · Still has room · Full · Not available").
// P5 still holds where it bites: a shop with NO schedule is never told a day is free — it reads "Not set".
test('3 · "Free" only where a schedule says so; a shop with no schedule is "Not set" (owner P5, re-worded 2026-10-14)', () => {
  const rows = dayRowsOf('2026-10-05', { today: '2026-10-02', poolIds: new Set(['p']), poolLabel: () => 'Main', namePools: false, bookings: [], blocks: [], holds: [], asking: 0, waiting: 0 });
  assert.deepEqual(rows.map((r) => r.title), ['Nothing on this day']);
  assert.equal(capacityLine([]), 'Not set');
  assert.match(FOLDS, /data-dates-not-set=""[^>]*>\s*Not set\./, 'How many a day with no schedule does not say "Not set"');
  assert.match(PAGE, /Schedule not set/, 'Dates with no schedule does not say so over the month');
  // The answer: none without a schedule; then the four words, each where it is true.
  assert.equal(dayAnswerOf({ schedules: 0, capacity: 0, taken: 0, asking: 0, closedWhy: null, partWords: [] }), null, 'a shop with no schedule was told a day is free');
  assert.equal(dayAnswerOf({ schedules: 1, capacity: 1, taken: 0, asking: 0, closedWhy: null, partWords: [] })?.word, 'Free');
  assert.deepEqual(dayAnswerOf({ schedules: 1, capacity: 2, taken: 1, asking: 0, closedWhy: null, partWords: ['morning'] }), { tone: 'ok', word: 'Still has room', line: '1 booked · 1 more fits · morning not available' });
  assert.equal(dayAnswerOf({ schedules: 1, capacity: 1, taken: 1, asking: 0, closedWhy: null, partWords: [] })?.word, 'Full');
  assert.equal(dayAnswerOf({ schedules: 1, capacity: 1, taken: 1, asking: 0, closedWhy: 'Masses', partWords: [] })?.word, 'Not available');
  assert.match(DAY, /Schedule not set — open How many a day/, 'the day with no schedule does not say "Not set"');
  for (const [name, src] of [['customers-calendar', MONTH], ['dates-folds', FOLDS]] as const) {
    assert.doesNotMatch(src, /\bFree\b/, `${name} calls a day "Free" without the day's answer`);
  }
  // A busy day lists what is on it, each opening the day.
  const busy = dayRowsOf('2026-10-17', {
    today: '2026-10-02',
    poolIds: new Set(['p', 'q']),
    poolLabel: (id) => (id === 'p' ? 'Main team' : 'Second team'),
    namePools: true,
    bookings: [{ poolId: 'p', bookedDate: '2026-10-17', eventName: 'Reyes debut' }],
    blocks: [
      { poolId: 'q', source: 'external_client', startDate: '2026-10-17', endDate: '2026-10-17', clientName: 'Lopez' },
      { poolId: null, source: 'manual', startDate: '2026-10-16', endDate: '2026-10-18', label: 'Family trip' },
    ],
    holds: [{ poolId: 'q', stateDate: '2026-10-17', dayState: 'locked' }],
    asking: 2,
    waiting: 1,
  });
  assert.deepEqual(busy.map((r) => r.kind), ['booked', 'outside', 'blocked', 'held', 'asking', 'waiting']);
  assert.equal(busy[2]!.title, 'Not available');
  assert.equal(busy[2]!.line, 'Family trip · Oct 16–18 · every schedule');
  assert.match(MONTH, /href=\{daySheetHref\(picked\)\}/, 'the picked day’s rows do not open the day');
});

/* ── 4 · holding is real ──────────────────────────────────────────────── */

test('4 · Holding is read from events (admin, this shop’s threads) — never the thread embed, which is null for a supplier', () => {
  assert.doesNotMatch(PAGE, /pendingInquiryDates\(/, 'the month counts the always-null thread embed again');
  const read = body(PAGE, 'readOpenAsks');
  assert.match(read, /createAdminClient\(\)\.from\('events'\)\.select\('event_id, display_name, event_date'\)\.in\('event_id', part\)/);
  assert.match(read, /readInChunks\(/, 'one in.() over every thread is a URL the gateway refuses past ~600');
  assert.match(body(PAGE, 'CustomersDates'), /inquiries=\{asksByDate\(asks\)\}/, 'the month is not handed the holding counts');
  // Executed: open + dated + unbooked only; one per event; a count is all that crosses.
  const asks = openAsksOf(
    [
      { thread_id: 't1', event_id: 'e1', inquiry_status: 'pending', created_at: '2026-09-30T00:00:00Z' },
      { thread_id: 't1b', event_id: 'e1', inquiry_status: 'accepted', created_at: '2026-09-29T00:00:00Z' },
      { thread_id: 't2', event_id: 'e2', inquiry_status: 'accepted', created_at: '2026-10-01T00:00:00Z' },
      { thread_id: 't3', event_id: 'e3', inquiry_status: 'declined', created_at: '2026-10-01T00:00:00Z' },
      { thread_id: 't4', event_id: 'e4', inquiry_status: 'pending', created_at: '2026-10-01T00:00:00Z' },
      { thread_id: 't5', event_id: 'e5', inquiry_status: 'pending', created_at: '2026-10-01T00:00:00Z' },
    ],
    new Map([
      ['e1', { date: '2026-10-24', name: 'Dela Cruz' }],
      ['e2', { date: '2026-10-24T00:00:00+08:00', name: 'Santos' }],
      ['e3', { date: '2026-10-24', name: 'Declined' }],
      ['e4', { date: '2026-10-24', name: 'Booked' }],
      ['e5', { date: null, name: 'No date' }],
    ]),
    new Set(['e4']),
  );
  assert.deepEqual(asks.map((a) => a.name), ['Dela Cruz', 'Santos']);
  assert.deepEqual(asksByDate(asks), [{ requestedDate: '2026-10-24', count: 2 }]);
  assert.doesNotMatch(MONTH, /clientContact|clientNote|display_name/, 'a contact, a note or a couple’s name reaches the browser’s month');
});

/* ── 5 · the tools come back to Dates ─────────────────────────────────── */

test('5 · every Dates form posts the shipped action and comes back to Dates (and its fold, and its day)', () => {
  // EACH form, not a count over the file: the first lines inside every <form> / <ConfirmForm> say where to come back.
  let seen = 0;
  for (const [name, src] of [['dates-folds', FOLDS], ['dates-sheets', SHEETS], ['day-sheet', DAY]] as const) {
    const starts = [...src.matchAll(/<(?:form|ConfirmForm)\b/g)].map((m) => m.index ?? 0);
    starts.forEach((at, i) => {
      seen += 1;
      // From this form's opening to the next form's (or its close): its own fields, nobody else's.
      const end = Math.min(starts[i + 1] ?? Infinity, src.indexOf('</form>', at) > 0 ? src.indexOf('</form>', at) : Infinity, src.indexOf('</ConfirmForm>', at) > 0 ? src.indexOf('</ConfirmForm>', at) : Infinity);
      const own = src.slice(at, end);
      assert.match(own, /\{back(?:\('[a-z]+'\))?\}|<input type="hidden" name="return_to" value="dates" \/>/, `${name}: a form does not say it comes back to Dates — ${own.slice(0, 80)}`);
    });
  }
  assert.ok(seen >= 14, `only ${seen} Dates forms were found — the scan is blind`);
  assert.match(ACTIONS, /if \(returnTo === 'dates'\) \{[\s\S]{0,700}redirect\(`\/vendor-dashboard\/customers\?\$\{params\.toString\(\)\}`\)/, 'the actions do not bring a Dates form back to Dates');
  assert.match(ACTIONS, /new URLSearchParams\(\{ seg: 'dates' \}\)/);
  assert.match(ACTIONS, /\/\^\(block\|waitlist\|capacity\)\$\/\.test\(fold\)/, 'the fold an action came from is not the one open on return');
  for (const a of ['removeBlock', 'updateWaitlistSettings', 'pickWaitlistCouple', 'notifyWaitlistSlot', 'updatePoolCapacity', 'createCalendar', 'editCalendar', 'reassignCategoryPool']) {
    assert.match(PAGE, new RegExp(`const DATES_ACTIONS = \\{[\\s\\S]*\\b${a},`), `Dates is not handed the shipped ${a}`);
  }
  assert.match(PAGE, /<BlockDateAdd\b[\s\S]{0,160}action=\{addManualBlock\}/, 'Block a date does not post the shipped addManualBlock');
  // The waitlist switch posts the opposite of what it shows; the count form keeps the switch as it is.
  assert.match(FOLDS, /role="switch"\s+aria-checked=\{waitlist\.on\}[\s\S]{0,120}name="waitlist_enabled"\s+value=\{waitlist\.on \? '' : 'on'\}/);
  assert.match(FOLDS, /<input type="hidden" name="waitlist_enabled" value="on" \/>[\s\S]{0,600}<FormCounter name="max_waitlist_acceptances"/, 'saving the count would switch the waiting list off');
});

/* ── 6 · one day ──────────────────────────────────────────────────────── */

test('6 · the old day route forwards to the day; its Not available switch is a real submit; opening a long block or a repeat asks; Show a QR has the date', async () => {
  const old = code(join(VD, 'calendar', '[date]', 'page.tsx'));
  assert.match(old, /redirect\(`\$\{daySheetHref\(date\)\}/, '/calendar/[date] no longer lands on the day sheet');
  assert.doesNotMatch(old, /fetchVendor/, 'the old day route still reads and draws a second day');
  assert.match(PAGE, /<CustomersDay day=\{search\.day as string\}/);
  const { DaySheet } = await import('./_components/day-sheet');
  const act = async () => {};
  const base = {
    day: '2026-10-14',
    today: '2026-10-02',
    sub: '',
    backHref: '/x',
    answer: { tone: 'ok' as const, word: 'Free' as const, line: 'nothing on this day' },
    groups: [],
    holders: [],
    holdersMeasured: true,
    holdingCeiling: 5,
    waiting: 0,
    holds: [],
    whoWorks: null,
    qrHref: '/vendor-dashboard/invite?mode=locked&date=2026-10-14',
  };
  const actions = { addManualBlock: act, removeBlock: act, setCalendarDayState: act, notifyWaitlistSlot: act };
  const open = await paint(h(DaySheet, { data: { ...base, closures: [] }, actions }));
  assert.match(open, /<button type="submit" role="switch" aria-checked="false" aria-label="Not available"/, 'Not available is not a switch that submits');
  assert.match(open, /name="scope" value="org"[\s\S]{0,200}name="start_date" value="2026-10-14"[\s\S]{0,80}name="end_date" value="2026-10-14"/);
  assert.match(open, /data-dates-day-answer="Free"[^>]*><b[^>]*>Free<\/b> · nothing on this day/, 'the day does not answer first');
  assert.match(open, /href="\/vendor-dashboard\/invite\?mode=locked&amp;date=2026-10-14"/, 'Show a QR does not carry the date');
  const shut = await paint(
    h(DaySheet, { data: { ...base, closures: [{ blockId: 'b1', label: 'Family trip', startDate: '2026-10-14', endDate: '2026-10-15', scope: 'every schedule', repeatWords: '' }] }, actions }),
  );
  assert.match(shut, /role="switch" aria-checked="true" aria-label="Not available"/);
  assert.match(shut, /Family trip · Oct 14–15/);
  assert.match(DAY, /This opens the whole block — \$\{rangeWords/, 'opening a multi-day block does not say it opens them all');
  assert.match(DAY, /This removes “\$\{c\.repeatWords\}” — every one of those days opens again\./, 'opening a repeat does not say every day opens');
  assert.match(DAY, /Who works it/);
  assert.doesNotMatch(DAY, /<PickMenu|<select/, '"Who works it" is a dropdown with nothing to save');
  // "Holding this date · N of M" — the plan's ceiling is back (checklist X11 drift).
  const held = await paint(h(DaySheet, { data: { ...base, closures: [], holders: [{ threadId: 't1', title: 'Dela Cruz', line: 'asked Oct 1' }] }, actions }));
  assert.match(held, /Holding this date[\s\S]{0,200}1 of 5 · your plan’s ceiling/, 'the day lost "Holding this date · N of M"');
});

/* ── 7 · the counter ──────────────────────────────────────────────────── */

// Batch 5 join (2026-10-14): Dates posts through `FormCounter`, which draws the ONE kind-17 Counter (the seat plan's,
// `app/_components/counter.tsx`, held by `lib/the-counter-is-one-drawing.test.ts`) — same claims, one pill.
test('7 · the Counter (kind 17): 44-px signs, the minus greys at the lowest, it saves itself after a pause', async () => {
  const { FormCounter } = await import('../../_components/form-counter');
  const at1 = await paint(h(FormCounter, { name: 'capacity', value: 1, min: 1, max: 3, label: 'Events a day' }));
  assert.match(at1, /role="group" aria-label="Events a day"/);
  assert.match(at1, /<input type="hidden" name="capacity" value="1"\/>/);
  assert.match(at1, /aria-label="One less" disabled=""/, 'the minus is pressable at the lowest');
  assert.doesNotMatch(at1, /aria-label="One more" disabled=""/);
  for (const b of at1.match(/<button[^>]*>/g) ?? []) assert.match(b, /h-11 min-h-11 w-11/, 'a sign is under 44 px');
  const src = code(join(APP, '_components', 'form-counter.tsx'));
  assert.match(src, /import \{ Counter \} from '@\/app\/_components\/counter';/, 'the form counter draws its own pill instead of the one Counter');
  assert.match(src, /<Counter\b/);
  assert.match(src, /setTimeout\(\(\) => \{[\s\S]{0,160}\.requestSubmit\(\);\s*\}, saveAfterMs\)/, 'the counter does not save itself');
  assert.match(src, /if \(wait\.current\) clearTimeout\(wait\.current\);\s*wait\.current = setTimeout\(/, 'each tap does not restart the wait (1 → 3 would be two saves)');
  assert.match(FOLDS, /<FormCounter name="capacity"[^>]*saveAfterMs=\{900\}/, 'events a day is not the counter');
});

/* ── 8 · one QR page ──────────────────────────────────────────────────── */

test('8 · the shop’s codes are ONE page — one dropdown, the QR card (Share before Download, dark on white), the ledger inside', async () => {
  const page = code(join(VD, 'invite', 'page.tsx'));
  const view = code(join(VD, 'invite', '_components', 'qr-codes.tsx'));
  assert.match(page, /\{ key: 'shortlist', label: 'Shortlist · free'[\s\S]{0,120}\{ key: 'locked', label: 'Booked · one-use'/);
  assert.match(view, /<CustomersPick label="Which code"/, 'the two codes are not ONE dropdown');
  assert.doesNotMatch(view + page, /<PillTrack|role="tablist"/, 'the QR type is a pill track again');
  assert.match(code(join(VD, 'locked-qr', 'page.tsx')), /redirect\('\/vendor-dashboard\/invite\?mode=locked&ledger=1#issued'\)/, '/locked-qr does not land on the Issued fold');
  assert.match(view, /<Fold\s+title="Issued"/);
  assert.equal(existsSync(join(VD, '_components', 'qr-section.tsx')), false, 'the second QR card is back on Dates');
  assert.match(FOLDS, /title="QR codes"[\s\S]{0,80}href=\{qrHref\}/, 'Dates lost its QR codes row');
  const { QrCard } = await import('../../_components/qr-card');
  const html = await paint(h(QrCard, { svg: '<svg data-x=""></svg>', url: 'https://x.test/a', title: 'Lumina Studio', line: 'They scan', filename: 'q.svg' }));
  assert.ok(html.indexOf('data-qr-share') > 0 && html.indexOf('data-qr-share') < html.indexOf('data-qr-download'), 'Share is not before Download');
  assert.match(/<button[^>]*data-qr-share=""[^>]*>/.exec(html)?.[0] ?? '', /ab-brand ab-main/, 'Share is not the main button');
  assert.match(/<a[^>]*data-qr-download=""[^>]*>/.exec(html)?.[0] ?? '', /ab-neutral/, 'Download is not the second button');
  assert.match(/<button[^>]*data-qr-plate=""[^>]*>/.exec(html)?.[0] ?? '', /bg-white/, 'the code is not on a white plate');
  const used = await paint(h(QrCard, { svg: '<svg></svg>', url: 'u', title: 't', filename: 'q.svg', state: 'used', stamp: 'Used · Oct 1' }));
  assert.match(used, /Used · Oct 1/);
  assert.doesNotMatch(used, /data-qr-share/, 'a used code can still be shared');
  const none = await paint(h(QrCard, { svg: null, url: 'u', title: 't', filename: 'q.svg' }));
  assert.match(none, /Couldn&#x27;t make the code|Couldn’t make the code/, 'a missing code draws an empty square');
});
