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

test('switching search ↔ add never scrolls the page', () => {
  // Owner: "there is like an unbalanced motion making the table nudge down a
  // bit when pressed." Measured: a plain focus() scrolls the focused box into
  // view — 8px with this row tucked under the sticky top bar. The row has just
  // been CLICKED, so it is on screen; nothing should move but the width.
  const src = read('find-add-row.tsx');
  const calls = src.match(/\.focus\(([^)]*)\)/g) ?? [];
  assert.ok(calls.length >= 1, 'found no focus() call — this guard is blind');
  for (const c of calls) {
    assert.match(c, /preventScroll:\s*true/, `${c} can scroll the page — the table nudges down on every switch`);
  }
});

// ⤷ 2026-09-30 (Fix E): two corrections here guarded `arrange-controls.tsx` —
// the header's sort labels in capitals and no "§" beside a grouping box. That
// header was deleted (every column header is ONE slot dropdown now, and Sort ▾
// above the list is the one place for order), so they left with it.

test('the honoree heading folds like every other one', () => {
  // Owner: "these rows should be able to make the content of that grouping
  // collapse and expand like an accordion." Pinned means FIRST, not open.
  const src = read('guest-list-multiselect.tsx');
  assert.match(
    src,
    /guests:\s*collapsed\.has\('honoree'\)\s*\?\s*\[\]\s*:\s*honorees/,
    'the pinned Bride & Groom section ignores its own fold',
  );
  assert.ok(!/if \(!onToggle \|\| pinned\)/.test(src), 'a pinned heading renders without its fold button again');
});

test('both icons sit INSIDE their boxes, at the end', () => {
  // Owner: "place this at the end of the text box inside the search text box
  // and same to the add text box. insert the + inside."
  for (const [file, icon] of [['guests-search.tsx', 'Search'], ['capture-bar.tsx', 'Plus']] as const) {
    const src = read(file);
    const at = src.search(new RegExp(`<${icon}\\s[^>]*absolute right-3`));
    assert.notEqual(at, -1, `${file}: the ${icon} icon is not inside the box at its end`);
  }
  // …and the text stops before it rather than running under it.
  assert.match(read('guests-search.tsx'), /className="w-full pr-9"/, 'the search text can run under its icon');
  assert.match(read('capture-bar.tsx'), /input-field w-full pr-9/, 'the add text can run under its icon');
});
