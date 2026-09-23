import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE BOOKING-FEE NOTICE IS A ROW, NOT A STACK (owner, 2026-09-22 → built 09-23).
 *
 * It shipped as an icon beside a block of three stacked paragraphs. The approved
 * prototype (`quote_maker_FINAL_2026-09-22.html`) draws it as a ROW: one left
 * cell that stacks the sentence over its sub-line, and the value on the right.
 *
 * 🔑 WHY EVERY ASSERTION HERE IS A POSITION AND NOT A PRESENCE. A row and the
 * stack it replaced contain exactly the same three things. "Does it render the
 * headline, the detail and the link" is true of BOTH, so a presence check passes
 * on the defect. What differs is WHERE they sit relative to each other, and each
 * of the four below has its own way of silently reverting to a stack while every
 * string is still on screen.
 *
 * ⚠ NOT A COPY CHANGE. The #5737 sentence is the owner's wording and is handed in
 * whole by `lib/booking-fee-disclosure.ts`. This component is deliberately dumb —
 * its own docblock says every word is decided one layer below "so a surface
 * cannot quietly reword the money". Splitting that sentence in here to make a
 * label/value pair would be precisely the defect that file exists to prevent, so
 * the row is built around the string rather than out of it.
 *
 * Sabotages watched red before commit:
 *   1. put the link back inside the text cell   → "the value is a sibling" fails
 *   2. drop `ml-auto` from the link             → "the value is pushed right" fails
 *   3. drop `min-w-0` from the left cell        → "a long sentence wraps" fails
 *   4. unwrap the headline and detail           → "one cell that stacks" fails
 */

const src = readFileSync(
  join(process.cwd(), 'app/_components/booking-fee-notice.tsx'),
  'utf8',
);

/** Just `BookingFeeNotice` — the file also holds the bill row and the waived rows. */
function noticeBody(): string {
  const start = src.indexOf('export function BookingFeeNotice(');
  assert.ok(start > 0, 'BookingFeeNotice was renamed or moved — re-point this guard');
  const next = src.indexOf('\nexport function ', start + 1);
  const body = src.slice(start, next === -1 ? src.length : next);
  assert.ok(body.includes('disclosure.headline'), 'the slice does not contain the component');
  assert.ok(
    !body.includes('vendorBookingFeePayPath'),
    'the slice leaked into BookingFeeBillRow — the window is wrong',
  );
  return body;
}

test('1 · the sentence and its sub-line are ONE cell that stacks', () => {
  const body = noticeBody();
  // In the stack this replaced, both were direct children of the container. A row
  // needs them wrapped together, or the "value" beside them is just a third line.
  const cell = body.match(/<span className="flex min-w-0 flex-1 flex-col[^"]*">([\s\S]*?)<\/span>\s*\{/);
  assert.ok(cell, 'the left cell is gone — headline and detail are loose in the row again');
  // A capture group is `string | undefined` even after the match is asserted, and an
  // EMPTY capture would satisfy a non-null check while proving nothing — so the
  // contents are bound once and required to be non-empty before being read.
  const inner = cell[1] ?? '';
  assert.ok(inner.length > 0, 'the left cell matched but captured nothing between its tags');
  assert.match(inner, /disclosure\.headline/, 'the headline left the cell');
  assert.match(inner, /disclosure\.detail/, 'the detail left the cell');
});

/**
 * The TRUE end of the left cell, by balancing <span> tags from its opening.
 *
 * ⚠ THIS FUNCTION EXISTS BECAUSE THE FIRST VERSION OF THIS GUARD WAS VACUOUS.
 * It took `indexOf('</span>', …detail…)` as the cell's end — but that is the
 * DETAIL span's own closing tag, one level too shallow. Every `{cta ?` in the
 * file sits after it, so the assertion was true whether the link was a sibling
 * of the cell or nested inside it. The sabotage that nests the link — the exact
 * defect this test is named for — passed.
 */
function leftCellEnd(body: string, start: number): number {
  let depth = 0;
  const tag = /<span\b|<\/span>/g;
  tag.lastIndex = start;
  for (let m = tag.exec(body); m; m = tag.exec(body)) {
    depth += m[0] === '</span>' ? -1 : 1;
    if (depth === 0) return m.index;
  }
  throw new Error('the left cell never closes — re-point this guard');
}

test('2 · the value is a SIBLING of the text cell, never inside it', () => {
  const body = noticeBody();
  const cellStart = body.indexOf('<span className="flex min-w-0 flex-1 flex-col');
  assert.ok(cellStart > 0, 'the left cell moved — re-point this guard');
  const cellEnd = leftCellEnd(body, cellStart);
  const inner = body.slice(cellStart, cellEnd);

  // Direct and unfoolable: the text cell must not mention the value at all.
  assert.ok(
    !inner.includes('cta'),
    'the link is back INSIDE the text cell — that is the stack this replaced, with the ' +
      'same three strings on screen and nothing missing',
  );
  const ctaAt = body.indexOf('{cta ?');
  assert.ok(ctaAt > cellEnd, 'the value must come after the text cell closes');
});

test('3 · the value is pushed right and refuses to wrap', () => {
  const body = noticeBody();
  const link = body.slice(body.indexOf('{cta ?'));
  assert.match(link, /ml-auto/, 'without ml-auto the link sits against the text, not at the row end');
  assert.match(
    link,
    /shrink-0/,
    'without shrink-0 a long sentence squeezes the link onto a third line — a stack again',
  );
});

test('4 · a long sentence wraps INSIDE the cell instead of pushing the value away', () => {
  const body = noticeBody();
  const cell = body.slice(
    body.indexOf('<span className="flex min-w-0 flex-1 flex-col'),
  );
  assert.match(
    cell.slice(0, 120),
    /min-w-0/,
    "a flex child's automatic minimum is its content, so without min-w-0 the cell will not " +
      'shrink and the value leaves the row',
  );
  assert.match(cell.slice(0, 120), /flex-1/, 'the cell must take the free space');
});

test('5 · the row still names itself, and the tone cue survives', () => {
  const body = noticeBody();
  // `the-exclusive-papic-on-a-quote` counts this row per LINE — two composers
  // mount the shape twice (the fee, and the Papic deal beside it).
  assert.match(body, /data-testid=\{testId\}/, 'the per-line name is what lets two mounts be told apart');
  // The prototype signals tone with colour alone. The icon is kept deliberately:
  // it is the only NON-COLOUR cue that an `overdue` fee is overdue.
  assert.match(body, /<Icon/, 'the tone icon is the only non-colour cue for the overdue arm');
});

/* ───────────────────────────────────────────────────────────────────────────
   ONE BOX, ROWS INSIDE IT (owner, from the preview, 2026-09-23).

   The row shape alone was half the change. Each block under Total carried its
   own border and `mt-3`, so the composer drew FOUR bordered cards with gaps
   where the prototype draws ONE box divided by hairlines — and from outside
   that reads as nothing having happened, because the visual weight is all in
   the borders.

   Sabotages watched red before commit:
     5. a notice goes back to framed={true} inside the container → box in a box
     6. the container loses `divide-y`                            → rows with no hairline
     7. the empty-container guard is dropped                      → a bordered box with nothing in it
   ─────────────────────────────────────────────────────────────────────────── */

const maker = readFileSync(
  join(process.cwd(), 'app/_components/proposal-maker.tsx'),
  'utf8',
);

test('6 · the composer draws ONE container, and its rows carry no frame of their own', () => {
  const at = maker.indexOf('data-testid="quote-money-rows"');
  assert.ok(at > 0, 'the money-rows container is gone — the four cards are back');
  const container = maker.slice(at, at + 400);
  assert.match(container, /overflow-hidden rounded-2xl border/, 'the container owns the border');
  assert.match(container, /divide-y divide-ink\/10/, 'rows must be separated by a hairline, not a gap');

  // Both notices inside it must be unframed, or each draws a box inside the box.
  const body = maker.slice(at);
  const mounts = body.match(/<BookingFeeNotice[\s\S]{0,220}?\/>/g) ?? [];
  assert.equal(mounts.length, 2, `expected 2 notices in the container, found ${mounts.length}`);
  for (const m of mounts) {
    assert.match(m, /framed=\{false\}/, `a notice kept its own frame inside the container:\n${m}`);
  }
});

test('7 · the container cannot render as an empty bordered box', () => {
  const at = maker.indexOf('data-testid="quote-money-rows"');
  assert.ok(at > 0, 're-point this guard');
  // The guard must sit BEFORE the container, gating it.
  const before = maker.slice(Math.max(0, at - 700), at);
  assert.match(
    before,
    /\{feeCopy \|\| giftSwitch !== null \|\| giftCopy \|\| papicCopy \?/,
    'all four children can be null at once — an ungated container then draws a bordered box ' +
      'with nothing in it, a defect the old stack could not have had',
  );
});

test('8 · standalone mounts are UNCHANGED — framed is opt-out, not opt-in', () => {
  // The other four surfaces mount the notice bare. If the default flipped, they
  // would all lose their border at once and nothing here would say so.
  assert.match(src, /framed = true,/, 'the default must stay framed, or every other surface loses its box');
});
