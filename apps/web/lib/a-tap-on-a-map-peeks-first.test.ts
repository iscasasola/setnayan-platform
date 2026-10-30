/**
 * 👁 A TAP ON A MAP PEEKS FIRST (R4 slice 6d; owner, Guests prototype v20: *"Tapping a guest on Map / 2D / 3D shows a PEEK
 * card (avatar · name · role · group · seat · Open); Open = the full guest card with Remove / Move-or-swap"*).
 *
 * The PROPERTIES:
 *   1. ONE peek (`GuestPeek`): face · name · one line · Open (the brand step) · ✕ — words wrap, never cut; rendered.
 *   2. Guests › Map: a face tap sets the peek (not the card); the peek rises in the thumb row's seat; Open = `openCard`.
 *   3. Seats › 2D: a face tap with nobody picked peeks (List opens the card at once, as before); Open = the same card
 *      with Remove · Swap; a tap while someone is picked still swaps (the peek leaves).
 *   4. The 3D room is not touched here (view-only, its own builder).
 *
 * SABOTAGE (each seen RED, then restored): the Map's onOpen back to `openCard` · the 2D `setPeekId` dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { GuestPeek } from '@/app/dashboard/[eventId]/guests/_components/guest-peek';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('1 · the peek: face · name · line · Open · ✕, never cut', () => {
  const html = renderToStaticMarkup(
    React.createElement(GuestPeek, { name: 'Atty. Ramon Francisco Dela Cruz-Villanueva', line: 'Ninong · Sponsors · Table 1 · seat 3', initials: 'RD', onOpen: () => {}, onClose: () => {} }),
  );
  assert.match(html, /data-guest-peek=""/);
  assert.match(html, />RD</);
  assert.match(html, /Atty\. Ramon Francisco Dela Cruz-Villanueva/);
  assert.match(html, /Ninong · Sponsors · Table 1 · seat 3/);
  assert.match(html, />Open</);
  assert.match(html, /aria-label="Close"/);
  assert.doesNotMatch(html, /truncate|text-ellipsis/, 'a name is cut');
});

test('2 · Guests › Map: a face peeks; Open is the List’s card', () => {
  const screen = src('app/dashboard/[eventId]/guests/_components/guests-screen.tsx');
  assert.match(screen, /<GuestMapCanvas[\s\S]{0,300}onOpen=\{\(id, el\) => setPeek\(\{ id, el \}\)\}/, 'a Map face opens the card at once');
  assert.match(screen, /\{peek && gview === 'map' && byId\.get\(peek\.id\) \? \(\s*<div className=\{styles\.peekSeat\} data-guests-peek-seat="">/);
  assert.match(screen, /setPeek\(null\);\s*openCard\(g\.guest_id, peek\.el\);/);
});

test('3 · Seats › 2D: a face peeks (List opens the card); a picked guest still swaps', () => {
  const ed = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  const tap = ed.slice(ed.indexOf('const tapFace = (guestId: string) => {'), ed.indexOf('const tapBlank = '));
  assert.match(tap, /if \(pickedId && pickedId !== guestId\) \{\s*setPeekId\(null\);/);
  assert.match(tap, /if \(view !== 'list' && !in3d\) \{\s*setPeekId\(g\.guest_id\);\s*return;\s*\}/, 'a 2D face opens the card at once');
  assert.match(ed, /setPeekId\(null\);\s*setFaceCard\(\{ id: peekGuest\.guest_id,/, 'Open is not the shipped card');
  assert.match(ed, /\{seatPop \?\? peekPop\}/);
});
