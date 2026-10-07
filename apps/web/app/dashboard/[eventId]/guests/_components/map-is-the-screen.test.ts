/**
 * map-is-the-screen.test.ts — THE MAP IS THE SCREEN (Maker PR 4f · G38, G39).
 * Owner 2026-10-07: *"fix this page to be minimal as possible. this has too much
 * text and the map will take up the whole screen"* · *"full width"* · *"pinch"* ·
 * *"no background for map"* · *"extend map until here"*.
 *
 * No card or hint above the canvas; the canvas runs edge to edge and down to the
 * bottom bar; it fits on first open (0.6–1.8) and pinch/ctrl-wheel zooms (0.5–2.5).
 *
 * SABOTAGE (seen red): put a hint paragraph between the counts and the canvas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import type { GuestRow } from '@/lib/guests';
import { layoutMap } from '@/lib/guest-map-layout';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const MAP = stripComments(readFileSync(join(HERE, 'guest-map-canvas.tsx'), 'utf8'));
const CSS = stripComments(readFileSync(join(HERE, 'guests-screen.module.css'), 'utf8'));
const rule = (sel: string) => CSS.slice(CSS.indexOf(`${sel} {`), CSS.indexOf('}', CSS.indexOf(`${sel} {`)));

test('nothing between the counts and the canvas — no card, no hint', () => {
  const at = SCREEN.indexOf("gview === 'map' ? (");
  assert.notEqual(at, -1, 'the map branch moved — re-aim');
  const branch = SCREEN.slice(at, SCREEN.indexOf('/>', at));
  assert.match(branch, /^gview === 'map' \? \(\s*<GuestMapCanvas\b/, 'something is drawn above the canvas');
  assert.doesNotMatch(MAP, /<p\b|<h\d\b|hint/i, 'the map draws a hint or a heading');
});

test('edge to edge, no background, down to the bottom bar', () => {
  const wrap = rule('.mapwrap');
  assert.match(wrap, /background: transparent;/);
  assert.match(wrap, /margin-left: -16px;/, 'the canvas does not break out of the page’s side padding');
  assert.match(MAP, /window\.innerHeight - top - dock/, 'the canvas height is not measured down to the dock');
  assert.match(MAP, /--sn-bottomdock-h/);
});

test('fit on first open 0.6–1.8; pinch and ctrl-wheel 0.5–2.5', () => {
  assert.match(MAP, /Math\.min\(1\.8, Math\.max\(0\.6,/, 'the first-open fit range moved');
  assert.match(MAP, /Math\.min\(2\.5, Math\.max\(0\.5, z\)\)/, 'the zoom range moved');
  assert.match(MAP, /addEventListener\('touchmove', onMove, \{ passive: false \}\)/, 'pinch cannot stop the page scroll');
  assert.match(MAP, /if \(!e\.ctrlKey\) return;/, 'the wheel zooms without ctrl — plain scrolling would zoom');
});

test('the layout: every leaf its own row, a parent centred over its children (executed)', () => {
  const kid = (id: string) => ({ guest_id: id, first_name: id }) as GuestRow;
  const m = layoutMap('Maria & Jose', [{ key: 'a', label: 'A', mark: { kind: 'letter', letter: 'A' }, kids: [], guests: [kid('1'), kid('2'), kid('3')] }], true);
  const leaves = m.nodes.filter((n) => n.kind === 'leaf');
  assert.equal(new Set(leaves.map((n) => n.y)).size, 3, 'two leaves share a row');
  const branch = m.nodes.find((n) => n.kind === 'branch')!;
  assert.equal(branch.y, (leaves[0]!.y + leaves[2]!.y) / 2, 'the branch is not centred over its leaves');
  assert.equal(m.nodes.find((n) => n.kind === 'root')!.y, branch.y);
});
