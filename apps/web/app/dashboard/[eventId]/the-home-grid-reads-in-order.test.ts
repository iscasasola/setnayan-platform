/**
 * GUARD — HOME'S DESKTOP GRID IS READ IN THE ORDER IT IS SEEN.
 *
 * Owner 2026-10-23, "shouldn't home, guests and suppliers maximize the width as well?" → yes. From 1024 Home's top
 * splits into two columns (`globals.css`, "HOME AT FULL WIDTH, TWO COLUMNS"). A CSS grid can draw a piece anywhere,
 * but a screen reader and the Tab key still follow the page's own order. So a piece placed above one that comes
 * before it in the page reads out of order. Review of #6858: the three doors and the one QR, which come early in
 * the page, were drawn under the split.
 *
 * The property:
 *   1. Every top piece of Home's column has an explicit place (a column and a row) from 1024. None is left to
 *      auto-placement.
 *   2. Read column by column (the left column top to bottom, then the right, then the full-width rows), the places
 *      give exactly the page's order of those pieces in `home-first-screen.tsx`.
 *   3. The grid exists only from 1024, so the phone and the tablet keep their one flex column.
 *
 * Sabotage (2026-10-23): What's next back to `grid-column: 1; grid-row: 2` (2 red); the doors' rule removed (1 red);
 * the grid rule moved out of its media query (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const CSS = read('app/globals.css');
const HOME = read('app/dashboard/[eventId]/_components/home-first-screen.tsx');
const PARTS = read('app/dashboard/[eventId]/_components/home-parts.tsx');

/** The top pieces, each with the source token that places it in the page and the marker its root wears. */
const PIECES: Array<{ marker: string; token: RegExp }> = [
  { marker: 'data-home-next', token: /marker="data-home-next"/ },
  // (Home's three door pills came off, owner 2026-10-23 — `the-home-leads-with-one-next.test.ts` b holds that.)
  { marker: 'data-home-one-qr', token: /data-home-one-qr=""/ },
  { marker: 'data-home-numbers', token: /data-home-numbers\b/ },
  { marker: 'data-home-money', token: /data-home-money\b/ },
  { marker: 'data-home-whats-next', token: /\{whatsNext \?\?/ },
];

/** The ≥1024 block that holds Home's grid. */
function deskBlock(): string {
  const at = CSS.search(/@media \(min-width: 1024px\) \{\s*\[data-home-column\] \{/);
  assert.ok(at >= 0, 'Home has no desktop grid block');
  const end = CSS.indexOf('\n}\n', at);
  return CSS.slice(at, end);
}

function placeOf(block: string, marker: string): { col: string; row: number } | null {
  const m = new RegExp(`\\[data-home-column\\] > \\[${marker}\\] \\{\\s*grid-column:\\s*([^;]+);\\s*grid-row:\\s*(\\d+);\\s*\\}`).exec(block);
  return m ? { col: m[1]!.trim(), row: Number(m[2]) } : null;
}

test('1 · every top piece of Home has an explicit place from 1024', () => {
  const block = deskBlock();
  for (const p of PIECES) assert.ok(placeOf(block, p.marker), `${p.marker} is left to auto-placement — it lands wherever the grid finds room`);
  // The markers are on the pieces' ROOTS (a grid places only its direct children).
  assert.match(PARTS, /<div className=\{`home-sec\$\{open \? ' open' : ''\}`\} data-home-whats-next="">/, 'What’s next’s root lost its marker');
});

test('2 · read column by column, the places are the page’s own order', () => {
  const block = deskBlock();
  const pageOrder = [...PIECES].sort((a, b) => HOME.search(a.token) - HOME.search(b.token)).map((p) => p.marker);
  for (const p of PIECES) assert.ok(HOME.search(p.token) >= 0, `${p.marker}: not found in home-first-screen.tsx`);
  const key = (m: string) => {
    const at = placeOf(block, m)!;
    const span = at.col === '1 / -1';
    return [span ? 1 : 0, span ? at.row : Number(at.col), at.row];
  };
  const seen = [...pageOrder].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!;
  });
  assert.deepEqual(seen, pageOrder, 'the grid draws a piece before one that comes earlier in the page — Tab and a screen reader jump');
  // …and the full-width rows sit below every split row.
  const splitRows = pageOrder.filter((m) => placeOf(block, m)!.col !== '1 / -1').map((m) => placeOf(block, m)!.row);
  const spanRows = pageOrder.filter((m) => placeOf(block, m)!.col === '1 / -1').map((m) => placeOf(block, m)!.row);
  for (const r of spanRows) assert.ok(r > Math.max(...splitRows), `a full-width row (${r}) is drawn inside the split`);
  // Everything after the top pieces (Your services, Switch on more) is auto-placed after them, in page order.
  const last = Math.max(...PIECES.map((p) => HOME.search(p.token)));
  assert.ok(HOME.search(/<YourServices\b/) > last, 'Your services comes before a placed piece in the page');
});

test('3 · the grid exists only from 1024 — the phone and tablet keep one flex column', () => {
  const outside = CSS.replace(deskBlock(), '');
  assert.doesNotMatch(outside, /\[data-home-column\]\s*\{[^}]*display:\s*grid/, 'Home is a grid below 1024');
  assert.doesNotMatch(outside, /\[data-home-column\] > \[data-home-[a-z-]+\]\s*\{[^}]*grid-(column|row)/, 'a Home piece is placed below 1024');
});
