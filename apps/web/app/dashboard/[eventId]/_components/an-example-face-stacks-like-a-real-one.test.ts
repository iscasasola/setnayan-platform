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
  const compact = slice(drawHome({ control: fixtureControlEmpty('e1') }), 'data-home-control="compact"', ['data-home-control="detail"']);
  assert.ok(compact.length > 0, 'the compact control row was not drawn');

  const blocks = compact.split(/(?=<div class="[^"]*\bhc-example\b)/).slice(1);
  assert.ok(blocks.length >= 3, `expected the Guests, Event Hub and Suppliers Examples at least — found ${blocks.length}`);

  for (const block of blocks) {
    const at = block.search(/class="sn-example"[^>]*>/);
    assert.ok(at >= 0, 'an Example without its faded .sn-example sample');
    const divStart = block.lastIndexOf('<div', at);
    const sample = block.slice(divStart, divStart + endOfDiv(block.slice(divStart)));
    const inner = sample.slice(sample.indexOf('>') + 1, sample.lastIndexOf('</div>'));
    assert.match(inner, /class="hc-(big|sm|line)"/, `an Example with no face in it:\n${inner.slice(0, 160)}`);
    assert.match(inner, /^<div class="hc-face">/, `an Example's sample is not in the .hc-face box — its unit and small line run together:\n${inner.slice(0, 160)}`);
    assert.equal(endOfDiv(inner), inner.length, 'part of an Example\'s sample sits outside its .hc-face box');
  }
});

test('📐 .hc-face is the flex column that puts the unit and the small line on separate lines', () => {
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
  const rule = css.match(/\n\.hc-face \{([^}]*)\}/);
  assert.ok(rule, '.hc-face rule not found in globals.css');
  assert.match(rule[1], /display:\s*flex/, '.hc-face is no longer a flex box');
  assert.match(rule[1], /flex-direction:\s*column/, '.hc-face no longer stacks its spans');
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
