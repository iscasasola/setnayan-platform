/**
 * lib/ombre.test.ts — PLAIN OR OMBRÉ, MEASURED.
 *
 * Owner, 2026-09-25: *"color setup can be like plain color or like apples ombe
 * style."* Four properties, each measured from what the module returns — never
 * a phrasing:
 *
 *   1. every one of the ten themes has 3–4 curated ombrés, and each parses;
 *   2. body text clears WCAG AA over EVERY colour of every preset's ramp with
 *      no veil at all — and when a couple's own colours cannot, a veil is raised
 *      until it does;
 *   3. the spec round-trips through the column's text form, and noise is dropped;
 *   4. the ramp is interpolated in OKLCH — the middle of two saturated colours
 *      keeps its chroma instead of greying — and the CSS it draws is only ever
 *      hex digits, keywords and numbers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { oklchOfHex } from '@/lib/color-space';
import { AA_BODY, AA_LARGE, compositeOver, contrastRatio } from '@/lib/hub-legibility';
import { HUB_THEMES, INVITE_THEMES, INVITE_THEME_IDS } from '@/lib/invite-themes';
import {
  OMBRE_IS_PRO,
  OMBRE_MAX_STOPS,
  OMBRE_MIN_STOPS,
  OMBRE_PRESETS,
  OMBRE_RAMP_STEPS,
  OMBRE_SHAPES,
  encodeOmbre,
  encodeSiteBackground,
  isOmbreValue,
  ombreCss,
  ombreLegibility,
  ombreLook,
  ombreLookChange,
  ombrePresetMatching,
  ombrePresetsFor,
  ombreRamp,
  parseOmbre,
  parseSiteBackground,
  type OmbreSpec,
} from '@/lib/ombre';

/* ── 1 · the presets ─────────────────────────────────────────────────────── */

test('every theme has three or four curated ombrés, with unique ids, each a valid spec', () => {
  const ids = new Set<string>();
  for (const theme of INVITE_THEME_IDS) {
    const presets = ombrePresetsFor(theme);
    assert.ok(presets.length >= 3 && presets.length <= 4, `${theme} has ${presets.length} presets, wanted 3–4`);
    for (const preset of presets) {
      assert.ok(!ids.has(preset.id), `duplicate preset id ${preset.id}`);
      ids.add(preset.id);
      assert.equal(preset.theme, theme);
      assert.ok(preset.name.length > 0);
      assert.deepEqual(parseOmbre(encodeOmbre(preset.spec)), preset.spec, `${preset.id} does not round-trip`);
      assert.equal(ombrePresetMatching(preset.spec)?.id, preset.id, `${preset.id} is not recognised as itself`);
    }
  }
  assert.equal(ids.size, OMBRE_PRESETS.length, 'a preset is filed under no theme');
  assert.ok(OMBRE_SHAPES.every((s) => OMBRE_PRESETS.some((p) => p.spec.shape === s)), 'a shape has no preset showing it');
});

/* ── 2 · legibility ──────────────────────────────────────────────────────── */

function assertReads(label: string, ink: string, over: readonly string[], scrim: { color: string; opacity: number }, target: number) {
  for (const bg of over) {
    const painted = compositeOver(scrim.color, scrim.opacity, bg);
    const ratio = contrastRatio(ink, painted);
    assert.ok(ratio >= target - 1e-9, `${label}: ${ink} over ${bg} (veiled ${painted}) is ${ratio.toFixed(2)}:1, under ${target}`);
  }
}

test('every preset reads at AA over its WHOLE ramp with NO veil — a preset that needed one would not be premium', () => {
  let measured = 0;
  for (const preset of OMBRE_PRESETS) {
    const theme = INVITE_THEMES[preset.theme];
    const ramp = ombreRamp(preset.spec);
    const leg = ombreLegibility(theme, preset.spec);
    assert.equal(leg.scrim.opacity, 0, `${preset.id} needs a ${leg.scrim.opacity} veil — retune its stops`);
    assertReads(`${preset.id} body`, leg.ink, ramp, leg.scrim, AA_BODY);
    assertReads(`${preset.id} heading`, leg.heading, ramp, leg.scrim, AA_LARGE);
    assertReads(`${preset.id} accent`, leg.accent, ramp, leg.scrim, AA_BODY);
    assert.ok([theme.palette.lightInk, theme.palette.darkInk].includes(leg.ink), `${preset.id}: the ink left the theme`);
    measured += ramp.length;
  }
  assert.equal(measured, OMBRE_PRESETS.length * OMBRE_RAMP_STEPS, 'a ramp was skipped');
});

test('a couple’s own mid-tone ombré that no ink clears bare gets a veil, and then reads', () => {
  // Two mid greys: black is ~4.0:1 and white ~4.3:1 over #777 — neither clears 4.5 bare.
  const spec: OmbreSpec = { shape: 'dawn', stops: ['#777777', '#8a8a8a'] };
  for (const theme of HUB_THEMES) {
    const look = ombreLook(theme, spec);
    assert.ok(look.legibility.scrim.opacity > 0, `${theme.id}: no veil raised over a mid-grey ramp`);
    assertReads(`${theme.id} veiled body`, look.legibility.ink, ombreRamp(spec), look.legibility.scrim, AA_BODY);
    assert.ok(look.legibility.bodyContrast >= AA_BODY - 1e-9);
    // …and the veil is IN the CSS, as the top layer, so the paper the guest sees is the veiled paper.
    assert.match(look.css, /^linear-gradient\(rgba\(\d+, \d+, \d+, 0\.\d\d\), rgba\(/, `${theme.id}: the veil is not the top layer`);
  }
});

test('a light theme keeps its dark ink over a light ombré, a dark theme keeps its light ink over a dark one', () => {
  const light = ombreLook(INVITE_THEMES.house, { shape: 'dawn', stops: ['#fbf7ef', '#ece1cf'] });
  assert.equal(light.legibility.ink, INVITE_THEMES.house.palette.darkInk);
  const dark = ombreLook(INVITE_THEMES.velvet, { shape: 'glow', stops: ['#3a1a0e', '#0e0504'] });
  assert.equal(dark.legibility.ink, INVITE_THEMES.velvet.palette.lightInk);
  // And the tone FLIPS when the couple goes against the theme: a Luxe couple on
  // a pale ombré is given Luxe's dark ink, not cream on cream.
  const flipped = ombreLook(INVITE_THEMES.velvet, { shape: 'dawn', stops: ['#fbf7ef', '#ece1cf'] });
  assert.equal(flipped.legibility.ink, INVITE_THEMES.velvet.palette.darkInk);
  assert.equal(flipped.legibility.scrim.opacity, 0);
});

/* ── 3 · storage ─────────────────────────────────────────────────────────── */

test('the spec round-trips through the column: plain hex stays plain, an ombré comes back exactly', () => {
  assert.deepEqual(parseSiteBackground('#F5EFE6'), { kind: 'plain', hex: '#f5efe6' });
  assert.equal(encodeSiteBackground({ kind: 'plain', hex: '#f5efe6' }), '#f5efe6');

  const spec: OmbreSpec = { shape: 'diagonal', stops: ['#1a0608', '#3a0f1a', '#0e0504'] };
  const stored = encodeOmbre(spec);
  assert.equal(stored, 'ombre:diagonal:#1a0608,#3a0f1a,#0e0504');
  assert.ok(stored.length <= 40, 'the stored form must stay small');
  assert.deepEqual(parseSiteBackground(stored), { kind: 'ombre', ombre: spec });
  assert.equal(encodeSiteBackground(parseSiteBackground(stored)!), stored);
  // Case and whitespace normalise to the one canonical form.
  assert.equal(encodeOmbre(parseOmbre('  OMBRE:DIAGONAL:#1A0608,#3A0F1A,#0E0504 '.toLowerCase())!), stored);
  assert.deepEqual(parseOmbre(' ombre:dawn:#FBF7EF,#ECE1CF '), { shape: 'dawn', stops: ['#fbf7ef', '#ece1cf'] });
});

test('noise is dropped, never repaired', () => {
  for (const junk of [
    null,
    undefined,
    '',
    '   ',
    'f5efe6',
    '#f5efe',
    '#f5efe6ff',
    'ombre:',
    'ombre:dawn',
    'ombre:dawn:',
    'ombre:swirl:#ffffff,#000000',
    'ombre:dawn:#ffffff', // one stop
    'ombre:dawn:#ffffff,#eeeeee,#dddddd,#cccccc', // four
    'ombre:dawn:#zzzzzz,#ffffff',
    'ombre:dawn:#ffffff,#000000:extra',
    'ombre:dawn:url(x),#000000',
    'ombre:dawn:#ffffff,#000000;background:red',
    42,
    { shape: 'dawn', stops: ['#ffffff', '#000000'] },
  ]) {
    assert.equal(parseSiteBackground(junk), null, `accepted ${JSON.stringify(junk)}`);
    assert.equal(isOmbreValue(junk), false);
  }
  assert.equal(isOmbreValue('#f5efe6'), false, 'a plain hex is not an ombré');
  assert.equal(isOmbreValue('ombre:dawn:#ffffff,#000000'), true);
  assert.equal(OMBRE_MIN_STOPS, 2);
  assert.equal(OMBRE_MAX_STOPS, 3);
});

/* ── 4 · the ramp and the CSS ────────────────────────────────────────────── */

test('the ramp is OKLCH: the midpoint of two saturated hues keeps its chroma, and lightness runs straight', () => {
  const spec: OmbreSpec = { shape: 'dawn', stops: ['#e0392b', '#2b4fe0'] };
  const ramp = ombreRamp(spec);
  assert.equal(ramp.length, OMBRE_RAMP_STEPS);
  assert.equal(ramp[0], '#e0392b');
  assert.equal(ramp[ramp.length - 1], '#2b4fe0');
  const [a, mid, b] = [oklchOfHex(ramp[0]!), oklchOfHex(ramp[4]!), oklchOfHex(ramp[8]!)];
  // A straight sRGB mix of these two lands near #868787 — chroma under 0.02.
  assert.ok(mid.C > 0.1, `the middle greyed out (C=${mid.C.toFixed(3)})`);
  assert.ok(Math.abs(mid.L - (a.L + b.L) / 2) < 0.02, 'lightness is not linear across the ramp');
  // Three stops: the middle sample IS the middle stop.
  const three = ombreRamp({ shape: 'dawn', stops: ['#ffffff', '#ff0000', '#000000'] });
  assert.equal(three[4], '#ff0000');
  // A grey end takes the other end's hue rather than spinning through the wheel.
  const grey = ombreRamp({ shape: 'dawn', stops: ['#888888', '#ff0000'] });
  for (const c of grey.slice(1, -1)) {
    const h = oklchOfHex(c).H;
    assert.ok(Math.abs(h - oklchOfHex('#ff0000').H) < 2 || oklchOfHex(c).C < 0.02, `${c} wandered in hue (${h.toFixed(1)})`);
  }
});

test('the CSS is a gradient stack of hex digits, keywords and numbers only — nothing a couple typed passes through', () => {
  const SAFE = /^[a-z0-9#(),.% -]+$/;
  for (const preset of OMBRE_PRESETS) {
    const css = ombreCss(preset.spec);
    assert.match(css, SAFE, `${preset.id}: ${css}`);
    for (const stop of preset.spec.stops) assert.ok(css.includes(stop), `${preset.id}: stop ${stop} is not drawn`);
    assert.equal((css.match(/#[0-9a-f]{6}/g) ?? []).length >= OMBRE_RAMP_STEPS, true, `${preset.id}: fewer colours than the ramp`);
  }
  assert.match(ombreCss({ shape: 'diagonal', stops: ['#ffffff', '#000000'] }), /^radial-gradient\(ellipse .*\), linear-gradient\(160deg, #ffffff 0\.0%/);
  assert.match(ombreCss({ shape: 'glow', stops: ['#ffffff', '#000000'] }), /^radial-gradient\(ellipse [^,]*, #ffffff 0\.0%/);
  assert.match(ombreCss({ shape: 'dawn', stops: ['#ffffff', '#000000'] }), /^linear-gradient\(180deg, #ffffff 0\.0%, .* #000000 100\.0%\)$/);
  assert.equal(
    ombreCss({ shape: 'dawn', stops: ['#ffffff', '#000000'] }, { color: '#ffffff', opacity: 0 }),
    ombreCss({ shape: 'dawn', stops: ['#ffffff', '#000000'] }),
    'a zero veil adds no layer',
  );
});

test('the look’s vars are channel triplets on the tokens the guest page paints with, and the paper is the ramp’s middle', () => {
  const spec: OmbreSpec = { shape: 'dawn', stops: ['#fbf7ef', '#ece1cf'] };
  const look = ombreLook(INVITE_THEMES.house, spec);
  assert.deepEqual(Object.keys(look.vars).sort(), ['--color-cream', '--color-gild', '--color-ink', '--color-ink-on-plate', '--color-terracotta']);
  for (const v of Object.values(look.vars)) assert.match(v, /^\d{1,3} \d{1,3} \d{1,3}$/);
  const mid = ombreRamp(spec)[4]!;
  const n = parseInt(mid.slice(1), 16);
  assert.equal(look.vars['--color-cream'], `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`);
});

/* ── the one switch ──────────────────────────────────────────────────────── */

test('the ombré ships FREE: OMBRE_IS_PRO is false and no site_bg_color write is a look change', () => {
  assert.equal(OMBRE_IS_PRO, false, 'flipping this is a product decision — re-read hub-look-is-pro.test.ts when you do');
  assert.equal(ombreLookChange(null, 'ombre:dawn:#ffffff,#000000'), 'none');
  assert.equal(ombreLookChange('ombre:dawn:#ffffff,#000000', '#ffffff'), 'none');
  assert.equal(ombreLookChange('#ffffff', undefined), 'none');
});
