/**
 * post-event-presets.test.ts — POST EVENT'S OWN "+ ADD A SCENE" (brief §5 tests
 * 2 · 3 · 4; strategy §5; owner answers E3 · E5, 2026-09-25).
 *
 *   2. Twelve presets, exactly the approved ids, each on its strategy template;
 *      none of the old branch's ten remains.
 *   3. A preset is an ordinary `custom_N` scene of the couple's own: it takes
 *      one of the SIX shared across stages (a seventh is refused with the "six
 *      used" message), and it is on Post Event only.
 *   4. Pro at Apply: a free couple places a preset in the draft; Apply holds it
 *      and applies the rest; a Pro couple's applies. Reorder / hide stay free.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { POST_EVENT_PRESETS, POST_EVENT_PRESET_IDS, postEventPreset } from './post-event-presets';
import { SCENE_TEMPLATES } from './scene-templates';
import { CUSTOM_SECTION_TYPES, nextFreeCustomSlot } from './custom-sections';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import { widgetsGuestsMeet } from './maker-scene-list';
import { classifyHubDraft, emptyHubDraft, mergeHubDraft, planHubDraftApply, hubDraftItemLabel, type HubLiveState } from './hub-draft';
import { addedSceneDraft } from './scene-writes';
import { postEventShow, postEventMove, postEventArrangementOf } from './post-event-draft';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('2 · twelve presets, exactly the approved ids, each on its strategy template — none of the old ten', () => {
  const byId = Object.fromEntries(POST_EVENT_PRESETS.map((p) => [p.id, p.template]));
  assert.deepEqual(byId, {
    thank_you_from_us: 11, // P1 Letter
    the_toast: 6, // P2 Portrait + pull quote
    best_of: 21, // P3 Collage of 5–6
    before_and_after: 17, // P4 Two side by side
    behind_the_scenes: 18, // P5 Three mosaic
    what_almost_happened: 23, // P6 Three short blocks
    by_our_count: 12, // P7 Big number
    near_and_far: 22, // P8 Two columns
    our_playlist: 24, // P9 Timeline
    the_guestbook: 19, // P10 Grid of four
    wish_you_were_here: 8, // P11 Words only
    since_then: 1, // P12 Photo left, words right
  });
  assert.equal(POST_EVENT_PRESETS.length, 12);
  assert.deepEqual([...POST_EVENT_PRESET_IDS], POST_EVENT_PRESETS.map((p) => p.id), 'the ids and the catalogue are one list');
  for (const p of POST_EVENT_PRESETS) {
    assert.ok(SCENE_TEMPLATES[p.template], `${p.id}: no template ${p.template}`);
    assert.ok(p.name && p.purpose && p.fields, `${p.id}: the tile needs its name, its ⓘ and its fields`);
  }
  // The stale branch's ten, by the names it used — none survives.
  const src = readFileSync(join(WEB, 'lib/post-event-presets.ts'), 'utf8');
  for (const old of ['thank_you_note', 'chapter_of_the_day', 'line_to_remember', 'gallery_grid', 'wishes_wall', 'were_you_there', 'whats_next', 'in_memory']) {
    assert.ok(!src.includes(`'${old}'`), `the old preset "${old}" is back`);
  }
  assert.equal(postEventPreset('confetti'), null, 'an unknown preset is dropped, never guessed');
});

const row = (type: WidgetType, config: Record<string, unknown> = {}, visible = true): InvitationWidgetRow => ({
  widget_id: `id-${type}`,
  event_id: 'e1',
  widget_type: type,
  display_order: 1,
  is_visible: visible,
  is_always_on: false,
  tier: 'basic',
  config_json: config,
  created_at: '',
  updated_at: '',
  mode: 'auto',
  audience: 'public',
});

test('3 · a preset is a custom_N scene: one of the SIX shared across stages, and on Post Event only', () => {
  // The canvas names its preset — never `preset`, which is the scene's motion.
  const canvas = sanitizeHubCanvas({ canvas: { template: 6, preset: 'calm', postEventPreset: 'the_toast' } });
  assert.equal(canvas.postEventPreset, 'the_toast');
  assert.equal(canvas.preset, 'calm');
  assert.equal(sanitizeHubCanvas({ canvas: { postEventPreset: 'nope' } }).postEventPreset, undefined);

  // Adding one takes the next of the SHARED six — whatever stage the others were added on.
  const used: string[] = ['custom_1', 'custom_2'];
  assert.equal(nextFreeCustomSlot(used), 'custom_3');
  // A seventh across all stages is refused.
  assert.equal(nextFreeCustomSlot([...CUSTOM_SECTION_TYPES]), null);
  const actions = read('app/dashboard/[eventId]/website/widgets/actions.ts');
  assert.match(actions, /const slot = nextFreeCustomSlot\(used\);\s*if \(!slot\) \{[\s\S]{0,300}no_free_section/, 'the add door refuses a seventh');
  const picker = read('app/dashboard/[eventId]/website/editor/_components/scene-template-picker.tsx');
  assert.match(picker, /You have all six of your own scenes\. Remove one you are not using to add another\./, 'the sheet says "six used"');
  assert.match(picker, /disabled=\{full\}/, 'a full sheet posts nothing');

  // On Post Event only.
  const rows = [row('custom_1', { canvas: { template: 6, postEventPreset: 'the_toast' } }), row('custom_2', { canvas: { template: 1 } })];
  for (const stage of ['save_the_date', 'rsvp', 'event'] as const) {
    assert.deepEqual(widgetsGuestsMeet(rows, stage).map((w) => w.widget_type), ['custom_2'], `${stage} shows a Post Event preset`);
  }
  assert.deepEqual(widgetsGuestsMeet(rows, 'editorial').map((w) => w.widget_type), ['custom_1', 'custom_2']);

  // The add door stores the preset on the canvas, pre-titled, from the PRESET's own template.
  assert.match(actions, /const template = preset \? preset\.template : sceneTemplateIdFromForm/);
  assert.match(actions, /postEventPreset: preset\.id/);
  assert.match(actions, /title: preset\.name/);
});

test('4 · Pro at Apply: a free couple tries a preset in the draft — Apply holds it and applies the rest; Pro applies', () => {
  // As `addCustomSection` leaves it: the row inserted HIDDEN live, drafted shown.
  const liveRow = row('custom_3', { canvas: { template: 6, postEventPreset: 'the_toast' } }, false);
  const live: HubLiveState = {
    events: {},
    widgets: [liveRow],
    editorial: { sections: {} },
  };
  const canvas = { template: 6, postEventPreset: 'the_toast' } as HubSectionCanvas;
  const arr = postEventArrangementOf({});
  const draft = mergeHubDraft(emptyHubDraft(), {
    widgets: { custom_3: addedSceneDraft({ displayOrder: 1, canvas }) },
    editorial: { ...postEventShow(arr, 'gallery', false), ...postEventMove(arr, 'ch-2', 1)! },
  });

  const free = planHubDraftApply(draft, live, false);
  const held = free.refused.filter((i) => i.kind === 'widget' && i.field === 'is_visible');
  assert.equal(held.length, 1, 'showing the preset scene is held for a free couple');
  assert.equal(held[0]!.pro, true);
  assert.equal(hubDraftItemLabel(held[0]!, () => 'Your scene'), 'Your scene · shown or hidden');
  assert.equal(free.remaining.widgets.custom_3?.is_visible, true, 'the draft keeps it shown, for the Apply after Pro');
  // Reorder and hide are free — applied beside the held preset.
  const story = free.apply.filter((i) => i.kind === 'editorial').map((i) => (i.kind === 'editorial' ? i.item.field : ''));
  assert.deepEqual(story, ['sections', 'sectionOrder']);

  const pro = planHubDraftApply(draft, live, true);
  assert.equal(pro.refused.length, 0, 'a Pro couple’s preset goes live');
  assert.ok(pro.apply.some((i) => i.kind === 'widget' && i.field === 'is_visible' && i.value === true));

  // Hiding a preset scene again is always free.
  const hide = mergeHubDraft(emptyHubDraft(), { widgets: { custom_3: { is_visible: false } } });
  const liveShown: HubLiveState = { ...live, widgets: [{ ...liveRow, is_visible: true }] };
  const { items } = classifyHubDraft(hide, liveShown);
  assert.deepEqual(items.map((i) => (i.kind === 'widget' ? [i.field, i.pro] : [])), [['is_visible', false]]);

  // The Apply names a held preset by its preset and place.
  const action = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(action, /`Post Event · your scene “\$\{preset\.name\}”`/);
});
