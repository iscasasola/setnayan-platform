/**
 * 📐 AN EXAMPLE FACE STACKS LIKE A REAL ONE — the greyed "Example" under a Home counter keeps its unit and its small
 * line apart (bug seen live 2026-11-11 at 390 px: *"128 comingof 180 on the list"*, *"Save the Date liveguests see
 * it"*, *"4 of 6 booked2 still to book"*).
 *
 * Cause: `FaceBody` returns SIBLING INLINE SPANS (`.hc-big` with its `<small>` unit, then `.hc-sm`). A real face puts
 * them in `.hc-face` — a flex column with a 5-px gap — so each is its own line. The Example drew the same `FaceBody`
 * straight inside `.sn-example` (a plain block), so the spans flowed inline with no whitespace between them.
 *
 * Fix: the Example's `FaceBody` sits in the SAME `.hc-face` box the real face uses, in the one shared render
 * (`home-tile.tsx`) — never a space typed into a face's strings.
 *
 * Properties:
 *   1 · On an empty event, EVERY Example drawn on Home's control row opens its sample with `<div class="hc-face">`,
 *       and every `.hc-big` / `.hc-sm` / `.hc-line` in it sits inside that box.
 *   2 · `.hc-face` is still the flex column that makes those spans separate lines.
 *
 * Sabotage (each went RED): dropping the `<div className="hc-face">` wrapper in `home-tile.tsx` (1) · changing
 * `.hc-face`'s `flex-direction: column` to `row` in `globals.css` (2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('📐 every Home Example opens its sample in the real face box', async () => {
  const { fixtureControlEmpty } = await import('@/lib/home-control-fixture');
  const { drawHome, loadHome, slice } = await import('@/app/dashboard/[eventId]/home-render.harness');
  await loadHome();
  // 🌐 RE-AIMED 23 Nov 2026 (owner, v5 drawing in the website look): the phone's compact tiles are retired — the board's
  // cards are the ONE copy at every width, with the Schedule the one tile among them. A card's Example draws the card's
  // own LINES (`DetailExample`: `.sg-status` · `.sg-meter`, each a block of its own); the Schedule tile's Example keeps
  // the real `.hc-face` box. Either way the unit and the small line can never run together.
  const html = drawHome({ control: fixtureControlEmpty('e1') });
  assert.equal(html.split('data-home-control="compact"').length - 1, 0, 'the retired compact control row is back');
  const board = slice(html, 'data-home-control="board"', ['data-home-services']);
  assert.ok(board.length > 0, 'the board was not drawn');

  const blocks = board.split(/(?=<div class="[^"]*\bhc-example\b)/).slice(1);
  assert.ok(blocks.length >= 3, `expected the Guests, Event Hub and Suppliers Examples at least — found ${blocks.length}`);

  let tileExamples = 0;
  for (const block of blocks) {
    const at = block.search(/class="sn-example"[^>]*>/);
    assert.ok(at >= 0, 'an Example without its faded .sn-example sample');
    const divStart = block.lastIndexOf('<div', at);
    const sample = block.slice(divStart, divStart + endOfDiv(block.slice(divStart)));
    const inner = sample.slice(sample.indexOf('>') + 1, sample.lastIndexOf('</div>'));
    if (/^<div class="hc-face">/.test(inner) || /class="hc-(big|sm|line)"/.test(inner)) {
      tileExamples++;
      assert.match(inner, /^<div class="hc-face">/, `a tile Example's sample is not in the .hc-face box — its unit and small line run together:\n${inner.slice(0, 160)}`);
      assert.equal(endOfDiv(inner), inner.length, 'part of a tile Example\'s sample sits outside its .hc-face box');
      continue;
    }
    // A card's Example: every top-level piece is one of the card's block lines — never a bare inline span.
    const tops = [...inner.matchAll(/(?:^|<\/(?:span|div)>)<(span|div) class="([^"]*)"/g)].map((m) => m[2]!);
    assert.ok(tops.length > 0, `an Example with no line in it:\n${inner.slice(0, 160)}`);
    for (const c of tops) assert.match(c, /\bsg-(status|meter)\b/, `a card Example draws a piece that is not one of its lines ("${c}"):\n${inner.slice(0, 160)}`);
  }
  assert.ok(tileExamples >= 1, 'anti-vacuity: the Schedule tile drew no Example on an empty event');
});

test('📐 a card Example’s line is a block of its own (.sg-status is a flex line)', () => {
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
  const rule = css.match(/\n\.sg-status \{([^}]*)\}/);
  assert.ok(rule, '.sg-status rule not found in globals.css');
  assert.match(rule[1] ?? '', /display:\s*flex/, '.sg-status is no longer its own line');
});

test('📐 .hc-face is the flex column that puts the unit and the small line on separate lines', () => {
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
  const rule = css.match(/\n\.hc-face \{([^}]*)\}/);
  assert.ok(rule, '.hc-face rule not found in globals.css');
  const body = rule[1] ?? '';
  assert.match(body, /display:\s*flex/, '.hc-face is no longer a flex box');
  assert.match(body, /flex-direction:\s*column/, '.hc-face no longer stacks its spans');
});

/** Index just past the `</div>` closing the `<div …>` that `html` starts with. */
function endOfDiv(html: string): number {
  let depth = 0;
  const re = /<div\b|<\/div>/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return html.length;
}
