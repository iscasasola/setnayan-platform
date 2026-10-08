/**
 * the-main-button-is-the-accent.test.ts — ON THE DASHBOARDS THE MAIN ACTION BUTTON IS THE APP'S ACCENT, A PILL.
 *
 * Owner, 2026-10-08 (`INTERACTION_RULES.md` § 9, its APPROVED block; the gallery
 * `prototypes/control_templates_2026-10-08.html` § 9): *"for all the design templates you gave me, i am now satisfied
 * on all of these"* — the main button is the terracotta with white words, a pill, on every Setnayan-look surface —
 * and *"if we change our color to blue, it will be easy to change the button colors"*.
 *
 * `.button-primary` is ONE class with three renderings: the dashboards' (`.app-surface …`), the public pages' (the
 * base rule) and the guests' (the couple's own colour). Only the FIRST changed. What this holds:
 *
 *   (1) THE MAIN BUTTON — its fill is `--sn-accent` and its words are `--sn-on-accent`: one declaration each, and
 *       nothing else in that rule. The pair itself (4.5:1 or better) is held by `the-accent-is-one-token` (2).
 *   (2) NO SECOND PAIR — no state of it puts the words on another fill (a hover lifts; it does not repaint).
 *   (3) THE SECOND BUTTON — white, a hairline, ink words; read from the tokens, the words clear 4.5:1.
 *   (4) ONE SHAPE, ONE "CANNOT BE USED YET" — both are the full pill; disabled or `aria-disabled` is grey and flat.
 *   (5) THE GUESTS' AND THE PUBLIC PAGES ARE NOT REACHED — every rule here needs the dashboards' root above the
 *       button; that root is set in the three dashboard layouts only; and inside the one guest-look island a
 *       dashboard holds (the Maker's Look sample) a rule either sets only what the island hands back, or is written
 *       `:not(.sn-editorial *)`.
 *   (6) THE CONTRAST LINT CAN READ IT — `rgb(var(--token))` is a form `lint-label-on-fill-contrast` resolves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const css = read('app/globals.css');

type Rule = { sels: string[]; body: string; at: number };
const RULES: Rule[] = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  sels: (m[1] ?? '').split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean),
  body: m[2] ?? '',
  at: (m.index ?? 0) + (m[1] ?? '').search(/\S/),
}));
const declsOf = (body: string): [string, string][] =>
  body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]);
/** The one rule whose selector list is exactly these. */
const only = (...selectors: string[]): Rule => {
  const hit = RULES.filter((r) => r.sels.length === selectors.length && selectors.every((s, i) => r.sels[i] === s));
  assert.equal(hit.length, 1, `“${selectors.join(', ')}” is declared ${hit.length} times`);
  return hit[0]!;
};
/** The rules that paint a dashboard's main or second button: they name the dashboards' root and the class. */
const DASH = RULES.filter((r) => r.sels.some((s) => /^\.app-surface\s/.test(s) && /\.button-(?:primary|secondary)\b/.test(s)));

/** The `@layer` a position in the stylesheet sits in (`null` = outside every layer). */
const layerOf = (at: number): string | null => {
  const open: string[] = [];
  let from = 0;
  for (let i = 0; i < at; i += 1) {
    if (css[i] === '{') {
      open.push(css.slice(from, i).trim());
      from = i + 1;
    } else if (css[i] === '}') {
      open.pop();
      from = i + 1;
    } else if (css[i] === ';') from = i + 1;
  }
  const layer = open.find((o) => o.startsWith('@layer '));
  return layer ? layer.slice('@layer '.length).trim() : null;
};

const ISLAND = ':not(.sn-editorial *)';
const BOTH = [`.app-surface .button-primary${ISLAND}`, `.app-surface .button-secondary${ISLAND}`] as const;
const PILL = [...BOTH];
/** Written out, one selector per state — the contrast lint excuses an inactive control only where the selector itself says so. */
const OFF = BOTH.flatMap((b) => [`${b}:disabled`, `${b}[aria-disabled='true']`]);

/* The `:root` tokens the second button and the grey state name, as the stylesheet declares them. */
const hexOf = (name: string): [number, number, number] => {
  const m = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})\\b`).exec(css);
  assert.ok(m, `${name} is not a hex in the stylesheet`);
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]: [number, number, number]) => {
  const c = (x: number) => (x / 255 <= 0.03928 ? x / 255 / 12.92 : ((x / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

test('(1) the dashboards’ main button: the fill is the accent and the words are the ink on it — one declaration each', () => {
  const main = only('.app-surface .button-primary');
  assert.deepEqual(
    declsOf(main.body),
    [
      ['background', 'rgb(var(--sn-accent))'],
      ['color', 'rgb(var(--sn-on-accent))'],
    ],
    'the main button’s rule is more (or other) than its fill and its ink — the accent is ONE setting',
  );
  assert.doesNotMatch(main.body, /gold|mulberry|#[0-9a-fA-F]{3,8}\b/, 'a colour is written by hand');
});

test('(2) no state of the main button puts its words on another fill — a hover lifts, it does not repaint', () => {
  const states = DASH.filter((r) => r.sels.some((s) => /\.button-primary\b/.test(s) && /:(?:hover|active|focus)/.test(s) && !/:disabled|aria-disabled/.test(s)));
  assert.ok(states.length >= 1, 'anti-vacuity: the main button has no hover rule');
  for (const r of states) {
    const props = declsOf(r.body).map(([p]) => p);
    assert.ok(!props.some((p) => /^(?:background|background-color|color)$/.test(p)), `${r.sels.join(', ')} repaints the main button — a second pair nobody measured`);
  }
  /* What the hover does say names the accent, never the gold it replaced. */
  const hover = only(`.app-surface .button-primary${ISLAND}:hover`);
  assert.match(hover.body, /transform: translateY\(-2px\);/);
  assert.match(hover.body, /box-shadow: 0 14px 26px -12px rgb\(var\(--sn-accent\) \/ 0\.6\);/);
  for (const r of DASH) assert.doesNotMatch(r.body, /--sn-gold-|--m-orange|mulberry/, `${r.sels.join(', ')} still names the gold (or writes the accent by another name)`);
});

test('(3) the second button: white, a hairline border, ink words — and the words read', () => {
  const second = only('.app-surface .button-secondary');
  assert.deepEqual(declsOf(second.body), [
    ['background', 'var(--sn-surface)'],
    ['color', 'var(--sn-ink-900)'],
    ['border-color', 'var(--sn-line)'],
    ['border-width', '1px'],
  ]);
  assert.deepEqual(hexOf('--sn-surface'), [255, 255, 255], 'the second button is not white');
  const ratio = contrast(hexOf('--sn-ink-900'), hexOf('--sn-surface'));
  assert.ok(ratio >= 4.5, `ink on the second button reads at ${ratio.toFixed(2)}:1`);
  /* Its hover keeps the fill and the words (the old one turned it into an ink button). */
  const hover = only(`.app-surface .button-secondary${ISLAND}:hover`);
  assert.deepEqual(declsOf(hover.body).map(([p]) => p), ['border-color', 'transform']);
});

test('(4) both are the full pill; “cannot be used yet” is grey and flat, for `disabled` and `aria-disabled` alike', () => {
  assert.deepEqual(declsOf(only(...PILL).body), [['border-radius', 'var(--m-r-full)']], 'the pill is not the radius token (or the rule says more)');
  const off = Object.fromEntries(declsOf(only(...OFF).body));
  assert.equal(off.background, 'var(--sn-hairline)');
  assert.equal(off.color, 'var(--sn-ink-300)');
  assert.equal(off['border-color'], 'var(--sn-line)');
  assert.equal(off.opacity, '1', 'the grey is faded again by the base rule’s 60% opacity');
  assert.equal(off.transform, 'none', 'a button that cannot be used still lifts');
  assert.equal(off['box-shadow'], 'none');
  /* Grey means grey: the fill is paler than the words on it are dark — never the accent, never ink. */
  assert.ok(lum(hexOf('--sn-hairline')) > 0.75 && contrast(hexOf('--sn-ink-300'), hexOf('--sn-hairline')) < 4.5, 'the “off” state reads like a live button');
  /* It outranks the hover rules (same weight, written after them) so nothing lifts or outlines when off. */
  const hovers = DASH.filter((r) => r.sels.some((s) => /:hover$/.test(s)));
  assert.ok(hovers.length >= 2 && hovers.every((r) => r.at < only(...OFF).at), 'the grey state is written before a hover rule — a disabled button would lift');
});

test('(5) guest pages and public pages are not reached — and the one guest-look island inside a dashboard is left alone', () => {
  assert.equal(DASH.length, 6, `the dashboards’ button rules are ${DASH.length}, not the six this guard reads`);
  /* (a) EVERY selector of every such rule starts at the dashboards' root: no dashboard root above, no match. */
  for (const r of DASH) for (const s of r.sels) assert.match(s, /^\.app-surface\s/, `“${s}” reaches a button outside the dashboards`);
  /* (b) …and that root is set by the three dashboards' layouts, nowhere else — never on a guest or a public page. */
  const walk = (rel: string): string[] =>
    readdirSync(join(WEB, rel)).flatMap((name) => {
      const child = `${rel}/${name}`;
      if (statSync(join(WEB, child)).isDirectory()) return name === 'node_modules' ? [] : walk(child);
      return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [child] : [];
    });
  /* The class as a word inside any string of code — a plain `className="…"` or one built in a condition. */
  const setsRoot = [...walk('app'), ...walk('components')].filter((f) => /["'`\s]app-surface["'`\s]/.test(read(f)));
  assert.deepEqual(setsRoot.sort(), ['app/admin/layout.tsx', 'app/dashboard/layout.tsx', 'app/vendor-dashboard/layout.tsx'], 'the dashboards’ root is set somewhere new — check it is not a guest or public page');
  /* (c) THE ISLAND. The Maker's Look sample is guest look drawn inside a dashboard. A rule either cannot match in
         it (`:not(.sn-editorial *)`), or sets ONLY properties the island's own rule hands back — which is written
         later, outside every layer, at the same weight, so it wins. */
  const handsBack = {
    primary: new Set(declsOf(only('[data-look-sample] .button-primary').body).map(([p]) => p)),
    secondary: new Set(declsOf(only('[data-look-sample] .button-secondary').body).map(([p]) => p)),
  };
  /* `border` (the shorthand) hands back the colour and the width with it. */
  if (handsBack.secondary.has('border')) for (const p of ['border-color', 'border-width', 'border-style']) handsBack.secondary.add(p);
  let reachIsland = 0;
  for (const r of DASH) {
    for (const s of r.sels) {
      if (s.includes(ISLAND)) continue;
      reachIsland += 1;
      const back = /\.button-primary\b/.test(s) ? handsBack.primary : handsBack.secondary;
      for (const [prop] of declsOf(r.body)) assert.ok(back.has(prop), `“${s}” sets ${prop} inside the Look sample and nothing hands it back — write it ${ISLAND}`);
      assert.doesNotMatch(s, /:(?:hover|active|focus|disabled)|\[aria-/, `“${s}” is a state rule that reaches the Look sample (it would outrank the island’s own rule)`);
    }
  }
  assert.equal(reachIsland, 2, 'only the two resting rules may reach the island');
  /* WHY THE ISLAND'S RULE WINS: Tailwind lifts everything inside `@layer components` up to `@tailwind components`
     (the top of the compiled sheet); a rule outside every layer stays where it is written, so it comes LATER —
     and at the same weight the later one wins. (Seen on the compiled sheet, 2026-10-08: the dashboards' rule at
     line 1775, the island's at 4972.) So: the dashboards' rules are in the components layer, the island's in none. */
  for (const cls of ['primary', 'secondary'] as const) {
    assert.equal(layerOf(only(`.app-surface .button-${cls}`).at), 'components', `the dashboards’ .button-${cls} left the components layer — it would outrank the island’s rule`);
    assert.equal(layerOf(only(`[data-look-sample] .button-${cls}`).at), null, `the island’s .button-${cls} rule is inside a layer — it would be lifted above the dashboards’ and lose`);
  }
  for (const r of DASH) assert.equal(layerOf(r.at), 'components', `“${r.sels[0]}” is outside the components layer`);
});

test('(6) the contrast lint reads a token held as three numbers — `rgb(var(--token))` is not skipped in silence', () => {
  const lint = read('scripts/lint-label-on-fill-contrast.mjs');
  const fn = lint.slice(lint.indexOf('function resolveColor(raw)'), lint.indexOf('function walkCss('));
  assert.ok(fn.length > 200, 'anti-vacuity: resolveColor was not found');
  assert.ok(fn.includes(String.raw`const rgbVar = v.match(/^rgb\(\s*var\(\s*--([a-z0-9-]+)\s*\)\s*\)$/i);`) && fn.includes('if (rgbVar) return cssVars.get(rgbVar[1]) ?? null;'), 'the lint no longer resolves rgb(var(--x)) — the main button’s pair would be skipped');
});
