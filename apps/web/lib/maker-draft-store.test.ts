/**
 * maker-draft-store.test.ts — ⚡ THE MAKER BUILDS EVERY PICK ON ITS OWN LATEST
 * CANVAS, NEVER ON A RENDER FROM BEFORE IT.
 *
 * Owner, 2026-09-30 (SPEED FIRST): a pick the bridge drew no longer re-renders
 * the Maker, so the canvases the page handed down stay as they were. Without
 * this copy, the second part styled on a scene — or the sheet opened again —
 * would build on that older canvas and silently undo the first pick. Driven
 * with a fake "is a write still on its way" switch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasFingerprint, createDraftedCanvases } from './maker-draft-store';
import type { HubSectionCanvas } from './hub-canvas';

const S0: HubSectionCanvas = {};
const big: HubSectionCanvas = { elements: { mark: { size: 130 } } };
const bigBlue: HubSectionCanvas = { elements: { mark: { size: 130 }, names: { color: '#1d4ed8' } } };
const undone: HubSectionCanvas = { elements: { names: { color: '#b91c1c' } } };

function store() {
  let pending = false;
  const d = createDraftedCanvases(() => pending);
  return { d, set: (p: boolean) => void (pending = p) };
}

test('no render since the pick: the Maker’s own canvas wins — the next pick keeps the first', () => {
  const { d } = store();
  d.note('hero', big, S0);
  // The page was not re-rendered: the render still hands the canvas from before.
  assert.deepEqual(d.read('hero', S0), big, 'a second part would have been styled on the old canvas');
  d.note('hero', bigBlue, S0);
  assert.deepEqual(d.read('hero', S0), bigBlue);
});

test('the render caught up (it shows exactly ours): ours is dropped, the render is the truth', () => {
  const { d } = store();
  d.note('hero', big, S0);
  // Key order differs — the same canvas.
  assert.deepEqual(d.read('hero', { elements: { mark: { size: 130 } } }), big);
  assert.equal(d.size(), 0);
});

test('a render that moved on AFTER our writes landed (Undo, Restore, another tab) wins', () => {
  const { d } = store();
  d.note('hero', bigBlue, S0);
  assert.deepEqual(d.read('hero', undone), undone);
  assert.equal(d.size(), 0);
});

test('a render that arrives while our write is still on its way never wins — and the one after it does not undo us', () => {
  const { d, set } = store();
  d.note('hero', big, S0);
  set(true);
  // A render brought by some other write, older than our pick.
  const other: HubSectionCanvas = { elements: { line: { italic: true } } };
  assert.deepEqual(d.read('hero', other), big, 'a pick still on its way was replaced by an older render');
  set(false);
  // Our write landed; no new render — the render is still `other`, which ours was re-based on.
  assert.deepEqual(d.read('hero', other), big, 'the pick was undone the moment its save landed');
});

test('scenes are kept apart, and an absent canvas reads as empty', () => {
  const { d } = store();
  d.note('schedule', big, undefined);
  assert.deepEqual(d.read('hero', undefined), {});
  assert.deepEqual(d.read('schedule', null), big);
  assert.equal(canvasFingerprint(undefined), canvasFingerprint({}));
});
