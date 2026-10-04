/**
 * one-open.test.ts — ONE OPEN AT A TIME (owner 2026-10-04: "when a dropdown
 * opens, the other dropdown collapses" → "auto collapse"; DECISION_LOG.md
 * 2026-10-04, INTERACTION_RULES.md §8).
 *
 * ── WHAT IS PROVEN HERE, AND WHAT IS NOT ────────────────────────────────────
 * There is no DOM in this runner (`tsx --test`, no jsdom, no testing-library in
 * the workspace), so React cannot mount a PickMenu here. The DECISION is not in
 * React, though: it is `joinOneOpen` / `announceOpen` in `lib/one-open.ts`, and
 * `useOneOpen` is a ten-line wrapper that calls `joinOneOpen` from a layout
 * effect keyed on `open`. So:
 *
 *   1. the decision runs for real below — two PickMenus and a fold, a picker
 *      inside an open sheet, a fold that mounts open — through `opener()`, which
 *      drives `joinOneOpen` exactly the way the hook's effect does (join while
 *      open, announce only on a closed → open change, leave on close);
 *   2. the WIRING — that the shared primitives call the hook, and that the ones
 *      which hold other openers mark them as children — is pinned against the
 *      source, comments stripped, per file.
 *
 * Sabotage (2026-10-04, each red, then restored green):
 *   · `announceOpen`'s loop emptied              → all four behaviour tests red;
 *   · `&& !chain.includes(o.id)` deleted          → "a picker inside an open sheet" red;
 *   · `useOneOpen(open, setOpen);` cut from PickMenu → both wiring tests red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { joinOneOpen } from '@/lib/one-open';

/** One opener, driven the way `useOneOpen`'s effect drives `joinOneOpen`. */
function opener(id: string, chain: readonly string[] = [], startOpen = false) {
  let leave: (() => void) | null = null;
  const o = {
    open: false,
    /** A tap, a keyboard Enter or a programmatic open — all the same state change. */
    show() {
      if (o.open) return;
      o.open = true;
      leave = joinOneOpen(id, chain, () => o.hide(), true);
    },
    hide() {
      if (!o.open) return;
      o.open = false;
      leave?.();
      leave = null;
    },
  };
  if (startOpen) {
    // Mounted already open (a fold with `defaultOpen`): it joins WITHOUT announcing.
    o.open = true;
    leave = joinOneOpen(id, chain, () => o.hide(), false);
  }
  return o;
}

test('opening dropdown A then dropdown B leaves only B open — and a fold closes too', () => {
  const a = opener('pick-a');
  const b = opener('pick-b');
  const fold = opener('fold');
  fold.show();
  a.show();
  assert.equal(fold.open, false, 'opening a dropdown must fold away the open fold');
  assert.equal(a.open, true);
  b.show();
  assert.deepEqual([a.open, b.open, fold.open], [false, true, false], 'only B may be open');
  fold.show();
  assert.deepEqual([a.open, b.open, fold.open], [false, false, true], 'opening the fold closes B');
  fold.hide();
});

test('a picker inside an open sheet does not close the sheet (only peers close peers)', () => {
  const peer = opener('peer-menu');
  const sheet = opener('sheet');
  const picker = opener('picker-in-sheet', ['sheet']);
  peer.show();
  sheet.show();
  assert.equal(peer.open, false, 'the sheet opening closes a peer menu');
  picker.show();
  assert.equal(sheet.open, true, 'a child opening must never close its parent sheet');
  assert.equal(picker.open, true);
  // …and a second picker in the same sheet is the first one's PEER.
  const picker2 = opener('picker-2-in-sheet', ['sheet']);
  picker2.show();
  assert.deepEqual([sheet.open, picker.open, picker2.open], [true, false, true]);
  // A grandchild keeps both ancestors open.
  const nested = opener('nested', ['sheet', 'picker-2-in-sheet']);
  nested.show();
  assert.deepEqual([sheet.open, picker2.open, nested.open], [true, true, true]);
  // Something opening OUTSIDE the sheet closes the whole family.
  peer.show();
  assert.deepEqual([sheet.open, picker2.open, nested.open, peer.open], [false, false, false, true]);
  peer.hide();
});

test('a fold that mounts open does not close what is already open — but it still listens', () => {
  const menu = opener('menu');
  menu.show();
  const fold = opener('fold-default-open', [], true);
  assert.equal(menu.open, true, 'mounting open is not "opening" — two default-open folds must not fight on load');
  assert.equal(fold.open, true);
  menu.hide();
  menu.show();
  assert.equal(fold.open, false, 'once something else opens, the default-open fold folds');
  menu.hide();
});

test('a closed opener is not listening', () => {
  const a = opener('closed-a');
  const b = opener('closed-b');
  a.show();
  a.hide();
  b.show();
  a.show();
  assert.deepEqual([a.open, b.open], [true, false]);
  a.hide();
});

/* ── THE WIRING ─────────────────────────────────────────────────────────────
   `scope: true` = the opener renders other things that can open inside its
   panel, so it must mark them as its children with <OneOpenScope>. */
const WIRED: ReadonlyArray<{ file: string; scope: boolean; calls?: number }> = [
  { file: 'app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/guests/_components/overlay-primitives.tsx', scope: true },
  { file: 'app/dashboard/[eventId]/guests/_components/guest-ticket-parts.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/seating/_components/seating-frame.tsx', scope: true },
  { file: 'app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx', scope: true },
  { file: 'app/dashboard/[eventId]/seating/_components/seating-editor.tsx', scope: false, calls: 2 },
  { file: 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx', scope: true, calls: 2 },
  { file: 'app/dashboard/[eventId]/launch/_components/sheet-sections.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/launch/_components/print-menu-editor.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/website/editor/_components/colour-well.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/studio/mood-board/_components/swatch-popover.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/schedule/_components/day-ui.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/story/_components/make-it-yours.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/guests/_components/walking-order-lines.tsx', scope: false },
  { file: 'app/dashboard/[eventId]/_components/expand-card.tsx', scope: true },
  { file: 'app/dashboard/(launcher)/_components/event-card-menu.tsx', scope: false },
  { file: 'app/(shell)/explore/_components/taxonomy-search.tsx', scope: false },
  { file: 'app/[slug]/_components/story/find-in-this-day.tsx', scope: false },
  { file: 'app/_components/info-tip.tsx', scope: false },
  { file: 'app/_components/chat-thread-menu.tsx', scope: false },
  { file: 'app/_components/frontdoor/front-door-shell.tsx', scope: false },
  { file: 'app/vendor-dashboard/shop/_components/services-disclosure.tsx', scope: true },
];

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), ...rel.split('/')), 'utf8'));

test('the shared openers call the one hook (and the containers mark their children)', () => {
  assert.ok(WIRED.length >= 20, 'the wired list shrank — re-check before trusting a green');
  for (const { file, scope, calls = 1 } of WIRED) {
    const src = read(file);
    assert.match(src, /from '@\/lib\/one-open'/, `${file} no longer imports lib/one-open`);
    const n = (src.match(/\buseOneOpen\(/g) ?? []).length;
    assert.equal(n, calls, `${file}: expected ${calls} useOneOpen( call(s), found ${n}`);
    if (scope) assert.match(src, /<OneOpenScope id=\{oneOpenId\}>/, `${file} holds other openers but no longer marks them as its children`);
  }
});

test('PickMenu joins with its own open state — tap AND keyboard, because it is the state that announces', () => {
  const src = read('app/dashboard/[eventId]/website/editor/_components/pick-menu.tsx');
  assert.match(src, /const \[open, setOpen\] = useState\(false\);\s*useOneOpen\(open, setOpen\);/);
});

test('the hook announces from the state change, in a layout effect keyed on open', () => {
  const src = read('lib/one-open.ts');
  const hook = src.slice(src.indexOf('export function useOneOpen('));
  assert.match(hook, /const opening = open && !was\.current;/, 'only a closed → open change may announce');
  assert.match(hook, /useLayoutEffect\(\(\) => \{[\s\S]*?joinOneOpen\(id, chain,[\s\S]*?\}, \[open, id, chain\]\);/);
});

test('modal sheets and persistent navigation stay OUT — a dropdown never closes its context', () => {
  for (const file of [
    'app/_components/sheet.tsx',
    'app/_components/nav/bottom-nav.tsx',
    'app/_components/nav/sidebar-section.tsx',
    'app/_components/account-switcher/account-switcher.tsx',
  ]) {
    assert.doesNotMatch(read(file), /\buseOneOpen\(/, `${file} must not join: it is a context a dropdown opens in, or persistent navigation`);
  }
});
