/**
 * a-moment-keeps-its-anchor.test.ts — A MOMENT FORM KEEPS EVERY ANCHOR THE STORY HAS.
 *
 * Found 2026-10-08 while building the Love Story's Timeline row (every row edit is a moment form):
 * `momentFromForm` read the form's anchor as `'met' | 'yes'`, a list written before the owner added the third
 * chapter anchor on 2026-10-01 (*"when did you 2 became together?"*, `MOMENT_ANCHORS`). So a moment marked
 * "Together" was SAVED WITH NO ANCHOR — on an add and on every later edit, on the server and in the Maker alike
 * (`applyMomentIntent` is the one function both use) — and its chapter fell back to whatever its date said. The
 * sheet closed as if it had been kept.
 *
 * The rule: the form's anchor is asked of the ONE list (`isMomentAnchor`), so a fourth anchor cannot be forgotten
 * the same way. RUN for every anchor, through the same function the action and the Maker call.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { applyMomentIntent } from './love-story-moment-intent';
import { MOMENT_ANCHORS, chapterOf, type LoveStoryMoment } from './love-story-moments';

const form = (fields: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

test('an added moment keeps the anchor it was given — every anchor the story has, "Together" included', () => {
  assert.deepEqual([...MOMENT_ANCHORS], ['met', 'together', 'yes'], 'anti-vacuity: the anchors changed — read this test again');
  for (const anchor of MOMENT_ANCHORS) {
    const r = applyMomentIntent([], 'add', form({ date_y: '2020', line: 'The ferry from Coron.', anchor }), () => 0.5);
    assert.ok(r.ok, `adding a ${anchor} moment was refused`);
    if (!r.ok) continue;
    assert.equal(r.touched?.anchor, anchor, `a moment added as "${anchor}" was saved without its anchor`);
    assert.equal(chapterOf(r.touched!, r.after), anchor, `a "${anchor}" moment does not sit in its own chapter`);
  }
});

test('an edit of an anchored moment keeps its anchor (a year changed never un-anchors "Together")', () => {
  for (const anchor of MOMENT_ANCHORS) {
    const held: LoveStoryMoment = { id: 'm1', date: { y: 2020 }, line: 'The ferry from Coron.', anchor, canvas: {} };
    const r = applyMomentIntent([held], 'edit', form({ id: 'm1', date_y: '2021', line: held.line, anchor }));
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.after[0]!.anchor, anchor, `editing a "${anchor}" moment dropped its anchor`);
  }
  // No anchor, an empty one and a made-up one all mean "a moment" — nothing invented.
  for (const anchor of ['', 'wedding', 'MET']) {
    const r = applyMomentIntent([], 'add', form({ date_y: '2020', line: 'x', anchor }), () => 0.5);
    assert.ok(r.ok && r.touched && !('anchor' in r.touched), `"${anchor}" was kept as an anchor`);
  }
  // Still one of each: tagging a second "Together" moves the tag.
  const first: LoveStoryMoment = { id: 'm1', date: { y: 2020 }, line: 'a', anchor: 'together', canvas: {} };
  const r = applyMomentIntent([first], 'add', form({ date_y: '2021', line: 'b', anchor: 'together' }), () => 0.5);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.after.map((m) => m.anchor), [undefined, 'together']);
});

test('the form’s anchor is asked of the ONE list — never spelled out beside it', () => {
  const src = stripComments(readFileSync(join(__dirname, 'love-story-moment-intent.ts'), 'utf8'));
  assert.match(src, /const anchor = isMomentAnchor\(anchorRaw\) \? anchorRaw : undefined;/);
  assert.doesNotMatch(src, /anchorRaw === '/, 'the anchors are spelled out again — the next one added will be dropped');
});
