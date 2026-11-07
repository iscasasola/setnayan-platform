/**
 * category-colours-are-tokens.test.ts — 🎨 THE FOUR CATEGORY COLOURS ARE TOKENS (THE ONE BUILD F1 / guard G6, 8 Nov 2026).
 *
 * Owner, THE ONE BUILD item 13 ("four category colours as tokens"): Booked · Schedules · Asked · To collect, light and
 * dark, read through `--sn-cat-*` (Tailwind `cat-*`) — never a raw hex in a component, so a later change is one line.
 * Values: the approved prototype supplier-menu-r2.v113 (`--c-ev/--c-sch/--c-ask/--c-col`, light and `html.dark`).
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-08): `#C9471A` written raw into a supplier .tsx; the dark
 * `--sn-cat-collect` deleted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB = join(__dirname, '..');
const CSS = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
const TW = readFileSync(join(WEB, 'tailwind.config.ts'), 'utf8');

const hexToTriple = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');

const RULED = {
  booked: { light: '#166B4A', dark: '#4FBF8A' },
  schedule: { light: '#2F6DB5', dark: '#7FAFE8' },
  asked: { light: '#C9471A', dark: '#F0825A' },
  collect: { light: '#A2457E', dark: '#D98AC0' },
} as const;

/** The body of the FIRST `:root {` block and of the first `html.dark {` block after it (the token blocks). */
function block(sel: string): string {
  const at = CSS.indexOf(`${sel} {`);
  assert.ok(at >= 0, `no ${sel} block`);
  let depth = 0;
  for (let i = CSS.indexOf('{', at); i < CSS.length; i++) {
    if (CSS[i] === '{') depth++;
    else if (CSS[i] === '}' && --depth === 0) return CSS.slice(at, i);
  }
  return '';
}

test('each category colour is a token with the ruled light and dark value', () => {
  const root = block(':root');
  const dark = block('  html.dark');
  for (const [k, v] of Object.entries(RULED)) {
    assert.match(root, new RegExp(`--sn-cat-${k}: ${hexToTriple(v.light)};`), `light --sn-cat-${k} is not ${v.light}`);
    assert.match(dark, new RegExp(`--sn-cat-${k}: ${hexToTriple(v.dark)};`), `dark --sn-cat-${k} is not ${v.dark}`);
    assert.match(TW, new RegExp(`${k}: 'rgb\\(var\\(--sn-cat-${k}\\) / <alpha-value>\\)'`), `Tailwind cat-${k} does not read the token`);
  }
});

test('no component writes a category colour as a raw hex', () => {
  const hexes = Object.values(RULED).flatMap((v) => [v.light, v.dark]);
  const re = new RegExp(`#(${hexes.map((h) => h.slice(1)).join('|')})\\b`, 'i');
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && re.test(readFileSync(p, 'utf8'))) hits.push(relative(WEB, p));
    }
  };
  for (const d of ['app', 'components', 'lib']) walk(join(WEB, d));
  assert.deepEqual(hits, [], `a raw category hex — use text-cat-* / bg-cat-* or var(--sn-cat-*):\n${hits.join('\n')}`);
});
