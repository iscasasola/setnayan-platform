/**
 * find-rows.test.ts — FIND IS ONE FLAT LIST OF CATEGORY ROWS (owner
 * 2026-10-07; corpus `SUPPLIERS_BUILD_PLAN_2026-10-07_fable.md` § PR2;
 * acceptance pictures 01 and 20; owner rulings 2026-10-08 "1. yes 2. go").
 *
 *   T1  no folder level in the one-screen shape — every folder is open and
 *       headless, and a folder with no category on the event draws nothing;
 *   T2  the heading is "Cover your event", and under it "Covered N of M"
 *       through <Count>, counting booked or covered (`ringCoveredCount`);
 *   T3  each row: the name, "· N yours", ONE state word from the pure rule —
 *       the old count bubble and "✓ Covered" chip do not also draw;
 *   T4  "＋ Add to your event" is ONE dropdown of every category not on the
 *       event, grouped; picking one runs the shipped add;
 *   T5  "Not needed · Remove ‹Category›" names what it removes, and keeps the
 *       shipped confirm.
 *
 * Source assertions, comments stripped (the bench is a client tree fed by a
 * server page; this runner has no DOM). The rules themselves are EXECUTED:
 * `categoryRowState` / `ringCoveredCount` in `lib/suppliers-shell.test.ts`,
 * the ring and the kept category in `lib/explore-in-plan.test.ts`.
 *
 * SABOTAGE, each seen red (2026-10-08; the PR body has the runs):
 *   T1 draw the folder heads · T2 count over all tiles, bare number
 *   T3 keep the count bubble · T4 chips per folder / every category listed
 *   T5 the old label
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { ADD_TO_EVENT_ASK, ADD_TO_PLAN_HEADING, COVERAGE_STRIP_HEADING, removeFromEventLabel } from '@/lib/explore-info-copy';

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors', '_components');
const BENCH = stripComments(readFileSync(join(DIR, 'shortlist-categories.tsx'), 'utf8'));
const SHELL = stripComments(readFileSync(join(DIR, 'services-takeover.tsx'), 'utf8'));

test('T1 · no folder level: every folder is open and headless, an empty one draws nothing', () => {
  assert.match(BENCH, /const folderOpen = replan \|\| searching \|\| openAll \|\| openFolder === folder\.folder;/);
  assert.match(BENCH, /if \(replan && rowTiles\.length === 0\) return null;/);
  assert.match(BENCH, /className=\{`fold\$\{folderOpen \? ' open' : ''\}\$\{replan \? ' flat' : ''\}`\}/);
  // The folder head (and its ⓘ) is drawn only in the old shape.
  const head = BENCH.indexOf('<div className="fold-head-row"');
  assert.ok(head > -1, 'the flag-off folder head moved — re-anchor');
  assert.match(BENCH.slice(head - 60, head), /\{replan \? null : \(\s*<>\s*$/, 'the folder heads draw in the flat list');
  // …and a flat folder has no box of its own, so a row head can pin later.
  assert.match(BENCH, /\.slcat \.fold\.flat\{margin:0;background:none;border:0;border-radius:0;overflow:visible;box-shadow:none\}/);
});

test('T2 · "Cover your event", then "Covered N of M" — counted, and counting bookings', () => {
  assert.equal(COVERAGE_STRIP_HEADING, 'Cover your event');
  assert.match(SHELL, /shortlist: isExploreReplanEnabled\(\) \? COVERAGE_STRIP_HEADING : 'Saved',/);
  assert.match(BENCH, /const ringCovered = ringCoveredCount\(stripTiles\.map\(\(t\) => coverageStateOf\(t\)\)\);/);
  assert.match(
    BENCH,
    /Covered <Count value=\{ringCovered\} id="sup-ring-covered" \/> of\{' '\}\s*<Count value=\{stripTiles\.length\} id="sup-ring-total" \/>/,
  );
  // The icon strip that drew the same categories a second time is gone.
  assert.doesNotMatch(BENCH, /className="cov-strip"|className=\{`ctile /);
});

test('T3 · a row: the name, "· N yours", and ONE state word from the pure rule', () => {
  assert.match(BENCH, /\{replan && t\.vendors\.length > 0 \? \(\s*<span className="cat-yours">\s*· <Count value=\{t\.vendors\.length\} id=\{`sup-yours-\$\{t\.tile\}`\} \/> yours/);
  assert.match(
    BENCH,
    /categoryRowState\(\{\s*lockedCount: rowCoverage\?\.lockedCount \?\? 0,\s*covered: rowCoverage\?\.covered \?\? false,\s*vendorCount: t\.vendors\.length,\s*quoteInCount: t\.vendors\.filter\(\(v\) => standings\[v\.vendorId\]\?\.needsYou === true\)\.length,\s*\}\)/,
  );
  assert.match(BENCH, /<Count value=\{rowState\.n\} id=\{`sup-st-\$\{rowState\.kind\}-\$\{t\.tile\}`\} \/>/);
  assert.match(BENCH, /\{rowState\.words\}/);
  // The old shape's bubble and chip do not ALSO draw.
  assert.match(BENCH, /\{!replan && t\.vendors\.length > 0 \? \(\s*<span className="cat-count">/);
  assert.match(BENCH, /\{!replan && coveredGroup \? \(/);
});

test('T4 · "+ Add to your event" is ONE dropdown of the categories NOT on the event', () => {
  assert.equal(ADD_TO_EVENT_ASK, 'Need something else?');
  assert.match(
    BENCH,
    /const poolRows = inPlanTiles\s*\? folders\.flatMap\(\(f\) => f\.tiles\.filter\(\(t\) => !inPlanTiles\.has\(t\.tile\)\)\.map\(\(t\) => \(\{ t, f \}\)\)\)\s*: \[\];/,
  );
  const pool = BENCH.slice(BENCH.indexOf('data-add-to-event=""'), BENCH.indexOf('<FindThumbRow'));
  assert.ok(pool.length > 0, 'the dropdown moved — re-anchor');
  assert.equal((pool.match(/<PickMenu\b/g) ?? []).length, 1);
  assert.match(pool, /buttonText=\{`\+ \$\{ADD_TO_PLAN_HEADING\}`\}/);
  assert.equal(ADD_TO_PLAN_HEADING.toLowerCase().includes('your event'), true);
  assert.match(pool, /options=\{poolRows\.map\(\(\{ t, f \}\) => \(\{ key: t\.tile, label: t\.label, group: f\.label \}\)\)\}/);
  assert.match(pool, /if \(row && !planEditing\) addTileToPlan\(row\.t\.tile, row\.f\.folder, row\.f\.slug\);/);
  // A refusal is said beside the dropdown — never swallowed.
  assert.match(pool, /\{planError\.message\}/);
  // The per-folder chip pool is gone: one dropdown, not a wall of chips.
  assert.doesNotMatch(BENCH, /className="addchip"|className="addpool"/);
});

test('T5 · the removal names what it removes, and still asks first', () => {
  assert.equal(removeFromEventLabel('Catering'), 'Not needed · Remove Catering');
  assert.match(BENCH, /\{removeFromEventLabel\(t\.label\)\}/);
  assert.match(BENCH, /onClick=\{\(\) => void removeTileFromPlan\(t\.tile, t\.label\)\}/);
});
