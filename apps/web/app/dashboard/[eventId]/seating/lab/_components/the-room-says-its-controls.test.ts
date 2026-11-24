/**
 * the-room-says-its-controls.test.ts — THE 3D ROOM'S CONTROLS HAVE WORDS, AND ITS LOCK EXPLAINS ITSELF (owner
 * 2026-11-20, "Yes, your picks"; drawing § 6).
 *
 *   1 · ONE ROW OF THREE, THE SAME SIZE: Walk in · Accents · View only — each an icon and its word. ▶ is "Walk in".
 *       "View only" reads "Editing" while this person holds the seat plan's edit.
 *   2 · THE LOCK EXPLAINS ITSELF: "<Name> is editing" and "Take over" — the seat plan's OWN take-over (`lock.acquire`),
 *       handed down through `SeatRoomLinkContext`; the room itself still takes no lock (`room-is-view-only.test.ts`).
 *       A press that did not take it says so.
 *   3 · SEARCH WALKS TO A SEAT: in Guests the thumb row's search, Entered on 3D, walks the first seated guest found to
 *       their seat — the room's own Guide me — so Guide me leaves the row there; a room drawn on its own keeps it.
 *
 * Sabotage (each goes red): an icon without its word · a fourth control in Guests' row · "View only" while holding the
 * edit · a "Take over" of the room's own · the search ignored on 3D · Guide me dropped from a room drawn on its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { RoomLockLine, RoomViewTools, type RoomViewToolsProps } from './room-view-tools';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => stripComments(readFileSync(join(HERE, f), 'utf8'));
const ROOM = read('seating-lab-3d.tsx');
const EDITOR = stripComments(readFileSync(join(HERE, '..', '..', '_components', 'seating-editor.tsx'), 'utf8'));
const noop = () => {};

const base: RoomViewToolsProps = {
  playing: false,
  onPlay: noop,
  walking: false,
  onWalk: noop,
  crowdActive: false,
  canWalkEveryone: true,
  onWalkEveryone: noop,
  onClearCrowd: noop,
  guide: { options: [], onPick: noop, active: null },
  dancingCount: 0,
  onClearFloor: noop,
  sayHi: null,
  showCloth: true,
  showAccents: true,
  onShowCloth: noop,
  onShowAccents: noop,
  paletteKey: 'a',
  palettes: [{ key: 'a', label: 'Warm' }],
  onPalette: noop,
  onAccents: noop,
  onShow2d: noop,
  about: null,
};
/** The main row's controls, in order, as [word, class]. */
const mainRow = (p: Partial<RoomViewToolsProps>) => {
  const html = renderToStaticMarkup(createElement(RoomViewTools, { ...base, ...p }));
  const row = html.slice(html.indexOf('data-room-tools-row=""'));
  return [...row.matchAll(/<button[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => [m[2]!.replace(/<[^>]+>/g, '').trim(), m[1]!] as const);
};

test('1 · one row of three, the same size, each with its word: Walk in · Accents · View only', () => {
  const lock = { holding: false, holder: 'Jose', waiting: false, onTakeOver: noop };
  const row = mainRow({ guideInSearch: true, lock });
  assert.deepEqual(row.map(([w]) => w), ['Walk in', 'Accents', 'View only'], 'the row is not Walk in · Accents · View only');
  const sizes = new Set(row.map(([, c]) => c));
  assert.equal(sizes.size, 1, 'the three are not the same size');
  assert.match([...sizes][0]!, /\bh-11\b/, 'a control is under 44 px');
  assert.match([...sizes][0]!, /\bflex-1 basis-0\b/, 'the three do not share the row equally');
  // While it plays, ▶ says Stop — and the walks keep their words on the line above, never icon-only.
  const playing = renderToStaticMarkup(createElement(RoomViewTools, { ...base, guideInSearch: true, playing: true }));
  assert.match(playing, />Stop<\/button>/);
  assert.match(playing, /Walk around<\/button>/);
  assert.match(playing, /Walk everyone in<\/button>/);
  assert.doesNotMatch(playing, /aria-label="(?:Play|Walk around|Walk everyone in|Accents)"/, 'a control is an icon with no word again');
  // Holding the edit, "View only" reads "Editing".
  assert.equal(mainRow({ guideInSearch: true, lock: { ...lock, holding: true, holder: null } }).at(-1)![0], 'Editing');
});

test('2 · the lock explains itself — "<Name> is editing" and the seat plan’s own "Take over"', () => {
  const line = (lock: { holding: boolean; holder: string | null; waiting: boolean }, tried = false) =>
    renderToStaticMarkup(createElement(RoomLockLine, { lock: { ...lock, onTakeOver: noop }, tried, onTakeOver: noop }));
  const theirs = line({ holding: false, holder: 'Jose', waiting: false });
  assert.match(theirs, /Jose is editing/);
  assert.match(theirs, /Take over to change seats\./);
  assert.match(theirs, /data-room-take-over=""/);
  assert.match(theirs, />Take over</);
  assert.match(line({ holding: false, holder: 'Jose', waiting: false }, true), /Still theirs\. Take over works once they stop\./, 'a press that did not take it looks like nothing happened');
  assert.match(line({ holding: false, holder: null, waiting: false }), /Someone is editing/);
  const mine = line({ holding: true, holder: null, waiting: false });
  assert.match(mine, /You are editing\./);
  assert.doesNotMatch(mine, /Take over/);

  // The take-over is the PLAN's (`lock.acquire`, its one lock), handed to the room; the room takes no lock of its own.
  assert.match(EDITOR, /lock: floorWrites \? null : \{ holding: canEdit, holder: roomHolder, waiting: lock\.status === 'acquiring', onTakeOver: lock\.acquire \},/);
  assert.match(EDITOR, /const roomHolder = canEdit \? null : lockHolderPeer\?\.lockHolderLabel \?\? lock\.holderLabel;/, 'the card does not name who holds it');
  assert.match(EDITOR, /<SeatRoomLinkContext\.Provider value=\{inGuests \? roomLink : null\}>\{details\.lab\}<\/SeatRoomLinkContext\.Provider>/);
  assert.match(ROOM, /lock=\{roomLink\?\.lock \?\? null\}/);
  assert.doesNotMatch(ROOM + read('room-view-tools.tsx'), /useSeatingLock|lock\.acquire/, 'the room takes a lock of its own');
});

test('3 · in Guests the search walks a guest to their seat, and Guide me leaves the row; on its own the room keeps it', () => {
  const find = EDITOR.slice(EDITOR.indexOf('const goToFound = (words: string) => {'), EDITOR.indexOf("if (view === 'list') {", EDITOR.indexOf('const goToFound')));
  assert.match(find, /if \(in3d\) \{\s*const seated = guests\.find\(\(x\) => hits\.has\(x\.guest_id\) && x\.seated_table_id\);\s*if \(seated\) setRoomGuide\(\(c\) => \(\{ guestId: seated\.guest_id, at: \(c\?\.at \?\? 0\) \+ 1 \}\)\);/, 'the search does nothing on 3D');
  const walk = ROOM.slice(ROOM.indexOf('const guideAsk = roomLink?.guide ?? null;'), ROOM.indexOf('const guideOptions = useMemo('));
  assert.match(walk, /if \(guideTo\(guideAsk\.guestId\)\) guidedAt\.current = guideAsk\.at;/, 'the room does not walk the searched guest with its own Guide me');
  assert.match(ROOM, /guideInSearch=\{roomLink !== null\}/);
  assert.equal(mainRow({ guideInSearch: true }).length, 3, 'Guests’ row is not three');
  const alone = renderToStaticMarkup(createElement(RoomViewTools, { ...base }));
  assert.match(alone, /aria-label="Guide me to a seat: [^"]*"/, 'a room on its own lost Guide me');
  assert.match(alone, /data-room-guide=""[^>]*>[\s\S]*?Guide me<\/button>/, 'Guide me has no word');
});
