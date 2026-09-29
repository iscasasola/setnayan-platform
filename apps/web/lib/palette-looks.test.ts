/**
 * THE FIVE PALETTE LOOKS — the stored key, the one resolver, the entrance's
 * rules, and where the Maker's picker is allowed to load.
 *
 * Owner 2026-09-29, DECISION_LOG "APPROVED — FIVE PALETTE STYLES, PICKED ON THE
 * TOOLBAR". What each block holds, and why it is a property rather than a
 * phrase:
 *   · absent → Tags: the resolver, the canvas sanitiser and the row reader agree
 *     that no pick, a malformed pick and an unknown id all mean today's look;
 *   · a palette pick is FREE and frames nothing (no Pro look key, no motion
 *     frame around the scene);
 *   · the ink on a colour is chosen by CONTRAST (Gold #B8934A takes the dark);
 *   · every palette entrance binds only on `.pahina-js` + `.pahina-in` (so
 *     reduced motion — RootFlag never sets the flag — and a missing script both
 *     leave the colours in place), a reduced-motion block stops them outright,
 *     and the slowest one ends inside the design's 1.2 s;
 *   · the Maker's Palette picker is ONE PickMenu with the five looks, and it is
 *     reachable only through the lazy `maker-details` chunk.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import {
  PALETTE_LOOKS,
  PALETTE_LOOK_DEFAULT,
  PALETTE_LOOK_IDS,
  layoutDrawsPaletteLook,
  resolvePaletteLook,
} from './palette-looks';
import { hasHubCanvas, sanitizeHubCanvas } from './hub-canvas';
import { HUB_CANVAS_LOOK_KEYS } from './hub-look-pro';
import { paletteLookOfRow } from './scene-style-of-row';
import { PALETTE_INK_DARK, PALETTE_INK_LIGHT, paletteInkOn } from './palette-ink';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), 'utf8');

test('absent, malformed and unknown picks are all Tags — the default is today\'s look', () => {
  assert.equal(PALETTE_LOOK_DEFAULT, 'tags');
  for (const v of [undefined, null, '', 'Tags', 'velvet', 42, {}, 'a'.repeat(40)]) {
    assert.equal(resolvePaletteLook(v), 'tags', `${JSON.stringify(v)} → tags`);
  }
  for (const id of PALETTE_LOOK_IDS) assert.equal(resolvePaletteLook(id), id);
  assert.equal(paletteLookOfRow(null), 'tags');
  assert.equal(paletteLookOfRow({ config_json: null }), 'tags');
  assert.equal(paletteLookOfRow({ config_json: { canvas: { style: 'palette' } } }), 'tags', 'a layout pick is not a look');
  assert.equal(paletteLookOfRow({ config_json: { canvas: { palette: 'ribbon' } } }), 'ribbon');
});

test('five looks, in the design\'s order, each with a name and a line', () => {
  assert.deepEqual(PALETTE_LOOKS.map((l) => l.id), ['tags', 'fabric', 'chips', 'circles', 'ribbon']);
  assert.deepEqual([...PALETTE_LOOK_IDS], PALETTE_LOOKS.map((l) => l.id));
  for (const l of PALETTE_LOOKS) assert.ok(l.name && l.line, `${l.id} is described`);
});

test('`canvas.palette` is kept like `canvas.style` — and it is free and frames nothing', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { palette: 'fabric' } }).palette, 'fabric');
  assert.equal(sanitizeHubCanvas({ canvas: { palette: 'Not An Id!' } }).palette, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { palette: 7 } }).palette, undefined);
  assert.equal(hasHubCanvas(sanitizeHubCanvas({ canvas: { palette: 'chips' } })), false, 'a look alone brings no frame and no motion');
  assert.equal(hasHubCanvas(sanitizeHubCanvas({ canvas: { palette: 'chips', style: 'palette' } })), false);
  assert.ok(!(HUB_CANVAS_LOOK_KEYS as readonly string[]).includes('palette'), 'a palette look is never a Pro look key');
});

test('the look is offered only where "Our colours" is drawn in it', () => {
  assert.equal(layoutDrawsPaletteLook(null), true, 'a stage with no layouts draws the shipped Colours and roles');
  assert.equal(layoutDrawsPaletteLook('colours-and-roles'), true);
  assert.equal(layoutDrawsPaletteLook('palette'), false);
  assert.equal(layoutDrawsPaletteLook('line'), false);
});

test('the ink on a colour is the one with the higher contrast — Gold reads dark ink', () => {
  assert.equal(paletteInkOn('#B8934A'), PALETTE_INK_DARK, 'the 150-mean shortcut would say light; contrast says dark');
  assert.equal(paletteInkOn('#351115'), PALETTE_INK_LIGHT);
  assert.equal(paletteInkOn('#646B38'), PALETTE_INK_LIGHT);
  assert.equal(paletteInkOn('#EFE3B8'), PALETTE_INK_DARK);
  assert.equal(paletteInkOn('#4D5A72'), PALETTE_INK_LIGHT);
});

/* ── THE ENTRANCES ─────────────────────────────────────────────────────── */

/** The palette block of globals.css, from its heading to its reduced-motion block's end. */
function paletteCss(): string {
  const css = read('app/globals.css');
  const from = css.indexOf('THE FIVE PALETTE LOOKS');
  assert.ok(from > 0, 'the palette looks block is in globals.css');
  const rest = css.slice(from);
  const rm = rest.indexOf('@media (prefers-reduced-motion: reduce)');
  const end = rest.indexOf('\n}\n', rm);
  return rest.slice(0, end + 3);
}

/** Every rule (selector + body), top level. */
function rules(css: string): Array<{ sel: string; body: string }> {
  const out: Array<{ sel: string; body: string }> = [];
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ sel: m[1]!.trim(), body: m[2]! });
  }
  return out;
}

test('every palette entrance binds only on a palette the page\'s one observer has marked', () => {
  const animated = rules(paletteCss()).filter((r) => /animation\s*:\s*sn-pal-/.test(r.body));
  assert.ok(animated.length >= 8, `the five entrances and their words (${animated.length} rules)`);
  for (const r of animated) {
    // Split on the commas BETWEEN selectors, never the one inside `:is(b, small)`.
    for (const sel of r.sel.split(/,(?![^(]*\))/).map((x) => x.trim())) {
      assert.match(sel, /^\.pahina-js /, `${sel} — only under the flag RootFlag withholds for reduced motion`);
      assert.match(sel, /\[data-pal-look='[a-z]+'\]\.pahina-in/, `${sel} — only once the observer marks it`);
    }
    assert.match(r.body, /\bbackwards\b/, `${r.sel} — nothing lingers once the entrance ends`);
    assert.doesNotMatch(r.body, /infinite/, `${r.sel} — plays once`);
  }
  // …and the mark comes from the page's ONE observer, not a second script.
  assert.match(read('app/[slug]/_components/pahina-motion.tsx'), /var hsel='[^']*\[data-pal-look\]';/);
});

test('reduced motion stops every palette entrance outright', () => {
  const css = paletteCss();
  const rm = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /\.sn-editorial \[data-pal-look\] \*/);
  assert.match(rm, /\.sn-pal-legend > span/);
  assert.match(rm, /animation:\s*none\s*!important/);
  // RootFlag — the gate every entrance needs — refuses the flag for these guests.
  assert.match(read('app/[slug]/_components/pahina-motion.tsx'), /prefers-reduced-motion: reduce\)'\)\.matches\)return;\s*r\.classList\.add\('pahina-js'\)/);
});

test('the slowest palette entrance, for any number of colours, ends inside 1.2 s', () => {
  const css = paletteCss();
  const turns = [...css.matchAll(/--pd:\s*([\d.]+)s/g)].map((m) => Number(m[1]));
  const places = [...css.matchAll(/--pn:\s*(\d+)/g)].map((m) => Number(m[1]));
  assert.ok(turns.length >= 6 && places.length >= 6);
  // The last turn is held by an open-ended `nth-child(n + 7)`, so an eighth colour waits no longer.
  assert.match(css, /li:nth-child\(n \+ 7\)[^{]*\{\s*--pd:\s*0\.6s;\s*--pn:\s*6;/);
  const pd = Math.max(...turns);
  const pn = Math.max(...places);
  for (const r of rules(css).filter((x) => /animation\s*:\s*sn-pal-/.test(x.body))) {
    const a = /animation\s*:\s*sn-pal-[a-z]+\s+([\d.]+)s\s+[^;]*?(?:\s(var\(--pd, 0s\)|calc\([^;]*?\)))?\s+backwards/.exec(r.body);
    assert.ok(a, `${r.sel}: a duration`);
    const dur = Number(a[1]);
    const delayExpr = a[2] ?? '0s';
    // `a * b + c` with the latest turn and place put in — sums of products, nothing else.
    const delay = delayExpr
      .replace(/^calc\((.*)\)$/, '$1')
      .replace(/var\(--pd, 0s\)/g, String(pd))
      .replace(/var\(--pn, 0\)/g, String(pn))
      .replace(/(\d+(?:\.\d+)?)s\b/g, '$1')
      .split('+')
      .reduce((sum, term) => sum + term.split('*').reduce((p, f) => p * Number(f.trim()), 1), 0);
    assert.ok(Number.isFinite(delay), `${r.sel}: a delay (${delayExpr})`);
    assert.ok(dur + delay < 1.2, `${r.sel}: ends at ${(dur + delay).toFixed(2)} s`);
  }
});

/* ── THE MAKER ─────────────────────────────────────────────────────────── */

test('the Palette picker is ONE dropdown of the five looks, each with a thumbnail of the couple\'s colours', async () => {
  const { PaletteLookRow } = await import('../app/dashboard/[eventId]/website/editor/_components/palette-look-row');
  const picks: string[] = [];
  const row = PaletteLookRow({ value: 'tags', colours: ['#351115', '#646B38', '#EFE3B8', '#C9A1A0'], onPick: (id) => picks.push(id) });
  // IRow → its one child, the PickMenu.
  const kids = React.Children.toArray((row as React.ReactElement<{ children: React.ReactNode; label: string }>).props.children);
  assert.equal((row as React.ReactElement<{ label: string }>).props.label, 'Palette', 'the row says "Palette"');
  assert.equal(kids.length, 1, 'one control in the row — never a pill row');
  const menu = kids[0] as React.ReactElement<{ options: Array<{ key: string; preview?: React.ReactElement<{ look: string; colours: string[] }> }>; value: string; onPick: (k: string) => void }>;
  const { PickMenu } = await import('../app/dashboard/[eventId]/website/editor/_components/pick-menu');
  assert.equal(menu.type, PickMenu, 'the shared PickMenu');
  assert.deepEqual(menu.props.options.map((o) => o.key), ['tags', 'fabric', 'chips', 'circles', 'ribbon']);
  for (const o of menu.props.options) {
    assert.equal(o.preview?.props.look, o.key, `${o.key} has its own thumbnail`);
    assert.deepEqual(o.preview?.props.colours, ['#351115', '#646B38', '#EFE3B8'], 'drawn in THIS couple\'s first three colours');
  }
  menu.props.onPick('ribbon');
  menu.props.onPick('tags');
  menu.props.onPick('not-a-look');
  assert.deepEqual(picks, ['ribbon'], 'a pick of the current look, or of nothing, saves nothing');
  // Before the couple has chosen, choosing the shown default (Tags) ON PURPOSE is a
  // choice: it is saved, and a saved pick is what plays the entrance (owner 2026-09-30).
  const first: string[] = [];
  const unpicked = PaletteLookRow({ value: 'tags', picked: false, colours: ['#351115'], onPick: (id) => first.push(id) });
  const m2 = React.Children.toArray((unpicked as React.ReactElement<{ children: React.ReactNode }>).props.children)[0] as typeof menu;
  m2.props.onPick('tags');
  assert.deepEqual(first, ['tags']);
});

test('the Maker stores every pick as chosen — Tags on purpose is kept, never cleared into an absence', () => {
  const src = stripComments(read('app/dashboard/[eventId]/website/editor/_components/scene-style-row.tsx'));
  assert.match(src, /onPick=\{\(id\) => save\(\(c\) => \{ c\.palette = id; \}\)\}/);
  assert.doesNotMatch(src, /delete c\.palette/, 'clearing the key would turn a deliberate Tags back into the still default');
  assert.match(src, /picked=\{isPaletteLookId\(shown\.palette\)\}/);
});

test('the Palette picker loads only inside the lazy `maker-details` chunk', () => {
  const dir = 'app/dashboard/[eventId]/website/editor/_components';
  // Its one importer is the Style row…
  const importers = fs
    .readdirSync(path.join(WEB, dir))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.'))
    .filter((f) => /from '\.\/palette-look-row'/.test(read(`${dir}/${f}`)));
  assert.deepEqual(importers, ['scene-style-row.tsx']);
  // …which is reached only through the dynamic stand-in, in the existing chunk.
  const lazy = read(`${dir}/scene-styles-lazy.tsx`);
  assert.match(lazy, /import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/scene-style-row'\)/);
  const shell = read(`${dir}/editor-shell.tsx`);
  assert.doesNotMatch(shell, /from '\.\/(scene-style-row|palette-look-row)'/, 'the shell never imports either directly');
});
