/**
 * the-slider-is-one-drawing.test.ts — A SLIDER IS DRAWN ONCE.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, kind 17; the approved gallery § 17 "Counter and slider"): the line
 * fills terracotta up to the knob, the value changes as you drag, and — on the knob — *"animation press effect"*.
 *
 *   (1) THE DRAWING — `Slider` (`app/_components/slider.tsx`) rendered: the platform's own range, named, 44 px to the
 *       finger, the line filled exactly as far as the value is along it, what the value SAYS read out.
 *   (2) THE FILL IS MEASURED — `sliderFill` over real ranges (0–2 s, 20–100 %, seven notches), its ends and a range
 *       of no length.
 *   (3) THE LOOK IS THE ACCENT, AND THE KNOB ANSWERS A PRESS — read from the stylesheet's own rules: the line and the
 *       knob's ring are `--sn-accent`; HELD, the knob dips, fills with the accent and shows a ring; the speed is the
 *       family's (`--sn-pill-dur`), the spring the family's; nothing moves under "reduce motion"; no colour by hand.
 *       Swap the accent's one line to a blue: the fill, the ring and the held knob come out blue.
 *   (4) THE WATCH — in the Stages panel and the scene's Background row no range is drawn by hand, and the panel's
 *       old private range look is gone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { phoneHeightPx } from './maker-phone-room';
import { SLIDER_CLASS, SLIDER_VALUE, Slider, sliderFill } from '../app/_components/slider';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const CSS = read('app/globals.css');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';

/** The declarations of the one rule whose selector list is exactly `selectors`. */
const rule = (...selectors: string[]): string => {
  const hits = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => {
    const sels = (m[1] ?? '').split(',').map((s) => s.trim());
    return sels.length === selectors.length && selectors.every((s, i) => sels[i] === s);
  });
  assert.equal(hits.length, 1, `“${selectors.join(', ')}” is declared ${hits.length} times`);
  return (hits[0]![2] ?? '').replace(/\s+/g, ' ').trim();
};

test('(1) the drawing: the platform’s range, named, 44 px to the finger, filled as far as its value, saying what the value means', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(React.createElement(Slider, { label: 'Opacity', min: 20, max: 100, step: 5, value: 80, valueText: '80%', onChange: () => {}, data: 'scene-opacity' }));
  assert.match(html, /^<input type="range" min="20" max="100" step="5" aria-label="Opacity" aria-valuetext="80%" data-slider="scene-opacity" class="sn-slider h-11 w-full min-w-0 cursor-pointer " style="--sn-slider-fill:75%" value="80"\/>$/);
  assert.ok((phoneHeightPx(SLIDER_CLASS, 812) ?? 0) >= 44, 'the slider is under 44 px to the finger');
  assert.ok(SLIDER_CLASS.split(' ').includes('sn-slider'));
  assert.doesNotMatch(SLIDER_CLASS + SLIDER_VALUE, /(?:^|\s)(?:bg|border|accent|ring)-/, 'the drawing chooses a colour — the look is the stylesheet’s');
  assert.ok(SLIDER_VALUE.split(' ').includes('tabular-nums'), 'the figures beside it jump as they change');
  /* A caller may lay it out, never restyle it: its classes come after the template's. */
  assert.match(renderToStaticMarkup(React.createElement(Slider, { label: 'x', min: 0, max: 1, value: 0, onChange: () => {}, className: 'flex-1' })), /class="sn-slider h-11 w-full min-w-0 cursor-pointer flex-1"/);
  const src = read('app/_components/slider.tsx');
  assert.doesNotMatch(src, /useState|useEffect|'use client'|fetch\(/, 'the slider holds state, or cannot render on the server');
  assert.match(src, /onChange=\{\(e\) => onChange\(Number\(e\.target\.value\)\)\}/, 'the caller is not told the NUMBER the knob is at');
  /* A slider that saves when LET GO: told once, on finger-up or key-up — and only where the caller asked. */
  let commits = 0;
  const html2 = renderToStaticMarkup(React.createElement(Slider, { label: 'Speed', min: 0, max: 10, value: 4, onChange: () => {}, onCommit: () => (commits += 1) }));
  assert.match(html2, /^<input type="range"/);
  assert.equal(commits, 0, 'a slider commits while it is only being drawn');
  assert.match(src, /onPointerUp=\{onCommit \? \(e\) => onCommit\(Number\(e\.currentTarget\.value\)\) : undefined\}/);
  assert.match(src, /onKeyUp=\{onCommit \? \(e\) => onCommit\(Number\(e\.currentTarget\.value\)\) : undefined\}/);
});

test('(2) the fill is the value’s place along the line — measured over the ranges the panel draws', () => {
  /* Duration and Delay: 0–2 s. */
  assert.equal(sliderFill(0, 0, 2), 0);
  assert.equal(sliderFill(1.1, 0, 2), 55.00000000000001);
  assert.equal(sliderFill(2, 0, 2), 100);
  /* Opacity: 20–100 %. */
  assert.equal(sliderFill(20, 20, 100), 0);
  assert.equal(sliderFill(60, 20, 100), 50);
  /* Text size: seven notches, the middle one. */
  assert.equal(sliderFill(3, 0, 6), 50);
  /* Never outside the line, and a range of no length (one notch) sits in the middle. */
  assert.equal(sliderFill(-5, 0, 10), 0);
  assert.equal(sliderFill(50, 0, 10), 100);
  assert.equal(sliderFill(0, 0, 0), 50);
  assert.equal(sliderFill(Number.NaN, 0, 10), 50);
});

test('(3) the line and the knob’s ring are the accent; held, the knob dips, fills and rings — at the family’s speed, never under “reduce motion”', () => {
  const root = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('html.dark {'));
  const vars = Object.fromEntries([...root.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
  const follow = (value: string, v: Record<string, string>): string => value.replace(/var\((--[a-z0-9-]+)(?:,[^)]*)?\)/g, (all, n: string) => (n in v ? follow(v[n]!, v) : all));
  const blue = { ...vars, '--sn-accent': '37 99 235' };

  const track = rule('.sn-slider::-webkit-slider-runnable-track');
  assert.match(track, /background: linear-gradient\(90deg, rgb\(var\(--sn-accent\)\) var\(--sn-slider-fill, 50%\), rgb\(var\(--color-ink\) \/ 0\.16\) 0\);/, 'the line is not: the accent up to the knob, grey after it');
  const thumb = rule('.sn-slider::-webkit-slider-thumb');
  assert.match(thumb, /border: 2px solid rgb\(var\(--sn-accent\)\);/, 'the knob’s ring is not the accent');
  assert.match(thumb, /width: 26px; height: 26px;/);
  /* HELD: the dip, the fill, the ring — the press every control gives. */
  const held = rule('.sn-slider:active::-webkit-slider-thumb');
  assert.match(held, /transform: scale\(0\.9\);/, 'the held knob does not dip');
  assert.match(held, /background: rgb\(var\(--sn-accent\)\);/, 'the held knob does not fill with the accent');
  assert.match(held, /0 0 0 10px rgb\(var\(--sn-accent\) \/ 0\.18\)/, 'the held knob shows no ring');
  /* The speed is a share of the family's one speed, with the family's spring — never a number of its own. */
  assert.match(thumb, /transition: transform calc\(var\(--sn-pill-dur\) \* 0\.3\) var\(--sn-pill-spring\),/);
  assert.doesNotMatch(thumb, /\d+ms|\d+(?:\.\d+)?s[,; ]/, 'the knob has a speed of its own');
  /* Firefox draws the same three things. */
  assert.match(rule('.sn-slider::-moz-range-progress'), /background: rgb\(var\(--sn-accent\)\);/);
  assert.match(rule('.sn-slider::-moz-range-thumb'), /border: 2px solid rgb\(var\(--sn-accent\)\);/);
  assert.match(rule('.sn-slider:active::-moz-range-thumb'), /transform: scale\(0\.9\); background: rgb\(var\(--sn-accent\)\);/);
  /* Nothing moves under "reduce motion". */
  const still = /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-slider::-webkit-slider-thumb,\s*\.sn-slider::-moz-range-thumb \{\s*transition: none;\s*\}\s*\.sn-slider:active::-webkit-slider-thumb,\s*\.sn-slider:active::-moz-range-thumb \{\s*transform: none;\s*\}/.test(CSS);
  assert.ok(still, 'the knob still dips and springs under “reduce motion”');
  /* ONE LINE MAKES IT BLUE — and no rule of the slider writes the accent by hand. */
  for (const [what, decl] of [['the line', /background: (linear-gradient\([^;]+\));/.exec(track)![1]!], ['the ring', /border: 2px solid ([^;]+);/.exec(thumb)![1]!], ['the held knob', /background: ([^;]+);/.exec(held)![1]!]] as const) {
    assert.ok(follow(decl, vars).includes('rgb(194 78 37)'), `${what} is not the accent today`);
    assert.ok(follow(decl, blue).includes('rgb(37 99 235)'), `${what} does not follow the accent`);
  }
  const all = [...CSS.matchAll(/([^{}]*\.sn-slider[^{}]*)\{([^{}]*)\}/g)].map((m) => m[2]).join(' ');
  assert.ok(all.length > 800, 'anti-vacuity: the slider’s rules were not read');
  assert.doesNotMatch(all, /mulberry|terracotta|#[0-9a-fA-F]{3,8}\b|194[ ,]+78[ ,]+37/, 'a slider rule writes the accent by hand');
});

test('(4) the Stages panel and the scene’s Background row draw no range by hand — and the panel’s private range look is gone', () => {
  const FILES = [`${L}/stage-panel/stage-animate.tsx`, `${L}/stage-panel/stage-text.tsx`, `${L}/stage-panel/kit.tsx`, `${L}/stage-panel/stage-background.tsx`, `${E}/scene-background-row.tsx`, `${L}/stage-tools.tsx`, `${L}/maker-reveal.tsx`];
  let drawn = 0;
  for (const f of FILES) {
    const src = read(f);
    assert.doesNotMatch(src, /type=(?:"range"|'range'|\{['"]range['"]\})/, `${f} draws a range of its own — use <Slider> (app/_components/slider.tsx)`);
    assert.doesNotMatch(src, /sp-range|accent-ink|slider-thumb|range-thumb/, `${f} still carries a private range look`);
    drawn += (src.match(/<Slider\b/g) ?? []).length;
  }
  /* Text size · the Background's Opacity (the older editor's row, and the
     toolbar's row 3) and its Darker ↔ Lighter bar (🔁 2026-10-09: it was a dropdown of three words — owner: *"darker
     lighter line bar"*; and the toolbar's Opacity moved from the row's file into `stage-background.tsx`) · the
     Reveal's Fine-tune knobs (one row mapped over them). */
  /* 🔁 RE-AIMED 2026-10-09: Animate draws NO slider now. Duration is gone from the toolbar (owner: *"build in no
     duration"*) and Delay — three shipped steps — is a dropdown beside Movement, since a row of its own does not
     exist in the four (`animate-is-four-rows.test.ts`). 6 → 5. */
  assert.equal(drawn, 5, 'a slider the panel drew is gone, or a new one is not counted here');
  assert.equal((read(`${L}/stage-panel/stage-background.tsx`).match(/<Slider\b/g) ?? []).length, 2, 'the Background’s Opacity or its Darker ↔ Lighter bar is not the app’s slider');
  assert.equal((read(`${L}/stage-panel/stage-animate.tsx`).match(/<Slider\b|<TimeRow\b/g) ?? []).length, 0, 'Animate draws a slider again — it has no row for one');
  assert.match(read(`${L}/stage-panel/stage-animate.tsx`), /small="Delay"[\s\S]{0,300}options=\{delay\.steps\.map\(\(s\) => \(\{ key: String\(s\), label: seconds\(s\) \}\)\)\}/, 'Delay does not offer the shipped steps');
  /* Each says what its value means, beside it and to a screen reader. */
  assert.match(read(`${L}/stage-panel/stage-text.tsx`), /valueText=\{`\$\{pct\}%`\}[\s\S]{0,400}<span className=\{`\$\{SLIDER_VALUE\} w-\[44px\]`\}>\{pct\}%<\/span>/);
  /* (🔁 2026-10-09: the toolbar's Opacity is drawn by `stage-background.tsx` from the row's own value — one in each file.) */
  assert.equal((read(`${E}/scene-background-row.tsx`).match(/valueText=\{`\$\{opacity\}%`\}/g) ?? []).length, 1);
  assert.match(read(`${L}/stage-panel/stage-background.tsx`), /valueText=\{`\$\{opacity\.value\}%`\}[\s\S]{0,200}<span className=\{`\$\{SLIDER_VALUE\} w-10`\}>\{opacity\.value\}%<\/span>/);
  /* The watch can see one. */
  assert.match('<input type="range" className="sp-range" />', /type=(?:"range"|'range'|\{['"]range['"]\})/);
});

test('(5) from the centre — an additive prop: left out, the slider is byte-identical; given, the accent runs from the middle to the knob', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const base = { label: 'Darker or lighter', min: -100, max: 100, value: -67, onChange: () => {} };
  const plain = renderToStaticMarkup(React.createElement(Slider, base));
  const centre = renderToStaticMarkup(React.createElement(Slider, { ...base, from: 'centre' as const }));
  /* Left out: no attribute, no other style — every slider drawn before this prop is the same bytes. */
  assert.doesNotMatch(plain, /data-slider-from/);
  assert.equal(centre.replace(' data-slider-from="centre"', ''), plain, 'the prop changes more than its one attribute');
  assert.match(centre, /data-slider="" data-slider-from="centre"/);
  /* The look is the stylesheet's, from the SAME one measure (`--sn-slider-fill`): grey up to the nearer of the middle
     and the knob, the accent between them, grey after the further one. At rest (50 %) nothing is filled. */
  const GREY = 'rgb(var(--color-ink) / 0.16)';
  const ACC = 'rgb(var(--sn-accent))';
  const NEAR = 'min(50%, var(--sn-slider-fill, 50%))';
  const FAR = 'max(50%, var(--sn-slider-fill, 50%))';
  const line = `background: linear-gradient(90deg, ${GREY} ${NEAR}, ${ACC} ${NEAR}, ${ACC} ${FAR}, ${GREY} ${FAR});`;
  assert.equal(rule(".sn-slider[data-slider-from='centre']::-webkit-slider-runnable-track"), line, 'the line is not filled from the centre');
  assert.equal(rule(".sn-slider[data-slider-from='centre']::-moz-range-track"), line);
  assert.equal(rule(".sn-slider[data-slider-from='centre']::-moz-range-progress"), 'background: none;', 'Firefox still fills from the left end under it');
  /* The knob always covers the fill's end: the two differ by |13 − 26·f| px (a 26-px knob), never more than its radius. */
  for (let f = 0; f <= 1.0001; f += 0.05) assert.ok(Math.abs(13 - 26 * f) <= 13 + 1e-9);
  /* WHO USES IT: the Background's Darker ↔ Lighter bar — a value that rests in the middle. Its Opacity (a plain
     "more") and every other slider fill from the left end as they did. */
  const bg = read(`${L}/stage-panel/stage-background.tsx`);
  const sliders = [...bg.matchAll(/<Slider\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(sliders.length, 2);
  assert.deepEqual(sliders.map((x) => [/data="([\w-]+)"/.exec(x)?.[1], /\bfrom="centre"/.test(x)]), [['scene-shade', true], ['scene-opacity', false]]); /* (2026-10-09: the shade bar is written once, above the rows it is placed on — so it comes first in the file; still the only one from the centre.) */
  for (const f of [`${L}/stage-panel/stage-text.tsx`, `${L}/stage-panel/stage-look-row.tsx`, `${L}/maker-reveal.tsx`, `${E}/scene-background-row.tsx`]) assert.doesNotMatch(read(f), /\bfrom="centre"/, `${f} fills from the centre`);
});
