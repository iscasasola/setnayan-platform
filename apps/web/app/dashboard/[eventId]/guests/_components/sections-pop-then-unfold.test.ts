/**
 * sections-pop-then-unfold.test.ts — A SECTION POPS, THEN UNFOLDS; ITS PINNED
 * HEADER'S FIRST TAP GOES BACK TO THE TOP (Maker PR 4f · G13, G21, G23 ·
 * BUTTON_RULE 6). Owner 2026-10-07: *"full animation"* · *"follow the same
 * concept on suppliers where we can pin on top"* · *"first tap will always go to
 * top? second tap will collapse?"* · *"same rule on guests"*.
 *
 * SABOTAGE (seen red): drop the 120 ms delay on the unfold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8'));

test('pop, then unfold: the marker pops and the fold opens 120 ms later', () => {
  assert.match(CSS, /\.open > \.barWrap \.ico \{\s*animation: gs-catpop 420ms/, 'the marker does not pop');
  const open = CSS.slice(CSS.indexOf('.open > .fold {'), CSS.indexOf('}', CSS.indexOf('.open > .fold {')));
  assert.match(open, /grid-template-rows: 1fr;/);
  assert.match(open, /transition-delay: 120ms;/, 'the fold opens with the pop, not after it');
  assert.match(CSS, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.open > \.barWrap \.ico/, 'reduced motion still pops');
});

test('the open section’s header pins under the sticky block', () => {
  const pinned = CSS.slice(CSS.indexOf('.sec.open > .barWrap {'), CSS.indexOf('}', CSS.indexOf('.sec.open > .barWrap {')));
  assert.match(pinned, /position: sticky;/);
  assert.match(pinned, /top: calc\(var\(--gs-top, 0px\) \+ var\(--gs-stick-h, 64px\)\);/, 'the header pins somewhere other than under the sticky block');
});

test('rule 6: scrolled into → back to its first row; top in view → fold; shut → open and land', () => {
  const fn = SCREEN.slice(SCREEN.indexOf('const tapSection = '), SCREEN.indexOf('\n  };\n', SCREEN.indexOf('const tapSection = ')));
  const back = fn.indexOf("el.scrollIntoView({ block: 'start', behavior: 'smooth' });\n      return;");
  const fold = fn.indexOf('next.delete(key)');
  assert.ok(back > -1 && fold > -1, 'a branch of rule 6 is missing');
  assert.ok(back < fold, 'a tap on a scrolled-into section folds it instead of going back to its top');
  assert.match(fn, /if \(isOpen\(key\) && top < stickBottom - 2\)/, 'the first tap does not test whether the section is scrolled into');
  assert.match(fn, /if \(opening\) setTimeout\(\(\) => el\.scrollIntoView/, 'opening does not land its first row at the top');
});
