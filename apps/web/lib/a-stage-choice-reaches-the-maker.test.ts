/**
 * a-stage-choice-reaches-the-maker.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10): the Maker's own lists obey
 * the couple's per-stage choice, so the Maker cannot list a scene the guest page took off (or leave out one it draws).
 *
 * THE READERS HELD HERE:
 *   · `makerStageList` (`lib/maker-scene-list.ts`) — what the navigator shows for a stage, and the fold with the
 *     reason a scene is left out;
 *   · `buildMakerNavigatorData` (`maker-navigator-data.ts`) — the four stage lists the Maker is handed, and each
 *     stage's FULL order (`fullOrders`), the list a drop is counted in;
 *   · the move action (`website/widgets/actions.ts` `moveWithinStage`) — the list a drag swaps in, live and in the
 *     draft (`configWithDraftedStage`).
 *
 *   1. hidden on a stage: not listed there, folded with "Hidden on <stage>." — marked `hiddenHere` and (since the eye
 *      writes the stage's own value, step 2) `hiddenByCouple`, so the eye brings it back there — every other stage's
 *      list and fold as they were;
 *   2. shown on a stage over the event-wide eye: listed there; folded as hidden-by-the-couple on the others;
 *   3. added to a stage: listed there, after the stage's own scenes; refused where it cannot be, with the reason;
 *   4. "Our story" (the prose's tile) is not listed on a stage the love story is hidden on, and steps aside for the
 *      scene on a stage it was added to;
 *   5. the navigator's data: the stage lists AND the full order carry a hidden / an added scene;
 *   6. the move action swaps in a list that has an added scene — one the couple added only in the draft included.
 *
 * NOT HERE, AND WHY: `element-preview.ts` `sceneDrawEffect` (what one tap of the eye does to the canvas) reads the
 * event-wide eye only. It runs in the Maker's browser and would need the per-stage value shipped to it; it belongs to
 * the step that re-aims the eye itself. No control stores a per-stage value yet, so it cannot be reached today.
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · the fold made deaf to "hidden here" (`choice === false` branch removed)                 → 1 red;
 *   B · the fold made to put the eye before the stage's choice (`visible` = the eye alone)      → 3 red;
 *   C · the "Our story" tile made deaf (`!hiddenOnStage(…)` removed)                            → 4 red;
 *   D · the move action handed the drafted ORDERS only (`stage_show` not laid)                  → 6 red;
 *   E · the plan under the Maker's list made to ignore the choice (as in the stage-list file)   → 1, 2, 3, 4, 5 red;
 *   F · `hiddenByCouple` made to follow the event-wide eye alone for a scene hidden here        → 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STAGE_SCENES, STAGE_SHOW_KEY, stageRowOrder, stagePlacesAfterMove } from './stage-scenes';
import { WIDGET_CATALOG_BY_TYPE, isWidgetType, widgetInPhase, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { hiddenOnStageLine, makerStageList, type MakerStageInput } from './maker-scene-list';
import { configWithDraftedStage, emptyHubDraft, mergeHubDraft } from './hub-draft';
import { stripComments } from './strip-comments';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const ORDER: readonly WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'rsvp', 'countdown', 'schedule', 'special_message', 'dress_code',
  'venue_map', 'what_to_bring', 'our_love_story', 'our_photos', 'photo_moments', 'your_photos', 'custom_1',
];
type Patch = Partial<Pick<InvitationWidgetRow, 'is_visible' | 'mode'>> & { show?: Partial<Record<LifecyclePhase, boolean>>; config?: Record<string, unknown> };
const rows = (patch: Partial<Record<WidgetType, Patch>> = {}): InvitationWidgetRow[] =>
  ORDER.map((t, i) => {
    const p = patch[t] ?? {};
    return {
      widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: p.is_visible ?? true,
      is_always_on: WIDGET_CATALOG_BY_TYPE[t].is_always_on, tier: 'basic', created_at: '', updated_at: '', mode: p.mode ?? 'auto', audience: 'public',
      config_json: { ...(p.show ? { [STAGE_SHOW_KEY]: p.show } : {}), ...(p.config ?? {}) },
    };
  });

const input = (widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase, more: Partial<MakerStageInput> = {}): MakerStageInput => ({
  stage, widgets, openBrowse: false, content: {}, solemn: false, hasHeroMedia: false, hasEntourage: true, storyRenders: true, ...more,
});
const list = (widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase, more: Partial<MakerStageInput> = {}) => makerStageList(input(widgets, stage, more));
const scenes = (l: ReturnType<typeof makerStageList>) => l.shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
const fixedKeys = (l: ReturnType<typeof makerStageList>) => l.shown.flatMap((t) => (t.kind === 'fixed' ? [t.fixed] : []));
const foldOf = (l: ReturnType<typeof makerStageList>, type: WidgetType) => l.folded.find((f) => f.type === type);
/** Led by the photos, so the Save the Date's own list is on the canvas. */
const PHOTOS = { our_photos: { config: { std_lead: 'photos' } } } as const;

test('1 · hidden on a stage: not listed there, folded as hidden HERE, and every other stage as it was', () => {
  for (const openBrowse of [false, true]) {
    for (const [type, stage] of [['special_message', 'rsvp'], ['our_love_story', 'editorial'], ['schedule', 'event'], ['countdown', 'save_the_date']] as const) {
      const before = Object.fromEntries(STAGES.map((s) => [s, list(rows(PHOTOS), s, { openBrowse })]));
      assert.ok(scenes(before[stage]!).includes(type), `anti-vacuity: ${type} is listed on ${stage}`);
      const stored = rows({ ...PHOTOS, [type]: { show: { [stage]: false } } });
      const here = list(stored, stage, { openBrowse });
      assert.ok(!scenes(here).includes(type), `${type} hidden on ${stage} is still listed (openBrowse ${openBrowse})`);
      const fold = foldOf(here, type);
      assert.ok(fold, 'it left the stage without a line saying why');
      /* 🔁 RE-AIMED in step 2 (2026-10-11): the eye now writes the stage's own value, so a scene hidden here IS brought
         back by it — `hiddenByCouple` is true again, `hiddenHere` says which kind, and the line is the sheet's phrase. */
      assert.equal(fold.reason, hiddenOnStageLine(stage));
      assert.match(fold.reason, /^Hidden on (Save the Date|Invitation|The Day|Post Event)\.$/);
      assert.equal(fold.hiddenHere, true);
      assert.equal(fold.hiddenByCouple, true, 'a scene hidden on this stage is offered no eye to bring it back');
      for (const s of STAGES) if (s !== stage) assert.deepEqual(list(stored, s, { openBrowse }), before[s], `${type} hidden on ${stage} changed the Maker’s ${s}`);
      // Hidden here AND switched off by the eye: still "hidden here" — the eye alone would not bring it back to this stage.
      const both = foldOf(list(rows({ ...PHOTOS, [type]: { is_visible: false, mode: 'hidden', show: { [stage]: false } } }), stage, { openBrowse }), type)!;
      assert.deepEqual([both.reason, both.hiddenHere, both.hiddenByCouple], [hiddenOnStageLine(stage), true, true]);
    }
  }
});

test('2 · shown on a stage over the event-wide eye: listed there; hidden-by-the-couple on the others', () => {
  const stored = rows({ special_message: { is_visible: false, show: { rsvp: true } } });
  assert.ok(scenes(list(stored, 'rsvp')).includes('special_message'));
  assert.equal(foldOf(list(stored, 'rsvp'), 'special_message'), undefined);
  const after = foldOf(list(stored, 'editorial'), 'special_message');
  assert.ok(after && after.hiddenByCouple && after.hiddenHere === undefined, 'the eye still decides the stage with no choice');
  // Open browsing: the mode is the eye.
  const mode = rows({ special_message: { mode: 'hidden', show: { rsvp: true } } });
  assert.ok(scenes(list(mode, 'rsvp', { openBrowse: true })).includes('special_message'));
});

test('3 · added to a stage: listed after the stage’s own scenes; refused where it cannot be, with the reason', () => {
  for (const [type, stage] of [['schedule', 'save_the_date'], ['special_message', 'event'], ['dress_code', 'editorial'], ['venue_map', 'save_the_date']] as const) {
    assert.ok(!STAGE_SCENES[stage].includes(type));
    const before = list(rows(PHOTOS), stage);
    assert.ok(foldOf(before, type)?.reason.startsWith('Not part of this stage.'), 'anti-vacuity: it is folded as another stage’s');
    const added = list(rows({ ...PHOTOS, [type]: { show: { [stage]: true } } }), stage);
    assert.deepEqual(scenes(added), [...scenes(before), type], `${type} added to ${stage}: ${scenes(added).join(' → ')}`);
    assert.equal(foldOf(added, type), undefined, 'it is listed AND folded');
  }
  // The dress code and the reminders on The Day are the Welcome's: never a second copy, and the fold says where they are.
  for (const type of ['dress_code', 'what_to_bring'] as const) {
    for (const eye of [true, false]) {
      const l = list(rows({ [type]: { is_visible: eye, show: { event: true } } }), 'event');
      assert.ok(!scenes(l).includes(type));
      const fold = foldOf(l, type)!;
      assert.equal(fold.reason, 'On the day, each guest meets it on their Welcome.');
      assert.equal(fold.hiddenByCouple, false, 'shown on The Day reads as hidden by the couple');
    }
  }
  // After the day a countdown, the reminders and the camera cues are retired, whatever is stored.
  for (const type of ['countdown', 'what_to_bring', 'photo_moments'] as const) {
    const l = list(rows({ [type]: { show: { editorial: true } } }), 'editorial');
    assert.ok(!scenes(l).includes(type));
    assert.equal(foldOf(l, type)!.reason, 'Retired after the day.');
  }
  // A guest's own scene is never the canvas's (a host holds no guest key), stored or not.
  const own = list(rows({ event_details: { show: { event: true } } }), 'event');
  assert.ok(!scenes(own).includes('event_details'));
  assert.equal(foldOf(own, 'event_details')!.reason, "Only on each guest's own link.");
});

test('4 · "Our story" (the prose’s tile): gone where the love story is hidden, and aside where the scene was added', () => {
  assert.ok(fixedKeys(list(rows(), 'event')).includes('story'), 'anti-vacuity: The Day lists the prose');
  assert.ok(!fixedKeys(list(rows({ our_love_story: { show: { event: false } } }), 'event')).includes('story'), 'the prose is listed on a stage the story is hidden on');
  // Hidden on ANOTHER stage: The Day keeps it.
  assert.ok(fixedKeys(list(rows({ our_love_story: { show: { rsvp: false } } }), 'event')).includes('story'));
  // On the Invitation: no scene, no prose tile.
  const invite = list(rows({ our_love_story: { show: { rsvp: false } } }), 'rsvp');
  assert.ok(!scenes(invite).includes('our_love_story') && !fixedKeys(invite).includes('story'));
  // Today's eye, kept: the scene folds, the prose tile stands in.
  const eye = list(rows({ our_love_story: { is_visible: false } }), 'rsvp');
  assert.ok(!scenes(eye).includes('our_love_story') && fixedKeys(eye).includes('story'));
  // Added to The Day: the scene is listed and the prose tile is not (the story once).
  const added = list(rows({ our_love_story: { show: { event: true } } }), 'event');
  assert.ok(scenes(added).includes('our_love_story') && !fixedKeys(added).includes('story'));
});

test('5 · the navigator’s data: its stage lists and its full orders carry a hidden and an added scene', async () => {
  const { buildMakerNavigatorData } = await import('@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data');
  const facts = {
    names: null, dateLabel: null, daysToGo: null, venueName: null, venueAddress: null, firstBlock: null, dressTitle: null,
    dressLine: null, photoMomentsLine: null, specialMessage: null, whatToBring: null, loveStory: null, entourageCount: null,
    heroPhotoUrl: null, firstGalleryUrl: null,
  };
  const data = (widgets: InvitationWidgetRow[]) =>
    buildMakerNavigatorData({
      plan: { widgets, openBrowse: false, content: {}, solemn: false, hasHeroMedia: false, hasEntourage: true, storyRenders: true },
      sectionRows: widgets,
      tint: { canvas: '#ffffff', ink: '#000000', accent: '#888888' } as never,
      facts,
      photoUrls: {},
    });
  const plain = data(rows(PHOTOS));
  const stored = data(rows({ ...PHOTOS, schedule: { show: { save_the_date: true, event: false } } }));
  // Added to the Save the Date: listed, and in the full order a drop is counted in.
  assert.ok(!plain.fullOrders.save_the_date.includes('id-schedule'), 'anti-vacuity');
  assert.ok(stored.fullOrders.save_the_date.includes('id-schedule'), 'an added scene has no place in the stage’s full order');
  assert.ok(scenes(stored.stageLists.save_the_date).includes('schedule'));
  // Hidden on The Day: not listed — and still IN the full order (a drag past a hidden scene is counted right).
  assert.ok(!scenes(stored.stageLists.event).includes('schedule'));
  assert.equal(foldOf(stored.stageLists.event, 'schedule')?.hiddenHere, true);
  assert.ok(stored.fullOrders.event.includes('id-schedule'));
  // Nothing else moved.
  assert.deepEqual(stored.stageLists.rsvp, plain.stageLists.rsvp);
  assert.deepEqual(stored.stageLists.editorial, plain.stageLists.editorial);
  assert.deepEqual(stored.fullOrders.rsvp, plain.fullOrders.rsvp);
});

test('6 · the move action swaps in a list that has an added scene — one added only in the draft included', () => {
  const inStage = (t: string, s: LifecyclePhase) => isWidgetType(t) && widgetInPhase(t, s);
  // LIVE: the action reads `config_json` and asks `stageRowOrder`; an added scene can be moved up.
  const live = rows({ ...PHOTOS, schedule: { show: { save_the_date: true } } }).filter((r) => !r.is_always_on);
  const ordered = stageRowOrder(live, 'save_the_date', inStage);
  assert.equal(ordered[ordered.length - 1]!.widget_type, 'schedule');
  const moved = stagePlacesAfterMove(ordered, 'id-schedule', 'up');
  assert.ok(moved, 'an added scene has nothing to swap with');
  // IN THE DRAFT: the choice is only drafted — the list the action builds must have it all the same.
  const draft = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { stage_show: { save_the_date: true }, stage_order: { save_the_date: 0 } } } });
  const laid = rows(PHOTOS)
    .filter((r) => !r.is_always_on)
    .map((r) => ({ ...r, config_json: configWithDraftedStage(r.config_json, draft.widgets[r.widget_type]) }));
  const drafted = stageRowOrder(laid, 'save_the_date', inStage);
  assert.equal(drafted[0]!.widget_type, 'schedule', 'the drafted choice and the drafted place are both laid');
  const untouched = rows(PHOTOS).find((r) => r.widget_type === 'countdown')!;
  assert.equal(configWithDraftedStage(untouched.config_json, draft.widgets.countdown), untouched.config_json, 'a row the draft does not name is handed back as it is');

  // The action itself (a server action — read as text, anchored on the function that moves).
  const ACTIONS = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/widgets/actions.ts'), 'utf8'));
  const start = ACTIONS.indexOf('async function moveWithinStage(');
  assert.ok(start > 0, 'moveWithinStage is gone');
  const body = ACTIONS.slice(start, ACTIONS.indexOf('\nasync function ', start + 10) > 0 ? ACTIONS.indexOf('\nasync function ', start + 10) : start + 4000);
  assert.match(body, /\.select\('widget_id, widget_type, display_order, is_always_on, config_json'\)/, 'the move no longer reads the row’s config');
  assert.match(body, /const drafted = drafting \? await draftedStageConfigs\(eventId\) : null;/);
  assert.match(body, /drafted \? drafted\(r\.widget_type, r\.config_json\) : r\.config_json/);
  assert.equal(body.match(/stageRowOrder\(rows, stage,/g)?.length, 1, 'the move swaps in the stage’s own full order');
  const STORE = stripComments(readFileSync(join(__dirname, 'hub-draft-store.ts'), 'utf8'));
  assert.match(STORE, /return \(widgetType, config\) => configWithDraftedStage\(config, widgets\[widgetType\]\);/);
});
