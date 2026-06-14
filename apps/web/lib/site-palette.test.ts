import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSitePaletteVars } from './site-palette';

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
