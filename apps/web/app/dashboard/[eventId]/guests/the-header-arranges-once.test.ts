import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * ⚖ Owner 2026-09-20, on the roster header: *"add a checkbox beside them so we
 * can set how they are arranged"* — one cell, two controls.
 *
 * 🪤 THE DEFECT THIS EXISTS FOR IS SILENT AND LOOKS LIKE A DEAD CONTROL. A
 * `<label>` that WRAPS its `<input>` forwards one synthetic click to that
 * input. If the label ALSO carries a click handler, the grouping toggles twice
 * — on, then off — and the header reads exactly like a checkbox that does
 * nothing. No error, no log, no visual difference from "not wired up yet".
 *
 * The repo has no DOM test runner, so this cannot be clicked here. What it CAN
 * do is pin the two structural facts that make the double-fire possible, and
 * they are the whole of the bug: the handler lives on the input, and the label
 * around it carries none.
 */

const SRC = readFileSync(
  join(
    process.cwd(),
    'app',
    'dashboard',
    '[eventId]',
    'guests',
    '_components',
    'arrange-controls.tsx',
  ),
  'utf8',
);

/** The JSX of every `<label …>` opening tag, including its attributes. */
function labelTags(): string[] {
  return [...SRC.matchAll(/<label\b[\s\S]*?>/g)].map((m) => m[0]);
}

test('no label carries its own click handler', () => {
  const tags = labelTags();
  assert.ok(tags.length >= 2, `found ${tags.length} labels — this guard is blind`);
  for (const tag of tags) {
    assert.doesNotMatch(
      tag,
      /onClick=/,
      `a label with an onClick around a checkbox fires TWICE — the grouping would toggle on and straight back off:\n${tag}`,
    );
  }
});

test('every grouping checkbox changes state through onChange, not onClick', () => {
  // onClick on the input itself is fine for firing order but wrong for
  // keyboard: Space on a focused checkbox fires change, and some assistive
  // tech drives it the same way. onChange is the one that always runs.
  const inputs = [...SRC.matchAll(/<input\b[\s\S]*?\/>/g)].map((m) => m[0]);
  const boxes = inputs.filter((i) => /type="checkbox"/.test(i));
  assert.equal(boxes.length, 2, `expected the desktop box and the sheet box, found ${boxes.length}`);
  for (const box of boxes) {
    assert.match(box, /onChange=\{\(\) => toggleGroup\(/, `checkbox does not call toggleGroup on change:\n${box}`);
    assert.doesNotMatch(box, /onClick=/, `checkbox uses onClick — a label click then fires both:\n${box}`);
  }
});

test('the sorting control is a BUTTON, so the two jobs cannot be one hit target', () => {
  // If the label were the sort control, there would be no way to group by a
  // column without also sorting by it — which is the exact coupling this
  // change exists to undo (one ?sort= used to decide both).
  assert.match(
    SRC,
    /<button[\s\S]{0,400}?onClick=\{\(\) => setSort\(column\)\}/,
    'the column label no longer sets the sort',
  );
});

test('a URL write always merges — never replaces — the existing params', () => {
  // 🪤 Building a fresh URLSearchParams would drop ?q=, ?rsvp=, ?view= and the
  // rest, so arranging a filtered list would silently unfilter it. Same
  // contract as sort-select.tsx and live-search.tsx: read the LATEST params
  // inside the handler so a filter click mid-interaction is not clobbered.
  assert.match(
    SRC,
    /new URLSearchParams\(searchParams\.toString\(\)\)/,
    'the arrange controls build params from scratch instead of merging',
  );
  assert.match(SRC, /router\.replace\([\s\S]{0,120}\{ scroll: false \}\)/,
    're-arranging the list would throw the host back to the top of it');
});

test('an emptied grouping is WRITTEN, not deleted from the URL', () => {
  // ⚠ Absent and empty are different answers: absent derives the old
  // sort-driven sectioning (for bookmarked links), empty means "no headings".
  // `p.delete('by')` would hand the host back the default they just switched
  // off, and the checkbox would appear to refuse to untick.
  assert.match(SRC, /p\.set\('by', serializeGrouping\(next\)\)/);
  assert.doesNotMatch(SRC, /\.delete\('by'\)/);
});
