/**
 * 👉 THE BACKGROUND TILES KEEP THE TOOLBAR IN PLACE — and every source of a scene's Background is offered to a Pro event.
 *
 * Owner, live on his phone 2026-10-26: *"on event hub when changing some background color. it does not stay on that
 * screen. the background is not changeable to video, sotck videos/photos or upload photo."* Walked in `/dev/maker-lab`:
 * Invitation › Details › Schedule › Background › Colour, then a drag along the row of tiles → the toolbar stepped to
 * the part beside it (Home › Closing — Edit on, Background grey) and the canvas went with it. The toolbar's swipe
 * (`stage-tools.tsx`) skipped the Style carousel and never the Background row, so every move along the tiles — the
 * only way to reach the other colours, the loops, the scenes and the uploads — threw the couple off the part.
 *
 *   (1) the rule (`lib/maker-swipe.ts`): a move that starts on the Background tiles, or in ANY row that scrolls
 *       sideways, is that row's — never a step; elsewhere on the panel it still steps; off the panel it never does;
 *   (2) the toolbar asks THAT rule (no second, inline skip list that can forget a row again), and the tiles' row wears
 *       the mark the rule names;
 *   (3) a Pro event is offered Colour · Scene · Video · Upload in every shell (an unlock belongs to the event); only a
 *       store shell's free event is not shown the media ones;
 *   (4) each source draws its own row of choices — Colour its tiles, Scene the ready-made pictures, Video the loops,
 *       Upload the ＋ Upload tile and the couple's own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { MAKER_SWIPE_SKIP, swipeMayStep, type SwipeElement } from './maker-swipe';
import { stageBgSourcesOffered } from './stage-bg-sources';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── a tiny element tree: each node has its own marks (attribute selectors it matches) ── */
type Node = SwipeElement & { marks: string[]; side?: boolean };
function node(marks: string[], parent: Node | null, side = false): Node {
  const n: Node = {
    marks,
    side,
    parentElement: parent,
    closest(selector: string) {
      const wanted = selector.split(',').map((s) => s.trim());
      for (let at: Node | null = n; at; at = at.parentElement as Node | null) if (at.marks.some((m) => wanted.includes(m))) return at;
      return null;
    },
  };
  return n;
}
const sideways = (el: SwipeElement) => (el as Node).side === true;

test('(1) a drag along the Background tiles is the row\'s own — the toolbar does not step', () => {
  const panel = node(['[data-stage-tools]'], null);
  const strip = node(['[data-stage-bg-strip]'], panel);
  const tile = node(['button'], strip);
  assert.equal(swipeMayStep(tile, sideways), false, 'a move that starts on a background tile stepped the toolbar to the next part');
  assert.ok(MAKER_SWIPE_SKIP.includes('[data-stage-bg-strip]'), 'the swipe skip no longer names the Background tiles');
});

test('(1) ANY row that scrolls sideways is its own — whatever it is called', () => {
  const panel = node(['[data-phone-chrome="panel"]'], null);
  const row = node(['div'], panel, true);
  const inner = node(['span'], row);
  assert.equal(swipeMayStep(inner, sideways), false, 'a move inside a sideways-scrolling row stepped the toolbar');
});

test('(1) elsewhere on the panel the swipe still steps; off the panel it never does', () => {
  const panel = node(['[data-stage-tools]'], null);
  const label = node(['span'], node(['div'], panel));
  assert.equal(swipeMayStep(label, sideways), true, 'the toolbar swipe no longer steps from the panel itself');
  assert.equal(swipeMayStep(node(['div'], null), sideways), false, 'a move off the toolbar stepped it');
  assert.equal(swipeMayStep(null, sideways), false);
  for (const skip of ['input', '[role="slider"]', '[data-style-carousel]', '[aria-expanded="true"]']) {
    assert.equal(swipeMayStep(node([skip], panel), sideways), false, `a move on ${skip} stepped the toolbar`);
  }
});

test('(2) the toolbar asks the one rule, and the tiles wear its mark', () => {
  const tools = code('app/dashboard/[eventId]/launch/_components/stage-tools.tsx');
  assert.match(tools, /from = swipeMayStep\(t, \(el\) => swipeScrollsSideways\(el as Element\)\)/, 'the toolbar swipe no longer asks `swipeMayStep`');
  assert.doesNotMatch(tools, /\[data-style-carousel\]/, 'a second, inline swipe skip list is back in stage-tools.tsx — it forgot the Background row once');
  const bg = code('app/dashboard/[eventId]/launch/_components/stage-panel/stage-background.tsx');
  assert.match(bg, /data-stage-bg-strip=\{source\}/, 'the Background tiles no longer carry `data-stage-bg-strip`');
});

test('(3) a Pro event is offered Colour · Scene · Video · Upload in every shell', () => {
  for (const storeShell of [false, true]) {
    const keys = stageBgSourcesOffered({ ownsPro: true, storeShell, hasLoops: true }).map((s) => s.key);
    assert.deepEqual(keys, ['hub', 'colour', 'scene', 'video', 'own'], `a Pro event (store shell: ${storeShell}) is not offered every source`);
  }
  assert.deepEqual(
    stageBgSourcesOffered({ ownsPro: false, storeShell: false, hasLoops: true }).map((s) => s.key),
    ['hub', 'colour', 'scene', 'video', 'own'],
    'on the web a free event tries every source (named at Apply)',
  );
  assert.deepEqual(stageBgSourcesOffered({ ownsPro: false, storeShell: true, hasLoops: true }).map((s) => s.key), ['hub', 'colour']);
  assert.deepEqual(stageBgSourcesOffered({ ownsPro: true, storeShell: false, hasLoops: false }).map((s) => s.key), ['hub', 'colour', 'scene', 'own']);
  const row = code('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  assert.match(row, /sources=\{stageBgSourcesOffered\(\{ ownsPro, storeShell, hasLoops: loops\.length > 0 \}\)\}/, 'the scene row no longer offers its sources through `stageBgSourcesOffered`');
});

test('(4) each source draws its own row of choices', async () => {
  const { StageBackground } = await import('../app/dashboard/[eventId]/launch/_components/stage-panel/stage-background');
  const sources = stageBgSourcesOffered({ ownsPro: true, storeShell: false, hasLoops: true });
  const draw = (source: 'colour' | 'scene' | 'video' | 'own', tiles: Array<{ key: string; name: string }>) =>
    renderToStaticMarkup(
      React.createElement(StageBackground, {
        source,
        sources,
        onSource: () => {},
        tiles: tiles.map((t) => ({ ...t, picture: {} })),
        tile: null,
        onTile: () => {},
        onUpload: source === 'own',
        upload: null,
        colour: null,
        customColour: () => null,
        opacity: null,
        shade: null,
        shape: null,
        onShape: () => {},
        motion: null,
        onMotion: () => {},
        pending: false,
      }),
    );
  const colour = draw('colour', [{ key: 'color', name: 'Plain' }, { key: 'glow', name: 'Glow' }]);
  assert.match(colour, /data-stage-bg-strip="colour"/);
  assert.match(colour, /data-stage-bg-tile="glow"/);
  assert.match(draw('scene', [{ key: '/std/backgrounds/ballroom.webp', name: 'Ballroom' }]), /data-stage-bg-strip="scene"[\s\S]*data-stage-bg-tile="\/std\/backgrounds\/ballroom\.webp"/);
  assert.match(draw('video', [{ key: 'loop-a', name: 'Luxe' }]), /data-stage-bg-strip="video"[\s\S]*data-stage-bg-tile="loop-a"/);
  const own = draw('own', [{ key: 'r2://x/photo.jpg', name: 'Your photo' }]);
  assert.match(own, /data-stage-bg-strip="own"[\s\S]*data-stage-bg-tile="upload"[\s\S]*data-stage-bg-tile="r2:\/\/x\/photo\.jpg"/, 'Upload no longer draws its ＋ Upload tile and the couple\'s own');
});
