/**
 * your-team-phone-first.test.ts — THE ORDER OF THE SUPPLIERS SCREEN.
 *
 * Re-pointed 2026-10-08 at the one-screen shell (owner 2026-10-07; corpus
 * `SUPPLIERS_HANDOFF_2026-10-07_fable.md` PR1; prototype
 * `prototypes/suppliers_page_2026-10-07_fable.html`). It used to hold the
 * 2026-10-01 phone order — team → Find a supplier → "Your planning" → a hidden
 * find area. That order is retired; what it protected is kept, restated:
 *
 *   (a) the screen is: the date · place line, then ONE segmented control —
 *       Find · Build · Booked — pinned together, then ONE body. Every shipped
 *       section still has a home (Find: the bench + the marketplace door ·
 *       Build: the picks + the saved builds · Booked: the team + the
 *       payments), so nothing is unreachable, and nothing is drawn twice;
 *       the five-row menu, the hidden find area and the second chat icon are
 *       gone and stay gone;
 *   (b) each booked row's one next step comes from real state — executed in
 *       `lib/your-team-rows.test.ts`; here, that the page feeds the rows from
 *       the SAME maps the Picks list and the bench already read, and the row
 *       renders the one lock path rather than a second one;
 *   (c) a refused team read says "Couldn't load your suppliers" — never an
 *       empty team (the read itself is executed in
 *       `your-team-read-is-honest.test.ts`) — and a refused EVENT read says
 *       the date and place could not load, never "Pick your date".
 *
 * Source assertions, comments stripped (a docblock naming a pattern is not the
 * pattern), each scoped to the component it is about; the first paint itself
 * is EXECUTED in `suppliers-opens-fast.test.ts`. Sabotage-checked: see the PR
 * body for the before → after of every assertion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));

const TAKEOVER = code('_components', 'services-takeover.tsx');
const PAGE = code('page.tsx');
const ROWS = code('_components', 'team-rows.tsx');
const LINE = code('_components', 'date-place-line.tsx');

/** The takeover's own render — from `export function ServicesTakeover(` to the next top-level `}`. */
function takeoverBody(): string {
  const start = TAKEOVER.indexOf('export function ServicesTakeover(');
  assert.notEqual(start, -1, 'ServicesTakeover moved — re-anchor this test');
  // Its own `}: {` props type sits at column 0, so the body ends at the first
  // column-0 `}` AFTER the render's `return (`.
  const end = TAKEOVER.indexOf('\n}\n', TAKEOVER.indexOf('\n  return (', start));
  assert.notEqual(end, -1, 'ServicesTakeover lost its render — re-anchor this test');
  return TAKEOVER.slice(start, end);
}

/** One body's markup — from its `data-suppliers-body` to the next body (or the cart). */
function bodyOf(mode: 'find' | 'build' | 'booked'): string {
  const body = takeoverBody();
  const start = body.indexOf(`data-suppliers-body="${mode}"`);
  assert.notEqual(start, -1, `the ${mode} body is gone`);
  const next = [body.indexOf('data-suppliers-body="', start + 1), body.indexOf('<BuildCart', start)].filter((i) => i > -1);
  return body.slice(start, Math.min(...next));
}

/* ── (a) the line, the control, one body ─────────────────────────────────── */

test('(a) the order: the date · place line, Find · Build · Booked, then one body', () => {
  const body = takeoverBody();
  const stick = body.indexOf('data-suppliers-stick');
  const facts = body.indexOf('{factsSlot}');
  const seg = body.indexOf('<ISegmented');
  const find = body.indexOf('data-suppliers-body="find"');
  const build = body.indexOf('data-suppliers-body="build"');
  const booked = body.indexOf('data-suppliers-body="booked"');
  for (const [name, at] of Object.entries({ stick, facts, seg, find, build, booked })) {
    assert.ok(at > -1, `the ${name} piece is gone`);
  }
  assert.ok(stick < facts && facts < seg, 'the date · place line sits ABOVE the segmented control, inside the pinned block');
  assert.ok(seg < find && find < build && build < booked, 'the body follows the control, in the order Find · Build · Booked');
  // ONE control, the shipped one, in the wine tone — and exactly three segments.
  assert.equal((body.match(/<ISegmented\b/g) ?? []).length, 1, 'a second navigator');
  assert.match(TAKEOVER, /import \{ ISeg, ISegmented \} from '\.\.\/\.\.\/website\/editor\/_components\/inspector-kit'/);
  assert.match(body, /SUPPLIERS_MODES\.map\(\(m\) => \(\s*<ISeg\s+key=\{m\}\s+tone="wine"/);
  // The counts are <Count>, never a bare number.
  assert.match(body, /<Count value=\{tally\.filled\} id="sup-seg-filled" \/>\/<Count value=\{tally\.total\} id="sup-seg-total" \/>/);
  assert.match(body, /<Count value=\{bookedCount\} id="sup-seg-booked" \/>/);
  // No Jump bar and no page-name row on a phone: the visible name is desktop-only.
  assert.match(body, /<p aria-hidden className="[^"]*\bhidden\b[^"]*\blg:block\b[^"]*">\s*Suppliers\s*<\/p>/);
  assert.doesNotMatch(body, /Jump to|<select\b/);
});

test('(a) every shipped section has ONE home — Find, Build or Booked', () => {
  const find = bodyOf('find');
  const build = bodyOf('build');
  const booked = bodyOf('booked');
  // Find: the door to the category marketplace, then the bench.
  assert.match(find, /href=\{`\/dashboard\/\$\{eventId\}\/vendors\/categories`\}\s*data-find-supplier/);
  assert.equal((takeoverBody().match(/>\s*Find a supplier\s*</g) ?? []).length, 1, 'exactly ONE Find a supplier');
  assert.ok(find.indexOf('data-find-supplier') < find.indexOf('tab="shortlist"'), 'the door comes before the bench it searches beyond');
  assert.match(find, /\{shortlistSlot \?\?/);
  // Build: the picks, then the saved builds.
  assert.ok(build.indexOf('tab="build"') > -1 && build.indexOf('tab="build"') < build.indexOf('tab="compare"'));
  assert.match(build, /\{buildSlot \?\?/);
  assert.match(build, /\{compareSlot \?\?/);
  // Booked: the team's rows, then the payments.
  assert.ok(booked.indexOf('{teamSlot ?') > -1 && booked.indexOf('{teamSlot ?') < booked.indexOf('tab="budget"'));
  assert.match(booked, /\{budgetSlot \?\?/);
  // …and each is mounted ONCE on the whole screen (no display-toggled twin).
  const body = takeoverBody();
  for (const slot of ['shortlistSlot ??', 'buildSlot ??', 'compareSlot ??', 'budgetSlot ??', '{teamSlot ?']) {
    assert.equal(body.split(slot).length - 1, 1, `${slot} is mounted more than once`);
  }
  for (const tab of ['shortlist', 'build', 'compare', 'budget']) {
    assert.equal(body.split(`<ServiceSection tab="${tab}"`).length - 1, 1, `#svc-${tab} would be a duplicate id`);
  }
});

test('(a) the segmented control drives the shipped bus, and the bus drives the control', () => {
  const body = takeoverBody();
  // A press dispatches the mode's own tab key on the SHIPPED bus — no second channel.
  assert.match(body, /onClick=\{\(\) => goToBuildTab\(SUPPLIERS_MODE_TAB\[m\]\)\}/);
  // The listener is unchanged for every caller, and resolves a key to its body.
  assert.match(body, /window\.addEventListener\(BB_TAB_EVENT, onTab\)/);
  const goTo = body.slice(body.indexOf('const goToSection'), body.indexOf('}, []);', body.indexOf('const goToSection')));
  assert.match(goTo, /const nextMode = suppliersModeOfTab\(next\);/);
  assert.match(goTo, /url\.searchParams\.set\('tab', next\)/, '?tab= is no longer mirrored');
  // A body opens at its top; only a section INSIDE a body is scrolled to.
  assert.match(goTo, /if \(isModeTab\(next\)\) \{\s*window\.scrollTo\(\{ top: 0 \}\);/);
  assert.match(goTo, /document\.getElementById\(sectionId\(next\)\)\?\.scrollIntoView\(/);
  // The page hands the first body in with the request, so the first paint is already it.
  assert.match(PAGE, /initialTab=\{initialTab\}/);
  assert.match(body, /const firstMode = suppliersModeOfTab\(initialTab\);/);
});

test('(a) retired and gone: the five-row menu, the hidden find area, the second chat icon', () => {
  assert.doesNotMatch(TAKEOVER, /PlanningList|data-planning-list|Your planning/, 'the planning menu is back');
  assert.doesNotMatch(TAKEOVER, /team-find-area|data-find-area|findOpen|findMounted/, 'the hidden find area is back');
  assert.doesNotMatch(TAKEOVER, /chatSlot|ChatsDoor|data-chats-door/, 'a second chat icon is back on Suppliers');
  assert.doesNotMatch(PAGE, /ChatsDoor|chatSlot=|initialFindOpen=|teamParts=\{teamParts\}/);
  assert.doesNotMatch(TAKEOVER, /TeamMoreMenu|SectionChips|data-team-more/, 'the ⋯ menu is back');
  for (const gone of ['_components/planning-list.tsx', 'planning-list.test.ts', '_components/chats-door.tsx']) {
    assert.equal(existsSync(join(DIR, ...gone.split('/'))), false, `${gone} is back`);
  }
});

test('(a) the date · place line: the page’s own facts, opening the SHIPPED editor for each', () => {
  // Server-rendered by the page, only placed by the shell.
  assert.match(PAGE, /factsSlot=\{<DatePlaceLine eventId=\{eventId\} facts=\{shellFacts\} \/>\}/);
  // No second editor and no write: each value is a link to the one field for that fact.
  assert.match(LINE, /href=\{recordFieldHref\(eventId, 'date'\)\}/);
  assert.match(LINE, /href=\{recordFieldHref\(eventId, 'venues'\)\}/);
  assert.doesNotMatch(LINE, /'use client'|'use server'|<input\b|<form\b|onClick=/);
  // Date and place appear ONCE in the shell — the line.
  assert.equal(takeoverBody().split('{factsSlot}').length - 1, 1);
  // The words come from the one pure module, from facts the page already read.
  const facts = PAGE.slice(PAGE.indexOf('const shellFacts'), PAGE.indexOf('const buildSlot'));
  assert.ok(facts.length > 0, 'shellFacts moved — re-anchor');
  assert.match(facts, /suppliersDateFact\(ev\.event_date, ev\.event_date_precision\)/);
  assert.match(facts, /pickVenueBookingRows\(venueRows\)/, 'the venue is no longer picked by the Event Hub’s own rule');
  assert.doesNotMatch(facts, /await |\.from\(/, 'the line grew a read of its own');
});

/* ── (b) one next step, from the state the page already read ──────────────── */

test('(b) the rows are derived by the one pure module from the page’s existing maps', () => {
  const block = PAGE.slice(PAGE.indexOf('const teamRowList'), PAGE.indexOf('const teamSlot'));
  assert.ok(block.length > 0, 'teamRowList moved — re-anchor');
  for (const source of [
    'depositStepByVendorId.get(',
    'reviewStatusByVendorId.get(',
    'lockBlockedByVendorId.get(',
    'standingsByVendorId[',
    'resolveBenchCardActions(',
    'row.lock_request_state',
    'row.status',
  ]) {
    assert.ok(block.includes(source), `the rows no longer read ${source} — a row would be guessing`);
  }
  assert.match(block, /teamRows\(facts, \{ eventId, lockHandshakeEnabled: isLockHandshakeEnabled\(\) \}\)/);
  // No row state is typed here: no literal action kinds in the page.
  assert.doesNotMatch(block, /kind: '(pay|lock|nudge|review)'/);
});

test('(b) a row draws at most one action, and Lock is the shipped lock path', () => {
  const action = ROWS.slice(ROWS.indexOf('function RowAction('));
  assert.match(action, /if \(!a\) return null;/);
  assert.equal((action.match(/<AccordionLockButton\b/g) ?? []).length, 1);
  assert.equal((action.match(/<Link\b/g) ?? []).length, 1);
  assert.match(ROWS, /<RowAction eventId=\{eventId\} row=\{r\} \/>/);
  assert.doesNotMatch(ROWS, /finalizeVendor|'use client'/, 'a second lock path, or a client component');
});

/* ── (c) a refused read is said, not drawn as nobody ─────────────────────── */

test('(c) the page reads the team MEASURED and stops on a refusal with "Couldn’t load"', () => {
  assert.match(PAGE, /readEventVendorsMeasured\(supabase, eventId\)/);
  assert.doesNotMatch(PAGE, /fetchEventVendors\(/, 'the throwing reader is back on this page');
  const guard = PAGE.indexOf('if (!vendorsRead.measured)');
  assert.ok(guard > -1, 'no refusal branch');
  const branch = PAGE.slice(guard, PAGE.indexOf('const vendors = vendorsRead.rows;'));
  assert.match(branch, /kind: 'unreadable'/);
  assert.match(branch, /return \(/, 'the refusal must RETURN before anything is built from zero rows');
  // Nothing on the page may be built from the rows before the refusal is checked.
  assert.ok(
    PAGE.indexOf('buildPlanBudgetModel(') > guard && PAGE.indexOf('teamRows(') > guard,
    'a surface is built from the rows before the refusal branch',
  );
});

test('(c) a refused EVENT read says so on the line — never "Pick your date"', () => {
  const facts = PAGE.slice(PAGE.indexOf('const shellFacts'), PAGE.indexOf('const buildSlot'));
  assert.match(facts, /if \(eventCtx\.error \|\| !ev\) return null;/, 'a refused read would be drawn as an unset date');
  const unreadable = LINE.slice(LINE.indexOf('if (!facts)'), LINE.indexOf('const { date, place } = facts;'));
  assert.match(unreadable, /Couldn’t load your date and place\./);
  assert.doesNotMatch(unreadable, /Pick your date|Pick the place|recordFieldHref/);
});

test('(c) TeamRows says "Couldn’t load your team" for unreadable, and "empty" only for a measured zero', () => {
  const unreadable = ROWS.slice(ROWS.indexOf("state.kind === 'unreadable'"), ROWS.indexOf('const { rows } = state;'));
  assert.match(unreadable, /Couldn’t load your suppliers/);
  assert.match(unreadable, /retryHref/);
  assert.doesNotMatch(unreadable, /No suppliers yet/);
  const empty = ROWS.slice(ROWS.indexOf('const { rows } = state;'));
  assert.match(empty, /rows\.length === 0[\s\S]{0,200}No suppliers yet\./);
});
