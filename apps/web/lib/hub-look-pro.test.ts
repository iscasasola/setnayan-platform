/**
 * hub-look-pro.test.ts — the decision itself, executed.
 *
 * Owner, 2026-09-24 ("A"): *"Free is the page we write. Pro is changing how it
 * looks."* Every Event Hub look writer asks `lookWriteAllowed` with the change it
 * is about to make. These tests run that function — and the four classifiers
 * that feed it — against both a free couple and an OWNING one, because a gate
 * that can only answer one way renders exactly like a gate that works.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HUB_CANVAS_LOOK_KEYS,
  HUB_CANVAS_MOTION_KEYS,
  HUB_LOOK_EVENT_COLUMNS,
  HUB_WORDS_EVENT_COLUMNS,
  canvasHasMotion,
  combineChanges,
  galleryChange,
  hubColumnKind,
  lookWriteAllowed,
  refChange,
  siteColorsChange,
  type LookChange,
} from './hub-look-pro';

const ALL: LookChange[] = ['none', 'remove', 'add', 'change'];

test('a Pro couple may make every look write', () => {
  for (const c of ALL) assert.equal(lookWriteAllowed(true, c), true, c);
});

test('a free couple may keep or take off a look, never add or change one', () => {
  assert.equal(lookWriteAllowed(false, 'none'), true);
  assert.equal(lookWriteAllowed(false, 'remove'), true);
  assert.equal(lookWriteAllowed(false, 'add'), false);
  assert.equal(lookWriteAllowed(false, 'change'), false);
});

test('refChange — one stored ref against the next', () => {
  assert.equal(refChange(null, null), 'none');
  assert.equal(refChange(null, ''), 'none');
  assert.equal(refChange(undefined, '   '), 'none');
  assert.equal(refChange(null, 'r2://a'), 'add');
  assert.equal(refChange('', 'r2://a'), 'add');
  assert.equal(refChange('r2://a', 'r2://a'), 'none');
  assert.equal(refChange('r2://a', 'r2://b'), 'change');
  assert.equal(refChange('r2://a', null), 'remove');
  assert.equal(refChange('r2://a', ''), 'remove');
});

test('combineChanges — a save is only as free as its most demanding part', () => {
  assert.equal(combineChanges(), 'none');
  assert.equal(combineChanges('none', 'none'), 'none');
  assert.equal(combineChanges('none', 'remove'), 'remove');
  assert.equal(combineChanges('remove', 'change'), 'change');
  assert.equal(combineChanges('change', 'add', 'remove'), 'add');
  // The living hero: a free couple's re-save of what is stored passes, a new
  // still with an unchanged clip does not.
  assert.equal(lookWriteAllowed(false, combineChanges(refChange('v', 'v'), refChange('s', 's'))), true);
  assert.equal(lookWriteAllowed(false, combineChanges(refChange('v', 'v'), refChange('s', 't'))), false);
});

test('galleryChange — out is free, in or reordered is Pro', () => {
  const cur = ['a', 'b', 'c'];
  assert.equal(galleryChange(cur, ['a', 'b', 'c']), 'none');
  assert.equal(galleryChange([], []), 'none');
  assert.equal(galleryChange(cur, ['a', 'c']), 'remove');
  assert.equal(galleryChange(cur, []), 'remove');
  assert.equal(galleryChange(cur, ['c']), 'remove');
  assert.equal(galleryChange(cur, ['c', 'a']), 'change', 'a reorder changes how it looks');
  assert.equal(galleryChange(cur, ['a', 'b', 'c', 'd']), 'add');
  assert.equal(galleryChange(cur, ['d']), 'add', 'a swap is an addition');
  assert.equal(galleryChange([], ['a']), 'add');
  // The grandfather the 2026-07-24 rule allowed and 2026-09-24 closes: a free
  // couple WITH a gallery adding one more photo.
  assert.equal(lookWriteAllowed(false, galleryChange(cur, [...cur, 'd'])), false);
  assert.equal(lookWriteAllowed(false, galleryChange(cur, ['b'])), true);
});

test('siteColorsChange — only putting EVERYTHING back to ours is a reset', () => {
  const reset = { bg: null, button: null, font: undefined, magic: undefined, art: null };
  assert.equal(siteColorsChange(reset), 'remove');
  assert.equal(siteColorsChange({ ...reset, font: null, magic: null }), 'remove');
  assert.equal(siteColorsChange({ ...reset, bg: '#a9834b' }), 'change');
  assert.equal(siteColorsChange({ ...reset, button: '#000000' }), 'change');
  assert.equal(siteColorsChange({ ...reset, font: 'cormorant' }), 'change');
  assert.equal(siteColorsChange({ ...reset, magic: 'monogram' }), 'change');
  assert.equal(siteColorsChange({ ...reset, art: 'candlelight' }), 'change');
});

test('canvas: motion is a subset of look, and "has motion" reads only motion keys', () => {
  for (const k of HUB_CANVAS_MOTION_KEYS) {
    assert.ok((HUB_CANVAS_LOOK_KEYS as readonly string[]).includes(k), k);
  }
  assert.equal(canvasHasMotion({}), false);
  assert.equal(canvasHasMotion({ media: 'r2://x', focal: 5, zoom: 120 }), false);
  assert.equal(canvasHasMotion({ preset: 'calm' }), true);
  assert.equal(canvasHasMotion({ timeline: 'scrub' }), true);
});

test('look and words never overlap — a column is one or the other', () => {
  for (const c of HUB_LOOK_EVENT_COLUMNS) {
    assert.ok(!(HUB_WORDS_EVENT_COLUMNS as readonly string[]).includes(c), c);
    assert.equal(hubColumnKind(c), 'look', c);
  }
  for (const c of HUB_WORDS_EVENT_COLUMNS) assert.equal(hubColumnKind(c), 'words', c);
  // The words the owner named stay free: story, dress code, venue, schedule.
  for (const c of ['love_story', 'dress_code_config', 'venue_name', 'event_date', 'special_message']) {
    assert.equal(hubColumnKind(c), 'words', c);
  }
  // The looks the ruling named are Pro.
  for (const c of ['landing_page_hero_image_url', 'landing_page_hero_video_r2_key', 'our_photos', 'std_media']) {
    assert.equal(hubColumnKind(c), 'look', c);
  }
  assert.equal(hubColumnKind('slug'), 'other');
});
