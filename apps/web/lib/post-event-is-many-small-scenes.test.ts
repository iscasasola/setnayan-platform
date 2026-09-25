/**
 * post-event-is-many-small-scenes.test.ts — the owner's 2026-09-25 ruling, held.
 *
 * *"the story on that scene 1 of post event is the whole story, what we want is
 * to cut them into smaller scenes to allow content for each part giving them
 * freedom to add new scenes. So for post event. scene creation will have
 * different preset scenes as well."* (DECISION_LOG "POST EVENT IS MANY SMALL
 * SCENES").
 *
 *   1. Before the day, the Post Event navigator lists the scenes — each waiting,
 *      each saying what will fill it. Never the one "story after the day" tile.
 *   2. After the compile, the SAME keys are filled.
 *   3. The couple's own scenes are scenes, in the run's place.
 *   4. "+" offers Post Event's own presets on Post Event, and only there.
 *   5. Every control drafts; the canvas shows the draft to the host only; Apply
 *      writes the story's draft_json and nothing that decides who reads it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { makerStageLists, type MakerStageInput, type MakerTile } from './maker-scene-list';
import {
  POST_EVENT_WAITING,
  compilePostEventScenes,
  postEventSceneList,
  type PostEventSources,
} from './post-event-scenes';
import { POST_EVENT_PRESETS, POST_EVENT_PRESET_IDS } from './post-event-presets';
import { SCENE_TEMPLATES } from './scene-templates';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const widgets: InvitationWidgetRow[] = (['hero', 'greeting', 'qr_card', 'rsvp', 'special_message'] as WidgetType[]).map((t, i) => ({
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
  content: {},
  solemn: false,
  hasHeroMedia: true,
  hasEntourage: false,
  storyRenders: false,
};

/** The owner's cale-ice, months before its day: guests invited, nothing else yet. */
const BEFORE: PostEventSources = {
  cover: 'hero',
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

/** The same event the morning after: every source has something. */
const AFTER: PostEventSources = {
  ...BEFORE,
  milestones: 3,
  metrics: { photos: 1240, guests: 186 },
  galleryPhotos: 1240,
  broadcast: true,
  kwento: 42,
  challengeAnswers: 7,
  guestColumns: 3,
  vendorMedia: 4,
  liveWall: { active: true, photos: 120 },
  reviews: 2,
  services: 4,
  vendorsWeLoved: 2,
  specialMessage: true,
  song: 'Ikaw at Ako',
};

const AT = '2026-12-19T06:02:00.000Z';
const pe = (t: MakerTile) => (t.kind === 'post-event' ? t : null);

test('BEFORE THE DAY: the navigator lists every scene — waiting, each saying what fills it — never the one story tile', () => {
  const rows = postEventSceneList(compilePostEventScenes(BEFORE, AT, { dayHappened: false }), {});
  const lists = makerStageLists({ ...PLAN, postEvent: rows });
  const keys = lists.editorial.shown.map((t) => t.key);
  assert.ok(!keys.includes('f:editorial'), 'the single "The story after the day" tile is gone');
  const tiles = lists.editorial.shown.map(pe).filter((t) => t !== null);
  assert.ok(tiles.length >= 18, `only ${tiles.length} scene tiles`);
  console.log(`[post-event] before the day: ${tiles.length} scene tiles`);
  for (const t of tiles) {
    if (t!.scene === 'cover' || t!.scene === 'next') continue;
    assert.equal(t!.status, 'waiting', `${t!.scene} is "not yet", never "skipped", before the day`);
    assert.equal(t!.drawn, false, t!.scene);
    assert.equal(t!.anchor, null, t!.scene);
    assert.ok(t!.note && t!.note.length > 10, `${t!.scene} says what will fill it`);
  }
  assert.equal(tiles.find((t) => t!.scene === 'gallery')!.note, 'Your photos from the day appear here.');
  assert.equal(tiles[0]!.scene, 'cover');
  assert.equal(tiles[0]!.status, 'auto', 'the cover is the hero from the first day');
});

test('AFTER THE COMPILE: the same keys, filled — the compile fills the scenes, it does not replace them', () => {
  const before = compilePostEventScenes(BEFORE, AT, { dayHappened: false }).scenes;
  const after = compilePostEventScenes(AFTER, AT).scenes;
  const fixed = (keys: string[]) => keys.filter((k) => k !== 'chapters' && !/^ch-\d+$/.test(k));
  assert.deepEqual(fixed(after.map((s) => s.key)), fixed(before.map((s) => s.key)));
  for (const key of ['gallery', 'film', 'wishes', 'asked', 'letters', 'vendors', 'wall', 'said', 'powered', 'loved', 'couple', 'song', 'before', 'numbers']) {
    assert.equal(before.find((s) => s.key === key)!.status, 'waiting', `${key} waits before`);
    assert.equal(after.find((s) => s.key === key)!.status, 'auto', `${key} is filled after`);
  }
  // A key the placeholder table names that the compile never emits would be a promise nobody keeps.
  const emitted = new Set(before.map((s) => s.key));
  for (const key of Object.keys(POST_EVENT_WAITING)) assert.ok(emitted.has(key), `waiting text for a scene that does not exist: ${key}`);
  // After the day an empty source is still SKIPPED — never "waiting" for a day that has passed.
  assert.ok(compilePostEventScenes(BEFORE, AT).scenes.every((s) => s.status !== 'waiting'));
});

test('THEIR OWN SCENES are scenes: in the run’s place, numbered, with a canvas marker', () => {
  const draft = {
    customColumns: [
      { id: 'pe00000001', title: 'Salamat', body: 'Thank you.', preset: 'thank_you' },
      { id: 'dogs1', title: 'The Dog', body: 'He wore a bow tie.' },
    ],
    sectionOrder: ['custom:pe00000001', 'chapters'],
  };
  const rows = postEventSceneList(compilePostEventScenes(AFTER, AT), draft, { liveCustomIds: ['dogs1'] });
  const keys = rows.map((r) => r.key);
  assert.ok(keys.indexOf('custom:pe00000001') < keys.indexOf('chapters'), 'the drafted order is the list’s order');
  assert.ok(keys.indexOf('custom:dogs1') > keys.indexOf('loved'), 'a column never placed appends at the end of the run');
  assert.ok(keys.indexOf('custom:dogs1') < keys.indexOf('couple'), '…and before the pinned close');
  const mine = rows.find((r) => r.key === 'custom:pe00000001')!;
  assert.equal(mine.status, 'own');
  assert.equal(mine.template, 11, 'the thank-you note is a Letter');
  assert.equal(mine.isNew, true, 'not live yet — Pro at Apply');
  assert.equal(rows.find((r) => r.key === 'custom:dogs1')!.isNew, false);
  const tiles = makerStageLists({ ...PLAN, postEvent: rows }).editorial.shown.map(pe).filter((t) => t !== null);
  const tile = tiles.find((t) => t!.scene === 'custom:pe00000001')!;
  assert.equal(tile.drawn, true);
  assert.equal(tile.anchor, 'p:custom:pe00000001');
  assert.equal(tile.runKey, 'custom:pe00000001');
  assert.equal(tile.preset, 'thank_you');
  // …and the canvas stamps that marker in front of the column.
  const content = read('app/[slug]/_components/editorial/editorial-content.tsx');
  assert.match(content, /\{marker\(k\)\}\s*<div>\s*<SectionRule title=\{col\.title\} \/>\s*<PresetSceneBody\b/);
});

test('"+" ON POST EVENT: its own presets — different from the other stages’ 25 — and only there', () => {
  assert.ok(POST_EVENT_PRESETS.length >= 8, 'a real set, not a token one');
  for (const p of POST_EVENT_PRESETS) {
    assert.ok(SCENE_TEMPLATES[p.template], `${p.id} lays out as one of the 25`);
    if (p.shows === 'words') assert.equal(p.waiting, null, `${p.id} waits on nothing`);
    if (p.shows === 'gallery' || p.shows === 'film' || p.shows === 'wishes') assert.ok(p.waiting, `${p.id} says what will fill it`);
  }
  for (const kind of ['thank_you', 'letter', 'chapter', 'gallery_grid', 'film', 'wishes_wall', 'were_you_there', 'whats_next']) {
    assert.ok((POST_EVENT_PRESET_IDS as readonly string[]).includes(kind), `the prototype's ${kind}`);
  }
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  // On Post Event the "+" is the presets; every other stage keeps the 25 layouts.
  assert.match(shell, /\{stage === 'editorial' \? \([\s\S]{0,900}<PostEventAddScene\b[\s\S]{0,900}\) : addScene && 'action' in addScene \? \(/);
  const panel = read('app/dashboard/[eventId]/website/editor/_components/post-event-scene-panel.tsx');
  assert.match(panel, /<SceneTemplatePicker\b[\s\S]*?postEvent=\{\{/);
  // The presets appear in exactly one picker — the Post Event one.
  const pickerFiles = [
    'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx',
    'app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx',
    'app/dashboard/[eventId]/website/editor/_components/scene-slots-panel.tsx',
  ];
  for (const f of pickerFiles) assert.ok(!/postEvent=\{\{/.test(read(f)), `${f} must not offer the Post Event presets`);
});

test('EVERY CONTROL DRAFTS: the scene panel saves only through the draft door, never a form, never a live writer', () => {
  const panel = read('app/dashboard/[eventId]/website/editor/_components/post-event-scene-panel.tsx');
  assert.ok(panel.length > 2000, 'the panel source was read');
  assert.match(panel, /import \{ hubDraftAction \} from '\.\.\/\.\.\/hub-draft-actions';/);
  assert.match(panel, /fd\.set\('intent', 'save'\);/);
  assert.match(panel, /fd\.set\('patch', JSON\.stringify\(\{ editorial: patch \}\)\);/);
  assert.ok(!/<form\b/.test(panel), 'a Post Event control has no form of its own');
  for (const live of ['saveEditorial', 'story/actions', 'addCustomSection', 'saveCustomSection']) {
    assert.ok(!panel.includes(live), `the panel must not reach the live writer ${live}`);
  }
});

test('THE CANVAS SHOWS THE DRAFT TO THE HOST ONLY: page → site-body → the story, from hostDraft', () => {
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /editorialDraft: hostDraft\?\.editorial \?\? null/);
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /draft=\{editorialDraft\}/);
  const content = read('app/[slug]/_components/editorial/editorial-content.tsx');
  // The draft is laid over AFTER the audience gate and the redaction.
  const gate = content.indexOf('storyAudienceAdmits(data.audience, viewer)');
  const redact = content.indexOf('data = redactStoryLayers(data, viewer);');
  const overlay = content.indexOf('if (draft) {');
  assert.ok(gate > 0 && redact > gate && overlay > redact, 'draft overlay must come after the gate and the redaction');
});

test('APPLY WRITES THE STORY’S draft_json AND NOTHING THAT DECIDES WHO READS IT', () => {
  const actions = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  const writes = [...actions.matchAll(/\.from\('event_editorial'\)\s*\.(update|upsert|insert)\(/g)];
  assert.equal(writes.length, 1, 'the Apply writes the story row once');
  assert.equal(writes[0]![1], 'update', 'an update of the existing row — never an upsert that could create one');
  const at = writes[0]!.index!;
  const call = actions.slice(at, actions.indexOf('.select(', at));
  const keys = [...call.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(keys, ['draft_json']);
  for (const forbidden of ['publish_consent_at', 'published_at', 'edition_no', 'edition_volume']) {
    assert.ok(!actions.includes(forbidden), `Apply must not touch ${forbidden}`);
  }
  assert.match(actions, /applyPostEventItems\(liveStory, storyItems\)/);
});
