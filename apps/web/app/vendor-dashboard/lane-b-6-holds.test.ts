/**
 * GUARD — FINAL CHECK AREA 5 · LANE B 6 (drawing `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html`
 * § B4 · B5 · B6 · B12 · B17, approved by the owner 25 Nov).
 *
 *   B4  Today on a computer: the counts are a grid that fits (three, then two), shown once (no Opened · Asked · Booked
 *       copy under How is business), the Needs-you band at the rows' gutter, the stage bar's current step the supplier
 *       accent.
 *   B5  Deep Search: the status is the house chip (dot + word by token), no icon tile, no typed 10 px.
 *   B6  Settings › Help opens the shared Sheet in place; /vendor-dashboard/help forwards there with it open.
 *   B12 Toolkit: the Included shelves sit side by side (two at 768, three at 1280) at the body's width; on a phone the
 *       list fades behind the thumb row.
 *   B17 Fit check: the event choice is one dropdown (LinkPickMenu), no pill row, no bg-ink text-cream.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const web = join(import.meta.dirname, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(web, rel), 'utf8'));

test('B4 · Today: counts fit and show once; the band at the gutter; the accent step', () => {
  const stats = src('app/vendor-dashboard/_components/today-stats.tsx');
  assert.match(stats, /<ul className="flex snap-x gap-2 tab:grid tab:grid-cols-3">/, 'the counts are a cut-off row on a computer');
  assert.match(stats, /w-\[104px\][^"]*tab:w-full/, 'a count keeps its phone width in the grid');
  assert.doesNotMatch(stats, /TodayShopMinis|MINI_WORDS/, 'the second copy of the counts is back');
  const first = src('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.match(first, /'hc-k2 sticky top-0 z-\[5\] -mx-4 min-h-11 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0'/, 'the Needs-you band leaves the gutter on a computer');
  assert.match(src('app/vendor-dashboard/_components/today-v2.tsx'), /n === stage\.n \? 'rgb\(var\(--color-mulberry\)\)'/, 'the current stage is not the accent');
  assert.doesNotMatch(src('app/vendor-dashboard/_components/today-v2.tsx'), /194 78 37/);
});

test('B5 · Deep Search: the house chip, no icon tile', () => {
  const page = src('app/vendor-dashboard/deep-search/page.tsx');
  assert.match(page, /<ToolChip tone=\{status === 'complete' \? 'ok' : status === 'failed' \? 'no' : status === 'unread' \? 'wait' : 'quiet'\} data="deep-search-status">/);
  assert.doesNotMatch(page, /text-\[10px\]|bg-success-100|bg-danger-100|text-success-800|text-danger-800/, 'a numbered-palette pill is back');
  assert.doesNotMatch(page, /h-9 w-9/, 'the icon tile is back');
  assert.match(page, /<h2 className="flex items-center gap-2 text-base font-semibold text-ink">\s*<Search aria-hidden className="h-4 w-4/);
});

test('B6 · Help opens as the shared Sheet from Settings; the old address forwards with it open', () => {
  const sheet = src('app/vendor-dashboard/settings/_components/help-sheet.tsx');
  assert.match(sheet, /<Sheet open=\{open\} onClose=\{\(\) => setOpen\(false\)\} labelledById=\{headingId\}>/);
  assert.match(sheet, /SUPPLIER_HELP_ROWS\.map\(\(r\) => \(\s*<DatesRow key=\{r\.key\} data=\{`help-\$\{r\.key\}`\} title=\{r\.title\} line=\{r\.line\} href=\{r\.href\} \/>/);
  assert.match(sheet, /onOpen=\{\(\) => setOpen\(true\)\}/, 'the Help row still navigates away');
  assert.match(src('app/vendor-dashboard/settings/settings-view.tsx'), /<HelpSheetRow lead=\{ic\(CircleHelp\)\} initialOpen=\{helpOpen\} \/>/);
  assert.match(src('app/vendor-dashboard/settings/page.tsx'), /const helpOpen = \(await searchParams\)\?\.help === '1';/);
  assert.match(src('app/vendor-dashboard/help/page.tsx'), /redirect\('\/vendor-dashboard\/settings\?help=1'\);/);
});

test('B12 · Toolkit: shelves side by side at the body’s width; a fade behind the phone’s thumb row', () => {
  const page = src('app/vendor-dashboard/shop/store/page.tsx');
  assert.doesNotMatch(page, /<ToolPage/, 'the front is back in the reading column');
  assert.match(page, /<div className="mx-auto w-full px-4 pb-16 sm:px-6" data-tool-page="store"/);
  const front = src('app/vendor-dashboard/shop/store/_components/store-screens.tsx');
  assert.match(front, /<div className="tab:grid tab:grid-cols-2 tab:gap-x-4 lg:grid-cols-3" data-store-shelves="">\s*\{shelves\.map/);
  assert.match(front, /data-store-fade=""/);
  assert.match(front, /height: 'var\(--sn-thumb-clear\)'/, 'the fade is not the thumb row’s own clearance');
  assert.match(src('app/vendor-dashboard/shop/store/_components/store-views.tsx'), /tab:mx-0 tab:scroll-px-0 tab:px-0" data-store-list="">/, 'a shelf row bleeds into its neighbour');
});

test('B17 · Fit check: one dropdown for the event, by token', () => {
  const page = src('app/vendor/fit/[ref]/page.tsx');
  assert.match(page, /<LinkPickMenu\s+label="Your event"\s+value=\{activeEvent\?\.event_id \?\? null\}/);
  assert.match(page, /href: `\$\{nextPath\}\?event=\$\{encodeURIComponent\(e\.event_id\)\}`/, 'a choice no longer goes to its address');
  assert.doesNotMatch(page, /bg-ink text-cream/, 'the light-on-light picked pill is back');
});
