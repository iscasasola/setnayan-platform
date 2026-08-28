/**
 * Guard: a queue tile holding work cannot render the same colour as an empty one.
 *
 * WHAT WENT WRONG (measured 2026-08-28, on the owner's own console). The
 * Overview's `ActionQueueTile` had four states and only three surfaces. Work-
 * but-not-yet-late was `bg-white/75`; nothing-to-do was `bg-white/70`; and the
 * lane they nest in, `.sn-tile`, is `--m-paper` = #FFFFFF.
 *
 * 🔑 WHITE AT ANY ALPHA OVER WHITE IS WHITE. The two states did not merely look
 * alike — they composited to THE SAME PIXEL VALUE. A pending payment and three
 * zeros beside it were, by construction, indistinguishable but for a 3.5px
 * triangle and a 10px label. The owner: these cells "need to stand out when
 * there are things to decide on."
 *
 * An alpha step over a surface's own ground colour is not a difference. That is
 * what this file exists to stop coming back, and it is why the assertion is
 * about the four states being DISTINCT rather than about any one class name —
 * a guard pinned to `bg-white/75` would pass the day somebody wrote
 * `bg-white/80`.
 *
 * 🎨 It also pins the contrast rule the same change fixed. `--sn-warning`
 * (#B77E2E) on `--sn-warning-soft` (#F6EAD2) is 2.92:1 — under the 4.5:1 body
 * floor and under the 3:1 large-text floor the 30px numeral needs. The kit
 * ships `--sn-warning-deep` (#7A5119, 5.84:1) for exactly this pairing and says
 * so at the token definition. The amber family has almost no headroom: it
 * passes against white and fails against its own tint.
 *
 * Every value here is DERIVED from the page's own source with comments stripped
 * first — this file explains the defect in prose and quotes the old classes, so
 * a raw match would count the explanation as an implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, 'page.tsx');

/** Source with every comment form removed. */
function code(): string {
  return readFileSync(PAGE, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
}

/**
 * The `card:` class string of every branch of ActionQueueTile's tone ladder, in
 * source order: overdue · due-soon · open · clear.
 *
 * Sliced to the ladder itself rather than grepped file-wide, so an unrelated
 * `card:` key elsewhere on the page can never pad the list into a false pass.
 */
function toneCards(): string[] {
  const src = code();
  const start = src.indexOf('const tone = overdue');
  assert.notEqual(start, -1, 'ActionQueueTile tone ladder not found — did it move or get renamed?');
  const end = src.indexOf('};', start);
  assert.notEqual(end, -1, 'tone ladder has no terminator');
  const block = src.slice(start, end);
  return [...block.matchAll(/card:\s*'([^']+)'/g)].map((m) => m[1] as string);
}

test('the tone ladder still has four rungs', () => {
  assert.equal(toneCards().length, 4);
});

test('a tile with work does not render the same surface as a clear one', () => {
  const [, , open, clear] = toneCards();
  // The whole defect in one line: these two were `bg-white/75` and
  // `bg-white/70` over a #FFFFFF ground.
  assert.notEqual(open, clear, 'has-work and clear tiles share a surface class');
});

test('no two rungs of the ladder share a surface', () => {
  // Split from the assertion above on purpose: they fail for different
  // reasons, and a single test reporting one NAME for two rules sends the
  // reader after the wrong defect — the collapse mutation proved it.
  const cards = toneCards();
  assert.equal(
    new Set(cards).size,
    4,
    'two rungs of the tone ladder are the same surface — a state nobody can see is not a state',
  );
});

test('only the clear rung is plain white — work always tints', () => {
  const cards = toneCards();
  const white = cards.filter((c) => /bg-white\//.test(c));
  assert.deepEqual(
    white,
    [cards[3]],
    'a work-carrying rung is painted in white-on-white; alpha over its own ground colour is not a difference',
  );
});

test('no single class string paints plain amber text on the amber tint', () => {
  const src = code();
  // The rule is the PAIRING, not the token. `--sn-warning` as text is correct
  // on the obsidian focal (5.34:1 on #17160F) and wrong on `--sn-warning-soft`
  // (2.92:1) — the first cut of this guard banned the token outright and went
  // red on a line that was fine, which is how a guard teaches you to skim past
  // the one time it is right.
  const offenders = [...src.matchAll(/className=\{?[`'"]([^`'"]*)[`'"]/g)]
    .map((m) => m[1] as string)
    .filter(
      (cls) =>
        cls.includes('bg-[var(--sn-warning-soft)]') &&
        /text-\[(?:color:)?var\(--sn-warning\)\]/.test(cls),
    );
  assert.deepEqual(offenders, [], 'plain --sn-warning text on --sn-warning-soft is 2.92:1');
});

test('every warning-tinted rung of the tone ladder reads in the deep token', () => {
  const src = code();
  const start = src.indexOf('const tone = overdue');
  // `+ 1` on purpose: the ladder terminates in `};`, so slicing to the index
  // of that token drops the LAST branch's own closing brace and the parse
  // silently finds three objects where there are four.
  const end = src.indexOf('};', start);
  const block = src.slice(start, end + 1);
  // Split the ladder into its four branch objects and check each one whole:
  // the tint lives on `card` and the text on sibling keys, so a per-key scan
  // cannot see the pairing at all.
  const branches = [...block.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] as string);
  assert.equal(branches.length, 4, 'expected four tone branches');
  const tinted = branches.filter((b) => b.includes('bg-[var(--sn-warning-soft)]'));
  assert.ok(tinted.length >= 2, 'expected the due-soon AND has-work rungs to tint');
  for (const b of tinted) {
    assert.ok(
      !/text-\[(?:color:)?var\(--sn-warning\)\]/.test(b),
      'a warning-tinted rung reads in the plain amber token (2.92:1) instead of --sn-warning-deep',
    );
    assert.ok(
      b.includes('--sn-warning-deep'),
      'a warning-tinted rung carries no deep-token text at all',
    );
  }
});

test('the lane rollup chip reads in the deep token on its tint', () => {
  const src = code();
  const chip = src.slice(src.indexOf('const chip ='), src.indexOf('return { open, unavailable'));
  assert.ok(chip.includes('bg-[var(--sn-warning-soft)]'), 'rollup chip no longer tints');
  assert.ok(
    chip.includes('--sn-warning-deep'),
    'the rollup chip paints plain amber on its own tint (2.92:1)',
  );
});
