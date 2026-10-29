import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

/**
 * ✎ COMES AND GOES WITH THE OPEN ROW (owner 2026-10-30, on the approved final Suppliers design: "this and the pencil
 * icon stays hidden until that is highlighted.. and animate it entering and leaving"; prototype
 * `suppliers-final/_build-src/extra.css`, `.cat-h .svcpick`).
 *
 *  1. The ✎ is not dropped from the tree when its row closes (a dropped node cannot play out): once the list is read it
 *     stays mounted in its slot on EVERY row, and the slot is `inert` + hidden from reading while the row is closed.
 *  2. The slot is collapsed to nothing on a closed row (no width, no press) and grows + fades in on the open row — a
 *     transition both ways, an entrance on first mount (`@starting-style`), none for reduced motion.
 *  3. The open category is TINTED (an opaque mix over the page's ground, so the pinned head still hides what scrolls
 *     under it) — tokens only, both themes.
 *  4. The ✎ is a framed pill (it is pressed), accent while a service is hidden.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const RAW = readFileSync(join(HERE, '_components/shortlist-categories.tsx'), 'utf8');
const BENCH = stripComments(RAW);
const CSS = RAW.slice(RAW.indexOf('const SLCAT_CSS = `'), RAW.indexOf('`;', RAW.indexOf('const SLCAT_CSS = `'))).replace(/\/\*[\s\S]*?\*\//g, '');

test('the ✎ stays mounted on its row and is inert while the row is closed', () => {
  const at = BENCH.indexOf('className="cat-svc-slot"');
  assert.ok(at > 0, 'the ✎ lost its slot');
  const gate = BENCH.slice(BENCH.lastIndexOf('{replan &&', at), at);
  assert.doesNotMatch(gate, /tileOpen/, 'the ✎ is mounted only on the open row again — closing cannot play it out');
  const slot = BENCH.slice(at, BENCH.indexOf('>', at));
  assert.match(slot, /inert=\{!tileOpen\}/, 'a closed row’s ✎ can still be pressed or focused');
  assert.match(slot, /aria-hidden=\{tileOpen \? undefined : true\}/, 'a closed row’s ✎ is still read out');
  assert.match(BENCH.slice(at, BENCH.indexOf('</span>', at)), /<ActionButton[\s\S]*icon=\{Pencil\}/, 'the slot does not hold the ✎');
});

test('closed = nothing; open = grown in; both ways animated; reduced motion = none', () => {
  const closed = /\.slcat \.cat:not\(\.open\) \.cat-svc-slot\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  for (const d of ['max-width:0', 'opacity:0', 'pointer-events:none']) assert.ok(closed.includes(d), `a closed row’s ✎ lost ${d}`);
  const base = /\.slcat \.cat-svc-slot\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(base, /transition:max-width [^;]*opacity[^;]*transform/, 'the ✎ no longer animates in and out');
  assert.match(CSS, /@starting-style\{\.slcat \.cat\.open \.cat-svc-slot\{max-width:0;opacity:0/, 'the first opening pops the ✎ in with no entrance');
  assert.match(CSS, /prefers-reduced-motion:reduce\)\{\.slcat \.cat-svc-slot\{transition:none\}/);
});

test('the open category is tinted, opaque, from tokens', () => {
  const rules = [...CSS.matchAll(/\.slcat \.fold\.flat \.cat\.open>\.cat-head-row\{background:([^}]*)\}/g)].map((m) => m[1]);
  const last = rules[rules.length - 1] ?? '';
  assert.match(last, /^color-mix\(in srgb,rgb\(var\(--color-ink\)\) \d+%,var\(--sn-canvas\)\)$/, `the open head’s last background is ${last || 'missing'} — not the tint`);
});

test('the ✎ is a framed pill, accent while a service is hidden', () => {
  assert.match(CSS, /\.slcat \.cat-svc-slot \.cat-svc\{border:1px solid var\(--line\);border-radius:var\(--m-r-full\)/);
  assert.match(CSS, /\.slcat \.cat-svc-slot \.cat-svc\.on\{border-color:rgb\(var\(--sn-accent\)\);color:rgb\(var\(--sn-accent\)\)\}/);
});
