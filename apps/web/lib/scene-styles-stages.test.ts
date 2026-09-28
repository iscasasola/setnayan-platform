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

import { STAGE_SCENE_STYLE_SETS, recommendedStageSceneStyle } from './scene-styles-stages';
import { defaultSceneStyle, resolveSceneStyle, sceneStyleSet, sceneStylesOn, sceneStyleTypeOfWidget } from './scene-styles';
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
  entourage: 'entourage-section.tsx',
  find_your_seat: 'your-seat-block.tsx',
  photos_of_you: 'photos-of-you-gallery.tsx',
  announcements: 'day-of-announcement.tsx',
  live_hub: 'live-hub-styles.tsx',
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

test('3 · the DEFAULT is the shipped look (style A) on every stage — a live page does not change on deploy', () => {
  for (const set of STAGE_SCENE_STYLE_SETS) {
    const shipped = set.styles[0]!.id;
    const stages = new Set(set.styles.flatMap((s) => s.stages ?? []));
    for (const stage of stages) {
      for (const eventType of [null, 'wedding', 'debut', 'birthday', 'funeral']) {
        assert.equal(defaultSceneStyle(set.type, stage, eventType), shipped, `${set.type} on ${stage} (${eventType}) defaults to ${defaultSceneStyle(set.type, stage, eventType)}`);
      }
    }
  }
});

test('3b · the prototype’s Recommended is a HINT, and only ever names a style drawn there', () => {
  const cases: Array<[string, 'save_the_date' | 'rsvp' | 'event', string | null, string | null]> = [
    ['countdown', 'save_the_date', null, 'big-number'],
    ['countdown', 'rsvp', null, 'four-tiles'],
    ['our_love_story', 'save_the_date', null, 'years'],
    ['event_details', 'rsvp', 'wedding', 'card'],
    ['event_details', 'rsvp', 'birthday', 'plate'],
    ['schedule', 'event', null, 'one-per-screen'],
    ['schedule', 'rsvp', null, 'programme-rail'],
    ['photo_moments', 'event', null, 'down-the-day'],
    ['rsvp', 'rsvp', null, 'question'],
    ['dress_code', 'rsvp', null, null],
  ];
  for (const [type, stage, eventType, id] of cases) {
    assert.equal(recommendedStageSceneStyle(type, stage, eventType), id, `${type} on ${stage}`);
    if (id) assert.ok(sceneStylesOn(type, stage, eventType).some((s) => s.id === id), `${type}.${id} is drawn on ${stage}`);
    const shipped = STAGE_SCENE_STYLE_SETS.find((x) => x.type === type)!.styles[0]!.id;
    assert.equal(resolveSceneStyle(type, stage, undefined, eventType), shipped, `${type}: with no pick the shipped look draws, not the recommendation`);
  }
  const row = readFileSync(join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'scene-style-row.tsx'), 'utf8');
  assert.match(stripComments(row), /recommendedId=\{recommendedStageSceneStyle\(type, stage, eventType\)\}/, 'the Style row carries the hint');
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

test('5 · the five fixed parts are registered, three styles each where guests meet them', () => {
  for (const [type, stages] of [
    ['entourage', ['rsvp', 'event']],
    ['find_your_seat', ['event']],
    ['photos_of_you', ['event']],
    ['announcements', ['rsvp', 'event']],
    ['live_hub', ['event']],
  ] as const) {
    assert.ok(sceneStyleSet(type), `${type} is registered`);
    for (const stage of stages) assert.ok(sceneStylesOn(type, stage, 'wedding').length >= 3, `${type} on ${stage}`);
    assert.equal(sceneStylesOn(type, 'save_the_date').length, 0, `${type} is not on the Save the Date`);
  }
  assert.ok(!sceneStylesOn('entourage', 'event', 'birthday').some((s) => s.id === 'two-sides'), 'two sides is a wedding style');
  assert.equal(recommendedStageSceneStyle('find_your_seat', 'event', null), 'table-number');
});
