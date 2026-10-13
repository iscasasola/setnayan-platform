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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { canvasFingerprint, createDraftedCanvases } from './maker-draft-store';
import type { HubSectionCanvas } from './hub-canvas';

const S0: HubSectionCanvas = {};
const big: HubSectionCanvas = { elements: { mark: { size: 132 } } };
const bigBlue: HubSectionCanvas = { elements: { mark: { size: 132 }, names: { color: '#1d4ed8' } } };
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
  assert.deepEqual(d.read('hero', { elements: { mark: { size: 132 } } }), big);
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

/* ↺ A DRAWN UNDO (`lib/maker-drawn-undo.ts`, 2026-10-13): no unheld write, no render — the ↺ notes the BEFORE canvas in
   this same store at its press, so the next pick builds on the undone state (the 110 % case, by the drawn path). */
const at110: HubSectionCanvas = { elements: { eyebrow: { size: 110 } } };
const at110red: HubSectionCanvas = { elements: { eyebrow: { size: 110, color: '#b5543a' } } };
test('a drawn ↺ of the only pick of a visit: the next pick builds on the UNDONE canvas (no render ever comes)', () => {
  const { d, set } = store();
  d.note('hero', at110, S0); // Size 110 — drawn, held
  set(true); // the held undo on its way
  d.note('hero', S0, S0); // ↺ drawn at the press: the canvas before
  assert.deepEqual(d.read('hero', S0), S0, 'the panel reads 100 % while the undo is still on its way');
  set(false);
  assert.deepEqual(d.read('hero', S0), S0, 'and after it lands — the render never came, nothing brought 110 back');
  const next = { elements: { eyebrow: { color: '#b5543a' } } };
  assert.deepEqual({ elements: { ...d.read('hero', S0).elements, eyebrow: { color: '#b5543a' } } }, next, 'Colour builds on 100 %: the undone size is not written back');
});
test('a drawn ↺ after a render caught up with the pick: the undone canvas still wins over that render', () => {
  const { d } = store();
  d.note('hero', at110red, S0);
  assert.deepEqual(d.read('hero', at110red), at110red, 'a render shows ours: dropped, the render is the truth');
  d.note('hero', at110, at110red); // ↺ drawn: the canvas before the Colour pick
  assert.deepEqual(d.read('hero', at110red), at110, 'the stale render (still showing Colour) never draws the undone pick back');
});

test('scenes are kept apart, and an absent canvas reads as empty', () => {
  const { d } = store();
  d.note('schedule', big, undefined);
  assert.deepEqual(d.read('hero', undefined), {});
  assert.deepEqual(d.read('schedule', null), big);
  assert.equal(canvasFingerprint(undefined), canvasFingerprint({}));
});

/* ═══════════════════════════════════════════════════════════════════════════
   ↺ THE FIRST RENDER AFTER A WRITE THE CANVAS DID NOT DRAW IS THE TRUTH
   Walked in the lab 2026-10-12: Title › Style › Size 110 % → ↺ → the draft was
   empty, the panel still read 110 %, and the next Colour pick wrote it back.
   ═══════════════════════════════════════════════════════════════════════════ */

test('the only pick of a visit, undone: the render that brings the server BACK to the base is the truth', () => {
  const { d, set } = store();
  d.rendered('r1');
  set(true);
  d.note('hero', big, S0);
  assert.deepEqual(d.read('hero', S0), big, 'a pick on its way');
  set(false);
  // Landed; no render (a held pick). ↺ is pressed: it announces itself, then its render lands — back at S0.
  assert.deepEqual(d.read('hero', S0), big);
  d.unheld();
  assert.deepEqual(d.read('hero', S0), big, 'before the undo’s render lands, ours is still what the canvas shows');
  d.rendered('r2');
  assert.deepEqual(d.read('hero', S0), S0, 'the undone pick is still the Maker’s copy — the next pick writes it back');
  assert.equal(d.size(), 0);
});

test('the shell drawn again with the SAME stamp is no render', () => {
  const { d } = store();
  d.rendered('r1');
  d.note('hero', big, S0);
  d.unheld();
  d.rendered('r1');
  assert.deepEqual(d.read('hero', S0), big, 'a client re-render of the shell was taken for the undo’s render');
});

test('no write announced: a render keeps our copy (a held pick owes no render, a redraw is not an undo)', () => {
  const { d } = store();
  d.rendered('r1');
  d.note('hero', big, S0);
  d.rendered('r2');
  assert.deepEqual(d.read('hero', S0), big, 'a render nobody announced dropped a pick it never held');
});

test('a render that lands while a write of ours is still on its way is not the truth — the next one is', () => {
  let pending = false;
  let settling = false;
  const d = createDraftedCanvases(() => pending, () => settling);
  d.rendered('r1');
  d.note('hero', big, S0);
  d.unheld();
  settling = true;
  d.rendered('r2'); // asked before our write landed — it cannot hold it
  settling = false;
  assert.deepEqual(d.read('hero', S0), big, 'an older render replaced a pick it could not hold');
  d.rendered('r3');
  assert.deepEqual(d.read('hero', S0), S0);
});

test('a pick noted AFTER the announcement is a later write: the render does not drop it', () => {
  const { d } = store();
  d.rendered('r1');
  d.note('hero', big, S0);
  d.unheld();
  d.note('hero', bigBlue, S0);
  d.rendered('r2');
  assert.deepEqual(d.read('hero', S0), bigBlue, 'a pick made after ↺ was thrown away by the undo’s render');
});

test('every scene kept at the announcement is owed, and only those', () => {
  const { d } = store();
  d.rendered('r1');
  d.note('hero', big, S0);
  d.note('schedule', bigBlue, S0);
  d.unheld();
  d.note('venue', undone, S0);
  d.rendered('r2');
  assert.deepEqual(d.read('hero', S0), S0);
  assert.deepEqual(d.read('schedule', S0), S0);
  assert.deepEqual(d.read('venue', S0), undone);
});

/* — the wiring: the shared instances hear the announcement, and the Maker's shell tells them each render — */

const STORE = stripComments(readFileSync(join(__dirname, 'maker-draft-store.ts'), 'utf8'));
const SHELL = stripComments(readFileSync(join(__dirname, '../app/dashboard/[eventId]/launch/_components/maker-shell.tsx'), 'utf8'));

test('the shared copies (canvases AND own words) hear every unheld write and every render', () => {
  assert.match(STORE, /window\.addEventListener\(MAKER_UNHELD_WRITE_EVENT, \(\) => \{\s*shared\.unheld\(\);\s*ownWordsShared\.unheld\(\);\s*\}\);/);
  assert.match(STORE, /export function makerRendered\(stamp: string\): void \{\s*shared\.rendered\(stamp\);\s*ownWordsShared\.rendered\(stamp\);\s*\}/);
  // The truth is owed only past a write that could change THIS scene — never past another scene's held pick.
  assert.match(STORE, /const shared = createDraftedCanvases\(\s*\(type\) => makerWritesPending\(canvasWriteKey\(type\)\) > 0 \|\| makerSavesInFlight\(\) > 0,\s*\(type\) => makerWritesPending\(canvasWriteKey\(type\)\) > 0 \|\| makerUnheldSavesInFlight\(\) > 0,\s*\);/);
  assert.match(STORE, /const ownWordsShared = createDraftedCanvases<OwnWords>\(\s*\(type\) => makerWritesPending\(`custom:\$\{type\}`\) > 0 \|\| makerSavesInFlight\(\) > 0,\s*\(type\) => makerWritesPending\(`custom:\$\{type\}`\) > 0 \|\| makerUnheldSavesInFlight\(\) > 0,\s*\);/);
});

test('the Maker’s shell tells the store of its render BEFORE anything under it reads (first line of its body)', () => {
  assert.match(SHELL, /children: ReactNode;\s*\}\) \{\s*makerRendered\(renderStamp\);/, 'the shell does not tell the store a render landed (or tells it after its panels read)');
});
