/**
 * lib/hub-theme-tokens.test.ts — A THEME NEVER MAKES A WORD HARDER TO READ THAN
 * HOUSE MAKES IT, on any of the tokens the guest pages render through.
 *
 * Measured, not phrased: every ratio below is computed from the colours the
 * rule returns, and `lib/invite-themes.test.ts` holds that `globals.css` paints
 * exactly those colours.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_THEMES } from '@/lib/invite-themes';
import { AA_BODY, compositeOver, contrastRatio } from '@/lib/hub-legibility';
import { MUTED_STEPS, hubThemePageTokens, mutedTarget, pageInk } from '@/lib/hub-theme-tokens';

test('the House targets are real — House itself sits under AA on its lightest muted steps', () => {
  assert.ok(mutedTarget(0.45) < AA_BODY, 'ink/45 on House clears AA — the "not worse than House" floor is moot');
  assert.equal(mutedTarget(0.8), AA_BODY, 'a strong step is capped at AA');
});

test('every theme: every muted step at least as readable as House, eyebrow / gild / button label at AA', () => {
  let checked = 0;
  // Every theme that paints its own page — all but Classic, which IS House.
  // (Keyed on "has its own block", not on `tier`: Modern and Cyber Neon went
  // free on 2026-09-29 and must stay under this guard.)
  for (const theme of HUB_THEMES.filter((t) => t.id !== 'house')) {
    const k = hubThemePageTokens(theme);
    for (const a of MUTED_STEPS) {
      const ratio = contrastRatio(compositeOver(k.ink, a, k.canvas), k.canvas);
      assert.ok(ratio >= mutedTarget(a) - 1e-9, `${theme.id}: ink/${a * 100} is ${ratio.toFixed(2)}:1, House makes it ${mutedTarget(a).toFixed(2)}:1`);
    }
    assert.ok(contrastRatio(k.ink, k.surface) >= AA_BODY, `${theme.id}: ink on its plates`);
    assert.ok(contrastRatio(k.eyebrow, k.canvas) >= AA_BODY, `${theme.id}: eyebrow`);
    assert.ok(contrastRatio(k.gild, k.canvas) >= AA_BODY, `${theme.id}: gild used as text`);
    assert.ok(contrastRatio(k.canvas, k.cta) >= AA_BODY, `${theme.id}: the button's label`);
    checked += 1;
  }
  assert.equal(checked, HUB_THEMES.length - 1, 'a themed page escaped the check');
});

test('the ink moves only as far as it must — a theme whose spec ink already holds keeps it', () => {
  const luxe = HUB_THEMES.find((t) => t.name === 'Luxe')!;
  assert.equal(pageInk(luxe.palette.ink, luxe.palette.canvas), luxe.palette.ink);
  for (const t of HUB_THEMES.filter((x) => x.id !== 'house')) {
    const k = hubThemePageTokens(t);
    // Same hue family: the pushed ink stays within a small step of the spec's.
    assert.ok(contrastRatio(k.ink, t.palette.ink) < 2, `${t.id}: the page ink drifted far from the spec ink`);
  }
});
