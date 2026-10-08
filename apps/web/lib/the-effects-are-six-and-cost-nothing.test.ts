/**
 * ✨ THE EFFECTS ARE SIX, THEY SHOW ON ANY GROUND, AND THEY COST A GUEST'S PHONE NOTHING BUT A FEW SHAPES.
 *
 * Owner, 2026-10-08 (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A "The effects — art direction" and § 8 PR 3's guards).
 *
 * Each test here runs the engine itself (`lib/ambient-effects.ts`) or the one layer that draws it — never a
 * string that merely looks right:
 *   (1) the counts are the art direction's table, scaled by How much, never above the cap;
 *   (2) the stylesheet moves only what the compositor moves, fetches nothing, keeps the readable band, and under
 *       reduce motion PAUSES (a still), never hides;
 *   (3) every shape starts mid-flight (a negative delay) — so that still is a finished picture;
 *   (4) a picked palette colour always stands 2.4:1 off the ground — over a sweep of grounds and every theme's
 *       five — and one that already does is left exactly as the couple chose it;
 *   (5) the rendered layer is shapes and one stylesheet: no image, no script, no canvas, no video, no address;
 *   (6) the same effect on the same ground is the same drawing, shape for shape — the sample screen, the card and
 *       the guest page cannot disagree;
 *   (7) which are free and which are Pro, and the words the couple reads.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HUB_MAIN_EFFECTS, HUB_MAIN_EFFECT_COLOURS, HUB_MAIN_EFFECT_INTENSITIES, type HubMainEffect } from './hub-canvas';
import { contrastRatio, compositeOver } from './hub-legibility';
import { INVITE_THEMES, INVITE_THEME_IDS } from './invite-themes';
import { themeSeedPalette } from './mood-board-palette-set';
import {
  AMBIENT_COLOUR_FLOOR,
  AMBIENT_COLOUR_LABEL,
  AMBIENT_COUNT_CAP,
  AMBIENT_EFFECT_CSS,
  AMBIENT_EFFECT_IS_PRO,
  AMBIENT_EFFECT_LABEL,
  AMBIENT_INTENSITY_LABEL,
  ambientCount,
  ambientEffectSpec,
  ambientGround,
  ambientGroundIsDark,
  ambientPull,
  ambientSwatch,
  ambientTriad,
} from './ambient-effects';
import { AmbientEffectLayer } from '../app/[slug]/_components/ambient-effect';

/* The layer is JSX: under `tsx --test` it compiles to React.createElement (the house idiom). */
(globalThis as unknown as { React: unknown }).React = React;

const FIVE = ['#FBFBFA', '#C5A059', '#9CA98B', '#C9A9A6', '#D8C7B0'];
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Grounds an effect can lie on: a grey ramp, a spread of hues at three depths, and every moving background's two measured colours. */
const GROUNDS: string[] = [
  ...Array.from({ length: 52 }, (_, i) => hex(i * 5, i * 5, i * 5)),
  ...[40, 110, 180, 235].flatMap((v) => [hex(v, 30, 30), hex(30, v, 30), hex(30, 30, v), hex(v, v, 30), hex(30, v, v), hex(v, 30, v), hex(v, Math.round(v * 0.8), Math.round(v * 0.6))]),
  ...INVITE_THEME_IDS.flatMap((id) => (INVITE_THEMES[id].media ? [INVITE_THEMES[id].media!.samples.light, INVITE_THEMES[id].media!.samples.dark] : [])),
];

test('(1) how many shapes: the art direction’s table, scaled by How much, never above the cap', () => {
  /* The note's table — Standard (Subtle · Lavish), at 375 px. Written out here, not read from the engine. */
  const TABLE: Record<string, [number, number, number]> = {
    lanterns: [5, 8, 12],
    petals: [7, 12, 18],
    sparkles: [10, 16, 24],
    capiz: [5, 9, 14],
    shimmer: [8, 14, 21],
    bokeh: [5, 9, 14],
  };
  assert.deepEqual(Object.keys(TABLE).sort(), [...HUB_MAIN_EFFECTS].sort());
  for (const kind of HUB_MAIN_EFFECTS) {
    const [subtle, standard, lavish] = TABLE[kind]!;
    assert.deepEqual([ambientCount(kind, 'subtle'), ambientCount(kind, 'standard'), ambientCount(kind, 'lavish')], [subtle, standard, lavish], kind);
    for (const intensity of HUB_MAIN_EFFECT_INTENSITIES) {
      const drawn = ambientEffectSpec({ kind, intensity }, '#F3EEE6', FIVE).particles.length;
      assert.equal(drawn, ambientCount(kind, intensity), `${kind} ${intensity}: the layer draws a different number than the table`);
      assert.ok(drawn <= AMBIENT_COUNT_CAP, `${kind} ${intensity}: ${drawn} shapes — over the cap of ${AMBIENT_COUNT_CAP}`);
      const mini = ambientEffectSpec({ kind, intensity }, '#F3EEE6', FIVE, true).particles.length;
      assert.ok(mini > 0 && mini < drawn, `${kind} ${intensity}: a card's miniature is not a smaller drawing (${mini} of ${drawn})`);
    }
  }
});

test('(2) the stylesheet moves only what the compositor moves, fetches nothing, keeps the readable band, and pauses under reduce motion', () => {
  const css = AMBIENT_EFFECT_CSS;
  /* Every animation, and only these properties inside it. */
  const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\{((?:[^{}]*\{[^{}]*\})+)\}/g)];
  assert.equal(frames.length, 8, 'the animations: rise · sway · fall · turn · twinkle · swing · drift · glint');
  const MOVES = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity']);
  for (const [, name, body] of frames) {
    for (const [, decls] of body!.matchAll(/\{([^{}]*)\}/g)) {
      for (const decl of decls!.split(';').filter(Boolean)) {
        const prop = decl.split(':')[0]!.trim();
        assert.ok(MOVES.has(prop), `@keyframes ${name} animates "${prop}" — that is layout or paint on every frame of a guest's phone`);
      }
    }
  }
  /* Each animation named in a rule exists, and each animation is used. */
  const used = new Set([...css.matchAll(/animation:([^;}]+)/g)].flatMap((m) => [...m[1]!.matchAll(/sn-fx-[\w-]+/g)].map((x) => x[0])));
  assert.deepEqual([...used].sort(), frames.map((f) => f[1]!).sort());
  /* Nothing is fetched. */
  for (const banned of ['url(', '@import', '@font-face', 'image-set(', 'src:', 'http']) {
    assert.equal(css.includes(banned), false, `the effects' stylesheet holds "${banned}" — an effect would make a request`);
  }
  /* No colour is worked out by the browser from a function older phones lack. */
  assert.equal(css.includes('color-mix('), false, 'color-mix() is back — on a phone without it the glow and the shell vanish');
  /* The readable band, and the miniature's exemption (it has no words to protect). */
  const band = 'linear-gradient(180deg,#000 0 12%,rgba(0,0,0,.5) 26%,rgba(0,0,0,.5) 82%,#000 94%)';
  assert.ok(css.includes(`-webkit-mask-image:${band};mask-image:${band}`), 'the band that keeps the words readable is gone, or no longer at half strength across the middle');
  assert.match(css, /\[data-ambient-effect\]\[data-ambient-mini\]\{-webkit-mask-image:none;mask-image:none\}/);
  /* Reduce motion PAUSES — the shapes stay where they are. Nothing hides them, nothing removes the animation. */
  /* 🪤 Seen in a browser: every shape's own rule is MORE specific than the pause and its `animation` shorthand sets
     the play state back to running — so the pause must be `!important`, or reduce motion changes nothing. Checked
     here the only way a suite with no browser can: the pause outranks every rule that names an animation. */
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\[data-ambient-effect\] i\{animation-play-state:paused!important\}\}$/);
  assert.equal([...css.matchAll(/animation:[^;}]*!important|animation-play-state:running/g)].length, 0, 'a shape’s own rule outranks the reduce-motion pause');
  assert.doesNotMatch(css, /animation:none|display:none|visibility:hidden/);
  /* A rule for each of the six, and a light-ground variant where the glow or the blend must swap. */
  for (const kind of HUB_MAIN_EFFECTS) assert.ok(css.includes(`[data-ambient-effect="${kind}"] i{`), `no shape for ${kind}`);
  for (const kind of ['lanterns', 'capiz', 'bokeh', 'shimmer']) {
    assert.ok(css.includes(`[data-ambient-effect="${kind}"][data-ambient-ground="light"] i`), `${kind} has no light-ground variant`);
  }
  /* The layer never places itself — the guest page fixes it behind the page, a card fills its box. */
  assert.doesNotMatch(css, /\[data-ambient-effect\]\{[^}]*position:/);
});

test('(3) every shape starts mid-flight, so a paused frame is a finished picture — and nothing but a twinkle is quick', () => {
  for (const kind of HUB_MAIN_EFFECTS) {
    for (const intensity of HUB_MAIN_EFFECT_INTENSITIES) {
      const { particles } = ambientEffectSpec({ kind, intensity }, '#2A2420', FIVE);
      const delays = particles.map((p) => parseFloat(p['--dl']!));
      assert.ok(delays.every((d) => d <= 0), `${kind}: a shape has a positive delay — under reduce motion it would never appear`);
      assert.ok(new Set(delays).size > particles.length / 2, `${kind}: the shapes share a delay — a paused frame would show them in a row`);
      const periods = particles.map((p) => parseFloat(p['--d']!));
      assert.ok(Math.min(...periods) >= (kind === 'sparkles' ? 2.4 : 3), `${kind}: a cycle of ${Math.min(...periods)} s — nothing but a twinkle runs under 3 s`);
      /* Three depths: near shapes crisp and large, far ones soft and small. */
      assert.deepEqual([...new Set(particles.map((p) => p['--b']))].sort(), ['.5px', '0px', '1.4px'].slice(0, new Set(particles.map((p) => p['--b'])).size).sort());
      const sizes = particles.map((p) => parseFloat(p['--s']!));
      assert.ok(Math.min(...sizes) >= 0.55 && Math.max(...sizes) <= 1.3, `${kind}: a shape outside the depth range (${Math.min(...sizes)}…${Math.max(...sizes)})`);
    }
  }
});

test('(4) a picked colour always shows: 2.4:1 off the ground, over every ground and every theme’s five — and one that already shows is left alone', () => {
  const palettes = [FIVE, ...INVITE_THEME_IDS.map((id) => themeSeedPalette(id).reception)];
  let checked = 0;
  for (const five of palettes) {
    for (const ground of GROUNDS) {
      for (const colour of HUB_MAIN_EFFECT_COLOURS) {
        const slot = five[HUB_MAIN_EFFECT_COLOURS.indexOf(colour)];
        if (!slot) continue;
        const body = ambientPull(slot, ground);
        assert.ok(contrastRatio(body, ground) >= AMBIENT_COLOUR_FLOOR, `${slot} over ${ground} → ${body}: ${contrastRatio(body, ground).toFixed(2)}:1 — it would not show`);
        if (contrastRatio(slot, ground) >= AMBIENT_COLOUR_FLOOR) assert.equal(body.toLowerCase(), slot.toLowerCase(), `${slot} already showed over ${ground} and was changed`);
        /* The layer wears exactly that body, with the two colours worked out from it. */
        const spec = ambientEffectSpec({ kind: 'lanterns', intensity: 'standard', colour }, ground, five);
        assert.deepEqual([spec.vars['--c1'], spec.vars['--c2'], spec.vars['--c3']], ambientTriad(body));
        assert.equal(ambientSwatch({ kind: 'lanterns', colour }, ground, five), body, 'the Colour row’s swatch is not the colour the effect wears');
        checked += 1;
      }
    }
  }
  assert.ok(checked > 3000, `the sweep is too small to mean anything (${checked})`);
  /* One colour in, three out — the note's own figures. */
  assert.deepEqual(ambientTriad('#808080'), ['#808080', compositeOver('#FFFFFF', 0.4, '#808080'), compositeOver('#000000', 0.35, '#808080')]);
  assert.equal(AMBIENT_COLOUR_FLOOR, 2.4);
  /* Deepened on a light page, lightened on a dark one. */
  assert.ok(contrastRatio(ambientPull('#D8C7B0', '#F3EEE6'), '#FFFFFF') > contrastRatio('#D8C7B0', '#FFFFFF'), 'a pale colour on a light page was not deepened');
  assert.ok(contrastRatio(ambientPull('#3A3030', '#1A1614'), '#000000') > contrastRatio('#3A3030', '#000000'), 'a dark colour on a dark page was not lightened');
});

test('(4b) the ground is what the page really draws under the effect — the picture under its veil, a blend, or the page colour', () => {
  const frame = ['#101820', '#30404A'];
  const under = ambientGround({ frame, veil: null, scrim: null, paper: '#F3EEE6' });
  assert.equal(under, '#202c35');
  assert.equal(ambientGround({ frame, veil: null, scrim: 0.5, paper: '#F3EEE6' }), compositeOver('#F3EEE6', 0.5, under), 'the page’s own paper over the picture is not counted');
  assert.equal(ambientGround({ frame, veil: { color: '#000000', opacity: 0.6 }, scrim: 0.5, paper: '#F3EEE6' }), compositeOver('#000000', 0.6, under), 'a Fade’s veil is what lies over the picture — not the paper scrim too');
  assert.equal(ambientGround({ frame: [], veil: null, scrim: null, paper: '#F3EEE6', ramp: ['#000000', '#ffffff'] }), '#808080');
  assert.equal(ambientGround({ frame: null, veil: null, scrim: null, paper: '#F3EEE6' }), '#F3EEE6');
  /* Light or dark is asked of THAT colour: a dark picture faded to white is a light ground. */
  assert.equal(ambientGroundIsDark(under), true);
  assert.equal(ambientGroundIsDark(ambientGround({ frame, veil: { color: '#FFFFFF', opacity: 0.8 }, scrim: null, paper: '#F3EEE6' })), false);
  assert.equal(ambientEffectSpec({ kind: 'bokeh', intensity: 'standard' }, under, FIVE).ground, 'dark');
  assert.equal(ambientEffectSpec({ kind: 'bokeh', intensity: 'standard' }, '#F3EEE6', FIVE).ground, 'light');
});

test('(5) the layer is shapes and one stylesheet — no image, no script, no canvas, no video, no address', () => {
  for (const kind of HUB_MAIN_EFFECTS) {
    for (const ground of ['#F3EEE6', '#15110F']) {
      const spec = ambientEffectSpec({ kind, intensity: 'lavish', colour: 'accent' }, ground, FIVE);
      const html = renderToStaticMarkup(React.createElement(AmbientEffectLayer, { spec, className: 'absolute inset-0' }));
      assert.equal((html.match(/<i /g) ?? []).length, spec.particles.length, `${kind}: the layer did not draw every shape once`);
      for (const banned of ['<img', '<script', '<canvas', '<video', '<svg', '<link', 'url(', 'http', 'src=']) {
        assert.equal(html.includes(banned), false, `${kind}: the effect layer holds "${banned}"`);
      }
      assert.match(html, /^<div aria-hidden="true" data-ambient-effect="[a-z]+" data-ambient-ground="(light|dark)" class="absolute inset-0"/, 'the layer is not hidden from a screen reader, or not marked');
      assert.equal((html.match(/<style/g) ?? []).length, 1);
      /* A strip of cards draws the stylesheet once: a layer told so draws none. */
      assert.equal(renderToStaticMarkup(React.createElement(AmbientEffectLayer, { spec, className: 'x', css: false })).includes('<style'), false);
    }
  }
});

test('(6) the same effect on the same ground is the same drawing, shape for shape — and a different amount, colour or ground is a different one', () => {
  for (const kind of HUB_MAIN_EFFECTS) {
    const effect: HubMainEffect = { kind, intensity: 'standard', colour: 'supporting' };
    const a = ambientEffectSpec(effect, '#203040', FIVE);
    assert.deepEqual(ambientEffectSpec({ ...effect }, '#203040', [...FIVE]), a, `${kind}: two drawings of one effect differ — the sample and the guest page would not match`);
    assert.notDeepEqual(ambientEffectSpec({ ...effect, intensity: 'lavish' }, '#203040', FIVE).particles, a.particles);
    assert.notDeepEqual(ambientEffectSpec({ ...effect, colour: 'accent' }, '#203040', FIVE).vars, a.vars);
    assert.notDeepEqual(ambientEffectSpec({ kind, intensity: 'standard' }, '#203040', FIVE).vars, a.vars, `${kind}: a picked colour draws the same as Original`);
    assert.notDeepEqual(ambientEffectSpec(effect, '#F3EEE6', FIVE).vars, a.vars, `${kind}: the colour is not pulled for the ground it lies on`);
    /* The five reach it: change the slot's colour and the effect follows — one fact, one home. */
    const other = [...FIVE];
    other[1] = '#3355AA';
    assert.notDeepEqual(ambientEffectSpec(effect, '#203040', other).vars, a.vars, `${kind}: the effect does not follow the palette`);
  }
});

test('(7) the words, and which are free: Sparkles and Bokeh lights — the other four are Pro', () => {
  assert.deepEqual(
    HUB_MAIN_EFFECTS.map((k) => `${AMBIENT_EFFECT_LABEL[k]}${AMBIENT_EFFECT_IS_PRO[k] ? ' ◆' : ''}`),
    ['Lanterns ◆', 'Falling petals ◆', 'Sparkles', 'Capiz glow ◆', 'Gold shimmer ◆', 'Bokeh lights'],
    'the set, its order or its Pro marks moved off the approved prototype’s',
  );
  assert.deepEqual(Object.values(AMBIENT_INTENSITY_LABEL), ['Subtle', 'Standard', 'Lavish']);
  assert.deepEqual(Object.values(AMBIENT_COLOUR_LABEL), ['Dominant', 'Supporting', 'Accent', 'Neutral', 'Accent 2']);
  assert.deepEqual(Object.keys(AMBIENT_COLOUR_LABEL), [...HUB_MAIN_EFFECT_COLOURS]);
});
