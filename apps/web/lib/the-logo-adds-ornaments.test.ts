/**
 * ❦ THE LOGO ADDS ORNAMENTS (L5 — owner 2026-10-08, DECISION_LOG "LOGO MAKER REPLOT APPROVED, WITH ORNAMENT", verbatim
 * *"approve add ornament"*, reversing the 2026-10-06 removal; contract `LOGO_MAKER_REPLOT_2026-10-08_fable.md` +
 * `prototypes/logo_maker_replot_2026-10-08_fable.html`, whose Add sheet reads Text · Image · Frame · Ornament and
 * whose Style shows Ornament ▾ over `ORN = ['❦','✿','❧','✦','⚜','❖']`).
 *
 * What this holds:
 *   1 · ＋ Add layer is ONE list of four, in the prototype's order and words, and Ornament adds one;
 *   2 · the set is closed — six, each pure ink (paths only), each naming itself in its shapes;
 *   3 · an ornament is a layer like any other: it survives the sanitiser, the saved file, the server's SVG sanitiser and
 *       the next open (which ornament it is, too), recolours, hides, duplicates, turns, and has an ink box;
 *   4 · Style offers Ornament ▾ (a dropdown, every one of the six) and picking one swaps the shapes, keeping the rest;
 *   5 · the first load does not pay for it: only the lazy `maker-logo.tsx` imports `logo-ornaments`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { LOGO_LAYER_KINDS, defaultMotion, logoInkBox, sanitizeLogoLayers, type LogoLayer } from './logo-layers';
import { composeLogoSvg, duplicateLayer, layersFromSaved, layerShapes, metaOf, parseLogoSvg } from './logo-layers-edit';
import { LOGO_ORNAMENT_KINDS, LOGO_ORNAMENT_LABEL, ornamentBody, ornamentOf } from './logo-ornaments';
import { sanitizeStudioSvg } from './monogram-studio-shared';

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const read = (f: string) => stripComments(readFileSync(join(WEB, f), 'utf8'));

const orn = (id: string, kind: (typeof LOGO_ORNAMENT_KINDS)[number], extra: Partial<LogoLayer> = {}): LogoLayer => ({
  id,
  kind: 'ornament',
  name: LOGO_ORNAMENT_LABEL[kind],
  x: 500,
  y: 200,
  scale: 0.4,
  color: '#C5A059',
  motion: defaultMotion(0),
  ...ornamentBody(kind),
  ...extra,
});

test('1 · ＋ Add layer = Text · Image · Frame · Ornament, the prototype’s words — and Ornament adds one', () => {
  const cards = read(`${L}/logo-layer-cards.tsx`);
  const list = cards.slice(cards.indexOf('export const LOGO_ADD_KINDS'), cards.indexOf('] as const;', cards.indexOf('export const LOGO_ADD_KINDS')));
  assert.deepEqual([...list.matchAll(/kind: '([a-z]+)', label: '([^']+)'/g)].map((m) => `${m[1]}:${m[2]}`), ['text:Text', 'image:Image', 'frame:Frame', 'ornament:Ornament']);
  assert.match(list, /kind: 'ornament', label: 'Ornament', hint: 'A flourish, a leaf, a star'/, 'the Ornament row lost the prototype’s line');
  assert.match(cards, /ornament: <[A-Z]\w+ aria-hidden/, 'the Ornament row has no icon');
  assert.ok((LOGO_LAYER_KINDS as readonly string[]).includes('ornament'), 'ornament is not a layer kind');
  const editor = read(`${L}/maker-logo.tsx`);
  assert.match(editor, /else if \(kind === 'ornament'\) addOrnament\(\);/, 'the Ornament row adds nothing');
  const add = editor.slice(editor.indexOf('const addOrnament = () =>'), editor.indexOf('};', editor.indexOf('const addOrnament = () =>')));
  assert.match(add, /kind: 'ornament'/);
  assert.match(add, /\.\.\.ornamentBody\('flourish'\)/, 'a new ornament is not the flourish (the prototype’s ❦ first)');
  assert.match(add, /motion: defaultMotion\(i\)/, 'a new ornament does not Draw on after the layer below it');
});

test('2 · a closed set of six, each pure ink that names itself', () => {
  assert.deepEqual([...LOGO_ORNAMENT_KINDS], ['flourish', 'blossom', 'leaf', 'star', 'fleur', 'diamonds']);
  assert.deepEqual(LOGO_ORNAMENT_KINDS.map((k) => LOGO_ORNAMENT_LABEL[k]), ['Flourish', 'Blossom', 'Leaf', 'Star', 'Fleur-de-lis', 'Diamonds']);
  for (const k of LOGO_ORNAMENT_KINDS) {
    const b = ornamentBody(k);
    assert.ok(b.w > 0 && b.h > 0, `${k} has no box`);
    assert.equal(ornamentOf(b.body), k, `${k} does not name itself`);
    // Paths only: no stroke (it would not recolour or print as ink), no image, no text, no style.
    const tags = [...b.body.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]);
    assert.deepEqual([...new Set(tags)].sort(), ['g', 'path'], `${k} draws something other than paths: ${tags}`);
    assert.doesNotMatch(b.body, /stroke|fill=|style=|NaN|undefined/, `${k} carries ${b.body.match(/stroke|fill=|style=|NaN|undefined/)?.[0]}`);
    // Every point inside its own box (a little give for curve control points).
    for (const m of b.body.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)) {
      const [x, y] = [Number(m[1]), Number(m[2])];
      assert.ok(x >= -1 && x <= b.w + 1 && y >= -1 && y <= b.h + 1, `${k} reaches outside its box at ${x} ${y}`);
    }
  }
  assert.equal(ornamentOf('<g data-ornament="skull"><path d="M0 0H1V1Z"/></g>'), null, 'an ornament outside the set is read as one');
  assert.equal(ornamentOf(undefined), null);
});

test('3 · an ornament is a layer like any other — saved, read back, recoloured, hidden, duplicated, turned, measured', () => {
  const a = orn('ornone', 'leaf', { rotate: 30 });
  const [meta] = sanitizeLogoLayers([metaOf(a)]);
  assert.equal(meta!.kind, 'ornament', 'the sanitiser drops an ornament');
  assert.equal(meta!.color, '#C5A059');
  assert.equal(meta!.rotate, 30);
  const svg = composeLogoSvg([a])!;
  assert.match(svg, /<g data-logo-layer="ornone" data-kind="ornament" data-in="draw"[^>]* transform="[^"]*rotate\(30\)/);
  assert.match(svg, /<path fill="#C5A059" d=/, 'the ornament is not in its colour');
  assert.doesNotMatch(svg, /<path d=/, 'a piece of the ornament kept no colour');
  // The server keeps it; the next open reads it back — the same ornament, the same shapes.
  const saved = sanitizeStudioSvg(svg)!;
  assert.ok(saved.includes('data-ornament="leaf"'), 'the server’s SVG sanitiser strips which ornament it is');
  const back = layersFromSaved(sanitizeLogoLayers([metaOf(a)]), saved);
  assert.equal(back.length, 1, 'the ornament does not come back on the next open');
  assert.equal(ornamentOf(back[0]!.body), 'leaf');
  assert.equal(back[0]!.body, ornamentBody('leaf').body, 'the shapes changed on the way back');
  // It has ink, so every surface centres on it.
  const ink = logoInkBox(svg)!;
  assert.ok(ink && ink.w > 10 && ink.h > 10, `no ink box for an ornament (${JSON.stringify(ink)})`);
  // Hidden: off the logo, kept, and back as itself.
  const hid = composeLogoSvg([{ ...a, hidden: true }])!;
  assert.doesNotMatch(hid, /data-logo-layer=/);
  assert.equal(ornamentOf(parseLogoSvg(hid).get('ornone')?.body), 'leaf', 'a hidden ornament forgets which one it was');
  // Duplicate: the same ornament, its own layer.
  const two = duplicateLayer([a], 'ornone', 'orntwo');
  assert.equal(two.length, 2);
  assert.equal(ornamentOf(two[1]!.body), 'leaf');
  assert.equal(two[1]!.kind, 'ornament');
  // Recolour reaches every piece (the flourish has five).
  const f = layerShapes(orn('ornf', 'flourish', { color: '#123456' }));
  assert.equal(f.match(/<path /g)!.length, f.match(/fill="#123456"/g)!.length);
});

test('4 · Style offers Ornament ▾ — a dropdown of all six — and a pick swaps the shapes and the name', () => {
  const editor = read(`${L}/maker-logo.tsx`);
  const style = editor.slice(editor.indexOf('const look: LogoLook ='));
  const row = style.slice(style.indexOf("layer.kind === 'ornament' ?"), style.indexOf('dataAttr="data-logo-ornament-pick"'));
  assert.ok(row.length > 50, 'Style has no Ornament row for an ornament layer');
  assert.match(row, /<ChosenRow\s+name="Ornament"/, 'Ornament is not a dropdown');
  assert.match(row, /value=\{ornamentOf\(layer\.body\)\}/, 'the dropdown does not show the ornament the layer is');
  assert.match(row, /options=\{LOGO_ORNAMENT_KINDS\.map\(/, 'the dropdown does not offer the whole set');
  assert.match(row, /onPick=\{\(k\) => onChange\(\{ name: LOGO_ORNAMENT_LABEL\[[^\]]+\], \.\.\.ornamentBody\(/, 'a pick does not swap the shapes and the name');
  // The kind's own control sits with the frame's, before Colour (the prototype's Style).
  assert.ok(style.indexOf('data-logo-ornament-pick') < style.indexOf('{colour}'), 'Ornament ▾ is not where Frame ▾ is');
});

test('5 · the first load does not pay for six ornaments: only the lazy maker-logo imports them', () => {
  const importers: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e.startsWith('.')) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e) && /from '[^']*logo-ornaments'/.test(readFileSync(p, 'utf8'))) importers.push(relative(WEB, p));
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  walk(join(WEB, 'components'));
  assert.deepEqual(importers, [`${L}/maker-logo.tsx`], `logo-ornaments is imported outside the lazy Logo editor: ${importers}`);
  // And the first-load half (`logo-layers.ts`) carries the kind, never the shapes.
  assert.doesNotMatch(read('lib/logo-layers.ts'), /flourish|data-ornament/, 'ornament shapes leaked into the first-load file');
});
