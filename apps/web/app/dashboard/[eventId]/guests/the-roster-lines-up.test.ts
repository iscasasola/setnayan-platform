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

// ⤷ 2026-09-30 (the Fable rows' ledger): the 2px side-coloured edge MOVED —
// "Side is now a word on the sub-line. Plain English beats a colour code." And
// requests are no longer rows (one strip leads to the Requests page), so the
// self-join row variant is gone. The rule that stays: header and row agree.

test('the header and the row agree on the left edge — neither draws a side edge now', () => {
  const head = firstCellClass(HEAD, '<th ');
  const row = firstCellClass(component('DesktopRow'), '<td ');
  assert.equal(/border-l-2/.test(head), /border-l-2/.test(row), 'the header and the row disagree on a left edge — the columns step 2px');
  assert.doesNotMatch(row, /SIDE_CONTROL_BORDER/, 'the colour-coded side edge is back — the side is a word now');
});

test('the header and every row use the SAME horizontal padding', () => {
  const pads = new Set<string>();
  for (const region of [HEAD, component('DesktopRow')]) {
    for (const m of region.matchAll(/<(?:t[dh]|ArrangeTh)\b[\s\S]*?>/g)) {
      const cell = m[0];
      const span = /colSpan=\{(\d+)\}/.exec(cell);
      if (span && Number(span[1]) > 1) continue;
      const pad = /\b(px-\d)\b/.exec(cell);
      if (pad) pads.add(pad[1]!);
    }
  }
  assert.deepEqual([...pads].sort(), ['px-3'], `the roster mixes horizontal cell padding: ${[...pads].sort().join(', ')}`);
});

test('rows centre their cells instead of hanging them off the avatar baseline', () => {
  assert.match(
    component('DesktopRow'),
    /<tr[\s\S]{0,300}?align-middle/,
    'DesktopRow does not centre its cells — short cells drop to the bottom beside the 36px avatar',
  );
});

test('the header still declares exactly one column per cell in a row', () => {
  const headerCells = (HEAD.match(/<(?:th|ArrangeTh)[\s>]/g) ?? []).length;
  const bodyCells = (component('DesktopRow').match(/<td[ >]/g) ?? []).length;
  assert.equal(bodyCells, headerCells, `${bodyCells} body cells against ${headerCells} headers`);
  // …and every full-width row (a section heading) spans exactly that many.
  for (const m of SRC.matchAll(/colSpan=\{(\d+)\}/g)) {
    assert.equal(Number(m[1]), headerCells, `a full-width row spans ${m[1]} of ${headerCells} columns`);
  }
});
