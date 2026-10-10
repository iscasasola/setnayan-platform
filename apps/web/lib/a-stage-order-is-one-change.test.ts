import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyHubDraft,
  hubDraftCountedChanges,
  hubDraftMovedStages,
  mergeHubDraft,
  planHubDraftApply,
  summarizeHubDraft,
  undoHubDraft,
  type HubDraft,
  type HubLiveState,
} from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import { movedOrder, stageOrderPatch } from './maker-reorder';
import { stageRowOrder } from './stage-scenes';
import { widgetInPhase, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';

/**
 * ↕ THE ✓ NUMBER IS WHAT THE COUPLE CHANGED: A STAGE'S ORDER IS ONE CHANGE, AND NONE ONCE IT IS BACK.
 *
 * Measured 2026-10-11 at 375 px on the Maker's own toolbar (the lab, running the real draft): one tap on Earlier →
 * ✓ 8; one tap on Later, back to the order guests have → still ✓ 8; the Apply sheet's list is the same walk, so it
 * would have named eight "Order" lines. A move saves every scene's place on the stage, and each place was a change of
 * its own against a live page that stored none.
 *
 * THE PROPERTY (controller, 2026-10-11): for ANY sequence of moves that ends at the live order, the order contributes
 * 0; for any that ends elsewhere, exactly 1 per stage. The moves here are the Maker's own (`movedOrder` +
 * `stageOrderPatch`, what Earlier · Later and a drag save), walked at random from a seed.
 */

const TYPES: Array<[WidgetType, boolean]> = [
  ['hero', true], ['greeting', true], ['qr_card', true], ['event_details', false], ['countdown', false], ['schedule', false], ['rsvp', true],
  ['venue_map', false], ['dress_code', false], ['photo_moments', false], ['your_photos', false], ['tier_comparison', false],
  ['special_message', false], ['what_to_bring', false], ['our_photos', false], ['our_love_story', false],
];
const rows = (places: Partial<Record<WidgetType, Partial<Record<LifecyclePhase, number>>>> = {}): InvitationWidgetRow[] =>
  TYPES.map(([type, alwaysOn], i) => ({
    widget_id: `w-${type}`, event_id: 'e', widget_type: type, display_order: i + 1, is_visible: true, is_always_on: alwaysOn, tier: 'basic',
    config_json: places[type] ? { stage_order: places[type] } : {}, created_at: '', updated_at: '', mode: 'auto',
  })) as InvitationWidgetRow[];
const liveOf = (widgets: InvitationWidgetRow[]): HubLiveState => ({ events: {}, widgets });
const orderOn = (widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase) => stageRowOrder(widgets, stage, (t, s) => widgetInPhase(t as WidgetType, s)).map((r) => r.widget_id);
const typeOf = (id: string) => id.slice(2);
const move = (d: HubDraft, order: string[], stage: LifecyclePhase) => mergeHubDraft(d, stageOrderPatch(order, typeOf, stage)!);
const orderChanges = (d: HubDraft, live: HubLiveState) => hubDraftCountedChanges(planHubDraftApply(d, live, false)).filter((c) => c.item.kind === 'widget' && c.item.field === 'stage_order');
const count = (d: HubDraft, live: HubLiveState) => summarizeHubDraft(d, live, false).changeCount;

/** A small seeded generator — the walks are the same on every run. */
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

test('the tester’s walk: Later → ✓ +1; Earlier, back → ✓ back to what it was; the sheet names ONE line for the stage', () => {
  const live = liveOf(rows());
  const start = orderOn(live.widgets, 'rsvp');
  const later = move(emptyHubDraft(), movedOrder(start, 'w-special_message', 1)!, 'rsvp');
  assert.equal(count(later, live), 1, 'one move is not one change');
  assert.deepEqual(hubDraftChangeLines(later, live, false), [{ place: 'Invitation', what: 'Order', pro: false, held: false }]);
  /* Apply still writes EVERY scene's place — the count is what changed, the plan is what is written. */
  assert.equal(planHubDraftApply(later, live, false).apply.filter((i) => i.kind === 'widget' && i.field === 'stage_order').length, start.length);
  const back = move(later, start, 'rsvp');
  assert.equal(count(back, live), 0, 'the order is back to what guests have and still counts');
  assert.deepEqual(hubDraftChangeLines(back, live, false), []);
  assert.equal(planHubDraftApply(back, live, false).apply.length, 0, 'places that restate the live order would be written');
  /* ↺ agrees: one step back is the moved order again (1), two is nothing. */
  assert.equal(count(undoHubDraft(back), live), 1);
  assert.equal(count(undoHubDraft(undoHubDraft(back)), live), 0);
  assert.equal(summarizeHubDraft(back, live, false).canUndo, true);
});

test('THE PROPERTY — any walk of moves: 0 when it ends at the live order, exactly 1 per stage when it ends elsewhere', () => {
  const stages: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
  let ended = 0;
  let elsewhere = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const next = rng(seed);
    /* Half the walks start from a live page that already stores an order of its own (an earlier Apply). */
    const stored: Partial<Record<WidgetType, Partial<Record<LifecyclePhase, number>>>> = {};
    if (seed % 2 === 0) {
      const o = orderOn(rows(), 'rsvp');
      const shuffled = movedOrder(o, o[Math.floor(next() * o.length)]!, 2) ?? o;
      shuffled.forEach((id, place) => (stored[typeOf(id) as WidgetType] = { rsvp: place }));
    }
    const live = liveOf(rows(stored));
    const now = Object.fromEntries(stages.map((s) => [s, orderOn(live.widgets, s)])) as Record<LifecyclePhase, string[]>;
    let d = emptyHubDraft();
    const steps = 1 + Math.floor(next() * 7);
    for (let k = 0; k < steps; k++) {
      const stage = stages[Math.floor(next() * stages.length)]!;
      const o = now[stage];
      if (o.length < 2) continue;
      const moved = movedOrder(o, o[Math.floor(next() * o.length)]!, next() < 0.5 ? -1 : 1 + Math.floor(next() * 2));
      if (!moved) continue;
      now[stage] = moved;
      d = move(d, moved, stage);
    }
    /* Half of them are then walked home, stage by stage. */
    if (seed % 3 === 0) for (const stage of stages) { now[stage] = orderOn(live.widgets, stage); d = move(d, now[stage], stage); }
    const differs = stages.filter((s) => now[s].join(' ') !== orderOn(live.widgets, s).join(' '));
    assert.deepEqual(hubDraftMovedStages(d, live), differs, `seed ${seed}`);
    const counted = orderChanges(d, live);
    /* Each moved stage once (in the order Apply meets them — which stage comes first is not the property). */
    assert.deepEqual(counted.map((c) => c.stage).sort(), [...differs].sort(), `seed ${seed}: the order counts ${counted.length} for ${differs.length} moved stage(s)`);
    assert.equal(count(d, live), differs.length, `seed ${seed}`);
    /* The Apply sheet's lines are the badge's count, one "Order" line per stage that moved. */
    assert.equal(hubDraftChangeLines(d, live, false).filter((l) => l.what === 'Order').length, differs.length, `seed ${seed}`);
    if (differs.length === 0) ended++;
    else elsewhere++;
  }
  assert.ok(ended >= 20 && elsewhere >= 20, `the walks did not cover both ends (${ended} home, ${elsewhere} elsewhere)`);
});

test('the order shares the count with everything else — one move plus one look is two', () => {
  const live = liveOf(rows());
  const start = orderOn(live.widgets, 'rsvp');
  let d = move(emptyHubDraft(), movedOrder(start, 'w-countdown', 1)!, 'rsvp');
  d = mergeHubDraft(d, { widgets: { countdown: { canvas: { in: 'fade' } } } });
  assert.equal(count(d, live), 2);
  assert.deepEqual(hubDraftChangeLines(d, live, false).map((l) => l.what).sort(), ['Animation', 'Order'].sort());
});

test('three edits to one Title are TWO things changed — the count is things that differ, and the sheet’s lines add up to it', () => {
  const live = liveOf(rows());
  let d = mergeHubDraft(emptyHubDraft(), { fixedStyles: { hero_eyebrow: 'serif' } });
  d = mergeHubDraft(d, { widgets: { hero: { canvas: { elements: { eyebrow: { motion: { in: { fade: true } } } } } } } });
  d = mergeHubDraft(d, { widgets: { hero: { canvas: { elements: { eyebrow: { motion: { in: { fade: true } }, word: 'With joy, we invite you' } } } } } });
  /* The Title's style is one thing; its words and its motion are both on the cover's own look — one thing. */
  assert.equal(count(d, live), 2);
  assert.equal(hubDraftChangeLines(d, live, false).length, 2, 'the sheet names more, or fewer, than the badge counts');
  assert.equal(d.history.length, 3, '↺ still steps back one EDIT at a time');
});
