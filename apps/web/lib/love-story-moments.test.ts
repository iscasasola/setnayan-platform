/**
 * love-story-moments.test.ts — Event Hub Maker Phase 7, the pure rules.
 *
 * Plan § Phase 7 "Tests": the cap refuses moment #6 and any media for a free
 * event and allows both for Pro · seeding is idempotent · a year-only date
 * sorts before a dated moment of the same year · the guest plan emits N scenes
 * for N visible moments and skips hidden ones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_MOMENT_CAP,
  MOMENT_MAX,
  chapterOf,
  compareMomentDates,
  formatMomentDate,
  groupByChapter,
  loveStoryMediaRefs,
  loveStoryScenes,
  mayAddMoment,
  momentCapRefusal,
  newMomentId,
  readMoment,
  readMomentDate,
  resolveMoments,
  seedMomentsFromLegacy,
  sortMoments,
  storableMoments,
  type LoveStoryMoment,
} from './love-story-moments';

const PHOTO = 'r2://setnayan-media/events/E1/love-story/a.jpg';
const m = (id: string, y: number, extra: Partial<LoveStoryMoment> = {}): LoveStoryMoment => ({
  id,
  date: { y },
  line: `line ${id}`,
  canvas: {},
  ...extra,
});
const five = [m('a', 2019), m('b', 2020), m('c', 2021), m('d', 2022), m('e', 2023)];

test('🔒 free: the sixth story is refused, the fifth is not', () => {
  const four = five.slice(0, 4);
  assert.equal(momentCapRefusal({ before: four, after: five, ownsPro: false }), null);
  assert.equal(
    momentCapRefusal({ before: five, after: [...five, m('f', 2024)], ownsPro: false }),
    'more_stories_pro',
  );
  assert.equal(mayAddMoment(4, false), true);
  assert.equal(mayAddMoment(FREE_MOMENT_CAP, false), false);
});

test('🔒 free: ANY photo is refused — on a new moment or an edited one', () => {
  assert.equal(
    momentCapRefusal({ before: [], after: [m('a', 2019, { media: [PHOTO] })], ownsPro: false }),
    'photos_pro',
  );
  assert.equal(
    momentCapRefusal({ before: [m('a', 2019)], after: [m('a', 2019, { media: [PHOTO] })], ownsPro: false }),
    'photos_pro',
  );
});

test('✅ Pro: a sixth story and photos are both allowed; 100 is the ceiling for everyone', () => {
  assert.equal(
    momentCapRefusal({ before: five, after: [...five, m('f', 2024, { media: [PHOTO] })], ownsPro: true }),
    null,
  );
  const hundred = Array.from({ length: MOMENT_MAX }, (_, i) => m(`x${i}`, 2000 + (i % 20)));
  assert.equal(momentCapRefusal({ before: hundred, after: [...hundred, m('y', 2020)], ownsPro: true }), 'max');
});

test('✅ removing is never refused, and a seed larger than five is never cut', () => {
  const seven = [...five, m('f', 2024), m('g', 2025)];
  assert.equal(momentCapRefusal({ before: seven, after: seven.slice(1), ownsPro: false }), null);
  // Editing the words of a grandfathered sixth story is not growth.
  const edited = seven.map((x) => (x.id === 'g' ? { ...x, line: 'new words' } : x));
  assert.equal(momentCapRefusal({ before: seven, after: edited, ownsPro: false }), null);
  // A photo the list already held (a lapsed Pro) is not a new photo.
  const held = [m('a', 2019, { media: [PHOTO] })];
  assert.equal(momentCapRefusal({ before: held, after: held, ownsPro: false }), null);
});

test('🌱 seeding from the onboarding words is idempotent and keeps stable ids', () => {
  const legacy = {
    how_we_met: 'One jeepney, rain that would not stop.',
    met_year: '2019',
    spark: 'The Sunday calls.',
    proposal: 'Sunrise over the ridge.',
    proposal_year: '2025',
    proposal_setting: 'Mt. Pulag',
    milestones: [{ year: '2021', title: 'Sagada', note: 'fog' }, { year: 2023, month: '12', title: 'Siargao' }],
  };
  const a = seedMomentsFromLegacy(legacy);
  const b = seedMomentsFromLegacy(legacy);
  assert.deepEqual(a, b);
  assert.deepEqual(
    a.map((x) => x.id),
    ['seed-met', 'seed-spark', 'seed-yes', 'seed-ms-0', 'seed-ms-1'],
  );
  assert.equal(a[0]?.anchor, 'met');
  assert.deepEqual(a[0]?.date, { y: 2019 });
  assert.equal(a[2]?.place, 'Mt. Pulag');
  assert.equal(a[3]?.line, 'Sagada — fog');
  assert.deepEqual(a[4]?.date, { y: 2023, m: 12 });
  // resolveMoments falls back to the seed ONLY while nothing is stored …
  assert.deepEqual(resolveMoments(legacy), a);
  // … and a stored list — even an empty one — wins over the seed.
  assert.deepEqual(resolveMoments({ ...legacy, moments: [] }), []);
  assert.equal(seedMomentsFromLegacy({}).length, 0);
  assert.equal(seedMomentsFromLegacy(null).length, 0);
});

test('📅 a year alone sorts BEFORE a dated moment of the same year', () => {
  assert.equal(compareMomentDates({ y: 2021 }, { y: 2021, m: 3 }), -1);
  assert.equal(compareMomentDates({ y: 2021, m: 3 }, { y: 2021, m: 3, d: 9 }), -1);
  const sorted = sortMoments([m('dated', 2021, { date: { y: 2021, m: 6, d: 1 } }), m('year', 2021)]);
  assert.deepEqual(sorted.map((x) => x.id), ['year', 'dated']);
});

test('📖 moments self-sort into chapters around the two anchors', () => {
  const list = [
    m('met', 2019, { anchor: 'met' }),
    m('yes', 2025, { anchor: 'yes' }),
    m('kid', 2005),
    m('trip', 2021),
    m('fitting', 2026),
  ];
  assert.equal(chapterOf(list[2]!, list), 'before');
  assert.equal(chapterOf(list[3]!, list), 'falling');
  assert.equal(chapterOf(list[4]!, list), 'toward');
  assert.deepEqual(
    groupByChapter(list).map((g) => [g.chapter, g.moments.map((x) => x.id)]),
    [
      ['before', ['kid']],
      ['met', ['met']],
      ['falling', ['trip']],
      ['yes', ['yes']],
      ['toward', ['fitting']],
    ],
  );
  // Without anchors everything is Falling — "2021 · Sagada" with just a year slots in.
  assert.equal(chapterOf(m('sagada', 2021), [m('sagada', 2021)]), 'falling');
});

test('🎬 the guest plan: N scenes for N visible moments, hidden ones skipped, story order', () => {
  const story = {
    moments: [
      m('b', 2022),
      m('a', 2021, { media: [PHOTO] }),
      m('h', 2023, { hidden: true }),
      m('y', 2025, { anchor: 'yes' }),
    ],
  };
  const scenes = loveStoryScenes(story);
  assert.deepEqual(scenes.map((s) => s.id), ['a', 'b', 'y']);
  assert.equal(scenes[0]?.template, 6); // a photo moment → portrait
  assert.equal(scenes[1]?.template, 8); // words only
  assert.equal(scenes[2]?.template, 8); // the yes, no clip
  assert.deepEqual(loveStoryMediaRefs(story), [PHOTO]);
  assert.equal(loveStoryScenes({}).length, 0);
  assert.equal(loveStoryScenes(null).length, 0);
});

test('🧹 reading is a fence: bad ids, private buckets and empty lines are dropped', () => {
  assert.equal(readMoment({ id: 'x y', line: 'hi', canvas: {} }), null);
  assert.equal(readMoment({ id: 'ok', line: '', canvas: {} }), null);
  const r = readMoment({
    id: 'ok',
    line: 'hi',
    media: ['r2://setnayan-thread-files/secret.jpg', PHOTO, '1'],
    canvas: { preset: 'calm', bogus: 1 },
  });
  assert.deepEqual(r?.media, [PHOTO]);
  assert.deepEqual(r?.canvas, { preset: 'calm' });
  assert.equal(readMomentDate({ y: '2021', m: '13' })?.m, undefined);
  assert.equal(readMomentDate({ y: '2021', d: '9' })?.d, undefined, 'a day needs its month');
  assert.equal(formatMomentDate({ y: 2025, m: 2, d: 14 }), '14 February 2025');
  assert.equal(formatMomentDate({ y: 2022, m: 8 }), 'August 2022');
  assert.equal(formatMomentDate({ y: 2021 }), '2021');
});

test('🆔 new ids never collide, and a stored list round-trips', () => {
  let n = 0;
  const seq = [0.5, 0.5, 0.25];
  const id1 = newMomentId([], () => seq[n++]!);
  const id2 = newMomentId([m(id1, 2020)], () => seq[n++]!);
  assert.notEqual(id1, id2);
  const list = [m('a', 2019, { place: 'Baguio', added_by: 'Claire' })];
  assert.deepEqual(resolveMoments({ moments: storableMoments(list) }), list);
});
