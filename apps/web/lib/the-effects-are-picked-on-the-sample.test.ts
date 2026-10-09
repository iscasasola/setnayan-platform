/**
 * ✨ AN EFFECT IS PICKED FROM LIVE MINIATURES, SHOWS ON THE SAMPLE AT THE TAP, AND COSTS ONE WRITE — OR NONE.
 *
 * Owner, 2026-10-08 (DECISION_LOG "LOOK EFFECTS ROUND 4" · "LOOK ROUNDS 4–5"; contract
 * `BACKGROUND_SOURCES_AMEND_2026-10-08_fable.md` § 2.A; the approved gallery's kinds 5 "Style card" and 20 "Pro
 * mark"): six effects on top of the background, chosen from a carousel of live miniatures, with How much ▾ and
 * Colour ▾ under it; a Pro effect is tried on the sample and never applied.
 *
 *   (1) what a tap WRITES — the pure rules, run: the background under an effect is never touched; taking it off
 *       leaves no key; another background keeps it; it starts gentle over a ground that moves;
 *   (2) ◆ tried, never applied — the rule, the approved words, and the panel's own path (a try reaches no save);
 *   (3) the carousel, RENDERED: None first then the six in the approved order, one ring, ◆ only where it is Pro and
 *       the couple has none, How much and Colour only while an effect is on, each a dropdown that opens;
 *   (4) one pick = one draft write and no whole-Maker render — read off the panel's one pick path;
 *   (5) the sample screen draws the effect through the ONE answer, and the cards are miniatures of what IT measured.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { HUB_MAIN_EFFECTS, hubMainEffect, hubMovingBackgroundIds, sanitizeHubMainGround, type HubMainEffect, type HubMainGround } from './hub-canvas';
import {
  EFFECT_NONE,
  effectMayApply,
  effectPicked,
  effectProNote,
  effectStart,
  effectWith,
  groundMoves,
  keepEffect,
  withEffect,
} from './background-effect';
import { AMBIENT_EFFECT_IS_PRO, AMBIENT_EFFECT_LABEL } from './ambient-effects';
import { backgroundPickRedraws, type LookGround } from './background-pick';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = 'app/dashboard/[eventId]/website/editor/_components';
const PANEL = read(`${E}/main-background-panel.tsx`);
const CARDS = read(`${E}/background-effects.tsx`);
const SAMPLE = read('app/dashboard/[eventId]/launch/_components/look-sample.tsx');

const REF = 'r2://setnayan-media/events/EV/hero/a.jpg';
const TINT = { match: true, frame: ['#112233', '#445566'] };
const LOOP = hubMovingBackgroundIds()[0]!;
const stored = (raw: unknown): HubMainGround => {
  const m = sanitizeHubMainGround(raw);
  assert.ok(m, `not a main background the app stores: ${JSON.stringify(raw)}`);
  return m;
};
const PHOTO = stored({ kind: 'photo', media: REF, tint: TINT, shade: -40, blur: 'soft', focus: 'top', motion: 'parallax' });
const CLIP = stored({ kind: 'snippet', media: REF, poster: REF, tint: TINT });
const VIDEO = stored({ ground: 'loop', loop: LOOP, shade: 30 });
const COLOUR = stored({ ground: 'none' });
const SPARKLES: HubMainEffect = { kind: 'sparkles', intensity: 'standard' };

/* ── (1) what a tap writes ────────────────────────────────────────────── */

test('(1) an effect is put on, changed and taken off without touching the background under it — and what is written is what the app stores', () => {
  for (const main of [PHOTO, CLIP, VIDEO, COLOUR, stored({ ground: 'theme' }), stored({ ground: 'pattern', pattern: 'lace' }), stored({ follow: 'hero', of: REF, tint: TINT })]) {
    const on = withEffect(main, { kind: 'lanterns', intensity: 'lavish', colour: 'accent' });
    assert.deepEqual(sanitizeHubMainGround(on), on, 'the write is not a main background the sanitiser keeps whole');
    assert.deepEqual(hubMainEffect(on), { kind: 'lanterns', intensity: 'lavish', colour: 'accent' });
    const { effect: _fx, ...under } = on as Record<string, unknown>;
    assert.deepEqual(under, main, 'putting an effect on changed the background under it');
    const off = withEffect(on, null);
    assert.deepEqual(off, main, 'taking the effect off did not leave the background exactly as it was');
    assert.equal('effect' in off, false, 'an empty "effect" key is left behind — never `effect: null`');
  }
  // Nothing stored at all: the first effect writes the page's own background with it — what "nothing" draws.
  assert.deepEqual(withEffect(null, SPARKLES), { ground: 'theme', effect: SPARKLES });
});

test('(1b) another background keeps the effect that was on; a background with nothing on gets nothing', () => {
  const was = withEffect(PHOTO, SPARKLES);
  assert.deepEqual(hubMainEffect(keepEffect(VIDEO, was)), SPARKLES, 'picking a video dropped the effect');
  assert.deepEqual(hubMainEffect(keepEffect(COLOUR, was)), SPARKLES, 'picking a plain colour dropped the effect');
  assert.deepEqual(keepEffect(VIDEO, PHOTO), VIDEO, 'an effect appeared out of nothing');
  assert.equal(keepEffect(null, null), null);
  // A next background that already says its own effect is left alone.
  const says = withEffect(VIDEO, { kind: 'bokeh', intensity: 'subtle' });
  assert.deepEqual(keepEffect(says, was), says);
});

test('(1c) turned on over a ground that MOVES an effect starts at its gentlest; over a still one, at Standard — and switching keeps How much and the Colour', () => {
  assert.equal(groundMoves(VIDEO, false), true);
  assert.equal(groundMoves(CLIP, false), true);
  assert.equal(groundMoves(stored({ ground: 'theme' }), true), true, 'the page’s own film moves');
  assert.equal(groundMoves(null, true), true, 'nothing stored on a theme with a film: the film is what is drawn');
  for (const still of [PHOTO, COLOUR, stored({ ground: 'pattern', pattern: 'dots' }), stored({ follow: 'hero', of: REF, tint: TINT })]) assert.equal(groundMoves(still, true), false);
  assert.equal(groundMoves(null, false), false);
  assert.equal(effectStart(VIDEO, false), 'subtle');
  assert.equal(effectStart(PHOTO, true), 'standard');
  assert.deepEqual(effectPicked('lanterns', null, VIDEO, false), { kind: 'lanterns', intensity: 'subtle' });
  assert.deepEqual(effectPicked('lanterns', null, COLOUR, false), { kind: 'lanterns', intensity: 'standard' });
  // Already on: the couple's own How much and Colour are kept — even over a film (they chose it).
  assert.deepEqual(effectPicked('petals', { kind: 'lanterns', intensity: 'lavish', colour: 'neutral' }, VIDEO, false), { kind: 'petals', intensity: 'lavish', colour: 'neutral' });
  // How much ▾ and Colour ▾: "Original" takes the key off — the word is never stored.
  const on: HubMainEffect = { kind: 'capiz', intensity: 'standard', colour: 'accent2' };
  assert.deepEqual(effectWith(on, { intensity: 'subtle' }), { kind: 'capiz', intensity: 'subtle', colour: 'accent2' });
  assert.deepEqual(effectWith(on, { colour: null }), { kind: 'capiz', intensity: 'standard' });
  assert.deepEqual(effectWith({ kind: 'capiz', intensity: 'standard' }, { colour: 'dominant' }), { kind: 'capiz', intensity: 'standard', colour: 'dominant' });
});

/* ── (2) ◆ tried, never applied ───────────────────────────────────────── */

test('(2) a Pro effect, without Event Hub Pro, is tried and never written — the rule, the words, and the panel’s own path', () => {
  for (const kind of HUB_MAIN_EFFECTS) {
    assert.equal(effectMayApply(kind, true), true, `${kind}: a couple WITH Pro is refused`);
    assert.equal(effectMayApply(kind, false), !AMBIENT_EFFECT_IS_PRO[kind], `${kind}: the free/Pro line moved`);
  }
  // The approved gallery's own words (kind 20).
  assert.deepEqual(effectProNote('shimmer'), {
    title: 'Gold shimmer is part of Pro',
    body: 'Pro also gives you scenes, films and your own music. You can keep trying it on the preview.',
    later: 'Not now',
    see: 'See Pro',
  });
  for (const kind of HUB_MAIN_EFFECTS) assert.equal(effectProNote(kind).title, `${AMBIENT_EFFECT_LABEL[kind]} is part of Pro`);
  // The panel asks BEFORE it writes, and a try tells the sample screen only.
  const tap = PANEL.slice(PANEL.indexOf('onPick={(k) => {\n              setNote(null);'));
  const mayAt = tap.indexOf('if (!effectMayApply(k, !proOn)) return tryEffect(next);');
  const writeAt = tap.indexOf('pickLook({ main: withEffect(current, next) }, FAILED, { fx: true });');
  assert.ok(mayAt > 0 && writeAt > mayAt, 'a Pro effect reaches the write before it is asked whether it may be applied');
  const tryBody = /const tryEffect = \(next: HubMainEffect\) => \{([\s\S]*?)\n    \};/.exec(PANEL)?.[1] ?? '';
  assert.match(tryBody, /setTrying\(next\);\s*tellLookSample\(eventId, \{ main: withEffect\(current, next\) \}\);/);
  assert.doesNotMatch(tryBody, /pickLook|saveLookWrite|saveMain|makerSave|makerRedrawSave|lookGround\.draw|hubDraftAction/, 'a TRY writes, or moves the ring');
  // How much ▾ and Colour ▾ on a tried effect stay tries.
  assert.match(PANEL, /const next = effectWith\(on, change\);\s*if \(trying\) return tryEffect\(next\);/);
  // "Not now", leaving the panel, and any real pick put the sample back.
  assert.match(PANEL, /const endTry = \(\) => \{\s*if \(!tryingRef\.current\) return;\s*setTrying\(null\);\s*tellLookSample\(eventId, \{ main: current \}\);/);
  assert.match(PANEL, /if \(tryingRef\.current\) tellLookSample\(eventId, \{ main: lookGround\.read\(lookKey, serverRef\.current\)\.main \}\);/);
  assert.match(PANEL, /if \(tryingRef\.current\) setTrying\(null\);/);
  // "See Pro" is a plain door, never preloaded.
  assert.match(CARDS, /<Link href=\{proHref\} prefetch=\{false\} data-bg-effects-pro-see=""/);
  assert.match(PANEL, /proHref=\{`\/dashboard\/\$\{eventId\}\/studio\/website-pro`\}/);
});

/* ── (3) the carousel, rendered ───────────────────────────────────────── */

async function carousel(props: { effect: HubMainEffect | null; trying?: HubMainEffect | null; locked: boolean }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BgEffects } = await import(`../${E}/background-effects`);
  return renderToStaticMarkup(
    React.createElement(BgEffects, {
      eventId: 'EV',
      effect: props.effect,
      trying: props.trying ?? null,
      locked: props.locked,
      proHref: '/dashboard/EV/studio/website-pro',
      swatch: '#F3EEE6',
      picture: null,
      onPick: () => {},
      onChange: () => {},
      onTryEnd: () => {},
    }),
  );
}
const cardsOf = (html: string) => [...html.matchAll(/<button type="button" aria-pressed="(true|false)"[^>]*data-bg-card="fx:([a-z]+)"[\s\S]*?<\/button>/g)].map((m) => ({ key: m[2]!, on: m[1] === 'true', html: m[0] }));

test('(3) the carousel: None, then the six in the approved order — one ringed, ◆ only on a Pro effect the couple cannot apply', async () => {
  const none = cardsOf(await carousel({ effect: null, locked: true }));
  assert.deepEqual(none.map((c) => c.key), [EFFECT_NONE, 'lanterns', 'petals', 'sparkles', 'capiz', 'shimmer', 'bokeh'], 'the cards or their order moved off the approved prototype');
  assert.deepEqual(none.filter((c) => c.on).map((c) => c.key), [EFFECT_NONE], 'with no effect, None is the one ringed card');
  assert.deepEqual(none.filter((c) => c.html.includes('aria-label="Event Hub Pro"')).map((c) => c.key), ['lanterns', 'petals', 'capiz', 'shimmer'], 'the ◆ marks are not the approved four');
  for (const c of none) {
    assert.ok(c.html.includes('sn-phone-card'), `${c.key}: not the one style card (112 × 149)`);
    assert.ok(c.html.includes(`>${c.key === EFFECT_NONE ? 'None' : AMBIENT_EFFECT_LABEL[c.key as keyof typeof AMBIENT_EFFECT_LABEL]}<`), `${c.key}: its name is not under it`);
  }
  // With Event Hub Pro there is nothing to mark.
  assert.equal((await carousel({ effect: null, locked: false })).includes('aria-label="Event Hub Pro"'), false);
  // The picked effect is the one ringed card — and only it.
  const on = cardsOf(await carousel({ effect: { kind: 'bokeh', intensity: 'subtle' }, locked: true }));
  assert.deepEqual(on.filter((c) => c.on).map((c) => c.key), ['bokeh']);
  assert.ok(on.find((c) => c.key === 'bokeh')!.html.includes('ring-sn-accent'), 'the picked card does not wear the accent ring');
  // ONE stylesheet for the whole strip; every card's layer is told not to draw its own.
  assert.equal((CARDS.match(/<AmbientEffectStyle \/>/g) ?? []).length, 1);
  assert.match(CARDS, /<AmbientEffectLayer\s+spec=\{ambientEffectSpec\(\{ kind, [\s\S]{0,120}\}, worn\.ground, worn\.five, true\)\}\s+className="absolute inset-0"\s+css=\{false\}/);
});

test('(3b) How much ▾ and Colour ▾ show only while an effect is on — each a dropdown that opens its choices', async () => {
  const off = await carousel({ effect: null, locked: false });
  assert.equal(off.includes('data-bg-row="effect-intensity"') || off.includes('data-bg-row="effect-colour"'), false, 'How much / Colour are offered with no effect on');
  assert.ok(off.includes('>Off<'), 'the Effects row does not say Off');
  const on = await carousel({ effect: { kind: 'lanterns', intensity: 'lavish', colour: 'supporting' }, locked: false });
  assert.ok(on.includes('>Lanterns<'));
  const row = (data: string) => on.slice(on.indexOf(`data-bg-row="${data}"`), on.indexOf('</div>', on.indexOf(`data-bg-row="${data}"`)));
  assert.match(row('effect-intensity'), /aria-haspopup="listbox"[^>]*data-studio-effect-intensity-pick/, 'How much is not the one dropdown');
  assert.ok(row('effect-intensity').includes('Lavish'), 'How much does not show the amount that is on');
  assert.match(row('effect-colour'), /aria-haspopup="listbox"[^>]*data-studio-effect-colour-pick/, 'Colour is not the one dropdown');
  assert.ok(row('effect-colour').includes('Supporting'), 'Colour does not name the palette colour that is on');
  // The choices: How much = the three; Colour = Original, then the five — and nothing typed by hand (no free picker).
  assert.match(CARDS, /options=\{HUB_MAIN_EFFECT_INTENSITIES\.map\(\(k\) => \(\{ key: k, label: AMBIENT_INTENSITY_LABEL\[k\] \}\)\)\}/);
  assert.match(CARDS, /\{ key: EFFECT_COLOUR_ORIGINAL, label: EFFECT_COLOUR_ORIGINAL_LABEL,[\s\S]{0,160}\},\s*\.\.\.HUB_MAIN_EFFECT_COLOURS\.map\(\(k, i\) => \(\{ key: k, label: AMBIENT_COLOUR_LABEL\[k\], icon: dot\(worn\?\.five\[i\]\) \}\)\),/);
  assert.doesNotMatch(CARDS, /type="color"|ColourPickerSheet|StudioColourField|<input/, 'a free colour picker is in the Effects rows');
  // While a Pro effect is tried: the note with its two answers, and the rows are about the tried one.
  const trying = await carousel({ effect: null, trying: { kind: 'shimmer', intensity: 'standard' }, locked: true });
  assert.ok(trying.includes('Gold shimmer is part of Pro') && trying.includes('>Not now<') && trying.includes('>See Pro<'));
  assert.deepEqual(cardsOf(trying).filter((c) => c.on).map((c) => c.key), [EFFECT_NONE], 'a TRIED effect is ringed as if it were applied');
  assert.ok(trying.includes('data-bg-row="effect-intensity"'));
});

/* ── (4) one pick, one write, no whole-Maker render ───────────────────── */

test('(4) an effect pick is the panel’s ONE pick path: one draft write, no whole-Maker render — the page redraws itself once, when next shown', () => {
  // Every Effects write is `pickLook(…, { fx: true })` — never a save of its own, never a refresh of its own.
  const block = PANEL.slice(PANEL.indexOf('<BgEffects'), PANEL.indexOf('/>', PANEL.indexOf('onTryEnd={endTry}')));
  assert.equal((block.match(/pickLook\(/g) ?? []).length, 3, 'take off · put on · change — three writes, each the one pick path');
  assert.equal((block.match(/pickLook\(\{ main: withEffect\(current, (?:null|next)\) \}, FAILED, \{ fx: true \}\)/g) ?? []).length, 3);
  assert.doesNotMatch(block, /router\.refresh|requestMakerRefresh|makerSave|saveMain|saveLookWrite/);
  assert.doesNotMatch(CARDS, /router|makerSave|hubDraftAction|fetch\(|useEffect|setInterval|setTimeout/, 'the Effects cards ask for something, or start a timer');
  // In `pickLook`: the write is carried, and an fx write is taken as it is.
  assert.match(PANEL, /const write: LookWrite = 'main' in asked && !opts\.fx \? \{ \.\.\.asked, main: keepEffect\(asked\.main \?\? null, ground\.main\) \} : asked;/);
  // A retry of an effect write stays an effect write (or taking one off would put it back).
  assert.match(PANEL, /retry\.current = \(\) => pickLook\(write, failure, \{ \.\.\.\(opts\.render \? \{ render: true \} : \{\}\), \.\.\.\(opts\.fx \? \{ fx: true \} : \{\}\) \}\);/);
  // The effect is the page's own drawing: its change asks the page to redraw — once, held while the sample is the screen.
  const g = (main: HubMainGround | null): LookGround => ({ main, bg: null, art: null });
  assert.equal(backgroundPickRedraws(g(VIDEO_PLAIN), g(withEffect(VIDEO_PLAIN, SPARKLES)), true), true, 'an effect put on asks for no redraw — Stages would show the page without it');
  assert.equal(backgroundPickRedraws(g(withEffect(VIDEO_PLAIN, SPARKLES)), g(VIDEO_PLAIN), true), true, 'taken off');
  assert.equal(backgroundPickRedraws(g(withEffect(VIDEO_PLAIN, SPARKLES)), g(withEffect(VIDEO_PLAIN, { ...SPARKLES, colour: 'accent' })), true), true, 'a colour change');
  // …and a pick that leaves the effect as it is asks for nothing more than it did.
  assert.equal(backgroundPickRedraws(g(withEffect(VIDEO_PLAIN, SPARKLES)), g(withEffect(stored({ ground: 'loop', loop: hubMovingBackgroundIds()[1] ?? LOOP }), SPARKLES)), true), false);
});
const VIDEO_PLAIN = stored({ ground: 'loop', loop: LOOP });

/* ── (5) the sample screen, and the cards as its miniatures ───────────── */

test('(5) the sample draws the effect through the one answer, over the background and under the words — and tells the cards what it measured', () => {
  assert.match(SAMPLE, /const effect = hubMainEffect\(main\);/, 'the sample reads the effect off something other than the stored background');
  assert.match(SAMPLE, /const effectOn = useMemo\(\(\) => lookEffectOn\(drawn, row, seed\.themeId, followsCover, \{ scope, ground \}\),/);
  assert.match(SAMPLE, /const fx = useMemo\(\(\) => lookSampleEffect\(effect, effectOn\),/);
  assert.match(SAMPLE, /\{fx \? <AmbientEffectLayer spec=\{fx\} className="absolute inset-0 -z-10" \/> : null\}/);
  // Under the words: the layer comes after the picture and the pattern, before the words' own box.
  const at = (needle: string) => SAMPLE.indexOf(needle);
  assert.ok(at('data-look-sample-picture') < at('<AmbientEffectLayer') && at('data-look-sample-pattern') < at('<AmbientEffectLayer') && at('<AmbientEffectLayer') < at('data-look-sample-eyebrow'));
  // Told from an effect, never while rendering.
  assert.match(SAMPLE, /useEffect\(\(\) => \{\s*tellLookSampleWorn\(seed\.eventId, \{ ground: effectOn\.ground, five: effectOn\.five, veil: wornVeil, names: seed\.words\.names \}\);\s*\}, \[/);
  // The cards read THAT — and draw nothing of an effect until it is known (never a guessed ground).
  assert.match(CARDS, /const worn = useSyncExternalStore\(\s*subscribeLookSampleWorn,\s*\(\) => readLookSampleWorn\(eventId\),\s*\(\) => null,\s*\);/);
  assert.match(CARDS, /\{worn \? \(\s*<AmbientEffectLayer/);
});

test('(5b) the store hands the cards the same object until what the sample measured changes', async () => {
  const { readLookSampleWorn, subscribeLookSampleWorn, tellLookSampleWorn } = await import('./look-sample-store');
  let heard = 0;
  const stop = subscribeLookSampleWorn(() => (heard += 1));
  const value = { ground: '#203040', five: ['#fff', '#aaa', '#bbb', '#ccc', '#ddd'], veil: null, names: 'Maria & Jose' };
  tellLookSampleWorn('EV-store', value);
  const first = readLookSampleWorn('EV-store');
  assert.deepEqual(first, value);
  tellLookSampleWorn('EV-store', { ...value, five: [...value.five] });
  assert.equal(readLookSampleWorn('EV-store'), first, 'the same measure made a new object — every card would redraw on every render');
  assert.equal(heard, 1, 'a measure that did not change was announced');
  tellLookSampleWorn('EV-store', { ...value, ground: '#F3EEE6' });
  assert.equal(heard, 2);
  assert.equal(readLookSampleWorn('another-event'), null, 'one event’s measure reached another’s cards');
  stop();
});
