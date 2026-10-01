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
 *   · NOTHING MOVES: the owner cut palette animation on 2026-09-30 ("THE MAKER
 *     RE-PLAN IS CUT TO ITS CORE"), so the looks' CSS holds no animation, no
 *     transition and no keyframes, and the page's scroll observer is not told
 *     about palettes;
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

/* ── NOTHING MOVES ─────────────────────────────────────────────────────── */

/** The palette block of globals.css, from its heading to the next top-level section. */
function paletteCss(): string {
  const css = read('app/globals.css');
  // From the OPENING of the heading comment, so the stripper sees the whole comment.
  const from = css.lastIndexOf('/*', css.indexOf('THE FIVE PALETTE LOOKS'));
  assert.ok(from > 0, 'the palette looks block is in globals.css');
  const rest = css.slice(from);
  const end = rest.indexOf('\n/* ──', 10);
  assert.ok(end > 0, 'the block ends at the next section');
  return rest.slice(0, end);
}

test('no palette look animates — no animation, transition or keyframes in its CSS', () => {
  const css = stripComments(paletteCss());
  assert.match(css, /\.sn-pal-ribbon/, 'the block really is the looks (a wrong slice would pass on nothing)');
  assert.doesNotMatch(css, /animation|transition|@keyframes|will-change/);
  // No rule anywhere in the stylesheet plays a palette.
  const all = stripComments(read('app/globals.css'));
  for (const m of all.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (/sn-pal|data-pal-look/.test(m[1]!)) assert.doesNotMatch(m[2]!, /animation|transition/, `${m[1]!.trim()} moves`);
  }
  assert.doesNotMatch(all, /@keyframes sn-pal/);
});

test('the page\'s scroll observer is not told about palettes', () => {
  const obs = read('app/[slug]/_components/pahina-motion.tsx');
  assert.doesNotMatch(obs, /data-pal|sn-pal/);
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
});

test('the Maker saves Tags as an absence — the default is never stored', () => {
  const src = stripComments(read('app/dashboard/[eventId]/website/editor/_components/scene-style-row.tsx'));
  assert.match(src, /if \(id === PALETTE_LOOK_DEFAULT\) delete c\.palette; else c\.palette = id;/);
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
