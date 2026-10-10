/**
 * the-per-stage-choice-travels-with-the-draft.test.ts — "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10), the stored value
 * and its road. Step 1 of the work: no screen writes it yet; this file holds the road it will take.
 *
 * THE VALUE: `invitation_widgets.config_json.stage_show`, beside `stage_order` and shaped like it —
 * `Partial<Record<LifecyclePhase, boolean>>`. `false` = hidden on that stage; `true` = shown on that stage; no entry
 * = our pick and the event-wide eye decide, as before. In a draft a stage may also be `null`: "take my choice back".
 *
 *   1. the sanitizer keeps only real stages and real choices, and `null`; a wrong shape is nothing;
 *   2. `configWithStageShow` merges stage by stage, `null` clears, every other key of the row survives;
 *   3. a draft merges stage by stage (a choice on one stage never forgets another's);
 *   4. the preview lays it over the live row — and an always-on row refuses it, as it refuses the eye;
 *   5. Apply: one free item per row, its value the WHOLE merged key; a choice equal to live is no item; an always-on
 *      row yields none; the live writer puts it at `config_json.stage_show`;
 *   6. a scene of their OWN that no guest sees today cannot be put in front of guests stage by stage around the Pro
 *      gate — it is held at Apply exactly as the eye's "show" is, stays drafted, and is listed with its way back;
 *   7. the Apply sheet names each stage that moved, and which way.
 *
 * SABOTAGES RUN (each seen red, then put back): the stage-by-stage merge in `mergeHubDraft` removed → 3; the
 * `!row.is_always_on` taken off the overlay → 4; `ownSceneOn` made blind to a stage set to shown → 6; the Apply
 * writer's key mapping removed → 5; the `!row.is_always_on` taken off the classifier → 5.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STAGE_ORDER_KEY, STAGE_SHOW_KEY, configWithStageShow, sanitizeStageShow, stageShown } from './stage-scenes';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, planHubDraftApply, sanitizeHubDraft, heldStageShow, hubDraftItemLabel } from './hub-draft';
import { hubDraftChangeLines, stageShowWhat } from './hub-draft-change-lines';
import { hubDraftProEffects } from './hub-pro-effects';
import { stripComments } from './strip-comments';

const ALWAYS = new Set<WidgetType>(['hero', 'greeting', 'qr_card', 'rsvp']);
const ALL: WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map', 'dress_code',
  'photo_moments', 'your_photos', 'special_message', 'what_to_bring', 'our_photos', 'our_love_story', 'custom_1',
];
const rows = (patch: Partial<Record<WidgetType, Partial<InvitationWidgetRow>>> = {}): InvitationWidgetRow[] =>
  ALL.map((t, i) => ({
    widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
    is_always_on: ALWAYS.has(t), tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
    ...(patch[t] ?? {}),
  }));
const draftOf = (patch: unknown) => mergeHubDraft(emptyHubDraft(), JSON.parse(JSON.stringify(patch)));
const widgetItems = (plan: ReturnType<typeof planHubDraftApply>, from: 'apply' | 'refused' = 'apply') =>
  plan[from].filter((i): i is Extract<typeof i, { kind: 'widget' }> => i.kind === 'widget' && i.field === 'stage_show');

test('1 · the sanitizer keeps real stages and real choices (and null), nothing else', () => {
  assert.deepEqual(sanitizeStageShow({ rsvp: false, event: true, editorial: null }), { rsvp: false, event: true, editorial: null });
  assert.deepEqual(sanitizeStageShow({ rsvp: 'no', event: 0, lunch: true, save_the_date: true }), { save_the_date: true });
  for (const bad of [null, undefined, true, 'rsvp', [], [true], {}, { lunch: false }]) assert.equal(sanitizeStageShow(bad), null);
  assert.equal(stageShown({ [STAGE_SHOW_KEY]: { rsvp: false } }, 'rsvp'), false);
  assert.equal(stageShown({ [STAGE_SHOW_KEY]: { rsvp: false } }, 'event'), null, 'no entry for a stage is no choice');
  assert.equal(stageShown({ [STAGE_SHOW_KEY]: { rsvp: 'hidden' } }, 'rsvp'), null);
  assert.equal(stageShown(null, 'rsvp'), null);
  assert.equal(stageShown({}, 'rsvp'), null);
});

test('2 · configWithStageShow merges stage by stage, null clears, and every other key survives', () => {
  const config = { canvas: { style: 'b' }, [STAGE_ORDER_KEY]: { rsvp: 2 }, [STAGE_SHOW_KEY]: { rsvp: false, event: true } };
  const next = configWithStageShow(config, { event: null, editorial: false });
  assert.deepEqual(next, { canvas: { style: 'b' }, [STAGE_ORDER_KEY]: { rsvp: 2 }, [STAGE_SHOW_KEY]: { rsvp: false, editorial: false } });
  assert.deepEqual(config[STAGE_SHOW_KEY], { rsvp: false, event: true }, 'the row handed in is not changed');
  // The last choice taken back removes the key itself — "nothing stored" is one shape, not two.
  assert.deepEqual(configWithStageShow({ a: 1, [STAGE_SHOW_KEY]: { rsvp: false } }, { rsvp: null }), { a: 1 });
  assert.deepEqual(configWithStageShow(null, {}), {});
});

test('3 · a draft merges stage by stage: a choice on one stage never forgets another', () => {
  const d1 = draftOf({ widgets: { our_love_story: { stage_show: { save_the_date: false } } } });
  const d2 = mergeHubDraft(d1, { widgets: { our_love_story: { stage_show: { event: true } } } });
  const d3 = mergeHubDraft(d2, { widgets: { our_love_story: { stage_order: { rsvp: 1 } } } });
  assert.deepEqual(d3.widgets.our_love_story?.stage_show, { save_the_date: false, event: true });
  assert.deepEqual(d3.widgets.our_love_story?.stage_order, { rsvp: 1 }, 'the place and the choice are two keys');
  // A stored draft is read back through the same sanitizer.
  const back = sanitizeHubDraft(JSON.parse(JSON.stringify({ v: 1, events: {}, widgets: { our_love_story: { stage_show: { rsvp: 'x', event: true, lunch: 1 } } }, history: [] })));
  assert.deepEqual(back?.widgets.our_love_story?.stage_show, { event: true });
});

test('4 · the preview lays it over the live row; an always-on row refuses it, as it refuses the eye', () => {
  const live = rows({ our_love_story: { config_json: { [STAGE_SHOW_KEY]: { rsvp: false }, canvas: { style: 'b' } } } });
  const draft = draftOf({
    widgets: {
      our_love_story: { stage_show: { rsvp: null, event: true } },
      hero: { stage_show: { rsvp: false }, is_visible: false },
      rsvp: { stage_show: { rsvp: false } },
    },
  });
  const laid = overlayHubDraftWidgets(live, draft);
  const story = laid.find((r) => r.widget_type === 'our_love_story')!;
  assert.deepEqual(story.config_json, { canvas: { style: 'b' }, [STAGE_SHOW_KEY]: { event: true } });
  for (const t of ['hero', 'rsvp'] as const) {
    const row = laid.find((r) => r.widget_type === t)!;
    assert.equal(stageShown(row.config_json, 'rsvp'), null, `${t} took a per-stage choice`);
    assert.equal(row.is_visible, true, 'anti-vacuity: the eye is refused on the same row');
  }
});

test('5 · Apply: one free item per row with the WHOLE merged key; equal to live is no item; always-on yields none', () => {
  const live = rows({ dress_code: { config_json: { [STAGE_SHOW_KEY]: { rsvp: false } } } });
  const draft = draftOf({
    widgets: {
      dress_code: { stage_show: { event: false } },
      schedule: { stage_show: { save_the_date: true } },
      countdown: { stage_show: { rsvp: null } }, // nothing live, nothing asked: no item
      hero: { stage_show: { rsvp: false } },
    },
  });
  const plan = planHubDraftApply(draft, { events: {}, widgets: live }, false);
  assert.equal(plan.refused.length, 0, 'showing or hiding a shipped scene is never Pro');
  const items = widgetItems(plan);
  assert.deepEqual(
    items.map((i) => [i.widgetType, i.value, i.pro]),
    [
      ['schedule', { save_the_date: true }, false],
      ['dress_code', { rsvp: false, event: false }, false],
    ],
  );
  // The same choice again, once live, is nothing to write.
  const again = planHubDraftApply(draftOf({ widgets: { dress_code: { stage_show: { rsvp: false } } } }), { events: {}, widgets: live }, false);
  assert.equal(widgetItems(again).length, 0);
  // Taking the last choice back writes "no key".
  const cleared = planHubDraftApply(draftOf({ widgets: { dress_code: { stage_show: { rsvp: null } } } }), { events: {}, widgets: live }, false);
  assert.deepEqual(widgetItems(cleared).map((i) => i.value), [null]);
  assert.equal(hubDraftItemLabel(items[0]!, () => 'Schedule'), 'Schedule · shown or hidden');

  // The live writer (hub-draft-actions.ts) files it under its own key, and a null deletes the key.
  const ACTIONS = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8'));
  assert.match(ACTIONS, /item\.field === 'stage_show'\s*\?\s*STAGE_SHOW_KEY/);
  assert.match(ACTIONS, /if \(value === null\) delete base\[key\];/);
  assert.match(ACTIONS, /item\.field === 'stage_show'\) \{\s*\(remaining\.widgets\[item\.widgetType\] \?\?= \{\}\)\.stage_show = heldStageShow\(item\.value\)/);
});

test('6 · a scene of their own, hidden today, cannot reach guests one stage at a time around the Pro gate', () => {
  const live = rows({ custom_1: { is_visible: false, config_json: { custom: { title: 'Ours', body: 'Words.' } } } });
  const draft = draftOf({ widgets: { custom_1: { stage_show: { rsvp: true } } } });
  const free = planHubDraftApply(draft, { events: {}, widgets: live }, false);
  assert.equal(widgetItems(free).length, 0, 'a couple without Pro had it written');
  const held = widgetItems(free, 'refused');
  assert.deepEqual(held.map((i) => [i.widgetType, i.change, i.pro, i.value]), [['custom_1', 'add', true, { rsvp: true }]]);
  assert.deepEqual(free.remaining.widgets.custom_1?.stage_show, { save_the_date: null, rsvp: true, event: null, editorial: null }, 'the held choice stays drafted');
  // With Pro it is written.
  const pro = planHubDraftApply(draft, { events: {}, widgets: live }, true);
  assert.equal(widgetItems(pro).length, 1);
  assert.equal(pro.refused.length, 0);
  // HIDING one on a stage is free, and so is a stage choice on a scene guests already see.
  const hide = planHubDraftApply(draftOf({ widgets: { custom_1: { stage_show: { rsvp: false } } } }), { events: {}, widgets: rows() }, false);
  assert.deepEqual(widgetItems(hide).map((i) => i.pro), [false]);
  const more = planHubDraftApply(draftOf({ widgets: { custom_1: { stage_show: { event: true } } } }), { events: {}, widgets: rows() }, false);
  assert.deepEqual(widgetItems(more).map((i) => i.pro), [false], 'a scene already in front of guests is not "added" by a stage choice');
  // The hold is listed with its way back: every stage to what is live.
  const effects = hubDraftProEffects(draft, { events: {}, widgets: live }, false);
  assert.equal(effects.length, 1);
  assert.deepEqual((effects[0]!.remove?.widgets as Record<string, unknown> | undefined)?.custom_1, {
    mode: 'auto',
    is_visible: false,
    stage_show: heldStageShow(null),
  });
});

test('7 · the Apply sheet names each stage that moved, and which way', () => {
  assert.equal(stageShowWhat({}, { event: false }), 'Hidden on The Day');
  assert.equal(stageShowWhat({ [STAGE_SHOW_KEY]: { rsvp: false, event: true } }, { save_the_date: true, event: true }), 'Shown on Save the Date, Our pick on Invitation');
  const live = rows();
  const lines = hubDraftChangeLines(draftOf({ widgets: { our_love_story: { stage_show: { save_the_date: false, editorial: false } } } }), { events: {}, widgets: live }, false);
  assert.deepEqual(lines, [{ place: 'Our love story', what: 'Hidden on Save the Date, Hidden on Post Event', pro: false, held: false }]);
});
