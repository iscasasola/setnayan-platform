/**
 * a-picked-part-brings-its-plus.test.ts — R04 of the re-walk (2026-10-11): a tall part (Dress code, Invitation ›
 * Details) showed NEITHER ＋ when tapped; "the one above sits at the canvas's top edge until the canvas is scrolled".
 *
 * A ＋ is drawn on the frame's edge only where that edge is `PART_EDGE_ROOM` inside the page's visible band
 * (`add-part-sheet.tsx` `onEdge` — never clamped onto the part: owner, on a ＋ that sat on the pass's QR). The frame's
 * edge is up to PART_PAD outside the part. `partPickScroll` is where a pick brings the part:
 *
 *   1. after the pick, the ＋ that adds ABOVE is in view for a part of ANY height, at both phone heights' bands;
 *   2. a part whose whole frame fits is centred and BOTH ＋ are in view; a taller one is lined up by its top (the lower
 *      ＋ is at the part's end — it cannot be in view with the upper one, and is never drawn on the part);
 *   3. the two files use the one rule and the one number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { PART_EDGE_ROOM, partFrameEdges, partPickScroll } from './maker-stage-room';

const PAD = 22;
/** The band the canvas shows above the guest bar — measured in the Maker at 375 × 667 and 375 × 812 (and two between). */
const BANDS = [279, 315, 424, 460];
/** After the pick: is the frame's top / bottom edge where `onEdge` draws a ＋? (No neighbour: the full pad.) */
function after(height: number, band: number, startTop: number) {
  const top = startTop - partPickScroll({ top: startTop, height }, band, PAD);
  const fe = partFrameEdges({ top, height }, null, null, PAD);
  const on = (y: number) => y >= PART_EDGE_ROOM && y <= band - PART_EDGE_ROOM;
  return { top, above: on(fe.top), below: on(fe.bottom) };
}

test('1 · after a pick the ＋ that adds above is in view — a part of any height, wherever it was, at every band', () => {
  let n = 0;
  for (const band of BANDS) for (let height = 20; height <= 1600; height += 7) for (const startTop of [-900, -40, 0, 12, 300, 2000]) {
    const a = after(height, band, startTop);
    assert.ok(a.above, `a ${height}px part in a ${band}px band: the upper ＋ is off the band (part top at ${a.top})`);
    n += 1;
  }
  assert.ok(n > 5000);
  /* The tester's case — a tall Dress code: it was lined up 12 px under the band's top, its frame's edge 10 px ABOVE it. */
  const old = partFrameEdges({ top: 12, height: 900 }, null, null, PAD).top;
  assert.ok(old < PART_EDGE_ROOM, 'anti-vacuity: the old place did hide the upper ＋');
});

test('2 · a part whose frame fits is centred with BOTH ＋ in view; a taller one is lined up by its top', () => {
  for (const band of BANDS) {
    const fits = band - 2 * (PAD + PART_EDGE_ROOM + 4);
    for (let height = 20; height <= fits; height += 5) {
      const a = after(height, band, 500);
      assert.ok(a.above && a.below, `a ${height}px part fits a ${band}px band and a ＋ is hidden`);
      assert.ok(Math.abs(a.top + height / 2 - band / 2) < 0.01, 'a part that fits is not centred');
    }
    /* One pixel taller than "fits": by its top — before this, a part a little shorter than the band was centred
       with BOTH edges off it. */
    const tall = after(fits + 1, band, 500);
    assert.equal(tall.top, PAD + PART_EDGE_ROOM + 4);
    assert.equal(tall.above, true);
  }
});

test('3 · the toolbar brings a part with this rule, and the frame hides a ＋ by the same number', () => {
  const tools = readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/stage-tools.tsx'), 'utf8');
  assert.match(tools, /const dy = partPickScroll\(\{ top: r\.top, height: r\.height \}, band, PART_PAD\);/);
  assert.doesNotMatch(tools, /r\.height >= band - 24 \? r\.top - 12/, 'the old 12 px line-up is back');
  const sheet = readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx'), 'utf8');
  assert.match(sheet, /const onEdge = \(y: number\) => !band \|\| \(y >= band\.top \+ PART_EDGE_ROOM && y <= band\.bottom - PART_EDGE_ROOM\);/);
  assert.match(sheet, /export const PART_PAD = 22;/);
  assert.equal(PART_EDGE_ROOM, 26);
});
