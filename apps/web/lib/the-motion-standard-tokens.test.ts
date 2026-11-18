/**
 * the-motion-standard-tokens.test.ts — 🎞 THE MOTION STANDARD'S TOKENS, ONE VALUE EACH (owner 18 Nov 2026, *"Combine
 * them"*; specs `MOTION_STANDARD_2026-11-18.md` § 0 / § 2: "5 speeds + 1 loop, 2 easings").
 *
 * Held here:
 *   1. the five speeds are the standard's — Tap 100 · Quick 200 · Release 280 · Move 320 · Rise 700 — and the Sheen loop
 *      is 1400 ms, in `lib/motion-table.ts` AND as `--sn-m-*` in globals.css, each declared once;
 *   2. the two easings: Settle `cubic-bezier(.2,.8,.2,1)` (and its reverse for a mirrored close) the same in both;
 *   3. Spring is a REAL spring — `linear()` with one ~5 % overshoot, no second wobble, the same stops in both — AND it
 *      has its cubic fallback under `@supports not (transition-timing-function: linear(0, 1))`;
 *   4. the 13 Nov names are aliases of the standard, never numbers of their own again.
 *
 * Seen RED once each (2026-11-18), then restored: `--sn-m-quick: 200ms` → 220ms (1); `EASE_SETTLE`'s `.8` → `.7` (2);
 * the `@supports not` fallback block deleted (3); `--sn-m-ease-emph: var(--sn-m-settle)` → `cubic-bezier(.2,0,0,1)` (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  EASE_EMPHASIZED,
  EASE_EMPHASIZED_REVERSED,
  EASE_SETTLE,
  EASE_SETTLE_REVERSED,
  EASE_SPRING,
  EASE_SPRING_FALLBACK,
  EASE_SPRING_LINEAR,
  MOVE_MS,
  QUICK_MS,
  RELEASE_MS,
  RISE_MS_STANDARD,
  SHEEN_MS,
  TAP_MS,
} from '@/lib/motion-table';

const WEB = join(__dirname, '..');
const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
const decls = (name: string) => [...css.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))].map((m) => m[1]!.trim());
const once = (name: string): string => {
  const all = decls(name);
  assert.equal(all.length, 1, `${name} is declared ${all.length} times in globals.css`);
  return all[0]!;
};
const norm = (v: string) => v.replace(/\s+/g, '');

test('1 · five speeds + one loop — the standard’s numbers, the same in JS and CSS', () => {
  const speeds: Array<[string, number, number]> = [
    ['--sn-m-tap', TAP_MS, 100],
    ['--sn-m-quick', QUICK_MS, 200],
    ['--sn-m-release', RELEASE_MS, 280],
    ['--sn-m-move', MOVE_MS, 320],
    ['--sn-m-rise', RISE_MS_STANDARD, 700],
    ['--sn-m-sheen', SHEEN_MS, 1400],
  ];
  for (const [name, js, standard] of speeds) {
    assert.equal(js, standard, `${name}: lib/motion-table.ts says ${js}, the standard says ${standard}`);
    assert.equal(once(name), `${standard}ms`, `${name} in globals.css is not the standard’s ${standard} ms`);
  }
});

test('2 · two easings — Settle (and its mirror) the same in JS and CSS', () => {
  assert.equal(EASE_SETTLE, 'cubic-bezier(.2,.8,.2,1)');
  assert.equal(norm(once('--sn-m-settle')), norm(EASE_SETTLE));
  // Settle played backwards in time: (x1,y1,x2,y2) → (1-x2, 1-y2, 1-x1, 1-y1).
  const [x1, y1, x2, y2] = /\(([^)]*)\)/.exec(EASE_SETTLE)![1]!.split(',').map(Number) as [number, number, number, number];
  const rev = [1 - x2, 1 - y2, 1 - x1, 1 - y1].map((n) => String(Math.round(n * 100) / 100).replace(/^0\./, '.'));
  assert.equal(EASE_SETTLE_REVERSED, `cubic-bezier(${rev.join(',')})`, 'the close curve is not Settle reversed');
  assert.equal(norm(once('--sn-m-settle-rev')), norm(EASE_SETTLE_REVERSED));
});

test('3 · Spring is a real spring in linear() — with its cubic fallback', () => {
  const stops = /^linear\((.*)\)$/.exec(EASE_SPRING_LINEAR)?.[1]?.split(',').map((x) => Number(x.trim()));
  assert.ok(stops && stops.every(Number.isFinite), 'EASE_SPRING_LINEAR is not a linear() of plain stops');
  assert.ok(stops.length >= 20, `a spring of ${stops.length} stops is too coarse`);
  assert.equal(stops[0], 0);
  assert.equal(stops.at(-1), 1);
  const peak = Math.max(...stops);
  assert.ok(peak > 1.03 && peak <= 1.06, `the overshoot (${peak}) is not ~5 %`);
  // One overshoot, no second wobble: after the peak it never climbs again, and never dips under 1 by more than a hair.
  const after = stops.slice(stops.indexOf(peak));
  for (let i = 1; i < after.length - 1; i++) assert.ok(after[i]! <= after[i - 1]! + 1e-9, 'the spring wobbles a second time');
  assert.ok(Math.min(...after) >= 0.995, 'the spring swings back under 1 — a second wobble');

  // CSS: the main token is the SAME linear(); the @supports-not block gives the cubic fallback.
  const all = decls('--sn-m-spring').map(norm);
  assert.ok(all.includes(norm(EASE_SPRING_LINEAR)), '--sn-m-spring is not the linear() spring of lib/motion-table.ts');
  const fallback = /@supports\s+not\s*\(\s*transition-timing-function:\s*linear\(0,\s*1\)\s*\)\s*\{\s*:root\s*\{\s*--sn-m-spring:\s*([^;]+);/.exec(css);
  assert.ok(fallback, 'Spring has no cubic fallback under @supports not (transition-timing-function: linear(0, 1))');
  assert.equal(norm(fallback[1]!), norm(EASE_SPRING_FALLBACK));
  assert.equal(EASE_SPRING_FALLBACK, 'cubic-bezier(.34,1.56,.64,1)');
  assert.deepEqual(all.sort(), [norm(EASE_SPRING_FALLBACK), norm(EASE_SPRING_LINEAR)].sort(), '--sn-m-spring is declared somewhere else too');
});

test('4 · the 13 Nov names are aliases of the standard, not numbers of their own', () => {
  assert.equal(EASE_EMPHASIZED, EASE_SETTLE);
  assert.equal(EASE_EMPHASIZED_REVERSED, EASE_SETTLE_REVERSED);
  assert.equal(EASE_SPRING, EASE_SPRING_FALLBACK);
  const aliases: Array<[string, string]> = [
    ['--sn-m-ease-emph', 'var(--sn-m-settle)'],
    ['--sn-m-ease-emph-rev', 'var(--sn-m-settle-rev)'],
    ['--sn-m-press-in', 'var(--sn-m-tap)'],
    ['--sn-m-grow-press', 'var(--sn-m-tap)'],
    ['--sn-m-grow-shape', 'var(--sn-m-move)'],
  ];
  for (const [name, to] of aliases) assert.equal(once(name), to, `${name} is not an alias of ${to}`);
});
