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
 *   1. From 701 its horizontal edges come from the COLUMN'S MEASURED EDGES (`followColumn`'s variables) — never a
 *      viewport constant: no `vw` width, no bare `right-[…rem]`, no fixed width.
 *   2. The column hands `followColumn` itself (the section carrying the width), with the names the rows read.
 *   3. `followColumn` writes the column's edges onto the element it is told to (the document root, where a row
 *      portaled into <body> can read them), and takes them off again when the page leaves.
 *
 * Sabotage (2026-10-23): the Find row back to `tab:right-[max(1.75rem,…)] tab:w-[min(720px,calc(100vw-128px))]`
 * (1 red); the takeover's `followColumn` call removed (2 red); the target's cleanup removed (3 red).
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

test('1 · from 701 every Suppliers bottom row takes its edges from the column, never the viewport', () => {
  for (const row of ROWS) {
    const anchors = desktopAnchors(classOf(read(row.file), row.marker));
    for (const a of anchors) {
      if (a.value === 'auto' || a.value === '0') continue;
      assert.match(a.value, /^\[var\(--sup-col-(left|right)\b/, `${row.name}: tab/lg ${a.side} is "${a.value}" — a viewport anchor, not the column's edge`);
      assert.doesNotMatch(a.value, /vw/, `${row.name}: its width is measured from the viewport`);
    }
    const right = anchors.find((a) => a.side === 'right');
    assert.ok(right, `${row.name}: no column-right edge from 701`);
    if (row.spans) {
      const left = anchors.find((a) => a.side === 'left');
      assert.ok(left && /--sup-col-left/.test(left.value), `${row.name}: its left edge is not the column's — it does not span the column`);
      assert.ok(!anchors.some((a) => a.side === 'w'), `${row.name}: carries a width of its own — the column's two edges ARE its width`);
    }
  }
  // Guests' dock: the same property, carried in its stylesheet from 701.
  const css = read('../../guests/_components/guests-screen.module.css');
  const lower = /@media \(min-width: 701px\) \{\s*\.lower \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(lower, /left:\s*var\(--gs-left/, "Guests' dock: its left is not the column's");
  assert.match(lower, /right:\s*var\(--gs-right/, "Guests' dock: its right is not the column's");
});

test('2 · the Suppliers column hands followColumn ITSELF, under the names the rows read', () => {
  const src = read('services-takeover.tsx');
  assert.match(src, /<section ref=\{rootRef\}[^>]*data-budget-build-takeover=""/, 'the column section lost its ref');
  assert.match(
    src,
    /followColumn\(\s*root,\s*\{\s*target:\s*document\.documentElement,\s*left:\s*'--sup-col-left',\s*right:\s*'--sup-col-right'\s*\}\s*\)/,
    'the Suppliers column does not publish its edges for the portaled rows',
  );
  assert.match(src, /const root = rootRef\.current;[\s\S]{0,80}return followColumn\(/, 'followColumn is not handed the column (rootRef) or its cleanup is dropped');
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
    const stop = followColumn(column as unknown as HTMLElement, { target: target as unknown as HTMLElement, left: '--sup-col-left', right: '--sup-col-right' });
    assert.equal(vars.get('--sup-col-left'), '272px', 'the row’s left is not the column’s left');
    assert.equal(vars.get('--sup-col-right'), '32px', 'the row’s right is not the column’s right');
    assert.equal(own.size, 0, 'the column was written instead of the target');
    stop();
    assert.equal(vars.size, 0, 'the edges stay on the document root after the page leaves — the next page’s rows would read them');
  } finally {
    Object.assign(g, saved);
  }
});
