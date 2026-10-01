/**
 * A STYLE OFFERED IS A STYLE DRAWN — owner 2026-09-29, verbatim: *"those are all
 * designs that we they can pick from. all should work"*.
 *
 * The Maker offers a scene exactly the styles the registry holds for its type
 * (`lib/scene-styles-post-event.ts`). A registered style whose renderer has no
 * branch would be a pick that changes nothing — the "failure that renders like
 * success" disease. So every registered Post Event style must be named by a
 * branch in the scene views, and every type must be drawn by a scene the page
 * mounts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { POST_EVENT_SCENE_STYLE_SETS } from './scene-styles-post-event';
import { postEventSceneTypeOf } from './post-event-styles';

const DIR = join(__dirname, '../app/[slug]/_components/editorial');
const RAW = ['post-event-scene-views.tsx', 'post-event-scene-views-2.tsx', 'post-event-scene-views-3.tsx']
  .map((f) => readFileSync(join(DIR, f), 'utf8'))
  .join('\n');
const CODE = stripComments(RAW);

test('every registered Post Event style has its own branch — or is its type’s default fall-through', () => {
  let drawn = 0;
  for (const set of POST_EVENT_SCENE_STYLE_SETS) {
    assert.ok(set.styles.length >= 3, `${set.type}: the owner asked for at least three`);
    for (const [i, st] of set.styles.entries()) {
      const branch = CODE.includes(`style === '${st.id}'`);
      // The type's first style is its default: the function's last, unconditional
      // return — named in the comment above it so this check can find it.
      const fallThrough = i === 0 && RAW.includes(`/* ${st.id} ·`);
      assert.ok(branch || fallThrough, `${set.type}.${st.id} is offered in the Maker but never drawn`);
      drawn += 1;
    }
  }
  console.log(`[post-event] ${POST_EVENT_SCENE_STYLE_SETS.length} types · ${drawn} styles, each drawn`);
});

test('every registered type is a scene the story page mounts', () => {
  const page = stripComments(readFileSync(join(DIR, 'editorial-content.tsx'), 'utf8'));
  const SCENE_OF_TYPE: Record<string, string> = {
    'front-page': 'cover',
    'road-to-the-day': 'before',
    statistics: 'numbers',
    schedule: 'chapters',
    gallery: 'gallery',
    'photo-notes': 'wishes',
    messages: 'letters',
    'papic-challenge': 'asked',
    'supplier-stories': 'vendors',
    'live-stream': 'film',
    videos: 'videos',
    'where-everyone-sat': 'seating',
    entourage: 'entourage',
    'thank-you': 'couple',
  };
  for (const set of POST_EVENT_SCENE_STYLE_SETS) {
    const scene = SCENE_OF_TYPE[set.type];
    assert.ok(scene, `${set.type} has no scene on the page — map it here once it is mounted`);
    assert.equal(postEventSceneTypeOf(scene), set.type, `${scene} does not resolve to ${set.type}`);
    assert.ok(page.includes(`scene="${scene}"`), `${set.type}: no <PostEventSceneFrame scene="${scene}"> on the page`);
    assert.ok(page.includes(`styleOf('${scene}')`), `${set.type}: the page never asks the scene’s style`);
  }
});
