/**
 * 📐 EVERY HOUSE SHEET OPENS AT HALF ON A PHONE (Piece 3c · prototype `Build_Files_Hub_Forms_2026-11-12` legend row 138,
 * approved 2026-11-12): the shared `Sheet` (`app/_components/sheet.tsx`) opens at about half the phone, scrolls inside
 * itself, a drag up on its handle grows it to the max (100dvh − 48px), a drag down from the max returns to half and a
 * drag down past the half closes it. A short sheet is only as tall as its content — the rest is a MAX-height, never a
 * height. A `full` sheet IS the screen and is untouched; the tablet/desktop drawer is untouched (phone-only classes).
 *
 * Held on the RENDER (a sheet open at mount draws in place for its first frame, so static markup is the real panel).
 * (The Maker's canvas sheet is its own mechanism — `lib/a-phone-sheet-opens-at-half.test.ts` — and is not this.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');

async function draw(props: Record<string, unknown> = {}): Promise<string> {
  const { Sheet } = await import('../app/_components/sheet');
  return renderToStaticMarkup(
    React.createElement(
      Sheet,
      { open: true, onClose: () => {}, labelledById: 'h', ...props },
      React.createElement('h2', { id: 'h' }, 'Pick a service'),
    ),
  );
}
const panelOf = (html: string) => {
  const tag = /<div\b[^>]*data-sheet-panel=""[^>]*>/.exec(html)?.[0];
  assert.ok(tag, 'the sheet drew no panel');
  return { tag, classes: /\bclass="([^"]*)"/.exec(tag)?.[1] ?? '' };
};

test('a house sheet opens at HALF on a phone — a max-height, so a short one is only as tall as its content', async () => {
  const { tag, classes } = panelOf(await draw());
  assert.match(tag, /data-sheet-snap="half"/, 'the sheet does not open at half');
  assert.match(classes, /max-(lg|tab):max-h-\[52dvh\]/, 'the phone half is not a max-height');
  assert.doesNotMatch(classes, /max-(lg|tab):h-\[52dvh\]/, 'a fixed height would stretch a short sheet');
  assert.doesNotMatch(classes, /max-h-\[calc\(100dvh-48px\)\]/, 'the sheet opens dragged up — the taller size is the person’s drag');
  assert.match(await draw(), /data-sheet-handle=""/, 'no handle to drag it up');
});

test('a `full` sheet is the screen — no half, no handle', async () => {
  const html = await draw({ full: true });
  const { tag } = panelOf(html);
  assert.doesNotMatch(tag, /data-sheet-snap=/);
  assert.doesNotMatch(html, /data-sheet-handle=/);
});

test('the drag: up grows to the max, down from the max returns to half, down past the half closes', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/_components/sheet.tsx'), 'utf8'));
  assert.match(src, /if \(dy < -40\) setSnap\('max'\);/);
  assert.match(src, /if \(snap === 'max'\) setSnap\('half'\);\s*else close\(\);/, 'a drag down past the half no longer closes');
  assert.match(src, /if \(open\) setSnap\('half'\);/, 'a reopened sheet keeps its old size instead of opening at half');
  // Phone-only: the drawer above the boundary keeps its own height.
  assert.match(src, /half: 'max-lg:max-h-\[52dvh\]'/);
  assert.match(src, /half: 'max-tab:max-h-\[52dvh\]'/);
});
