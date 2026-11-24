/**
 * LIVE FIX (owner, 23 Nov 2026: "Yes, fix it") — on a phone, Check a date shows ONE whole month and the next month never
 * pokes in at the sheet's edge. Before the fix each month was `flex: 0 0 88%` of a strip that bleeds 16px past each
 * gutter, so a column of December (6 · 13 · 20 · 27) sat beside November at 360–430px, and after paging forward 2px of
 * the previous month showed at the left (the 14px gap was smaller than the 16px bleed).
 *
 * The geometry, for a strip with side padding P (the bleed), month width W and gap G, settled on month i (snap-aligned at
 * its start, scroll-padding P): the visible box runs 0 … P + W + P. Month i+1 starts at P + W + G, so it is out of view
 * only when W is the full content width and G ≥ P; month i-1 ends at P − G, out of view only when G ≥ P. This test reads
 * the phone (base) rules of the stylesheet and holds both. Measured proof at 360 · 375 · 390 · 430 is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..', '..');
const RAW = stripComments(readFileSync(join(WEB, 'app/v/[slug]/dates/_components/seat-months.module.css'), 'utf8'));

/** The phone rules: everything before the first @media block (the desktop and reduced-motion rules come after). */
const PHONE = RAW.slice(0, RAW.search(/@media/) === -1 ? RAW.length : RAW.search(/@media/));

const ruleOf = (css: string, selector: string): string => {
  const m = css.match(new RegExp(`(?:^|\\n)\\s*${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `no ${selector} rule in the phone part of seat-months.module.css`);
  return m[1] ?? '';
};
const declOf = (rule: string, prop: string): string | null => {
  const m = rule.match(new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;]+);?`));
  return m ? (m[1] ?? '').trim() : null;
};

/** Resolve a length written with px, `var(--x)` and `calc(a * b)` / `calc(a + b)` to px. Anything else fails the test. */
const px = (value: string, vars: Record<string, string>): number => {
  let v = value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const got = vars[name];
    assert.ok(got, `${name} is used but not set on .months`);
    return got;
  });
  v = v.replace(/calc\(/g, '(').replace(/(-?\d*\.?\d+)px/g, '$1');
  assert.match(v, /^[\d\s.+*()-]+$/, `"${value}" is not a plain px length the guard can read`);
  return Function(`"use strict"; return (${v});`)() as number;
};

test('on a phone, a month is the strip\'s whole width: never a fraction that lets the neighbour in', () => {
  const month = ruleOf(PHONE, '.month');
  const flex = declOf(month, 'flex') ?? '';
  const basis = declOf(month, 'flex-basis') ?? flex.split(/\s+/)[2] ?? '';
  assert.equal(basis, '100%', `.month flex-basis on a phone is "${basis}" — anything under 100% shows the next month`);
  assert.match(flex, /^0 0 /, 'a month never grows or shrinks: it is exactly one strip wide');
});

test('the gap between months is at least the bleed on each side, so neither neighbour shows once a month settles', () => {
  const months = ruleOf(PHONE, '.months');
  const vars: Record<string, string> = {};
  for (const m of months.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars[m[1] as string] = (m[2] as string).trim();

  const padding = declOf(months, 'padding');
  assert.ok(padding, '.months has side padding (the bleed that keeps the picked ring and the swipe unclipped)');
  const parts = (padding as string).split(/\s+(?![^(]*\))/);
  const left = px(parts[3] ?? parts[1] ?? parts[0] ?? '0', vars);
  const right = px(parts[1] ?? parts[0] ?? '0', vars);
  const gap = px(declOf(months, 'gap') ?? '0', vars);

  assert.ok(gap >= right, `gap ${gap}px < right bleed ${right}px: the next month pokes in at the right edge`);
  assert.ok(gap >= left, `gap ${gap}px < left bleed ${left}px: the previous month pokes in at the left edge`);

  const margin = declOf(months, 'margin');
  assert.ok(margin && /-/.test(margin), 'the strip bleeds into the gutter by a negative margin, matching its padding');
  const scrollPad = declOf(months, 'scroll-padding');
  assert.ok(scrollPad && px(scrollPad.split(/\s+(?![^(]*\))/)[1] ?? '0', vars) === left, 'a month snaps to the gutter, not to the screen edge');
  assert.match(months, /scroll-snap-type:\s*x mandatory/, 'a swipe always settles on a month, never between two');
});

test('the swipe reads its step from the strip, never a typed gap that drifts from the stylesheet', () => {
  const seats = readFileSync(join(WEB, 'app/v/[slug]/dates/_components/seat-months.tsx'), 'utf8');
  assert.match(seats, /b\.offsetLeft - a\.offsetLeft/, 'the month index comes from the measured step (month + gap)');
  assert.doesNotMatch(seats, /w \+ 14/, 'the old typed 14px gap is gone');
});
