/**
 * browsing-themes-never-moves-the-canvas.test.ts — owner 2026-09-28, verbatim:
 * *"we don't want you moving the iframe. we want the theme picker to be there
 * actively editable and a complete preview of what each theme would look like"*.
 *
 * The Maker's canvas iframe sits under the Details page. Looking at themes must
 * leave it exactly where it is — not navigated, not reloaded, not scrolled, not
 * re-mounted. Only a deliberate pick changes the theme, and it lands through
 * the draft like every other Details edit.
 *
 * The way this could break is not obvious, so it is spelled out: each theme
 * tile is its own small frame of the guest page. If a tile mounted the
 * click-to-edit bridge, it would post `ready` / `edit` to ITS parent — the Maker
 * — and the Maker's listeners check the message's ORIGIN, not which frame sent
 * it. A tile's `ready` could then promote the canvas's loading frame
 * (`buffered-canvas-frame.tsx`), and a tap inside a tile could open a panel. So:
 *
 *   1 · a tile's address is the host canvas door + `theme=`, with no stamp;
 *   2 · the guest page honours `theme=` for a verified host only, and a tile
 *       NEVER mounts the bridge;
 *   3 · the picker has no path to the canvas: no postMessage, no navigation of
 *       anything but its own tiles, no `scrollIntoView`, sandboxed frames, and
 *       nothing happens on hover or scroll — only a pick writes, to the draft;
 *   4 · rendered, nothing heavy loads before a tile is in view.
 *
 * 🛡 MUTATION-CHECKED: each rule was broken on purpose and this file went RED
 * (bridge mounted in a tile; `scrollIntoView` in the picker; a frame src
 * written on the server render; a stamp in the tile address).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { makerThemeTileSrc } from '@/lib/maker-made-once-pages';
import { nextTileToLoad, tilesShown, type ThemeTile } from '@/lib/maker-theme-tiles';
import { canvasTriedTheme } from '../../../../[slug]/_lib/editor-canvas';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The picker's one save imports the draft action, whose server graph names
  // `server-only` — a marker module with no runtime of its own.
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const PICKER = 'dashboard/[eventId]/launch/_components/maker-theme-picker.tsx';

const TILES: ThemeTile[] = [
  { id: 'house', name: 'Classic', tier: 'free' },
  { id: 'abaca', name: 'Abaca', tier: 'pro' },
  { id: 'vintage', name: 'Vintage', tier: 'pro' },
];

// ═══ 1 · the tile's address ═══════════════════════════════════════════════

test('1 · a tile is the host canvas door + theme= — and carries no render stamp', () => {
  const src = makerThemeTileSrc('/cale-ice', 'rsvp', 'vintage');
  assert.equal(src, '/cale-ice?phase=rsvp&editor=1&theme=vintage');
  // No stamp: a Maker re-render after a save elsewhere must not reload a tile.
  assert.doesNotMatch(src ?? '', /[?&](v|t|stamp)=/);
  assert.equal(makerThemeTileSrc(null, 'rsvp', 'vintage'), null, 'no address, no tile — never a guessed one');
});

// ═══ 2 · the guest page's side ═══════════════════════════════════════════

test('2a · `theme=` is honoured for a verified host only, and only for a shipped theme', () => {
  assert.equal(canvasTriedTheme({ theme: 'vintage' }, false), null, 'a stranger’s ?theme= must change nothing');
  assert.equal(canvasTriedTheme({ theme: 'vintage' }, true), 'vintage');
  assert.equal(canvasTriedTheme({ theme: 'capiz' }, true), null, 'a retired id is not a tile');
  assert.equal(canvasTriedTheme({ theme: '<script>' }, true), null);
  assert.equal(canvasTriedTheme({}, true), null);
});

test('2b · a tile NEVER mounts the click-to-edit bridge', () => {
  const body = read('[slug]/_components/site-body.tsx');
  const mounts = [...body.matchAll(/<EditorBridge\s*\/>/g)];
  assert.equal(mounts.length, 1, 'the bridge is mounted in more than one place — each must be fenced');
  const line = body.slice(Math.max(0, mounts[0]!.index! - 120), mounts[0]!.index!);
  assert.match(line, /isEditorCanvas && editorBridge && !themeTile \?\s*$/, 'a theme tile would mount the bridge — the Maker would hear it as the canvas');

  const page = read('[slug]/page.tsx');
  assert.match(page, /themeTile: triedTheme !== null,/, 'the page stopped telling the body it is a tile');
  // The tile's theme comes ONLY from the host-verified helper.
  assert.match(
    page,
    /triedTheme = canvasTriedTheme\(search, await loadHostMembership\(admin, liveEvent\.event_id, previewer\.id\)\)/,
    'the tile theme is taken without the host check',
  );
  assert.equal([...page.matchAll(/triedTheme = /g)].length, 1, 'a second writer of the tile theme appeared');
});

test('2c · the tile wears the theme through the ONE gate — the fence still answers', () => {
  const page = read('[slug]/page.tsx');
  assert.match(page, /\{ \.\.\.draftedEvent, invite_theme: triedTheme, theme_try_on: true \}/);
  assert.match(page, /triedTheme \|\| \(hostDraft && HUB_DRAFT_LOOK_COLUMNS\.some/, 'a tile is not re-dressed');
  const look = read('[slug]/_lib/hub-look.ts');
  assert.match(look, /const ownsPro = owned \|\| event\.theme_try_on === true;/);
  assert.match(look, /resolveInviteTheme\(\{ saved, ownsPro, mayShowStdFilm \}\)/, 'the fence is no longer asked of a tile');
});

// ═══ 3 · the picker has no path to the canvas ═════════════════════════════

test('3a · the picker never touches another frame, never scrolls an ancestor, never navigates', () => {
  const src = read(PICKER);
  assert.doesNotMatch(src, /postMessage|contentWindow|window\.parent|window\.top/, 'the picker talks to a frame');
  assert.doesNotMatch(src, /scrollIntoView/, 'scrollIntoView scrolls every ancestor — the Maker included');
  assert.doesNotMatch(src, /useRouter|router\.|location\.(href|assign|replace)|\.reload\(/, 'the picker navigates');
  assert.doesNotMatch(
    src,
    /data-maker-page-frame|data-maker-canvas|buffered-canvas|querySelector\([^)]*iframe/,
    'the picker reaches for the canvas frame',
  );
  // Only the rail is scrolled, by scrollLeft.
  assert.match(src, /rail\.scrollLeft = /);
});

test('3b · a tile frame is sandboxed without top navigation and takes no pointer', () => {
  const src = read(PICKER);
  const frame = /<iframe[\s\S]*?\/>/.exec(src)?.[0] ?? '';
  assert.ok(frame.length > 50, 'the tile frame is gone — re-anchor this guard');
  assert.match(frame, /sandbox="allow-scripts allow-same-origin"/);
  assert.doesNotMatch(frame, /allow-top-navigation|allow-popups|allow-forms/);
  assert.match(frame, /pointer-events-none/);
  assert.match(frame, /tabIndex=\{-1\}/);
});

test('3c · nothing happens on hover or scroll — only a pick writes, and it writes the DRAFT', () => {
  const src = read(PICKER);
  assert.doesNotMatch(src, /onMouseEnter|onMouseOver|onPointerEnter|onPointerOver|onFocus=|onScroll/, 'browsing runs code');
  const calls = [...src.matchAll(/hubDraftAction\(/g)];
  assert.equal(calls.length, 1, 'the picker writes from more than one place');
  const pickFn = src.slice(src.indexOf('const pick = '), src.indexOf('return (', src.indexOf('const pick = ')));
  assert.match(pickFn, /fd\.set\('intent', 'save'\)/, 'a pick is not a draft save');
  assert.match(pickFn, /JSON\.stringify\(\{ events: \{ invite_theme: id \} \}\)/);
  assert.match(pickFn, /makerSave\(\(\) => hubDraftAction\(eventId, fd\), requestMakerRefresh\)/, 'a pick does not land the Details way');
  // The only click handler that writes is the pick — for EVERY tile, Pro ones
  // included (2026-09-28: tried free, paid at Apply — no tile is a link away).
  assert.equal([...src.matchAll(/onClick=/g)].length, 1);
  assert.doesNotMatch(src, /data-theme-tile-locked|<Link\b/, 'a Pro tile still leads away from the Maker');
});

// ═══ 4 · load weight ══════════════════════════════════════════════════════

test('4a · one frame at a time, and only in view', () => {
  const order = ['house', 'abaca', 'vintage'];
  const inView = new Set(['abaca', 'vintage']);
  assert.equal(nextTileToLoad(order, { inView, mounted: [], loading: null }), 'abaca');
  assert.equal(nextTileToLoad(order, { inView, mounted: ['abaca'], loading: 'abaca' }), null, 'two frames load at once');
  assert.equal(nextTileToLoad(order, { inView, mounted: ['abaca'], loading: null }), 'vintage');
  assert.equal(nextTileToLoad(order, { inView, mounted: ['abaca', 'vintage'], loading: null }), null);
  assert.equal(nextTileToLoad(order, { inView: new Set(), mounted: [], loading: null }), null, 'an unseen tile loads');
});

test('4b · rendered on the server, the picker loads NO frame — and a Pro tile is a pick marked ◆ PRO', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerThemePicker } = await import('./maker-theme-picker');
  const html = renderToStaticMarkup(
    React.createElement(MakerThemePicker, {
      eventId: 'e-1',
      home: '/sample',
      themes: TILES,
      current: 'house',
      ownsPro: false,
      storeShell: false,
    }),
  );
  assert.match(html, /data-maker-theme-picker/);
  assert.doesNotMatch(html, /<iframe/, 'a frame was written before its tile was seen — ten pages would load at once');
  assert.equal([...html.matchAll(/data-theme-tile="/g)].length, 3);
  // 💎 Every tile is a pick (owner 2026-09-28: "they can edit it with pro
  // features. but need to upgrade to pro when clicked on apply") — the Pro
  // tiles wear ◆ PRO, never a padlock, never dimmed, never a link away.
  assert.match(html, /data-theme-tile="house"[\s\S]*?<button[^>]*aria-pressed="true"/);
  assert.equal([...html.matchAll(/data-theme-tile-pick=""/g)].length, 3, 'a tile is not a pick');
  assert.equal([...html.matchAll(/data-paid-mark="try"/g)].length, 2, 'the two Pro tiles wear ◆ PRO');
  assert.doesNotMatch(html, /data-paid-mark="locked"|data-theme-tile-locked|studio\/website-pro/);
  assert.doesNotMatch(html, /opacity-|grayscale/, 'a Pro tile is dimmed');
});

test('4c · the app-store shell shows no locked door', () => {
  const shown = (ownsPro: boolean, current: string) =>
    tilesShown(TILES, { ownsPro, storeShell: true, current }).map((t) => t.id);
  assert.deepEqual(shown(false, 'house'), ['house']);
  // A couple already wearing a Pro theme keeps seeing it (saving can never quietly reset it).
  assert.deepEqual(shown(true, 'vintage'), ['house', 'vintage']);
  assert.deepEqual(tilesShown(TILES, { ownsPro: false, storeShell: false, current: 'house' }).length, 3);
});
