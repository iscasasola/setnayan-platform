/**
 * POST EVENT'S NAVIGATOR LISTS ITS SCENES — through `maker-scene-list.ts`, not
 * beside it (Event Hub Maker Phase 8).
 *
 * The Maker's navigator reads ONE list per stage (`makerStageList`, which asks
 * the page's own plan). Post Event's written scenes join that list in the
 * place the story body leads the page — they replace the single "story after
 * the day" tile — and every scene is listed: filled ones with their number,
 * skipped / hidden / optional ones SAID AS SUCH and carrying no number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { makerStageLists, type MakerStageInput, type MakerTile } from './maker-scene-list';
import { compilePostEventScenes, postEventSceneList, type PostEventSources } from './post-event-scenes';

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ORDER: WidgetType[] = ['hero', 'greeting', 'qr_card', 'rsvp', 'tier_comparison', 'special_message'];
const widgets: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`,
  event_id: 'e1',
  widget_type: t,
  display_order: i + 1,
  is_visible: true,
  is_always_on: ALWAYS.has(t),
  tier: 'basic',
  config_json: {},
  created_at: '',
  updated_at: '',
  mode: 'auto',
  audience: 'public',
}));

const PLAN: Omit<MakerStageInput, 'stage'> = {
  widgets,
  openBrowse: false,
  content: { special_message: false },
  solemn: false,
  hasHeroMedia: false,
  hasEntourage: true,
  storyRenders: false,
};

const SOURCES: PostEventSources = {
  cover: 'hero',
  milestones: 2,
  metrics: { photos: 120, guests: 80 },
  chapters: [
    { time: '2:30 PM', title: 'The vows', leadId: 'a', isClip: false, media: 3 },
    { time: '6:05 PM', title: 'First dance', leadId: 'b', isClip: true, media: 1 },
  ],
  galleryPhotos: 120,
  broadcast: true,
  films: 0,
  kwento: 4,
  challengeAnswers: 0,
  guestColumns: 0,
  vendorMedia: 0,
  liveWall: { active: false, photos: 0 },
  reviews: 0,
  services: 1,
  vendorsWeLoved: 0,
  specialMessage: true,
  song: 'Ikaw',
  whatsNext: null,
};

const rows = postEventSceneList(compilePostEventScenes(SOURCES, '2026-12-13T06:02:00.000Z'), {
  sections: { poweredBy: false },
});
const pe = (t: MakerTile) => (t.kind === 'post-event' ? t : null);

test('after the day, the scenes take the story tile’s place — in the page’s order', () => {
  const lists = makerStageLists({ ...PLAN, postEvent: rows });
  const keys = lists.editorial.shown.map((t) => t.key);
  assert.ok(!keys.includes('f:editorial'), 'the one stand-in tile is gone once the scenes are listed');
  const sceneKeys = keys.filter((k) => k.startsWith('p:'));
  assert.deepEqual(sceneKeys, rows.map((r) => `p:${r.key}`), 'every compiled scene, in postEventSceneList’s order');
  assert.equal(keys[0], 'p:cover', 'the story still leads the page');
  // The rest of the stage is unchanged behind the story.
  assert.deepEqual(
    keys.filter((k) => !k.startsWith('p:')),
    makerStageLists(PLAN).editorial.shown.map((t) => t.key).filter((k) => k !== 'f:editorial'),
  );
});

test('skipped, hidden and optional scenes are listed as such — no number, no anchor', () => {
  const tiles = makerStageLists({ ...PLAN, postEvent: rows }).editorial.shown.map(pe).filter((t) => t !== null);
  const by = new Map(tiles.map((t) => [t!.scene, t!] as const));
  for (const key of ['asked', 'letters', 'vendors', 'wall', 'said', 'loved']) {
    const t = by.get(key)!;
    assert.equal(t.status, 'skipped', key);
    assert.equal(t.drawn, false, key);
    assert.equal(t.position, null, key);
    assert.equal(t.anchor, null, key);
    assert.ok(t.note, `${key} says why`);
  }
  const powered = by.get('powered')!;
  assert.equal(powered.hidden, true);
  assert.equal(powered.position, null);
  assert.equal(by.get('next')!.status, 'optional');
  // Filled ones are numbered 1… in order, and scroll to their marker.
  const numbered = tiles.filter((t) => t!.drawn).map((t) => t!.position);
  assert.deepEqual(numbered, numbered.map((_, i) => i + 1));
  assert.equal(by.get('gallery')!.anchor, 'p:gallery');
  assert.equal(by.get('ch-2')!.anchor, 'p:ch-1', 'later chapters scroll to the chapters block');
  assert.equal(by.get('before')!.anchor, 'p:cover', 'Before the day sits on the cover’s page');
});

// ⚠ Since 2026-09-25 ("POST EVENT IS MANY SMALL SCENES") the Maker hands the
// scenes in BEFORE the day too (`post-event-is-many-small-scenes.test.ts`), so
// the stand-in tile is only what the navigator falls back to when the story's
// scenes could not be read.
test('when the list was not read, the one story tile stands in', () => {
  assert.equal(makerStageLists(PLAN).editorial.shown[0]!.key, 'f:editorial');
  assert.equal(makerStageLists({ ...PLAN, postEvent: [] }).editorial.shown[0]!.key, 'f:editorial');
  // The other three stages never list a Post Event scene.
  const lists = makerStageLists({ ...PLAN, postEvent: rows });
  for (const stage of ['save_the_date', 'rsvp', 'event'] as const) {
    assert.ok(!lists[stage].shown.some((t) => t.kind === 'post-event'), stage);
  }
});

test('SOURCE: the canvas stamps a marker for every scene the navigator can scroll to', () => {
  const WEB = join(__dirname, '..');
  const content = stripComments(
    readFileSync(join(WEB, 'app/[slug]/_components/editorial/editorial-content.tsx'), 'utf8'),
  );
  // The run's markers come from the one block→scene map, and the fixed ones by name.
  assert.match(content, /postEventSceneKeyForBlock\(/);
  for (const scene of ['cover', 'numbers', 'couple', 'song', 'next']) {
    assert.ok(content.includes(`marker('${scene}')`), `a p:${scene} marker`);
  }
  const spine = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/story/story-spine.tsx'), 'utf8'));
  assert.ok(spine.includes('data-maker-section="p:you"'));
  // …and only in the Maker's canvas: the same gate as every other marker.
  const body = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));
  assert.match(body, /makerMarkers=\{Boolean\(isEditorCanvas && editorBridge\)\}/);
});
