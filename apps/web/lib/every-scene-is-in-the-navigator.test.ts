/**
 * every-scene-is-in-the-navigator.test.ts — owner 2026-09-27, verbatim, on his
 * own page: *"i still cannot edit. the editing body page is not working at
 * all. navigation still does not show the scenes and allow the scenes to be
 * edited on the editing screen."*
 *
 * Measured on production (cale-ice, Maker → Invitation): the navigator's Home
 * tab listed ONE scene while the canvas beside it drew ten; every other scene
 * hid behind a tab. And tapping the names on the canvas opened the Hero
 * workspace, which REPLACES the stage. This holds the three things he asked for:
 *
 *   1. the navigator lists every scene the canvas binds, in canvas order — the
 *      tabs are headers between groups, never a filter;
 *   2. a navigator tap sets the selection, and that selection opens a panel
 *      that is never blank;
 *   3. a canvas tap sets the SAME selection (one selection, both highlights).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { navigatorRows, navigatorTabs, type NavigatorBarItem } from './maker-navigator-tabs';
import { makerStageList, MAKER_FIXED_LABEL, type MakerFixedKey, type MakerStageInput, type MakerTile } from './maker-scene-list';
import {
  canvasKeyOfSelection,
  fixedScenePanel,
  selectionForCanvasKey,
  selectionForTile,
  tileIsSelected,
} from './maker-selection';
import { drawnMakerOrder } from '../app/[slug]/_components/editor-bridge';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';

const WEB = join(__dirname, '..');
const SHELL = stripComments(
  readFileSync(join(WEB, 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'),
);

/* The owner's Invitation: names and date, six sections, the entourage. */
const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map',
  'dress_code', 'photo_moments', 'your_photos', 'tier_comparison', 'special_message',
  'what_to_bring', 'our_photos', 'our_love_story',
];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const PAGE: MakerStageInput = {
  stage: 'rsvp',
  widgets,
  openBrowse: false,
  content: { schedule: true, venue_map: true, our_love_story: true, our_photos: true, special_message: true, what_to_bring: true, countdown: true },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: true,
};
const INVITATION_BAR: NavigatorBarItem[] = [
  { key: 'home', label: 'Home', href: '#home', state: 'live' },
  { key: 'details', label: 'Details', href: '#details', state: 'live' },
  { key: 'rsvp', label: 'RSVP', href: '/x/invite/reply', state: 'live' },
  { key: 'story', label: 'Story', href: '#story', state: 'live' },
  { key: 'me', label: 'Me', href: '#me', state: 'live' },
];

/* ── A canvas, as the bridge reads it ─────────────────────────────────────
   `drawnMakerOrder` walks the canvas's hidden `[data-maker-section]` markers
   (each stands before its section) plus `#site-entourage` / `#site-story`.
   A minimal stand-in for the iframe's document, drawn from the stage's tiles. */
type FakeEl = {
  id: string;
  attrs: Record<string, string>;
  nextElementSibling: FakeEl | null;
  offsetHeight: number;
  hasAttribute(n: string): boolean;
  getAttribute(n: string): string | null;
  getBoundingClientRect(): { height: number };
};
function el(attrs: Record<string, string>, id = ''): FakeEl {
  return {
    id,
    attrs,
    nextElementSibling: null,
    offsetHeight: 40,
    hasAttribute: (n) => n in attrs,
    getAttribute: (n) => attrs[n] ?? null,
    getBoundingClientRect: () => ({ height: 40 }),
  };
}
function canvasFor(tiles: readonly MakerTile[]): Document {
  const nodes: FakeEl[] = [];
  for (const t of tiles) {
    if (t.key === 'f:entourage') nodes.push(el({}, 'site-entourage'));
    else if (t.key === 'f:story') nodes.push(el({}, 'site-story'));
    else {
      const marker = el({ 'data-maker-section': t.key });
      marker.nextElementSibling = el({});
      nodes.push(marker);
    }
  }
  return { querySelectorAll: () => nodes } as unknown as Document;
}

const invitationTiles = () => makerStageList(PAGE).shown;

test('⭐ precondition: the Invitation fixture draws several scenes across several tabs', () => {
  const tiles = invitationTiles();
  const tabs = navigatorTabs(INVITATION_BAR, tiles.map((t) => t.key));
  assert.ok(tiles.length >= 8, `expected the owner-shaped page to draw 8+ scenes, got ${tiles.length}`);
  const withScenes = tabs.filter((t) => t.tiles.length > 0).map((t) => t.label);
  assert.ok(withScenes.length >= 3, `scenes must span tabs for this test to mean anything: ${withScenes.join(', ')}`);
});

test('1 · the navigator lists EVERY scene the canvas binds, in canvas order', () => {
  const tiles = invitationTiles();
  const bound = drawnMakerOrder(canvasFor(tiles));
  const keys = tiles.map((t) => t.key);
  const tabs = navigatorTabs(INVITATION_BAR, keys);
  const rows = navigatorRows(tabs, keys);
  console.log(`  canvas binds ${bound.length} · navigator lists ${rows.length}`);
  assert.equal(rows.length, bound.length, 'the navigator must list as many scenes as the canvas binds');
  assert.deepEqual(rows.map((r) => r.key), bound, 'in the canvas order');
  // the tabs are HEADERS: each tab that holds scenes heads its first one, once
  const headers = rows.filter((r) => r.header).map((r) => r.header!.label);
  assert.deepEqual(headers, tabs.filter((t) => t.tiles.length > 0).map((t) => t.label));
});

test('1 · SOURCE: the shell draws every row — no tab filter survives', () => {
  assert.match(SHELL, /const navRows = navigatorRows\(tabs, list\.shown\.map\(\(t\) => t\.key\)\);/);
  const loop = SHELL.slice(SHELL.indexOf('{list.shown.map((tile, i) => {'), SHELL.indexOf('data-maker-tile={tile.key}'));
  assert.ok(loop.length > 0, 'the navigator loop moved — re-anchor this test');
  assert.doesNotMatch(loop, /return null/, 'a tile the loop skips is a scene the couple cannot reach');
  assert.match(loop, /navRows\[i\]\?\.header/, 'the tab header is drawn from navigatorRows');
});

test('2 · a navigator tap sets the selection, and every selection opens a panel that is never blank', () => {
  for (const tile of invitationTiles()) {
    const sel = selectionForTile(tile);
    assert.ok(sel, `${tile.key}: a tap selects nothing`);
    assert.equal(tileIsSelected(tile, sel), true, `${tile.key}: the tapped tile is not highlighted`);
    if (tile.kind === 'fixed') {
      // a fixed scene opens its OWN panel beside the stage — never a workspace that replaces it
      assert.deepEqual(sel, { kind: 'row', key: tile.key });
    }
  }
  for (const k of Object.keys(MAKER_FIXED_LABEL) as MakerFixedKey[]) {
    const p = fixedScenePanel(k);
    assert.ok(p.line.trim().length > 0, `${k}: the panel has no line`);
    assert.ok(p.tool || p.source, `${k}: the panel offers neither a workspace nor where its content comes from`);
  }
  // SOURCE: the tile's tap goes through the one mapper, and the inspector draws the fixed panel
  assert.match(SHELL, /select\?\.\(selectionForTile\(tile\)\);/);
  assert.match(SHELL, /selection\.kind === 'row' && fixedOfKey\(selection\.key\)/);
  assert.match(SHELL, /data-maker-fixed-panel=\{fixed\}/);
});

test('3 · a canvas tap sets the SAME selection as the navigator tile', () => {
  const tiles = invitationTiles();
  const scenes = tiles.flatMap((t) => (t.kind === 'scene' ? [{ id: t.widgetId, type: t.type }] : []));
  for (const tile of tiles) {
    if (tile.kind === 'post-event') continue;
    const fromCanvas = selectionForCanvasKey(tile.key, scenes);
    assert.deepEqual(fromCanvas, selectionForTile(tile), `${tile.key}: canvas and navigator disagree`);
    assert.equal(canvasKeyOfSelection(fromCanvas, scenes), tile.key, `${tile.key}: the canvas cannot scroll back to it`);
  }
  // SOURCE: the canvas's message handler maps through the same function
  assert.match(SHELL, /const picked = selectionForCanvasKey\(data\.key, scenes\);/);
  assert.doesNotMatch(SHELL, /select\?\.\(\{ kind: 'tool', key: tool \}\)/, 'a canvas tap must not open a workspace in place of the stage');
});

test('3 · the navigator keeps the selected tile in view, whichever side picked it', () => {
  assert.match(SHELL, /\[data-maker-tile="\$\{CSS\.escape\(selectedTileKey\)\}"\]/);
});
