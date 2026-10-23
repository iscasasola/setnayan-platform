/**
 * GUARD — ONE BODY COLUMN: a page's thumb row sits under its body, same left edge, same width.
 *
 * Owner 2026-10-23, on the live desktop Suppliers page: *"bottom search bar is misaligned"* — and, on the same day,
 * *"shouldn't home, guests and suppliers maximize the width as well?"* → yes (prototype
 * `home_service_widgets_2026-10-23.html` D4/D5). The Find thumb row was `position: fixed`, anchored to the VIEWPORT'S
 * right (`right-[1.75rem] w-[min(720px,100vw−128px)]`) while the body was a centred 64-rem stage holding an 820-px
 * list: three widths, three left edges.
 *
 * The property, held for every bottom-pinned row of the three pages (Guests' dock, Suppliers' Find row, Build's bar):
 *   1. From 1024 its horizontal edges come from the COLUMN'S MEASURED EDGES (`followColumn`'s variables) — never a
 *      viewport constant. Below 1024 nothing is written, so each `var(…, fallback)` is its tablet place, unchanged.
 *   2. The column hands `followColumn` itself (the section carrying the width), from 1024 only, with the names the
 *      rows read.
 *   3. `followColumn` writes the column's edges onto the element it is told to (the document root, where a row
 *      portaled into <body> can read them), and takes them off again when the page leaves.
 *
 * Sabotage (2026-10-23): the Find row back to `tab:right-[max(1.75rem,…)] tab:w-[min(720px,calc(100vw-128px))]`
 * (1 red); its width without the column variable (1 red); the takeover's `followColumn` call removed, or the
 * `matchMedia` gate opened to every width (2 red); the target's cleanup removed (3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { followColumn } from '../../guests/_components/dock-follows-column';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

/** The className of the element carrying `marker`, as written in the source. */
function classOf(src: string, marker: string): string {
  const at = src.indexOf(marker);
  assert.ok(at >= 0, `${marker} is gone`);
  const m = /className=\{?`([^`]*)`|className="([^"]*)"/.exec(src.slice(at, at + 1600));
  assert.ok(m, `${marker} has no className`);
  return (m[1] ?? m[2])!;
}

/** Every horizontal anchor a row takes from 701 / 1024 up. */
const desktopAnchors = (cls: string) => [...cls.matchAll(/\b(?:tab|lg):(left|right|w|inset-x)-(\[[^\]\s]*\]|\S+)/g)].map((m) => ({ side: m[1]!, value: m[2]! }));

const ROWS: Array<{ name: string; file: string; marker: string; spans: boolean }> = [
  { name: 'Suppliers · Find thumb row', file: 'find-thumb-row.tsx', marker: 'data-find-thumb=""', spans: true },
  { name: 'Suppliers · Build bar', file: 'build-body.tsx', marker: 'data-build-bar=""', spans: false },
];

const TABLET = { left: 'auto', right: 'max(1.75rem,var(--sn-safe-r))', w: 'min(720px,calc(100vw-128px))' };

test('1 · from 1024 every bottom row takes its edges from the column; below it, its tablet place is unchanged', () => {
  for (const row of ROWS) {
    const anchors = desktopAnchors(classOf(read(row.file), row.marker));
    assert.ok(!anchors.some((a) => a.value.startsWith('[') && !a.value.startsWith('[var(--sup-col-')), `${row.name}: a desktop edge is a viewport constant, not the column's`);
    const edge = (side: string) => {
      const a = anchors.find((x) => x.side === side);
      const m = a ? /^\[var\(--sup-col-(left|right|w),(.*)\)\]$/.exec(a.value) : null;
      return m ? { name: m[1]!, fallback: m[2]! } : null;
    };
    const right = edge('right');
    assert.ok(right && right.name === 'right', `${row.name}: its right edge is not the column's (--sup-col-right)`);
    // The fallback IS the tablet place: the variables are written only from 1024, so 701–1023 draws exactly what it did.
    assert.equal(right.fallback, TABLET.right, `${row.name}: the tablet right edge moved`);
    if (row.spans) {
      const left = edge('left');
      const w = edge('w');
      assert.ok(left && left.name === 'left' && left.fallback === TABLET.left, `${row.name}: its left is not the column's, or the tablet left moved`);
      assert.ok(w && w.name === 'w' && w.fallback === TABLET.w, `${row.name}: its width is not the column's, or the tablet width moved`);
    }
  }
  // Guests' dock: its edges follow the column from 701 (shipped), and from 1024 its controls sit ON those edges —
  // in the event screen only, with the side safe area still cleared.
  const css = read('../../guests/_components/guests-screen.module.css');
  const lower = /@media \(min-width: 701px\) \{\s*\.lower \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(lower, /left:\s*var\(--gs-left/, "Guests' dock: its left is not the column's");
  assert.match(lower, /right:\s*var\(--gs-right/, "Guests' dock: its right is not the column's");
  const desk = /\.screen\[data-guests-screen\] \.lower \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(desk, /padding-left:\s*max\(0px,\s*var\(--sn-safe-l\)\);/, "Guests' dock: from 1024 its controls sit off the column's left edge, or lost the side safe area");
  assert.match(desk, /padding-right:\s*max\(0px,\s*var\(--sn-safe-r\)\);/, "Guests' dock: from 1024 its controls sit off the column's right edge, or lost the side safe area");
});

test('2 · the Suppliers column hands followColumn ITSELF, from 1024 only, under the names the rows read', () => {
  const src = read('services-takeover.tsx');
  assert.match(src, /<section ref=\{rootRef\}[^>]*data-budget-build-takeover=""/, 'the column section lost its ref');
  assert.match(src, /const COLUMN_ROWS_FROM = '\(min-width: 1024px\)';/, 'the rows do not take the column from the full-width line');
  assert.match(src, /window\.matchMedia\(COLUMN_ROWS_FROM\)/, 'the column edges are written at every width — the tablet rows move');
  assert.match(
    src,
    /followColumn\(root,\s*\{\s*target:\s*document\.documentElement,\s*left:\s*'--sup-col-left',\s*right:\s*'--sup-col-right',\s*width:\s*'--sup-col-w'\s*\}\)/,
    'the Suppliers column does not publish its edges for the portaled rows',
  );
  assert.match(src, /const root = rootRef\.current;/, 'followColumn is not handed the column (rootRef)');
});

test('3 · followColumn writes the column’s edges onto the target, and takes them off when the page leaves', () => {
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, window: g.window, ResizeObserver: g.ResizeObserver };
  const vars = new Map<string, string>();
  const own = new Map<string, string>();
  const target = { style: { setProperty: (k: string, v: string) => vars.set(k, v), removeProperty: (k: string) => vars.delete(k) } };
  const column = {
    parentElement: null,
    getBoundingClientRect: () => ({ left: 272, right: 1248, width: 976 }), // 1280 − 240 rail − 2 × 32
    style: { setProperty: (k: string, v: string) => own.set(k, v), removeProperty: (k: string) => own.delete(k) },
  };
  g.document = { documentElement: { clientWidth: 1280 } };
  g.window = { addEventListener: () => {}, removeEventListener: () => {} };
  g.ResizeObserver = undefined;
  try {
    const stop = followColumn(column as unknown as HTMLElement, { target: target as unknown as HTMLElement, left: '--sup-col-left', right: '--sup-col-right', width: '--sup-col-w' });
    assert.equal(vars.get('--sup-col-left'), '272px', 'the row’s left is not the column’s left');
    assert.equal(vars.get('--sup-col-w'), '976px', 'the row’s width is not the column’s width');
    assert.equal(vars.get('--sup-col-right'), '32px', 'the row’s right is not the column’s right');
    assert.equal(own.size, 0, 'the column was written instead of the target');
    stop();
    assert.equal(vars.size, 0, 'the edges stay on the document root after the page leaves — the next page’s rows would read them');
  } finally {
    Object.assign(g, saved);
  }
});
