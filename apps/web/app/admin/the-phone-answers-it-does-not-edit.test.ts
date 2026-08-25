/**
 * On a phone the console answers; it does not edit.
 *
 * OWNER 2026-08-26, verbatim: *"for mobile version, we only provide quick
 * answers. no editing of settings or features. just responses for those that
 * needs decision and response."*
 *
 * 🔑 WHAT THAT RULES OUT, CONCRETELY. The phone strip carried tabs to **Set up**
 * (the taxonomy editor) and **Numbers** (traffic charts). Neither answers
 * anything — one is the exact editing this ruling moves off the phone, the other
 * is looking. Money replaces them, because confirming a payment IS a response:
 * the receipt is on the row and one press settles it.
 *
 * ⚖ TWO THINGS THIS DELIBERATELY DOES NOT DO. It does not remove **More** —
 * deleting the only route from a phone to sixty pages is a capability deletion
 * nobody asked for. And it does not delete the six editing tiles; they stand
 * down below `lg` and a line says where they went, because **a gap is not an
 * answer** — a silent absence reads as a broken screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN = join(process.cwd(), 'app/admin');
const read = (rel: string) => readFileSync(join(ADMIN, rel), 'utf8');
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const bar = code(read('_components/admin-bottom-nav.tsx'));
const tiles = code(read('_components/what-you-change.tsx'));
const home = code(read('page.tsx'));

/** The labels the phone strip actually renders, in order. */
function tabs(): string[] {
  return [...bar.matchAll(/^    label: '([^']+)',$/gm)].map((m) => m[1]!);
}

test('every phone tab is somewhere you ANSWER, not somewhere you edit', () => {
  const EDITING = ['Set up', 'Numbers', 'Studio'];
  const found = tabs();
  const bad = found.filter((t) => EDITING.includes(t));
  assert.deepEqual(
    bad,
    [],
    `the phone strip offers ${bad.join(', ')} — those are editing and looking, not answering. ` +
      'The phone is the list of things waiting on a decision and the means to answer them.',
  );
  // …and it still offers the three that DO answer.
  for (const t of ['Today', 'People', 'Money']) {
    assert.ok(found.includes(t), `the phone lost its ${t} tab — that is where answering happens`);
  }
});

test('the strip stays inside the locked ≤5 primitive, and keeps its way out', () => {
  const found = tabs();
  assert.ok(found.length <= 5, `the strip has ${found.length} tabs; the lock is ≤5`);
  assert.ok(
    found.includes('More'),
    'More is gone — removing the only route from a phone to sixty pages is a capability ' +
      'deletion, not a simplification. Keep it and signpost it.',
  );
});

test('the editing tiles stand down on a phone, and say so', () => {
  // Hidden below lg — not deleted.
  assert.match(tiles, /aria-label="What you change" className="mb-8 hidden lg:block"/);
  // And the line that replaces them is mounted and phone-only.
  assert.match(tiles, /export function EditingIsOnTheComputer/);
  assert.match(tiles, /lg:hidden/);
  assert.match(home, /<EditingIsOnTheComputer \/>/);
  assert.match(tiles, /are on the computer/);
});
