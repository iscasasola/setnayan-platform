/**
 * lib/hub-legibility.test.ts — TEXT READS ON EVERY THEME, OVER EVERY GROUND,
 * FOR EVERY COUPLE (owner 2026-09-25: text colour adapts to the background, free).
 *
 * Build plan §3 Phase 3: "every theme × {light, dark} background → body text
 * ≥ 4.5 and the chosen accent either passes or falls back". This measures the
 * PROPERTY — a contrast ratio computed from what the rule actually returns —
 * never a phrasing, so a reworded helper cannot walk past it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUB_THEMES } from '@/lib/invite-themes';
import {
  AA_BODY,
  AA_LARGE,
  compositeOver,
  contrastRatio,
  hubLegibility,
  hubLegibilityVars,
  requiredScrim,
} from '@/lib/hub-legibility';

/** A light and a dark ground a free couple can pick — and two near the middle. */
const LIGHT = '#ffffff';
const DARK = '#000000';
const MID_LIGHT = '#c9c2b8';
const MID_DARK = '#5a4f45';

function assertReads(label: string, ink: string, over: string[], scrim: { color: string; opacity: number }, target: number) {
  for (const bg of over) {
    const painted = compositeOver(scrim.color, scrim.opacity, bg);
    const ratio = contrastRatio(ink, painted);
    assert.ok(ratio >= target - 1e-9, `${label}: ${ink} over ${bg} (scrimmed ${painted}) is ${ratio.toFixed(2)}:1, under ${target}`);
  }
}

test('the arithmetic is WCAG’s: black on white is 21, a colour on itself is 1', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
  assert.equal(contrastRatio('#8a5a44', '#8a5a44'), 1);
  assert.equal(compositeOver('#000000', 0.5, '#ffffff'), '#808080');
});

test('every theme × a light and a dark flat colour → body text clears AA, heading and accent pass or fall back', () => {
  let measured = 0;
  for (const theme of HUB_THEMES) {
    for (const bg of [LIGHT, DARK, MID_LIGHT, MID_DARK, theme.palette.canvas, theme.palette.surface]) {
      const leg = hubLegibility(theme, { kind: 'color', hex: bg });
      assertReads(`${theme.id} on ${bg} body`, leg.ink, [bg], leg.scrim, AA_BODY);
      assertReads(`${theme.id} on ${bg} heading`, leg.heading, [bg], leg.scrim, AA_LARGE);
      assertReads(`${theme.id} on ${bg} accent`, leg.accent, [bg], leg.scrim, AA_BODY);
      assert.ok(leg.heading === theme.palette.heading || leg.heading === leg.ink, `${theme.id}: heading is neither the brand nor the ink`);
      assert.ok(leg.accent === theme.palette.accent || leg.accent === leg.ink, `${theme.id}: accent is neither the brand nor the ink`);
      measured += 1;
    }
  }
  assert.equal(measured, HUB_THEMES.length * 6, 'a theme was skipped');
});

test('the theme’s own ground → body text clears AA over the loop’s lightest AND darkest cluster', () => {
  for (const theme of HUB_THEMES) {
    const leg = hubLegibility(theme, { kind: 'theme' });
    const samples = theme.media ? [theme.media.samples.light, theme.media.samples.dark] : [theme.palette.canvas];
    assertReads(`${theme.id} own ground`, leg.ink, samples, leg.scrim, AA_BODY);
    assertReads(`${theme.id} own ground heading`, leg.heading, samples, leg.scrim, AA_LARGE);
    // The measured scrim is a FLOOR: the rule may strengthen it, never weaken it.
    if (theme.scrim) assert.ok(leg.scrim.opacity >= theme.scrim.opacity - 1e-9, `${theme.id}: the scrim fell under the spec's ${theme.scrim.opacity}`);
    // …and on the theme's own ground the text is the theme's own ink.
    assert.equal(leg.ink, theme.palette.ink, `${theme.id}: its own ground changed its ink`);
  }
});

test('every theme × a couple’s own light and dark photo → the tone flips or the scrim strengthens, and it reads', () => {
  for (const theme of HUB_THEMES) {
    for (const samples of [[LIGHT, '#f0e6d8'], [DARK, '#1c1410'], [LIGHT, DARK]]) {
      const leg = hubLegibility(theme, { kind: 'media', samples });
      assertReads(`${theme.id} over media ${samples.join('/')}`, leg.ink, samples, leg.scrim, AA_BODY);
      assert.ok([theme.palette.lightInk, theme.palette.darkInk].includes(leg.ink), `${theme.id}: the ink left the theme`);
    }
  }
});

test('a bright photo takes dark ink with little or no scrim; a dark one takes light ink', () => {
  const luxe = HUB_THEMES.find((t) => t.name === 'Luxe')!;
  const bright = hubLegibility(luxe, { kind: 'media', samples: ['#ffffff'] });
  assert.equal(bright.tone, 'dark', 'Luxe over a white photo should take its dark ink, not veil the photo black');
  assert.equal(bright.scrim.opacity, 0);
  const dark = hubLegibility(luxe, { kind: 'media', samples: ['#000000'] });
  assert.equal(dark.tone, 'light');
  assert.equal(dark.scrim.opacity, 0);
});

test('requiredScrim returns the weakest veil that reads — and never less than the floor', () => {
  const o = requiredScrim('#ffffff', '#000000', ['#ffffff']);
  assert.ok(o > 0 && o < 1);
  assert.ok(contrastRatio('#ffffff', compositeOver('#000000', o, '#ffffff')) >= AA_BODY);
  assert.ok(contrastRatio('#ffffff', compositeOver('#000000', o - 0.01, '#ffffff')) < AA_BODY, 'not the weakest');
  assert.equal(requiredScrim('#ffffff', '#000000', ['#000000'], 0.4), 0.4, 'the floor is respected');
});

test('the vars carry hex and an rgba scrim only — nothing a couple typed', () => {
  const v = hubLegibilityVars(hubLegibility(HUB_THEMES[4]!, { kind: 'color', hex: 'url(javascript:1)' }));
  for (const [k, value] of Object.entries(v)) {
    assert.match(value, /^(#[0-9a-f]{6}|rgba\(\d+, \d+, \d+, [01]\.\d\d\))$/, `${k} = ${value}`);
  }
});
