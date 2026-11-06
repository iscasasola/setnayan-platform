/**
 * lib/ombre.test.ts — ONE COLOUR, ONE EFFECT, MEASURED.
 *
 * Owner, 2026-09-25: *"so the pick a color, and you apply either plain, dawn,
 * diagonal or glow effect. that's it"*. Four properties, each measured from what
 * the module returns — never a phrasing:
 *
 *   1. from ONE colour the three ombrés derive a ramp that always spans real
 *      lightness (never a flat fill, never a pure white or black end), and the
 *      couple's own colour sits exactly in its middle;
 *   2. body text clears WCAG AA over EVERY colour of the ramp — bare over every
 *      theme's own colours and a sweep of light and dark picks, and under a veil
 *      that is raised when a mid-tone pick makes both inks fail bare;
 *   3. the spec round-trips through the column's text form, and noise is dropped;
 *   4. the ramp is interpolated in OKLCH and the CSS it draws is only ever hex
 *      digits, keywords and numbers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { oklchOfHex } from '@/lib/color-space';
import { AA_BODY, AA_LARGE, compositeOver, contrastRatio } from '@/lib/hub-legibility';
import { HUB_THEMES, INVITE_THEMES } from '@/lib/invite-themes';
import {
  BACKGROUND_EFFECTS,
  BACKGROUND_EFFECT_LABEL,
  OMBRE_DROP,
  OMBRE_IS_PRO,
  OMBRE_LIFT,
  OMBRE_RAMP_STEPS,
  OMBRE_SHAPES,
  encodeBackgroundChoice,
  encodeOmbre,
  encodeSiteBackground,
  isOmbreValue,
  backgroundPlainOffered,
  ombreAnchors,
  ombreCss,
  ombreLegibility,
  ombreLook,
  ombreLookChange,
  ombreRamp,
  parseOmbre,
  parseSiteBackground,
  type OmbreSpec,
} from '@/lib/ombre';

/** A sweep of colours a couple could pick: the edges, the themes' own, and mid-tones. */
const PICKS = [
  '#ffffff',
  '#000000',
  '#fbf7ef',
  '#f4ecdd',
  '#0e0504',
  '#1a0b2e',
  '#e0392b',
  '#2b4fe0',
  '#3a4a1c',
  '#c9aab3',
  '#777777',
  '#8a9eae',
  ...HUB_THEMES.flatMap((t) => [t.palette.canvas, t.palette.surface, t.palette.accent]),
];

const ch = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/* ── 1 · one colour → a real ramp ────────────────────────────────────────── */

test('the four effects are the owner’s four, named as he said them', () => {
  assert.deepEqual([...BACKGROUND_EFFECTS], ['plain', 'dawn', 'diagonal', 'glow']);
  assert.deepEqual([...OMBRE_SHAPES], ['dawn', 'diagonal', 'glow']);
  assert.deepEqual(Object.values(BACKGROUND_EFFECT_LABEL), ['Plain', 'Dawn', 'Diagonal', 'Glow']);
});

test('from one colour the anchors always span real lightness, the colour is one of them, and no end is pure white or black', () => {
  const L = (h: string) => oklchOfHex(h).L;
  for (const base of PICKS) {
    const anchors = ombreAnchors(base);
    const light = anchors[0]!;
    const dark = anchors[anchors.length - 1]!;
    assert.ok(anchors.includes(base.toLowerCase()), `${base}: the couple's own colour must be an anchor`);
    assert.ok(anchors.length === 2 || anchors.length === 3);
    assert.ok(L(light) > L(dark), `${base}: light end is not lighter than the dark end`);
    assert.ok(L(light) - L(dark) >= OMBRE_LIFT + OMBRE_DROP - 0.01, `${base}: the ramp collapsed (${(L(light) - L(dark)).toFixed(3)})`);
    // A DERIVED end never reaches pure black or white; the couple's own black or white may be an end.
    if (dark !== base.toLowerCase()) assert.ok(L(dark) > 0.03, `${base}: the derived dark end hit black`);
    if (light !== base.toLowerCase()) assert.ok(L(light) < 0.995, `${base}: the derived light end hit white`);
    // Every step between neighbouring anchors is visible — no near-flat half followed by a cliff.
    for (let i = 1; i < anchors.length; i++) assert.ok(L(anchors[i - 1]!) - L(anchors[i]!) >= 0.03 - 1e-6, `${base}: anchor step ${i} is too small to see`);
    for (const shape of OMBRE_SHAPES) {
      const ramp = ombreRamp({ shape, base });
      assert.equal(ramp.length, OMBRE_RAMP_STEPS);
      assert.equal(ramp[0], light);
      assert.equal(ramp[8], dark);
      assert.ok(ramp.includes(base.toLowerCase()), `${base}: the couple's colour is not drawn`);
      // Lightness runs monotonically light → dark: no bump, no banding step.
      for (let i = 1; i < ramp.length; i++) assert.ok(L(ramp[i]!) <= L(ramp[i - 1]!) + 1e-6, `${base}: lightness rises at sample ${i}`);
    }
  }
  // A colour with room on both sides sits in the middle; one at an edge becomes that end.
  assert.deepEqual(ombreAnchors('#c9aab3').length, 3);
  assert.equal(ombreAnchors('#c9aab3')[1], '#c9aab3');
  assert.equal(ombreAnchors('#ffffff')[0], '#ffffff');
  assert.equal(ombreAnchors('#fbf7ef')[0], '#fbf7ef', 'a near-white pick is the light end, not a step too small to see');
  assert.equal(ombreAnchors('#000000').at(-1), '#000000');
});

/* ── 2 · legibility ──────────────────────────────────────────────────────── */

function assertReads(label: string, ink: string, over: readonly string[], scrim: { color: string; opacity: number }, target: number) {
  for (const bg of over) {
    const painted = compositeOver(scrim.color, scrim.opacity, bg);
    const ratio = contrastRatio(ink, painted);
    assert.ok(ratio >= target - 1e-9, `${label}: ${ink} over ${bg} (veiled ${painted}) is ${ratio.toFixed(2)}:1, under ${target}`);
  }
}

test('every theme × every pick × every effect → body text clears AA over the WHOLE ramp (veiled when it must be), the ink is the theme’s', () => {
  let measured = 0;
  for (const theme of HUB_THEMES) {
    for (const base of PICKS) {
      for (const shape of OMBRE_SHAPES) {
        const spec: OmbreSpec = { shape, base };
        const ramp = ombreRamp(spec);
        const leg = ombreLegibility(theme, spec);
        assertReads(`${theme.id} ${shape} ${base} body`, leg.ink, ramp, leg.scrim, AA_BODY);
        assertReads(`${theme.id} ${shape} ${base} heading`, leg.heading, ramp, leg.scrim, AA_LARGE);
        assertReads(`${theme.id} ${shape} ${base} accent`, leg.accent, ramp, leg.scrim, AA_BODY);
        assert.ok([theme.palette.lightInk, theme.palette.darkInk].includes(leg.ink), `${theme.id}: the ink left the theme`);
        measured += 1;
      }
    }
  }
  assert.equal(measured, HUB_THEMES.length * PICKS.length * OMBRE_SHAPES.length, 'a case was skipped');
});

test('a theme’s own canvas and a light or dark pick read with NO veil; a mid-grey pick raises one and then reads', () => {
  for (const theme of HUB_THEMES) {
    for (const shape of OMBRE_SHAPES) {
      for (const base of [theme.palette.canvas, '#fbf7ef', '#0e0504']) {
        const look = ombreLook(theme, { shape, base });
        assert.equal(look.legibility.scrim.opacity, 0, `${theme.id} ${shape} ${base}: a veil was raised where none is needed`);
        assert.doesNotMatch(look.css, /^linear-gradient\(rgba/, 'no veil layer without a veil');
      }
      // Black is ~4.0:1 and white ~4.3:1 over #777 — neither clears 4.5 bare.
      const grey = ombreLook(theme, { shape, base: '#777777' });
      assert.ok(grey.legibility.scrim.opacity > 0, `${theme.id} ${shape}: no veil raised over a mid-grey ramp`);
      assert.ok(grey.legibility.bodyContrast >= AA_BODY - 1e-9);
      assert.match(grey.css, /^linear-gradient\(rgba\(\d+, \d+, \d+, 0\.\d\d\), rgba\(/, `${theme.id}: the veil is not the top layer`);
    }
  }
});

test('the tone follows the pick, not the theme: Classic on a dark pick takes its light ink; Luxe on a pale pick takes its dark ink', () => {
  const dark = ombreLook(INVITE_THEMES.house, { shape: 'dawn', base: '#1e0a1d' });
  assert.equal(dark.legibility.ink, INVITE_THEMES.house.palette.lightInk);
  const pale = ombreLook(INVITE_THEMES.velvet, { shape: 'glow', base: '#f4ecdd' });
  assert.equal(pale.legibility.ink, INVITE_THEMES.velvet.palette.darkInk);
  const own = ombreLook(INVITE_THEMES.velvet, { shape: 'diagonal', base: INVITE_THEMES.velvet.palette.canvas });
  assert.equal(own.legibility.ink, INVITE_THEMES.velvet.palette.lightInk);
});

test('the plate ink is PINNED to the theme’s own ink, never the adapted page ink — or a plate over a dark ombré goes blank', () => {
  const dark = ombreLook(INVITE_THEMES.house, { shape: 'dawn', base: '#1e0a1d' });
  assert.equal(dark.vars['--color-ink'], ch(INVITE_THEMES.house.palette.lightInk));
  assert.equal(dark.vars['--color-ink-on-plate'], ch(INVITE_THEMES.house.palette.ink));
  assert.notEqual(dark.vars['--color-ink-on-plate'], dark.vars['--color-ink']);
  for (const theme of HUB_THEMES) {
    assert.equal(ombreLook(theme, { shape: 'glow', base: '#777777' }).vars['--color-ink-on-plate'], ch(theme.palette.ink), theme.id);
  }
});

/* ── 3 · storage ─────────────────────────────────────────────────────────── */

test('the spec round-trips through the column: plain hex stays plain, an ombré comes back exactly, the choice encodes to one of the two', () => {
  assert.deepEqual(parseSiteBackground('#F5EFE6'), { kind: 'plain', hex: '#f5efe6' });
  assert.equal(encodeSiteBackground({ kind: 'plain', hex: '#f5efe6' }), '#f5efe6');

  const spec: OmbreSpec = { shape: 'diagonal', base: '#1a0608' };
  const stored = encodeOmbre(spec);
  assert.equal(stored, 'ombre:diagonal:#1a0608');
  assert.ok(stored.length <= 22, 'the stored form must stay small');
  assert.deepEqual(parseSiteBackground(stored), { kind: 'ombre', ombre: spec });
  assert.equal(encodeSiteBackground(parseSiteBackground(stored)!), stored);
  assert.deepEqual(parseOmbre(' ombre:dawn:#FBF7EF '), { shape: 'dawn', base: '#fbf7ef' });

  assert.equal(encodeBackgroundChoice('#FBF7EF', 'plain'), '#fbf7ef');
  assert.equal(encodeBackgroundChoice('#FBF7EF', 'glow'), 'ombre:glow:#fbf7ef');
  assert.equal(encodeBackgroundChoice('', 'glow'), '', 'no colour → nothing to store, whatever the effect');
  assert.equal(encodeBackgroundChoice(null, 'plain'), '');
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
    'ombre:swirl:#ffffff',
    'ombre:dawn:#ffffff,#000000', // the retired two-colour grammar
    'ombre:dawn:#zzzzzz',
    'ombre:dawn:#ffffff:extra',
    'ombre:dawn:url(x)',
    'ombre:dawn:#ffffff;background:red',
    42,
    { shape: 'dawn', base: '#ffffff' },
  ]) {
    assert.equal(parseSiteBackground(junk), null, `accepted ${JSON.stringify(junk)}`);
    assert.equal(isOmbreValue(junk), false);
  }
  assert.equal(isOmbreValue('#f5efe6'), false, 'a plain hex is not an ombré');
  assert.equal(isOmbreValue('ombre:dawn:#ffffff'), true);
});

/* ── 4 · the ramp and the CSS ────────────────────────────────────────────── */

test('the ramp is OKLCH: a saturated pick keeps its chroma across the ramp, and its hue turns only a few degrees', () => {
  const base = '#e0392b';
  const ramp = ombreRamp({ shape: 'dawn', base });
  const b = oklchOfHex(base);
  for (const c of ramp) {
    const o = oklchOfHex(c);
    assert.ok(o.C > b.C * 0.5, `${c} lost its chroma (C=${o.C.toFixed(3)})`);
    const dh = Math.abs(((o.H - b.H + 540) % 360) - 180);
    assert.ok(dh <= 6.5, `${c} turned ${dh.toFixed(1)}° from the pick`);
  }
  // A grey pick stays grey — the hue turn is meaningless and must not invent colour.
  for (const c of ombreRamp({ shape: 'glow', base: '#888888' })) assert.ok(oklchOfHex(c).C < 0.02, `${c} is not grey`);
});

test('the CSS is a gradient stack of hex digits, keywords and numbers only — nothing a couple typed passes through', () => {
  const SAFE = /^[a-z0-9#(),.% -]+$/;
  for (const base of PICKS) {
    for (const shape of OMBRE_SHAPES) {
      const css = ombreCss({ shape, base });
      assert.match(css, SAFE, `${shape} ${base}: ${css}`);
      assert.ok(css.includes(base.toLowerCase()), `${shape} ${base}: the couple's colour is not drawn`);
      assert.ok((css.match(/#[0-9a-f]{6}/g) ?? []).length >= OMBRE_RAMP_STEPS, `${shape} ${base}: fewer colours than the ramp`);
    }
  }
  const w = { base: '#f4ecdd' };
  const anchors = ombreAnchors(w.base);
  const [light, dark] = [anchors[0]!, anchors[anchors.length - 1]!];
  // Dawn is dark above and light at the horizon; the other two run light → dark.
  assert.match(ombreCss({ shape: 'dawn', ...w }), new RegExp(`^linear-gradient\\(180deg, ${dark} 0\\.0%, .* ${light} 100\\.0%\\)$`));
  assert.match(ombreCss({ shape: 'diagonal', ...w }), new RegExp(`^radial-gradient\\(ellipse .*\\), linear-gradient\\(160deg, ${light} 0\\.0%`));
  assert.match(ombreCss({ shape: 'glow', ...w }), new RegExp(`^radial-gradient\\(ellipse [^,]*, ${light} 0\\.0%`));
  assert.equal(ombreCss({ shape: 'dawn', ...w }, { color: '#ffffff', opacity: 0 }), ombreCss({ shape: 'dawn', ...w }), 'a zero veil adds no layer');
});

test('the look’s vars are channel triplets on the tokens the guest page paints with, and the paper is the couple’s colour', () => {
  const look = ombreLook(INVITE_THEMES.house, { shape: 'dawn', base: '#fbf7ef' });
  assert.deepEqual(Object.keys(look.vars).sort(), ['--color-cream', '--color-gild', '--color-ink', '--color-ink-on-plate', '--color-terracotta']);
  for (const v of Object.values(look.vars)) assert.match(v, /^\d{1,3} \d{1,3} \d{1,3}$/);
  assert.equal(look.vars['--color-cream'], ch('#fbf7ef'));
});

/* ── the one switch ──────────────────────────────────────────────────────── */

test('the ombré ships FREE: OMBRE_IS_PRO is false and no site_bg_color write is a look change', () => {
  assert.equal(OMBRE_IS_PRO, false, 'flipping this is a product decision — re-read hub-look-is-pro.test.ts when you do');
  assert.equal(ombreLookChange(null, 'ombre:dawn:#ffffff'), 'none');
  assert.equal(ombreLookChange('ombre:dawn:#ffffff', '#ffffff'), 'none');
  assert.equal(ombreLookChange('#ffffff', undefined), 'none');
});

/* ── 🎨🎨 a second colour (owner 2026-10-08, "LOOK › BACKGROUND, AMENDED") ──────── */

/** Pairs a couple could set: light → dark, dark → light, two mid-tones, complements, a colour and itself's neighbour, the edges. */
const PAIRS: readonly (readonly [string, string])[] = [
  ['#f6f1e7', '#c5a059'],
  ['#c5a059', '#f6f1e7'],
  ['#ffffff', '#000000'],
  ['#000000', '#ffffff'],
  ['#1a0b2e', '#e0392b'],
  ['#e0392b', '#2b4fe0'],
  ['#777777', '#8a9eae'],
  ['#fbf7ef', '#f4ecdd'],
  ['#0e0504', '#1a0b2e'],
  ['#3a4a1c', '#c9aab3'],
  ['#9ca98b', '#c9a9a6'],
  ['#fbfbfa', '#d8c7b0'],
];

test('🎨🎨 the column reads three or four segments and nothing else; both round-trip; one colour is written exactly as before', () => {
  // Three segments: unchanged, byte for byte.
  assert.equal(encodeOmbre({ shape: 'dawn', base: '#f4ecdd' }), 'ombre:dawn:#f4ecdd');
  assert.deepEqual(parseOmbre('ombre:dawn:#f4ecdd'), { shape: 'dawn', base: '#f4ecdd' });
  assert.equal('to' in parseOmbre('ombre:dawn:#f4ecdd')!, false, 'a one-colour value grew a second colour');
  // Four: the second colour, canonical, within the column's small budget.
  for (const shape of OMBRE_SHAPES) {
    const spec: OmbreSpec = { shape, base: '#f6f1e7', to: '#c5a059' };
    const stored = encodeOmbre(spec);
    assert.equal(stored, `ombre:${shape}:#f6f1e7:#c5a059`);
    assert.ok(stored.length <= 30, `${stored} is longer than 30 characters`);
    assert.deepEqual(parseSiteBackground(stored), { kind: 'ombre', ombre: spec });
    assert.equal(encodeSiteBackground(parseSiteBackground(stored)!), stored);
    assert.equal(isOmbreValue(stored), true);
  }
  assert.deepEqual(parseOmbre(' ombre:glow:#F6F1E7:#C5A059 '), { shape: 'glow', base: '#f6f1e7', to: '#c5a059' });
  // Anything else is dropped whole — never half-read as the one-colour value it starts with.
  for (const junk of ['ombre:dawn:#ffffff:', 'ombre:dawn:#ffffff:#zzzzzz', 'ombre:dawn:#ffffff:#000', 'ombre:dawn:#ffffff:#000000:#111111', 'ombre:dawn:#ffffff:url(x)', 'ombre:dawn::#000000', 'ombre:swirl:#ffffff:#000000']) {
    assert.equal(parseSiteBackground(junk), null, `accepted ${junk}`);
  }
  // The choice: a second colour rides a blend, never Plain — and Plain is not offered while there are two.
  assert.equal(encodeBackgroundChoice('#F6F1E7', 'diagonal', '#C5A059'), 'ombre:diagonal:#f6f1e7:#c5a059');
  assert.equal(encodeBackgroundChoice('#F6F1E7', 'diagonal', null), 'ombre:diagonal:#f6f1e7');
  assert.equal(encodeBackgroundChoice('#F6F1E7', 'diagonal', 'nonsense'), 'ombre:diagonal:#f6f1e7');
  assert.equal(encodeBackgroundChoice('#F6F1E7', 'plain', '#C5A059'), '#f6f1e7', 'Plain is always one bare hex');
  assert.equal(encodeBackgroundChoice(null, 'glow', '#C5A059'), '', 'no first colour → nothing to store');
  assert.equal(backgroundPlainOffered('#c5a059'), false, 'Plain is writable with two colours');
  assert.equal(backgroundPlainOffered(null), true, 'removing the second colour does not restore Plain');
  assert.equal(backgroundPlainOffered(undefined), true);
});

test('🎨🎨 with two colours the ramp runs from the first to the second — the same nine OKLCH steps, each end exactly the colour picked', () => {
  for (const [a, b] of PAIRS) {
    assert.deepEqual(ombreAnchors(a, b), [a, b], 'the two colours are not the anchors, in the order set');
    for (const shape of OMBRE_SHAPES) {
      const ramp = ombreRamp({ shape, base: a, to: b });
      assert.equal(ramp.length, OMBRE_RAMP_STEPS);
      assert.equal(ramp[0], a, `${shape}: the blend does not start on the first colour`);
      assert.equal(ramp[ramp.length - 1], b, `${shape}: the blend does not end on the second colour`);
      // Lightness moves ONE way between the two (never out past either end and back).
      const L = ramp.map((c) => oklchOfHex(c).L);
      const dir = Math.sign(L[L.length - 1]! - L[0]!);
      for (let i = 1; i < L.length; i++) assert.ok((L[i]! - L[i - 1]!) * dir >= -0.012, `${a} → ${b} ${shape}: lightness turns back at step ${i}`);
      const [lo, hi] = [Math.min(L[0]!, L[L.length - 1]!), Math.max(L[0]!, L[L.length - 1]!)];
      for (const l of L) assert.ok(l >= lo - 0.012 && l <= hi + 0.012, `${a} → ${b} ${shape}: a step leaves the two colours' range`);
    }
  }
  // One colour: the ramp is the shipped one — its own lighter and darker anchors, untouched by any of this.
  assert.deepEqual(ombreAnchors('#f4ecdd'), ombreAnchors('#f4ecdd', null));
  assert.deepEqual(ombreAnchors('#f4ecdd'), ombreAnchors('#f4ecdd', 'not a colour'));
  assert.equal(ombreAnchors('#c9aab3', null).length, 3);
  assert.notDeepEqual(ombreRamp({ shape: 'dawn', base: '#f4ecdd' }), ombreRamp({ shape: 'dawn', base: '#f4ecdd', to: '#c5a059' }));
});

test('🎨🎨 the CSS runs first colour → second colour in the direction each blend reads — and one colour draws exactly as it did', () => {
  const SAFE = /^[a-z0-9#(),.% -]+$/;
  const [a, b] = ['#f6f1e7', '#c5a059'] as const;
  // Dawn: the first colour above, the second below (one colour stays dark above, light at the horizon).
  assert.match(ombreCss({ shape: 'dawn', base: a, to: b }), new RegExp(`^linear-gradient\\(180deg, ${a} 0\\.0%, .* ${b} 100\\.0%\\)$`));
  // Diagonal: the first colour's bloom in the lit corner, running to the second.
  assert.match(ombreCss({ shape: 'diagonal', base: a, to: b }), new RegExp(`^radial-gradient\\(ellipse .*\\), linear-gradient\\(160deg, ${a} 0\\.0%, .* ${b} 100\\.0%\\)$`));
  // Glow: the first colour at the centre, the second at the edge.
  assert.match(ombreCss({ shape: 'glow', base: a, to: b }), new RegExp(`^radial-gradient\\(ellipse [^,]*, ${a} 0\\.0%, .* ${b} 100\\.0%\\)$`));
  for (const [x, y] of PAIRS) for (const shape of OMBRE_SHAPES) assert.match(ombreCss({ shape, base: x, to: y }), SAFE);
  // The shipped one-colour Dawn, as stored in events today: unchanged.
  const anchors = ombreAnchors('#f4ecdd');
  assert.match(ombreCss({ shape: 'dawn', base: '#f4ecdd' }), new RegExp(`^linear-gradient\\(180deg, ${anchors[anchors.length - 1]} 0\\.0%, .* ${anchors[0]} 100\\.0%\\)$`));
});

test('🎨🎨 every theme × every pair × every blend → the words clear AA over the WHOLE two-colour ramp (veiled when they must be)', () => {
  let measured = 0;
  let veiled = 0;
  for (const theme of HUB_THEMES) {
    for (const [base, to] of PAIRS) {
      for (const shape of OMBRE_SHAPES) {
        const spec: OmbreSpec = { shape, base, to };
        const ramp = ombreRamp(spec);
        const leg = ombreLegibility(theme, spec);
        assertReads(`${theme.id} ${shape} ${base} → ${to} body`, leg.ink, ramp, leg.scrim, AA_BODY);
        assertReads(`${theme.id} ${shape} ${base} → ${to} heading`, leg.heading, ramp, leg.scrim, AA_LARGE);
        assertReads(`${theme.id} ${shape} ${base} → ${to} accent`, leg.accent, ramp, leg.scrim, AA_BODY);
        assert.ok([theme.palette.lightInk, theme.palette.darkInk].includes(leg.ink), `${theme.id}: the ink left the theme`);
        if (leg.scrim.opacity > 0) veiled += 1;
        // The look: the paper token is the FIRST colour (the page colour), and the veil is baked into the CSS.
        const look = ombreLook(theme, spec);
        assert.equal(look.vars['--color-cream'], ch(base));
        assert.equal(look.css, ombreCss(spec, leg.scrim));
        measured += 1;
      }
    }
  }
  assert.equal(measured, HUB_THEMES.length * PAIRS.length * OMBRE_SHAPES.length, 'a case was skipped');
  // Anti-vacuity: black → white cannot read bare with either ink — the sweep must really raise veils.
  assert.ok(veiled >= HUB_THEMES.length * OMBRE_SHAPES.length, `only ${veiled} blends needed a veil — the sweep is too gentle to test the rule`);
});
