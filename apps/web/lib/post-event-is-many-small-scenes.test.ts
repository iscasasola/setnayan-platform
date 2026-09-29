/**
 * post-event-is-many-small-scenes.test.ts — the owner's 2026-09-25 ruling, held.
 *
 * *"the story on that scene 1 of post event is the whole story, what we want is
 * to cut them into smaller scenes to allow content for each part"* (DECISION_LOG
 * "POST EVENT IS MANY SMALL SCENES"), with 2026-09-29 "EVERY STYLE OF EVERY
 * SCENE SHIPS":
 *
 *   1. BEFORE the day the navigator lists every scene — `Not yet`, each saying
 *      what will fill it; none hidden, none empty, never the one story tile
 *      (brief §5 test 1).
 *   2. After the compile, the SAME keys are filled.
 *   3. The Maker reads Post Event before AND after the day, the couple's draft
 *      laid over it, and never sends the couple away to edit a scene.
 *   4. A waiting scene is drawn with its placeholder for the COUPLE only.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { makerStageLists, type MakerStageInput, type MakerTile } from './maker-scene-list';
import { POST_EVENT_WAITING, compilePostEventScenes, postEventSceneList, type PostEventSources } from './post-event-scenes';

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

/** Months before the day: nothing the day fills exists yet. */
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
  chapters: [
    { time: '2:30 PM', title: 'The vows', leadId: 'a', isClip: false, media: 3 },
    { time: '6:05 PM', title: 'First dance', leadId: 'b', isClip: true, media: 1 },
  ],
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

test('1 · BEFORE THE DAY: every default scene is listed, Not yet, each with its placeholder — none hidden, none empty', () => {
  const rows = postEventSceneList(compilePostEventScenes(BEFORE, AT, { dayHappened: false }), {});
  const lists = makerStageLists({ ...PLAN, postEvent: rows });
  const keys = lists.editorial.shown.map((t) => t.key);
  assert.ok(!keys.includes('f:editorial'), 'the single "The story after the day" tile is gone');
  const tiles = lists.editorial.shown.map(pe).filter((t): t is NonNullable<typeof t> => t !== null);
  assert.ok(tiles.length >= 18, `only ${tiles.length} scene tiles`);
  console.log(`[post-event] before the day: ${tiles.length} scene tiles`);
  for (const t of tiles) {
    assert.equal(t.hidden, false, `${t.scene} is hidden before the day`);
    if (t.scene === 'cover' || t.scene === 'next') continue;
    assert.equal(t.status, 'waiting', `${t.scene} is "Not yet", never "skipped", before the day`);
    assert.equal(t.drawn, false, `${t.scene}: a guest never meets a waiting scene`);
    assert.ok(t.note && t.note.length > 10, `${t.scene} says what will fill it`);
    assert.equal(t.note, POST_EVENT_WAITING[t.scene === 'chapters' ? 'chapters' : t.scene], `${t.scene} shows ITS placeholder`);
  }
  assert.equal(tiles.find((t) => t.scene === 'cover')!.status, 'auto', 'the cover is real before the day — the hero, the names');
  // A waiting scene drawn in its style stands on the couple's canvas, so its tile scrolls there.
  assert.equal(tiles.find((t) => t.scene === 'numbers')!.anchor, 'p:numbers');
  assert.equal(tiles.find((t) => t.scene === 'couple')!.anchor, 'p:couple');
  assert.equal(tiles.find((t) => t.scene === 'asked')!.anchor, 'p:asked', 'every scene drawn in a style waits on the canvas too');
  assert.equal(tiles.find((t) => t.scene === 'wall')!.anchor, null, 'a shipped block with nothing is not on the canvas');
});

test('2 · after the compile the SAME keys are filled, never replaced by others', () => {
  const before = compilePostEventScenes(BEFORE, AT, { dayHappened: false }).scenes.map((s) => s.key);
  const after = compilePostEventScenes({ ...AFTER, chapters: [] }, AT, { dayHappened: true }).scenes.map((s) => s.key);
  assert.deepEqual(after, before);
  const filled = compilePostEventScenes(AFTER, AT).scenes;
  assert.ok(filled.every((s) => s.status !== 'waiting'), 'nothing waits after the day');
  // After the day, "nothing" is skipped — the old rule, unchanged.
  const empty = compilePostEventScenes(BEFORE, AT, { dayHappened: true }).scenes;
  assert.equal(empty.find((s) => s.key === 'gallery')!.status, 'skipped');
});

test('3 · SOURCE: the Maker reads Post Event before AND after the day, the draft laid over it — and sends nobody away', () => {
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /const postEvent = await readPostEventForMaker\(\{/, 'read on every open, not only after the day');
  assert.match(page, /draftEditorial: hubDraft\?\.editorial \?\? null/);
  const compile = read('lib/post-event-compile.server.ts');
  assert.match(compile, /if \(!input\.eventEnded\) return readPostEventBeforeTheDay\(input\);/, 'before the day: the light read, which writes nothing');
  const before = compile.slice(compile.indexOf('async function readPostEventBeforeTheDay'));
  assert.ok(!/\.(update|upsert|insert)\(/.test(before), 'the before-the-day read must never write');
  assert.ok(!/loadEditorialData\(/.test(before), 'the before-the-day read must stay light');
  // No link-outs: the scene's panel edits here, never "in your story workroom ↗".
  const panel = read('app/dashboard/[eventId]/website/editor/_components/post-event-scene-panel.tsx');
  assert.ok(!/next\/link|href=/.test(panel), 'the Post Event panel links out');
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.ok(!/Show, hide or reorder in your story workroom/.test(shell), 'the workroom link came back');
  assert.match(shell, /<PostEventScenePanel\b/);
});

test('4 · SOURCE: a waiting scene’s placeholder is the COUPLE’s — the canvas and the whole-stage preview only', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.match(body, /hostPreview=\{isEditorCanvas\}/);
  assert.match(body, /draft=\{isEditorCanvas \? editorialDraft : null\}/, 'a guest never gets the host’s draft');
  const content = read('app/[slug]/_components/editorial/editorial-content.tsx');
  assert.match(
    content,
    /const placeholderOf = \(scene: string\) => \(hostPreview && !dayHappened \? \(POST_EVENT_WAITING\[scene\] \?\? null\) : null\);/,
    'a placeholder is the couple’s, and only before the day',
  );
  // Every placeholder the page draws comes through that one gate.
  assert.ok(!/POST_EVENT_WAITING\[/.test(content.replace(/const placeholderOf[^\n]*\n/, '')), 'a placeholder is read around the gate');
  // And the bridge stamps parts only on a scene drawn in its style.
  const bridge = read('app/[slug]/_components/editor-bridge.tsx');
  assert.match(bridge, /key\.startsWith\('p:'\) && section\.hasAttribute\('data-post-event-look'\)/);
});
