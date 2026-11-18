/**
 * the-seat-tray-never-covers-the-zoom.test.ts — THE "TO SEAT" TRAY LEAVES ROOM FOR ITSELF, AND SAYS WHAT IS TRUE
 * (regression from #7906, "the seat plan is drag-first on a phone"; a walker at 390x844 on Guests › Seats › 2D).
 *
 *   1 · THE TRAY RESERVES ITS HEIGHT — it is drawn over the thumb row in the row's own fixed host, but only the row
 *       published `--sn-thumb-room`, so the zoom stack (which stands on that token) sat UNDER the tray: elementFromPoint
 *       on Zoom in / Zoom out hit a face. The tray now publishes its own covered height through the ONE mechanism
 *       (`useThumbRoom`, lib/thumb-room.ts), and the zoom stack still stands on the token.
 *   2 · THE EMPTY FLOOR'S STEPS STAY IN SIGHT — "Lay out your floor" (and its "Build my seating draft" step) was
 *       centred on the whole floor, its foot under the tray; in Guests it is centred between the pinned row
 *       (`--gs-stick-h`) and the thumb room, and on a phone it keeps clear of the zoom column.
 *   3 · NO "DRAG IT TO A CHAIR" WITH NO CHAIR — with 0 tables the tray says there are no tables yet and points at the
 *       screen's own steps ("Build my seating draft", "Add your first table"); the editor passes the real count.
 *
 * Sabotage (each goes red): drop `useThumbRoom(trayRef)` · drop the overlay's thumb-room padding · pass
 * `hasTables` as a constant · put the chair line back for an empty floor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', '_components');
const code = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));

test('1 · the tray publishes its own room, and the zoom stack stands on it', () => {
  const tray = code('seat-face-tray.tsx');
  assert.match(tray, /import \{ useThumbRoom \} from '@\/lib\/thumb-room';/, 'the tray does not use the one thumb-room mechanism');
  assert.match(tray, /useThumbRoom\(trayRef\);/, 'the tray does not reserve its height — the zoom stack sits under it');
  assert.match(tray, /<div ref=\{trayRef\}/, 'the measured element is not the tray');
  const ed = code('seating-editor.tsx');
  const zoom = ed.slice(ed.indexOf('const zoomStack = '), ed.indexOf('const studioPeople = '));
  assert.ok(zoom.length > 0, 'zoomStack is gone');
  assert.match(zoom, /bottom: 'max\(0\.75rem, calc\(var\(--sn-thumb-room, 0px\) - var\(--sn-bottomdock-h, 0px\)\)\)'/);
});

test('2 · the empty floor’s steps sit between the pinned row and the thumb room, clear of the zoom column', () => {
  const ed = code('seating-editor.tsx');
  const at = ed.indexOf('{tables.length === 0 ? (');
  assert.ok(at > 0, 'the empty-floor card is gone');
  const overlay = ed.slice(at, ed.indexOf('starterDraftHint(', at));
  assert.match(overlay, /paddingTop: 'calc\(var\(--gs-stick-h, 0px\) \+ 1\.5rem\)'/, 'the card runs under the pinned row');
  assert.match(overlay, /paddingBottom: 'max\(1\.5rem, calc\(var\(--sn-thumb-room, 0px\) - var\(--sn-bottomdock-h, 0px\)\)\)'/, 'the card runs under the tray and the thumb row');
  assert.match(overlay, /paddingRight: isPhone \?/, 'on a phone the card runs under the zoom column');
});

test('3 · with no tables the tray never says "drag it to a chair"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SeatFaceTray } = await import('./seat-face-tray');
  const noop = () => {};
  const faces = [{ id: 'g1', name: 'Tess Lim', initials: 'TL', photo: null }];
  const base = { faces, groups: [], canEdit: true, onTapFace: noop, onMore: noop, onDrop: noop, onPan: noop };
  const bare = renderToStaticMarkup(React.createElement(SeatFaceTray, { ...base, hasTables: false }));
  assert.doesNotMatch(bare, /chair/i, 'an empty floor is told to drag to a chair');
  assert.match(bare, /No tables yet/);
  assert.match(bare, /Build my seating draft/);
  assert.match(bare, /Add your first table/);
  const laid = renderToStaticMarkup(React.createElement(SeatFaceTray, { ...base, hasTables: true }));
  assert.match(laid, /Press and hold a face, then drag it to a chair\. Or tap · move\./);
  const ed = code('seating-editor.tsx');
  assert.match(ed, /<SeatFaceTray[\s\S]*?hasTables=\{tables\.length > 0\}[\s\S]*?\/>/, 'the editor does not pass the real table count');
});
