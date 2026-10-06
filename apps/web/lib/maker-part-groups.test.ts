/**
 * maker-part-groups.test.ts — ＋ "AFTER THE EVENT" LISTS THE NINE SHIPPED POST
 * EVENT SCENES BY THEIR SHIPPED NAMES — none duplicated, none invented — and a
 * scene of their own counts from the shipped six.
 *
 * Owner, 2026-10-06, verbatim: *"yes"* (to: add the undrawn Post Event scenes as
 * ＋ parts). DECISION_LOG 2026-10-06 "POST EVENT: EVERY SHIPPED AUTO SCENE CAN BE
 * ADDED": The Road to the Day · Watch Live · Papic Challenge · Supplier Stories ·
 * Live Photo Wall · What They Said · Before & After · Song · What comes next —
 * and "Photos of you" takes its shipped name, Were you there?
 *
 * Sabotage (seen red): rename one shipped scene in `lib/post-event-scenes.ts`
 * (e.g. `name: 'Song'` → `'Our song'`), or point a part at an invented key.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAKER_PARTS, MAKER_PART_KEYS, type MakerPartKey } from './maker-parts';
import {
  MAKER_OWN_SCENES_MAX,
  MAKER_PART_GROUPS,
  MAKER_POST_EVENT_ADDED,
  makerOwnScenesLeft,
  makerOwnScenesLine,
  makerPartLabelOn,
  makerPartOffers,
  makerPartOfCanvas,
  makerPartsWithAdded,
  makerPostEventSceneOf,
} from './maker-part-groups';
import { compilePostEventScenes, POST_EVENT_SCENE_NAMES, type PostEventSources } from './post-event-scenes';
import { CUSTOM_SECTION_TYPES } from './custom-sections';

/** The owner's nine, verbatim from the DECISION_LOG row. */
const NINE = [
  'The Road to the Day',
  'Watch Live',
  'Papic Challenge',
  'Supplier Stories',
  'Live Photo Wall',
  'What They Said',
  'Before & After',
  'Song',
  'What comes next',
];

/** Every scene the compiler writes, with its name — the SHIPPED truth, not this file's. */
function shippedScenes(): Map<string, string> {
  const s: PostEventSources = {
    cover: 'card',
    milestones: 0,
    metrics: { photos: 0, guests: 0 },
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
  return new Map(compilePostEventScenes(s, '2026-10-07T00:00:00Z').scenes.map((sc) => [sc.key, sc.name] as const));
}

const after = MAKER_PART_GROUPS.find((g) => g.label === 'After the event')!;

test('"After the event" lists the nine shipped Post Event scenes by their shipped names', () => {
  assert.ok(after, 'the group exists');
  const shipped = shippedScenes();
  const added = after.parts.filter((k) => k in MAKER_POST_EVENT_ADDED);
  assert.equal(added.length, 9, 'nine scenes, no more, no fewer');
  const names = added.map((k) => {
    const scene = MAKER_POST_EVENT_ADDED[k]!;
    assert.ok(shipped.has(scene), `${k} → "${scene}" is a scene the compiler writes (none invented)`);
    /* The label is the shipped one — read from the compiler, never retyped. */
    assert.equal(makerPartLabelOn('editorial', k), shipped.get(scene), `${k} wears its shipped name`);
    assert.equal(MAKER_PARTS[k].label, shipped.get(scene), `${k}'s part word is its shipped name`);
    assert.equal(POST_EVENT_SCENE_NAMES[scene], shipped.get(scene));
    return shipped.get(scene)!;
  });
  assert.deepEqual(names, NINE, 'the owner’s nine, in the owner’s order');
});

test('none duplicated: one part per shipped scene, one group per part', () => {
  const scenes = after.parts.map((k) => makerPostEventSceneOf('editorial', k)).filter((x): x is string => x !== null);
  assert.equal(new Set(scenes).size, scenes.length, `a shipped scene is listed twice: ${scenes.join(', ')}`);
  const all = MAKER_PART_GROUPS.flatMap((g) => g.parts);
  assert.equal(new Set(all).size, all.length, 'a part sits in one group only');
  for (const k of all) assert.ok((MAKER_PART_KEYS as readonly string[]).includes(k), `${k} is a part`);
  /* The nine are addable, never on a page by default. */
  assert.deepEqual(
    Object.keys(MAKER_POST_EVENT_ADDED).sort(),
    ['beforeafter', 'challenge', 'next', 'road', 'said', 'song', 'supstories', 'wall', 'watchlive'],
  );
});

test('"Photos of you" on Post Event is the shipped Were you there?', () => {
  assert.equal(makerPostEventSceneOf('editorial', 'myphotos'), 'you');
  assert.equal(makerPartLabelOn('editorial', 'myphotos'), shippedScenes().get('you'));
  assert.equal(makerPartLabelOn('editorial', 'myphotos'), 'Were you there?');
  /* Off Post Event it keeps its own word. */
  assert.equal(makerPartLabelOn('event', 'myphotos'), 'Photos of you');
});

test('the groups are the prototype’s, in its order', () => {
  assert.deepEqual(
    MAKER_PART_GROUPS.map((g) => g.label),
    ['Words', 'When & where', 'Your story', 'For each guest', 'Replies', 'Notes & news', 'Gifts & photos', 'After the event', 'Brand'],
  );
});

test('＋ offers only what is NOT on the page, and only what has a door', () => {
  const offers = makerPartOffers({
    stage: 'editorial',
    present: new Set(['p:film', 'p:song']),
    pathOf: (k) => (k === 'said' ? { kind: 'add' } : k === 'song' || k === 'watchlive' ? { kind: 'add' } : k === 'road' ? { kind: 'waiting', note: 'Not yet' } : null),
  });
  const keys = offers.flatMap((g) => g.parts.map((p) => p.key));
  assert.deepEqual(keys, ['road', 'said'], 'Watch Live and Song are on the page; nothing without a door is listed');
  assert.equal(offers[0]!.label, 'After the event');
});

test('a scene of their own: "n of 6 left", counted from the shipped six', () => {
  assert.equal(MAKER_OWN_SCENES_MAX, CUSTOM_SECTION_TYPES.length, 'the shipped limit, never a typed number');
  assert.equal(MAKER_OWN_SCENES_MAX, 6);
  assert.equal(makerOwnScenesLine(0), '6 of 6 left');
  assert.equal(makerOwnScenesLine(4), '2 of 6 left');
  assert.equal(makerOwnScenesLeft(6), 0);
  assert.equal(makerOwnScenesLeft(9), 0, 'never below none');
});

test('a part the couple added is a tile of the page it was added to', () => {
  /* Post Event › Home draws numbers · message · wishes; Song was added after Wishes. */
  const drawn = ['f:hero', 'p:numbers', 'w:special_message', 'p:wishes', 'p:song', 'p:film'];
  const parts = makerPartsWithAdded({ stage: 'editorial', page: 'home', pages: ['home', 'film', 'suppliers', 'gallery'], drawn });
  assert.ok(parts.includes('song'), 'Song is Home’s');
  assert.ok(parts.indexOf('song') > parts.indexOf('wishes'), 'drawn after Wishes');
  assert.equal(makerPartOfCanvas('editorial', 'p:song'), 'song' satisfies MakerPartKey);
  assert.equal(makerPartOfCanvas('editorial', 'p:you'), 'myphotos');
});
