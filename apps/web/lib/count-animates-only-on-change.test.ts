/**
 * count-animates-only-on-change.test.ts — RULES 2 AND 3 of the button rule
 * (owner 2026-10-07: every number counts to its value, every meter grows to
 * its value — "upon load or change"; the Suppliers plan's "PR0 · Foundation"
 * guard, built once and shared).
 *
 *   T1  the keying, EXECUTED: `startFor(id, v)` starts the first paint at 0,
 *       a re-render with the same value AT the value (no replay), a real change
 *       at the old value.
 *   T2  the curve: 420–900 ms, longer for a bigger jump, ease-OUT.
 *   T3  `Count` / `Fill` RENDERED on the server: the final value, formatted
 *       (₱ grouped · integer grouped · %), the bar at its width, clamped.
 *   T4  the shipped `CountUp` runs on the SAME engine (one implementation).
 *
 * SABOTAGE, each seen red before this shipped (PR body has the run):
 *   T1 make `startFor` always return 0 (every re-render replays from 0)
 *   T3 print pesos through the plain integer formatter
 *   T4 point CountUp off `useCountTo`
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_ROOT } from './security/shadowed-export-scan';

// The component files use the automatic JSX runtime; under tsx they need `React` in scope.
(globalThis as unknown as { React: unknown }).React = React;
const C = require('../components/count') as typeof import('../components/count');
const { CountUp } = require('../app/_components/count-up') as typeof import('../app/_components/count-up');

const css = fs.readFileSync(path.join(APP_ROOT, 'app', 'globals.css'), 'utf8');

test('T1 · first paint counts from 0; the same value again does not replay; a change starts at the old value', () => {
  C.__resetCountMemory();
  assert.equal(C.startFor('budget-left', 12500), 0, 'load: from 0');
  assert.equal(C.startFor('budget-left', 12500), 12500, 're-render, same value: starts AT the value — nothing moves');
  assert.equal(C.startFor('budget-left', 9000), 12500, 'change: from the old value');
  assert.equal(C.startFor('budget-left', 9000), 9000);
  assert.equal(C.startFor('other', 3), 0, 'ids do not share memory');
  assert.equal(C.startFor('fill:budget-left', 40), 0, 'a Fill keyed on the same id has its own memory');
  C.__resetCountMemory();
});

test('T3 · Count prints the final value, formatted, on the server', () => {
  const r = (props: Parameters<typeof C.Count>[0]) => renderToStaticMarkup(React.createElement(C.Count, props));
  assert.match(r({ value: 12500, format: 'peso', id: 't4-peso' }), />₱12,500</);
  assert.match(r({ value: 100050, id: 't4-int' }), />100,050</);
  assert.match(r({ value: 62, format: 'pct', id: 't4-pct' }), />62%</);
  assert.match(r({ value: 3, format: (n) => `${n} builds` }), />3 builds</);
  assert.match(r({ value: 1, id: 'k' }), /data-count="k"/);
});
test('T2 · the duration rule is 420–900 ms, longer for a bigger jump', () => {
  assert.equal(C.countDurationMs(0, 6), 420 + 6 * 0.002);
  assert.equal(C.countDurationMs(0, 5_000_000), 900);
  assert.ok(C.countDurationMs(0, 100_000) > C.countDurationMs(0, 10));
  assert.equal(C.easeOutCubic(1), 1);
  assert.ok(C.easeOutCubic(0.5) > 0.5, 'ease-OUT: past halfway at half time');
});

test('T3 · Fill renders the final width, clamped, with the shared slide class', () => {
  const html = renderToStaticMarkup(React.createElement(C.Fill, { value: 62, id: 'm' }));
  assert.match(html, /class="fill-bar"/);
  assert.match(html, /width:62%/);
  assert.match(renderToStaticMarkup(React.createElement(C.Fill, { value: 140 })), /width:100%/);
  assert.match(renderToStaticMarkup(React.createElement(C.Fill, { value: 50, axis: 'height' })), /height:50%/);
  assert.match(css, /\.fill-bar\s*\{\s*transition:\s*width 700ms/, '700 ms slide');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.fill-bar \{ transition: none/, 'reduced motion jumps');
});

test('T4 · the shipped CountUp runs on the same engine and still prints grouped', () => {
  const src = fs.readFileSync(path.join(APP_ROOT, 'app', '_components', 'count-up.tsx'), 'utf8');
  assert.match(src, /useCountTo\(/, 'CountUp delegates to the one engine');
  assert.doesNotMatch(src, /requestAnimationFrame/, 'no second animation loop');
  assert.match(renderToStaticMarkup(React.createElement(CountUp, { value: 100050 })), /100,050/);
});
