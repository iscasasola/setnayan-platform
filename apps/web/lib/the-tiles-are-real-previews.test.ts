/**
 * the-tiles-are-real-previews.test.ts — owner 2026-09-26, verbatim: *"the
 * navigator preview must really show the preview. it is so hard to see what i
 * will edit because i do not see it."*
 *
 * Each navigator tile was a words-only card ("TOGETHER W…", "COUNTING D…"). A
 * tile now shows the section itself: a static copy of the canvas's own markup
 * in a script-less document the canvas's width, scaled into the tile
 * (`lib/maker-tile-preview.ts`). This holds:
 *   1. The tile document carries the section, the canvas's stylesheets and its
 *      <html>/<body> dressing — i.e. it can look like the canvas.
 *   2. What only means something while the canvas's script runs is dropped
 *      (the scroll-reveal's hidden state, the Scroll·Scrub·Auto machinery),
 *      and animation is frozen, so the copy is the section AT REST — not a
 *      blank waiting for an observer that never comes.
 *   3. Nothing executable crosses: no script or frame tags from the chain, no
 *      event-handler attributes, attribute values escaped.
 *   4. The tile's viewport follows the device (Desktop 16:10, Phone 9:19.5)
 *      and the scale fits the canvas's width into the tile.
 *   5. SOURCE, per tile: the navigator mounts the preview for EVERY shown tile
 *      (not a text card), keyed by the same navigator key the canvas stamps;
 *      the preview is sandboxed without scripts, sits under the tile's button,
 *      and the words-only card survives only as what is drawn beneath it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  buildTileDocument,
  filterTileAttrs,
  tileFrame,
  TILE_FREEZE_CSS,
  type TileHead,
  type TileSnapshot,
} from './maker-tile-preview';

const HEAD: TileHead = {
  htmlAttrs: [
    ['lang', 'en'],
    ['class', 'font-editorial pahina-js sn-root'],
    ['style', '--accent: #7e0013'],
  ],
  bodyAttrs: [
    ['class', 'bg-cream text-ink'],
    ['onload', 'alert(1)'],
  ],
  styles: ['<link rel="stylesheet" href="/_next/static/css/app.css">', '<style>.x{color:red}</style>'],
};

const SNAP: TileSnapshot = {
  key: 'w:countdown',
  section: '<section data-snm-root="" class="countdown">142 days</section>',
  chain: [
    { tag: 'div', attrs: [['class', 'sn-editorial'], ['data-hub-theme', 'capiz'], ['style', '--paper: #f4ede4']] },
    { tag: 'main', attrs: [['class', 'mx-auto max-w-3xl']] },
    { tag: 'div', attrs: [['class', 'hub-scene hub-auto keep-me'], ['style', '--hub-tl: --s3; color: red']] },
  ],
  frameWidth: 1180,
};

test('1 · the tile document carries the section, the stylesheets and the page dressing', () => {
  const doc = buildTileDocument(HEAD, SNAP);
  assert.match(doc, /^<!doctype html><html/);
  assert.ok(doc.includes(SNAP.section), 'the section itself is in the tile');
  for (const s of HEAD.styles) assert.ok(doc.includes(s), `stylesheet missing: ${s}`);
  assert.match(doc, /<html lang="en" class="font-editorial sn-root" style="--accent: #7e0013">/);
  assert.match(doc, /<body class="bg-cream text-ink">/);
  // the theme scope above the section travels — its data attribute and custom properties
  assert.match(doc, /<div class="sn-editorial" data-hub-theme="capiz" style="--paper: #f4ede4"><main class="mx-auto max-w-3xl">/);
  // and every wrapper opened is closed, in reverse
  assert.ok(doc.includes(`${SNAP.section}</div></main></div></body></html>`));
});

test('2 · the copy is the section AT REST — script-only states dropped, motion frozen', () => {
  const doc = buildTileDocument(HEAD, SNAP);
  assert.doesNotMatch(doc, /pahina-js/, 'the scroll-reveal hidden state would leave chapters invisible');
  assert.doesNotMatch(doc, /hub-scene|hub-auto|--hub-tl/, 'the Scroll · Scrub · Auto machinery is dropped');
  assert.match(doc, /class="keep-me" style="color: red"/, 'everything else on that wrapper is kept');
  assert.ok(doc.includes(TILE_FREEZE_CSS));
  assert.match(TILE_FREEZE_CSS, /animation:none!important/);
  assert.match(TILE_FREEZE_CSS, /transition:none!important/);
});

test('3 · nothing executable crosses into the tile', () => {
  const kept = filterTileAttrs([
    ['onclick', 'steal()'],
    ['class', 'a'],
    ['href', 'javascript:alert(1)'],
    ['data-maker-section', 'w:x'],
    ['data-setnayan-editor-bound', '1'],
    ['style', 'color:red'],
  ]);
  assert.deepEqual(kept, [
    ['class', 'a'],
    ['style', 'color:red'],
  ]);
  const hostile: TileSnapshot = {
    ...SNAP,
    chain: [{ tag: 'script', attrs: [['class', '"><script>alert(1)</script>']] }, { tag: 'iframe', attrs: [] }],
  };
  const doc = buildTileDocument(HEAD, hostile);
  assert.doesNotMatch(doc.replace(HEAD.styles.join(''), ''), /<script|<iframe/);
  assert.match(doc, /class="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/, 'attribute values are escaped');
  assert.doesNotMatch(doc, /onload=/);
});

test('4 · the tile viewport follows the device, and the scale fits the canvas width into the tile', () => {
  const d = tileFrame('desktop', 1180, 96);
  assert.deepEqual({ w: d.width, h: d.height }, { w: 1180, h: 738 });
  assert.equal(d.scale, 96 / 1180);
  const p = tileFrame('phone', 430, 56);
  assert.deepEqual({ w: p.width, h: p.height }, { w: 430, h: 932 });
  assert.equal(p.scale, 56 / 430);
  assert.equal(tileFrame('phone', 430, 0).scale, 0, 'an unmeasured tile mounts nothing');
});

const SHELL = stripComments(
  readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
);
const PREVIEW = stripComments(
  readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/editor/_components/scene-preview.tsx'), 'utf8'),
);
const SNAPSHOT = stripComments(
  readFileSync(join(import.meta.dirname, '../app/dashboard/[eventId]/website/editor/_components/scene-snapshot.ts'), 'utf8'),
);

test('5 · SOURCE: every shown tile mounts the real preview, keyed by its navigator key', () => {
  const tileLoop = SHELL.slice(SHELL.indexOf('{list.shown.map((tile, i) =>'), SHELL.indexOf('{list.orderIsAutomatic ? ('));
  assert.ok(tileLoop.length > 200, 'the tile loop was not found — this scan is blind, not clean');
  const previews = tileLoop.match(/<ScenePreview\b/g)?.length ?? 0;
  const minis = tileLoop.match(/<SceneMiniature\b/g)?.length ?? 0;
  console.log(`  tile loop: ${previews} <ScenePreview>, ${minis} <SceneMiniature>`);
  assert.equal(previews, 1, 'each tile must mount the section preview');
  assert.match(tileLoop, /snapshot=\{tileSnaps\[tile\.key\] \?\? null\}/, 'the preview is the snapshot of THIS tile’s key');
  assert.match(tileLoop, /device=\{device\}/, 'the preview follows Desktop / Phone');
  // the words-only card is what shows until (or unless) the section is drawn — beneath the preview
  assert.ok(
    tileLoop.indexOf('<SceneMiniature') < tileLoop.indexOf('<ScenePreview'),
    'the words-only card must sit BENEATH the preview, not replace it',
  );
  // the preview must not be inside the <button> (a frame is not button content), and takes no pointer
  const btn = tileLoop.slice(tileLoop.indexOf('<button'), tileLoop.indexOf('</button>'));
  assert.doesNotMatch(btn, /<ScenePreview\b/);
  assert.match(PREVIEW, /pointer-events-none absolute inset-0 overflow-hidden/);
});

test('5b · SOURCE: the preview is a sandboxed, script-less copy that refreshes with the canvas', () => {
  assert.match(PREVIEW, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(PREVIEW, /allow-scripts/, 'the tile must never run the page’s scripts');
  assert.match(PREVIEW, /buildTileDocument\(head, snapshot\)/);
  assert.match(PREVIEW, /new IntersectionObserver\(/, 'only the tiles on screen mount a document');
  assert.match(SNAPSHOT, /findMakerSection\(doc, key\)/, 'the copy is found by the SAME key the canvas stamps');
  // refresh: a new canvas (edit, Apply, stage, View as) announces itself with `ready`,
  // and a Desktop/Phone switch resizes the canvas — both re-take the copies.
  assert.match(SHELL, /data\.t === 'ready'/, 'the navigator re-takes its previews when the canvas is ready');
  assert.match(SHELL, /new ResizeObserver\(/, 'the navigator re-takes its previews when the canvas resizes');
});
