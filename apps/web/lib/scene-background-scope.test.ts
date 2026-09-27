/**
 * scene-background-scope.test.ts — "JUST THIS SCENE" OR "EVERY SCENE", AND
 * "EVERY SCENE" MEANS THIS STAGE.
 *
 * Owner, 2026-09-27: *"setting a background for one can be asked if they want
 * to apply it to all or just this"* · the chip *"Own background · ↺ Use the
 * Event Hub's"* · and answer 6 on the approved prototype: *"this stage"*.
 * What this proves:
 *
 *   1. Every scene puts the picked background on every scene OF THIS STAGE —
 *      and only there: a scene that is not on the stage is not in the patch;
 *   2. it changes only the background — each scene's motion, words, parts and
 *      shape ride along — and clears every "own" mark;
 *   3. Just this scene marks the scene `own`, which survives the sanitizer and
 *      makes the chip show;
 *   4. ↺ Use the Event Hub's returns an own scene to the background its
 *      stage-mates share — or, when they do not share one, to none (the
 *      theme's) — never a guess between two;
 *   5. the state line reads "every" only when every scene of the stage wears it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import {
  everySceneBackgroundPatch,
  justThisSceneCanvas,
  sceneBackgroundScope,
  sharedStageBackground,
  useHubBackgroundCanvas,
} from './scene-background-scope';

const c = (raw: Record<string, unknown>): HubSectionCanvas => sanitizeHubCanvas({ canvas: raw });

const frosted = c({ kind: 'frost', color: '#f4ecdd', opacity: 60 });
const invitation = [
  { type: 'countdown', canvas: frosted },
  { type: 'message', canvas: c({ kind: 'color', color: '#112233', preset: 'calm', elements: { heading: { color: '#ffffff' } } }) },
  { type: 'dress_code', canvas: c({ kind: 'glass', color: '#ffffff', shape: 'full', own: true }) },
];

test('Every scene puts the background on every scene of THIS stage — and only this stage', () => {
  const patch = everySceneBackgroundPatch(invitation, frosted);
  assert.deepEqual(Object.keys(patch.widgets).sort(), ['countdown', 'dress_code', 'message']);
  assert.equal(patch.widgets.gallery, undefined, 'a scene of another stage is never in the patch');
  for (const { canvas } of Object.values(patch.widgets)) {
    assert.equal(canvas.kind, 'frost');
    assert.equal(canvas.color, '#f4ecdd');
    assert.equal(canvas.opacity, 60);
    assert.equal(canvas.own, undefined, 'every scene means every scene: no "own" is kept');
  }
});

test('Every scene changes only the background — motion, words, parts and shape ride along', () => {
  const patch = everySceneBackgroundPatch(invitation, frosted);
  assert.equal(patch.widgets.message!.canvas.preset, 'calm');
  assert.deepEqual(patch.widgets.message!.canvas.elements, { heading: { color: '#ffffff' } });
  assert.equal(patch.widgets.dress_code!.canvas.shape, 'full', 'Framed / Full width is the Shape row, kept per scene');
});

test('Just this scene marks the scene as its own, and the chip shows', () => {
  const own = justThisSceneCanvas(invitation[1]!.canvas);
  assert.equal(own.own, true);
  assert.equal(own.kind, 'color');
  assert.equal(sanitizeHubCanvas({ canvas: own }).own, true, 'the mark survives the sanitizer');
  assert.equal(sceneBackgroundScope(invitation, 'message', own), 'own');
  // With no background there is nothing to call "own".
  assert.equal(c({ own: true }).own, undefined);
});

test('↺ Use the Event Hub’s returns to what the stage shares — or to none, never a guess', () => {
  const agreeing = [
    { type: 'countdown', canvas: frosted },
    { type: 'message', canvas: frosted },
    { type: 'dress_code', canvas: c({ kind: 'color', color: '#8a1c2b', own: true }) },
  ];
  const back = useHubBackgroundCanvas(agreeing, 'dress_code', agreeing[2]!.canvas);
  assert.equal(back.kind, 'frost');
  assert.equal(back.color, '#f4ecdd');
  assert.equal(back.own, undefined);
  // The stage-mates disagree (and one is itself own): the scene goes back to none.
  assert.equal(sharedStageBackground(invitation, 'dress_code'), null);
  const none = useHubBackgroundCanvas(invitation, 'dress_code', invitation[2]!.canvas);
  assert.equal(none.kind, undefined);
  assert.equal(none.shape, undefined, 'no box, so no shape');
});

test('the state line says "every" only when every scene of the stage wears it', () => {
  const all = Object.entries(everySceneBackgroundPatch(invitation, frosted).widgets).map(([type, w]) => ({ type, canvas: w.canvas }));
  assert.equal(sceneBackgroundScope(all, 'message', all.find((s) => s.type === 'message')!.canvas), 'every');
  assert.equal(sceneBackgroundScope(invitation, 'countdown', frosted), 'mixed');
});
