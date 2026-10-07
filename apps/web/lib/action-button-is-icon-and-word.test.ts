/**
 * action-button-is-icon-and-word.test.ts — RULES 1, 3 AND 4 of the button rule
 * (owner 2026-10-07, corpus `BUTTON_RULE_2026-10-07_fable.md`; the Suppliers
 * plan's "PR0 · Foundation" guard, built once and shared).
 *
 *   T1  `ActionButton` RENDERED: every tone draws an svg AND the word in
 *       `.lbl`, `aria-label` = the word, `main` filled, `quiet` muted, `href`
 *       an `<a>`; `icon-only` hides the word in CSS but keeps `aria-label`;
 *       and `tone` is REQUIRED at the type level (the @ts-expect-error below is
 *       itself the check — tsc fails if a toneless call ever compiles).
 *   T2  the tone tokens EXIST in globals.css `:root` AND `html.dark`, and every
 *       light pairing the button draws is ≥ 4.5:1 — computed from the file,
 *       never re-typed.
 *   T3  `useFitRow`'s pass (`fitRow`) EXECUTED on a measured fake row: a wide
 *       row shows every word; 3a — the row changes state AS ONE (icon + word →
 *       word only → icon only), never a mix of secondaries, the main verb keeps
 *       its word; 3b — a text field keeps ≥ 60% of the row, the buttons give.
 *
 * SABOTAGE, each seen red before this shipped (PR body has the run):
 *   T1 drop `aria-label={label}` from the <button> branch
 *   T2 put the doc's warn #B26B00 (`178 107 0`) back — 4.20:1 on white
 *   T3 let the pass drop `.ab-main` too
 *   T3a restore the one-at-a-time drop (a mixed row)
 *   T3b drop the 60% field check
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_ROOT } from './security/shadowed-export-scan';

// The component files use the automatic JSX runtime; under tsx they need `React` in scope.
(globalThis as unknown as { React: unknown }).React = React;
const AB = require('../components/action-button') as typeof import('../components/action-button');

const Dot = (p: React.SVGProps<SVGSVGElement>) => React.createElement('svg', { ...p, 'data-icon': 'dot' });

/* ═══ T1 · ACTIONBUTTON, RENDERED ══════════════════════════════════════════ */

test('T1 · every tone renders its class, the word, and the word as aria-label', () => {
  for (const tone of AB.ACTION_TONES) {
    const html = renderToStaticMarkup(
      React.createElement(AB.ActionButton, { tone, icon: Dot, label: 'Add a part' }),
    );
    assert.match(html, /^<button /, `${tone}: a <button>`);
    assert.match(html, /type="button"/, `${tone}: never an accidental submit`);
    assert.match(html, new RegExp(`class="ab ab-${tone}"`), `${tone}: class`);
    assert.match(html, /aria-label="Add a part"/, `${tone}: aria-label is the word`);
    assert.match(html, /<span class="lbl">Add a part<\/span>/, `${tone}: the word is drawn`);
    assert.match(html, /data-icon="dot"/, `${tone}: the icon is drawn`);
  }
  const main = renderToStaticMarkup(
    React.createElement(AB.ActionButton, { tone: 'brand', icon: Dot, label: 'Apply', main: true }),
  );
  assert.match(main, /class="ab ab-brand ab-main"/);
  const link = renderToStaticMarkup(
    React.createElement(AB.ActionButton, { tone: 'neutral', icon: Dot, label: 'Open', href: '/x' }),
  );
  assert.match(link, /^<a /, 'href renders a link-shaped button');
  assert.match(link, /href="\/x"/);
  assert.match(link, /class="ab ab-neutral"/);
});

test('T1 · icon-only hides the word but keeps aria-label; quiet is muted, never on main', () => {
  const html = renderToStaticMarkup(
    React.createElement(AB.ActionButton, { tone: 'danger', icon: Dot, label: 'Remove', iconOnly: true }),
  );
  assert.match(html, /class="ab ab-danger icon-only"/);
  assert.match(html, /aria-label="Remove"/, 'the word is still read');
  assert.match(html, /<span class="lbl">Remove<\/span>/, 'the word stays in the DOM; CSS hides it');
  assert.match(css, /\.ab\.icon-only \.lbl \{ display: none; \}/, 'icon-only hides .lbl');
  const quiet = renderToStaticMarkup(
    React.createElement(AB.ActionButton, { tone: 'neutral', icon: Dot, label: 'Not now', quiet: true }),
  );
  assert.match(quiet, /class="ab ab-neutral quiet"/);
  assert.equal(AB.actionButtonClass('brand', { main: true, quiet: true }), 'ab ab-brand ab-main', 'quiet never mutes the main verb');
  assert.match(css, /\.ab \{[^}]*height: 40px;/, '40 px pill');
  assert.match(css, /background: color-mix\(in srgb, rgb\(var\(--ab-tone\)\) 9%, transparent\)/, '9% tint via color-mix');
});

test('T1 · tone is required — a toneless ActionButton does not type-check', () => {
  const make = () =>
    // @ts-expect-error — `tone` is REQUIRED (the rule: a builder cannot leave the colour blank)
    React.createElement(AB.ActionButton, { icon: Dot, label: 'No colour' });
  assert.equal(typeof make, 'function');
});

/* ═══ T2 · TOKENS, MEASURED FROM globals.css ═══════════════════════════════ */

const css = fs.readFileSync(path.join(APP_ROOT, 'app', 'globals.css'), 'utf8');

function block(selectorStart: string): string {
  const i = css.indexOf(selectorStart);
  assert.ok(i >= 0, `globals.css has ${selectorStart}`);
  const open = css.indexOf('{', i);
  let depth = 0;
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++;
    else if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j);
  }
  throw new Error(`unclosed ${selectorStart}`);
}

function tokens(body: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, k, v] of body.matchAll(/(--color-[a-z0-9-]+)\s*:\s*([^;]+);/g)) m.set(k!, v!.trim());
  return m;
}

function rgb(map: Map<string, string>, name: string, seen = 0): [number, number, number] {
  const v = map.get(name);
  assert.ok(v, `${name} is defined`);
  const alias = v!.match(/^var\((--color-[a-z0-9-]+)\)$/);
  if (alias) {
    assert.ok(seen < 4, 'alias loop');
    return rgb(map, alias[1]!, seen + 1);
  }
  const parts = v!.split(/\s+/).map(Number);
  assert.equal(parts.length, 3, `${name} is an RGB triple, got "${v}"`);
  return parts as [number, number, number];
}

const lum = ([r, g, b]: number[]) =>
  [r, g, b]
    .map((c) => c! / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i]!, 0);
const ratio = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const wash = (tone: number[], page: number[], p = 0.09) => tone.map((c, i) => c * p + page[i]! * (1 - p));

const TONE_TOKEN = {
  brand: '--color-mulberry',
  ok: '--color-ok',
  info: '--color-info',
  warn: '--color-warn',
  danger: '--color-danger',
  neutral: '--color-ink',
} as const;

test('T2 · the four new tones exist in :root and html.dark', () => {
  const light = tokens(block(':root {\n    /*\n     * Light mode'));
  const dark = tokens(block('html.dark {\n    /*\n     * Dark mode'));
  for (const t of ['--color-ok', '--color-info', '--color-warn', '--color-danger']) {
    rgb(light, t);
    rgb(dark, t);
  }
  assert.equal(light.get('--color-info'), 'var(--color-link)', 'info REUSES the link slate (owner call, decided in the token comment)');
});

test('T2 · every light pairing the button draws clears AA 4.5:1', () => {
  const light = tokens(block(':root {\n    /*\n     * Light mode'));
  const page = rgb(light, '--color-cream');
  const white = [255, 255, 255];
  for (const [tone, tok] of Object.entries(TONE_TOKEN)) {
    const c = rgb(light, tok);
    // filled main verb: white word on the tone
    assert.ok(ratio(white, c) >= 4.5, `${tone} filled: white on ${tok} = ${ratio(white, c).toFixed(2)}`);
    // outlined: the word on a 9% wash of the tone (brand's word is mulberry-700)
    const word = tone === 'brand' ? rgb(light, '--color-mulberry-700') : c;
    const r = ratio(word, wash(c, page));
    assert.ok(r >= 4.5, `${tone} outlined: word on 9% wash = ${r.toFixed(2)}`);
  }
});

/* ═══ T3 · THE FIT PASS, EXECUTED (rules 3 · 3a · 3b) ═════════════════════ */

/** A measured fake: each button knows its width in each state; the row sums them. */
type Widths = { full: number; word: number; icon: number };

function el(cls: string, w: Widths) {
  const c = new Set(cls.split(' '));
  const attrs = new Set<string>();
  return {
    _c: c,
    _w: w,
    classList: {
      add: (...x: string[]) => x.forEach((v) => c.add(v)),
      remove: (...x: string[]) => x.forEach((v) => c.delete(v)),
      contains: (v: string) => c.has(v),
    },
    hasAttribute: (a: string) => attrs.has(a),
    setAttribute: (a: string) => void attrs.add(a),
    removeAttribute: (a: string) => void attrs.delete(a),
    get width() {
      return c.has('icon-only') ? w.icon : c.has('word-only') ? w.word : w.full;
    },
  };
}
type Btn = ReturnType<typeof el>;
const btn = (cls: string, full = 110) => el(`ab ${cls}`, { full, word: full - 26, icon: 40 });

/** A flex row: buttons take their width, a field (flex:1, min-width 60%) takes the rest. */
function row(width: number, buttons: Btn[], field = false) {
  const gaps = 8 * (buttons.length - (field ? 0 : 1));
  const used = () => buttons.reduce((s, b) => s + b.width, 0) + gaps;
  const fieldW = () => Math.max(width - used(), FIELD_MIN * width);
  const r = {
    clientWidth: width,
    attrs: new Map<string, string>(),
    get scrollWidth() {
      return Math.max(width, used() + (field ? fieldW() : 0));
    },
    querySelectorAll: () => buttons,
    querySelector: () => (field ? { get offsetWidth() { return fieldW(); } } : null),
    setAttribute(k: string, v: string) {
      this.attrs.set(k, v);
    },
  };
  return r;
}
const FIELD_MIN = 0; // the fake field can shrink to nothing — the pass alone must hold 60%

/** 3a — every SECONDARY button is in the same state. */
function secondaryStates(buttons: Btn[]) {
  return new Set(
    buttons
      .filter((b) => !b._c.has('ab-main'))
      .map((b) => (b._c.has('icon-only') ? 'icon' : b._c.has('word-only') ? 'word' : 'full')),
  );
}

test('T3 · a wide row shows every icon AND word (desktop shows every word)', () => {
  const bs = [btn('ab-brand ab-main'), btn('ab-info'), btn('ab-neutral')];
  const r = row(1280, bs);
  assert.equal(AB.fitRow(r as unknown as HTMLElement), 'full');
  assert.equal(r.attrs.get('data-fit'), 'full');
  for (const b of bs) assert.ok(!b._c.has('icon-only') && !b._c.has('word-only'));
});

test('T3a · the row changes state AS ONE: icon+word → word only → icon only, never a mix', () => {
  // 3 × 110 + 16 = 346 full · 3 × 84 + 16 = 268 word · 84 + 40 + 40 + 16 = 180 icon
  for (const [width, expect] of [
    [360, 'full'],
    [300, 'word'],
    [200, 'icon'],
    [120, 'icon'], // nothing narrower exists; still one state
  ] as const) {
    const bs = [btn('ab-brand ab-main'), btn('ab-info'), btn('ab-danger')];
    const got = AB.fitRow(row(width, bs) as unknown as HTMLElement);
    assert.equal(got, expect, `${width}px → ${expect}`);
    assert.equal(secondaryStates(bs).size, 1, `${width}px: secondaries never mixed (${[...secondaryStates(bs)]})`);
    const main = bs[0]!;
    assert.ok(!main._c.has('icon-only'), `${width}px: the main verb keeps its word`);
    if (expect === 'word') for (const b of bs) assert.ok(b._c.has('word-only'), 'word state: every button word only');
    if (expect === 'icon') {
      for (const b of bs.slice(1)) assert.ok(b._c.has('icon-only'), 'icon state: every secondary icon only');
      assert.ok(main._c.has('word-only'), 'icon state: the main shows its word');
    }
  }
});

test('T3a · re-running after a widen restores every word (state is recomputed, not sticky)', () => {
  const bs = [btn('ab-ok ab-main'), btn('ab-info'), btn('ab-neutral')];
  AB.fitRow(row(150, bs) as unknown as HTMLElement);
  assert.equal(AB.fitRow(row(1280, bs) as unknown as HTMLElement), 'full');
  for (const b of bs) assert.ok(!b._c.has('icon-only') && !b._c.has('word-only'));
});

test('T3b · a text field keeps ≥ 60% of the row; the buttons go to icons first', () => {
  // 375 row with a search field + 3 secondaries: full buttons (330+24) leave the field 21 px.
  const bs = [btn('ab-brand'), btn('ab-info'), btn('ab-neutral')];
  const r = row(375, bs, true);
  const got = AB.fitRow(r as unknown as HTMLElement);
  const field = r.querySelector()!;
  assert.ok(field.offsetWidth >= AB.FIELD_FLOOR * 375 - 1, `field ${field.offsetWidth}px ≥ 60% of 375`);
  assert.equal(got, 'icon', 'only icon-only buttons leave the field its 60%');
  assert.equal(secondaryStates(bs).size, 1);
  // The same row on desktop: field already has its share with every word showing.
  const wide = [btn('ab-brand'), btn('ab-info'), btn('ab-neutral')];
  assert.equal(AB.fitRow(row(1280, wide, true) as unknown as HTMLElement), 'full');
  assert.equal(AB.FIELD_FLOOR, 0.6);
});

test('T3 · a button rendered icon-only is a deliberate toolbar icon and stays icon-only', () => {
  const pinned = btn('ab-neutral icon-only');
  AB.fitRow(row(1280, [btn('ab-ok ab-main'), pinned]) as unknown as HTMLElement);
  assert.ok(pinned._c.has('icon-only'));
});
