/**
 * admin-search-is-visible.test.ts — the search the admin can SEE is the admin's.
 *
 * 🔴 THE BUG THIS EXISTS FOR, IN THE OWNER'S WORDS: *"i do not see the AI
 * searchbar."* Nothing was broken. The admin palette — 96 pages, 284 jobs, every
 * price row, whole sentences, and a model for phrasings nothing has seen —
 * opened with ⌘K and nothing else: no button, no label, no shortcut on a phone.
 * The one visible box on that bar belonged to the SHARED palette, which looks
 * through the person's own events. So the console had an assistant and the
 * control on screen opened something else.
 *
 * *A fix nobody can reach is no fix.* Third time.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('the admin mounts a visible search box of its own', () => {
  const layout = read('app/admin/layout.tsx');
  assert.match(layout, /searchSlot=\{<AdminSearchBox \/>\}/, 'the admin bar lost its own search');
  assert.match(layout, /from '\.\/_components\/admin-search-box'/);
});

test('the visible box and the panel agree on ONE name for "open"', () => {
  // A button that looks alive and opens nothing is the quietest failure in this
  // family. Neither side may type the string.
  const box = read('app/admin/_components/admin-search-box.tsx');
  const palette = read('app/admin/_components/admin-command-palette.tsx');
  for (const [file, src] of [
    ['the box', box],
    ['the palette', palette],
  ] as const) {
    assert.match(src, /ADMIN_SEARCH_OPEN_EVENT/, `${file} stopped using the shared event name`);
    assert.match(
      src,
      /from '\.\/admin-search-open-event'/,
      `${file} stopped importing the shared event name`,
    );
    assert.ok(
      !src.includes("'setnayan:admin-search-open'"),
      `${file} hand-typed the event name instead of importing it`,
    );
  }
  assert.match(box, /dispatchEvent/, 'the box no longer opens anything');
  assert.match(palette, /addEventListener\(ADMIN_SEARCH_OPEN_EVENT/, 'the panel stopped listening');
  assert.equal(ADMIN_SEARCH_OPEN_EVENT, 'setnayan:admin-search-open');
});

test('the panel still removes its listener', () => {
  // A dialog that accumulates one listener per mount opens twice, then three
  // times. Cheap to get wrong, invisible until it is not.
  const palette = read('app/admin/_components/admin-command-palette.tsx');
  assert.match(palette, /removeEventListener\(ADMIN_SEARCH_OPEN_EVENT/);
});

test('⌘K still works — this is a second door, not a replacement', () => {
  const palette = read('app/admin/_components/admin-command-palette.tsx');
  assert.match(palette, /e\.key === 'k' \|\| e\.key === 'K'/, 'the keyboard shortcut was removed');
  assert.match(palette, /claimCommandKey\(\)/, 'the palette stopped claiming ⌘K on this doorway');
});

test('every other tree keeps the shared palette — the slot defaults to today', () => {
  // The shell change must be invisible to the five other app trees. If the
  // fallback goes, a couple loses the search over their own events.
  const shell = read('app/_components/frontdoor/app-rail-shell.tsx');
  assert.match(
    shell,
    /searchSlot \?\?[\s\S]{0,140}HomeCommandBar/,
    'the shared palette stopped being the default',
  );
});

test('the box is a button, not a second input', () => {
  // Two inputs for one search means the palette steals focus on open and the
  // first keystroke lands in a box that is about to be replaced.
  const box = read('app/admin/_components/admin-search-box.tsx');
  assert.match(box, /<button/, 'the visible control stopped being a button');
  assert.ok(!/<input/.test(box), 'the box grew an input — the first keystroke will be lost');
  assert.match(box, /aria-label="Search the admin/, 'the control lost its accessible name');
});

test('it stays off the phone, per the owner ruling', () => {
  // 2026-08-26: the phone admin answers what needs a decision and does not edit.
  // This box opens doors into editing screens.
  const box = read('app/admin/_components/admin-search-box.tsx');
  assert.match(box, /hidden[^"]*lg:flex/, 'the admin search box appeared on the phone');
});
