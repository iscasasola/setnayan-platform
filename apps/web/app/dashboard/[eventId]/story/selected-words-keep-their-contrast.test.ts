/**
 * SELECTED WORDS KEEP THEIR CONTRAST (ST-7).
 *
 * A host colours the words on their story page — ink · terracotta · blue · gold
 * (`WORD_COLORS`). Selecting a word used to lay `--act-soft` (the action colour
 * at 10%) behind it, and that wash darkened the ground under every one of them.
 * Ink and blue could afford it. Terracotta and gold could not: both sat just
 * above 4.5:1 on the page and dropped below it the moment the word was picked.
 * The highlight meant to SHOW you what you had chosen was the thing making it
 * harder to read.
 *
 * ── WHAT THIS GUARD CLAIMS, EXACTLY ───────────────────────────────────────────
 * Not that one CSS line is absent — that would pass the moment somebody moved
 * the wash to a different selector or spelled it a different way. It RESOLVES
 * the colours out of the shipped stylesheets, composites whatever background
 * the selected/hovered state actually declares over the surface underneath, and
 * asks the contrast. Any future rule that puts a wash back — at any opacity, in
 * any spelling — fails here with the colour and the number.
 *
 * 19px/400 serif words and a 12px/600 button label are both NORMAL text under
 * WCAG, so the bar is 4.5:1, not the 3:1 large-text bar.
 *
 * ⚠ THE ARITHMETIC IS NOT REIMPLEMENTED HERE. `contrastRatio` and
 * `compositeOver` come from `lib/story-light.ts`, the app's one copy — a second
 * copy is how two files start disagreeing about whether a page is readable.
 *
 * ⚠ AND THE GROUND IS READ, NOT ASSUMED. `--color-cream` is the token's NAME;
 * its value has been WHITE since 2026-08-20. Measuring against the cream it is
 * named for shifts every figure below, which is exactly how this row's first
 * set of numbers came out wrong.
 *
 * Sabotage-checked: putting `background: var(--act-soft)` back on `.obj.tx.sel`
 * fails here naming terracotta and gold; deleting the `color` from
 * `.mini:hover` fails here naming the button. Both restored, it passes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { contrastRatio, compositeOver, type Rgb } from '@/lib/story-light';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const css = stripComments(readFileSync(join(HERE, '_components', 'make-it-yours.module.css'), 'utf8'));
const tsx = stripComments(readFileSync(join(HERE, '_components', 'make-it-yours.tsx'), 'utf8'));
const globals = stripComments(readFileSync(join(WEB, 'app', 'globals.css'), 'utf8'));

/** A capture group that must have matched. `noUncheckedIndexedAccess` is on, and a
 *  silently-undefined group is exactly how a parser starts measuring the wrong thing. */
function group(m: RegExpExecArray | RegExpMatchArray, i: number, what: string): string {
  const v = m[i];
  assert.ok(v !== undefined, `\`${what}\` did not capture group ${i}`);
  return v;
}

/** AA for normal text. Both surfaces below are normal text — 19px/400 and 12px/600. */
const AA = 4.5;

/**
 * The light palette only. Dark mode is unreachable today (`darkMode: 'class'`
 * and the bootstrap in `layout.tsx` strips `.dark` before first paint), and
 * globals.css says so at the top of its dark block — so measuring it here would
 * be asserting against pixels no host can see.
 */
const lightBlock = globals.slice(0, globals.indexOf('--color-cream: 23 22 15'));

/** `--color-x: 194 78 37` → the triple. The app's palette tokens are space-separated channels. */
function paletteToken(name: string): Rgb {
  const m = new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`).exec(lightBlock);
  assert.ok(m, `palette token --${name} not found in the light block of globals.css`);
  return [Number(group(m, 1, name)), Number(group(m, 2, name)), Number(group(m, 3, name))];
}

/** The editor's own token block — `.root, .layer { … }` — is where `--act` and friends are set. */
const tokenBlock = (() => {
  const m = /\.root,\s*\.layer\s*\{([\s\S]*?)\}/.exec(css);
  assert.ok(m, 'the `.root, .layer` token block was not found in make-it-yours.module.css');
  return group(m, 1, '.root, .layer');
})();

/** One declaration block, by its exact selector. Returns null when the rule is absent entirely. */
function ruleBody(selector: string): string | null {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|})\\s*${esc}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  return m ? group(m, 1, selector) : null;
}

function declaration(body: string, prop: string): string | null {
  const m = new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+)`, 'm').exec(body);
  return m ? group(m, 1, prop).trim() : null;
}

/** An opaque colour: `#rrggbb`, `rgb(var(--palette-token))`, or another editor token. */
function opaque(value: string): Rgb {
  const v = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = group(hex, 1, 'hex colour');
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as unknown as Rgb;
  }
  const wrapped = /^rgb\(\s*var\(--([\w-]+)\)\s*\)$/.exec(v);
  if (wrapped) return paletteToken(group(wrapped, 1, 'rgb(var(--token))'));
  const token = /^var\(--([\w-]+)\)$/.exec(v);
  if (token) return opaque(editorToken(group(token, 1, 'var(--token)')));
  throw new Error(`cannot resolve an opaque colour from \`${v}\``);
}

function editorToken(name: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(tokenBlock);
  assert.ok(m, `editor token --${name} not found in the \`.root, .layer\` block`);
  return group(m, 1, `--${name}`).trim();
}

/** `rgba(r, g, b, a)` → the triple plus its alpha. This is how `--act-soft` is written. */
function translucent(value: string): { rgb: Rgb; alpha: number } {
  const m = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(value.trim());
  assert.ok(m, `expected an rgba() wash, got \`${value}\``);
  return {
    rgb: [Number(group(m, 1, 'rgba')), Number(group(m, 2, 'rgba')), Number(group(m, 3, 'rgba'))],
    alpha: Number(group(m, 4, 'rgba')),
  };
}

/**
 * Whatever a state's rule declares as its background, flattened onto the opaque
 * surface beneath it. No background declared → the surface itself.
 */
function groundUnder(stateBody: string | null, surface: Rgb): Rgb {
  const bg = stateBody && declaration(stateBody, 'background');
  if (!bg) return surface;
  const token = /^var\(--([\w-]+)\)$/.exec(bg);
  const raw = token ? editorToken(group(token, 1, 'background var(--token)')) : bg;
  if (/^rgba\(/.test(raw)) {
    const { rgb, alpha } = translucent(raw);
    return compositeOver(rgb, surface, alpha);
  }
  return opaque(raw);
}

const failures: string[] = [];
function check(what: string, ink: Rgb, ground: Rgb) {
  const r = contrastRatio(ink, ground);
  const line = `${what.padEnd(34)} ink ${ink.join(',')} on ${ground.join(',')} = ${r.toFixed(2)}:1`;
  console.log(`  ${r >= AA ? 'PASS' : 'FAIL'}  ${line}`);
  if (r < AA) failures.push(`${what} reads ${r.toFixed(2)}:1, below the ${AA}:1 AA bar for normal text`);
}

test('a selected word, and a hovered button, stay above 4.5:1', () => {
  const canvas = opaque(editorToken('paper')); // `.canvas` — the page the words sit on
  const box = opaque(editorToken('paper')); // `.box` — the panel `.mini` sits in

  /*
   * The four colours a host can actually choose, read out of `WORD_INK` in the
   * component rather than retyped here — so adding a fifth colour without
   * measuring it fails this guard instead of shipping.
   */
  const map = /const WORD_INK:[^=]*=\s*\{([\s\S]*?)\};/.exec(tsx);
  assert.ok(map, 'WORD_INK was not found in make-it-yours.tsx');
  const words = [...group(map, 1, 'WORD_INK').matchAll(/(\w+):\s*'var\(--([\w-]+)\)'/g)].map(
    (m) => ({ name: group(m, 1, 'WORD_INK entry'), ink: opaque(editorToken(group(m, 2, 'WORD_INK token'))) }),
  );
  assert.equal(words.length, 4, `expected the 4 shipped WORD_COLORS, parsed ${words.length}`);

  const selected = groundUnder(ruleBody('.obj.tx.sel'), canvas);
  for (const w of words) check(`selected word · ${w.name}`, w.ink, selected);

  const miniBody = ruleBody('.mini');
  const hoverBody = ruleBody('.mini:hover');
  assert.ok(miniBody, '`.mini` was not found');
  const hoverInk = opaque((hoverBody && declaration(hoverBody, 'color')) ?? declaration(miniBody, 'color')!);
  check('hovered button · .mini', hoverInk, groundUnder(hoverBody, box));

  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});
