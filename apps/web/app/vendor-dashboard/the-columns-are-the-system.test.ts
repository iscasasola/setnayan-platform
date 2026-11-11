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
    🖥 v13 (owner "Approved.", 2026-10-29): the working Today gives up the 48-rem cap from 701 (`tab:max-w-none`), as
    Customers › People does. Every other render path (the team member's landing, the unavailable page) still reads.
    (Its two columns — the opened row on the right — left with the open-in-place rows, THE ONE BUILD 8 Nov.)
  */
  const wide = cols.filter((c) => /\btab:max-w-none\b/.test(c));
  assert.equal(wide.length, 1, `exactly the working Today fills the frame — found ${wide.length}: ${wide.join(' | ')}`);
  for (const c of cols.filter((x) => !wide.includes(x))) assert.match(c, /\btab:max-w-3xl\b/, `a Today side path is not the reading column: "${c}"`);
  // ⤴ THE ONE BUILD A5/A7: the counts row and its open-in-place right column are retired (rows jump now), so Today is
  // one column that fills the frame from 701 — still exactly one wide render path.
  // The first screen kept its phone 36 rem below 701 and gives it up from 701, so the measure IS the column.
  assert.match(
    read('_components/supplier-today-first-screen.tsx'),
    /<section data-today-first-screen aria-label="Today" className="mx-auto flex w-full max-w-xl tab:max-w-none flex-col">/,
  );
});

test('Shop reads — Services (with its Analytics carousel) and Page', () => {
  for (const c of columns(read('shop/page.tsx'))) assert.match(c, /\btab:max-w-3xl\b|^mx-auto w-full max-w-3xl\b/, `Shop › Services: "${c}"`);
  // 🎠 How it is going is the Shop tab's own Analytics carousel since 11 Nov 2026 — it sits in the Shop column above,
  // and the carousel draws no column of its own.
  assert.doesNotMatch(read('performance/_components/analytics-carousel.tsx'), /mx-auto w-full|max-w-6xl/, 'the carousel runs a column of its own inside the Shop column');
  assert.match(read('website/page.tsx'), /className="mx-auto w-full max-w-3xl /, 'Shop › Page is not the reading column');
  // The Manpower fold left Shop (owner 2026-11-09, Lane E: "Remove manpower gigs") — Shop has no folds to measure.
  assert.doesNotMatch(read('shop/page.tsx'), /<FeatureAccordion\b/);
});

test('Hub — its side paths read; the Hub itself fills the frame with its two columns', () => {
  const cols = columns(read('on-the-day/page.tsx'));
  assert.ok(cols.length >= 2, `read ${cols.length} Hub side-path columns (the day-of tools ended · no events yet)`);
  for (const c of cols) assert.match(c, /\btab:max-w-3xl\b|^mx-auto w-full max-w-3xl\b/, `a Hub side path is not the reading column: "${c}"`);
  /*
    🖥 v13 (owner "Approved.", 2026-10-29): Hub = set up one event — the segment's body left, the event card with "Open the
    Event Hub" right (prototype `renderHub`: `setList(body); setPane(openEh)`), so its column gives up the 48-rem cap
    from 701 (`tab:max-w-none`), as the working Today and Customers › People do.
  */
  const screen = read('on-the-day/_components/hub-screen.tsx');
  const hub = columns(screen);
  assert.equal(hub.length, 1, 'the Hub screen has one outermost column');
  assert.match(hub[0]!, /\btab:max-w-none\b/, 'the Hub does not fill the frame from 701');
  assert.match(screen, /<SupplierColumns\s+name="hub"/, 'the Hub lost its two columns');
});

test('Customers — Events and Dates are the wide stage, Money reads, and the folds below take the same measure', () => {
  const src = read('customers/page.tsx');
  // 2026-10-29 (owner, "remember to always maximize the screen use"): People takes the whole width from a tablet up
  // (list + side panel at lg); Dates keeps the wide stage, Money the reading column.
  // 2026-10-30: the first view is Events (People until then — "Customers are events, not people").
  // Build 2 #43: Events and Dates are ONE Clients screen — it takes the full width; only a Dates DAY page keeps the wide
  // stage (64 rem), Money the reading column.
  const col = /className=\{`mx-auto w-full max-w-3xl [^`]*\$\{seg === 'money' \? 'tab:max-w-3xl' : search\.day \? 'tab:max-w-5xl' : 'tab:max-w-none'\}`\}/.exec(src);
  assert.ok(col, 'the Customers column no longer picks 48 rem for Money, 64 rem for a Dates day and the full width for Clients');
  assert.doesNotMatch(col![0], /\blg:max-w-/, 'a second (lg) cap fights the system measure');
  assert.match(src, /<FeatureAccordion sections=\{sections\} openKey=\{open\} measure=\{seg === 'money' \? 'reading' : 'wide'\}>/);
  const acc = read('_components/feature-accordion.tsx');
  assert.match(acc, /reading: 'mx-auto w-full max-w-6xl tab:max-w-3xl /);
  assert.match(acc, /wide: 'mx-auto w-full max-w-6xl tab:max-w-5xl /);
  assert.match(acc, /<div className=\{MEASURE\[measure\]\}>/);
});
