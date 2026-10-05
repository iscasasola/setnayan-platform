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
 * 🖼 Since 2026-09-28 the gallery shows the curated SAMPLE Event Hub in each
 * theme (owner: *"a clean preview of each website … with the sample event
 * hub"*) — a still, or the live sample page in a small frame until a still is
 * captured — and the couple's prints on Details wear their pick. The rules
 * below hold for the sample frame exactly as they held for the old own-page tile.
 *
 * The way this could break is not obvious, so it is spelled out: each live
 * entry is its own small frame of a guest page. If a tile mounted the
 * click-to-edit bridge, it would post `ready` / `edit` to ITS parent — the Maker
 * — and the Maker's listeners check the message's ORIGIN, not which frame sent
 * it. A tile's `ready` could then promote the canvas's loading frame
 * (`buffered-canvas-frame.tsx`), and a tap inside a tile could open a panel. So:
 *
 *   1 · an entry's address is the SAMPLE page + `theme=` — never a couple's
 *       canvas door — with no stamp;
 *   2 · the guest page honours `theme=` for a verified host or on the sample
 *       row only, and a tile NEVER mounts the bridge;
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
import { nextTileToLoad, tilesShown, type ThemeTile } from '@/lib/maker-theme-tiles';
import { sampleHubTileSrc } from '@/lib/theme-sample-stills';
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
const OVERLAY = 'dashboard/[eventId]/launch/_components/theme-preview-overlay.tsx';

const TILES: ThemeTile[] = [
  { id: 'house', name: 'Classic', tier: 'free' },
  { id: 'abaca', name: 'Abaca', tier: 'pro' },
  { id: 'vintage', name: 'Vintage', tier: 'pro' },
];

// ═══ 1 · the tile's address ═══════════════════════════════════════════════

test('1 · an entry is the SAMPLE page + theme= — never a couple’s canvas door, never a stamp', () => {
  const src = sampleHubTileSrc('vintage');
  assert.equal(src, '/maria-and-jose?theme=vintage');
  assert.doesNotMatch(src, /editor=1|phase=/, 'the sample entry asked for the host canvas door');
  // No stamp: a Maker re-render after a save elsewhere must not reload an entry.
  assert.doesNotMatch(src, /[?&](v|t|stamp)=/);
  // The picker never builds a couple's address at all.
  const picker = read(PICKER);
  assert.doesNotMatch(picker, /makerThemeTileSrc|editor=1|home\b/, 'the gallery reaches for the couple’s own page again');
  // 🎨 …wearing the couple's board (`sampleBoardQuery`, 2026-10-05) — still only the sample page.
  assert.match(picker, /sampleHubTileSrc\(t\.id, samplePalette\)/);
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
  // …and the curated SAMPLE answers `theme=` to anyone — keyed on the row's own
  // `is_sample`, never on a param, so a real couple's page cannot be asked.
  assert.match(page, /const sampleTile = liveEvent\.is_sample === true;/, 'the sample tile is keyed on something other than the row');
  assert.match(page, /if \(search\.theme && sampleTile\) \{\s*triedTheme = canvasTriedTheme\(search, sampleTile\);/);
  assert.equal([...page.matchAll(/triedTheme = /g)].length, 2, 'a third writer of the tile theme appeared');
});

test('2c · the tile wears the theme through the ONE gate — the fence still answers', () => {
  const page = read('[slug]/page.tsx');
  assert.match(page, /\.\.\.draftedEvent,\s*invite_theme: triedTheme,\s*theme_try_on: true,/);
  assert.match(page, /triedTheme \|\| \(hostDraft && HUB_DRAFT_LOOK_COLUMNS\.some/, 'a tile is not re-dressed');
  const look = read('[slug]/_lib/hub-look.ts');
  assert.match(look, /const ownsPro = owned \|\| event\.theme_try_on === true;/);
  assert.match(look, /resolveInviteTheme\(\{ saved, ownsPro \}\)/, 'a tile is no longer resolved by the one theme rule');
});

// ═══ 3 · the picker has no path to the canvas ═════════════════════════════

test('3a · the picker and its full-screen preview never touch another frame, never scroll an ancestor, never navigate', () => {
  for (const file of [PICKER, OVERLAY]) {
    const src = read(file);
    assert.doesNotMatch(src, /postMessage|contentWindow|window\.parent|window\.top/, `${file} talks to a frame`);
    assert.doesNotMatch(src, /scrollIntoView/, `${file}: scrollIntoView scrolls every ancestor — the Maker included`);
    assert.doesNotMatch(src, /useRouter|router\.|location\.(href|assign|replace)|\.reload\(/, `${file} navigates`);
    assert.doesNotMatch(
      src,
      /data-maker-page-frame|data-maker-canvas|buffered-canvas|querySelector\([^)]*iframe/,
      `${file} reaches for the canvas frame`,
    );
  }
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
  assert.match(pickFn, /JSON\.stringify\(\{ events: \{ invite_theme: id, \.\.\.THEME_OWN_LOOK_RESET, \.\.\.\(seed \? \{ role_palette: seed \} : \{\}\) \} \}\)/);
  assert.match(pickFn, /makerSave\(\(\) => hubDraftAction\(eventId, fd\), requestMakerRefresh\)/, 'a pick does not land the Details way');
  // Two click handlers: the pick, and the ⤢ that only LOOKS (it opens the preview, never a pick).
  const clicks = [...src.matchAll(/onClick=\{([^}]*\})?[^}]*\}/g)].map((m) => m[0]);
  assert.equal(clicks.length, 2, clicks.join(' | '));
  assert.ok(clicks.some((c) => /pick\(t\.id\)/.test(c)), 'the entry is not a pick');
  assert.ok(clicks.some((c) => /setPreview\(t\.id\)/.test(c)), 'the ⤢ does something other than open the preview');
  // 💎 No padlock door: a Pro theme is a pick like any other (Apply is the gate).
  assert.doesNotMatch(src, /proHref|data-theme-tile-locked|<Link\b/, 'a Pro theme is a door to the Pro page again');
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

test('4b · rendered on the server, the gallery loads NO page and NO print — and a Pro theme is a pick with ◆ PRO', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MakerThemeGallery, ThemePickProvider } = await import('./maker-theme-picker');
  const html = renderToStaticMarkup(
    React.createElement(
      ThemePickProvider as unknown as React.FC<{ eventId: string; current: string; children?: React.ReactNode }>,
      { eventId: 'e-1', current: 'house' },
      React.createElement(MakerThemeGallery, { themes: TILES, ownsPro: false, storeShell: false, suggested: 'vintage', sampleVersion: null }),
    ),
  );
  assert.match(html, /data-maker-theme-picker/);
  assert.doesNotMatch(html, /<iframe/, 'a frame was written before its entry was seen — ten pages would load at once');
  assert.doesNotMatch(html, /\/api\/hub-print\//, 'a sample print was asked for before its entry was seen');
  assert.equal([...html.matchAll(/data-theme-tile="/g)].length, 3);
  // Classic is the pick; every Pro theme is a pick too — no padlock, never dimmed.
  assert.match(html, /data-theme-tile="house"[\s\S]*?<button[^>]*aria-pressed="true"/);
  assert.equal([...html.matchAll(/data-theme-tile-pick=""/g)].length, 3, 'a Pro theme is not a pick');
  assert.equal([...html.matchAll(/data-paid-mark="try"/g)].length, 2, 'a Pro theme lost its ◆ PRO');
  assert.doesNotMatch(html, /data-paid-mark="locked"|lucide-lock/, 'a padlock on a theme a free couple may try');
  assert.doesNotMatch(html, /opacity-|grayscale/, 'a Pro theme is dimmed');
  // 💡 The suggestion is a label on ONE entry, and picks nothing.
  assert.equal([...html.matchAll(/data-theme-suggested=""/g)].length, 1);
  assert.match(html, /data-theme-tile="vintage"[\s\S]*?Suggested for you/);
  assert.match(html, /data-theme-tile="house"[\s\S]*?aria-pressed="true"/, 'the suggestion moved the pick');
});

test('4c · the app-store shell shows no locked door', () => {
  const shown = (ownsPro: boolean, current: string) =>
    tilesShown(TILES, { ownsPro, storeShell: true, current }).map((t) => t.id);
  assert.deepEqual(shown(false, 'house'), ['house']);
  // A couple already wearing a Pro theme keeps seeing it (saving can never quietly reset it).
  assert.deepEqual(shown(true, 'vintage'), ['house', 'vintage']);
  assert.deepEqual(tilesShown(TILES, { ownsPro: false, storeShell: false, current: 'house' }).length, 3);
});

// ═══ 5 · looking closer never picks, and always comes back ═══════════════════

test('5 · the full-screen preview is an overlay with a way back — Exit preview, Escape, the phone’s back', () => {
  const src = read(OVERLAY);
  assert.match(src, /role="dialog"/);
  assert.match(src, /useModalA11y\(\{ open: true, onClose: exit, containerRef: ref/, 'Escape and focus are not the shared hook’s');
  // One history entry of its own, so the phone's back gesture closes it — and every way out takes it back off.
  assert.match(src, /window\.history\.pushState\(\{ themePreview: theme\.id \}, ''\)/);
  assert.match(src, /window\.addEventListener\('popstate', onPop\)/);
  assert.match(src, /if \(pushed\.current\) window\.history\.back\(\);/);
  // "Exit preview", labelled, a thumb tall, clear of the notch.
  const exitBtn = /<button[\s\S]*?data-theme-preview-exit=""[\s\S]*?<\/button>/.exec(src)?.[0] ?? '';
  assert.match(exitBtn, /onClick=\{exit\}/);
  assert.match(exitBtn, /min-h-11/);
  assert.match(exitBtn, /Exit preview/);
  assert.match(src, /env\(safe-area-inset-top\)/);
  // "Use this theme" is the gallery's own pick — the preview itself sets nothing.
  assert.match(src, /onClick=\{\(\) => \{\s*onUse\(\);\s*exit\(\);\s*\}\}/);
  assert.doesNotMatch(src, /hubDraftAction|makerSave|invite_theme/, 'the preview writes on its own');
  // It shows the SAMPLE, sandboxed.
  assert.match(src, /src=\{sampleHubTileSrc\(theme\.id, samplePalette\)\}/);
  assert.match(src, /sandbox="allow-scripts allow-same-origin"/);
  // …and it is an overlay: the gallery (and its scroll) stays mounted underneath.
  const picker = read(PICKER);
  assert.match(picker, /\{previewTheme \? \(\s*<ThemePreviewOverlay/);
});

// ═══ 6 · ONE theme picker in the Maker ════════════════════════════════════

test('6 · exactly one theme picker in the Maker — one module writes the theme, each face mounted once', async () => {
  const { readdirSync, statSync } = await import('node:fs');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const f = join(dir, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) files.push(f);
    }
  };
  walk(join(APP, 'dashboard'));
  // A theme write is a draft patch naming invite_theme — one file makes it.
  const writers = files.filter((f) => /invite_theme: id/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(writers.map((f) => f.slice(APP.length + 1)), [PICKER], 'a second theme picker writes the theme');
  // Its two faces, each mounted exactly once — on Details.
  const mounts = (re: RegExp) => files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => f.slice(APP.length + 1));
  const DETAILS = 'dashboard/[eventId]/launch/_components/maker-details.tsx';
  assert.deepEqual(mounts(/<MakerThemeGallery\b/), [DETAILS]);
  // …and the dropdown face has ONE second door, by owner ruling: Event Details'
  // Theme row opens THE SAME menu in place (2026-10-04 "YES TO ALL": rows are
  // edited in place; `every-fact-has-one-editor.test.ts`). Still one writer (above).
  const RECORD = 'dashboard/[eventId]/details/_components/record-editor.tsx';
  assert.deepEqual(mounts(/<MakerThemeMenu\b/), [RECORD, DETAILS]);
  assert.equal([...read(RECORD).matchAll(/<MakerThemeMenu\b/g)].length, 1);
  assert.equal([...read(DETAILS).matchAll(/<MakerThemeGallery\b/g)].length, 1);
  assert.equal([...read(DETAILS).matchAll(/<MakerThemeMenu\b/g)].length, 1);
  // The old side-panel rail is gone, not merely unmounted.
  assert.equal(mounts(/MakerThemePicker\b/).length, 0, 'the retired side-panel picker is still in the tree');
});
