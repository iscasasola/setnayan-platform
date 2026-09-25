/**
 * the-main-background-drafts.test.ts — THE COUPLE'S OWN MAIN BACKGROUND, AND
 * THE ADAPTIVE THEME ON IT, RIDE THE DRAFT AND PAY AT APPLY (Maker Phase 10).
 *
 * Proven on the PLAN, both answers of the gate constructed: a free couple's
 * drafted own clip is REFUSED at Apply and stays in the draft; an owning
 * couple's is applied. Going back to the theme's own background is free. The
 * "Keep the theme's colours" toggle is a look change like any other.
 *
 * Also: it lives on the HERO row only — a `main` drafted on any other section is
 * dropped, because the page has one Main background and a second home for it
 * would be a second source of truth.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyHubDraft,
  configWithMainGround,
  emptyHubDraft,
  hubDraftItemLabel,
  mainGroundChange,
  mergeHubDraft,
  overlayHubDraftWidgets,
  planHubDraftApply,
  sanitizeHubDraft,
  type HubLiveState,
} from './hub-draft';
import { hubCanvasMediaRefs, hubMainGround, sanitizeHubCanvas, sanitizeHubMainGround, type HubMainGround } from './hub-canvas';
import type { InvitationWidgetRow } from './invitation-widgets';

const CLIP = 'r2://setnayan-media/events/e1/main-background/clip.mp4';
const STILL = 'r2://setnayan-media/events/e1/main-background/still.jpg';
const OWN: HubMainGround = { kind: 'snippet', media: CLIP, poster: STILL, tint: { match: true, frame: ['#e69853', '#fee5b4', '#ab4c2e'] } };

function row(p: Partial<InvitationWidgetRow> & Pick<InvitationWidgetRow, 'widget_type'>): InvitationWidgetRow {
  return {
    widget_id: `w-${p.widget_type}`,
    event_id: 'e1',
    display_order: 5,
    is_visible: true,
    is_always_on: false,
    tier: 'basic',
    config_json: {},
    created_at: '',
    updated_at: '',
    mode: 'auto',
    ...p,
  };
}

const heroCanvas = { canvas: { preset: 'calm' }, keep: 'me' };
const LIVE: HubLiveState = {
  events: {},
  widgets: [row({ widget_type: 'hero', is_always_on: true, display_order: 1, config_json: heroCanvas })],
};
const LIVE_WITH_OWN: HubLiveState = {
  events: {},
  widgets: [row({ widget_type: 'hero', is_always_on: true, display_order: 1, config_json: { ...heroCanvas, main: OWN } })],
};

const draftOf = (main: HubMainGround | null) => mergeHubDraft(emptyHubDraft(), { widgets: { hero: { main } } });

test('the Main background is read from the hero row, beside the canvas — never inside it', () => {
  assert.deepEqual(hubMainGround({ canvas: {}, main: OWN }), OWN);
  assert.equal(hubMainGround({ canvas: { main: OWN } }), null, 'a main inside the canvas is not the Main background');
  // …and the hero SCENE's canvas does not mistake the sibling key for its own.
  assert.deepEqual(sanitizeHubCanvas({ canvas: { preset: 'calm' }, main: OWN }), { preset: 'calm' });
  // Signed in the page's one pass: the still, never the clip (whether it may play is the render's call).
  assert.deepEqual(hubCanvasMediaRefs([{ config_json: { main: OWN } }]), [STILL]);
});

test('sanitizing holds the fence: public bucket only, a real kind, a real tint', () => {
  assert.equal(sanitizeHubMainGround({ kind: 'snippet', media: 'r2://setnayan-thread-files/x.mp4' }), null);
  assert.equal(sanitizeHubMainGround({ kind: 'color', media: CLIP }), null, 'a colour is site_bg_color, not a Main ground');
  assert.deepEqual(sanitizeHubMainGround({ kind: 'photo', media: STILL, tint: { frame: ['nope'] } }), { kind: 'photo', media: STILL });
  const d = sanitizeHubDraft({ widgets: { hero: { main: OWN }, countdown: { main: OWN, mode: 'hidden' } } });
  assert.deepEqual(d.widgets.hero, { main: OWN });
  assert.deepEqual(d.widgets.countdown, { mode: 'hidden' }, 'a main on any other section is dropped');
});

test('the preview shows the drafted Main background; every sibling key survives', () => {
  const [hero] = overlayHubDraftWidgets(LIVE.widgets as InvitationWidgetRow[], draftOf(OWN));
  assert.deepEqual(hero!.config_json, { ...heroCanvas, main: OWN });
  const [back] = overlayHubDraftWidgets(LIVE_WITH_OWN.widgets as InvitationWidgetRow[], draftOf(null));
  assert.deepEqual(back!.config_json, heroCanvas);
  assert.deepEqual(configWithMainGround({ keep: 1 }, null), { keep: 1 });
});

test('a free couple TRIES their own clip: refused at Apply, kept in the draft — an owning couple has it applied', () => {
  const free = planHubDraftApply(draftOf(OWN), LIVE, false);
  assert.equal(free.apply.length, 0);
  assert.equal(free.refused.length, 1);
  assert.equal(free.refused[0]!.kind === 'widget' && free.refused[0]!.field, 'main');
  assert.deepEqual(free.remaining.widgets.hero?.main, OWN, 'the refused key stays so they can pay and Apply again');

  const owning = planHubDraftApply(draftOf(OWN), LIVE, true);
  assert.equal(owning.apply.length, 1);
  assert.equal(owning.refused.length, 0);
  assert.equal(hubDraftItemLabel(owning.apply[0]!, () => 'Hero'), 'Your own background');
});

test('going back to the theme\'s own background is free', () => {
  const plan = planHubDraftApply(draftOf(null), LIVE_WITH_OWN, false);
  assert.equal(plan.refused.length, 0);
  assert.equal(plan.apply.length, 1);
  assert.equal(plan.apply[0]!.change, 'remove');
});

test('the colour toggle is a look change — "Keep the theme\'s colours" and back are Pro to change', () => {
  const off: HubMainGround = { ...OWN, tint: { ...OWN.tint!, match: false } };
  assert.equal(mainGroundChange(OWN, off), 'change');
  assert.equal(mainGroundChange(OWN, OWN), 'none');
  assert.equal(mainGroundChange(null, OWN), 'add');
  const plan = planHubDraftApply(draftOf(off), LIVE_WITH_OWN, false);
  assert.equal(plan.refused.length, 1);
  assert.equal(planHubDraftApply(draftOf(off), LIVE_WITH_OWN, true).apply.length, 1);
});

test('re-saving what is live writes nothing', () => {
  assert.deepEqual(classifyHubDraft(draftOf(OWN), LIVE_WITH_OWN).items, []);
});
