/**
 * Post Event as scenes (Event Hub Maker Phase 8) — the compiler, the
 * conversion, the reader's gallery tabs and the open-up hash.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compilePostEventScenes,
  draftToScenes,
  galleryTabsFor,
  openUpFromHash,
  openUpHash,
  OPEN_UP_KINDS,
  postEventCoverWords,
  postEventNeedsCompile,
  postEventReader,
  postEventSceneList,
  readStoredScenes,
  withCompiledScenes,
  type PostEventSources,
} from './post-event-scenes';
import { SCENE_TEMPLATES } from './scene-templates';

const AT = '2026-12-13T06:02:00.000Z';

/** The prototype's fixture day: everything happened except the wall and reviews. */
const FULL: PostEventSources = {
  cover: 'hero',
  milestones: 4,
  metrics: { photos: 1240, guests: 186 },
  chapters: [
    { time: '8:40 AM', title: 'Getting ready', leadId: 'p1', isClip: false, media: 61 },
    { time: '2:30 PM', title: 'The vows', leadId: 'p2', isClip: true, media: 1 },
    { time: '6:05 PM', title: 'First dance', leadId: 'p3', isClip: false, media: 88 },
    { time: '7:52 PM', title: 'The toast', leadId: 'p4', isClip: false, media: 44 },
    { time: '8:30 PM', title: 'Cake', leadId: 'p5', isClip: true, media: 1 },
    { time: '9:40 PM', title: 'Speeches', leadId: 'p6', isClip: false, media: 39 },
    { time: '10:15 PM', title: 'Bouquet', leadId: 'p7', isClip: false, media: 27 },
    { time: '10:40 PM', title: 'Last dance', leadId: 'p8', isClip: true, media: 1 },
    { time: '11:02 PM', title: 'Send-off', leadId: 'p9', isClip: false, media: 18 },
    { time: '11:30 PM', title: 'After', leadId: 'p10', isClip: false, media: 9 },
  ],
  galleryPhotos: 1240,
  broadcast: true,
  films: 1,
  kwento: 42,
  challengeAnswers: 7,
  guestColumns: 3,
  vendorMedia: 6,
  liveWall: { active: false, photos: 0 },
  reviews: 0,
  services: 4,
  vendorsWeLoved: 6,
  specialMessage: true,
  song: 'Ikaw at Ako',
  whatsNext: 'First anniversary',
};

const EMPTY: PostEventSources = {
  cover: 'card',
  milestones: 0,
  metrics: { photos: null, guests: 0 },
  chapters: [],
  galleryPhotos: 0,
  broadcast: false,
  films: 0,
  kwento: 0,
  challengeAnswers: 0,
  guestColumns: 0,
  vendorMedia: 0,
  liveWall: { active: false, photos: 0 },
  reviews: 0,
  services: 0,
  vendorsWeLoved: 0,
  specialMessage: false,
  song: null,
  whatsNext: null,
};

test('the fixture day compiles to the prototype’s 25 scenes, plus the two it skips', () => {
  const { scenes, generatedAt } = compilePostEventScenes(FULL, AT);
  assert.equal(generatedAt, AT);
  const auto = scenes.filter((s) => s.status === 'auto');
  const skipped = scenes.filter((s) => s.status === 'skipped');
  assert.equal(auto.length, 25, auto.map((s) => s.key).join(','));
  assert.deepEqual(skipped.map((s) => s.key).sort(), ['said', 'wall']);
  // The prototype's template per scene (post_event_auto_story_2026-09-25.html).
  const tpl = Object.fromEntries(scenes.map((s) => [s.key, s.template]));
  assert.deepEqual(
    { cover: tpl.cover, before: tpl.before, numbers: tpl.numbers, gallery: tpl.gallery, film: tpl.film, you: tpl.you, wishes: tpl.wishes, asked: tpl.asked, letters: tpl.letters, vendors: tpl.vendors, wall: tpl.wall, said: tpl.said, powered: tpl.powered, loved: tpl.loved, couple: tpl.couple, song: tpl.song, next: tpl.next },
    { cover: 4, before: 24, numbers: 12, gallery: 21, film: 14, you: null, wishes: 23, asked: 25, letters: 22, vendors: 20, wall: 19, said: 23, powered: 8, loved: 17, couple: 11, song: 8, next: 10 },
  );
  // Chapters: a clip leads with 5; photos alternate 1 and 2 (T1 · T5 · T2 · T1 · T5 · T2 …).
  assert.deepEqual(
    scenes.filter((s) => s.block === 'chapters').map((s) => s.template),
    [1, 5, 2, 1, 5, 2, 1, 5, 2, 1],
  );
  // Every template id names a real template.
  for (const s of scenes) if (s.template !== null) assert.ok(SCENE_TEMPLATES[s.template], s.key);
  // The four open-ups, exactly.
  assert.deepEqual(
    scenes.filter((s) => s.open).map((s) => `${s.key}:${s.open}`),
    ['gallery:gallery', 'film:film', 'you:you', 'wishes:wishes'],
  );
});

test('every empty source yields a SKIPPED scene with its reason — never an empty one', () => {
  const { scenes } = compilePostEventScenes(EMPTY, AT);
  for (const s of scenes) {
    if (s.key === 'cover') {
      assert.equal(s.status, 'auto'); // the names, written — the cover is never empty
      continue;
    }
    if (s.key === 'next') {
      assert.equal(s.status, 'optional');
      assert.ok(s.note);
      continue;
    }
    assert.equal(s.status, 'skipped', s.key);
    assert.ok(s.note && s.note.length > 5, `${s.key} says why`);
    assert.equal(s.count, null, s.key);
  }
  // No captures → ONE skipped chapters row, not ten empty chapters.
  assert.equal(scenes.filter((s) => s.block === 'chapters').length, 1);
});

test('a livestream is the Watch the Film open-up; its absence is a skip', () => {
  const withLive = compilePostEventScenes({ ...EMPTY, broadcast: true }, AT).scenes.find((s) => s.key === 'film')!;
  assert.equal(withLive.status, 'auto');
  assert.equal(withLive.open, 'film');
  assert.match(withLive.source, /Live Studio replay/);
  const none = compilePostEventScenes(EMPTY, AT).scenes.find((s) => s.key === 'film')!;
  assert.equal(none.status, 'skipped');
});

test('the cover starts from the hero until a post-event cover is chosen', () => {
  const byCover = (cover: PostEventSources['cover']) =>
    compilePostEventScenes({ ...FULL, cover }, AT).scenes.find((s) => s.key === 'cover')!.source;
  assert.equal(byCover('hero'), 'Your hero');
  assert.equal(byCover('chosen'), 'The cover you chose');
});

test('the gallery tabs follow the reader: guest Yours/Everyone’s · stranger shared only · couple everything', () => {
  assert.deepEqual(galleryTabsFor(postEventReader({ isHost: false, belongsToEvent: true })).map((t) => t.label), ['Yours', 'Everyone’s']);
  assert.deepEqual(galleryTabsFor(postEventReader({ isHost: false, belongsToEvent: false })).map((t) => t.key), ['shared']);
  assert.deepEqual(galleryTabsFor(postEventReader({ isHost: true, belongsToEvent: true })).map((t) => t.key), ['everything']);
  // A host is never read as a guest, even though they belong to the event.
  assert.equal(postEventReader({ isHost: true, belongsToEvent: false }), 'couple');
});

test('the open-up hash round-trips, and nothing else opens a layer', () => {
  for (const kind of OPEN_UP_KINDS) assert.equal(openUpFromHash(openUpHash(kind)), kind);
  for (const bad of ['', '#', '#open-', '#open-admin', '#gallery', 'open-gallery-x', null, undefined]) {
    assert.equal(openUpFromHash(bad as string), null, String(bad));
  }
});

test('the lazy compile: first open after the day, then only when a skipped source gains content', () => {
  const fresh = compilePostEventScenes(FULL, AT);
  assert.equal(postEventNeedsCompile({ eventEnded: false, isCouple: true, stored: null, fresh }), false, 'not before the day');
  assert.equal(postEventNeedsCompile({ eventEnded: true, isCouple: false, stored: null, fresh }), false, 'only the couple’s open writes it');
  assert.equal(postEventNeedsCompile({ eventEnded: true, isCouple: true, stored: null, fresh }), true, 'first open');
  assert.equal(postEventNeedsCompile({ eventEnded: true, isCouple: true, stored: fresh, fresh }), false, 'nothing changed');
  const withReview = compilePostEventScenes({ ...FULL, reviews: 2 }, AT);
  assert.equal(postEventNeedsCompile({ eventEnded: true, isCouple: true, stored: fresh, fresh: withReview }), true, 'a review arrived');
  // A source going quiet does not rewrite the record.
  const fewer = compilePostEventScenes({ ...FULL, kwento: 0 }, AT);
  assert.equal(postEventNeedsCompile({ eventEnded: true, isCouple: true, stored: fresh, fresh: fewer }), false);
});

test('the stored record round-trips through the sanitiser', () => {
  const compiled = compilePostEventScenes(FULL, AT);
  const draft = withCompiledScenes({ headline: 'H' }, compiled);
  const back = readStoredScenes(JSON.parse(JSON.stringify(draft)));
  assert.ok(back);
  assert.equal(back.generatedAt, AT);
  assert.deepEqual(back.scenes.map((s) => [s.key, s.template, s.status]), compiled.scenes.map((s) => [s.key, s.template, s.status]));
  assert.equal(readStoredScenes({ scenes: [{ key: 'x' }] }), null, 'no stamp, no record');
  assert.equal(readStoredScenes('junk'), null);
});

/* ── THE CONVERSION ─────────────────────────────────────────────────────── */

/** The one published editorial's SHAPE, as read from prod on 2026-09-25 (keys
 *  and switches only — the words here are stand-ins, not the couple's). */
const PUBLISHED_SHAPE = {
  headline: 'Rafael & Isabel, Married at Last',
  deck: 'A December wedding in Tagaytay',
  super: 'Weddings',
  byline: 'By the Setnayan desk',
  storyTheme: { mode: 'board' },
  sectionOrder: ['chapters', 'kwento', 'challengeAnswers', 'gallery', 'fromVendors', 'liveWall', 'watchFilm', 'reviews', 'poweredBy', 'vendorsWeLoved'],
  sections: {
    team: true, kwento: true, gallery: true, reviews: true, liveWall: true, poweredBy: true, watchFilm: true,
    fromVendors: true, byTheNumbers: true, guestColumns: true, fromTheCouple: true, vendorsWeLoved: true, challengeAnswers: true,
  },
};

test('GOLDEN: converting the published editorial keeps its headline and lead, byte for byte', () => {
  const compiled = compilePostEventScenes(FULL, AT);
  for (const draft of [
    PUBLISHED_SHAPE,
    { ...PUBLISHED_SHAPE, lead_paragraphs: ['First paragraph.', 'Second one.'] },
    { ...PUBLISHED_SHAPE, lead: 'One\n\nTwo' },
  ]) {
    const before = postEventCoverWords(draft);
    const converted = withCompiledScenes(draft, compiled);
    assert.deepEqual(postEventCoverWords(converted), before);
    // It touched ONLY the two new keys.
    const touched = Object.keys(converted).filter((k) => JSON.stringify(converted[k]) !== JSON.stringify((draft as Record<string, unknown>)[k]));
    assert.deepEqual(touched.sort(), ['scenes', 'scenesGeneratedAt']);
  }
  assert.equal(postEventCoverWords(PUBLISHED_SHAPE).headline, 'Rafael & Isabel, Married at Last');
});

test('draftToScenes follows the saved order and the switches — the page’s own order', () => {
  const rows = draftToScenes({ ...PUBLISHED_SHAPE, sections: { ...PUBLISHED_SHAPE.sections, kwento: false } }, ['ch-1', 'ch-2']);
  assert.deepEqual(rows.map((r) => r.key), [
    'cover', 'before', 'you', 'numbers',
    'ch-1', 'ch-2', 'wishes', 'asked',
    'gallery', 'vendors', 'wall', 'film', 'said', 'powered', 'loved',
    // guestColumns was not in the saved order → it appends, exactly as `resolveSectionOrder` does
    'letters',
    'couple', 'song', 'next',
  ]);
  assert.equal(rows.find((r) => r.key === 'wishes')!.hidden, true);
  assert.equal(rows.find((r) => r.key === 'gallery')!.hidden, false);
  // A malformed draft reads as everything on, default order.
  assert.ok(draftToScenes('nope').every((r) => !r.hidden));
});

test('the navigator list numbers only what guests meet; skipped and hidden rows say so', () => {
  const compiled = compilePostEventScenes(FULL, AT);
  const list = postEventSceneList(compiled, { sections: { poweredBy: false } });
  assert.equal(list.length, compiled.scenes.length, 'every compiled scene is listed');
  const wall = list.find((r) => r.key === 'wall')!;
  assert.equal(wall.status, 'skipped');
  assert.equal(wall.position, null);
  const powered = list.find((r) => r.key === 'powered')!;
  assert.equal(powered.hidden, true);
  assert.equal(powered.position, null);
  const numbered = list.filter((r) => r.position !== null).map((r) => r.position);
  assert.deepEqual(numbered, numbered.map((_, i) => i), 'consecutive from 0');
  assert.equal(list[0]!.key, 'cover');
  assert.deepEqual(list.slice(-3).map((r) => r.key), ['couple', 'song', 'next']);
});
