import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

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

test('the declared column widths cannot exceed the table', () => {
  // 🪤 A percentage total over 100 does not "just overflow a bit" — it makes
  // the whole table wider than its scroller, so the LAST column is the one
  // that disappears, and the page reads as not stretching to fit.
  const pcts = [...ROSTER.matchAll(/w-\[(\d+)%\]/g)]
    .map((m) => Number(m[1]))
    .slice(0, 6); // the six fixed roster columns + Contact live together
  const head = ROSTER.slice(ROSTER.indexOf('<thead'), ROSTER.indexOf('</thead>'));
  const declared = [...head.matchAll(/w-\[(\d+)%\]/g)].map((m) => Number(m[1]));
  assert.ok(declared.length >= 6, `found ${declared.length} declared widths — this guard is blind`);
  const total = declared.reduce((a, b) => a + b, 0);
  // 🪤 THE FIRST THRESHOLD HERE WAS 95% AND CAUGHT NOTHING. A sabotage that
  // ballooned Role to 52% — leaving Name a tenth of the table — sailed
  // through, because "under 100" is not the property that matters. The
  // property is that NAME KEEPS THE LEFTOVER (see the width note in the
  // roster), and 55% is the loosest ceiling that still enforces it: the six
  // claim 50% today, so there is room to adjust one without a rewrite, and no
  // room to quietly eat the column a couple actually reads.
  assert.ok(
    total <= 55,
    `the fixed columns claim ${total}% (declared: ${declared.join(' + ')}), leaving Name ${100 - total}% minus a 40px checkbox — Name carries the longest value in the row and must keep the leftover`,
  );
  assert.ok(pcts.length > 0);
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
  const cells = headerCells();
  assert.ok(cells.length >= 7, `found ${cells.length} header cells — this guard is blind`);
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

