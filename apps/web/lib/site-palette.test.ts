import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSitePaletteVars, ledPaletteFromMoodBoard } from './site-palette';

// Local contrast math (independent of the impl) so the test verifies the real
// output meets WCAG AA, not just that it produced something.
function chanToRgb(s: string): { r: number; g: number; b: number } {
  const [r = 0, g = 0, b = 0] = s.split(' ').map(Number);
  return { r, g, b };
}
function lin(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function lum(c: { r: number; g: number; b: number }): number {
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}
function contrast(a: string, b: string): number {
  const la = lum(chanToRgb(a));
  const lb = lum(chanToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('returns null for absent / empty palettes (→ defaults apply)', () => {
  assert.equal(buildSitePaletteVars(null), null);
  assert.equal(buildSitePaletteVars(undefined), null);
  assert.equal(buildSitePaletteVars({}), null);
  assert.equal(buildSitePaletteVars({ reception: [] }), null);
});

test('emits channel-format values for the 8 site tokens', () => {
  const vars = buildSitePaletteVars({ reception: ['#C97B4B', '#824A2A', '#FAF7F2'] });
  assert.ok(vars);
  for (const key of [
    '--color-cream',
    '--color-ink',
    '--color-terracotta',
    '--color-terracotta-600',
    '--color-terracotta-700',
    '--color-mulberry',
    '--color-mulberry-600',
    '--color-mulberry-700',
  ]) {
    assert.match(vars![key]!, /^\d{1,3} \d{1,3} \d{1,3}$/, `${key} is "R G B"`);
  }
});

test('accent reads as text on paper, and light text reads on the CTA (AA 4.5)', () => {
  // A deliberately tricky pastel palette (light, low-contrast decor colors).
  const vars = buildSitePaletteVars({
    reception: ['#F0D9DE', '#C98B9A', '#A9B89E'],
    ceremony: ['#F6F1E7'],
  })!;
  assert.ok(vars);
  assert.ok(
    contrast(vars['--color-terracotta']!, vars['--color-cream']!) >= 4.5,
    'accent vs paper >= 4.5',
  );
  assert.ok(
    contrast(vars['--color-mulberry']!, '255 255 255') >= 4.5,
    'white text on CTA >= 4.5',
  );
  // Body text on the page must stay strongly legible.
  assert.ok(contrast(vars['--color-ink']!, vars['--color-cream']!) >= 7, 'ink vs paper >= 7');
});

// ── ledPaletteFromMoodBoard (0005 LED × 0010 Mood Board) ─────────────────────

const HEX = /^#[0-9a-f]{6}$/;
// A representative dark template ([bg, accent1, accent2]) from led-background.ts.
const DARK_TPL = ['#0F0F0F', '#C9A14B', '#3A2A1C'] as const;
const LIGHT_TPL = ['#F4EBD9', '#E3CDA0', '#A6815C'] as const;

test('LED: returns null when the palette is empty or colourless → template fallback', () => {
  assert.equal(ledPaletteFromMoodBoard(null, DARK_TPL), null);
  assert.equal(ledPaletteFromMoodBoard(undefined, DARK_TPL), null);
  assert.equal(ledPaletteFromMoodBoard({}, DARK_TPL), null);
  // An all-grey palette has no hue to contribute → keep the template default.
  assert.equal(ledPaletteFromMoodBoard({ reception: ['#808080', '#444444'] }, DARK_TPL), null);
});

test('LED: maps the boldest Mood-Board swatch onto accent1', () => {
  const out = ledPaletteFromMoodBoard({ reception: ['#C97B4B', '#824A2A', '#D08654'] }, DARK_TPL);
  assert.ok(out);
  const [bg, accent1, accent2] = out!;
  for (const h of [bg, accent1, accent2]) assert.match(h, HEX, `${h} is #rrggbb`);
  // The most colourful swatch is the orange #C97B4B → accent1 (the dominant glow).
  assert.equal(accent1, '#c97b4b');
  // accent2 stays distinct from accent1 so the two radial blooms separate.
  assert.notEqual(accent2, accent1);
});

test('LED: preserves the template tone (dark stays dark, light stays light)', () => {
  const dark = ledPaletteFromMoodBoard({ reception: ['#C97B4B', '#824A2A'] }, DARK_TPL)!;
  const light = ledPaletteFromMoodBoard({ reception: ['#C97B4B', '#824A2A'] }, LIGHT_TPL)!;
  assert.ok(lum(chanFromHex(dark[0])) < 0.3, 'dark template bg stays dark');
  assert.ok(lum(chanFromHex(light[0])) > 0.5, 'light template bg stays light');
});

test('LED: single-hue palette still yields two separable accents', () => {
  const out = ledPaletteFromMoodBoard({ reception: ['#BE185D'] }, DARK_TPL)!;
  assert.ok(out);
  assert.notEqual(out[1], out[2], 'accent2 lifts from accent1 when the palette is single-hued');
});

function chanFromHex(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
