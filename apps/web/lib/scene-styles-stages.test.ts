/**
 * THE SAVE THE DATE · INVITATION · THE DAY STYLES, AS REGISTERED
 * (`lib/scene-styles-stages.ts`) — owner 2026-09-29, "EVERY SCENE ON EVERY
 * STAGE HAS AT LEAST THREE PREMADE STYLES".
 *
 * Three things are held here:
 *   1. every scene registered for a stage offers at least three styles THERE;
 *   2. every style registered is actually DRAWN — its id is dispatched by the
 *      scene's own component (a pick that changes nothing is the "failure that
 *      renders like success" disease);
 *   3. the defaults are the prototype's Recommended, and the names shared with
 *      Post Event are ONE style across stages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STAGE_SCENE_STYLE_SETS } from './scene-styles-stages';
import { defaultSceneStyle, sceneStyleSet, sceneStylesOn, sceneStyleTypeOfWidget } from './scene-styles';
import { stripComments } from './strip-comments';

const COMPONENTS = join(__dirname, '..', 'app', '[slug]', '_components');

/** The component that draws each type — where its `sceneStyle` is dispatched. */
const RENDERER: Record<string, string> = {
  countdown: 'countdown.tsx',
  special_message: 'special-message-widget.tsx',
  our_love_story: 'our-love-story-widget.tsx',
  event_details: 'empty-states.tsx',
  schedule: 'schedule-widget.tsx',
  venue_map: 'venue-widget.tsx',
  dress_code: 'dress-code-widget.tsx',
  what_to_bring: 'what-to-bring-widget.tsx',
  photo_moments: 'photo-moments-widget.tsx',
  rsvp: 'rsvp-widget.tsx',
  gallery: 'our-photos-widget.tsx',
};

test('1 · every registered scene offers at least three styles on every stage it is drawn on', () => {
  assert.ok(STAGE_SCENE_STYLE_SETS.length >= 11, 'the sets were registered');
  for (const set of STAGE_SCENE_STYLE_SETS) {
    const stages = new Set(set.styles.flatMap((s) => s.stages ?? []));
    assert.ok(stages.size > 0, `${set.type} names the stages it is drawn on`);
    for (const stage of stages) {
      const on = sceneStylesOn(set.type, stage);
      assert.ok(on.length >= 3, `${set.type} offers ${on.length} styles on ${stage}`);
    }
  }
});

test('2 · every style registered here is DRAWN — its id is dispatched by the scene’s component', () => {
  for (const set of STAGE_SCENE_STYLE_SETS) {
    const file = RENDERER[set.type];
    assert.ok(file, `${set.type} has no renderer named in this test`);
    const src = stripComments(readFileSync(join(COMPONENTS, file), 'utf8'));
    const [shipped, ...added] = set.styles;
    assert.ok(shipped, `${set.type} has a shipped style`);
    for (const st of added) {
      assert.ok(src.includes(`'${st.id}'`), `${set.type}.${st.id} is registered but ${file} never draws it`);
    }
  }
});

test('3 · the defaults are the prototype’s Recommended', () => {
  const cases: Array<[string, 'save_the_date' | 'rsvp' | 'event', string]> = [
    ['countdown', 'save_the_date', 'big-number'],
    ['countdown', 'rsvp', 'four-tiles'],
    ['our_love_story', 'save_the_date', 'years'],
    ['our_love_story', 'rsvp', 'chapters'],
    ['special_message', 'rsvp', 'note'],
    ['event_details', 'rsvp', 'plate'],
    ['schedule', 'rsvp', 'programme-rail'],
    ['schedule', 'event', 'one-per-screen'],
    ['venue_map', 'rsvp', 'map-and-plate'],
    ['dress_code', 'rsvp', 'colours-and-roles'],
    ['what_to_bring', 'rsvp', 'note'],
    ['photo_moments', 'event', 'down-the-day'],
    ['rsvp', 'rsvp', 'question'],
    ['gallery', 'save_the_date', 'mosaic'],
  ];
  for (const [type, stage, id] of cases) assert.equal(defaultSceneStyle(type, stage), id, `${type} on ${stage}`);
});

test('4 · names shared with Post Event are ONE style, drawn on both', () => {
  const sched = sceneStyleSet('schedule')!;
  for (const id of ['one-per-screen', 'clock-face']) {
    const st = sched.styles.find((s) => s.id === id)!;
    assert.ok(st.stages?.includes('editorial') && st.stages.includes('rsvp') && st.stages.includes('event'), id);
  }
  assert.equal(sceneStyleTypeOfWidget('our_photos'), 'gallery');
  const gal = sceneStyleSet('gallery')!;
  for (const id of ['grid', 'mosaic', 'film-strip']) {
    const st = gal.styles.find((s) => s.id === id)!;
    assert.ok(st.stages?.includes('editorial') && st.stages.includes('save_the_date'), id);
  }
});

test('5 · a part with no section row has no dropdown — its pick would have nowhere to live', () => {
  for (const type of ['entourage', 'find_your_seat', 'photos_of_you', 'announcements', 'live_hub']) {
    assert.equal(sceneStyleSet(type), null, `${type} is registered but has no canvas.style to save a pick in`);
  }
});
