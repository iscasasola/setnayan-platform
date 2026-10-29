/**
 * the-open-fold-head-pins-slim.test.ts — APP-WIDE (owner 2026-10-29): an OPEN accordion's head pins at the top as ONE
 * SLIM LINE (~40 px; sub-line, count and tags hidden), the next layer sits flush under it, it hands over to the next
 * head, it restores on scroll-up — and it GLIDES ("remember to animate them properly"). It lives in the ONE shared fold
 * (`fold.tsx`), so every page that folds gets it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOLD_SLIM_PX } from './fold';

const WEB = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the shared fold pins its OPEN head on the pin line, one slim line deeper per open fold around it', () => {
  const src = read('app/_components/fold.tsx');
  assert.equal(FOLD_SLIM_PX, 40, 'the slim line is ~40 px');
  assert.match(src, /useSlimPin\(open, depth\)/, 'the head pins only while the fold is open');
  assert.match(src, /calc\(var\(--sn-pin-top, 0px\) \+ \$\{offset\}px\)/, 'the head no longer sits on the shared pin line');
  assert.match(src, /const offset = depth \* FOLD_SLIM_PX;/, 'a nested head no longer sits flush under its parent');
  assert.match(src, /<FoldDepth\.Provider value=\{open \? depth \+ 1 : depth\}>/, 'an open fold no longer tells its children how deep they are');
  assert.match(src, /<div ref=\{pinRef\} data-fold-pinbox="">/, 'the head lost its pinning box');
  assert.match(src, /pin\.toggleAttribute\('data-slim', next\)/, 'slim is written as an attribute');
  // Hysteresis: on at the line, off 6 px below it — and only once the head has really travelled up.
  assert.match(src, /slim \? travelled && r\.top <= line \+ 6 : travelled && r\.top <= line \+ 1/);
  for (const hook of ['data-fold-sub=""', 'data-fold-aside=""', 'data-fold-lead=""']) {
    assert.ok(src.includes(hook), `the head lost ${hook} — the slim line could not hide/shrink it`);
  }
});

test('the slim look and the glide are drawn once, loaded once, still under reduced motion', () => {
  assert.match(read('app/layout.tsx'), /import '\.\/_components\/fold\.css';/);
  const css = read('app/_components/fold.css');
  assert.match(css, /\[data-fold-pin\] \{\s*position: sticky;/);
  assert.match(css, /\[data-fold-pin\]\[data-slim\] \[data-fold-head\] \{\s*min-height: 40px;/);
  assert.match(css, /\[data-fold-pin\]\[data-slim\] \[data-fold-sub\],\s*\[data-fold-pin\]\[data-slim\] \[data-fold-aside\] \{\s*display: none;/);
  assert.match(css, /\[data-fold-pin\]\[data-slim\] > \* \{\s*animation: sn-pin-rise/, 'pinning slim no longer glides');
  assert.match(css, /\[data-fold-pin\]\[data-was-slim\]:not\(\[data-slim\]\) > \* \{\s*animation: sn-pin-drop/, 'restoring no longer glides back');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation: none;/);
});
