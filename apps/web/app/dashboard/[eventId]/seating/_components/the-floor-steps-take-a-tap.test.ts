/**
 * the-floor-steps-take-a-tap.test.ts — THE EMPTY FLOOR'S STEPS ANSWER A TAP (owner 2026-11-20, live on a test event at
 * 375: "Build my seating draft" did nothing, tap after tap; the same button's `.click()` built the floor at once).
 *
 * The "Lay out your floor" card is drawn INSIDE the floor (`canvasRef`), whose `onCanvasPointerDown` captures every
 * press for its pan (`setPointerCapture`). A captured pointer's `click` is dispatched to the floor, so the step under
 * the finger never heard it — a failure that looks exactly like a button that does nothing. The card now keeps its
 * presses to itself (`onPointerDown` → `stopPropagation`), so they never reach the floor.
 *
 * Sabotage (each goes red): drop the card's `onPointerDown` · make it not stop propagation · move the card out of the
 * empty-floor branch · drop the floor's capture (then this test's premise is stale — re-read it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'seating', '_components');
const ed = stripComments(readFileSync(join(HERE, 'seating-editor.tsx'), 'utf8'));

test('the floor captures every press it hears (the premise)', () => {
  const at = ed.indexOf('const onCanvasPointerDown = ');
  assert.ok(at > 0, 'onCanvasPointerDown is gone — re-read this test');
  const body = ed.slice(at, ed.indexOf('const onCanvasPointerMove', at));
  assert.match(body, /canvasRef\.current\?\.setPointerCapture\(e\.pointerId\)/, 'the floor no longer captures — re-read this test');
  assert.match(ed, /onPointerDown=\{onCanvasPointerDown\}/);
});

test('the empty floor’s steps card keeps its presses from the floor', () => {
  const at = ed.indexOf('{tables.length === 0 ? (');
  assert.ok(at > 0, 'the empty-floor branch is gone');
  const branch = ed.slice(at, ed.indexOf('{tables.map(', at));
  const card = branch.indexOf('data-floor-steps=""');
  assert.ok(card > 0, 'the steps card is not marked data-floor-steps (or moved out of the empty-floor branch)');
  const tag = branch.slice(card, branch.indexOf('>', branch.indexOf('className=', card)));
  assert.match(tag, /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/, 'a press on a step still reaches the floor’s capture');
  assert.match(branch.slice(card), /label="Build my seating draft"/, 'the draft step is not inside the guarded card');
  assert.match(branch.slice(card), /label="Add your first table"/, 'the add-table step is not inside the guarded card');
});
