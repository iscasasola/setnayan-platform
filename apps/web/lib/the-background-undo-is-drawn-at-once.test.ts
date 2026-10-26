/**
 * ↺ THE UNDO OF A BACKGROUND PICK IS DRAWN AT ONCE — never a whole-Maker render and a new canvas page.
 *
 * Owner, live on his phone 2026-10-26: *"when undo is pressed on event hub. it blinks quickly for around 5-6 seconds
 * before undo is done"*. The three background savers left a BARRIER in the ↺ journal (they were listed in
 * `UNDO_NOT_DRAWN` as "phase 2"), so the ↺ after a background pick took the slow path (`hub-draft-bar.tsx` `slow`):
 * an unheld undo → `MAKER_UNHELD_WRITE_EVENT` (the canvas lets go of its hold) → a whole-Maker render → a new canvas
 * page swapped in behind the old one.
 *
 *   (1) the journal, driven for real: a background pick's save hands its inverse, so the ↺ finds a step it can DRAW
 *       (`runDrawnUndo` answers, no slow path) — the BEFORE is drawn in the ↺'s own press, the page redraws in place
 *       ONCE when the ↺ lands, and a refused ↺ draws the AFTER again (and asks for no redraw);
 *   (2) a pick whose save hands nothing is still a barrier — the slow path (the control: this test can go red);
 *   (3) each of the three savers hands it (their save calls carry `undo`), and the list of slow ones no longer names them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { backgroundPickUndo } from './background-pick-undo';
import { undoJournal, type DrawnUndo } from './maker-drawn-undo';
import { makerRedrawSave, makerSave } from './maker-refresh';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const answered = <T>(v: T) => Promise.resolve(v);

test('(1) a background pick\'s ↺ is drawn at once, then the page redraws in place ONCE', async () => {
  undoJournal.clear();
  const page: string[] = [];
  let redraws = 0;
  const undo = backgroundPickUndo({ back: () => page.push('before'), forward: () => page.push('after'), redrawAfter: true }, () => (redraws += 1));
  await makerRedrawSave(() => answered({ ok: true, stamp: 's1' }), () => {}, { undo });
  const top = undoJournal.top();
  assert.notEqual(top, null, 'the background pick left nothing in the ↺ journal');
  assert.notEqual(top, 'barrier', 'the background pick left a BARRIER — its ↺ is the slow path (a whole-Maker render and a new canvas page)');
  const drawn = (top as Exclude<typeof top, 'barrier' | null>).step.undraw() as DrawnUndo;
  assert.deepEqual(page, ['before'], 'the BEFORE was not drawn in the ↺\'s own press');
  assert.equal(drawn.now, true, 'the ↺ keeps the bar busy for a step already drawn');
  assert.equal(redraws, 0, 'the page redrew before the ↺ had landed');
  drawn.landed(true);
  assert.equal(redraws, 1, 'the page did not redraw itself in place — exactly once — after the ↺ landed');
  undoJournal.clear();
});

test('(1) a refused ↺ draws the AFTER again and asks for no redraw', async () => {
  undoJournal.clear();
  const page: string[] = [];
  let redraws = 0;
  const undo = backgroundPickUndo({ back: () => page.push('before'), forward: () => page.push('after'), redrawAfter: true }, () => (redraws += 1));
  await makerSave(() => answered({ ok: true, stamp: 's2' }), () => {}, { held: true, undo });
  const top = undoJournal.top();
  assert.ok(top && top !== 'barrier');
  top.step.undraw()!.landed(false);
  assert.deepEqual(page, ['before', 'after']);
  assert.equal(redraws, 0);
  undoJournal.clear();
});

test('(2) the control: a held background save that hands NO inverse is a barrier (the slow path)', async () => {
  undoJournal.clear();
  await makerRedrawSave(() => answered({ ok: true, stamp: 's3' }), () => {});
  assert.equal(undoJournal.top(), 'barrier');
  undoJournal.clear();
});

test('(3) the three background savers hand their inverse — and are off the slow list', () => {
  const scene = code('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  assert.match(scene, /const undo = backgroundPickUndo\(\{ back: \(\) => drawCanvases\(before\), forward: \(\) => drawCanvases\(touched\), redrawAfter: redrawsBox \}\)/);
  assert.match(scene, /makerRedrawSave\(\(\) => draftAction\(eventId, fd\), \(\) => router\.refresh\(\), \{ undo \}\)/);
  assert.match(scene, /makerSave\(\(\) => draftAction\(eventId, fd\), \(\) => router\.refresh\(\), \{ held: true, undo \}\)/);
  const cover = code('app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx');
  assert.match(cover, /backgroundPickUndo\(\{ back: \(\) => drawCanvas\(before\), forward: \(\) => drawCanvas\(canvasNext\), redrawAfter: true \}\)/);
  assert.match(cover, /makerRedrawSave\(\(\) => draftAction\(eventId, fd\), \(\) => router\.refresh\(\), \{ undo \}\)/);
  const look = code('app/dashboard/[eventId]/website/editor/_components/main-background-panel.tsx');
  assert.match(look, /backgroundPickUndo\(\{ back: \(\) => wear\(before\), forward: \(\) => wear\(next\), redrawAfter: true \}/);
  assert.match(look, /const before = lookGround\.read\(lookKey, serverRef\.current\);/, 'the Look pick no longer reads what the page wore BEFORE it');
  const slowList = code('lib/every-held-save-can-be-undone.test.ts').split('export const UNDO_NOT_DRAWN')[1]!.split('};')[0]!;
  assert.doesNotMatch(slowList, /scene-background-row\.tsx › save|cover-words-background\.tsx › put|main-background-panel\.tsx › pickLook/, 'a background saver is listed as a slow ↺ again');
});
