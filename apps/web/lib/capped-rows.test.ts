/**
 * A LIST ABOVE THE BENCH CANNOT PUSH THE BENCH OFF THE PAGE.
 *
 * Owner, 2026-09-22: *"if i have 100 vendors and i am inquire to all… i have 100
 * messages from suppliers. i will not be able to see the bench anymore."*
 *
 * He was describing shipped behaviour. `waiting-for-quotes.tsx` and
 * `pending-lock-proposals.tsx` each rendered a bare `items.map(...)`, and
 * `vendors/page.tsx` renders BOTH above `<ShortlistCategories>`. Measured in the
 * approved prototype at phone width: the bench began **4,806px** down with 100
 * pending inquiries, against **757px** capped — about five screens before a
 * couple could look for anybody.
 *
 * ─── THE TWO PROPERTIES THAT MATTER MOST ARE THE NEGATIVE ONES ──────────────
 *
 * A cap is easy to write and easy to get wrong in ways that read as working:
 *
 *   • **"…and 0 more"** on a list of exactly the ceiling length. A remainder
 *     line that reports nothing is worse than no line, because it tells the
 *     couple something is hidden when nothing is. `hiddenMoreLabel` returns
 *     `null` there, so the phrase is unrepresentable — and the tests below
 *     assert the null, not the wording.
 *   • **Hiding rows on a broken ceiling.** A zero or NaN ceiling must return
 *     everything. "Hidden by arithmetic" looks exactly like "they are not
 *     there", which is the disease this project has shipped seven fixes for.
 *
 * And the count in the phrase must be the REAL remainder, never a guess: the
 * 100-row case asserts 97, not "a lot".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { capRows, hiddenMoreLabel, DEFAULT_ROW_CEILING } from './capped-rows';

const rows = (n: number) => Array.from({ length: n }, (_, i) => `row-${i + 1}`);

test('the ceiling is 3, and the owner’s 100-row case shows 3 and counts 97', () => {
  assert.equal(DEFAULT_ROW_CEILING, 3);
  const { shown, hiddenCount } = capRows(rows(100));
  assert.equal(shown.length, 3, 'only the ceiling renders above the bench');
  assert.equal(hiddenCount, 97, 'the remainder is the real number, not a guess');
  assert.deepEqual(shown, ['row-1', 'row-2', 'row-3'], 'order is preserved — these strips are oldest-first');
  assert.equal(
    hiddenMoreLabel(hiddenCount, 'waiting for a quote'),
    '…and 97 more waiting for a quote',
  );
});

test('🪤 a list of exactly the ceiling length says NOTHING about a remainder', () => {
  const { shown, hiddenCount } = capRows(rows(DEFAULT_ROW_CEILING));
  assert.equal(shown.length, 3, 'all three show');
  assert.equal(hiddenCount, 0);
  assert.equal(
    hiddenMoreLabel(hiddenCount, 'proposals'),
    null,
    'null is the mechanism: with no string there is no row, so "…and 0 more" cannot render',
  );
});

test('a short list is untouched, and an empty list stays empty', () => {
  for (const n of [1, 2]) {
    const r = capRows(rows(n));
    assert.equal(r.shown.length, n, `${n} row(s) must render in full`);
    assert.equal(r.hiddenCount, 0);
    assert.equal(hiddenMoreLabel(r.hiddenCount, 'proposals'), null);
  }
  // ⚠ Empty must produce NO rows and NO remainder. Both strips return null on
  // an empty list and still do; this is what keeps that true through the cap.
  const empty = capRows([]);
  assert.deepEqual(empty.shown, []);
  assert.equal(empty.hiddenCount, 0);
  assert.equal(hiddenMoreLabel(empty.hiddenCount, 'waiting for a quote'), null);
});

test('🪤 a broken ceiling hides NOTHING — it fails open', () => {
  // A bad constant must never swallow a couple's suppliers. Hidden-by-arithmetic
  // is indistinguishable on screen from absent.
  for (const bad of [0, -1, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const { shown, hiddenCount } = capRows(rows(9), bad);
    assert.equal(shown.length, 9, `ceiling ${String(bad)} must show everything`);
    assert.equal(hiddenCount, 0, `ceiling ${String(bad)} must claim no remainder`);
  }
});

test('null and undefined are lists of nothing, not a throw', () => {
  // These strips are fed from an enrichment pass that can hand back nothing.
  for (const v of [null, undefined]) {
    const r = capRows(v as unknown as string[]);
    assert.deepEqual(r.shown, []);
    assert.equal(r.hiddenCount, 0);
  }
});

test('a fractional ceiling floors rather than producing half a row', () => {
  const { shown, hiddenCount } = capRows(rows(10), 3.7);
  assert.equal(shown.length, 3);
  assert.equal(hiddenCount, 7, 'shown + hidden must always equal the input length');
});

test('shown + hidden === the input length, for every size around the ceiling', () => {
  // The invariant a cap can silently break: losing or double-counting a row.
  for (let n = 0; n <= 12; n += 1) {
    const { shown, hiddenCount } = capRows(rows(n));
    assert.equal(shown.length + hiddenCount, n, `n=${n} lost or duplicated a row`);
  }
});

test('the remainder phrase never renders a zero, whatever it is handed', () => {
  for (const n of [0, -1, -97, Number.NaN]) {
    assert.equal(hiddenMoreLabel(n, 'proposals'), null, `hiddenMoreLabel(${String(n)}) must be null`);
  }
  assert.equal(hiddenMoreLabel(1, 'proposals'), '…and 1 more proposals');
});

/* ── AND THE TWO COMPONENTS ACTUALLY USE IT ─────────────────────────────────
   The arithmetic above is executed, but a correct module wired to nothing is
   the shape of a guard that proves the call exists and nothing about the
   render. So this reads the two files and asserts the uncapped map is GONE.

   `items.slice(shown.length).map(...)` is legitimate — that is the remainder
   inside the disclosure — so the assertion is specifically against `items.map(`,
   the whole-list render that put the bench 4,806px down.

   🪤 AND IT MUST READ CODE, NOT PROSE. The first version of this guard fired on
   the docblock I had just written, which QUOTES `items.map(...)` as the thing
   that used to happen — convicting the fix for describing the defect. It now
   strips comments first, through the repo's canonical `stripComments`
   (`lint-one-comment-stripper.mjs` exists to keep there being exactly one). A
   phrasing ban that cannot tell code from a comment about code will eventually
   forbid explaining itself. */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const COMPONENTS = ['waiting-for-quotes.tsx', 'pending-lock-proposals.tsx'];

test('neither strip renders its whole list any more', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const file of COMPONENTS) {
    const src = stripComments(
      readFileSync(join(here, '..', 'app/dashboard/[eventId]/vendors/_components', file), 'utf8'),
    );
    assert.match(src, /from '@\/lib\/capped-rows'/, `${file}: must import the cap`);
    assert.match(src, /capRows\(items\)/, `${file}: must cap the list it was handed`);
    assert.doesNotMatch(
      src,
      /\bitems\.map\(/,
      `${file}: still maps the WHOLE list — this is the defect the owner reported`,
    );
    assert.match(src, /hiddenMoreLabel\(/, `${file}: the remainder must be worded by the shared helper`);
    // The remainder is reachable in place, not linked to a route that may not exist.
    assert.match(src, /<details/, `${file}: the hidden rows must fold in place`);
    // ⚠ AND EMPTY MUST STILL BE EMPTY. Both strips returned null on an empty
    // list before the cap; a cap that invented a header for nothing would be a
    // new way to tell a couple something is there when it is not.
    assert.match(
      src,
      /length === 0\) return null/,
      `${file}: must still render NOTHING on an empty list`,
    );
  }
});
