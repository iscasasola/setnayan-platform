/**
 * the-table-the-maker-and-the-page-agree.test.ts — THE JUNCTION, ON THE REAL DRAFT PATH (no lab code in this file).
 *
 * Two builders met here: "What guests see" (a tick table that writes `config_json.stage_show[stage]`) and the Maker's
 * own Remove · ＋ (the eye, which since 2026-10-11 writes the SAME value). A tester walked the merged copy in the lab
 * and the two did not agree in either direction (`hub-walk/merged/REPORT.md`, M01–M09); the lab's own plumbing was
 * the suspect. "It is only the lab" has to be SHOWN — so this file is a couple's whole session on the road a
 * signed-in couple's saves really take, and at every step asks the four readers the same question:
 *
 *     a save (`hubDraftAction` → `mergeHubDraft`) → `event_site_drafts.draft_json` (`hubDraftForWrite`, read back by
 *     `readHubDraft` → `sanitizeHubDraft`) → `overlayHubDraftWidgets` → the Maker's page (`buildMakerNavigatorData`:
 *     the table, the stage lists, the eye) and the guest page's plan (`resolveSiteBodyPlan`).
 *
 *   1. THE SESSION (seeded, 60 couples × 40 steps): a tick or several and Apply · Back to our picks · the canvas's
 *      Remove · ＋ on a part taken off · Earlier / Later · an edit · ↺. After EVERY step, on every stage:
 *        · the table's box  ⇔  the Maker's list (or the place off the list the table names)  ⇔  the page's plan;
 *        · the box's stored choice IS the row's `stage_show[stage]`;
 *        · a part taken off a stage is offered back by ＋ on that stage (folded, `hiddenByCouple`), and its box is
 *          empty; no other stage's list moved;
 *      and at the end ✓ Apply writes the rows (the action's own key mapping) — the stored rows, read with NO draft,
 *      give the same table, the same lists and the same plans, and the draft then differs from live by nothing.
 *   2. A SCENE WITH NOTHING IN IT YET, open browsing on (a new event's default): its boxes keep their ticks, a tick
 *      on it survives the render, and Remove takes its prompt off the Maker's page — and it stays off.
 *   3. THE TESTER'S OWN STEPS (M01 · M02 · M04 · M05 · M06 · M07), word for word, on this road.
 *
 * WHAT THIS DOES NOT HOLD: the Maker's state BETWEEN two renders (a Remove is drawn at the tap and owes no render —
 * `lib/maker-list-gates.test.ts` holds that), a browser, and the lab (`app/dev/maker-lab/lab-draft.test.ts`).
 *
 * FOUR REAL FAULTS THIS FILE FOUND ON ITS FIRST RUNS (none was in the tester's list — the lab could not reach them):
 *   R1 · an empty scene's boxes read "Hidden" on every stage and forgot a tick (open browsing on)  → `asIfWritten`;
 *   R2 · Remove on an empty scene stored "back to our pick" — nothing — and it came back         → `buildStageEyes`;
 *   R3 · ✓ Apply wrote a row's place on a stage whose order had NOT moved, and not its neighbours' — the stage went
 *        live half-placed, in an order nobody chose (seed 12)                                     → `classifyHubDraft`;
 *   R4 · two scenes ADDED to a stage and re-ordered: the order was not counted and not written (seed 26)
 *                                                                                                 → `hubDraftMovedStages`.
 *
 * SABOTAGES RUN (each seen red, then put back): see the commit that added this file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMakerNavigatorData } from '@/app/dashboard/[eventId]/website/editor/_components/maker-navigator-data';
import {
  emptyHubDraft,
  hubDraftForWrite,
  mergeHubDraft,
  overlayHubDraftWidgets,
  planHubDraftApply,
  sanitizeHubDraft,
  summarizeHubDraft,
  undoHubDraft,
  type HubDraft,
  type HubDraftPatch,
} from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import {
  GUESTS_SEE_COLUMNS,
  guestsSeeBackToPicks,
  guestsSeeOn,
  guestsSeePatch,
  guestsSeeToggle,
  type GuestsSeeTable,
  type GuestsSeeWrites,
} from './guests-see-table';
import { WIDGET_CATALOG_BY_TYPE, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { widgetsGuestsMeet } from './maker-scene-list';
import { movedOrder, stageOrderPatch } from './maker-reorder';
import { resolveSiteBodyPlan } from './site-body-plan';
import { stageEyeValue } from './stage-eye';
import { STAGE_ORDER_KEY, STAGE_SHOW_KEY, stageShown } from './stage-scenes';
import { sceneOnStage } from './what-guests-see';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const ORDER: readonly WidgetType[] = [
  'hero', 'greeting', 'qr_card', 'event_details', 'countdown', 'schedule', 'rsvp', 'venue_map', 'dress_code',
  'photo_moments', 'your_photos', 'tier_comparison', 'special_message', 'what_to_bring', 'our_photos', 'our_love_story',
];
const liveRows = (): InvitationWidgetRow[] =>
  ORDER.map((t, i) => ({
    widget_id: `id-${t}`, event_id: 'e1', widget_type: t, display_order: i + 1, is_visible: true,
    is_always_on: WIDGET_CATALOG_BY_TYPE[t].is_always_on, tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
  }));

type Facts = { openBrowse: boolean; content: Partial<Record<WidgetType, boolean>> };
const WEDDING = { save_the_date_film: true, love_story: true };

/** What the Maker's page is handed on a render: the draft laid over the live rows, as `website/editor/page.tsx` does. */
function render(live: readonly InvitationWidgetRow[], draft: HubDraft | null, facts: Facts) {
  const rows = overlayHubDraftWidgets(live, draft);
  const nav = buildMakerNavigatorData({
    plan: {
      widgets: rows, openBrowse: facts.openBrowse, weddingOnlyParts: WEDDING, content: facts.content, solemn: false, hasHeroMedia: false,
      hasEntourage: true, dayParts: true, storyRenders: facts.content.our_love_story !== false, countdownPast: false, giftsOff: false,
    },
    sectionRows: rows,
    tint: { canvas: '#fff', ink: '#000', accent: '#a00' },
    facts: {
      names: 'Maria & Jose', dateLabel: null, daysToGo: 60, venueName: null, venueAddress: null, firstBlock: null, dressTitle: null, dressLine: null,
      photoMomentsLine: null, specialMessage: null, whatToBring: null, loveStory: null, entourageCount: 4, heroPhotoUrl: null, firstGalleryUrl: null,
    },
    photoUrls: {},
  });
  return { rows, nav };
}
type Rendered = ReturnType<typeof render>;

/** `event_site_drafts.draft_json`: written through the one door, read back through the one reader. */
const stored = (d: HubDraft): HubDraft => sanitizeHubDraft(JSON.parse(JSON.stringify(hubDraftForWrite(d))));
const save = (d: HubDraft, patch: unknown): HubDraft => stored(mergeHubDraft(d, JSON.parse(JSON.stringify(patch)) as HubDraftPatch));

const boxes = (t: GuestsSeeTable) =>
  t.groups.flatMap((g) => g.rows).flatMap((row) =>
    row.cells.flatMap((cell, col) => (cell.kind === 'box' && row.scene ? [{ row, col, cell, type: row.scene, stage: GUESTS_SEE_COLUMNS[col]!.stage as LifecyclePhase }] : [])),
  );
const sceneKeys = (r: Rendered, stage: LifecyclePhase) => r.nav.stageLists[stage].shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
const fixedKeys = (r: Rendered, stage: LifecyclePhase) => r.nav.stageLists[stage].shown.flatMap((t) => (t.kind === 'fixed' ? [t.fixed] : []));
/** The guest page's own list for a listed guest, an empty scene keeping its place (the Maker's canvas fails open). */
const planList = (rows: readonly InvitationWidgetRow[], stage: LifecyclePhase, facts: Facts) =>
  resolveSiteBodyPlan({
    identity: 'guest', phasesEnabled: true, lifecyclePhase: stage, stdFilm: true, isSample: false, hasHeroMedia: false, hasBgMusic: false,
    liveMediaPublic: false, weddingOnlyParts: WEDDING, widgets: widgetsGuestsMeet(rows, stage), openBrowse: facts.openBrowse, content: {},
  }).hideableInOrder.map((w) => w.widget_type);

/** THE FOUR READERS, ONE QUESTION. Returns how many boxes were compared. */
function assertAgree(r: Rendered, facts: Facts, where: string): number {
  let n = 0;
  for (const b of boxes(r.nav.guestsSee)) {
    const at = `${b.type} × ${b.stage} — ${where}`;
    const row = r.rows.find((w) => w.widget_type === b.type)!;
    // the stored row ⇔ the box's choice ⇔ the eye's choice
    assert.equal(b.cell.choice, stageShown(row.config_json, b.stage), `the box does not hold the row's choice: ${at}`);
    assert.equal(r.nav.stageEye[b.stage][b.type]?.choice ?? null, b.cell.choice, `the eye and the table read two choices: ${at}`);
    // the page's plan ⇔ the Maker's list
    const listed = sceneKeys(r, b.stage).includes(b.type);
    assert.equal(listed, planList(r.rows, b.stage, facts).includes(b.type), `the Maker lists what the page's plan does not (or the reverse): ${at}`);
    // the box ⇔ the Maker's list, or the one place off the list the table names
    const s = sceneOnStage({ widgets: r.rows, stage: b.stage, reader: 'guest', openBrowse: facts.openBrowse, weddingOnlyParts: WEDDING, content: {} }, b.type)!;
    const off = s.offList;
    if (off === 'film') assert.ok(fixedKeys(r, b.stage).includes('film'), `the table says the film carries it and the Maker lists no film: ${at}`);
    if (off === 'welcome') assert.ok(r.nav.stageLists[b.stage].folded.some((f) => f.type === b.type && /Welcome/.test(f.reason)), `the Day's Welcome is not named in the fold: ${at}`);
    assert.equal(b.cell.on, listed || off !== null, `THE TABLE AND THE MAKER DISAGREE: the box is ${b.cell.on ? 'ticked' : 'empty'}, the Maker ${listed ? 'lists it' : 'does not list it'}${off ? ` (off the list: ${off})` : ''}: ${at}`);
    // a part the couple took off THIS stage: an empty box, and ＋ offers it back here
    if (b.cell.choice === false) {
      assert.equal(b.cell.on, false, `hidden here and still ticked: ${at}`);
      const fold = r.nav.stageLists[b.stage].folded.find((f) => f.type === b.type);
      assert.ok(fold?.hiddenByCouple && fold.hiddenHere, `taken off this stage and ＋ would not offer it: ${at}`);
    }
    n += 1;
  }
  return n;
}

/** ✓ Apply's writes onto the live rows — the key mapping `hub-draft-actions.ts` uses (pinned in `the-per-stage-choice-travels-with-the-draft.test.ts`). */
function applied(live: readonly InvitationWidgetRow[], draft: HubDraft): InvitationWidgetRow[] {
  const plan = planHubDraftApply(draft, { events: {}, widgets: live }, true);
  assert.equal(plan.refused.length, 0, 'a couple with Pro had something held');
  const out = live.map((r) => ({ ...r, config_json: { ...(r.config_json as Record<string, unknown>) } as InvitationWidgetRow['config_json'] }));
  for (const item of plan.apply) {
    if (item.kind !== 'widget') continue;
    const row = out.find((r) => r.widget_type === item.widgetType)!;
    const config = row.config_json as Record<string, unknown>;
    if (item.field === 'mode') row.mode = item.value as InvitationWidgetRow['mode'];
    else if (item.field === 'is_visible') row.is_visible = item.value as boolean;
    else if (item.field === 'display_order') row.display_order = item.value as number;
    else {
      const key = item.field === 'stage_order' ? STAGE_ORDER_KEY : item.field === 'stage_show' ? STAGE_SHOW_KEY : item.field;
      if (item.value === null) delete config[key];
      else config[key] = item.value;
    }
  }
  return out;
}

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]! };
}

const eyePatch = (r: Rendered, type: WidgetType, stage: LifecyclePhase, want: boolean) => ({
  widgets: { [type]: { stage_show: { [stage]: stageEyeValue(r.nav.stageEye[stage][type], want) } } },
});

test('1 · THE SESSION: the table, the Maker’s list, the page’s plan and the stored row agree after every step — and after ✓ Apply', () => {
  const tally = { steps: 0, boxes: 0, ticks: 0, removes: 0, offered: 0, unadded: 0, adds: 0, moves: 0, undos: 0, picks: 0, applied: 0 };
  for (let seed = 1; seed <= 60; seed += 1) {
    const r0 = rng(seed);
    const facts: Facts = { openBrowse: seed % 2 === 0, content: seed % 3 === 0 ? { our_love_story: false, what_to_bring: false } : {} };
    const live = liveRows();
    let draft = emptyHubDraft();
    let now = render(live, draft, facts);
    tally.boxes += assertAgree(now, facts, `seed ${seed} · before any step`);
    for (let step = 0; step < 40; step += 1) {
      const where = `seed ${seed} · step ${step}`;
      const stage = r0.pick(STAGES);
      const before = now;
      const op = r0.int(10);
      if (op <= 2) {
        // ── the table: one to three ticks, then Apply (one save)
        let writes: GuestsSeeWrites = {};
        for (let k = r0.int(3); k >= 0; k -= 1) {
          const b = r0.pick(boxes(now.nav.guestsSee));
          writes = guestsSeeToggle(now.nav.guestsSee, writes, b.row.key, b.col).writes;
        }
        const wanted = boxes(now.nav.guestsSee).map((b) => guestsSeeOn(b.row, b.col, writes));
        const patch = guestsSeePatch(writes);
        if (!patch) continue;
        draft = save(draft, patch);
        now = render(live, draft, facts);
        assert.deepEqual(boxes(now.nav.guestsSee).map((b) => b.cell.on), wanted, `the table opened again does not show what was applied — ${where}`);
        tally.ticks += 1;
      } else if (op === 3) {
        // ── the table: Back to our picks, then Apply
        const back = guestsSeeBackToPicks(now.nav.guestsSee, {});
        const patch = guestsSeePatch(back.writes);
        if (!back.changed || !patch) continue;
        draft = save(draft, patch);
        now = render(live, draft, facts);
        for (const b of boxes(now.nav.guestsSee)) assert.equal(b.cell.choice, null, `Back to our picks left a choice stored: ${b.type} × ${b.stage} — ${where}`);
        tally.picks += 1;
      } else if (op <= 5) {
        // ── the canvas: Remove a part this stage draws
        const shown = sceneKeys(now, stage);
        if (shown.length === 0) continue;
        const type = r0.pick(shown);
        draft = save(draft, eyePatch(now, type, stage, false));
        now = render(live, draft, facts);
        assert.ok(!sceneKeys(now, stage).includes(type), `Remove did not take ${type} off ${stage} — ${where}`);
        /* A part of the stage's OWN list (our pick) is stored as hidden here, and ＋ offers it back. A part the couple
           ADDED to this stage from the table is un-added (the choice is taken back — `stageEyeValue`, the table's own
           rule): after the next render it is the table, not ＋, that adds it again. (Until that render the work area
           still offers it — `listWithGates`.) Counted, so the second case cannot quietly become the only one. */
        if (before.nav.stageEye[stage][type]?.base) {
          assert.ok(now.nav.stageLists[stage].folded.some((f) => f.type === type && f.hiddenByCouple), `＋ does not offer ${type} back on ${stage} — ${where}`);
          tally.offered += 1;
        } else {
          assert.equal(stageShown(now.rows.find((w) => w.widget_type === type)!.config_json, stage), null, `un-adding ${type} on ${stage} left a choice stored — ${where}`);
          tally.unadded += 1;
        }
        for (const s of STAGES) if (s !== stage) assert.deepEqual(sceneKeys(now, s), sceneKeys(before, s), `Remove on ${stage} moved ${s} — ${where}`);
        tally.removes += 1;
      } else if (op === 6) {
        // ── the canvas: ＋ a part the couple took off this stage
        const back = now.nav.stageLists[stage].folded.filter((f) => f.hiddenByCouple && f.widgetId);
        if (back.length === 0) continue;
        const type = r0.pick(back).type;
        draft = save(draft, eyePatch(now, type, stage, true));
        now = render(live, draft, facts);
        /* Back on the stage: in its list — or, for the gallery on a Save the Date its film leads, back in the film
           (the table's box says which; `assertAgree` below holds the box to the list). */
        assert.ok(sceneKeys(now, stage).includes(type) || boxes(now.nav.guestsSee).some((b) => b.type === type && b.stage === stage && b.cell.on), `＋ did not bring ${type} back on ${stage} — ${where}`);
        for (const s of STAGES) if (s !== stage) assert.deepEqual(sceneKeys(now, s), sceneKeys(before, s), `＋ on ${stage} moved ${s} — ${where}`);
        tally.adds += 1;
      } else if (op === 7) {
        // ── Earlier / Later: the stage's whole order, one save
        const full = now.nav.fullOrders[stage];
        if (full.length < 2) continue;
        const order = movedOrder(full, r0.pick(full), r0.pick([-1, 1]));
        const patch = order ? stageOrderPatch(order, (id) => now.rows.find((w) => w.widget_id === id)?.widget_type, stage) : null;
        if (!patch) continue;
        draft = save(draft, patch);
        now = render(live, draft, facts);
        assert.deepEqual(sorted(sceneKeys(now, stage)), sorted(sceneKeys(before, stage)), `a move changed WHAT is on ${stage} — ${where}`);
        tally.moves += 1;
      } else if (op === 8) {
        // ── an edit that is neither (a scene's motion)
        draft = save(draft, { widgets: { [r0.pick(['countdown', 'schedule', 'special_message'] as const)]: { canvas: { inFx: { fade: r0.int(2) === 0 } } } } });
        now = render(live, draft, facts);
      } else {
        // ── ↺
        if (draft.history.length === 0) continue;
        draft = stored(undoHubDraft(draft));
        now = render(live, draft, facts);
        tally.undos += 1;
      }
      tally.boxes += assertAgree(now, facts, where);
      /* ✓ the badge counts exactly what the Apply sheet lists — whatever mix of ticks, removes and moves made it. */
      const liveState = { events: {}, widgets: live };
      assert.equal(summarizeHubDraft(draft, liveState, true).changeCount, hubDraftChangeLines(draft, liveState, true).length, `the ✓ badge and the sheet's lines differ — ${where}`);
      tally.steps += 1;
    }
    // ── ✓ APPLY: the rows as stored, read with no draft at all
    const rows = applied(live, draft);
    const after = render(rows, null, facts);
    assert.deepEqual(after.nav.guestsSee, now.nav.guestsSee, `seed ${seed}: the table after ✓ Apply is not the table the couple was shown`);
    for (const stage of STAGES) {
      assert.deepEqual(after.nav.stageLists[stage].shown.map((t) => t.key), now.nav.stageLists[stage].shown.map((t) => t.key), `seed ${seed}: ${stage}'s list after ✓ Apply is not the one the Maker drew`);
      assert.deepEqual(planList(rows, stage, facts), planList(now.rows, stage, facts), `seed ${seed}: the guest page's ${stage} after ✓ Apply is not the previewed one`);
    }
    for (const b of boxes(after.nav.guestsSee)) assert.equal(stageShown(rows.find((w) => w.widget_type === b.type)!.config_json, b.stage), b.cell.choice, `seed ${seed}: the stored row and the box differ after ✓ Apply`);
    assert.equal(summarizeHubDraft(draft, { events: {}, widgets: rows }, true).changeCount, 0, `seed ${seed}: after ✓ Apply the draft still differs from what guests have`);
    tally.boxes += assertAgree(after, facts, `seed ${seed} · after ✓ Apply`);
    tally.applied += 1;
  }
  console.log(`  ${tally.steps} steps · ${tally.boxes} boxes compared · ${tally.ticks} table applies · ${tally.picks} back-to-our-picks · ${tally.removes} removes (${tally.offered} offered back by ＋, ${tally.unadded} un-added) · ${tally.adds} ＋ · ${tally.moves} moves · ${tally.undos} ↺ · ${tally.applied} ✓ Apply`);
  assert.ok(tally.steps > 1500 && tally.ticks > 300 && tally.removes > 200 && tally.offered > 150 && tally.unadded > 5 && tally.adds > 50 && tally.moves > 100 && tally.undos > 100 && tally.picks > 50, 'anti-vacuity: the session stopped doing something');
});
const sorted = (xs: readonly string[]) => [...xs].sort();

test('2 · a scene with NOTHING IN IT YET (open browsing on): its ticks stay, a tick on it survives the render, and Remove stays removed', () => {
  const facts: Facts = { openBrowse: true, content: { our_love_story: false, our_photos: false, what_to_bring: false } };
  const live = liveRows();
  let draft = emptyHubDraft();
  let now = render(live, draft, facts);
  const cell = (r: Rendered, type: WidgetType, stage: LifecyclePhase) => boxes(r.nav.guestsSee).find((b) => b.type === type && b.stage === stage)!;
  const row = (r: Rendered, type: WidgetType) => r.nav.guestsSee.groups.flatMap((g) => g.rows).find((x) => x.scene === type)!;

  // The Maker's canvas keeps an empty scene's place (a prompt) — and the table says the same, with its one line.
  assert.ok(sceneKeys(now, 'rsvp').includes('our_love_story'), 'anti-vacuity: the Maker lists the empty love story on the Invitation');
  assert.equal(row(now, 'our_love_story').empty, true);
  assert.deepEqual([cell(now, 'our_love_story', 'rsvp').cell.on, cell(now, 'our_love_story', 'rsvp').cell.ourPick], [true, true], 'an empty scene our pick puts on the Invitation read as Hidden');
  assertAgree(now, facts, 'empty scenes, before any step');

  // M02: tick an EMPTY box on an empty row — it is drawn on the Maker's page, and the table opened again keeps the tick.
  assert.equal(cell(now, 'our_photos', 'rsvp').cell.on, false);
  const tick = guestsSeeToggle(now.nav.guestsSee, {}, 'our_photos', cell(now, 'our_photos', 'rsvp').col);
  assert.match(tick.line, /^Added to Invitation\. Nothing written yet — guests will not see it until you write it\.$/);
  draft = save(draft, guestsSeePatch(tick.writes));
  now = render(live, draft, facts);
  assert.ok(sceneKeys(now, 'rsvp').includes('our_photos'), 'a ticked empty box is not on the Maker’s page');
  assert.equal(cell(now, 'our_photos', 'rsvp').cell.on, true, 'the table forgot a tick on a scene with nothing in it yet');
  assertAgree(now, facts, 'after a tick on an empty row');

  // Remove the empty love story's prompt from the Invitation: it is stored (not "back to our pick"), and it stays off.
  const patch = eyePatch(now, 'our_love_story', 'rsvp', false);
  assert.deepEqual(patch.widgets.our_love_story.stage_show, { rsvp: false }, 'Remove on an empty scene stored nothing');
  draft = save(draft, patch);
  now = render(live, draft, facts);
  assert.ok(!sceneKeys(now, 'rsvp').includes('our_love_story'), 'a removed empty scene is back on the next render');
  assert.equal(cell(now, 'our_love_story', 'rsvp').cell.on, false);
  assert.ok(sceneKeys(now, 'save_the_date').includes('our_love_story'), 'Remove on the Invitation took it off Save the Date');
  assertAgree(now, facts, 'after Remove on an empty scene');
  assert.equal(summarizeHubDraft(draft, { events: {}, widgets: live }, true).changeCount, 2, 'the ✓ count does not hold the tick and the Remove');
});

test('3 · the tester’s own steps (M01 · M02 · M04 · M05 · M06 · M07) on the real draft', () => {
  const facts: Facts = { openBrowse: true, content: {} };
  const live = liveRows();
  const liveState = { events: {}, widgets: live };
  let draft = emptyHubDraft();
  let now = render(live, draft, facts);
  const cell = (r: Rendered, type: WidgetType, stage: LifecyclePhase) => boxes(r.nav.guestsSee).find((b) => b.type === type && b.stage === stage)!;

  // M01 · untick Message × Invitation (our pick) → Apply → the Invitation no longer lists it; Post Event still does.
  const untick = guestsSeeToggle(now.nav.guestsSee, {}, 'special_message', cell(now, 'special_message', 'rsvp').col);
  assert.equal(untick.line, 'Hidden on Invitation. Still shown on Post Event.');
  draft = save(draft, guestsSeePatch(untick.writes));
  now = render(live, draft, facts);
  assert.ok(!sceneKeys(now, 'rsvp').includes('special_message'), 'M01: an unticked part is still on the Invitation');
  assert.ok(sceneKeys(now, 'editorial').includes('special_message'));
  // M04 · the table opened again shows it unticked, and ✓ reads 1.
  assert.equal(cell(now, 'special_message', 'rsvp').cell.on, false, 'M04: the reopened table forgot the Apply');
  assert.equal(summarizeHubDraft(draft, liveState, true).changeCount, 1);

  // M02 · tick two EMPTY boxes → Apply → both are on their stage.
  let writes: GuestsSeeWrites = {};
  writes = guestsSeeToggle(now.nav.guestsSee, writes, 'special_message', cell(now, 'special_message', 'save_the_date').col).writes;
  writes = guestsSeeToggle(now.nav.guestsSee, writes, 'our_photos', cell(now, 'our_photos', 'rsvp').col).writes;
  draft = save(draft, guestsSeePatch(writes));
  now = render(live, draft, facts);
  assert.ok(sceneKeys(now, 'save_the_date').includes('special_message'), 'M02: a ticked box is not on Save the Date');
  assert.ok(sceneKeys(now, 'rsvp').includes('our_photos'), 'M02: a ticked box is not on the Invitation');
  assert.equal(summarizeHubDraft(draft, liveState, true).changeCount, 2, 'two scenes changed: the ✓ counts scenes, as the sheet lists them');

  // M05 · Back to our picks → Apply → the three boxes go back and ✓ returns to 0.
  const back = guestsSeeBackToPicks(now.nav.guestsSee, {});
  assert.equal(back.changed, true, 'M05: "These are our picks already." with three boxes changed');
  assert.match(back.line, /^Back to our picks\. 3 boxes changed — Apply to keep it\.$/);
  draft = save(draft, guestsSeePatch(back.writes));
  now = render(live, draft, facts);
  assert.deepEqual(render(live, null, facts).nav.guestsSee, now.nav.guestsSee, 'M05: the table is not our picks again');
  assert.equal(summarizeHubDraft(draft, liveState, true).changeCount, 0, 'M05: ✓ still holds changes after Back to our picks');

  // M06 · Remove Countdown on the Invitation's canvas → exactly that box is empty; Save the Date untouched.
  const beforeRemove = boxes(now.nav.guestsSee).map((b) => b.cell.on);
  draft = save(draft, eyePatch(now, 'countdown', 'rsvp', false));
  now = render(live, draft, facts);
  const changed = boxes(now.nav.guestsSee).filter((b, i) => b.cell.on !== beforeRemove[i]).map((b) => `${b.type}:${b.stage}`);
  assert.deepEqual(changed, ['countdown:rsvp'], 'M06: the canvas Remove did not untick exactly its own box');
  // M07 · the Maker opened again (the same stored draft): Countdown stays off the Invitation.
  now = render(live, stored(draft), facts);
  assert.ok(!sceneKeys(now, 'rsvp').includes('countdown'), 'M07: the removed part is back when the Maker is opened again');
  assert.ok(sceneKeys(now, 'save_the_date').includes('countdown'));
  assert.equal(summarizeHubDraft(draft, liveState, true).changeCount, 1);
});

test('4 · the ORDER at the junction: scenes added to a stage can be re-ordered (counted, written); a tick alone is no move; a stage put back is not written at all', () => {
  const facts: Facts = { openBrowse: true, content: {} };
  const live = liveRows();
  const liveState = { events: {}, widgets: live };
  const lines = (d: HubDraft) => hubDraftChangeLines(d, liveState, true).map((l) => `${l.place} · ${l.what}`);
  const moveOn = (r: Rendered, stage: LifecyclePhase, type: WidgetType, delta: number) =>
    stageOrderPatch(movedOrder(r.nav.fullOrders[stage], `id-${type}`, delta)!, (id) => id.slice(3), stage);
  const cellOf = (r: Rendered, type: WidgetType, stage: LifecyclePhase) => boxes(r.nav.guestsSee).find((b) => b.type === type && b.stage === stage)!;
  const tickOn = (d: HubDraft, r: Rendered, type: WidgetType, stage: LifecyclePhase) => save(d, guestsSeePatch(guestsSeeToggle(r.nav.guestsSee, {}, type, cellOf(r, type, stage).col).writes));

  // (R4) two scenes ADDED to Save the Date, then one moved before the other.
  let draft = emptyHubDraft();
  let now = render(live, draft, facts);
  draft = tickOn(draft, now, 'schedule', 'save_the_date');
  now = render(live, draft, facts);
  draft = tickOn(draft, now, 'venue_map', 'save_the_date');
  now = render(live, draft, facts);
  const added = sceneKeys(now, 'save_the_date');
  assert.deepEqual(added.slice(-2), ['schedule', 'venue_map'], 'anti-vacuity: the two added scenes close Save the Date, in the default order');
  assert.ok(!lines(draft).some((l) => /Order/.test(l)), `adding a scene was counted as a move: ${lines(draft).join(' | ')}`);
  draft = save(draft, moveOn(now, 'save_the_date', 'venue_map', -1));
  now = render(live, draft, facts);
  assert.deepEqual(sceneKeys(now, 'save_the_date').slice(-2), ['venue_map', 'schedule']);
  assert.ok(lines(draft).includes('Save the Date · Order'), `the order of two added scenes is not counted: ${lines(draft).join(' | ')}`);
  let rows = applied(live, draft);
  assert.deepEqual(sceneKeys(render(rows, null, facts), 'save_the_date'), sceneKeys(now, 'save_the_date'), 'the order the Maker drew was not written at ✓ Apply');

  // (no over-reading) a stage moved and put BACK, then a scene ticked onto it: still no "Order".
  draft = emptyHubDraft();
  now = render(live, draft, facts);
  draft = save(draft, moveOn(now, 'rsvp', 'countdown', 1));
  now = render(live, draft, facts);
  draft = save(draft, moveOn(now, 'rsvp', 'countdown', -1));
  now = render(live, draft, facts);
  assert.deepEqual(lines(draft), [], 'a move put back is still a change');
  draft = tickOn(draft, now, 'our_photos', 'rsvp');
  now = render(live, draft, facts);
  assert.deepEqual(lines(draft).filter((l) => /Order/.test(l)), [], `a tick on a stage whose order was put back reads as a move: ${lines(draft).join(' | ')}`);
  assert.equal(lines(draft).length, 1);

  // (R3) Save the Date moved and put back; the Invitation really moved → ✓ Apply leaves Save the Date's places alone.
  draft = emptyHubDraft();
  now = render(live, draft, facts);
  const stdBefore = planList(live, 'save_the_date', facts);
  draft = save(draft, moveOn(now, 'save_the_date', 'countdown', 1));
  now = render(live, draft, facts);
  draft = save(draft, moveOn(now, 'save_the_date', 'countdown', -1));
  now = render(live, draft, facts);
  draft = save(draft, moveOn(now, 'rsvp', 'countdown', 1));
  now = render(live, draft, facts);
  assert.deepEqual(lines(draft), ['Invitation · Order']);
  rows = applied(live, draft);
  for (const r of rows) {
    const places = ((r.config_json as Record<string, unknown>)[STAGE_ORDER_KEY] ?? {}) as Record<string, number>;
    assert.equal('save_the_date' in places, false, `${r.widget_type} was written a place on Save the Date, whose order did not move`);
  }
  assert.ok(rows.some((r) => 'rsvp' in (((r.config_json as Record<string, unknown>)[STAGE_ORDER_KEY] ?? {}) as Record<string, number>)), 'anti-vacuity: the Invitation’s order was written');
  /* With the photos leading Save the Date the gallery is its first scene — and stays first. */
  const photos = (rs: readonly InvitationWidgetRow[]) => rs.map((r) => (r.widget_type === 'our_photos' ? { ...r, config_json: { ...(r.config_json as Record<string, unknown>), std_lead: 'photos' } as InvitationWidgetRow['config_json'] } : r));
  assert.deepEqual(planList(photos(rows), 'save_the_date', facts), planList(photos(live), 'save_the_date', facts), 'a stage nobody changed went live in another order');
  assert.deepEqual(planList(rows, 'save_the_date', facts), stdBefore);
  assert.equal(summarizeHubDraft(draft, { events: {}, widgets: rows }, true).changeCount, 0, '✓ still reads a change straight after Apply');
});
