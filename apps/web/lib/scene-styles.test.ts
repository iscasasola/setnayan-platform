/**
 * THE ONE SCENE-STYLE REGISTRY — owner 2026-09-29, verbatim: *"we want at least
 * 3 choices for each scene that are premade. even the countdown and other
 * scenes"* (DECISION_LOG "EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE
 * STYLES") and *"those are all designs that we they can pick from. all should
 * work"* (Post Event). Held here:
 *
 *   1. every registered scene type offers at least three styles, with
 *      permanent semantic ids (never letters), unique within the type;
 *   2. two files registering the same style id make ONE style drawn on the
 *      union of their stages — one value across stages;
 *   3. a pick is drawn only where its style is drawn; elsewhere the stage's
 *      default, and the pick is kept;
 *   4. the stored key is `canvas.style` — sanitised like `canvas.template`,
 *      FREE (not a Pro look key), and a style alone never frames a scene;
 *   5. Post Event's defaults are the prototype's Recommended.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SCENE_STYLE_SETS,
  defaultSceneStyle,
  mergeSceneStyleSets,
  resolveSceneStyle,
  sanitizeSceneStyleId,
  sceneStyleOptions,
  sceneStyleTypeOfWidget,
  sceneStylesOn,
  type SceneStyleSet,
} from './scene-styles';
import { hasHubCanvas, sanitizeHubCanvas } from './hub-canvas';
import { HUB_CANVAS_LOOK_KEYS, canvasHasMotion } from './hub-look-pro';
import { canvasLookChange } from './hub-draft';
import { postEventSceneTypeOf, postEventStyleHome, resolvePostEventStyle } from './post-event-styles';

test('1 · every registered scene type offers at least three styles, each with a permanent semantic id', () => {
  const sets = Object.values(SCENE_STYLE_SETS);
  assert.ok(sets.length >= 5, `only ${sets.length} scene types registered`);
  for (const set of sets) {
    assert.ok(set.styles.length >= 3, `${set.type} offers ${set.styles.length} styles — the owner asked for at least three`);
    const ids = set.styles.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${set.type} repeats a style id`);
    for (const id of ids) {
      assert.ok(!/^[a-z]$/.test(id), `${set.type}.${id} is a letter — ids are shared across stages and must say what they are`);
      assert.equal(sanitizeSceneStyleId(id), id);
    }
    for (const st of set.styles) assert.ok(st.name && st.line, `${set.type}.${st.id} has no name or line for the dropdown`);
  }
  console.log(`[scene-styles] ${sets.length} types · ${sets.reduce((n, s) => n + s.styles.length, 0)} styles`);
});

test('2 · the same style id in two files is ONE style, drawn on the union of their stages', () => {
  const post: SceneStyleSet[] = [
    {
      type: 'schedule',
      label: 'Schedule',
      styles: [
        { id: 'one-per-screen', name: 'One', line: 'x', stages: ['editorial'] },
        { id: 'timeline', name: 'T', line: 'x', stages: ['editorial'] },
      ],
      defaults: { editorial: 'one-per-screen' },
    },
  ];
  const stages: SceneStyleSet[] = [
    {
      type: 'schedule',
      label: 'Run of show',
      styles: [
        { id: 'programme-rail', name: 'Rail', line: 'x', stages: ['rsvp', 'event'] },
        { id: 'one-per-screen', name: 'One', line: 'x', stages: ['rsvp', 'event'] },
      ],
      defaults: { rsvp: 'programme-rail', editorial: 'programme-rail' },
    },
  ];
  const merged = mergeSceneStyleSets(post, stages);
  const sched = merged.schedule!;
  assert.deepEqual(sched.styles.map((s) => s.id), ['one-per-screen', 'timeline', 'programme-rail']);
  assert.deepEqual([...(sched.styles[0]!.stages ?? [])].sort(), ['editorial', 'event', 'rsvp']);
  assert.equal(sched.label, 'Schedule', 'the first file names the type');
  assert.equal(sched.defaults?.editorial, 'one-per-screen', 'a stage default set first is not overridden by a later file');
  assert.equal(sched.defaults?.rsvp, 'programme-rail');
  assert.equal(merged.schedule!.styles.find((s) => s.id === 'timeline')!.stages!.includes('rsvp'), false);
});

test('3 · a pick is drawn where its style is drawn; elsewhere the stage default — nothing invented', () => {
  // Post Event draws its own; the other stages have none registered for these yet.
  assert.equal(resolveSceneStyle('front-page', 'editorial', 'card'), 'card');
  assert.equal(resolveSceneStyle('front-page', 'editorial', 'no-such-style'), 'full-bleed', 'an unknown pick falls back to the default');
  assert.equal(resolveSceneStyle('front-page', 'editorial', '<script>'), 'full-bleed');
  assert.equal(resolveSceneStyle('front-page', 'rsvp', 'card'), null, 'a stage that draws no style of this type gets none');
  assert.equal(resolveSceneStyle('countdown-that-does-not-exist', 'rsvp', 'x'), null);
  assert.deepEqual(sceneStyleOptions('front-page', 'rsvp'), [], 'no dropdown where there is no choice');
  assert.equal(sceneStyleOptions('front-page', 'editorial').length, 3);
  assert.equal(sceneStyleOptions('front-page', 'editorial').filter((o) => o.isDefault).length, 1);
  assert.deepEqual(sceneStylesOn('front-page', 'editorial', 'birthday').length, 3, 'every Post Event style suits every event type');
  assert.equal(sceneStyleTypeOfWidget('our_photos'), 'gallery', 'the Save the Date photos ARE the gallery — one value');
  assert.equal(sceneStyleTypeOfWidget('countdown'), 'countdown');
});

test('4 · canvas.style is sanitised like canvas.template, FREE, and never frames a scene on its own', () => {
  assert.equal(sanitizeHubCanvas({ canvas: { style: 'one-per-screen' } }).style, 'one-per-screen');
  assert.equal(sanitizeHubCanvas({ canvas: { style: 'Bad Id' } }).style, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { style: 7 } }).style, undefined);
  assert.equal(sanitizeHubCanvas({ canvas: { style: `a${'b'.repeat(40)}` } }).style, undefined);
  assert.ok(!(HUB_CANVAS_LOOK_KEYS as readonly string[]).includes('style'), 'a style pick is never a Pro look key');
  assert.equal(canvasLookChange({}, { style: 'mosaic' }), 'none', 'picking a style is free');
  assert.equal(canvasLookChange({ style: 'grid' }, { style: 'mosaic' }), 'none', 'changing a style is free');
  assert.equal(hasHubCanvas({ style: 'mosaic' }), false, 'a style alone must not frame the scene (and bring motion nobody chose)');
  assert.equal(canvasHasMotion({ style: 'mosaic' }), false);
});

test('5 · Post Event: each scene maps to its type, the default is the prototype’s Recommended', () => {
  const rec: Record<string, string> = {
    cover: 'full-bleed',
    numbers: 'big-numbers',
    'ch-3': 'one-per-screen',
    chapters: 'one-per-screen',
    gallery: 'grid',
    couple: 'letter',
  };
  for (const [scene, id] of Object.entries(rec)) {
    assert.equal(resolvePostEventStyle(scene, undefined), id, `${scene} defaults to ${id}`);
    assert.equal(defaultSceneStyle(postEventSceneTypeOf(scene), 'editorial'), id);
  }
  // A type whose styles are not drawn yet offers nothing — its shipped block stays.
  assert.equal(resolvePostEventStyle('you', 'grid'), null, 'an auto extra keeps its one look — no dropdown');
  assert.equal(resolvePostEventStyle('song', undefined), null);
  // Schedule and Gallery share one value with the section of the same name.
  assert.equal(postEventStyleHome('ch-2'), 'schedule');
  assert.equal(postEventStyleHome('gallery'), 'our_photos');
  assert.equal(postEventStyleHome('numbers'), null);
});
