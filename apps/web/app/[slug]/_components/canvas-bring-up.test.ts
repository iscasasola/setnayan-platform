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
import { BRING_UP_GAP_PX, SETTLE_MS, createCanvasBringUp } from './canvas-bring-up';

type Listener = () => void;
function fakeWindow(innerWidth = 375) {
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let id = 0;
  const listeners: Record<string, Listener[]> = {};
  const win = {
    innerWidth,
    scrollY: 0,
    scrolls: [] as number[],
    scrollTo(o: { top: number }) {
      win.scrollY = o.top;
      win.scrolls.push(o.top);
    },
    setTimeout(fn: () => void, ms: number) {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    clearTimeout(t: number) {
      timers.delete(t);
    },
    addEventListener(type: string, fn: Listener) {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener(type: string, fn: Listener) {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
    },
    tick(ms: number) {
      now += ms;
      for (const [k, t] of [...timers]) if (t.at <= now) (timers.delete(k), t.fn());
    },
    fire(type: string) {
      for (const f of listeners[type] ?? []) f();
    },
  };
  return win;
}
/** A part whose top sits `docTop` px down the page. */
const partAt = (win: { scrollY: number }, docTop: number) =>
  ({ getBoundingClientRect: () => ({ top: docTop - win.scrollY }) }) as unknown as HTMLElement;

test('1 · the part comes up with room above it — never flush under the bar', () => {
  const win = fakeWindow();
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  assert.equal(win.scrollY, 293 - BRING_UP_GAP_PX);
  assert.ok(BRING_UP_GAP_PX >= 12, 'the gap is what keeps the part off the bar');
});

test('2 · when the edit is over the page goes back to where it rested — the card’s top in view again', () => {
  const win = fakeWindow();
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  lift.down();
  assert.equal(win.scrollY, 293 - BRING_UP_GAP_PX, 'not at once — a hand-over may still hold it');
  win.tick(SETTLE_MS);
  assert.equal(win.scrollY, 0, 'Done must put the page back where the couple left it');
});

test('3 · a hand-over (typing → the part’s sheet) holds the way back; the first resting place is kept', () => {
  const win = fakeWindow();
  win.scrollY = 40;
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  lift.down(); // the type bar's Style ends the typing…
  lift.hold(); // …and the part's sheet opens on it
  win.tick(SETTLE_MS * 4);
  assert.equal(win.scrollY, 293 - BRING_UP_GAP_PX, 'held: the part stays up while its sheet is open');
  lift.up(partAt(win, 500)); // another part, same edit
  lift.down(); // the sheet closes
  win.tick(SETTLE_MS);
  assert.equal(win.scrollY, 40, 'back to where the page rested BEFORE the first bring-up');
});

test('4 · a page the couple moved themselves, or the Maker moved on purpose, stays where it was put', () => {
  for (const how of ['touchmove', 'wheel', 'forget'] as const) {
    const win = fakeWindow();
    const lift = createCanvasBringUp(win as unknown as Window);
    lift.up(partAt(win, 293));
    win.scrollY = 700; // they scrolled on
    if (how === 'forget') lift.forget();
    else win.fire(how);
    lift.down();
    win.tick(SETTLE_MS);
    assert.equal(win.scrollY, 700, `${how}: their place wins`);
  }
});

test('5 · on a desktop nothing is brought up and nothing goes back', () => {
  const win = fakeWindow(1280);
  const lift = createCanvasBringUp(win as unknown as Window);
  lift.up(partAt(win, 293));
  lift.down();
  win.tick(SETTLE_MS);
  assert.deepEqual(win.scrolls, []);
});

const read = (p: string) => stripComments(readFileSync(join(import.meta.dirname, p), 'utf8'));
const TYPING = read('type-in-place-canvas.ts');
const BRIDGE = read('editor-bridge.tsx');
const SHELL = read('../../dashboard/[eventId]/website/editor/_components/editor-shell.tsx');

test('6 · SOURCE: both phone edits bring the part up through the helper, and both have a way back', () => {
  // Typing: no raw scroll of its own; up on begin, down on end.
  assert.doesNotMatch(TYPING, /scrollIntoView\(/, 'typing must not scroll the page itself — `lift.up` keeps the way back');
  assert.match(TYPING, /lift\?\.up\(part\)/);
  const end = TYPING.slice(TYPING.indexOf('const end = (cancel: boolean)'), TYPING.indexOf('inside: (t)'));
  assert.ok(end.length > 50, 'the end of typing was not found — this scan is blind, not clean');
  assert.match(end, /lift\?\.down\(\)/, 'the end of typing must put the page back');
  // The bridge: one helper, handed to typing, used by the sheet tap, held by markEl, released by settle.
  assert.match(BRIDGE, /const lift = createCanvasBringUp\(window\)/);
  assert.match(BRIDGE, /createCanvasTyping\(window, [^\n]*, lift\)/);
  const tap = BRIDGE.slice(BRIDGE.indexOf('const part = tappedElement(e.target, el)'), BRIDGE.indexOf('const empty = el.matches'));
  assert.ok(tap.length > 50, 'the tap path was not found — this scan is blind, not clean');
  assert.match(tap, /lift\.up\(part\)/);
  assert.doesNotMatch(tap, /part\.scrollIntoView/, 'the sheet tap must not scroll the page without a way back');
  assert.match(BRIDGE, /data\.t === 'settle'\) \{\s*lift\.down\(\);/);
  assert.match(BRIDGE, /if \(part\) lift\.hold\(\);/);
  // The Maker says the sheet closed.
  const close = SHELL.slice(SHELL.indexOf("t: 'markEl', key: elementTarget.key, el: null"), SHELL.indexOf("sheetDo({ t: 'close' })"));
  assert.ok(close.length > 0, 'the part sheet’s close was not found — this scan is blind, not clean');
  assert.match(close, /t: 'settle'/, 'closing the part sheet must tell the canvas to settle');
});
