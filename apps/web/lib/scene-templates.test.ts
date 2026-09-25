/**
 * scene-templates.test.ts — THE 25, AS THE OWNER APPROVED THEM.
 *
 * Build plan Phase 5 tests: "every template has both arrangements and a
 * default {preset, transition}". The expected table below is copied from the
 * prototype's own v3 notes (`prototypes/event_hub_editor_FINAL_2026-09-24.html`,
 * "v3 · the 25 templates (default preset · transition)"), not from the module —
 * a guard whose expected set is built from the constant under test can only
 * ever agree with it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCENE_FAMILIES,
  SCENE_MAX_SLOTS,
  SCENE_TEMPLATES,
  SCENE_TEMPLATE_IDS,
  sceneSlotCount,
  sceneTemplateClass,
  sceneTemplateDefaults,
  sceneTemplateId,
  sceneTemplateIdFromForm,
  sceneTemplatesIn,
} from './scene-templates';

/** id · name · preset · transition — the prototype's sentence, one row each. */
const PROTOTYPE: readonly [number, string, string, string][] = [
  [1, 'Photo left, words right', 'calm', 'scroll'],
  [2, 'Photo right, words left', 'calm', 'scroll'],
  [3, 'Photo above, words below', 'calm', 'scroll'],
  [4, 'Full photo, words on top', 'cinematic', 'scrub'],
  [5, 'Clip with a caption', 'cinematic', 'scroll'],
  [6, 'Portrait photo + pull quote', 'editorial', 'scrub'],
  [7, 'Half photo, half colour', 'calm', 'scroll'],
  [8, 'Words only', 'editorial', 'scroll'],
  [9, 'Big quote', 'editorial', 'scrub'],
  [10, 'Title card', 'editorial', 'scroll'],
  [11, 'Letter', 'still', 'scroll'],
  [12, 'Big number', 'editorial', 'scroll'],
  [13, 'Full photo', 'cinematic', 'scrub'],
  [14, 'Full clip', 'cinematic', 'scrub'],
  [15, 'Framed photo', 'calm', 'scroll'],
  [16, 'Monogram on colour', 'still', 'scroll'],
  [17, 'Two side by side', 'calm', 'scroll'],
  [18, 'Three mosaic', 'calm', 'scroll'],
  [19, 'Grid of four', 'calm', 'scroll'],
  [20, 'Photo strip', 'still', 'scroll'],
  [21, 'Collage of 5–6', 'calm', 'scroll'],
  [22, 'Two columns', 'editorial', 'scroll'],
  [23, 'Three short blocks', 'editorial', 'scroll'],
  [24, 'Timeline', 'editorial', 'scrub'],
  [25, 'Questions & answers', 'editorial', 'scroll'],
];

test('⭐ 25 templates, ids 1–25, each exactly the prototype’s name and default effect', () => {
  assert.equal(SCENE_TEMPLATE_IDS.length, 25);
  assert.deepEqual([...SCENE_TEMPLATE_IDS], PROTOTYPE.map(([id]) => id));
  for (const [id, name, preset, transition] of PROTOTYPE) {
    const t = SCENE_TEMPLATES[id as 1];
    assert.equal(t.id, id);
    assert.equal(t.name, name, `#${id} name`);
    assert.equal(t.preset, preset, `#${id} preset`);
    assert.equal(t.transition, transition, `#${id} transition`);
  }
});

test('⭐ five families, the owner’s counts: Media+text 7 · Text 5 · Media 4 · Photos 5 · Texts 4', () => {
  assert.deepEqual(
    SCENE_FAMILIES.map((f) => sceneTemplatesIn(f).length),
    [7, 5, 4, 5, 4],
  );
});

test('★ the four approved arrangements are 1, 2, 4 and 8', () => {
  assert.deepEqual(
    SCENE_TEMPLATE_IDS.filter((id) => SCENE_TEMPLATES[id].approved),
    [1, 2, 4, 8],
  );
});

test('four build on shipped parts — names, special message, countdown, monogram — and 24 on the milestones', () => {
  assert.equal(SCENE_TEMPLATES[10].builtOn, 'names');
  assert.equal(SCENE_TEMPLATES[11].builtOn, 'special_message');
  assert.equal(SCENE_TEMPLATES[12].builtOn, 'countdown');
  assert.equal(SCENE_TEMPLATES[16].builtOn, 'monogram');
  assert.equal(SCENE_TEMPLATES[24].builtOn, 'milestones');
});

test('⭐ every template has BOTH arrangements, and every box sits inside its tile', () => {
  for (const id of SCENE_TEMPLATE_IDS) {
    const { desk, phone } = SCENE_TEMPLATES[id].thumb;
    assert.ok(desk.length > 0, `#${id} has a desktop drawing`);
    assert.ok(phone.length > 0, `#${id} has a phone drawing`);
    for (const [kind, x, y, w, h] of [...desk, ...phone]) {
      assert.ok(x >= 0 && x <= 100 && y >= 0 && y <= 100, `#${id} ${kind} starts inside the tile`);
      assert.ok(w >= 0 && h >= 0, `#${id} ${kind} has a size`);
    }
  }
  // 20 · Photo strip is the one phone drawing that PEEKS past the edge — the swipe.
  assert.ok(SCENE_TEMPLATES[20].thumb.phone.some(([, x, , w]) => x + w > 100));
});

test('slot counts match what each drawing shows', () => {
  const photos = (id: 1) => SCENE_TEMPLATES[id].thumb.desk.filter(([k]) => k === 'photo').length;
  for (const id of [17, 18, 19, 20] as const) assert.equal(SCENE_TEMPLATES[id].media, photos(id as 1), `#${id}`);
  assert.equal(SCENE_TEMPLATES[21].media, 6, '"Collage of 5–6" takes six');
  assert.equal(SCENE_TEMPLATES[22].blocks, 2);
  assert.equal(SCENE_TEMPLATES[23].blocks, 3);
  for (const id of SCENE_TEMPLATE_IDS) assert.ok(sceneSlotCount(id) <= SCENE_MAX_SLOTS, `#${id}`);
});

test('⛔ a stored id is read, never repaired', () => {
  assert.equal(sceneTemplateId(18), 18);
  for (const bad of [0, 26, 18.5, '18', null, undefined, -1]) assert.equal(sceneTemplateId(bad), null, String(bad));
  assert.equal(sceneTemplateIdFromForm('18'), 18);
  for (const bad of ['26', '18a', '', ' 18', '0', 'x']) assert.equal(sceneTemplateIdFromForm(bad), null, bad);
});

test('⭐ a pick writes the template’s default effect — only what differs from an absence', () => {
  assert.deepEqual(sceneTemplateDefaults(1, true), { template: 1, preset: 'calm' });
  assert.deepEqual(sceneTemplateDefaults(4, true), { template: 4, preset: 'cinematic', transition: 'scrub' });
  // "Calm · staggered": Calm arrives together, so the stagger is written.
  assert.deepEqual(sceneTemplateDefaults(18, true), { template: 18, preset: 'calm', sequence: 'one_after_another' });
  // Editorial already arrives in turn — nothing extra.
  assert.deepEqual(sceneTemplateDefaults(23, true), { template: 23, preset: 'editorial' });
  // Without Pro, motion is not written at all (it is Pro, and would move no pixels).
  for (const id of SCENE_TEMPLATE_IDS) assert.deepEqual(sceneTemplateDefaults(id, false), { template: id });
});

test('the section class names the layout and the id — one rule per layout in the stylesheet', () => {
  assert.equal(sceneTemplateClass(2), 'hub-tpl hub-tpl-side hub-tpl-n2');
  assert.equal(sceneTemplateClass(14), 'hub-tpl hub-tpl-bleed hub-tpl-n14 hub-tpl-clip');
});
