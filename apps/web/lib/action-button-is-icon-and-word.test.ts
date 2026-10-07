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
 *   T3  `useFitRow`'s pass (`fitRow`) EXECUTED on a measured fake row: the
 *       right-most secondary drops first, the main verb never loses its word,
 *       a wide row drops nothing, a re-run restores what fits again.
 *
 * SABOTAGE, each seen red before this shipped (PR body has the run):
 *   T1 drop `aria-label={label}` from the <button> branch
 *   T2 put the doc's warn #B26B00 (`178 107 0`) back — 4.20:1 on white
 *   T3 let the pass drop `.ab-main` too
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

/* ═══ T3 · THE FIT PASS, EXECUTED ══════════════════════════════════════════ */

type FakeBtn = {
  classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean };
  hasAttribute(a: string): boolean;
  setAttribute(a: string, v: string): void;
  removeAttribute(a: string): void;
  _cls: Set<string>;
  _attrs: Set<string>;
  _wide: number;
};

function fakeButton(cls: string, wide: number): FakeBtn {
  const _cls = new Set(cls.split(' '));
  const _attrs = new Set<string>();
  return {
    _cls,
    _attrs,
    _wide: wide,
    classList: { add: (c) => void _cls.add(c), remove: (c) => void _cls.delete(c), contains: (c) => _cls.has(c) },
    hasAttribute: (a) => _attrs.has(a),
    setAttribute: (a) => void _attrs.add(a),
    removeAttribute: (a) => void _attrs.delete(a),
  };
}

function fakeRow(width: number, buttons: FakeBtn[]) {
  const row = {
    clientWidth: width,
    get scrollWidth() {
      return buttons.reduce((s, b) => s + (b._cls.has('icon-only') ? 40 : b._wide) + 8, -8);
    },
    querySelectorAll: () => buttons,
  };
  return row as unknown as HTMLElement;
}

test('T3 · right-most secondary drops first; the main verb keeps its word', () => {
  const main = fakeButton('ab ab-brand ab-main', 110);
  const a = fakeButton('ab ab-info', 100);
  const b = fakeButton('ab ab-neutral', 100);
  const c = fakeButton('ab ab-danger', 100);
  const row = fakeRow(330, [main, a, b, c]); // 434 wide → drop two (314) to fit 330
  const dropped = AB.fitRow(row);
  assert.equal(dropped, 2, 'two words dropped');
  assert.ok(c._cls.has('icon-only') && b._cls.has('icon-only'), 'the right-most two went icon-only');
  assert.ok(!a._cls.has('icon-only'), 'the left secondary kept its word');
  assert.ok(!main._cls.has('icon-only'), 'the main verb never drops its word');

  // Even when nothing else is left to drop, main keeps its word.
  const tight = fakeRow(120, [main, a, b, c]);
  AB.fitRow(tight);
  assert.ok(!main._cls.has('icon-only'));
  assert.ok(a._cls.has('icon-only'));

  // Widen again: a re-run restores every word that fits.
  const wide = fakeRow(1280, [main, a, b, c]);
  assert.equal(AB.fitRow(wide), 0);
  for (const x of [a, b, c]) assert.ok(!x._cls.has('icon-only'), 'desktop shows every word');
});

test('T3 · a button rendered icon-only stays icon-only (the pass only undoes its own drops)', () => {
  const pinned = fakeButton('ab ab-neutral icon-only', 100);
  const row = fakeRow(1280, [fakeButton('ab ab-ok ab-main', 100), pinned]);
  AB.fitRow(row);
  assert.ok(pinned._cls.has('icon-only'));
});
