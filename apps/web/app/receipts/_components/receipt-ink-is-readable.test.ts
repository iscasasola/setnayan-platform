/**
 * 🖋 THE RECEIPT'S INK IS READABLE (Build 2 #41, 8 Nov 2026 — found drawing prototype v117 from the shipped slip).
 *
 *   1. The two stamp inks, measured on the slip's paper with WCAG 2 relative luminance, read at least 4.5:1 where the
 *      ink is solid. PAID multiplies in its own `opacity` (the stamp's worn look is the mask's 1-px stripes, which stay).
 *      Before: PAID 2.47:1, AWAITING 4.07:1.
 *   2. The slip's small text uses its own secondary ink #6E6A62 (5.30:1), never #8A857B (3.61:1).
 *
 * The figures are COMPUTED from the exported constants, never typed — change a colour and this file measures it again.
 *
 * SABOTAGE (seen red once, 8 Nov): PAID_INK put back to rgba(46,125,79,.82) → test 1 red ("PAID reads 3.05:1");
 * one `text-[#8A857B]` put back on the slip → test 2 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { PAID_INK, PAID_OPACITY, RECEIPT_PAPER, WAIT_INK } from './receipt-stamp';

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const rgba = (s: string): { rgb: RGB; a: number } => {
  const m = /^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/.exec(s.replace(/\s/g, ''));
  assert.ok(m, `not an rgba() ink: ${s}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) };
};
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const over = (fg: RGB, a: number, bg: RGB): RGB => fg.map((c, i) => c * a + bg[i]! * (1 - a)) as RGB;
const contrast = (x: RGB, y: RGB) => {
  const [a, b] = [lum(x), lum(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

test('1 · both stamp inks read at least 4.5:1 on the slip paper', () => {
  const paper = hex(RECEIPT_PAPER);
  const paid = rgba(PAID_INK);
  const wait = rgba(WAIT_INK);
  const paidRatio = contrast(over(paid.rgb, paid.a * PAID_OPACITY, paper), paper);
  const waitRatio = contrast(over(wait.rgb, wait.a, paper), paper);
  assert.ok(paidRatio >= 4.5, `PAID reads ${paidRatio.toFixed(2)}:1 on the paper`);
  assert.ok(waitRatio >= 4.5, `AWAITING reads ${waitRatio.toFixed(2)}:1 on the paper`);
});

test('2 · the slip’s small text uses #6E6A62, never #8A857B', () => {
  const src = stripComments(readFileSync(join(import.meta.dirname, 'receipt-slip.tsx'), 'utf8'));
  assert.doesNotMatch(src, /#8A857B/i, 'the slip still draws #8A857B (3.61:1)');
  assert.match(src, /text-\[#6E6A62\]/, 'the slip lost its secondary ink');
  const stamp = stripComments(readFileSync(join(import.meta.dirname, 'receipt-stamp.tsx'), 'utf8'));
  assert.doesNotMatch(stamp, /opacity-75/, 'the PAID stamp carries a class opacity the test does not measure');
});
