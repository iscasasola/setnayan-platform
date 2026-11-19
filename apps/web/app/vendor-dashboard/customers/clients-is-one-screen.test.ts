/**
 * 🔒 CLIENTS IS ONE SCREEN (Build 2 row #43, controller's diff of L2's shots against v113, 8 Nov 2026).
 *
 * v113 draws ONE Clients screen: "Clients · N booked · ₱X to collect · ⚙" → the month → the tiles as their own row →
 * Overdue / Unread → every client under its day ("SUN 8 NOV"); the thumb row is Search clients · ⇅ · ＋. Build 1 drew
 * two views ("Clients › Dates" / "Clients › Events") with the tiles squeezed onto the pinned row. Each test below names
 * one of the seven parts (a)–(g), so a regression says which part of the contract it broke.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dayHeadWords } from '@/lib/vendor-dates';
import { clientsChoiceOf, clientsChoiceParams, orderClients, DEFAULT_CLIENTS_GROUP, groupKeyOf } from './clients-show-sort';
import type { PipelineCustomer } from '@/lib/vendor-customer-pipeline';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');
const PAGE = read('page.tsx');
const PIN = read('_components', 'customers-pin.tsx');
const CAL = read('_components', 'customers-calendar.tsx');
/** The title branch only — from `if (title) {` to the old branch's own `return (` (never a fixed length, which reads into it). */
const TITLE_AT = PIN.indexOf('if (title) {');
const title = PIN.slice(TITLE_AT, PIN.indexOf('\n  return (', TITLE_AT));

test('(a) one screen: Events and Dates draw the same Clients screen, the month mounted on top by CustomersPin', () => {
  assert.doesNotMatch(PAGE, /function CustomersDates\b|<CustomersDates\b/, 'a second Dates view is back');
  assert.match(PAGE, /seg !== 'money' \? \([\s\S]{0,120}<CustomersPipeline search=\{search\} \/>/);
  assert.match(PIN, /<CustomersCalendar \{\.\.\.month\} oneScreen onPicked=\{onPicked\} after=\{rest\} \/>/);
  // The month draws no list of its own on the one screen — the clients' list is the list (never two lists of days).
  assert.match(CAL, /const allDays = picked \|\| !onClients \|\| oneScreen/);
  assert.match(CAL, /\) : oneScreen \? null : \(/, 'the month draws its own every-day list on the one screen');
});

test('(b) the pinned row reads "Clients · ⚙" flush under the bar — no ▾, no counts, no empty top (owner 19 Nov)', () => {
  assert.match(title, /data-customers-title=""[\s\S]{0,80}Clients/);
  assert.match(title, /<GearUp>\{gear\}<\/GearUp>/, 'the ⚙ left the row (or stopped moving up into the bar from 701)');
  assert.doesNotMatch(title, /<PickMenu\b/, 'the one screen grew a view picker again');
  // "Clients, cleaner" (DECISION_LOG 2026-11-19): the tiles say the two figures, so the row does not repeat them.
  assert.doesNotMatch(title, /title\.counts|data-customers-title-counts/, 'the counts are back beside "Clients"');
  assert.match(PAGE, /title=\{\{\}\}/);
  assert.doesNotMatch(PAGE, /const pinCounts\b/);
  // No empty band: the row has no vertical padding or gap of its own, the column no top padding / space-y on a phone,
  // and from 701 the row is not drawn (the app bar says "Clients ▾" and holds the ⚙).
  const row = /className="sticky top-0[^"]*"/.exec(title)?.[0] ?? '';
  assert.doesNotMatch(row, /\bpy-|\bpt-|\bmb-[2-9]/, 'the title row grew empty space again');
  assert.match(row, /\btab:hidden\b/, 'a computer draws "Clients" twice');
  assert.match(PAGE, /: 'pt-0 tab:pt-3'/, 'the Clients column pads its top on a phone again');
});

test('(c) the tiles are their own row under the month, never on the pinned row', () => {
  assert.doesNotMatch(title, /<PinDoors\b|\{doors\.map/, 'the tiles are back on the pinned row');
  assert.match(PIN, /data-customers-tiles=""/);
  // Clients, cleaner (19 Nov, Q3): Overdue and Unread are tiles in the ONE row; the one screen has no quick row.
  const row = PIN.slice(PIN.indexOf('  const tilesRow ='), PIN.indexOf('  // The lists wait hidden'));
  assert.match(row, /\{doors\.map\(\(d\) => tile\(d\)\)\}\s*\{\(quick \?\? \[\]\)\s*\.filter\(\(q\) => !q\.zero\)/, 'Overdue / Unread left the tiles row');
  assert.match(PIN, /const body = title \? \(\s*\/\/[^\n]*\n\s*tilesRow\s*\) :/, 'the one screen draws a quick row again');
  // The tiles head the screen, over the week — not under the month.
  assert.match(PIN, /\{body\}\s*<div id="calendar" className="scroll-mt-24">/, 'the tiles are not over the month');
});

test('(d) the thumb row is Search clients · ⇅ · ＋ — "Check a date" folded into the day bar', () => {
  assert.doesNotMatch(PAGE, /<CheckADate\b|from '\.\/_components\/check-a-date'/, 'Check a date is back on the thumb row');
  // The search box moved into its own part (Search or add, 19 Nov): the page draws it, the part names what it searches.
  assert.match(PAGE, /<ClientsSearch\b/, 'the thumb row lost its search');
  assert.match(read('_components', 'clients-search.tsx'), /placeholder="Search clients"/);
  assert.match(PAGE, /<ClientsShowSort\b/);
  assert.match(PAGE, /<OutsideClientAdd\b/);
});

test('(e) day headings read "Sun 8 Nov" (uppercased by CSS) on the list, the month rows and the picked day', () => {
  assert.equal(dayHeadWords('2026-11-08', '2026-11-08'), 'Sun 8 Nov');
  assert.equal(dayHeadWords('2027-01-02', '2026-11-08'), 'Sat 2 Jan 2027', 'another year must say its year');
  assert.match(read('_components', 'customers-roster.tsx'), /dayHeadWords\(head,/);
  assert.equal((CAL.match(/dayHeadWords\(/g) ?? []).length >= 2, true, 'the month’s day heads are not "Sun 8 Nov"');
  // The plain list IS day-headed (v113 GR.ev = 'Day'); the plain address carries no group param.
  assert.equal(DEFAULT_CLIENTS_GROUP, 'day');
  assert.equal(clientsChoiceOf({}).group, 'day');
  assert.deepEqual(clientsChoiceParams(clientsChoiceOf({})), []);
  // Coming days first (soonest on top), then "No date yet", then days gone by, newest first.
  const r = (eventId: string, eventDate: string | null) => ({ eventId, eventDate, title: eventId, lane: 'booked' }) as unknown as PipelineCustomer;
  const rows = [r('past-old', '2026-10-01'), r('nodate', null), r('soon', '2026-11-09'), r('past-new', '2026-11-01'), r('today', '2026-11-08')];
  const ctx = { serviceOf: () => null, seatsOf: () => [], meSeat: null, agent: false, lastActivity: () => null, today: '2026-11-08' };
  const ordered = orderClients(rows, clientsChoiceOf({}), ctx, groupKeyOf('day', ctx, () => ''));
  assert.deepEqual(ordered.map((x) => x.eventId), ['today', 'soon', 'nodate', 'past-new', 'past-old']);
});

test('(f) Details: the three numbers drawn inline, never boxed', () => {
  const ROW = read('..', 'clients', '[eventId]', '_components', 'details-numbers-row.tsx');
  assert.doesNotMatch(ROW, /bg-ink\/\[0\.0\d\]/, 'the numbers are tiles again');
  assert.match(ROW, /data-details-numbers-inline=""/);
});

test('(g) the Schedule month reads its asking marks in the SAME one request', () => {
  const ACT = read('actions.ts');
  const whole = ACT.slice(ACT.indexOf('try {'), ACT.indexOf('} catch'));
  const all = whole.slice(whole.indexOf('await Promise.all(['), whole.indexOf(']);'));
  assert.match(all, /fetchVendorThreadsDetailed\(/, 'the threads are read in a second round');
  assert.match(whole, /readOpenAsks\(/);
  assert.match(whole, /inquiries: asks && asks\.measured \? asksByDate\(asks\.asks\) : null/, 'an unread ask must stay unread (null), never "nobody asked"');
});
