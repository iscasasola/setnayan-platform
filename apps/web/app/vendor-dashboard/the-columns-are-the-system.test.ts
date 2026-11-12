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
 * (`xl:max-w-7xl` · `2xl:max-w-screen-2xl`) may not come back on any page of the supplier dashboard (lane 5, 2026-11-12).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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

/*
  🖥 Lane 5 (2026-11-12 · owner 2026-11-13 "carry the phone design up", v13 "always maximize the screen use"): the
  secondary pages (Bookings · Proposals · Recommendations · Manpower · How clients pay · Disputes · Track record ·
  Partnerships · Attributes · Mood boards · Creators · Repertoire · a contract · the client's sub-pages · the loading
  skeleton) left the slab for the system's measures. No file anywhere under the supplier dashboard may bring it back.
*/
function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) out.push(p);
  }
  return out;
}

test('no file under the supplier dashboard runs the old slab (xl:max-w-7xl · 2xl:max-w-screen-2xl)', () => {
  const files = walk(HERE);
  assert.ok(files.length > 100, `walked ${files.length} files — the walk reads nothing`);
  const offenders = files.filter((f) => /\bxl:max-w-7xl\b|\b2xl:max-w-screen-2xl\b/.test(stripComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(offenders.map((f) => relative(HERE, f)), [], 'a supplier page runs its own slab on a desk again');
});

const READING = [
  'bookings/surface.tsx',
  'proposals/surface.tsx',
  'recommendations/_panel.tsx',
  'manpower/surface.tsx',
  'payment-options/surface.tsx',
  'disputes/page.tsx',
  'track-record/page.tsx',
  'partnerships/page.tsx',
  'attributes/page.tsx',
  'moodboard-library/page.tsx',
  'creators/page.tsx',
  'repertoire/page.tsx',
  'contracts/[contractId]/page.tsx',
  'clients/[eventId]/cocktail/page.tsx',
  'clients/[eventId]/editorial-media/page.tsx',
  'loading.tsx',
];
const WIDE = ['clients/[eventId]/seat-plan/page.tsx', 'clients/[eventId]/production-sheet/page.tsx', 'services/[serviceId]/page.tsx'];

test('the secondary pages read (48 rem); the seat plan, the production sheet and the maker take the wide stage (64 rem)', () => {
  for (const [list, cap] of [[READING, 'tab:max-w-3xl'], [WIDE, 'tab:max-w-5xl']] as const) {
    for (const rel of list) {
      // Every class string that opens a column — a `className="…"` or a branch of a ternary ('…').
      const cols = [...read(rel).matchAll(/["'`](mx-auto w-full [^"'`]*)/g)].map((m) => m[1]!);
      assert.ok(cols.length >= 1, `${rel}: no outermost column found — the guard reads nothing`);
      for (const c of cols) {
        // A narrower note column (an empty or gated state at 42 rem or less) already sits inside the measure.
        const narrower = /^mx-auto w-full max-w-(?:sm|md|lg|xl|2xl)\b/.test(c) && !/\btab:max-w-/.test(c);
        assert.ok(c.split(/\s+/).includes(cap) || narrower, `${rel}: "${c}" is not the ${cap} column`);
        assert.doesNotMatch(c, /(^|\s)(lg|xl|2xl):max-w-/, `${rel}: a second cap fights the system measure`);
      }
    }
  }
});

test('a client’s "Your next move" is the right column from 701 and stays in the list on a phone — never desk-only', () => {
  const src = read('clients/[eventId]/page.tsx');
  const d = src.slice(src.indexOf('const detailsShipped = ('), src.indexOf('const bodies = pickedPageBodies('));
  assert.match(d, /<SupplierColumns\s+name="client-details"/, 'Details lost its two columns');
  assert.match(d, /pane=\{<div className="tab:pl-4">\{nextMoveCard\}<\/div>\}/, 'the next move is not the right column');
  assert.match(d, /<div className="tab:hidden" data-next-move-phone="">\s*\{nextMoveCard\}/, 'the phone lost its copy of the next move');
  assert.doesNotMatch(src, /hidden lg:block/, 'something on the client page exists only on a desk again');
});

test('the editors split on the frame’s line (701), never md:', () => {
  for (const rel of ['packages/_components/package-editor.tsx', 'services/_components/canvas-maker.tsx', 'shop/_components/verify-pairs.tsx']) {
    const src = read(rel);
    assert.doesNotMatch(src, /\bmd:/, `${rel}: an editor column still turns on at 768, not on the frame's line`);
    assert.match(src, /\btab:grid-cols-/, `${rel}: the editor's side column is gone`);
  }
});

test('Creators is rows — the phone’s row carried up, never a table', () => {
  const src = read('creators/page.tsx');
  assert.doesNotMatch(src, /<table\b|<tr\b|<td\b/, 'Creators drew a table again');
  assert.match(src, /<ul className="space-y-3" data-creator-roi="">/);
  assert.match(src, /function RoiRow[\s\S]*?<li className="sn-row p-4">/);
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
