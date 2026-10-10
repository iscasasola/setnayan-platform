/**
 * studio-logo-are-the-templates.test.ts — THE CHROME AROUND STUDIO › LOGO'S DRAWING SURFACE IS THE TEMPLATES' (2026-10-09;
 * `INTERACTION_RULES.md` § 9, approved gallery `prototypes/control_templates_2026-10-08.html`). RENDER the page's panels in their states
 * and read what is drawn, then read the source of what draws it.
 *
 * Controls → kind (the map):
 *   Play / Edit · Text · Image · Frame · Centre it · Show how it's written / Trace it again · Reverse it · Clear it · Cancel ·
 *   Its own · the layer's ▲ ▼                          → Action button (`ActionButton`)
 *   Remove this layer                                  → Action button (danger) + the centred confirm box
 *   Layers | the picked layer                          → Pill selector (`PillSelector`)
 *   Name · Words                                       → Form row (`TypedRow`)
 *   Typeface                                           → Dropdown (the stages' `FontPick`, in a Form row)
 *   Frame · Motion In · During · Out                   → Dropdown (`ChosenRow`)
 *   Remove white background                            → Switch (`SwitchRow`)
 *   Size · Across · Up and down · Rotate · Speed ·
 *   Starts after                                       → Counter & slider (the template's `Slider`)
 *   the help under "How it's written"                  → ⓘ (`Explain`)
 *   Colour (the Studio)                                → the ONE colour picker (`StudioColourField` → `ColourPickerSheet`)
 *   NOT a template control (and why):
 *     · the logo canvas, its drag, the trace stroke, the parts' numbers, Start / End — a drawing and a drag surface;
 *     · the layer rows (pick a layer) and the shipped inks' colour circles — a list row (no shared source yet) and swatches (kind 21);
 *     · the Image file input — read in the browser into a mark; nothing is uploaded;
 *     · the layer ▲ ▼ ordering is the Reorder kind's arrows — the house drag has no shared source yet.
 *
 * RULES (each sabotaged, SEEN RED, restored): (1) every button is a template's · (2) no typed field of the page's own, and every
 * range is the template's · (3) the typed answers are Form rows in one list · (4) a choice is the one dropdown, a switch the Form
 * row's · (5) no colour of the page's own on a control · (6) the layer comes off through the confirm box · (7) the first load.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { ...load.call(this, request, ...rest), useRouter: () => ({ refresh() {}, push() {}, replace() {}, prefetch() {}, back() {}, forward() {} }) };
    return load.call(this, request, ...rest);
  };
}
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const L = 'app/dashboard/[eventId]/launch/_components';
const LOGO = `${L}/maker-logo.tsx`;
async function html(el: React.ReactElement): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(el);
}
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M10 10H90V90H10Z" fill="#111111"/></svg>';
async function door(studio: boolean, source: 'mark' | 'names' = 'mark') {
  const { MakerLogoDoor } = await import(`../${LOGO}`);
  const { MakerContext } = await import(`../${L}/maker-context`);
  return html(
    React.createElement(
      MakerContext.Provider,
      { value: { stagesStudio: studio } as never },
      React.createElement(MakerLogoDoor as React.ComponentType<Record<string, unknown>>, {
        eventId: 'E1',
        opening: { source, layers: [], svg: source === 'mark' ? SVG : null, names: 'MJ', anim: null },
        motionMark: null,
        mainColours: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'],
      }),
    ),
  );
}
async function tools(kind: 'frame' | 'text' | 'image', over: Record<string, unknown> = {}, studio = true) {
  const { LayerTools } = await import(`../${LOGO}`);
  const { defaultMotion } = await import('./logo-layers');
  const { frameBody } = await import('./logo-layers-edit');
  const layer = {
    id: 'a1',
    kind,
    name: kind === 'frame' ? 'Ring' : kind === 'text' ? 'Text' : 'Mark',
    x: 500,
    y: 500,
    scale: 1,
    color: kind === 'image' ? null : '#5C2542',
    motion: defaultMotion(0),
    ...(kind === 'frame' ? { frame: 'ring', ...frameBody('ring') } : { body: '<path d=""/>', w: 10, h: 10 }),
    ...(kind === 'text' ? { text: 'MJ', font: 'cardo', italic: true } : {}),
    ...over,
  };
  return html(
    React.createElement(LayerTools as React.ComponentType<Record<string, unknown>>, { eventId: 'E1', layer, motionMark: null, studio: studio ? { five: ['#5B4A6B', '#D9C4CF', '#A9834B', '#F7F2EC', '#7A8B6F'] } : null, onWrite() {}, onChange() {}, onRemove() {} }),
  );
}
const STATES = async () => ({
  studioImage: await door(true),
  shippedImage: await door(false),
  studioText: await door(true, 'names'),
  toolsFrame: await tools('frame'),
  toolsText: await tools('text', { write: { w: 4, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } }),
  toolsImage: await tools('image'),
  toolsShipped: await tools('image', {}, false),
});
const tagsOf = (m: string, tag: string) => [...m.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((x) => x[0]);
const count = (m: string, re: RegExp) => (m.match(re) ?? []).length;

test('1 · every button is a template’s — the action button, the Form row’s pill and switch, the dropdown, the ⓘ, the pill selector — and the three named drawings', async () => {
  const s = await STATES();
  const ok = /class="ab |data-form-row-pill="|data-form-row-switch=|aria-haspopup="(?:dialog|listbox)"|data-explain=|data-seg=|data-logo-layer-row=|data-logo-ink=|data-studio-colour-field=/;
  for (const [state, markup] of Object.entries(s)) {
    assert.deepEqual(tagsOf(markup, 'button').filter((b) => !ok.test(b)), [], `${state}: a button that is not a template’s`);
  }
  assert.match(s.studioImage, /data-logo-play=""><button[^>]*class="ab ab-neutral/, 'Play is not the ActionButton');
  for (const k of ['text', 'image', 'frame']) assert.match(s.studioImage, new RegExp(`data-logo-add-kind="${k}"><button[^>]*class="ab `), `Add ${k} is not the ActionButton`);
  assert.match(s.toolsFrame, /<span class="lbl">Centre it<\/span>/);
  assert.match(s.toolsText, /<span class="lbl">Trace it again<\/span>/);
  assert.match(s.toolsText, /data-logo-write-reverse=""><button[^>]*class="ab /);
  assert.match(s.toolsFrame, /data-logo-remove=""><button[^>]*class="ab ab-danger/, 'Remove this layer is not the danger ActionButton');
  assert.equal(count(s.studioImage, /data-pill-selector="logo-panels"/g), 1, 'Layers | the layer is not the Pill selector');
  const src = read(LOGO);
  assert.doesNotMatch(src, /function IconBtn|function AddBtn|function Chip\b|function SwitchRow|<IconBtn|<AddBtn|<Chip\b/, 'a hand-made chrome control is back');
  assert.doesNotMatch(src, /role="tablist"|role="tab"/, 'the Layers | layer row is hand-made again');
  /* The only hand-made <button>s: the layer row (a list row), the shipped inks' circles. */
  assert.equal((src.match(/<button\b/g) ?? []).length, 2, 'a hand-made button beside the templates');
});

test('2 · nothing is typed in a field of the page’s own, and every slider is the template’s', async () => {
  const s = await STATES();
  for (const [state, markup] of Object.entries(s)) {
    assert.doesNotMatch(markup, /<textarea|<select/, `${state}: a bare textarea or select`);
    const inputs = tagsOf(markup, 'input').filter((i) => !/type="hidden"/.test(i) && !/aria-label="Upload an image layer"/.test(i));
    for (const i of inputs) assert.match(i, /type="range"[^>]*class="sn-slider /, `${state}: an input that is not the template’s slider: ${i.slice(0, 80)}`);
  }
  assert.equal(count(s.toolsFrame, /type="range"/g), 6, 'Size · Across · Up and down · Rotate · Speed · Starts after');
  assert.equal(count(s.toolsShipped, /type="range"/g), 5, 'the shipped editor has no Rotate');
  assert.equal(count(s.toolsFrame, /data-slider-centre=""/g), 3, 'the centre ticks of Across · Up and down · Rotate');
  const src = read(LOGO);
  assert.doesNotMatch(src, /<input\b[^>]*type="(?:text|range)"/, 'the page draws a field or a range of its own');
  assert.match(src, /import \{ Slider as TemplateSlider \} from '@\/app\/_components\/slider';/);
});

test('3 · the typed answers are Form rows in one list; a choice is the one dropdown; a switch is the Form row’s', async () => {
  const s = await STATES();
  assert.equal(count(s.toolsText, /data-form-row-pill="typed"/g), 2, 'Name and Words are not typed rows');
  assert.equal(count(s.toolsFrame, /data-form-row-pill="typed"/g), 1, 'a frame has a name and no words');
  assert.equal(count(s.toolsFrame, /data-form-rows="logo-layer"/g), 1);
  assert.match(s.toolsText, /data-logo-layer-name=""/);
  assert.match(s.toolsText, /data-logo-text-input=""/);
  assert.match(s.toolsText, /data-explain=""/, 'the help under “How it’s written” is not behind the ⓘ');
  assert.doesNotMatch(s.toolsText, /data-logo-write-help/, 'the helper sentence is back on the page');
  assert.match(s.toolsFrame, /data-form-row-kind="chosen"[^>]*data-logo-motion="in"|data-logo-motion="in"[^>]*data-form-row-kind="chosen"/, 'Motion In is not the dropdown row');
  assert.equal(count(s.toolsFrame, /data-logo-motion="(?:in|during|out)"/g), 3);
  assert.equal(count(s.toolsShipped, /data-logo-motion="(?:in|during|out)"/g), 2, 'the shipped editor has no Out');
  assert.match(s.toolsFrame, /data-logo-frame-pick=""/, 'the frame is not a dropdown');
  assert.doesNotMatch(s.toolsFrame, /aria-pressed="(?:true|false)"[^>]*>(?:Ring|Double ring|Diamond|Arch)</, 'the frame is a row of chips again');
  assert.match(s.toolsImage, /<button[^>]*role="switch"[^>]*data-form-row-switch=""/, 'Remove white background is not the Form row’s switch');
  const src = read(LOGO);
  assert.doesNotMatch(src, /<PickMenu\b/, 'the page draws a dropdown of its own');
  assert.equal((src.match(/<ChosenRow\b/g) ?? []).length, 4, 'Frame · In · During · Out');
  assert.equal((src.match(/<TypedRow\b/g) ?? []).length, 2);
});

test('4 · no colour of the page’s own on a control — the accent is the token', () => {
  const src = read(LOGO);
  const HAND = /\bbg-(?:terracotta|mulberry|gild|gold|success|emerald|green|red|amber)|\bbg-ink\b(?!\/)|\btext-(?:terracotta|mulberry|gild|cream)|\bborder-(?:terracotta|mulberry)|\bring-ink\b(?!\/)|accent-terracotta/;
  assert.doesNotMatch(src, HAND, 'the page writes a colour of its own on a control');
  assert.match(src, /bg-sn-accent text-sn-on-accent/, 'the picked layer is not the accent');
  assert.doesNotMatch(src, /<ActionButton[^>]*className="[^"]*\bbg-/, 'an action button is filled by hand');
});

test('5 · a layer comes off through the centred confirm box — keep first, the removal danger', async () => {
  const src = read(LOGO);
  assert.match(src, /<GuestPopup kind="confirm" onClose=\{onKeep\}/, 'a tap on the dark would not close it as keep');
  assert.match(src, /keep=\{<ActionButton tone="neutral" icon=\{X\} label="Keep" onClick=\{onKeep\} \/>\}/);
  assert.match(src, /<ActionButton tone="danger" main icon=\{Trash2\} label="Remove" onClick=\{onRemove\} \/>/);
  assert.match(src, /<ActionButton tone="danger" icon=\{Trash2\} label="Remove this layer" onClick=\{\(\) => setAskRemove\(true\)\} \/>/, 'the button removes without asking');
  assert.doesNotMatch(src, /label="Remove this layer" onClick=\{onRemove\}/);
});

test('6 · the drawing surface and its maths are as they were', () => {
  const src = read(LOGO);
  for (const re of [/onPointerDown=\{onDown\}/, /onPointerMove=\{onMove\}/, /onPointerUp=\{onUp\}/, /data-logo-canvas=""/, /snapInFrame\(l, p\.x \+ d\.dx, p\.y \+ d\.dy\)/, /evenlyThinned\(traced, LOGO_WRITE_MAX_PTS\)/, /snapSliderToCentre\(raw, min, max\)/]) {
    assert.match(src, re, `the drawing surface changed: ${re}`);
  }
});

test('7 · the first load: maker-logo and the templates it pulls in are lazy — none is imported by a first-load Maker file', () => {
  const lazy = readFileSync(join(WEB, `${L}/details-lazy.tsx`), 'utf8');
  assert.match(lazy, /import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/maker-logo'\)/, 'maker-logo is no longer lazy');
  const LAZY = /from '[^']*(?:\/maker-logo|logo-actions-context|\/form-row|toast\/peek-toast|\/explain|\/pill-selector|app\/_components\/slider|guest-popup)'/;
  for (const f of ['maker-details.tsx', 'maker-shell.tsx', 'details-workspace.tsx', 'maker-made-once.tsx', 'details-answers-parts.tsx']) {
    const src = read(`${L}/${f}`).replace(/^import type [^;]*;$/gm, '');
    assert.doesNotMatch(src, LAZY, `${f} imports a lazy Logo file or a template the first load must not carry`);
  }
});
