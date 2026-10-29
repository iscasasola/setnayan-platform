/**
 * GUARD — the supplier dashboard's pages sit in the system's two columns, one per tab.
 *
 * Owner 2026-10-22/23 — area 3 of "DESKTOP COVERS THE WHOLE APP" · prototype `desktop_layouts_2026-10-22.html`
 * family 2: *"the same shell as the couple's … one body width per tab instead of four"* — every page used to pick its
 * own measure (Today 36 rem, Shop › Services and Hub a 72–96 rem slab, Customers 56 rem). The table there:
 *
 *   Today · Customers › Money · Shop (Services · Page · How it is going) · Hub   → the reading column, 48 rem
 *   Customers › People · Customers › Dates                                       → the wide stage, 64 rem
 *
 * Reading = `max-w-3xl`, wide = `max-w-5xl` — area 2's two (`app/dashboard/[eventId]/the-columns-are-the-system.test.ts`).
 * From 701 only (`tab:`) — below it every page is exactly what shipped (the phone does not move).
 *
 * Each page's OUTERMOST column is read and its cap compared with the page's kind, and the old slab caps
 * (`xl:max-w-7xl` · `2xl:max-w-screen-2xl`) may not come back on any of the four tabs' pages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

/** Every `className` on an element that opens with `mx-auto w-full` — the pages' outermost columns. */
function columns(src: string): string[] {
  return [...src.matchAll(/className=(?:"|\{`)(mx-auto w-full [^"`]*)/g)].map((m) => m[1]!);
}

const TAB_PAGES = [
  'page.tsx', //                    Today (every render path)
  'shop/page.tsx', //               Shop › Services
  'performance/page.tsx', //        Shop › How it is going
  'website/page.tsx', //            Shop › Page
  'on-the-day/page.tsx', //         Hub
  'customers/page.tsx', //          Customers › People · Dates · Money
  '_components/feature-accordion.tsx',
];

test('no page of the four tabs keeps a slab of its own (xl:max-w-7xl · 2xl:max-w-screen-2xl)', () => {
  for (const rel of TAB_PAGES) {
    const src = read(rel);
    assert.ok(columns(src).length >= 1 || /MEASURE/.test(src), `${rel}: no outermost column found — the guard reads nothing`);
    assert.doesNotMatch(src, /\bxl:max-w-7xl\b|\b2xl:max-w-screen-2xl\b/, `${rel}: a page still runs its own slab on a desk`);
  }
});

test('Today reads — every side path is the 48-rem column; the working Today fills the frame with its two columns', () => {
  const cols = columns(read('page.tsx'));
  assert.ok(cols.length >= 4, `read ${cols.length} Today columns — the four render paths each carry one`);
  /*
    🖥 v13 (owner "Approved.", 2026-10-29): the working Today is the TWO COLUMNS from 701 — the lists left, the opened row
    right (`SupplierOpenScope` in `TodayCounts`) — so its one column gives up the 48-rem cap there (`tab:max-w-none`), as
    Customers › People does. Every other render path (the team member's landing, the unavailable page) still reads.
  */
  const wide = cols.filter((c) => /\btab:max-w-none\b/.test(c));
  assert.equal(wide.length, 1, `exactly the working Today fills the frame — found ${wide.length}: ${wide.join(' | ')}`);
  for (const c of cols.filter((x) => !wide.includes(x))) assert.match(c, /\btab:max-w-3xl\b/, `a Today side path is not the reading column: "${c}"`);
  assert.match(read('_components/today-counts.tsx'), /<SupplierOpenScope name="today"/, 'the working Today lost its two columns');
  // The first screen kept its phone 36 rem below 701 and gives it up from 701, so the measure IS the column.
  assert.match(
    read('_components/supplier-today-first-screen.tsx'),
    /<section data-today-first-screen aria-label="Today" className="mx-auto flex w-full max-w-xl tab:max-w-none flex-col">/,
  );
});

test('Shop reads — Services, Page and How it is going', () => {
  for (const c of columns(read('shop/page.tsx'))) assert.match(c, /\btab:max-w-3xl\b|^mx-auto w-full max-w-3xl\b/, `Shop › Services: "${c}"`);
  const perf = read('performance/page.tsx');
  assert.match(perf, /<section className="mx-auto w-full max-w-6xl tab:max-w-3xl /, 'How it is going is not the reading column');
  assert.match(perf, /<div className="mx-auto w-full max-w-xl tab:max-w-none">/, 'its top block keeps a narrower measure of its own');
  assert.match(read('website/page.tsx'), /className="mx-auto w-full max-w-3xl /, 'Shop › Page is not the reading column');
  assert.match(read('shop/page.tsx'), /<FeatureAccordion sections=\{SHOP_SECTIONS\} openKey=\{open\} measure="reading">/);
});

test('Hub reads', () => {
  const cols = columns(read('on-the-day/page.tsx'));
  assert.ok(cols.length >= 3, `read ${cols.length} Hub columns`);
  for (const c of cols) assert.match(c, /\btab:max-w-3xl\b|^mx-auto w-full max-w-3xl\b/, `a Hub column is not the reading column: "${c}"`);
});

test('Customers — People and Dates are the wide stage, Money reads, and the folds below take the same measure', () => {
  const src = read('customers/page.tsx');
  // 2026-10-29 (owner, "remember to always maximize the screen use"): People takes the whole width from a tablet up
  // (list + side panel at lg); Dates keeps the wide stage, Money the reading column.
  const col = /className=\{`mx-auto w-full max-w-3xl [^`]*\$\{seg === 'money' \? 'tab:max-w-3xl' : seg === 'people' \? 'tab:max-w-none' : 'tab:max-w-5xl'\}`\}\s*data-customers-seg-open=\{seg\}/.exec(src);
  assert.ok(col, 'the Customers column no longer picks 48 rem for Money, 64 rem for Dates and the full width for People');
  assert.doesNotMatch(col![0], /\blg:max-w-/, 'a second (lg) cap fights the system measure');
  assert.match(src, /<FeatureAccordion sections=\{sections\} openKey=\{open\} measure=\{seg === 'money' \? 'reading' : 'wide'\}>/);
  const acc = read('_components/feature-accordion.tsx');
  assert.match(acc, /reading: 'mx-auto w-full max-w-6xl tab:max-w-3xl /);
  assert.match(acc, /wide: 'mx-auto w-full max-w-6xl tab:max-w-5xl /);
  assert.match(acc, /<div className=\{MEASURE\[measure\]\}>/);
});
