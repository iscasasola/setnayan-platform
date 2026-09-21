import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * ⚖ Owner 2026-09-20, on the redesigned roster: *"fix the alignment of the
 * table. make it clean."*
 *
 * Three defects, and the first was introduced by the redesign itself:
 *
 *  1. Every body row's first cell gained a 2px side edge. The HEADER's first
 *     cell did not, so with `table-fixed` the column labels sat 2px off every
 *     column beneath them.
 *  2. The self-join row never got the edge at all, so it was 2px narrower than
 *     its neighbours — and its name cell used `px-4` where every other row uses
 *     `px-3`, so that column stepped sideways on those rows.
 *  3. Table cells default to BASELINE alignment. With a 36px avatar in the name
 *     column and 11px text beside it, every short cell dropped to the bottom of
 *     the row.
 *
 * 🔑 NONE OF THESE IS VISIBLE IN A DIFF. A 2px border added on one row and not
 * on the header reads as a complete change in review; it is only wrong once
 * rendered. So the geometry is asserted here rather than left to the eye.
 */

// 🪤 COMMENTS STRIPPED, through the repo's one lexer. Every count below looks
// for a tag like `<th` — and on 2026-09-21 a note EXPLAINING a header-cell fix
// said "a <th> carries…", which this file counted as a ninth column. A rule
// about markup must never be readable from prose about the markup.
const SRC = stripComments(
  readFileSync(
  join(
    process.cwd(),
    'app',
    'dashboard',
    '[eventId]',
    'guests',
    '_components',
    'guest-list-multiselect.tsx',
  ),
  'utf8',
  ),
);

/**
 * The className of the first cell of a component's row (or of the header).
 *
 * 🪤 THE TRAILING SPACE IS LOAD-BEARING: `'<thead'` itself begins with `'<th'`,
 * so searching for the bare tag returned the THEAD element and reported the
 * header as missing an edge it actually had.
 */
function firstCellClass(region: string, tag: '<th ' | '<td '): string {
  const at = region.indexOf(tag);
  assert.notEqual(at, -1, `no ${tag.trim()} found — this guard is blind`);
  return region.slice(at, region.indexOf('>', at));
}

function component(name: string): string {
  const a = SRC.indexOf(`function ${name}(`);
  assert.notEqual(a, -1, `${name} is gone — this guard is blind`);
  const b = SRC.indexOf('\nfunction ', a + 10);
  return SRC.slice(a, b === -1 ? undefined : b);
}

const HEAD = SRC.slice(SRC.indexOf('<thead'), SRC.indexOf('</thead>'));

test('the header reserves the same left edge every row draws', () => {
  // With `table-fixed` the header sets the column box. A 2px border on the body
  // cell and none on the header is a 2px shift on every column.
  assert.match(
    firstCellClass(HEAD, '<th '),
    /border-l-2/,
    "the header's first cell no longer reserves the row's side edge — the body will sit off the labels",
  );
});

test('every row variant draws that edge, so no row is narrower than another', () => {
  for (const name of ['DesktopRow', 'SelfJoinDesktopRow']) {
    assert.match(
      firstCellClass(component(name), '<td '),
      /border-l-2/,
      `${name}'s first cell has no side edge — its columns step 2px off the others`,
    );
  }
});

test('the header and every row use the SAME horizontal padding', () => {
  // A px-4 name cell on one row variant and px-3 on another is a column that
  // moves depending on which kind of row you are looking at.
  /*
    🪤 A FULL-WIDTH `colSpan` CELL IS NOT A COLUMN. The self-join banner spans
    the whole table, so its padding cannot push any column sideways — a first
    draft of this assertion failed on it, which is a guard convicting innocent
    markup. Only cells that participate in the column grid are compared.
  */
  const pads = new Set<string>();
  for (const region of [HEAD, component('DesktopRow'), component('SelfJoinDesktopRow')]) {
    // 🪤 `<ArrangeTh>` IS A HEADER CELL. Since #5793 six of the eight header
    // cells render through it, and a scan for `<t[dh]` could not see them —
    // their padding went unchecked while this test stayed green.
    for (const m of region.matchAll(/<(?:t[dh]|ArrangeTh)\b[\s\S]*?>/g)) {
      const cell = m[0];
      const span = /colSpan=\{(\d+)\}/.exec(cell);
      if (span && Number(span[1]) > 1) continue;
      const pad = /\b(px-\d)\b/.exec(cell);
      if (pad) pads.add(pad[1]!);
    }
  }
  assert.deepEqual(
    [...pads].sort(),
    ['px-3'],
    `the roster mixes horizontal cell padding: ${[...pads].sort().join(', ')}`,
  );
});

test('rows centre their cells instead of hanging them off the avatar baseline', () => {
  // A table cell's default vertical-align is baseline, and `td` inherits it
  // from the `tr` — so one class on the row fixes every cell in it.
  for (const name of ['DesktopRow', 'SelfJoinDesktopRow']) {
    assert.match(
      component(name),
      /<tr[\s\S]{0,300}?align-middle/,
      `${name} does not centre its cells — short cells drop to the bottom beside the 36px avatar`,
    );
  }
});

test('the header still declares exactly one column per cell in a row', () => {
  // The cheapest way for a table to go crooked is a cell count that no longer
  // matches. The self-join row spans the rest, so its spans must add up too.
  // A column is a header cell however it is spelled (see the padding note).
  const headerCells = (HEAD.match(/<(?:th|ArrangeTh)[\s>]/g) ?? []).length;
  const bodyCells = (component('DesktopRow').match(/<td[ >]/g) ?? []).length;
  assert.equal(bodyCells, headerCells, `${bodyCells} body cells against ${headerCells} headers`);

  const selfJoin = component('SelfJoinDesktopRow');
  const plain = (selfJoin.match(/<td(?![^>]*colSpan)[ >]/g) ?? []).length;
  const spans = [...selfJoin.matchAll(/colSpan=\{(\d+)\}/g)].map((m) => Number(m[1]));
  // Two stacked rows share this component; each must cover the full width.
  for (const span of spans) {
    assert.ok(
      span + plain >= headerCells,
      `a self-join row covers ${span + plain} of ${headerCells} columns`,
    );
  }
});
