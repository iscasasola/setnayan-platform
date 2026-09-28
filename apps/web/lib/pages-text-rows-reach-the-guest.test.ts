/**
 * pages-text-rows-reach-the-guest.test.ts — EVERY NEW TEXT-TAB ROW MOVES A
 * GUEST'S PIXELS, AND IS GATED LIKE THE REST OF THE LOOK.
 *
 * The Maker's Text tab (approved prototype frame B, 2026-09-27) added Pages'
 * rows: Weight · B · I · U · Alignment · Line · Letter, and Arrange → Show.
 * A row that stores a choice no guest ever sees is the defect this repo keeps
 * finding (`a-flag-in-an-object-is-not-ink-in-the-pixels`). What this proves:
 *
 *   1. each row, stored, reaches the guest's CSS — inline on a hero part, and in
 *      the scene's scoped style — as closed-set values only;
 *   2. "Hidden" is gone for a guest and ghosted (never gone) in the Maker canvas;
 *   3. the hero's alignment is ONE choice for the whole hero;
 *   4. at Apply a free couple's new look rows are HELD (Pro), while hiding a
 *      part and the joiner's word — words and show/hide, not look — are free.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HUB_HERO_ELEMENT_KEYS,
  HUB_ELEMENT_FIELDS,
  hubElementDeclarations,
  hubElementSceneCss,
  sanitizeHubElements,
  withElementAlign,
  withoutTextStyle,
  type HubElementStyle,
} from './element-style';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, type HubLiveState } from './hub-draft';
import type { InvitationWidgetRow } from './invitation-widgets';

test('each Text-tab row reaches the guest as CSS from a closed set', () => {
  const style = sanitizeHubElements({
    heading: { weight: 600, italic: true, underline: true, align: 'left', leading: 1.35, tracking: 8 },
  })!.heading!;
  assert.deepEqual(hubElementDeclarations(style), [
    ['font-weight', '600'],
    ['font-style', 'italic'],
    ['text-decoration-line', 'underline'],
    ['text-align', 'left'],
    ['justify-content', 'flex-start'],
    ['line-height', '1.35'],
    ['letter-spacing', '0.08em'],
  ]);
  const css = hubElementSceneCss('schedule', { heading: style })!;
  for (const decl of ['font-weight:600 !important', 'font-style:italic !important', 'text-align:left !important', 'line-height:1.35 !important', 'letter-spacing:0.08em !important']) {
    assert.ok(css.includes(decl), `the scene style carries ${decl}: ${css}`);
  }
  // Nothing typed survives: every value outside its set is dropped.
  assert.equal(
    sanitizeHubElements({ heading: { weight: 450, italic: 'yes', align: 'justify', leading: 3, tracking: '1em;color:red' } }),
    null,
  );
});

test('Hidden: gone for a guest, ghosted in the Maker canvas — for a scene part and a hero part', () => {
  const css = hubElementSceneCss('schedule', { body: { hidden: true } })!;
  assert.match(css, /:root:not\(:has\(\[data-maker-section\]\)\) :has\(\+ style\[data-hub-els="schedule"\]\) :is\(p:not/);
  assert.match(css, /display:none !important/);
  assert.match(css, /:root:has\(\[data-maker-section\]\)[^{]*\{opacity:0\.3 !important\}/);
  assert.deepEqual(hubElementDeclarations({ hidden: true }), [['display', 'none']]);
  assert.deepEqual(hubElementDeclarations({ hidden: true }, { editor: true }), [['opacity', '0.3']]);
});

test("the hero's alignment is one choice for the whole hero; a scene's parts align one by one", () => {
  const hero = withElementAlign(null, 'date', 'left')!;
  const aligned = HUB_HERO_ELEMENT_KEYS.filter((k) => HUB_ELEMENT_FIELDS[k].includes('align'));
  assert.deepEqual(Object.keys(hero).sort(), [...aligned].sort());
  for (const k of aligned) assert.equal(hero[k]?.align, 'left');
  // ↺ Use the Event Hub style on one hero part takes the hero's alignment off everywhere.
  assert.equal(withoutTextStyle(hero, 'names'), null);
  const scene = withElementAlign(null, 'heading', 'right')!;
  assert.deepEqual(scene, { heading: { align: 'right' } });
});

const widget = (type: string, config: unknown): InvitationWidgetRow =>
  ({ widget_id: `S89W-${type}`, widget_type: type, is_visible: true, display_order: 1, mode: 'auto', config_json: config }) as unknown as InvitationWidgetRow;

test('at Apply the Text rows are FREE (2026-09-28 redraw); hiding a part and the joiner’s word too', () => {
  // Owner 2026-09-28: "free to change design, change text, size, color …, only
  // when you start adding themes will it be pro." Only Font ▾ and Animate stay
  // Pro (`HUB_ELEMENT_PRO_FIELDS`).
  const live: HubLiveState = { events: {}, widgets: [widget('schedule', {}), widget('hero', {})] };
  const look = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { canvas: { elements: { heading: { weight: 600 } } } } } });
  assert.equal(planHubDraftApply(look, live, false).refused.length, 0, 'a weight is free — written for a free couple');
  assert.equal(planHubDraftApply(look, live, true).refused.length, 0, 'and for a Pro couple');
  for (const field of [{ italic: true }, { underline: true }, { align: 'left' }, { leading: 1.2 }, { tracking: -2 }]) {
    const d = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { canvas: { elements: { heading: field as HubElementStyle } } } } });
    assert.equal(planHubDraftApply(d, live, false).refused.length, 0, `${JSON.stringify(field)} was held for a free couple`);
  }
  const free = mergeHubDraft(emptyHubDraft(), {
    widgets: {
      schedule: { canvas: { elements: { body: { hidden: true } } } },
      hero: { canvas: { elements: { joiner: { word: '+' } } } },
    },
  });
  const plan = planHubDraftApply(free, live, false);
  assert.equal(plan.refused.length, 0, 'show/hide and words are the page we write — free');
  assert.equal(plan.apply.length, 2);
});
