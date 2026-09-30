import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CHECK_PX, NAME_PX, ROSTER_COLUMNS, SLOT_PX, rosterSlotCount } from '@/lib/roster-columns';

/**
 * ⚖ Owner 2026-09-21, on the shipped header: *"text is improper. and it does
 * not stretch the whole screen."*
 *
 * ── WHAT BROKE, AND WHY NOTHING CAUGHT IT ──────────────────────────────────
 * Each column header gained a grouping checkbox and kept its old width. Under
 * `table-fixed` a declared width governs LAYOUT, but it does not clip content:
 * a `whitespace-nowrap` label simply spills over its own cell into the next
 * one. So every header sat visibly shifted from the column beneath it, the
 * last one was pushed past the right edge and read "CONTA", and the table
 * overflowed its `overflow-x-auto` wrapper instead of filling the screen.
 *
 * 🔑 EVERY EXISTING GUARD STAYED GREEN. The typecheck passes, the 18 repo
 * guards pass, 2,776 tests pass, and the contrast guard even caught a
 * different fault in the SAME file on the same day. None of them can see
 * geometry: the markup is valid, the classes are real, and the defect exists
 * only once a browser lays it out. This file is the arithmetic that was
 * missing.
 */

const DIR = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');

/**
 * 🪤 COMMENTS OUT FIRST, ALWAYS — and through the repo's ONE stripper.
 *
 * The first cut of the padding assertion below went red against a comment
 * EXPLAINING why px-2 is wrong: a guard convicting the prose that documents it.
 * The second cut fixed that with a two-line regex of its own, which
 * `lint-one-comment-stripper` then refused, and it was right to: stripping
 * block comments first lets a `video/*` inside a LINE comment open a comment
 * that never existed, which blanks every line to the next real close — and a
 * guard asserting against a blank passes. `lib/strip-comments.ts` is a lexer,
 * not a regex, precisely because the regex is wrong in the silent direction.
 */
const ROSTER = stripComments(
  readFileSync(join(DIR, '_components', 'guest-list-multiselect.tsx'), 'utf8'),
);
const CONTROLS = stripComments(
  readFileSync(join(DIR, '_components', 'arrange-controls.tsx'), 'utf8'),
);

/**
 * The ArrangeTh component's own source, as one window.
 *
 * 🪤 THESE TWO ASSERTIONS USED TO SLICE FROM `<th className={className}` — and
 * the very next fix changed that expression, so `indexOf` returned -1, the
 * slice became the file's last character, and both went red judging nothing.
 * Anchored on the COMPONENT now, which a styling change cannot rename, and the
 * window asserts it was found rather than slicing from -1.
 */
function arrangeThBody(): string {
  const a = CONTROLS.indexOf('export function ArrangeTh(');
  const b = CONTROLS.indexOf('export function ArrangeSheet(');
  assert.ok(a !== -1 && b > a, 'cannot find ArrangeTh in arrange-controls.tsx — this guard is blind');
  return CONTROLS.slice(a, b);
}

/** The header row's cells, in order, as their opening tags. */
function headerCells(): string[] {
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  return [...head.matchAll(/<(?:ArrangeTh|th)\b[\s\S]*?\/?>/g)].map((m) => m[0]);
}

test('Name keeps the leftover — the slots are counted from the width, never declared past it', () => {
  // ⤷ 2026-09-30, REWRITTEN FOR THE FULL-WIDTH LIST (owner: "number of columns
  // to show depends on the width of the screen"). The property this file has
  // always protected is that NAME KEEPS THE LEFTOVER. It used to be held by a
  // ceiling on the declared percentages; now there are no percentages at all —
  // every slot is SLOT_PX wide, and the NUMBER of slots is computed from the
  // list's measured width so that the checkbox, Name's floor and the slots
  // always fit. Executed here, not read: at every width a desktop can have,
  // what the slots claim leaves Name at least NAME_PX.
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  assert.doesNotMatch(head, /w-\[\d+%\]/, 'a header declares a percentage width again — the slots are counted, not declared');
  assert.match(head, /style=\{\{ width: SLOT_PX \}\}/, 'a slot header is not SLOT_PX wide — the count and the layout would disagree');
  for (let width = 1000; width <= 2800; width += 40) {
    const slots = rosterSlotCount(width, ROSTER_COLUMNS.length);
    const left = width - CHECK_PX - slots * SLOT_PX;
    if (slots > 1) assert.ok(left >= NAME_PX, `at ${width}px, ${slots} slots leave Name ${left}px (< ${NAME_PX})`);
  }
  // The owner's own numbers: about 4 at a 1280px list, 6 at 1600, 8+ at 2000+.
  assert.ok(rosterSlotCount(960, 11) >= 4 && rosterSlotCount(960, 11) <= 5, 'a 1280px screen (≈960px of list) should show about 4');
  assert.ok(rosterSlotCount(1300, 11) >= 6, 'a 1600px screen (≈1300px of list) should show about 6');
  assert.ok(rosterSlotCount(1700, 11) >= 8, 'a 2000px screen (≈1700px of list) should show 8+');
});

test('a fixed-pixel column has a budget too, so it cannot eat Name by another unit', () => {
  // The checkbox is the one fixed width left in the header's classes; the slots
  // are sized by SLOT_PX (above). Anything else fixed would come out of Name
  // with nothing counting it.
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  const cellClasses = [...head.matchAll(/<(?:th|ArrangeTh)\b[^>]*?className="([^"]*)"/g)].map((m) => m[1]!).join(' ');
  const px = [...cellClasses.matchAll(/\bw-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  const rem = [...cellClasses.matchAll(/\bw-(\d+)\b/g)].map((m) => Number(m[1]) * 4);
  assert.ok(px.length + rem.length >= 1, `found ${px.length + rem.length} fixed widths — this guard is blind`);
  const total = [...px, ...rem].reduce((a, b) => a + b, 0);
  assert.ok(total <= CHECK_PX, `fixed-pixel columns claim ${total}px (${[...px, ...rem].join(' + ')}) — only the ${CHECK_PX}px checkbox is counted`);
});

test('the header and every body cell share ONE horizontal padding', () => {
  // ⛔ Trimming a header to px-2 buys 8px and puts it 4px left of every cell
  // beneath it. Space comes out of the width, never out of the padding.
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  const pads = new Set([...head.matchAll(/\bpx-(\d)\b/g)].map((m) => m[1]));
  assert.deepEqual(
    [...pads].sort(),
    ['3'],
    `the header row mixes horizontal padding: px-${[...pads].sort().join(', px-')}`,
  );
});

test('an arrangeable header may SHRINK, so it can never spill into its neighbour', () => {
  // The two classes are a pair and neither works alone: a flex child will not
  // go below its content width unless `min-w-0` says it may, and `truncate`
  // is what then clips instead of overflowing.
  const th = arrangeThBody();
  assert.match(
    th,
    /<span className="flex min-w-0 items-center/,
    'the header cell\'s flex row cannot shrink — a long label will spill over the column beside it',
  );
  assert.match(
    th,
    /<span className="truncate">\{label\}<\/span>/,
    'the column label is not truncated — under table-fixed it overflows its own cell rather than clipping',
  );
});

test('the checkbox and the sort arrow never shrink instead of the label', () => {
  // If the CONTROL is what gives way, the header degrades into an unclickable
  // sliver while the word stays whole — backwards. The word is recoverable
  // (it is in `title` and in the column below); the control is not.
  const th = arrangeThBody();
  assert.match(th, /<label\s+className="inline-flex shrink-0/, 'the grouping checkbox can be squeezed away');
  assert.match(th, /<ChevronDown className="h-3 w-3 shrink-0"/, 'the sort arrow can be squeezed away');
});

test('every header cell still declares a scope, so the table stays readable aloud', () => {
  // ☐ · Name · and ONE slot header drawn per column (`desk.columns.map`).
  const cells = headerCells();
  assert.ok(cells.length >= 3, `found ${cells.length} header cells — this guard is blind`);
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  assert.match(head, /desk\.columns\.map\(\(column, slot\) => \(\s*<th\b/, 'the slot headers are no longer one <th> per column');
});

test('no header cell can widen the table — the floor under every width above', () => {
  // 🪤 THE FIRST FIX STOPPED LABELS SPILLING AND STILL LEFT THE TABLE 19PX TOO
  // WIDE. Measured in a real render: 1,085px of table inside a 1,066px
  // scroller, all of it the plain-text "Contact" header, whose word needs ~72px
  // in a 53px cell. The spill check that "passed" measured child elements, and
  // that cell has none. Two different failures:
  //   · a LABEL spilling into its neighbour   → min-w-0 + truncate (above)
  //   · a CELL widening the scroll area       → overflow-hidden on the cell
  // The second is what made the page "not stretch the whole screen".
  assert.match(
    CONTROLS,
    /<th className=\{`\$\{className \?\? ''\} overflow-hidden`\}/,
    'ArrangeTh no longer clips its own cell — any caller can widen the table again',
  );
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  const plain = [...head.matchAll(/<th className="([^"]*)"[^>]*>\s*(?:<span[^>]*>)?\s*([A-Za-z]+)/g)]
    .filter((m) => m[2] && m[2] !== 'label'); // the text-bearing plain cells
  assert.ok(plain.length >= 1, 'found no plain text header — this guard is blind');
  for (const [, cls, word] of plain) {
    assert.match(cls!, /\boverflow-hidden\b/, `the "${word}" header can widen the table — it needs overflow-hidden`);
  }
});

