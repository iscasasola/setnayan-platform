/**
 * every-action-is-a-button.test.ts — THE BUTTON RULE (owner 2026-10-07,
 * corpus `BUTTON_RULE_2026-10-07_fable.md`): every action is a 40 px pill with
 * icon + word, words drop by width, one colour per meaning; every number
 * counts to its value; every meter grows to its value.
 *
 * Lives in `lib/` (not `tests/`) because `test:unit` globs `lib/**` and
 * `app/**` only — a file in `apps/web/tests/` would never run in CI.
 *
 * ── What this holds, as PROPERTIES ──────────────────────────────────────────
 *   T1  `ActionButton` RENDERED: every tone → its class, the word in `.lbl`,
 *       `aria-label` = the word, `main` filled, `href` an `<a>`; and `tone` is
 *       REQUIRED at the type level (the @ts-expect-error below is itself the
 *       check — tsc fails if a toneless call ever compiles).
 *   T2  the tone tokens EXIST in globals.css `:root` AND `html.dark`, and every
 *       light pairing the button draws is ≥ 4.5:1 — computed from the file,
 *       never re-typed.
 *   T3  `useFitRow`'s pass (`fitRow`) EXECUTED on a measured fake row: the
 *       right-most secondary drops first, the main verb never loses its word,
 *       a wide row drops nothing, a re-run restores what fits again.
 *   T4  `Count` / `Fill` / the shipped `CountUp` RENDERED: the final value,
 *       formatted (₱ grouped · integer grouped · %), on the server.
 *   T5  the source sweep over SWEPT_PATHS (the Maker, grown per sweep): no bare
 *       `<button`, no `›` inside a control's text, no raw red/emerald/amber
 *       utility on a control. The detector is run over fixtures first, so an
 *       empty scope cannot pass by catching nothing.
 *
 * SABOTAGE, each seen red before this shipped — see the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { APP_ROOT } from './security/shadowed-export-scan';

(globalThis as unknown as { React: unknown }).React = React;
const AB = require('../components/action-button') as typeof import('../components/action-button');
const C = require('../components/count') as typeof import('../components/count');
const { CountUp } = require('../app/_components/count-up') as typeof import('../app/_components/count-up');

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
    React.createElement(AB.ActionButton, { tone: 'primary', icon: Dot, label: 'Apply', main: true }),
  );
  assert.match(main, /class="ab ab-primary ab-main"/);
  const link = renderToStaticMarkup(
    React.createElement(AB.ActionButton, { tone: 'neutral', icon: Dot, label: 'Open', href: '/x' }),
  );
  assert.match(link, /^<a /, 'href renders a link-shaped button');
  assert.match(link, /href="\/x"/);
  assert.match(link, /class="ab ab-neutral"/);
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
  primary: '--color-mulberry',
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
    // outlined: the word on a 9% wash of the tone (primary's word is mulberry-700)
    const word = tone === 'primary' ? rgb(light, '--color-mulberry-700') : c;
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
  const main = fakeButton('ab ab-primary ab-main', 110);
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

/* ═══ T4 · COUNT / FILL / COUNTUP, RENDERED ════════════════════════════════ */

test('T4 · Count prints the final value, formatted, on the server', () => {
  const r = (props: Parameters<typeof C.Count>[0]) => renderToStaticMarkup(React.createElement(C.Count, props));
  assert.match(r({ value: 12500, format: 'peso', id: 't4-peso' }), />₱12,500</);
  assert.match(r({ value: 100050, id: 't4-int' }), />100,050</);
  assert.match(r({ value: 62, format: 'pct', id: 't4-pct' }), />62%</);
  assert.match(r({ value: 3, format: (n) => `${n} builds` }), />3 builds</);
  assert.match(r({ value: 1, id: 'k' }), /data-count="k"/);
});

test('T4 · the duration rule is 420–900 ms, longer for a bigger jump', () => {
  assert.equal(C.countDurationMs(0, 6), 420 + 6 * 0.002);
  assert.equal(C.countDurationMs(0, 5_000_000), 900);
  assert.ok(C.countDurationMs(0, 100_000) > C.countDurationMs(0, 10));
  assert.equal(C.easeOutCubic(1), 1);
  assert.ok(C.easeOutCubic(0.5) > 0.5, 'ease-OUT: past halfway at half time');
});

test('T4 · Fill renders the final width, clamped, with the shared slide class', () => {
  const html = renderToStaticMarkup(React.createElement(C.Fill, { value: 62, id: 'm' }));
  assert.match(html, /class="fill-bar"/);
  assert.match(html, /width:62%/);
  assert.match(renderToStaticMarkup(React.createElement(C.Fill, { value: 140 })), /width:100%/);
  assert.match(renderToStaticMarkup(React.createElement(C.Fill, { value: 50, axis: 'height' })), /height:50%/);
  assert.match(css, /\.fill-bar\s*\{\s*transition:\s*width 700ms/, '700 ms slide');
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.fill-bar \{ transition: none/, 'reduced motion jumps');
});

test('T4 · the shipped CountUp runs on the same engine and still prints grouped', () => {
  const src = fs.readFileSync(path.join(APP_ROOT, 'app', '_components', 'count-up.tsx'), 'utf8');
  assert.match(src, /useCountTo\(/, 'CountUp delegates to the one engine');
  assert.doesNotMatch(src, /requestAnimationFrame/, 'no second animation loop');
  assert.match(renderToStaticMarkup(React.createElement(CountUp, { value: 100050 })), /100,050/);
});

/* ═══ T5 · THE SOURCE SWEEP ════════════════════════════════════════════════ */

/**
 * The Maker files swept so far. GROWS with each sweep; never shrinks.
 * Phase 1 (this PR's first push) ships the components and the detector;
 * Phase 2 (after the Studio redraw merges) adds the Maker paths.
 */
const SWEPT_PATHS: string[] = [];

type Finding = { line: number; what: string; text: string };

/** Lines that hold an action control but do not go through ActionButton. */
function scanForBareActions(source: string): Finding[] {
  const out: Finding[] = [];
  const lines = source.split('\n');
  lines.forEach((text, i) => {
    const line = i + 1;
    if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // comments explain, they do not render
    if (/<button(\s|>|$)/.test(text)) out.push({ line, what: 'bare <button> (use ActionButton)', text });
    if (/<(a|button|Link)\b[^>]*>[^<]*›/.test(text) || /^[^<>]*›\s*<\/(a|button|Link)>/.test(text))
      out.push({ line, what: '› inside a control (a button is a pill, not a text link)', text });
    if (/className=["'{`][^"'`]*\b(text|bg|border)-(red|emerald|amber|green|rose)-\d{2,3}/.test(text))
      out.push({ line, what: 'raw red/emerald/amber utility (use a tone)', text });
  });
  return out;
}

test('T5 · the detector catches every bare shape and passes the rule-shaped ones (fixtures)', () => {
  const bad = [
    '<button onClick={go}>Add</button>',
    '<button\n',
    '<Link href="/x">See all ›</Link>',
    '<a href="/y" className="text-sm">More ›</a>',
    '<span className="text-red-600 font-medium">Delete</span>',
    '<div className="bg-emerald-50">',
  ];
  for (const b of bad) assert.ok(scanForBareActions(b).length > 0, `catches: ${b}`);
  const good = [
    '<ActionButton tone="primary" icon={Plus} label="Add a part" main onClick={add} />',
    "  // a comment may say <button> or 'text-red-600' and is not a control",
    '<ActionButton tone="neutral" icon={ChevronRight} label="See all" href="/x" />',
    '<span className="text-ink/60">Nothing yet</span>',
  ];
  for (const g of good) assert.deepEqual(scanForBareActions(g), [], `passes: ${g}`);
});

test('T5 · every swept Maker file has no bare action', () => {
  for (const rel of SWEPT_PATHS) {
    const abs = path.join(APP_ROOT, rel);
    assert.ok(fs.existsSync(abs), `swept path exists: ${rel} (a moved file must move here too)`);
    const findings = scanForBareActions(fs.readFileSync(abs, 'utf8'));
    assert.deepEqual(
      findings.map((f) => `${rel}:${f.line} ${f.what} — ${f.text.trim()}`),
      [],
    );
  }
});
