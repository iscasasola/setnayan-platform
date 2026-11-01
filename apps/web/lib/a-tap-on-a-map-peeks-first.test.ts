/**
 * 👁 A TAP ON THE GUESTS MAP PEEKS FIRST (R4 slice 6d; owner, Guests prototype v20: *"Tapping a guest on Map / 2D / 3D
 * shows a PEEK card (avatar · name · role · group · seat · Open); Open = the full guest card with Remove / Move-or-swap"*).
 * ✂ 2D NO LONGER PEEKS — owner 2026-11-01, DECISION_LOG "SEATS 2D IS THE ROOM, LIST IS THE PEOPLE": 2D is for moving
 * tables; guest editing lives in Seats › List. The 2D face's own new behaviour (a tap does nothing) is built with item S1.
 *
 * The PROPERTIES:
 *   1. ONE peek (`GuestPeek`): face · name · one line · Open (the brand step) · ✕ — words wrap, never cut; rendered.
 *   2. Guests › Map: a face tap sets the peek (not the card); the peek rises in the thumb row's seat; Open = `openCard`.
 *   3. Seats › 2D does NOT peek: no peek is drawn by the seat plan (the 2026-11-01 ruling above).
 *   4. The 3D room is not touched here (view-only, its own builder).
 *
 * SABOTAGE (each seen RED, then restored): the Map's onOpen back to `openCard` · the 2D peek put back.
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

test('3 · Seats › 2D does not peek — 2D is the room, the List is the people (2026-11-01)', () => {
  const ed = src('app/dashboard/[eventId]/seating/_components/seating-editor.tsx');
  assert.doesNotMatch(ed, /\bGuestPeek\b|\bsetPeekId\b|\bpeekPop\b/, 'the seat plan draws a guest peek again — 2D is for moving tables');
});
