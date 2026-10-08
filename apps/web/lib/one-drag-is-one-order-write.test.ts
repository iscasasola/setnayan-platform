/**
 * one-drag-is-one-order-write.test.ts — ↕ A PART DRAGGED BY ITS GRIP IS ONE
 * ORDER WRITE, TO THE DRAFT — the work area's own move, never a second door.
 *
 * Owner, 2026-10-06, verbatim: *"they can also drag up and down and reposition
 * elements"* (plan PR 3: "drag to reorder = the shipped order write"). The
 * shipped write is the navigator's `move` (`editor-shell.tsx`): the whole
 * stage's order as ONE `hubDraftAction` save (`lib/maker-reorder.ts`
 * `stageOrderPatch` — exactly the patch the sections panel's move writes in
 * draft mode). The grip (`add-part-sheet.tsx`) asks the work area for that move
 * (`maker-part-ops.ts`) and calls it ONCE per drop; Post Event's run is one
 * draft of `sectionOrder`.
 *
 * Sabotage (seen red): call the move once per place in the grip's drop
 * (`for (…) o.move(mv.id, Math.sign(delta))`), or lend the work area's
 * form-post chain instead of `move`.
 *
 * 🔁 RE-AIMED 2026-10-09 (owner: *"on preview screen, you only select"* — no buttons on the frame;
 * `TOOLBAR-SPEC-2026-10-09.md`): the grip is gone and a part moves by the toolbar's Edit › ↑ Earlier · ↓ Later.
 * The claim is the same and so is the code that makes it true: ONE function lands a part (`dropOn`, the grip's own
 * drop, kept) and it writes once. A step calls it once; nothing else moves a picked part.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { movedOrder, stageOrderPatch } from './maker-reorder';
import { makerDropDelta, makerPostEventMoveDraft } from './maker-part-groups';
import { postEventMove, postEventRun, type PostEventArrangement } from './post-event-draft';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const SHEET = 'app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx';
const SHELL = 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx';

test('a drop is one signed move in the stage’s full order (hidden rows counted)', () => {
  const fullOrder = ['a', 'hid', 'b', 'c', 'off'];
  const shown = ['a', 'b', 'c'];
  /* c dropped above a: past b, hid and a. */
  assert.equal(makerDropDelta({ fullOrder, shown, afterLastShown: 'off', id: 'c', target: 'a', where: 'above' }), -3);
  /* a dropped below c: lands before the row after the last shown one. */
  assert.equal(makerDropDelta({ fullOrder, shown, afterLastShown: 'off', id: 'a', target: 'c', where: 'below' }), 3);
  /* a dropped below b: before c. */
  assert.equal(makerDropDelta({ fullOrder, shown, afterLastShown: 'off', id: 'a', target: 'b', where: 'below' }), 2);
  assert.equal(makerDropDelta({ fullOrder, shown, afterLastShown: 'off', id: 'b', target: 'b', where: 'above' }), 0);
  /* The move it becomes is ONE patch: every scene its place on this stage, nothing else. */
  const order = movedOrder(fullOrder, 'c', -3)!;
  const patch = stageOrderPatch(order, (id) => `t_${id}`, 'rsvp') as { widgets: Record<string, Record<string, unknown>> };
  assert.deepEqual(Object.keys(patch), ['widgets']);
  for (const w of Object.values(patch.widgets)) assert.deepEqual(Object.keys(w), ['stage_order']);
  assert.deepEqual(order, ['c', 'a', 'hid', 'b', 'off']);
});

test('a step calls the work area’s move ONCE — the one-save draft write', () => {
  const src = read(SHEET);
  const drop = src.slice(src.indexOf('const dropOn ='), src.indexOf('/* ── ＋ add a part ── */'));
  assert.ok(drop.length > 200, 'the part’s landing is drawn');
  assert.equal((drop.match(/\bo\.move\(/g) ?? []).length, 1, 'one move per landing');
  assert.doesNotMatch(drop, /\bfor\s*\(|\bwhile\s*\(|forEach/, 'never one write per place');
  assert.doesNotMatch(drop, /moveWidget(Up|Down)/, 'never the form-post chain');
  /* A step lands ONCE, on the neighbour the page draws above / below — read when the button is pressed. */
  assert.equal((drop.match(/\bdropOn\(/g) ?? []).length, 1, 'a step lands more than once');
  assert.match(drop, /const t = o && canMove \? neighbour\(o, dir\) : null;\s*if \(o && t\) dropOn\(o, t, dir < 0 \? 'above' : 'below'\);/);
  /* …and nothing else in the file moves the picked part. */
  assert.equal((src.match(/\bo\.move\(mv\.id,/g) ?? []).length, 1);
  /* …and that move IS the navigator's one-save move. */
  const shell = read(SHELL);
  const lent = shell.slice(shell.indexOf('partOps.current = {'), shell.indexOf('window.addEventListener(MAKER_PART_OPS_EVENT'));
  assert.match(lent, /[{,]\s*move\s*,/, 'the work area lends its own `move`');
  const move = shell.slice(shell.indexOf('const move = (id: string, delta: number)'), shell.indexOf('/** One step of a chain'));
  assert.match(move, /stageOrderPatch\(order/, 'the whole stage’s order, one patch');
  assert.match(move, /fd\.set\('intent', 'save'\)/, 'to the draft');
  assert.match(move, /makerSave\(\(\) => draftAction\(eventId, fd\)/, 'one save');
});

test('a Post Event scene dragged N places is ONE draft of the run', () => {
  const arr: PostEventArrangement = { sections: {}, sectionOrder: null, sceneLooks: {}, customIds: [] } as unknown as PostEventArrangement;
  const run = postEventRun(arr);
  assert.ok(run.length > 3, 'the run has blocks');
  const scene = 'wall';
  const d = makerPostEventMoveDraft(arr, scene, -2);
  assert.ok(d && Array.isArray(d.sectionOrder), 'one sectionOrder draft');
  /* Equal to two shipped single steps, composed. */
  const one = postEventMove(arr, scene, -1)!;
  const two = postEventMove({ ...arr, sectionOrder: one.sectionOrder ?? null } as PostEventArrangement, scene, -1)!;
  assert.deepEqual(d!.sectionOrder, two.sectionOrder);
  assert.equal(makerPostEventMoveDraft(arr, 'cover', 1), null, 'a fixed place does not move');
  const drop = read(SHEET);
  const pe = drop.slice(drop.indexOf("} else if (mv.kind === 'post-event' && mv.runKey && o.postEvent) {"), drop.indexOf('/* ── ＋ add a part ── */'));
  assert.equal((pe.match(/saveEditorial\(/g) ?? []).length, 1, 'one save per drop');
});
