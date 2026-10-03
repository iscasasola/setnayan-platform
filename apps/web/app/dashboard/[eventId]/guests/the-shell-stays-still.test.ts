import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * Five owner corrections to the guest-list shell (2026-09-21), each one a
 * defect every other check passed: the typecheck, all 32 CI guards and the
 * full suite were green while each of these was on the owner's screen.
 */

const C = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests', '_components');
const read = (f: string) => stripComments(readFileSync(join(C, f), 'utf8'));

test('opening the add box never scrolls the page', () => {
  // Owner: "there is like an unbalanced motion making the table nudge down a
  // bit when pressed." Measured: a plain focus() scrolls the focused box into
  // view. ⤷ 2026-10-01: the name box lives in the round +'s add sheet now, so
  // the rule follows it there.
  const src = read('add-guest-sheet.tsx');
  const calls = src.match(/\.focus\(([^)]*)\)/g) ?? [];
  assert.ok(calls.length >= 1, 'found no focus() call — this guard is blind');
  for (const c of calls) {
    assert.match(c, /preventScroll:\s*true/, `${c} can scroll the page — the table nudges down on every open`);
  }
});

// ⤷ 2026-09-30 (Fix E): two corrections here guarded `arrange-controls.tsx` —
// the header's sort labels in capitals and no "§" beside a grouping box. That
// header was deleted (every column header is ONE slot dropdown now, and Sort ▾
// above the list is the one place for order), so they left with it.

test('the honoree heading folds like every other one', () => {
  // Owner: "these rows should be able to make the content of that grouping
  // collapse and expand like an accordion." Pinned means FIRST, not open.
  // ⤷ 2026-10-03 (measured live: the pinned heading flipped aria-expanded and
  // its cards stayed): the fold lives in ONE place now, `foldSections`, for the
  // honoree exactly as for every other key — held in full by
  // `_components/every-heading-folds.test.ts`.
  const src = read('guest-list-multiselect.tsx');
  assert.match(src, /key: 'honoree',/, 'the pinned Bride & Groom section is gone');
  assert.match(
    src,
    /const sections = useMemo\(\(\) => foldSections\(builtSections, collapsed\)/,
    'the pinned Bride & Groom section ignores its own fold',
  );
  assert.ok(!/if \(!onToggle \|\| pinned\)/.test(src), 'a pinned heading renders without its fold button again');
});

test('the add icon sits INSIDE its box, at the end', () => {
  // Owner: "place this at the end of the text box inside the search text box
  // and same to the add text box. insert the + inside."
  // ⤷ 2026-10-01: the search box left the page for the top bar (owner
  // 2026-09-30), so only the add half of this correction still lives here.
  // ⤷ 2026-10-02: the + is a real BUTTON now (owner, live iPhone test: "tapping
  // + did nothing") — still inside the box at its end, 44 px wide, so the text
  // stops 44 px short of the edge.
  const src = read('capture-bar.tsx');
  assert.notEqual(src.search(/data-capture-add=""\s+className="absolute right-0 /), -1, 'capture-bar.tsx: the + is not inside the box at its end');
  // …and the text stops before it rather than running under it.
  assert.match(src, /input-field w-full pr-11/, 'the add text can run under its button');
});
