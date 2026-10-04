/**
 * canvas-bring-up.test.ts — owner, iPhone, 2026-10-05: the Invitation "as a
 * guest sees it" with the card's TOP cut off and "Maria" flush under the Maker's
 * bar. MEASURED on the live Maker (maria-and-jose, 375 × 812): tap "Maria", the
 * part is brought up to the canvas's top edge for the keyboard
 * (`scrollIntoView({ block: 'start' })`), press Done — and the page STAYS there,
 * with the card's border, its first line and the monogram above the frame.
 *
 * Holds `canvas-bring-up.ts` (the bring-up keeps room above the part, and the
 * page goes back when the edit is over) and that both phone edits — typing and
 * the part's sheet — go through it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BRING_UP_GAP_PX, createCanvasBringUp, isTypingTarget } from './canvas-bring-up';

type Listener = (e?: unknown) => void;
function fakeWindow(innerWidth = 375) {
  const listeners: Record<string, Listener[]> = {};
  const win = {
    innerWidth,
    scrollY: 0,
    scrolls: [] as number[],
    scrollTo(o: { top: number }) {
      win.scrollY = o.top;
      win.scrolls.push(o.top);
    },
    addEventListener(type: string, fn: Listener) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
    fire(type: string, e?: unknown) {
      for (const f of listeners[type] ?? []) f(e);
    },
  };
  return win;
}
/** A part whose top sits `docTop` px down the page. */
const partAt = (win: { scrollY: number }, docTop: number) =>
  ({ getBoundingClientRect: () => ({ top: docTop - win.scrollY }) }) as unknown as HTMLElement;
/** The words being typed ("Maria", contenteditable) and the page around them. */
const WORDS = { isContentEditable: true, tagName: 'SPAN' } as unknown as EventTarget;
const PAGE = { isContentEditable: false, tagName: 'BODY' } as unknown as EventTarget;

test('1 · the part comes up with room above it — never flush under the bar', () => {
  const win = fakeWindow();
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  assert.equal(win.scrollY, 293 - BRING_UP_GAP_PX);
  assert.ok(BRING_UP_GAP_PX >= 12, 'the gap is what keeps the part off the bar');
});

test('2 · when the edit is over the page goes back to where it rested — at once, no timer to race', () => {
  const win = fakeWindow();
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  lift.down();
  assert.equal(win.scrollY, 0, 'settle must put the page back where the couple left it');
});

test('3 · a chain of edits (typing → Style ▾ → another part) goes back to the FIRST resting place', () => {
  const win = fakeWindow();
  win.scrollY = 40;
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293)); // typing "Maria"
  lift.up(partAt(win, 500)); // the sheet moves on to another part
  lift.down(); // the last surface closes
  assert.equal(win.scrollY, 40, 'back to where the page rested BEFORE the first bring-up');
  lift.down();
  assert.equal(win.scrolls.length, 3, 'a second settle has nothing left to undo');
});

test('4 · Home / End / PageUp / PageDown INSIDE the words being typed move the caret — the way back is kept', () => {
  assert.equal(isTypingTarget(WORDS), true);
  assert.equal(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget), true);
  assert.equal(isTypingTarget(PAGE), false);
  for (const key of ['End', 'Home', 'PageUp', 'PageDown']) {
    const win = fakeWindow();
    const lift = createCanvasBringUp(win as unknown as Window);
    lift.up(partAt(win, 293)); // tap "Maria"
    win.fire('keydown', { key, target: WORDS }); // …press End while typing
    lift.down(); // …Done
    assert.equal(win.scrollY, 0, `${key} in the words must not cost the way back (the original bug, again)`);
  }
});

test('5 · a page the couple moved themselves, or the Maker moved on purpose, stays where it was put', () => {
  for (const how of ['touchmove', 'wheel', 'End on the page', 'forget'] as const) {
    const win = fakeWindow();
    const lift = createCanvasBringUp(win as unknown as Window);
    lift.up(partAt(win, 293));
    win.scrollY = 700; // they scrolled on
    if (how === 'forget') lift.forget();
    else if (how === 'End on the page') win.fire('keydown', { key: 'End', target: PAGE });
    else win.fire(how);
    lift.down();
    assert.equal(win.scrollY, 700, `${how}: their place wins`);
  }
});

test('6 · on a desktop nothing is brought up and nothing goes back', () => {
  const win = fakeWindow(1280);
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  lift.down();
  assert.deepEqual(win.scrolls, []);
});

const read = (p: string) => stripComments(readFileSync(join(import.meta.dirname, p), 'utf8'));
const TYPING = read('type-in-place-canvas.ts');
const BRIDGE = read('editor-bridge.tsx');
const SHELL = read('../../dashboard/[eventId]/website/editor/_components/editor-shell.tsx');

const HELPER = read('canvas-bring-up.ts');

test('7 · SOURCE: both phone edits bring the part up through the helper; ONLY the Maker sends it back', () => {
  // No timer anywhere: a hand-over (typing → Style ▾ → sheet) can never race a pending way back.
  assert.doesNotMatch(HELPER, /setTimeout|SETTLE_MS/, 'the way back is the Maker’s word, never a timer');
  // Typing: no raw scroll of its own; up on begin — and NO way back at the end of typing.
  assert.doesNotMatch(TYPING, /scrollIntoView\(/, 'typing must not scroll the page itself — `lift.up` keeps the way back');
  assert.match(TYPING, /lift\?\.up\(part\)/);
  const end = TYPING.slice(TYPING.indexOf('const end = (cancel: boolean)'), TYPING.indexOf('inside: (t)'));
  assert.ok(end.length > 50, 'the end of typing was not found — this scan is blind, not clean');
  assert.doesNotMatch(end, /lift/, 'the end of typing is not the end of the edit — the type bar stays open');
  // The bridge: one helper, handed to typing, used by the sheet tap, released by settle (or forgotten).
  assert.match(BRIDGE, /const lift = createCanvasBringUp\(window\)/);
  assert.match(BRIDGE, /createCanvasTyping\(window, [^\n]*, lift\)/);
  const tap = BRIDGE.slice(BRIDGE.indexOf('const part = tappedElement(e.target, el)'), BRIDGE.indexOf('const empty = el.matches'));
  assert.ok(tap.length > 50, 'the tap path was not found — this scan is blind, not clean');
  assert.match(tap, /lift\.up\(part\)/);
  assert.doesNotMatch(tap, /part\.scrollIntoView/, 'the sheet tap must not scroll the page without a way back');
  assert.match(BRIDGE, /data\.t === 'settle'\) \{\s*if \(\(data as \{ forget\?: unknown \}\)\.forget === true\) lift\.forget\(\);\s*else lift\.down\(\);/);
  assert.match(BRIDGE, /lift\.forget\(\);[^\n]*\n\s*el\.scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/, 'a Maker jump (scrollTo) forgets the way back');
});

test('8 · SOURCE: the Maker settles by ONE rule — when the last editing surface closes, however it closes', () => {
  // Every `settle` the Maker sends comes from the one effect (never a single close button).
  const sends = SHELL.match(/t: 'settle'/g)?.length ?? 0;
  console.log(`  settle sends in the Maker: ${sends}`);
  assert.equal(sends, 1, 'one rule, not one close path at a time — a path without it left a stale resting place');
  assert.match(SHELL, /const editingOpen = typeStart !== null \|\| elementTarget !== null;/);
  const effect = SHELL.slice(SHELL.indexOf('const editingOpen ='), SHELL.indexOf('const editingOpen =') + 900);
  assert.match(effect, /if \(wasEditing\.current && !editingOpen\)/, 'settle on the transition to NOTHING open');
  assert.match(effect, /broadcastToCanvasRef\.current\(/, 'to every canvas, warm ones too (a stage switch)');
  assert.match(effect, /\[editingOpen, typeStart, elementTarget, sheet\]/, 'the tap flag is cleared by every edit change');
  // A canvas tap that ends the edit keeps the tap's place.
  assert.match(SHELL, /\(data\.t === 'edit' \|\| data\.t === 'tapOutside'\) && \(elementRef\.current \|\| typeRef\.current\)\) \{\s*endedByCanvasTap\.current = true;/);
});
