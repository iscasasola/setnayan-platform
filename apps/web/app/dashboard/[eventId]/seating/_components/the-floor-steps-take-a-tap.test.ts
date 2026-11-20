/**
 * the-floor-steps-take-a-tap.test.ts — THE EMPTY FLOOR'S STEPS ANSWER A TAP (owner 2026-11-20, live on a test event at
 * 375: "Build my seating draft" did nothing, tap after tap; the same button's `.click()` built the floor at once).
 *
 * The first-step card was drawn INSIDE the floor (`canvasRef`), whose `onCanvasPointerDown` captures every press for
 * its pan (`setPointerCapture`). A captured pointer's `click` is dispatched to the floor, so the step under the finger
 * never heard it. #8055 made the card keep its presses to itself.
 *
 * ⚠ SAME FILE NAME AS #8055's GUARD, ON PURPOSE. The Guests redesign (owner 2026-11-20, "nothing depends on pressing
 * the floor") renamed the steps ("Seat everyone for me", "Add a table") and took them OFF the floor in Guests, so
 * #8055's two label assertions can no longer be true. If both land, git must STOP on this file (take this one) rather
 * than let a guard that cannot pass reach `main` quietly. The claim is the same, and stronger:
 *   · in Guests no step is on the floor at all — a press cannot be captured by a floor it is not in;
 *   · anywhere else the card at the floor's foot still keeps its presses from the pan (#8055's fix, kept).
 * The whole of the new first step is held by `the-empty-floor-starts-in-one-tap.test.ts`.
 *
 * Sabotage (each goes red): draw the card on the floor in Guests · drop the foot card's `onPointerDown` · make it not
 * stop propagation · drop the floor's capture (then this test's premise is stale — re-read it).
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

test('the empty floor’s steps are off the floor in Guests, and keep their presses from it anywhere else', () => {
  const at = ed.indexOf('{tables.length === 0 ? (');
  assert.ok(at > 0, 'the empty-floor branch is gone');
  const branch = ed.slice(at, ed.indexOf('{tables.map(', at));
  assert.match(branch, /inGuests \? null : \(/, 'in Guests the steps are on the floor again — its capture swallows their taps');
  const card = branch.indexOf('data-floor-steps=""');
  assert.ok(card > 0, 'the steps card is not marked data-floor-steps (or moved out of the empty-floor branch)');
  const tag = branch.slice(card, branch.indexOf('>', branch.indexOf('className=', card)));
  assert.match(tag, /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/, 'a press on a step still reaches the floor’s capture');
  assert.match(branch.slice(card), /<FloorStartCard \{\.\.\.startProps\} \/>/, 'the steps are not inside the guarded card');
  const start = stripComments(readFileSync(join(HERE, 'seat-floor-start.tsx'), 'utf8'));
  assert.match(start, /label="Seat everyone for me"/);
  assert.match(start, /label="Add a table"/);
});
