/**
 * 💎 THE PRO LOOKS IN STYLE — owner 2026-10-17 (DECISION_LOG "APPROVED — LOVE STORY, TWO VOICES"), verbatim:
 * *"Conversation as the default look, Timeline and Swipe cards as Pro looks in Style."*
 *
 * Held here:
 *   · every Pro id is a style the registry DRAWS for that scene type (a Pro mark on nothing is a lie);
 *   · the Style row's options carry `pro` for exactly those (◆ in the dropdown and on the cards);
 *   · the Apply gate asks by scene TYPE: a Pro look added or swapped grows (Pro), going back to a free look is a
 *     removal (free), and the same id on another type (`cards` on the Camera cues) is free;
 *   · `canvasFreePart` keeps a couple's free edits beside a held Pro look and drops only the look.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PRO_SCENE_STYLES, sceneStyleIsPro } from './scene-style-pro';
import { sceneStyleOptions, sceneStylesOn, defaultSceneStyle } from './scene-styles';
import { canvasFreePart, canvasLookChange, canvasLookFacets } from './hub-draft';

test('every Pro look is a style its scene type draws, and the default is never Pro', () => {
  for (const [type, ids] of Object.entries(PRO_SCENE_STYLES)) {
    for (const id of ids) {
      const drawn = (['save_the_date', 'rsvp', 'event', 'editorial'] as const).some((st) => sceneStylesOn(type, st).some((s) => s.id === id));
      assert.ok(drawn, `${type}.${id} is marked Pro but no stage draws it`);
    }
    for (const stage of ['save_the_date', 'rsvp'] as const) {
      const def = defaultSceneStyle(type, stage);
      assert.ok(!sceneStyleIsPro(type, def), `${type}'s default on ${stage} (${def}) must be free`);
    }
  }
  assert.equal(defaultSceneStyle('our_love_story', 'rsvp'), 'conversation', 'Conversation is the Love Story default');
  assert.equal(defaultSceneStyle('our_love_story', 'save_the_date'), 'conversation');
});

test('the Style options mark exactly the Pro looks', () => {
  const opts = sceneStyleOptions('our_love_story', 'rsvp');
  const pro = opts.filter((o) => o.pro).map((o) => o.id).sort();
  assert.deepEqual(pro, ['cards', 'timeline']);
  for (const free of ['chapters', 'essay', 'years', 'conversation']) {
    assert.ok(opts.some((o) => o.id === free && !o.pro), `${free} is offered and free`);
  }
  /* The same id on another scene is its own, free look. */
  assert.ok(!sceneStylesOn('photo_moments', 'event').some((o) => o.pro), 'the Camera cues’ Cards is free');
});

test('the Apply gate: a Pro look grows, going back is free, and the type decides', () => {
  assert.equal(canvasLookChange({}, { style: 'timeline' }, 'our_love_story'), 'add');
  assert.equal(canvasLookChange({ style: 'chapters' }, { style: 'cards' }, 'our_love_story'), 'add');
  assert.equal(canvasLookChange({ style: 'timeline' }, { style: 'cards' }, 'our_love_story'), 'change');
  assert.equal(canvasLookChange({ style: 'timeline' }, { style: 'conversation' }, 'our_love_story'), 'remove');
  assert.equal(canvasLookChange({}, { style: 'conversation' }, 'our_love_story'), 'none', 'the free default is free');
  assert.equal(canvasLookChange({}, { style: 'years' }, 'our_love_story'), 'none', 'a shipped free look stays free');
  assert.equal(canvasLookChange({}, { style: 'cards' }, 'photo_moments'), 'none', '`cards` on the Camera cues is free');
  assert.equal(canvasLookChange({}, { style: 'timeline' }, 'schedule'), 'none', '`timeline` on the Schedule is free');
  const facet = canvasLookFacets({}, { style: 'cards' }, 'our_love_story').find((f) => f.key === 'style');
  assert.equal(facet?.group, 'look');
});

test('a held Pro look keeps the free edits beside it', () => {
  const free = canvasFreePart({ style: 'chapters' }, { style: 'timeline', spacing: 'roomy' }, 'our_love_story');
  assert.equal(free.style, 'chapters', 'the Pro look waits for Pro');
  assert.equal(free.spacing, 'roomy', 'the free change beside it goes live');
});
