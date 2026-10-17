/**
 * free-events-keep-what-they-published.test.ts — 🏛 THE GRANDFATHER (owner 2026-10-16, DECISION_LOG "ALL ANIMATE,
 * EFFECTS, STYLES AND ACCENTS ARE EVENT HUB PRO ◆", his answer the same night: *free events keep what they already
 * published — nothing changes for guests on live pages; new changes need Pro*).
 *
 * The fixture is a FREE event whose page went live before the ruling, wearing every kind of choice the ruling made
 * Pro: a scene's own colour · size · font · width and a letter's colour, a part's motion and Glow, a scene's style
 * card, the Dress code's palette look, a fixed part's card, the camera's look, a block's motion, a reply line's look
 * and Build in, and a Post Event scene's card. Held, through the ONE gate (`planHubDraftApply`) and the ONE list the
 * Apply sheet shows (`hubDraftProEffects`):
 *
 *   (1) OPENING THE MAKER CHANGES NOTHING — the live page as its own draft is no change and no Pro line.
 *   (2) A FREE EDIT BESIDE THEM IS WRITTEN WHOLE — words on the same scene go live, and every published choice is in
 *       the write exactly as it was (nothing is stripped on the way through).
 *   (3) TAKING A PUBLISHED CHOICE OFF IS FREE — back to the theme's own.
 *   (4) ONLY A NEW NON-DEFAULT VALUE IS PRO — changing the published colour is held and named at ✓ Apply, by the
 *       Maker's own word; the free edit beside it still goes live.
 *   (5) THE EVENT'S UNLOCK COVERS IT — with Pro nothing is held.
 *   (6) THE GUEST PAGE DRAWS THEM WITHOUT ASKING — the renderers the page uses for a part's look take the style only;
 *       there is no ownership input that could strip a published choice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { emptyHubDraft, mergeHubDraft, planHubDraftApply, summarizeHubDraft, type HubDraft, type HubDraftState, type HubLiveState } from './hub-draft';
import { hubDraftProEffects } from './hub-pro-effects';
import { hubProEffectLine } from './hub-pro-effect-view';
import { hubElementDeclarations, hubTextHash, type HubElementStyle } from './element-style';
import { sanitizeHubCanvas, type HubSectionCanvas } from './hub-canvas';
import type { InvitationWidgetRow } from './invitation-widgets';

const WEB = join(__dirname, '..');

const row = (type: string, config: unknown): InvitationWidgetRow =>
  ({ widget_id: `S89W-${type}`, event_id: 'e1', widget_type: type, is_visible: true, is_always_on: false, display_order: 1, mode: 'auto', config_json: config }) as unknown as InvitationWidgetRow;

const NAMES = 'Maria & Jose';
/* What went live before 2026-10-16, on a FREE event. */
const SCHEDULE: HubSectionCanvas = {
  style: 'clock-face',
  elements: {
    heading: { color: '#8a1c2b', size: 120, font: 'script', width: 'wide', motion: { during: 'glow' } } as HubElementStyle,
    body: { color: '#8a1c2b', size: 120 } as HubElementStyle,
  },
} as HubSectionCanvas;
const HERO: HubSectionCanvas = {
  elements: { names: { runs: [{ start: 0, end: 5, color: '#112233' }], of: hubTextHash(NAMES), was: NAMES } as HubElementStyle },
} as HubSectionCanvas;
const DRESS: HubSectionCanvas = { palette: 'ribbon' } as HubSectionCanvas;
const STYLE_PREFS = { camera_look: 'brand', block_looks: { entourage: { motion: { in: { fade: true } } } } };
const RSVP = { look: { lines: { 'rsvp.question': { c: '#8a1c2b', f: 'script', i: { fade: true } } } } };
const EDITORIAL = { sceneLooks: { couple: { style: 'words-only' } } };

const LIVE: HubLiveState = {
  events: { style_preferences: STYLE_PREFS, rsvp_ask_config: RSVP },
  widgets: [row('schedule', { canvas: SCHEDULE }), row('hero', { canvas: HERO }), row('dress_code', { canvas: DRESS })],
  editorial: EDITORIAL,
  fixedStyles: { hero_names: 'one-line' },
};
const asDraft = (s: HubDraftState): HubDraft => ({ v: 1, history: [], ...s });
const liveSchedule = sanitizeHubCanvas({ canvas: SCHEDULE });

test('anti-vacuity: every published choice in the fixture is one the ruling made Pro', () => {
  /* Drafted onto an EMPTY live page by a free couple, each is held — so the fixture really carries Pro choices. */
  const bare: HubLiveState = { events: {}, widgets: LIVE.widgets.map((r) => ({ ...r, config_json: {} })) };
  const all = asDraft({
    events: { style_preferences: STYLE_PREFS, rsvp_ask_config: RSVP },
    widgets: { schedule: { canvas: liveSchedule }, hero: { canvas: sanitizeHubCanvas({ canvas: HERO }) }, dress_code: { canvas: sanitizeHubCanvas({ canvas: DRESS }) } },
    editorial: EDITORIAL as HubDraftState['editorial'],
    fixedStyles: { hero_names: 'one-line' },
  });
  const held = planHubDraftApply(all, bare, false).refused;
  const kinds = held.map((i) => (i.kind === 'event' ? i.column : i.kind === 'widget' ? `${i.widgetType}.${i.field}` : i.kind)).sort();
  console.log(`[grandfather] held on a bare page: ${kinds.join(', ')}`);
  assert.deepEqual(kinds, ['dress_code.canvas', 'editorial', 'fixed-style', 'hero.canvas', 'rsvp_ask_config', 'schedule.canvas', 'style_preferences']);
  const lines = hubDraftProEffects(all, bare, false).map(hubProEffectLine);
  console.log(`[grandfather] named on a bare page: ${lines.join(' | ')}`);
  for (const want of ['Font · Colour · Size · Width · Schedule', 'Letters · Event title on the Hero', 'Clock face · Schedule', 'Glow · Heading on the Schedule', 'Ribbon · Dress code', 'One line', 'Words only', 'Camera look · Your brand and Animation', 'Style · Animation · RSVP']) {
    assert.ok(lines.some((l) => l.startsWith(want) || l.includes(want)), `"${want}" is not named at ✓ Apply — got ${JSON.stringify(lines)}`);
  }
});

test('(1) opening the Maker on the published page is no change and no Pro line', () => {
  const same = asDraft({
    events: { style_preferences: STYLE_PREFS, rsvp_ask_config: RSVP },
    widgets: { schedule: { canvas: liveSchedule }, dress_code: { canvas: sanitizeHubCanvas({ canvas: DRESS }) } },
    editorial: EDITORIAL as HubDraftState['editorial'],
    fixedStyles: { hero_names: 'one-line' },
  });
  const plan = planHubDraftApply(same, LIVE, false);
  assert.equal(plan.refused.length, 0, `a published choice was held: ${JSON.stringify(plan.refused.map((i) => i.kind))}`);
  assert.equal(hubDraftProEffects(same, LIVE, false).length, 0, 'the Apply sheet names a choice guests already see');
  assert.equal(summarizeHubDraft(same, LIVE, false).changeCount, 0, '✓ counts a change nobody made');
});

test('(2) a free edit beside the published choices is written, and every published choice rides through untouched', () => {
  /* Hide the scene's label — Show, free — on the canvas that holds the published look. */
  const d = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { canvas: { ...liveSchedule, elements: { ...liveSchedule.elements, label: { hidden: true } } } } } });
  const plan = planHubDraftApply(d, LIVE, false);
  assert.equal(plan.refused.length, 0, 'a free edit on a grandfathered scene was held');
  const written = plan.apply.find((i) => i.kind === 'widget' && i.field === 'canvas')?.value as HubSectionCanvas | undefined;
  assert.ok(written, 'the free edit was not written');
  assert.equal(written.elements?.label?.hidden, true);
  assert.deepEqual(written.elements?.heading, liveSchedule.elements?.heading, 'the published heading look was stripped on the way through');
  assert.equal(written.style, 'clock-face', 'the published style card was stripped on the way through');
});

test('(3) taking a published choice off is free', () => {
  const off = mergeHubDraft(emptyHubDraft(), {
    widgets: { schedule: { canvas: { ...liveSchedule, style: undefined, elements: { heading: { motion: { during: 'glow' } } as HubElementStyle } } } },
    events: { style_preferences: { camera_look: 'classic' }, rsvp_ask_config: { look: {} } },
    fixedStyles: { hero_names: null },
  });
  const plan = planHubDraftApply(off, LIVE, false);
  assert.equal(plan.refused.length, 0, `going back to the theme's own was held: ${JSON.stringify(plan.refused.map((i) => (i.kind === 'event' ? i.column : i.kind)))}`);
});

test('(4) only a NEW non-default value is Pro — held, named by the Maker’s word, and the free edit beside it still goes live', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    widgets: {
      schedule: {
        canvas: {
          ...liveSchedule,
          elements: { ...liveSchedule.elements, heading: { ...liveSchedule.elements!.heading, color: '#223344' }, label: { hidden: true } },
        },
      },
    },
  });
  const plan = planHubDraftApply(d, LIVE, false);
  assert.equal(plan.refused.length, 1, 'a new colour was not held');
  const lines = hubDraftProEffects(d, LIVE, false).map(hubProEffectLine);
  assert.deepEqual(lines, ['Colour · Schedule'], 'the sheet does not name the new colour, or names a published choice too');
  const free = plan.apply.find((i) => i.kind === 'widget' && i.field === 'canvas')?.value as HubSectionCanvas | undefined;
  assert.equal(free?.elements?.label?.hidden, true, 'the free edit beside it was held too');
  assert.equal(free?.elements?.heading?.color, '#8a1c2b', 'the published colour did not stay while the new one waits');
});

test('(5) the event’s unlock covers it — with Pro nothing is held and nothing is named', () => {
  const d = mergeHubDraft(emptyHubDraft(), { widgets: { schedule: { canvas: { ...liveSchedule, style: 'timeline' } } }, fixedStyles: { hero_names: 'staggered' } });
  assert.ok(planHubDraftApply(d, LIVE, false).refused.length > 0, 'anti-vacuity: the change is Pro for a free couple');
  assert.equal(planHubDraftApply(d, LIVE, true).refused.length, 0);
  assert.equal(hubDraftProEffects(d, LIVE, true).length, 0);
});

test('(6) the guest page draws a part’s look from the style alone — no ownership input can strip it', () => {
  const decl = Object.fromEntries(hubElementDeclarations(SCHEDULE.elements!.heading));
  assert.equal(decl.color, '#8a1c2b');
  assert.equal(decl.zoom, '1.2');
  assert.match(decl['font-family'] ?? '', /var\(/);
  const src = stripComments(readFileSync(join(WEB, 'lib/element-style.ts'), 'utf8'));
  for (const fn of ['hubElementDeclarations', 'hubElementInlineStyle', 'hubElementMotionDeclarations']) {
    const sig = new RegExp(`export function ${fn}\\(([\\s\\S]*?)\\)\\s*:`).exec(src)?.[1];
    assert.ok(sig !== undefined, `anti-vacuity: ${fn} was not found`);
    assert.doesNotMatch(sig!, /ownsPro|pro\b|entitle|owns/i, `${fn} takes an ownership input — a published choice could vanish for guests`);
  }
});
