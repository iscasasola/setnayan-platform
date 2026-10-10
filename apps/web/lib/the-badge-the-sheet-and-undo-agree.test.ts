/**
 * the-badge-the-sheet-and-undo-agree.test.ts — ✓, the Apply sheet's lines and ↺ are ONE reading of the draft.
 *
 * The merged copy's walk, 2026-10-11, M19: *"4 changes show as ✓ 3, and the first ↺ leaves the badge unchanged."*
 * Four edits were made — the Title's words, the Title's style, the Message's background, the Title's motion — and
 * the badge read 3; the first ↺ (the motion) left it at 3.
 *
 * WHAT ✓ COUNTS, AS SHIPPED: the THINGS that differ from what guests have — one per line of the Apply sheet
 * (`hubDraftCountedChanges`, the one reader both walk) — never the number of saves, and never the number of ↺ steps
 * left (`history`). The Title's words and the Title's motion are both the cover's look: one thing, one line
 * ("Names & date · …"). So the first ↺ took back the motion, the cover's look still differed (the words), and the
 * line — and the badge — stayed. That is the count working as written; whether the owner wants a count of EDITS
 * instead is his call (listed in the builder's report), not a thing to change under a fix.
 *
 * What CAN be held, and is, for a mix of edits, moves and per-stage hides (the junction's own writes):
 *
 *   1. PROPERTY (200 seeded sessions: 100 of 9 steps — within ↺'s reach of ten saves — and 100 of 30) —
 *        · the badge IS the number of lines the Apply sheet lists, after every step (and "has changes" is "> 0");
 *        · ↺ gives back EXACTLY the badge and the lines of the step before — it never invents a line, never keeps one
 *          the undone step added. So a ↺ lowers the count or keeps it, EXCEPT when the step it takes back was itself
 *          a return to what guests have (Fade on, then off: ↺ of the "off" brings the Fade — and its line — back);
 *          every raise is checked to be exactly that case;
 *        · with every step taken back the badge is empty, the sheet lists nothing and ↺ is not offered;
 *        · a draft equal to what guests have, reached by ANY road (a hide and its ＋, a move and its way back, a tick
 *          and "Back to our picks"), reads zero.
 *   2. the tester's four edits, pinned: 3 lines, named — and each ↺ in his order.
 *
 * Pure: the real reducers (`mergeHubDraft` · `undoHubDraft`), the real summary, the real line namer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { HUB_DRAFT_HISTORY_LIMIT, emptyHubDraft, mergeHubDraft, sanitizeHubDraft, hubDraftForWrite, summarizeHubDraft, undoHubDraft, type HubDraft, type HubDraftPatch } from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import { WIDGET_CATALOG_BY_TYPE, isWidgetType, widgetInPhase, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { movedOrder, stageOrderPatch } from './maker-reorder';
import { configWithDraftedStage } from './hub-draft';
import { stageRowOrder } from './stage-scenes';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const ORDER: readonly WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map', 'dress_code',
  'photo_moments', 'your_photos', 'tier_comparison', 'special_message', 'what_to_bring', 'our_photos', 'our_love_story',
];
const LIVE: InvitationWidgetRow[] = ORDER.map((t, i) => ({
  widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
  is_always_on: WIDGET_CATALOG_BY_TYPE[t].is_always_on, tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
}));
const STATE = { events: {}, widgets: LIVE };
const HIDEABLE = ORDER.filter((t) => !WIDGET_CATALOG_BY_TYPE[t].is_always_on);

const stored = (d: HubDraft): HubDraft => sanitizeHubDraft(JSON.parse(JSON.stringify(hubDraftForWrite(d))));
const save = (d: HubDraft, patch: unknown): HubDraft => stored(mergeHubDraft(d, JSON.parse(JSON.stringify(patch)) as HubDraftPatch));
const read = (d: HubDraft) => {
  const s = summarizeHubDraft(d, STATE, true);
  const lines = hubDraftChangeLines(d, STATE, true).map((l) => `${l.place} · ${l.what}`);
  return { count: s.changeCount, has: s.hasChanges, canUndo: s.canUndo, lines };
};
/** The stage's whole order as the Maker holds it — the draft's places and added scenes laid on (`fullOrders`). */
const fullOrder = (d: HubDraft, stage: LifecyclePhase) =>
  stageRowOrder(
    LIVE.map((r) => ({ ...r, config_json: configWithDraftedStage(r.config_json, d.widgets[r.widget_type]) as InvitationWidgetRow['config_json'] })),
    stage,
    (t, s) => isWidgetType(t) && widgetInPhase(t, s),
  ).map((r) => r.widget_id);

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { int: (n: number) => Math.floor(next() * n), pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]! };
}

test('1 · PROPERTY: the ✓ badge is the sheet’s lines; ↺ gives back exactly the step before; nothing left is nothing shown', () => {
  const tally = { steps: 0, undos: 0, lowered: 0, kept: 0, raised: 0, zeroByRoad: 0, toZero: 0, moves: 0, hides: 0, edits: 0 };
  for (let seed = 1; seed <= 200; seed += 1) {
    const r = rng(seed);
    let d = emptyHubDraft();
    /** What the bar read BEFORE each save still on the Undo stack — what ↺ must give back. */
    const before: Array<ReturnType<typeof read>> = [];
    let trimmed = false;
    /* Odd seeds stay within ↺'s reach (ten saves), so "every step taken back" is really every step. */
    const steps = seed % 2 === 1 ? 9 : 30;
    for (let step = 0; step < steps; step += 1) {
      const where = `seed ${seed} · step ${step}`;
      const was = read(d);
      const op = r.int(9);
      if (op === 0 && before.length > 0) {
        d = stored(undoHubDraft(d));
        const want = before.pop()!;
        const now = read(d);
        assert.deepEqual(now.lines, want.lines, `↺ did not give back the lines of the step before — ${where}`);
        assert.equal(now.count, want.count, `↺ did not give back the badge of the step before — ${where}`);
        if (now.count < was.count) tally.lowered += 1;
        else if (now.count === was.count) tally.kept += 1;
        else {
          /* A raise is ONLY the undo of a step that had itself lowered the count (a return to what guests have). */
          assert.ok(want.count > was.count, `↺ raised the badge without undoing a step that lowered it — ${where}`);
          tally.raised += 1;
        }
        tally.undos += 1;
      } else {
        let patch: unknown;
        if (op <= 2) {
          // an edit: a scene's motion on or off, the Title's words, the Title's style, a scene's background
          patch = r.pick([
            { widgets: { countdown: { canvas: r.int(2) ? { inFx: { fade: true } } : {} } } },
            { widgets: { hero: { canvas: r.int(2) ? { elements: { eyebrow: { word: 'With joy in our hearts' } } } : {} } } },
            { fixedStyles: { hero_eyebrow: r.int(2) ? 'serif' : null } },
            { widgets: { special_message: { canvas: r.int(2) ? { kind: 'color', color: '#A9834B' } : {} } } },
          ]);
          tally.edits += 1;
        } else if (op <= 4) {
          // a move: Earlier or Later, the stage's whole order
          const stage = r.pick(STAGES);
          const full = fullOrder(d, stage);
          const order = full.length > 1 ? movedOrder(full, r.pick(full), r.pick([-1, 1])) : null;
          patch = order ? stageOrderPatch(order, (id) => id.slice(3), stage) : null;
          tally.moves += 1;
        } else {
          // a per-stage hide, a show, or the choice taken back (the canvas's Remove · ＋, the table's ticks)
          patch = { widgets: { [r.pick(HIDEABLE)]: { stage_show: { [r.pick(STAGES)]: r.pick([false, false, true, null]) } } } };
          tally.hides += 1;
        }
        if (!patch) continue;
        before.push(was);
        /* ↺ goes back ten saves and no further (`HUB_DRAFT_HISTORY_LIMIT`): the oldest step falls off the stack. */
        if (before.length > HUB_DRAFT_HISTORY_LIMIT) {
          before.shift();
          trimmed = true;
        }
        d = save(d, patch);
        assert.equal(d.history.length, before.length, `the Undo stack is not the saves made — ${where}`);
      }
      const now = read(d);
      assert.equal(now.count, now.lines.length, `the badge reads ${now.count} and the sheet lists ${now.lines.length} — ${where}`);
      assert.equal(now.has, now.count > 0, `"has changes" and the count disagree — ${where}`);
      assert.equal(now.canUndo, d.history.length > 0);
      tally.steps += 1;
    }
    // every step ↺ can take back, taken back: each gives the step before, and the last one ends ↺
    while (d.history.length > 0) {
      d = stored(undoHubDraft(d));
      const want = before.pop()!;
      assert.deepEqual([read(d).count, read(d).lines], [want.count, want.lines], `seed ${seed}: ↺ to the end did not walk the steps back`);
    }
    assert.equal(read(d).canUndo, false);
    if (!trimmed) {
      assert.deepEqual(read(d), { count: 0, has: false, canUndo: false, lines: [] }, `seed ${seed}: with every step taken back something is still listed`);
      tally.toZero += 1;
    }
    // a road back to what guests have that is NOT ↺: each ends at zero
    let road = save(emptyHubDraft(), { widgets: { countdown: { stage_show: { rsvp: false } } } });
    road = save(road, { widgets: { countdown: { stage_show: { rsvp: null } } } });
    const full = fullOrder(road, 'rsvp');
    const moved = movedOrder(full, full[seed % full.length]!, 1) ?? movedOrder(full, full[seed % full.length]!, -1)!;
    road = save(road, stageOrderPatch(moved, (id) => id.slice(3), 'rsvp'));
    road = save(road, stageOrderPatch(full, (id) => id.slice(3), 'rsvp'));
    road = save(road, { widgets: { special_message: { stage_show: { save_the_date: true } } } });
    road = save(road, { widgets: { special_message: { stage_show: { save_the_date: null } } } });
    assert.deepEqual([read(road).count, read(road).lines], [0, []], `seed ${seed}: a hide and its ＋, a move and its way back, a tick and its untick still read as changes`);
    assert.equal(read(road).canUndo, true, 'the steps can still be taken back');
    tally.zeroByRoad += 1;
  }
  console.log(`  ${tally.steps} steps (${tally.edits} edits · ${tally.moves} moves · ${tally.hides} per-stage hides/shows) · ${tally.undos} ↺: ${tally.lowered} lowered the badge, ${tally.kept} kept it, ${tally.raised} raised it (each the undo of a return to what guests have) · ${tally.toZero} sessions walked all the way back to nothing`);
  assert.ok(tally.undos > 200 && tally.lowered > 60 && tally.kept > 30 && tally.raised > 5 && tally.moves > 300 && tally.hides > 600 && tally.toZero >= 90, 'anti-vacuity: a kind of step went missing');
});

test('2 · the tester’s four edits (M19): three THINGS, named — and each ↺ in his order', () => {
  let d = emptyHubDraft();
  d = save(d, { widgets: { hero: { canvas: { elements: { eyebrow: { word: 'With joy in our hearts' } } } } } }); // Title · words
  d = save(d, { fixedStyles: { hero_eyebrow: 'serif' } }); // Title · style
  d = save(d, { widgets: { special_message: { canvas: { kind: 'color', color: '#A9834B' } } } }); // Message · background
  d = save(d, { widgets: { hero: { canvas: { elements: { eyebrow: { word: 'With joy in our hearts', inFx: { fade: true } } } } } } }); // Title · animate
  const four = read(d);
  console.log(`  the four edits read: ${four.lines.join(' | ')}`);
  assert.equal(d.history.length, 4, 'four saves were made');
  assert.equal(four.count, 3, 'the badge counts THINGS that differ (the Title’s words and motion are one: the cover’s look)');
  assert.equal(four.lines.length, 3);
  const seen: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    d = stored(undoHubDraft(d));
    seen.push(read(d).count);
    assert.equal(read(d).count, read(d).lines.length);
  }
  assert.deepEqual(seen, [3, 2, 1, 0], '↺ took the motion back first — the cover still differs by its words, so its line stays');
  assert.equal(read(d).canUndo, false);
});
