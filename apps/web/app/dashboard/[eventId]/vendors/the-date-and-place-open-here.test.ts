/**
 * the-date-and-place-open-here.test.ts — PR5: the date · place line's two values open their sheets ON the Suppliers
 * page, and every rule the owner set for them holds in the source (rulings 2026-10-10 answers 7–10; the 2026-10-13
 * audit of the prototype's look).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));
const line = code('vendors', '_components', 'date-place-line.tsx');
const factLine = code('vendors', '_components', 'fact-line.tsx');
const sheets = code('vendors', '_components', 'fact-sheets.tsx');
const action = code('vendors', '_actions', 'fact-sheet.ts');
const page = code('vendors', 'page.tsx');

test('the line opens the sheets here — no link away to Event Details', () => {
  assert.match(line, /<FactLine\b/);
  assert.doesNotMatch(line, /recordFieldHref|<Link\b/, 'the values are not links out any more');
  assert.match(factLine, /data-fact="date"[\s\S]*?data-fact="place"/);
  assert.match(factLine, /aria-haspopup="dialog"/);
  const build = code('vendors', '_components', 'build-body.tsx');
  const fit = build.slice(build.indexOf('function FitLine'));
  assert.match(fit, /openSuppliersFactSheet\('date', hasDay\)/, "Build's Help me choose opens the same sheet");
  assert.doesNotMatch(fit.slice(0, 2000), /recordFieldHref/);
});

test('the sheets load when opened — the page’s first paint carries only the line', () => {
  assert.match(factLine, /dynamic\(\(\) => import\('\.\/fact-sheets'\)/);
  assert.doesNotMatch(factLine, /from '\.\/fact-sheets'/, 'no static import of the sheet');
  assert.doesNotMatch(page, /openFactSheet\(/, 'the page never runs the sheet’s read');
});

test('answer 7 — every write is the one draft door (or the date-change request); nothing writes past Apply', () => {
  const intents = [...sheets.matchAll(/fd\.set\('intent', '([a-z_]+)'\)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(intents)].sort(), ['date_change', 'save']);
  assert.match(sheets, /hubDraftAction\(eventId, fd\)/);
  for (const banned of ['updateEventDate', 'addManualSupplier', 'saveVendorToPicks', "from('events')", 'event_vendors']) {
    assert.ok(!sheets.includes(banned), `the sheets never call ${banned}`);
  }
  assert.doesNotMatch(action, /\.(insert|update|upsert|delete)\(/, 'the sheet’s read writes nothing');
  assert.match(action, /viewer\.isCouple/);
  assert.match(action, /surfaceEnabled\(profile, 'website'\)/);
});

test('answer 9 — a place typed by hand is its name and pin for guests; it never becomes a supplier', () => {
  const place = sheets.slice(sheets.indexOf('function PlaceBody'));
  assert.match(place, /<AddressPinField\b/, 'the pin is the shipped map pin field (kind 25)');
  assert.match(place, /s\.columns\.name\]: s\.typed/);
  assert.match(place, /venue_map: \{ venue:/);
  assert.match(sheets, /it is not added to your suppliers/);
});

test('answer 8 — Help me choose offers only days every PRICED pick can take, read through the calendar truth', () => {
  assert.match(action, /daysFreeForPricedPicks\(m\.dates, priced\)/);
  assert.match(action, /fittingDates\(/, 'and every booked supplier can do');
  assert.match(action, /truth: \(days, ids\) => readCalendarTruth\(/);
  assert.match(action, /\.filter\(\(id\) => own\.has\(id\)\)/, 'the priced ids are checked to be this event’s own');
  assert.match(page, /priced=\{pricedPickIds\}/);
});

test('answer 10 — an open date change shows on the line and in the sheet, with Withdraw', () => {
  assert.match(page, /readOpenDateChange\(supabase, eventId\)/);
  assert.match(page, /changeAsked=\{openDateChange\.ok && openDateChange\.view != null\}/);
  assert.match(factLine, /data-fact-change-asked/);
  assert.match(sheets, /data-date-change-asked/);
  assert.match(sheets, /fd\.set\('action', 'withdraw'\)/);
});

test('the page plans on the drafted date; bookings keep the live row', () => {
  assert.match(page, /const ev = \(eventCtx\.data as EventBudgetRow \| null\) \?\? null;/, '`ev` stays the live row');
  assert.match(page, /const draftedDate = draftedEventDate\(ev, hubDraft\)/);
  assert.match(page, /suppliersDateFact\(planDate, planPrecision\)/);
  assert.match(page, /planDate && planPrecision === 'day'/, 'the bench fit follows the drafted day');
});

test('the 2026-10-13 look audit: two-value choices are pills, the picked day is terracotta, the clash yes is not ink', () => {
  assert.match(sheets, /<PillSelector[\s\S]{0,120}data="date-mode"/);
  assert.match(sheets, /<PillSelector[\s\S]{0,160}data="venue-source"/);
  assert.doesNotMatch(sheets, /<PickMenu[\s\S]{0,200}(I have a date|Enter your own)/, 'no dropdown for an either-or');
  const cand = sheets.slice(sheets.indexOf('data-find-date-candidate'), sheets.indexOf('data-find-date-candidate') + 600);
  assert.match(cand, /ring-sn-accent/);
  assert.doesNotMatch(cand, /ring-ink/);
  const clash = code('launch', '_components', 'details-date-clash.tsx');
  assert.doesNotMatch(clash, /bg-ink\b/, 'the clash note’s yes is the accent');
  const ladder = sheets.slice(sheets.indexOf('function Ladder'), sheets.indexOf('const SECTION_HEAD'));
  assert.doesNotMatch(ladder, /rounded-(md|lg|xl)|bg-ink\/\[0\.0/, 'the read-only ladder is divider rows, never a box');
});

test('Find shows only what can be booked on the date (2026-10-10 search ruling)', () => {
  assert.match(code('vendors', 'categories', 'page.tsx'), /searchCategoryVendors\(\{[\s\S]{0,400}hideUnbookable: true/);
});
