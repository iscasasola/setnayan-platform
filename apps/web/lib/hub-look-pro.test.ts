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
  sectionBackgroundChange,
  siteLookChange,
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

/* ── Owner, 2026-09-24, verbatim: "changing background color is free. making
   media a background is pro." Both halves, for a FREE couple. ─────────────── */

test('a free couple CAN set a colour background on a section', () => {
  for (const currentMedia of [null, 'r2://setnayan-media/events/E/a.jpg']) {
    const c = sectionBackgroundChange({ currentMedia, kind: 'color', nextMedia: null });
    assert.equal(lookWriteAllowed(false, c), true, `colour over ${currentMedia ?? 'nothing'}`);
  }
});

test('a free couple CANNOT set a photo or snippet background on a section', () => {
  for (const kind of ['photo', 'snippet'] as const) {
    const add = sectionBackgroundChange({ currentMedia: null, kind, nextMedia: 'r2://m/a' });
    const swap = sectionBackgroundChange({ currentMedia: 'r2://m/a', kind, nextMedia: 'r2://m/b' });
    assert.equal(lookWriteAllowed(false, add), false, `${kind}: add`);
    assert.equal(lookWriteAllowed(false, swap), false, `${kind}: swap`);
    assert.equal(lookWriteAllowed(true, add), true, `${kind}: a Pro couple may`);
    // ...but may always take one down.
    const off = sectionBackgroundChange({ currentMedia: 'r2://m/a', kind, nextMedia: null });
    assert.equal(lookWriteAllowed(false, off), true, `${kind}: remove`);
  }
});

/* Event Hub Maker plan, Phase 0 ④: "a `color` scene background of
   `none|remove|add|change` is never Pro". Every shape a COLOUR write can take —
   no colour → none, colour off, a colour where there was none, one colour for
   another — over no media, over a photo, and even carrying a stray media ref
   in the POST, classifies as a change a FREE couple may make. */
test('a colour scene background is never Pro — none · remove · add · change', () => {
  const COLOUR_SHAPES = [
    { shape: 'none', stored: null, next: null },
    { shape: 'remove', stored: '#a9834b', next: null },
    { shape: 'add', stored: null, next: '#a9834b' },
    { shape: 'change', stored: '#a9834b', next: '#35403a' },
  ] as const;
  for (const { shape } of COLOUR_SHAPES) {
    for (const currentMedia of [null, 'r2://setnayan-media/events/E/a.jpg']) {
      for (const nextMedia of [null, '', 'r2://setnayan-media/events/E/b.jpg']) {
        const c = sectionBackgroundChange({ currentMedia, kind: 'color', nextMedia });
        const label = `colour ${shape} · over ${currentMedia ?? 'nothing'} · posted ${nextMedia || 'no media'}`;
        assert.ok(c === 'none' || c === 'remove', `${label} classified '${c}'`);
        assert.equal(lookWriteAllowed(false, c), true, label);
      }
    }
  }
});

const STORED = { button: null, font: null, magic: null, art: null };
const UNTOUCHED = { button: undefined, font: undefined, magic: undefined, art: null };
type Next = {
  button: string | null | undefined;
  font: string | null | undefined;
  magic: string | null | undefined;
  art: string | null;
};

test('the page background colour is free — it is not even an input to the decision', () => {
  // A free couple's panel posts ONLY bg_color: every Pro field is absent.
  assert.equal(siteLookChange(STORED, UNTOUCHED), 'none');
  assert.equal(lookWriteAllowed(false, siteLookChange(STORED, UNTOUCHED)), true);
  // ...even when they already hold Pro choices, which the save leaves alone.
  const held = { button: '#111111', font: 'cormorant', magic: 'monogram', art: 'candlelight' };
  assert.equal(siteLookChange(held, UNTOUCHED), 'none');
  assert.equal(hubColumnKind('site_bg_color'), 'free-look');
});

test('button colour, face, art direction and magic move stay Pro', () => {
  const free = (next: Partial<Next>) =>
    lookWriteAllowed(false, siteLookChange(STORED, { ...UNTOUCHED, ...next }));
  assert.equal(free({ button: '#000000' }), false);
  assert.equal(free({ font: 'cormorant' }), false);
  assert.equal(free({ magic: 'monogram' }), false);
  assert.equal(free({ art: 'candlelight' }), false);
  // Daylight IS the page we write — choosing it adds nothing.
  assert.equal(free({ art: 'daylight' }), true);
  // Re-posting what is stored, or taking a choice off, is always allowed.
  const held = { button: '#111111', font: 'cormorant', magic: 'monogram', art: 'candlelight' };
  assert.equal(siteLookChange(held, { ...held }), 'none');
  assert.equal(
    siteLookChange(held, { button: null, font: null, magic: null, art: 'daylight' }),
    'remove',
  );
  assert.equal(siteLookChange(held, { ...UNTOUCHED, button: '#222222' }), 'change');
  for (const c of [
    'site_button_color',
    'site_font_key',
    'site_art_direction',
    'site_magic_traveller',
    'rsvp_backdrop',
  ]) {
    assert.equal(hubColumnKind(c), 'look', c);
  }
});

test('canvas: motion is a subset of look, and "has motion" reads only motion keys', () => {
  for (const k of HUB_CANVAS_MOTION_KEYS) {
    assert.ok((HUB_CANVAS_LOOK_KEYS as readonly string[]).includes(k), k);
  }
  assert.equal(canvasHasMotion({}), false);
  assert.equal(canvasHasMotion({ media: 'r2://x', focal: 5, zoom: 120 }), false);
  assert.equal(canvasHasMotion({ preset: 'calm' }), true);
  assert.equal(canvasHasMotion({ timeline: 'scrub' }), true);
  // Scroll · Scrub · Auto (#5951) is motion: a free couple's Reset takes it off.
  assert.equal(canvasHasMotion({ transition: 'scrub' }), true);
  assert.equal(canvasHasMotion({ transition: 'auto', autoSpeed: 'slow' }), true);
  // A COLOUR ground is not motion, and not a Pro look key either.
  assert.equal(canvasHasMotion({ kind: 'color', color: '#a9834b' }), false);
  assert.ok(!(HUB_CANVAS_LOOK_KEYS as readonly string[]).includes('color'));
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
