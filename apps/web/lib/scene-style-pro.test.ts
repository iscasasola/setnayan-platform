/**
 * 💎 2026-10-16 (DECISION_LOG "ALL ANIMATE, EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆"): every style card but
 * the theme's own default is Pro — the table is recomputed from the registry below.
 *
 * 💎 THE PRO LOOKS IN STYLE — owner 2026-10-17 (DECISION_LOG "APPROVED — LOVE STORY, TWO VOICES"), verbatim:
 * *"Conversation as the default look, Timeline and Swipe cards as Pro looks in Style."*
 *
 * Held here:
 *   · every Pro id is a style the registry DRAWS for that scene type (a Pro mark on nothing is a lie);
 *   · the Style row's options carry `pro` for exactly those (◆ in the dropdown and on the cards);
 *   · the Apply gate asks by scene TYPE: a Pro look added or swapped grows (Pro), going back to a free look is a
 *     removal (free), and the same id on another type (`cards` on the Camera cues) is free;
 *   · `canvasFreePart` keeps a couple's free edits beside a held Pro look and drops only the look.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PRO_SCENE_STYLES, sceneStyleIsPro } from './scene-style-pro';
import { SCENE_STYLE_SETS, sceneStyleOptions, sceneStylesOn, defaultSceneStyle } from './scene-styles';
import { HUB_STAGES } from './hub-canvas';
import { canvasFreePart, canvasLookChange, canvasLookFacets } from './hub-draft';

/** The table recomputed from the registry: a style is Pro unless it is the default on EVERY stage that draws it. */
function expectedProStyles(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const type of Object.keys(SCENE_STYLE_SETS)) {
    const ids = new Set<string>();
    const pro = new Set<string>();
    for (const stage of HUB_STAGES) {
      const def = defaultSceneStyle(type, stage);
      for (const st of sceneStylesOn(type, stage)) {
        ids.add(st.id);
        if (st.id !== def) pro.add(st.id);
      }
    }
    if (ids.size > 1 && pro.size > 0) out[type] = [...pro].sort();
  }
  return out;
}

test('💎 the Pro table IS the registry: every style but the theme’s own default is Pro (2026-10-16)', () => {
  const want = expectedProStyles();
  const have = Object.fromEntries(Object.entries(PRO_SCENE_STYLES).map(([t, ids]) => [t, [...ids].sort()]));
  assert.ok(Object.keys(want).length >= 30, `anti-vacuity: only ${Object.keys(want).length} types recomputed`);
  assert.deepEqual(have, want, `PRO_SCENE_STYLES drifted from the registry — paste:\n${JSON.stringify(want, null, 1)}`);
  /* A free default stays free wherever it is every stage's own. */
  for (const [type, stage] of [['our_love_story', 'rsvp'], ['countdown', 'rsvp'], ['hero_names', 'event'], ['schedule', 'rsvp']] as const) {
    assert.ok(!sceneStyleIsPro(type, defaultSceneStyle(type, stage)), `${type}'s default on ${stage} must be free`);
  }
  assert.equal(defaultSceneStyle('our_love_story', 'rsvp'), 'conversation', 'Conversation is the Love Story default');
  assert.equal(defaultSceneStyle('our_love_story', 'save_the_date'), 'conversation');
});

test('the Style options mark exactly the Pro looks', () => {
  const opts = sceneStyleOptions('our_love_story', 'rsvp');
  const pro = opts.filter((o) => o.pro).map((o) => o.id).sort();
  assert.deepEqual(pro, ['cards', 'chapters', 'essay', 'timeline', 'years']);
  assert.ok(opts.some((o) => o.id === 'conversation' && !o.pro), 'the default is offered and free');
  /* Every stage's cards: ◆ on exactly the non-default ones the gate holds. */
  for (const o of sceneStyleOptions('countdown', 'rsvp')) assert.equal(Boolean(o.pro), !o.isDefault, `countdown.${o.id}`);
});

test('the Apply gate: a Pro look grows, going back is free, and the type decides', () => {
  assert.equal(canvasLookChange({}, { style: 'timeline' }, 'our_love_story'), 'add');
  assert.equal(canvasLookChange({ style: 'conversation' }, { style: 'cards' }, 'our_love_story'), 'add');
  assert.equal(canvasLookChange({ style: 'timeline' }, { style: 'cards' }, 'our_love_story'), 'change');
  assert.equal(canvasLookChange({ style: 'timeline' }, { style: 'conversation' }, 'our_love_story'), 'remove');
  assert.equal(canvasLookChange({}, { style: 'conversation' }, 'our_love_story'), 'none', 'the free default is free');
  assert.equal(canvasLookChange({}, { style: 'years' }, 'our_love_story'), 'add', 'every non-default look is Pro since 2026-10-16');
  assert.equal(canvasLookChange({}, { style: 'cards' }, 'photo_moments'), 'none', '`cards` is the Camera cues’ own default — free');
  assert.equal(canvasLookChange({}, { style: 'programme-rail' }, 'schedule'), 'none', 'the Schedule’s own default is free');
  assert.equal(canvasLookChange({}, { style: 'timeline' }, 'schedule'), 'add', '`timeline` on the Schedule is a Pro look');
  /* 🏛 Grandfathered: a look already live stays 'none' — nothing to pay for what guests already see. */
  assert.equal(canvasLookChange({ style: 'years' }, { style: 'years' }, 'our_love_story'), 'none');
  const facet = canvasLookFacets({}, { style: 'cards' }, 'our_love_story').find((f) => f.key === 'style');
  assert.equal(facet?.group, 'look');
});

test('a held Pro look keeps the free edits beside it', () => {
  const free = canvasFreePart({ style: 'conversation' }, { style: 'timeline', spacing: 'roomy' }, 'our_love_story');
  assert.equal(free.style, 'conversation', 'the Pro look waits for Pro');
  assert.equal(free.spacing, 'roomy', 'the free change beside it goes live');
});
