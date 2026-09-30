/**
 * your-team-phone-first.test.ts — the approved phone Your Team (owner
 * 2026-10-01, `prototypes/phone_app_simple_2026-10-01_fable.html` frame 4):
 *
 *   (a) the booked suppliers render BEFORE "Find a supplier", and the category
 *       walls sit INSIDE it — hidden on a phone until it is pressed, never
 *       unmounted, never unreachable;
 *   (b) each row's one next step comes from real state — executed in
 *       `lib/your-team-rows.test.ts`; here, that the page feeds the rows from
 *       the SAME maps the Picks list and the bench already read, and the row
 *       renders the one lock path rather than a second one;
 *   (c) a refused team read says "Couldn't load your team" — never an empty
 *       team (the read itself is executed in `your-team-read-is-honest.test.ts`).
 *
 * Source assertions, comments stripped (a docblock naming a pattern is not the
 * pattern), each scoped to the component it is about. Sabotage-checked: see
 * the PR body for the before → after of every assertion.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(DIR, ...p), 'utf8'));

const TAKEOVER = code('_components', 'services-takeover.tsx');
const PAGE = code('page.tsx');
const ROWS = code('_components', 'team-rows.tsx');

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

/* ── (a) booked first, then ONE Find a supplier, then the walls inside it ── */

test('(a) the team renders before "Find a supplier", which renders before the find area', () => {
  const body = takeoverBody();
  const team = body.indexOf('{teamSlot ?');
  const find = body.indexOf('data-find-supplier');
  const area = body.indexOf('id="team-find-area"');
  const bench = body.indexOf('tab="shortlist"');
  assert.ok(team > -1, 'the team slot is not rendered');
  assert.ok(find > -1, 'the Find a supplier button is gone');
  assert.ok(area > -1, 'the find area is gone');
  assert.ok(team < find, 'the booked suppliers must come BEFORE Find a supplier');
  assert.ok(find < area, 'Find a supplier must come before the area it opens');
  assert.ok(area < bench, 'the category walls (the bench) must live INSIDE the find area');
  assert.equal((body.match(/>\s*Find a supplier\s*</g) ?? []).length, 1, 'exactly ONE Find a supplier');
});

test('(a) the find area is hidden on a phone ONLY while closed — and every door opens it', () => {
  const body = takeoverBody();
  // Hidden is conditional, and lg+ always shows it (desktop: same things first, more below).
  assert.match(body, /className=\{findOpen \? undefined : 'hidden lg:block'\}/);
  // The button opens it through goToSection …
  assert.match(body, /data-find-supplier[\s\S]{0,200}onClick=\{\(\) => goToSection\('shortlist'\)\}/);
  // … and goToSection — the bus listener, every ⋯ row, every ?tab= adopt — opens it first.
  const goTo = body.slice(body.indexOf('const goToSection'), body.indexOf('}, []);', body.indexOf('const goToSection')));
  assert.match(goTo, /setFindOpen\(true\)/, 'a section jump would scroll to a hidden element');
  // A deep link arrives open in the FIRST render (the bench scrolls on mount).
  assert.match(body, /useState\(initialFindOpen\)/);
  assert.match(PAGE, /initialFindOpen=\{Boolean\(sp\.open \|\| sp\.inspect \|\| sp\.tab\)\}/);
});

test('(a) the page hands the takeover the team, and Budget moved behind ⋯', () => {
  assert.match(PAGE, /teamSlot=\{teamSlot\}/);
  assert.match(PAGE, /teamParts=\{teamParts\}/);
  assert.match(TAKEOVER, /function TeamMoreMenu\(/);
  assert.match(TAKEOVER, /<TeamMoreMenu parts=\{teamParts\}/);
  // Every part but the team itself is a ⋯ row, from lib/pillar-parts — no hand-typed href.
  assert.match(TAKEOVER, /\(parts \?\? \[\]\)\.filter\(\(p\) => p\.key !== 'team'\)/);
  assert.match(TAKEOVER, /href=\{p\.href\}/);
});

test('(a) the section jumps are ⋯ menu rows, not a pill row on the page', () => {
  const body = takeoverBody();
  assert.doesNotMatch(body, /<SectionChips \/>/, 'the chips are back on the page as a pill row');
  const menu = TAKEOVER.slice(TAKEOVER.indexOf('function TeamMoreMenu('));
  assert.match(menu, /<SectionChips \/>/, 'the section jumps lost their home in ⋯');
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

test('(c) TeamRows says "Couldn’t load your team" for unreadable, and "empty" only for a measured zero', () => {
  const unreadable = ROWS.slice(ROWS.indexOf("state.kind === 'unreadable'"), ROWS.indexOf('const { rows } = state;'));
  assert.match(unreadable, /Couldn’t load your suppliers/);
  assert.match(unreadable, /retryHref/);
  assert.doesNotMatch(unreadable, /No suppliers yet/);
  const empty = ROWS.slice(ROWS.indexOf('const { rows } = state;'));
  assert.match(empty, /rows\.length === 0[\s\S]{0,200}No suppliers yet\./);
});
