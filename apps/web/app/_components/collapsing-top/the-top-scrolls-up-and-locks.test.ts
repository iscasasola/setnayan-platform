/**
 * the-top-scrolls-up-and-locks.test.ts — 📌 THE ONE COLLAPSING TOP (THE ONE BUILD F2 / guard G5, 8 Nov 2026).
 *
 * Owner, v108: *"the TOP ITSELF scrolls up and locks … native sticky"* — and of the old slim-layout toggle: *"not smooth
 * to the pixel"*. v110: *"only the last 48 px crossfade"*, *"No cut line"*. Held here:
 *   1. the math — top = T + R − H; q = 0 until the last 48 px, 1 at the lock, never decreasing as the page goes down;
 *      both forms (from the rect, from the scroll offset) agree; a stack locks row 1 at 44 and row 2 at 88;
 *   2. the component writes ATTRIBUTES and CSS VARIABLES only — never React state on a scroll — from ONE capture scroll
 *      listener per stack, read once per frame; it draws no wrapper (a sticky block sticks inside its parent);
 *   3. reduced motion: no fade — q is 0 or 1;
 *   4. the old fold toggle (`usePinFold`) only loses callers (each page slice moves its row here);
 *   5. the event Home reads "stuck" through the same shared hook — its own markup and 52 px untouched;
 *   6. the rise — the one 520 ms open/close motion — and its exact reverse;
 *   7. the tokens: `--sn-pin-h` 44 px, `--sn-dur-rise` 520 ms.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): the fade window 48 → 96 (red: test 1); a `useState` written on
 * scroll in collapsing-top.tsx (red: test 2); `usePinFold(` added to a new file (red: test 4); `direction: reverse ?
 * 'reverse'` → `'normal'` (red: test 6).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';
import {
  COLLAPSE_FADE_PX,
  COLLAPSE_ROW_H,
  collapseProgress,
  collapseProgressAt,
  collapseTop,
  isStuck,
  stackBefore,
} from './collapse-progress';
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS, riseFrames } from '@/lib/rise-motion';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const SRC = stripComments(read('app/_components/collapsing-top/collapsing-top.tsx'));
const CSS = read('app/_components/collapsing-top/collapsing-top.css');

test('the math: top = T + R − H; the cross-fade only in the last 48 px; monotone; both forms agree', () => {
  assert.equal(COLLAPSE_ROW_H, 44);
  assert.equal(COLLAPSE_FADE_PX, 48);
  assert.equal(collapseTop(300, 44, 60), 60 + 44 - 300);
  assert.equal(collapseTop(300), 44 - 300);
  // A 300-px cover at document y=100, bar 60: sticky top = 60 + 44 − 300 = −196; it locks at scroll = 100 − (−196) − 60…
  const h = 300;
  const natural = 160; // its top in the document
  const bar = 60;
  const stickyTop = collapseTop(h, 44, bar);
  let last = -1;
  for (let scroll = 0; scroll <= 400; scroll++) {
    const rectTop = Math.max(natural - scroll, stickyTop); // sticky: it never goes above its top
    const q = collapseProgress(rectTop, stickyTop);
    const q2 = collapseProgressAt({ scroll, natural, before: bar, h });
    assert.ok(Math.abs(q - q2) < 1e-9, `the two forms disagree at scroll ${scroll}: ${q} vs ${q2}`);
    assert.ok(q >= last, `q went down while the page went down (scroll ${scroll})`);
    last = q;
    const remaining = rectTop - stickyTop;
    if (remaining >= COLLAPSE_FADE_PX) assert.equal(q, 0, `it faded before the last 48 px (remaining ${remaining})`);
    if (remaining <= 0) assert.equal(q, 1, 'locked but not fully pinned');
  }
  assert.equal(collapseProgress(Number.NaN, 0), 0, 'no top yet (no script) is rest, never pinned');
  // A stack: row 1 locks at 44 under the bar, row 2 at 88.
  assert.deepEqual(stackBefore([44, 44]), [0, 44]);
  assert.deepEqual(stackBefore([44, 44, 56]), [0, 44, 88]);
  assert.equal(isStuck(0, -196, -196), false, 'at the very top nothing is stuck');
  assert.equal(isStuck(10, -196, -196), true);
});

test('it writes attributes and CSS variables only — one capture scroll listener per stack, read once per frame', () => {
  assert.doesNotMatch(SRC, /\buseState\b|\buseReducer\b/, 'a scroll would re-render the list under it');
  assert.equal((SRC.match(/addEventListener\('scroll'/g) ?? []).length, 1, 'not ONE scroll listener per stack');
  assert.match(SRC, /document\.addEventListener\('scroll', this\.soon, \{ passive: true, capture: true \}\)/);
  assert.match(SRC, /requestAnimationFrame\(this\.frame\)/, 'not read once per frame');
  assert.match(SRC, /setProperty\('--q', String\(q\)\)/);
  assert.match(SRC, /toggleAttribute\('data-pinned', pinned\)/);
  // No wrapper element on the stack: a sticky block sticks only inside its parent.
  const stack = SRC.slice(SRC.indexOf('export function CollapsingTopStack'), SRC.indexOf('export function CollapsingTop('));
  assert.doesNotMatch(stack, /<div|<section/, 'the stack draws an element — the tops inside would stop sticking at its end');
  // The CSS: sticky with the negative top; the fade reads --q; the row takes taps only once pinned.
  assert.match(CSS, /\.sn-ct \{[^}]*position: sticky;[^}]*top: calc\(var\(--ct-bar\) \+ var\(--ct-before, 0px\) \+ var\(--ct-row, var\(--sn-pin-h, 44px\)\) - var\(--ct-h\)\);/);
  assert.match(CSS, /\.sn-ct-full \{\s*opacity: calc\(1 - var\(--q, 0\)\);/);
  assert.match(CSS, /\.sn-ct-row \{[^}]*opacity: var\(--q, 0\);[^}]*pointer-events: none;/);
  assert.match(CSS, /\.sn-ct\[data-pinned\] > \.sn-ct-row \{\s*pointer-events: auto;/);
  assert.match(read('app/layout.tsx'), /import '\.\/_components\/collapsing-top\/collapsing-top\.css';/, 'the drawing is not loaded once by the root layout');
});

test('server render: the full content, then the row — the row inert until pinned; reduced motion steps 0 → 1', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CollapsingTop, CollapsingTopStack } = await import('./collapsing-top');
  const html = renderToStaticMarkup(
    React.createElement(
      CollapsingTopStack,
      null,
      React.createElement(
        CollapsingTop,
        // `children` arrives as the third argument (react/no-children-prop); the cast only tells tsc it will.
        { row: React.createElement('b', null, 'row'), data: { 'today-cover': '' } } as unknown as Parameters<typeof CollapsingTop>[0],
        React.createElement('h1', null, 'Cover'),
      ),
    ),
  );
  assert.match(html, /^<div class="sn-ct "[^>]*data-collapsing-top=""[^>]*data-today-cover=""><div class="sn-ct-full" data-ct-full=""><h1>Cover<\/h1><\/div><div class="sn-ct-row" data-ct-row="" inert=""><b>row<\/b><\/div><\/div>$/);
  assert.match(SRC, /if \(step\) q = q > COLLAPSE_PINNED_AT \? 1 : 0;/, 'reduced motion still cross-fades');
  assert.match(SRC, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
});

test('the old fold toggle only loses callers — each page slice moves its row onto the collapsing top', () => {
  /* Callers of usePinFold on 2026-11-08 (THE ONE BUILD base). This number may only go DOWN. */
  const MAX = 4;
  const callers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.endsWith('use-pin-fold.ts') && /\busePinFold\(/.test(stripComments(readFileSync(p, 'utf8')))) callers.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'components'));
  // eslint-disable-next-line no-console
  console.log(`usePinFold callers: ${callers.length} (≤ ${MAX}, target 0)\n  ${callers.join('\n  ')}`);
  assert.ok(callers.length <= MAX, `a NEW usePinFold caller — use CollapsingTop:\n${callers.join('\n')}`);
});

test('the event Home reads "stuck" through the shared hook — its 52-px line and markup unchanged', () => {
  const pin = stripComments(read('app/dashboard/[eventId]/_components/home-cover-pin.tsx'));
  assert.match(pin, /useStuck\(band, \{ heightVar: '--home-band-h', attr: 'data-collapsed' \}\);/);
  assert.match(pin, /export const HOME_PIN_H = 52;/);
  assert.doesNotMatch(pin, /addEventListener\('scroll'/, 'Home keeps a second copy of the stuck read');
  const hook = stripComments(read('app/_components/collapsing-top/use-stuck.ts'));
  assert.match(hook, /isStuck\(window\.scrollY, el\.getBoundingClientRect\(\)\.top, parseFloat\(getComputedStyle\(el\)\.top\)\)/);
});

test('the rise: 520 ms on (.2,.8,.2,1), the close the exact reverse; 120 ms cross-fade under reduced motion', () => {
  assert.equal(RISE_MS, 520);
  assert.equal(RISE_EASE, 'cubic-bezier(.2,.8,.2,1)');
  assert.equal(RISE_REDUCED_MS, 120);
  const f = riseFrames({ left: 16, top: 400, width: 343, height: 64 }, { left: 0, top: 0, width: 375, height: 812 });
  assert.deepEqual(f[1], { transform: 'none' }, 'it does not end at rest');
  assert.equal(f[0]!.transform, 'translate(16px, 400px) scale(0.915, 0.079)', 'it does not start over the tapped row');
  assert.deepEqual(riseFrames({ left: 0, top: 0, width: 0, height: 0 }, { left: 0, top: 0, width: 0, height: 0 })[0], { transform: 'translate(0px, 0px) scale(1, 1)' });
  const src = stripComments(read('lib/rise-motion.ts'));
  assert.equal((src.match(/direction: reverse \? 'reverse' : 'normal'/g) ?? []).length, 2, 'the close is not the same frames played backwards');
});

test('the tokens: the pinned row is 44 px, the rise 520 ms', () => {
  const css = read('app/globals.css');
  assert.match(css, /--sn-pin-h: {7}44px;/);
  assert.match(css, /--sn-dur-rise: {4}520ms;/);
  assert.match(css, /--sn-ease-rise: {3}cubic-bezier\(\.2,\.8,\.2,1\);/);
});
