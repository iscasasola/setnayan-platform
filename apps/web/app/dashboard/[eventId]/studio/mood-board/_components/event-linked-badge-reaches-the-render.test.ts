/**
 * event-linked-badge-reaches-the-render.test.ts — "A Setnayan celebration"
 * REACHES A PIXEL, on the RIGHT ROW, not just a variable (MB22).
 *
 * ── PRESENCE-OF-INK IS NOT FIT-OF-INK ───────────────────────────────────────
 * MB20's sharpest finding in this arc: hard-coding the watermark variant
 * passed all 35 pixel guards while every celebration silently lost its seal.
 * A guard that only proves "a badge renders somewhere" would pass exactly the
 * same way if the picker badged every row, or none. So this file proves two
 * separate things and neither one alone is the guard:
 *
 *   1. THE RENDER is real — `<EventLinkedBadge>` is painted with
 *      renderToStaticMarkup for both `show: true` and `show: false`, and the
 *      actual copy is read out of the HTML.
 *   2. THE MOUNT is pinned by source, inside the picker's per-asset `.map`,
 *      and it must read `asset.isEventLinked` — never a literal `true` or
 *      `false` — so hard-coding it (which would badge every row alike,
 *      event-linked and back-catalogue in the same result set) is red.
 *
 * SABOTAGE PERFORMED AND UNDONE DURING VERIFICATION — see the session report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const PICKER = path.join(HERE, 'gallery-picker.tsx');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function windowOf(src: string, from: string, until: RegExp): string {
  const start = src.indexOf(from);
  assert.notEqual(start, -1, `anchor missing from source: ${from}`);
  const rest = src.slice(start + from.length);
  const m = rest.match(until);
  return from + (m && m.index !== undefined ? rest.slice(0, m.index) : rest);
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

async function paint(show: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventLinkedBadge } = await import('./event-linked-badge');
  return renderToStaticMarkup(React.createElement(EventLinkedBadge, { show }));
}

/* ── 1 · THE RENDER ───────────────────────────────────────────────────── */

test('⭐ THE GUARD · an event-linked row paints the real sentence', async () => {
  const html = await paint(true);
  assert.match(html, /A Setnayan celebration/);
});

test('⭐ THE GUARD · a back-catalogue row paints NOTHING — no badge on every card', async () => {
  assert.equal(await paint(false), '');
});

/* ── 2 · THE MOUNT, inside the per-asset map and driven by the row ─────── */

test('⭐ THE GUARD · the picker mounts the badge from asset.isEventLinked, per row', () => {
  const src = read(PICKER);
  const cardMap = windowOf(src, 'assets.map((asset) => {', /\n      {\/\* Rows we fetched/);

  assert.equal(
    count(cardMap, '<EventLinkedBadge'),
    1,
    'exactly one mount inside the per-asset card',
  );
  assert.match(
    cardMap,
    /<EventLinkedBadge show=\{asset\.isEventLinked\} \/>/,
    'the flag must come from THIS row — a literal true/false here is the defect ' +
      '(MB20’s lesson: a hard-coded variant passed every pixel guard while every ' +
      'celebration silently lost its mark)',
  );
  assert.doesNotMatch(
    cardMap,
    /<EventLinkedBadge show=\{(true|false)\}/,
    'a hard-coded show value would badge every row identically — event-linked ' +
      'and back-catalogue alike — and still pass a render test that never checks WHICH row',
  );
  assert.equal(
    count(src, '<EventLinkedBadge'),
    1,
    'the whole file mounts it once — a second mount elsewhere would hide a deleted one',
  );
  assert.match(src, /from '\.\/event-linked-badge'/);
});
