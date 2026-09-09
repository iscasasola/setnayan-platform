/**
 * A STEP THAT CANNOT LOAD MUST COST THAT STEP — NEVER THE STORY MAKER.
 *
 * `/dashboard/[eventId]/story` is a Server Component, so **a throw anywhere in
 * it takes the WHOLE route**: the desk, the shipped editor, the theme step, the
 * cover, what's next and the publish ladder all vanish together and the host
 * gets a failed page. The route already knows this — the desk load carries the
 * rule in its own words, *"a desk that cannot load must not take the shipped
 * editor down with it"* — and the two loads added by 08 steps 1.5 + 1.7 shipped
 * WITHOUT it in the first cut.
 *
 * 🔑 THE RULE WAS ALREADY IN THE FILE, TWENTY LINES ABOVE THE DEFECT. That is
 * why this guard exists at all: re-reading the page did not catch it, and the
 * next optional load will be written by somebody who has also read the desk's
 * comment and still forgotten. So the rule is enforced rather than described.
 *
 * ── WHY IT WALKS BRACKETS INSTEAD OF COUNTING ───────────────────────────────
 * ⚠ "At least three `try` blocks" would be a THRESHOLD, and a threshold is not a
 * guard: this repo has watched one go green while a sabotage deleted one of four
 * arms. This resolves each loader's ACTUAL position against the enclosing `try`
 * regions, so removing the guard from any single load fails, and adding an
 * unrelated `try` elsewhere cannot compensate.
 *
 * ⚠ AND IT READS CODE, NOT PROSE. The source goes through the repo's one comment
 * stripper first — `lib/strip-comments.ts` — because every loader named below is
 * also DISCUSSED in the comments above it, and a match inside a comment would
 * make this guard green on a page that had lost the try entirely.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');

/**
 * Every offset that lies inside a `try { … }` block, as a list of [start, end)
 * ranges. Brace-depth walk: on `try` + `{` we remember the depth, and the block
 * closes when depth returns to it.
 */
function tryRanges(src: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const open: Array<{ startedAt: number; depth: number }> = [];
  let depth = 0;
  for (let i = 0; i < src.length; i += 1) {
    if (src.startsWith('try', i) && /\s*\{/.test(src.slice(i + 3, i + 8))) {
      const brace = src.indexOf('{', i + 3);
      if (brace > -1) open.push({ startedAt: brace, depth });
    }
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      const last = open[open.length - 1];
      if (last && depth === last.depth) {
        ranges.push([last.startedAt, i]);
        open.pop();
      }
    }
  }
  return ranges;
}

function insideTry(src: string, index: number): boolean {
  return tryRanges(src).some(([start, end]) => index > start && index < end);
}

/**
 * Every optional load on this page — a read whose failure must degrade one
 * section rather than the route.
 *
 * ⛔ `hostUserId` is deliberately NOT here. It answers "who is this?", and a
 * failure to establish authority must NOT degrade into rendering anything; it
 * already fails closed by returning null.
 */
const OPTIONAL_LOADS = [
  { call: 'loadDesk(', what: 'the desk' },
  { call: 'loadCoverCandidates(', what: 'the cover step’s candidates (08 step 1.5)' },
  { call: 'getCreatableEventTypes(', what: 'the what’s-next roster (08 step 1.7)' },
];

test('every optional load on the Story Maker is inside a try', () => {
  const src = stripComments(readFileSync(PAGE, 'utf8'));

  for (const { call, what } of OPTIONAL_LOADS) {
    const at = src.indexOf(call);
    assert.notEqual(
      at,
      -1,
      `${call} is no longer called on this page — if it moved, move this guard with it ` +
        `rather than deleting the entry, or ${what} loses its fence silently`,
    );
    assert.ok(
      insideTry(src, at),
      `${what} is loaded OUTSIDE a try. This is a Server Component: if that read ` +
        `throws, the host loses the entire Story Maker — desk, editor, theme, cover, ` +
        `what's next and the publish ladder — not just ${what}.`,
    );
  }
});

/**
 * ⚠ THE GUARD'S OWN PLUMBING IS A PLACE THE ANSWER CAN BE MANUFACTURED. If
 * `tryRanges` silently returned "everything is inside a try", the test above
 * would be green on a page with no fences at all. So it is exercised on inputs
 * whose answer is known, INCLUDING a negative — a call after the block closes.
 */
test('the bracket walk itself distinguishes inside from outside', () => {
  const src = 'a(); try { b(); } catch { c(); } d();';
  assert.equal(insideTry(src, src.indexOf('a(')), false, 'before the try read as inside');
  assert.equal(insideTry(src, src.indexOf('b(')), true, 'inside the try read as outside');
  assert.equal(insideTry(src, src.indexOf('d(')), false, 'after the try read as inside');

  // Nested braces inside the try must not close it early.
  const nested = 'try { if (x) { y(); } z(); } catch {}';
  assert.equal(insideTry(nested, nested.indexOf('z(')), true, 'a nested block closed the try early');
});
