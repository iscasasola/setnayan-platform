/**
 * a-clipped-fold-head-never-pins.test.ts — a fold head inside a CLIPPING box does not pin.
 *
 * 🔴 Owner, iPhone, live card maker, 2026-11-04: "More settings" opened onto a ~150 px blank, and "Price · more" drew
 * over the first row inside it ("How the 'from' price works" — half its text showing). Measured in Playwright (WebKit
 * AND Chromium, 390×844, /dev/card-maker-lab): the nested head was `position: sticky; top: calc(pin line + 40px)`, and
 * its nearest scrollport was the PARENT fold's `overflow: hidden` body — so it stuck 40 px (+ the top bar in the app)
 * down inside its own fold: a gap above it, its first row under it (head 488–540, first row 504–548).
 *
 * No DOM in this runner: the rule is read from the source, comments stripped.
 * Sabotage (2026-11-04): the `=== 'hidden'` early return removed → red; restored green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, 'fold.tsx'), 'utf8'));

test('the pin looks for its scrollport and gives up on a box that only clips', () => {
  const fn = src.slice(src.indexOf('function useSlimPin'), src.indexOf('export function Fold'));
  assert.ok(fn.length > 200, 'useSlimPin is gone');
  assert.match(
    fn,
    /if \(cs\.overflowY === 'hidden' \|\| cs\.overflowX === 'hidden'\) return;/,
    'a nested head pins inside its parent fold’s clip again — the blank band and the covered row come back',
  );
  const giveUp = fn.indexOf("cs.overflowY === 'hidden'");
  const pins = fn.indexOf("pin.setAttribute('data-fold-pin'");
  assert.ok(giveUp > 0 && pins > giveUp, 'the clip check runs after the head is already made sticky');
});

// Owner, 2026-11-04, the other half: "there is a group inside it, price, discounts, these should pin under the more
// settings?" — so the parent must STOP clipping once it is open and still (`popovers`), and the nested head must
// re-check at that moment. Measured after (WebKit 390×844): "More settings" slim at top 0, "Price · more" slim at 40.
test('a nested head re-checks when its parent stops clipping, and the maker’s More settings stops clipping', () => {
  assert.match(src, /const parentClips = useContext\(FoldClips\);/);
  assert.match(src, /\}, \[on, depth, parentClips\]\);/, 'a nested head no longer re-checks when its parent settles');
  assert.match(src, /<FoldClips\.Provider value=\{!\(popovers && open && settled\)\}>/);
  assert.match(src, /-mx-1 min-h-0 min-w-0 /, 'an unclipped fold can be widened past the screen by its widest row');
  const maker = stripComments(readFileSync(join(__dirname, '..', 'vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8'));
  const at = maker.indexOf('anchor={MORE_ANCHOR}');
  assert.ok(at > 0 && /^\s*popovers\b/.test(maker.slice(at + 'anchor={MORE_ANCHOR}'.length)), 'More settings clips again — its groups cannot pin under it');
});
