import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, planHubDraftApply, undoHubDraft, type HubDraft, type HubDraftPatch } from './hub-draft';
import { isWidgetType, widgetInPhase, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { makerDropDelta } from './maker-part-groups';
import { movedOrder, stageOrderPatch } from './maker-reorder';
import {
  SCENE_BIN_REACH_PX,
  SCENE_COLLAPSE_CALM_MS,
  SCENE_COLLAPSE_EASE,
  SCENE_COLLAPSE_MS,
  SCENE_DRAG_WORDS,
  SCENE_EDGE_MAX_STEP,
  SCENE_EDGE_PX,
  SCENE_HOLD_MS,
  SCENE_MOUSE_LIFT_PX,
  SCENE_SCROLL_PX,
  SCENE_STATUS_MS,
  SCENE_UNDO_BUTTON,
  sceneDropSlot,
  sceneDropTarget,
  sceneEdgeScroll,
  sceneHeldSaveDone,
  sceneLiftAllowed,
  sceneMenuRows,
  sceneMovesAmong,
  sceneOrderAfter,
  sceneOverBin,
  scenePadDone,
  sceneReflow,
  type SceneRow,
} from './maker-scene-drag';
import { makerStageList, type MakerTile } from './maker-scene-list';
import { resolveSiteBodyPlan } from './site-body-plan';
import { STAGE_ORDER_KEY, sceneFollowsEntourage, splitAroundEntourage, stageRowOrder } from './stage-scenes';
import { stripComments } from './strip-comments';

/**
 * ✋ 🗑 A SCENE IS MOVED BY HOLDING IT ON THE PAGE AND DRAGGING IT, AND REMOVED BY DROPPING IT ON A BIN.
 *
 * Owner, 2026-10-11 (DECISION_LOG "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE AND REMOVED BY DROPPING
 * IT ON A BIN ("JUST LIKE INSTAGRAM"); THE LOWER THIRD COLLAPSES WHILE A SCENE IS HELD"): *"what if we drag the scene
 * on the preview instead of having this. then there is a delete button where they can drag the scene to the delete
 * button to delete it"* · *"when we drag something the bottom toolbar collapses and shows the whole page. make sure
 * animation to collapse and expand shows"* · *"so whatever their location is what will be seen on the event hub
 * itself too"*. The approved prototype: `prototypes/maker_drag_scenes_2026-10-11.html`.
 *
 * The drag replaced Earlier · Later · Remove, and must keep every rule those buttons kept. Held here, each one
 * EXECUTED where it is a rule and READ where it is wiring — and each seen to fail once:
 *
 *   (1) THE NUMBERS AND THE WORDS are the prototype's, exactly.
 *   (2) A DROP IS ONLY ACCEPTED WHERE IT CHANGES THE PAGE — over every stage and every scene: the gap never opens
 *       across the Wedding March, never beside a fixed part (the Reveal, the cover, the reply card).
 *   (3) WHAT IS SEEN WHILE DRAGGING IS WHAT THE SAVE BRINGS — the gap's order, fuzzed over rows of any height.
 *   (4) ONE DROP = ONE SAVE = ONE UNDO STEP, AND THE PAGE THE COUPLE ARRANGES IS THE PAGE THE GUEST GETS — from the
 *       drop, through the shipped reducers, to the guest page's own ordered scene list: on every stage, for every
 *       scene and every place it can be dropped, with a hide already PUBLISHED under the draft.
 *   (5) THE BUSY RULE — no second lift while a drop is on its way; a held save is done only when it has answered.
 *   (6) THE BIN, THE EDGES, THE PAGE'S PLACE.
 *   (7) THE WIRING — a swipe scrolls (the pan is blocked only once the hold has fired); a refused save slides back
 *       BEFORE the line speaks; a scene of the couple's own is never taken silently; ↺ is the Maker's own; the drag
 *       rides no first load and no guest's page.
 */

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const src = (rel: string) => stripComments(raw(rel));

/* ── the sample: every scene type, as the owner's event has them ─────────────────────────────────────────────── */

const TYPES: Array<[WidgetType, boolean]> = [
  ['hero', true], ['greeting', true], ['qr_card', true], ['event_details', false], ['countdown', false], ['schedule', false], ['rsvp', true],
  ['venue_map', false], ['dress_code', false], ['photo_moments', false], ['your_photos', false], ['tier_comparison', false],
  ['special_message', false], ['what_to_bring', false], ['our_photos', false], ['our_love_story', false],
];
const rows = (config: Partial<Record<WidgetType, Record<string, unknown>>> = {}): InvitationWidgetRow[] =>
  TYPES.map(([type, alwaysOn], i) => ({
    widget_id: `w-${type}`, event_id: 'e', widget_type: type, display_order: i + 1, is_visible: true, is_always_on: alwaysOn, tier: 'basic',
    config_json: config[type] ?? {}, created_at: '', updated_at: '', mode: 'auto', audience: 'public',
  })) as InvitationWidgetRow[];
const typeOf = (id: string) => id.slice(2);
const inStage = (t: string, s: LifecyclePhase) => isWidgetType(t) && widgetInPhase(t, s);
const STAGES: LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
/** Every scene has something in it (an empty scene is not drawn for guests — and a drag is of what is drawn). */
const FULL = Object.fromEntries(TYPES.map(([t]) => [t, true])) as Record<WidgetType, boolean>;

/** THE MAKER'S LIST of a stage — what the canvas draws, in its order (the draft laid over what is published). */
const listOf = (widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase) =>
  makerStageList({ stage, widgets, openBrowse: false, content: FULL, solemn: false, hasHeroMedia: false, hasEntourage: true, storyRenders: true });

/** THE GUEST PAGE'S ORDERED SCENE LIST for a stage: the page's own plan, split around the entourage as the page draws it. */
function guestSees(widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase): string[] {
  const plan = resolveSiteBodyPlan({
    identity: 'guest', phasesEnabled: true, lifecyclePhase: stage, stdFilm: true, isSample: false,
    hasHeroMedia: false, hasBgMusic: false, liveMediaPublic: false, widgets, openBrowse: false, content: FULL,
  }).hideableInOrder;
  const around = splitAroundEntourage(stage, plan);
  return [...around.before, ...around.after].map((w) => w.widget_type);
}

type SceneTile = Extract<MakerTile, { kind: 'scene' }>;
const scenesOf = (shown: readonly MakerTile[]) => shown.filter((t): t is SceneTile => t.kind === 'scene');

/**
 * A DROP ON THE PAGE, as the Maker makes it (`add-part-sheet.tsx`: `subject` → `moveTargets` → `dropOn`): the held
 * scene and the parts it may land among (`sceneMovesAmong`), the place it is let go (`slot`), the neighbour and the
 * side that names (`sceneDropTarget`), the shipped drop rule (`makerDropDelta`) and the shipped one-save patch
 * (`movedOrder` → `stageOrderPatch`). Null: let go where it was — nothing is written.
 */
function dropOnPage(widgets: readonly InvitationWidgetRow[], stage: LifecyclePhase, held: SceneTile, slot: number): { patch: HubDraftPatch; expected: string[]; names: string[] } | null {
  const list = listOf(widgets, stage);
  const among = sceneMovesAmong(stage, list.shown, { kind: 'scene', type: held.type }, held.key);
  const names = list.shown.filter((t) => t.key === held.key || among.some((a) => a.key === t.key)).map((t) => t.key as string);
  const at = names.indexOf(held.key);
  const drop = sceneDropTarget(names, at, slot);
  if (!drop) return null;
  const fullOrder = stageRowOrder(widgets, stage, inStage).map((r) => r.widget_id);
  const shown = scenesOf(list.shown).map((t) => t.widgetId);
  const last = shown[shown.length - 1]!;
  const afterLastShown = fullOrder[fullOrder.indexOf(last) + 1] ?? null;
  const delta = makerDropDelta({ fullOrder, shown, afterLastShown, id: held.widgetId, target: among.find((a) => a.key === drop.target)!.id, where: drop.where });
  const order = movedOrder(fullOrder, held.widgetId, delta);
  assert.ok(order, `${stage}: ${held.type} → slot ${slot}: a drop that changes the page moved nothing in the order (delta ${delta})`);
  const patch = stageOrderPatch(order, typeOf, stage);
  assert.ok(patch, 'the order could not be written as one patch');
  return { patch, expected: sceneOrderAfter(names, at, slot), names };
}

/* ── (1) the numbers and the words ───────────────────────────────────────────────────────────────────────────── */

test('(1) the numbers and the words are the approved prototype’s — exactly', () => {
  /* `HOLD_MS = 350, SLOP = 8, EDGE = 56` · mouse `> 6` · `--dur:.28s; --ease:cubic-bezier(.4,0,.2,1)` · reduced motion `.2s`
     · the bin's `pad = 26` · the scroll's `Math.min(14, …)` · `say`'s 3200. */
  assert.deepEqual(
    [SCENE_HOLD_MS, SCENE_SCROLL_PX, SCENE_EDGE_PX, SCENE_MOUSE_LIFT_PX, SCENE_COLLAPSE_MS, SCENE_COLLAPSE_EASE, SCENE_COLLAPSE_CALM_MS, SCENE_BIN_REACH_PX, SCENE_EDGE_MAX_STEP, SCENE_STATUS_MS],
    [350, 8, 56, 6, 280, 'cubic-bezier(.4,0,.2,1)', 200, 26, 14, 3200],
  );
  assert.deepEqual(
    { ...SCENE_DRAG_WORDS, removed: SCENE_DRAG_WORDS.removed('Message'), back: SCENE_DRAG_WORDS.back('Message'), tag: SCENE_DRAG_WORDS.tag('Message') },
    {
      bin: 'Drop here to remove',
      saving: 'Saving…',
      failed: 'That did not save. Nothing changed — please try again.',
      removed: 'Message removed',
      undo: 'Undo',
      back: 'Message is back',
      moveUndone: 'Move undone',
      up: 'Move up',
      down: 'Move down',
      remove: 'Remove',
      tag: 'Message — move or remove',
      revealWhy: 'The Reveal is always first on this page.',
    },
  );
  /* The Maker's side says NOTHING of its own: every word it draws is one of those (or a part's own shipped reason,
     handed in). No quoted prose in its markup. */
  const side = src(`${L}/scene-drag.tsx`);
  const jsx = side.slice(side.indexOf('const node ='));
  assert.ok(jsx.length > 1500, 'anti-vacuity: the Maker’s side of the drag was not found');
  assert.deepEqual([...jsx.matchAll(/>\s*([A-Z][^<>{}\n]{3,})\s*</g)].map((m) => m[1]), [], 'a line of its own is drawn beside the prototype’s words');
  assert.deepEqual([...jsx.matchAll(/SCENE_DRAG_WORDS\.(\w+)/g)].map((m) => m[1]).sort(), ['bin', 'removed', 'saving', 'undo']);
  assert.deepEqual([...side.slice(0, side.indexOf('const node =')).matchAll(/SCENE_DRAG_WORDS\.(\w+)/g)].map((m) => m[1]).sort(), ['back', 'failed', 'moveUndone']);
  /* The hold is not a number typed twice: the canvas's hands import theirs. */
  const hands = src(`${L}/scene-canvas-drag.ts`);
  assert.match(hands, /win\.setTimeout\(\(\) => lift\([^)]*\), SCENE_HOLD_MS\)/);
  assert.match(hands, /if \(moved > SCENE_SCROLL_PX\) stopPending\(\);/);
  assert.match(hands, /if \(moved > SCENE_MOUSE_LIFT_PX\) \{/);
  assert.doesNotMatch(hands, /\b(?:350|280)\b/, 'a number of the rules is typed again in the hands');
  /* The three steps for whoever cannot drag. */
  assert.deepEqual(sceneMenuRows({ up: true, down: false, remove: true }, 'Remove').map((r) => [r.words, r.on]), [['Move up', true], ['Move down', false], ['Remove', true]]);
});

/* ── (2) a drop is only accepted where it changes the page ───────────────────────────────────────────────────── */

test('(2) a held scene may land only among scenes on its own side of the Wedding March — on every stage, for every scene', () => {
  let asked = 0;
  let refused = 0;
  let allowed = 0;
  for (const stage of STAGES) {
    const list = listOf(rows(), stage);
    const scenes = scenesOf(list.shown);
    for (const held of scenes) {
      const among = sceneMovesAmong(stage, list.shown, { kind: 'scene', type: held.type }, held.key);
      asked += 1;
      const keys = among.map((a) => a.key);
      assert.ok(!keys.includes(held.key), `${stage}: ${held.type} may land beside itself`);
      for (const other of list.shown) {
        const key = other.kind === 'post-event' ? other.anchor : other.key;
        if (!key || key === held.key) continue;
        const offered = keys.includes(key);
        /* Never a fixed part: the Reveal, the cover, the reply card, E-Gifts, the March keep their places. */
        if (other.kind !== 'scene') {
          assert.equal(offered, false, `${stage}: ${held.type} may be dropped beside the fixed part ${key}`);
          continue;
        }
        const sameSide = sceneFollowsEntourage(stage, held.type) === sceneFollowsEntourage(stage, other.type);
        assert.equal(offered, sameSide, `${stage}: ${held.type} beside ${other.type} — ${sameSide ? 'refused though the page would change' : 'offered though the page would not change'}`);
        if (offered) allowed += 1;
        else refused += 1;
      }
      /* Its id is what the order write names. */
      for (const a of among) assert.equal(a.id, scenes.find((s) => s.key === a.key)!.widgetId);
    }
  }
  /* HIS CASE (Invitation › Details, 2026-10-11): What to bring is drawn after the entourage — nothing to land among. */
  const invitation = listOf(rows(), 'rsvp');
  const bring = scenesOf(invitation.shown).find((t) => t.type === 'what_to_bring')!;
  assert.deepEqual(sceneMovesAmong('rsvp', invitation.shown, { kind: 'scene', type: 'what_to_bring' }, bring.key), []);
  assert.ok(sceneMovesAmong('rsvp', invitation.shown, { kind: 'scene', type: 'venue_map' }, 'w:venue_map').every((a) => a.key !== bring.key));
  /* A fixed part is held by nothing and lands nowhere. */
  for (const stage of STAGES) assert.deepEqual(sceneMovesAmong(stage, listOf(rows(), stage).shown, { kind: 'fixed' }, 'f:hero'), []);
  assert.ok(asked >= 12 && allowed >= 40 && refused >= 6, `anti-vacuity: ${asked} scenes asked, ${allowed} neighbours allowed, ${refused} refused`);
});

test('(2) a Post Event scene lands only among the scenes that have a place in the run', () => {
  const tile = (scene: string, runKey: string | null): MakerTile => ({ kind: 'post-event', key: `p:${scene}`, anchor: `p:${scene}`, scene, label: scene, runKey } as unknown as MakerTile);
  const shown: MakerTile[] = [
    { kind: 'fixed', key: 'f:hero', fixed: 'hero', label: 'Cover', why: '' } as unknown as MakerTile,
    tile('cover', null),
    tile('numbers', 'numbers'),
    tile('wall', 'wall'),
    tile('thanks', null),
    { ...(tile('unseen', 'unseen') as object), anchor: null } as unknown as MakerTile,
  ];
  assert.deepEqual(sceneMovesAmong('editorial', shown, { kind: 'post-event', runKey: 'numbers' }, 'p:numbers'), [{ key: 'p:wall', id: 'wall' }]);
  /* One with no place in the run does not move — and nothing lands beside one the page does not draw. */
  assert.deepEqual(sceneMovesAmong('editorial', shown, { kind: 'post-event', runKey: 'wall' }, 'p:wall'), [{ key: 'p:numbers', id: 'numbers' }]);
});

/* ── (3) what is seen while dragging is what the save brings ─────────────────────────────────────────────────── */

/** A small seeded generator — the same rows on every run. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('(3) the gap: the scenes change places in the slots scenes take, nothing overlaps, the page ends where it ended', () => {
  const rnd = seeded(20261011);
  let cases = 0;
  for (let round = 0; round < 400; round++) {
    const n = 2 + Math.floor(rnd() * 5);
    /* Rows of any height, with room between some of them (a fixed part standing between two scenes). */
    const rowsNow: SceneRow[] = [];
    let y = Math.floor(rnd() * 300);
    for (let i = 0; i < n; i++) {
      const height = 40 + Math.floor(rnd() * 400);
      rowsNow.push({ top: y, height });
      y += height + (rnd() < 0.35 ? Math.floor(rnd() * 260) : 0);
    }
    const names = rowsNow.map((_, i) => `s${i}`);
    for (let at = 0; at < n; at++) {
      for (let slot = 0; slot < n; slot++) {
        cases += 1;
        const now = sceneReflow(rowsNow, at, slot);
        const order = sceneOrderAfter(names, at, slot).map((k) => names.indexOf(k));
        /* In the order the drop makes, each row starts where the one before it — and whatever stood between them —
           ends: no two overlap, and the room between two slots is the room that was there. */
        for (let j = 1; j < n; j++) {
          const before = order[j - 1]!;
          const here = order[j]!;
          const room = rowsNow[j]!.top - (rowsNow[j - 1]!.top + rowsNow[j - 1]!.height);
          assert.equal(now.tops[here]! - (now.tops[before]! + rowsNow[before]!.height), room, `round ${round}: ${at}→${slot}: the room between slot ${j - 1} and ${j} changed`);
        }
        /* The first slot stays where it was, and the page ends where it ended (the same scenes, re-ordered). */
        assert.equal(now.tops[order[0]!], rowsNow[0]!.top);
        const last = order[n - 1]!;
        assert.equal(now.tops[last]! + rowsNow[last]!.height, rowsNow[n - 1]!.top + rowsNow[n - 1]!.height, `round ${round}: ${at}→${slot}: the page grew or shrank`);
        /* The gap is the held scene's own place and size. */
        assert.deepEqual(now.gap, { top: now.tops[at], height: rowsNow[at]!.height });
        /* What stands just before a slot moved exactly as far as that slot did. */
        for (let j = 0; j < n; j++) assert.equal(now.between[j], now.tops[order[j]!]! - rowsNow[j]!.top);
        /* Let go where it was: nothing moves at all. */
        if (slot === at) assert.deepEqual(now.tops, rowsNow.map((r) => r.top));
        /* THE FINGER IN THE MIDDLE OF THE GAP KEEPS THE GAP (no flicker between two places)… */
        assert.equal(sceneDropSlot(rowsNow, at, slot, now.gap.top + now.gap.height / 2), slot, `round ${round}: ${at}→${slot}: the gap jumps under a still finger`);
      }
      /* …above everything it is first, below everything last, and going down the page it never goes back up. */
      assert.equal(sceneDropSlot(rowsNow, at, at, rowsNow[0]!.top - 500), 0);
      assert.equal(sceneDropSlot(rowsNow, at, at, y + 500), n - 1);
      let was = 0;
      for (let fy = rowsNow[0]!.top - 20; fy < y + 20; fy += 17) {
        const s = sceneDropSlot(rowsNow, at, at, fy);
        assert.ok(s >= was, `round ${round}: held ${at}: the gap went back up as the finger went down`);
        was = s;
      }
    }
  }
  assert.ok(cases > 4000, `anti-vacuity: ${cases} drops`);
  /* The drop, named for the order write: where it was → nothing; else the neighbour and the side. */
  assert.equal(sceneDropTarget(['a', 'b', 'c'], 1, 1), null);
  assert.deepEqual(sceneDropTarget(['a', 'b', 'c'], 0, 1), { target: 'c', where: 'above' });
  assert.deepEqual(sceneDropTarget(['a', 'b', 'c'], 0, 2), { target: 'c', where: 'below' });
  assert.deepEqual(sceneDropTarget(['a', 'b', 'c'], 2, 0), { target: 'a', where: 'above' });
  assert.equal(sceneDropTarget(['a'], 0, 0), null, 'the only scene of its kind has nowhere to land');
});

/* ── (4) one drop = one save = one undo step; the page arranged is the page the guest gets ────────────────────── */

/** What Apply writes: each stage place, onto the live row — as the Apply action does (`hub-draft-actions.ts`). */
function publish(published: InvitationWidgetRow[], draft: HubDraft): InvitationWidgetRow[] {
  const plan = planHubDraftApply(draft, { events: {}, widgets: published }, false);
  assert.equal(plan.refused.length, 0, 'arranging a page is never Event Hub Pro');
  const items = plan.apply.filter((i): i is Extract<typeof i, { kind: 'widget' }> => i.kind === 'widget');
  assert.ok(items.length > 0, 'Apply would write nothing for a drop');
  for (const i of items) assert.equal(i.field, 'stage_order', `a drop wrote ${i.field}`);
  return published.map((r) => {
    const it = items.find((i) => i.widgetId === r.widget_id);
    return it ? { ...r, config_json: { ...(r.config_json as object), [STAGE_ORDER_KEY]: it.value } } : r;
  });
}

test('(4) from the drop to the guest’s page: every stage, every scene, every place — one save, one ↺, the same order', () => {
  /* THE OWNER'S EVENT: a hide already PUBLISHED under the draft (the Venue off the Invitation) — every lab walk
     before 2026-10-11 had nothing published, and that is where the faults were. */
  const PUBLISHED = rows({ venue_map: { stage_show: { rsvp: false } } });
  let drops = 0;
  let still = 0;
  for (const stage of STAGES) {
    const before = listOf(PUBLISHED, stage);
    for (const held of scenesOf(before.shown)) {
      const among = sceneMovesAmong(stage, before.shown, { kind: 'scene', type: held.type }, held.key);
      for (let slot = 0; slot <= among.length; slot++) {
        const drop = dropOnPage(PUBLISHED, stage, held, slot);
        const where = `${stage}: ${held.type} → place ${slot}`;
        if (!drop) {
          still += 1;
          continue;
        }
        drops += 1;
        /* ONE SAVE — the stage's own order, under the stage's own key, and nothing else. */
        const widgets = (drop.patch as { widgets: Record<string, Record<string, unknown>> }).widgets;
        for (const [type, w] of Object.entries(widgets)) {
          assert.deepEqual(Object.keys(w), ['stage_order'], `${where}: ${type} was written more than its place`);
          assert.deepEqual(Object.keys(w.stage_order as object), [stage], `${where}: ${type}'s place on another stage was written`);
        }
        /* ONE UNDO STEP — and ↺ takes the whole move back in one press. */
        const draft = mergeHubDraft(emptyHubDraft(), drop.patch);
        assert.equal(draft.history.length, 1, `${where}: one drop pushed ${draft.history.length} Undo steps`);
        assert.deepEqual(undoHubDraft(draft), emptyHubDraft(), `${where}: one ↺ did not take the whole move back`);
        /* THE CANVAS'S REDRAW AGREES with where the scene was put (no snap-back): the Maker's own list, drawn from
           the draft, has the scenes in the order the gap showed. */
        const after = listOf(overlayHubDraftWidgets(PUBLISHED, draft), stage);
        const drawn = after.shown.filter((t) => drop.names.includes(t.key as string)).map((t) => t.key as string);
        assert.deepEqual(drawn, drop.expected, `${where}: the page the save brings is not the page that was arranged`);
        /* …and nothing else on the page moved: every other part is where it was, in the slots it had. */
        const others = (l: typeof before) => l.shown.map((t) => (drop.names.includes(t.key as string) ? '·' : t.key));
        assert.deepEqual(others(after), others(before), `${where}: a part that was not held changed places`);
        /* THE GUEST GETS IT — after ✓ Apply the guest page's own ordered scene list has that order… */
        const live = publish(PUBLISHED, draft);
        const guest = guestSees(live, stage);
        const expectedTypes = drop.expected.map((k) => k.slice(2));
        assert.deepEqual(guest.filter((t) => expectedTypes.includes(t)), expectedTypes, `${where}: guests do not get the page the couple arranged`);
        /* …exactly the scenes they got before (a drop adds and removes nothing)… */
        assert.deepEqual([...guest].sort(), [...guestSees(PUBLISHED, stage)].sort(), `${where}: a drop changed WHICH scenes guests see`);
        /* …until then guests still have the published page… */
        assert.deepEqual(guestSees(PUBLISHED, stage), guestSees(rows({ venue_map: { stage_show: { rsvp: false } } }), stage));
        /* …and no OTHER stage's page changed, for the couple or for guests. */
        for (const other of STAGES) {
          if (other === stage) continue;
          assert.deepEqual(guestSees(live, other), guestSees(PUBLISHED, other), `${where}: the drop moved ${other}`);
          assert.deepEqual(listOf(overlayHubDraftWidgets(PUBLISHED, draft), other).shown.map((t) => t.key), listOf(PUBLISHED, other).shown.map((t) => t.key), `${where}: the drop moved the Maker's ${other}`);
        }
        /* A SECOND drop is a second step, and each ↺ takes exactly one back. */
        const again = dropOnPage(overlayHubDraftWidgets(PUBLISHED, draft), stage, held, slot === 0 ? among.length : 0);
        if (again) {
          const two = mergeHubDraft(draft, again.patch);
          assert.equal(two.history.length, 2);
          assert.deepEqual(undoHubDraft(two), draft, `${where}: ↺ after a second drop did not return to the first`);
        }
      }
    }
  }
  assert.ok(drops >= 30 && still >= 10, `anti-vacuity: ${drops} drops that change the page, ${still} let go where they were`);
});

test('(4) the hook writes a drop through the shipped reducers only — and the drag has no door of its own to the draft', () => {
  const sheet = src(`${L}/add-part-sheet.tsx`);
  const drop = sheet.slice(sheet.indexOf('const dropOn = '), sheet.indexOf('const neighbour = '));
  assert.ok(drop.length > 400, 'anti-vacuity: the landing was not found');
  assert.match(drop, /const delta = makerDropDelta\(\{ fullOrder: o\.fullOrder, shown, afterLastShown: o\.afterLastShown, id: m\.id, target: t\.id, where \}\);\s*if \(delta === 0\) return null;\s*o\.move\(m\.id, delta\);\s*return landed\('move'\);/);
  /* The work area's `move` is `movedOrder` → `stageOrderPatch` → ONE `makerSave` (what the test above executes). */
  const shell = src('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  const move = shell.slice(shell.indexOf('const move = (id: string, delta: number)'), shell.indexOf('const addHere = '));
  assert.match(move, /const order = movedOrder\(fullOrder, id, delta\);\s*const patch = order && elementEditing \? stageOrderPatch\(order, \(x\) => sceneById\.get\(x\)\?\.type, stage\) : null;/);
  assert.equal((move.match(/makerSave\(/g) ?? []).length, 1, 'a move is more than one save');
  /* The drag's two files reach the draft through nothing but what they are handed. */
  for (const file of [`${L}/scene-drag.tsx`, `${L}/scene-canvas-drag.ts`, 'lib/maker-scene-drag.ts']) {
    assert.doesNotMatch(src(file), /makerSave\(|draftAction|hubDraftAction|FormData|fetch\(|supabase|['"]use server['"]/, `${file} writes`);
  }
  /* The bin is today's Remove for that part: the eye (the same patch, the same Undo step) — or its Post Event switch. */
  const take = sheet.slice(sheet.indexOf('const takeOff = '), sheet.indexOf('const pickAfter = '));
  assert.match(take, /const done = heldSaveWatch\(\);\s*o\.eye\(m\.id\);/);
  assert.match(take, /saveEditorial\(postEventShow\(o\.postEvent, m\.switchKey as Parameters<typeof postEventShow>\[1\], false\), null, at\.canvas \?\? undefined\)/);
  assert.equal((take.match(/o\.eye\(/g) ?? []).length, 1);
});

/* ── (5) the busy rule ───────────────────────────────────────────────────────────────────────────────────────── */

test('(5) no second lift while a drop is on its way; a held save is done only once it has answered', () => {
  assert.equal(sceneLiftAllowed({ working: false, away: false, sheetOpen: false }), 'lift');
  /* A press still on its way to the page: the scene stays put and the line says the page is catching up. */
  assert.equal(sceneLiftAllowed({ working: true, away: false, sheetOpen: false }), 'busy');
  /* A sheet open, the page playing / typed on / previewed: the press is not the drag's at all. */
  assert.equal(sceneLiftAllowed({ working: false, away: false, sheetOpen: true }), 'no');
  assert.equal(sceneLiftAllowed({ working: false, away: true, sheetOpen: false }), 'no');
  assert.equal(sceneLiftAllowed({ working: true, away: true, sheetOpen: true }), 'no');
  /* The Maker's side counts both: the hook's own press, and a save the line is still waiting for. */
  const side = src(`${L}/scene-drag.tsx`);
  assert.match(side, /verdict: \(\) => sceneLiftAllowed\(\{ working: now\.current\.working \|\| saving\.current, away: !now\.current\.on, sheetOpen: now\.current\.sheetOpen \}\),/);
  /* The hands ask before every lift — and a document whose order is still held by a drop takes no second one. */
  const hands = src(`${L}/scene-canvas-drag.ts`);
  assert.match(hands, /const verdict = slid \? 'busy' : host\.verdict\(\);\s*if \(verdict === 'no'\) return;\s*if \(!subject\.movable\) return refuse\(subject, 'fixed'\);\s*if \(verdict === 'busy'\) return refuse\(subject, 'busy'\);/);
  /* A held save (the eye — no reload follows): not done before it began, not done while it flies. */
  assert.equal(sceneHeldSaveDone(4, { started: 4, inFlight: 0 }), false, 'done before the save even began');
  assert.equal(sceneHeldSaveDone(4, { started: 5, inFlight: 1 }), false, 'done while the save is in flight');
  assert.equal(sceneHeldSaveDone(4, { started: 5, inFlight: 0 }), true);
});

/* ── (6) the bin, the edges, the page's place ────────────────────────────────────────────────────────────────── */

test('(6) the bin’s reach, the page that scrolls by itself, and the room the page keeps', () => {
  const bin = { left: 150, right: 214, top: 600, bottom: 664 };
  assert.equal(sceneOverBin(182, 632, bin), true);
  /* 26 px around it still counts (a thumb is not a pointer); 27 does not. */
  assert.equal(sceneOverBin(150 - 25, 632, bin), true);
  assert.equal(sceneOverBin(150 - 27, 632, bin), false);
  assert.equal(sceneOverBin(182, 600 - 25, bin), true);
  assert.equal(sceneOverBin(182, 664 + 27, bin), false);
  assert.equal(sceneOverBin(182, 632, null), false, 'no bin up, nothing to drop on');
  /* The page (top 0, bottom 700): still in the middle; up near the top, down near the bottom — faster the nearer,
     never faster than 14 a frame. */
  assert.equal(sceneEdgeScroll(350, 0, 700, false), 0);
  assert.ok(sceneEdgeScroll(50, 0, 700, false) < 0 && sceneEdgeScroll(10, 0, 700, false) < sceneEdgeScroll(50, 0, 700, false));
  assert.ok(sceneEdgeScroll(650, 0, 700, false) > 0 && sceneEdgeScroll(690, 0, 700, false) > sceneEdgeScroll(650, 0, 700, false));
  for (let y = -300; y < 1000; y += 7) assert.ok(Math.abs(sceneEdgeScroll(y, 0, 700, false)) <= SCENE_EDGE_MAX_STEP);
  /* The bin stands in the bottom band: a finger on it never scrolls the page away from under it. */
  assert.equal(sceneEdgeScroll(680, 0, 700, true), 0);
  /* Past the page's foot (over the guests' bar): no scroll. */
  assert.equal(sceneEdgeScroll(720, 0, 700, false), 0);
  /* The room given to the page while it is taller goes only when taking it leaves the page where it is. */
  assert.equal(scenePadDone(400, 2000 + 300, 700, 300), true);
  assert.equal(scenePadDone(1300, 2000 + 300, 700, 300), true, 'at its old end exactly');
  assert.equal(scenePadDone(1301, 2000 + 300, 700, 300), false, 'taking the room would pull the page');
  /* 🗑 THE BIN COUNTS ONLY ONCE IT IS UP: it comes up from where the lower third's top edge was — where a thumb takes
     hold of the last scene on the screen. Read before it arrived, a scene lifted there was on the bin at once. */
  const binSide = src(`${L}/scene-drag.tsx`);
  assert.match(binSide, /binBox: \(\): SceneBox \| null => \{\s*if \(Date\.now\(\) - liftedAt\.current < SCENE_COLLAPSE_MS\) return null;/);
  assert.match(binSide, /setHeld\(true\);\s*liftedAt\.current = Date\.now\(\);/);
  /* …and where the finger is, is read every frame — not only when it moves. */
  assert.match(src(`${L}/scene-canvas-drag.ts`), /if \(v\) win\.scrollBy\(0, v\);\s*place\(\);\s*raf = win\.requestAnimationFrame\(loop\);/);
  /* …and it is taken only after the panel is back (never while the page is still taller on screen). */
  const side = src(`${L}/scene-drag.tsx`);
  assert.match(side, /doc\.body\.style\.paddingBottom = `\$\{had \+ extra\}px`;[\s\S]{0,200}?setHeld\(true\);/, 'the room is not given BEFORE the page grows');
  assert.match(side, /const timer = win\.setTimeout\(\(\) => \{\s*if \(!take\(\)\) win\.addEventListener\('scroll', onScroll, \{ passive: true \}\);\s*\}, SCENE_COLLAPSE_MS \+ 80\);/);
});

/* ── (7) the wiring ──────────────────────────────────────────────────────────────────────────────────────────── */

test('(7) a swipe still scrolls: the pan is blocked only once the hold has fired; no callout, no selection under a hold', () => {
  const hands = src(`${L}/scene-canvas-drag.ts`);
  /* The one place the page's own scroll is refused — and only while a scene is HELD. */
  assert.match(hands, /const onTouchMove = \(e: TouchEvent\) => \{\s*if \(held\) e\.preventDefault\(\);\s*\};/);
  assert.equal((hands.match(/addEventListener\('touchmove'/g) ?? []).length, 1);
  /* On the document from the start and never passive: a browser decides at touchstart whether its scroll may be blocked. */
  assert.match(hands, /doc\.addEventListener\('touchmove', onTouchMove, \{ passive: false \}\);/);
  /* No `touch-action: none` at rest — that would stop every swipe on a scene. */
  assert.doesNotMatch(hands, /touch-action|touchAction/, 'the page’s own pan is switched off');
  /* Before the hold ends a move is a scroll: the hold is cancelled and nothing is prevented. */
  const move = hands.slice(hands.indexOf('const onMove = '), hands.indexOf('const onUp = '));
  assert.match(move, /if \(p\.touch\) \{\s*if \(moved > SCENE_SCROLL_PX\) stopPending\(\);\s*else \{\s*p\.lx = e\.clientX;\s*p\.ly = e\.clientY;\s*\}\s*return;\s*\}/);
  assert.ok(move.indexOf('return;') < move.indexOf('e.preventDefault()'), 'a finger’s move is prevented before the hold has fired');
  /* A long press raises no browser menu and selects nothing; a field being typed in keeps its selection. */
  assert.match(hands, /const onMenu = \(e: Event\) => \{\s*if \(pending\?\.touch \|\| held\) e\.preventDefault\(\);\s*\};/);
  assert.match(hands, /@media \(hover:none\) and \(pointer:coarse\)\{\[data-maker-section\]\+\*,\[data-maker-reveal-part\]\{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none\}/);
  assert.match(hands, /:is\(input,textarea,\[contenteditable=""\],\[contenteditable="true"\]\)\{-webkit-user-select:text;user-select:text\}/);
  /* A mouse lifts on its first real move — no hold. */
  assert.match(hands, /if \(touch\) pending\.timer = win\.setTimeout\(/);
});

test('(7) a refused save slides the scene back BEFORE the line speaks; nothing is said that the page does not show', () => {
  const side = src(`${L}/scene-drag.tsx`);
  const run = side.slice(side.indexOf('const run = useCallback('), side.indexOf('useEffect(() => {\n    const onUndo'));
  assert.ok(run.length > 300, 'anti-vacuity: the line’s rule was not found');
  assert.match(run, /if \(how === 'failed'\) \{\s*revert\?\.\(\);\s*last\.current = null;\s*return say\(SCENE_DRAG_WORDS\.failed, true\);\s*\}/);
  assert.match(run, /put\(\{ kind: 'saving' \}\);/);
  /* A page that never came: nothing is claimed. */
  assert.match(run, /if \(how === 'timeout'\) return put\(null\);/);
  /* The drop hands the slide-back; a move that had nothing to write is slid back at once. */
  /* The toolbar starts back at the RELEASE — while the scene settles, as the prototype's does — not after it. */
  assert.match(src(`${L}/scene-canvas-drag.ts`), /swallowTap\(\);\s*host\.onRelease\(\);/);
  assert.match(side, /onRelease: \(\) => \{[\s\S]{0,1400}?setHeld\(false\);\s*setOver\(false\);\s*\},\s*onDrop: /);
  assert.match(side, /const done = now\.current\.drop\(subject, drop\.target, drop\.where\);\s*if \(!done\) return drop\.revert\(\);\s*return run\(step\('move'\), done, drop\.revert\);/);
  /* The hands: the dropped order is held by slides until the page is redrawn; `revert` takes them off. */
  const hands = src(`${L}/scene-canvas-drag.ts`);
  assert.match(hands, /unlook\(h, true\);\s*slid = true;/);
  assert.match(hands, /const revert = \(\) => \{\s*if \(!slid\) return;\s*slid = false;\s*back\(h, true\);/);
  /* Nothing is moved in the page's own tree — the scene is slid, never re-parented (the page is React's). */
  assert.doesNotMatch(hands.replace(/doc\.body\.appendChild\((?:gap|tag)\)|doc\.head\.appendChild\(style\)/g, ''), /appendChild|insertBefore|\.before\(|\.after\(|replaceWith|\.append\(/, 'the drag re-parents part of the page');
});

test('(7) a scene of the couple’s own is never taken silently; ↺ is the Maker’s own Undo; the frame steps aside', () => {
  const sheet = src(`${L}/add-part-sheet.tsx`);
  const take = sheet.slice(sheet.indexOf('const takeOff = '), sheet.indexOf('const pickAfter = '));
  /* Its "Delete this scene?" sheet opens — before anything is written. */
  assert.match(take, /if \(m\.kind === 'scene' && m\.own\) \{\s*setRemoving\(at\);\s*return 'asking';\s*\}/);
  assert.ok(take.indexOf("return 'asking';") < take.indexOf('o.eye('), 'a scene of their own reaches the eye before the question');
  assert.match(sheet, /\{removing && removing\.mv\.kind === 'scene' \? \(\s*<RemovePartSheet label=\{removing\.label\}/);
  const side = src(`${L}/scene-drag.tsx`);
  /* …and on the page it is put back where it was while they decide. */
  assert.match(side, /if \(!done \|\| done === 'asking'\) return drop\.restore\(\);/);
  /* ↺: the line's Undo PRESSES the Maker's own button — never a second door to the draft — from inside its own press. */
  assert.match(side, /const UNDO_BUTTON = SCENE_UNDO_BUTTON;/);
  assert.match(side, /const button = document\.querySelector<HTMLButtonElement>\(UNDO_BUTTON\);[\s\S]{0,600}?button\.click\(\);\s*\};\s*press\(\);\s*\};/);
  assert.match(side, /const button = \(e\.target as Element \| null\)\?\.closest\?\.\(UNDO_BUTTON\)/);
  assert.equal((side.match(/aria-label/g) ?? []).length, 0, 'the drag names a button by its aria-label');
  assert.match(raw('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx'), /label="Undo"[\s\S]{0,400}?onClick=\{\(\) => act\(\{ intent: 'undo' \}\)\}/, 'anti-vacuity: the Maker’s Undo is no longer that button');
  assert.match(raw('app/dashboard/[eventId]/website/_components/hub-draft-button.tsx'), /aria-label=\{said\}[\s\S]{0,200}?data-bar-item=\{phone \? label : undefined\}/, 'anti-vacuity: the button no longer names itself');
  /* What it says of an undo is only said of the step made HERE (no other save since), once the page shows it. */
  assert.match(side, /if \(step\.saves !== makerSavesStarted\(\)\) return;/);
  assert.match(side, /void whenCanvasShowsIt\(\)\.then\(\(how\) => \{\s*if \(how !== 'shown'\) return;\s*say\(step\.type === 'remove' \? SCENE_DRAG_WORDS\.back\(step\.label\) : SCENE_DRAG_WORDS\.moveUndone\);/);
  /* A HELD SCENE IS PICKED AS A TAP PICKS — the page's own tap, so the Maker hears exactly what a finger's tap tells
     it and moves the page for no pick the page itself made; and it is picked WHERE IT IS (`stageStill`): the page is
     never brought to the picked part's middle under the finger that holds it, nor after the drop. */
  assert.match(sheet, /const tapPart = \(box: Element, key: string \| null, still: boolean\) => \{[\s\S]{0,160}?if \(still\) stageStill\.key = key;\s*box\.dispatchEvent\(new view\.MouseEvent\('click', \{ bubbles: true, cancelable: true, view \}\)\);/);
  assert.match(sheet, /if \(s\.key === canvas\) return;\s*tapPart\(s\.el, s\.key, true\);/);
  /* A part that keeps its place is tapped where the finger is, and named as that tap names it (the cover is several
     parts) — so the line says "Names keeps its place…" of the names, as the prototype does. */
  assert.match(sheet, /if \(!s\.movable\) return tapPart\(s\.target\.isConnected && s\.el\.contains\(s\.target\) \? s\.target : s\.el, null, false\);/);
  /* After a scene leaves by the bin, the next scene is picked the same still way — the page stays where it is. */
  assert.match(sheet, /if \(next && box\) tapPart\(box, next\.key, true\);\s*else onRemoved\?\.\(\);/);
  /* The tap the Maker makes is not the finger's: only the finger's own is swallowed after a drop. */
  assert.match(src(`${L}/scene-canvas-drag.ts`), /const eat = \(e: Event\) => \{\s*if \(!e\.isTrusted\) return;/);
  assert.match(sheet, /makerPartOfTap\(stage, shownPageOf\(stage\)\?\.key \?\? null, key, piece\) \?\? makerPartOfCanvas\(stage, key\)/);
  assert.match(src(`${L}/stage-tools.tsx`), /if \(!open \|\| !pickedKey\) return;\s*if \(stageStill\.key === pickedKey\) return;\s*stageStill\.key = null;/);
  /* The hands tell the host BEFORE the tap a held part leaves behind is swallowed (the pick is a tap of its own). */
  assert.match(src(`${L}/scene-canvas-drag.ts`), /host\.onRefuse\(subject, why\);\s*swallowTap\(\);/);
  /* While a scene is held the Maker's frame steps aside (the lifted scene wears its own ring and the SAME name tag). */
  assert.match(sheet, /const framed = edges && !drag\.held;/);
  const tag = /const PART_TAG = `([^`]+)`;/.exec(raw(`${L}/add-part-sheet.tsx`))?.[1]?.replace('${PART_ACCENT}', 'bg-sn-accent text-sn-on-accent');
  const face = /export const SCENE_TAG_FACE = '([^']+)';/.exec(raw(`${L}/scene-canvas-drag.ts`))?.[1];
  assert.ok(tag && face, 'anti-vacuity: the two tags were not found');
  assert.equal(face, tag, 'the lifted scene’s name tag is not the picked part’s');
});

test('(7) the line’s Undo is never mistaken for the Maker’s own ↺ — one press, one step back, “<Scene> is back”', async () => {
  /* THE FAULT (walked 2026-10-11, "the line clears, nothing comes back"): ↺ was found by `aria-label="Undo"` too —
     and the line's own Undo is an ActionButton, whose aria-label is its word. Its own press was heard as ↺: the step
     was forgotten and the line cleared before the draft was asked for anything, so nothing was ever said to be back.
     The selector now names what ONLY the top bar's button carries; held here on the buttons as they are drawn. */
  assert.equal(SCENE_UNDO_BUTTON, '[data-maker-shell] [data-maker-draft-actions] button[data-bar-item="Undo"]');
  assert.ok(!SCENE_UNDO_BUTTON.includes(','), 'the Maker’s Undo has a second spelling');
  const need = [...SCENE_UNDO_BUTTON.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/g)].map((m) => ({ attr: m[1]!, value: m[2] ?? null }));
  const onButton = need.filter((n) => SCENE_UNDO_BUTTON.includes(`button[${n.attr}`));
  assert.deepEqual(onButton, [{ attr: 'data-bar-item', value: 'Undo' }], 'the button is named by something other than its bar item');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const React = (await import('react')).default;
  /* (a component file's JSX asks for `React` by name under a bare `tsx --test` run) */
  (globalThis as unknown as { React: unknown }).React = React;
  const { ActionButton } = await import('../components/action-button');
  const { Undo2 } = await import('lucide-react');
  /* The line's button, as `scene-drag.tsx` draws it. */
  const side = src(`${L}/scene-drag.tsx`);
  assert.match(side, /<span className="contents" data-scene-undo="">\s*<ActionButton tone="neutral" icon=\{Undo2\} label=\{SCENE_DRAG_WORDS\.undo\} onClick=\{pressUndo\}/);
  const lineButton = renderToStaticMarkup(React.createElement(ActionButton, { tone: 'neutral', icon: Undo2, label: SCENE_DRAG_WORDS.undo, onClick: () => {} }));
  const tagOf = (html: string) => /^<button\b[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(tagOf(lineButton), /aria-label="Undo"/, 'anti-vacuity: the line’s Undo no longer shares the word — by its label it WOULD be taken for ↺');
  for (const n of onButton) assert.ok(!tagOf(lineButton).includes(`${n.attr}=`), `the line’s own Undo carries ${n.attr} — it is the Maker’s ↺ to this selector`);
  /* …and the Maker's own is the one that does: named so by `DraftButton`, inside the draft bar's own actions. */
  const { DraftButton } = await import('../app/dashboard/[eventId]/website/_components/hub-draft-button');
  const top = renderToStaticMarkup(
    React.createElement(DraftButton, { label: 'Undo', icon: null, bar: 'icon', phone: { width: 'w-11' }, disabled: false, disabledReason: '', onClick: () => {} }),
  );
  assert.match(/<button\b[^>]*>/.exec(top)?.[0] ?? '', /data-bar-item="Undo"/, 'the Maker’s own Undo no longer names itself');
  const bar = raw('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  const actions = bar.slice(bar.indexOf('data-maker-draft-actions=""'));
  assert.ok(bar.includes('data-maker-draft-actions=""') && /<DraftButton\s+label="Undo"/.test(actions), 'the Maker’s Undo is not drawn inside the draft bar’s own actions');
  /* Pressed, the Maker's ↺ is heard ONCE by the listener that says what came back — for the step made here only. */
  assert.match(side, /if \(!button \|\| button\.disabled \|\| !step\) return;\s*last\.current = null;/);
  assert.match(side, /say\(step\.type === 'remove' \? SCENE_DRAG_WORDS\.back\(step\.label\) : SCENE_DRAG_WORDS\.moveUndone\);/);
});

test('(7) the lower third slides away while a scene is held and back on release — both motions seen; a fade under Reduce Motion', () => {
  const tools = raw(`${L}/stage-tools.tsx`);
  /* Told to be nothing tall while it is held — the same door as ▶ and typing. */
  assert.match(tools, /if \(playing \|\| typing \|\| previewing \|\| held\) \{\s*onPx\(0\);/);
  /* 'away' while held, 'back' for the length of the return: the rule below needs a name for BOTH motions. */
  assert.match(tools, /setSlide\('back'\);\s*const id = window\.setTimeout\(\(\) => setSlide\(null\), SCENE_COLLAPSE_MS \+ 40\);/);
  assert.match(tools, /data-scene-slide=\{slide \?\? undefined\}/);
  /* The height goes and comes back over the prototype's one duration and ease — never a jump. */
  assert.match(tools, /`\[data-maker-lower-third\]:has\(>\[data-stage-tools\]\[data-scene-slide\]\)\{transition:height \$\{SCENE_COLLAPSE_MS\}ms \$\{SCENE_COLLAPSE_EASE\}!important\}`/);
  /* What stands on it travels with it. */
  assert.match(tools, /\[data-stage-guest-bar\]\{transition:bottom \$\{SCENE_COLLAPSE_MS\}ms \$\{SCENE_COLLAPSE_EASE\}!important\}/);
  assert.match(tools, /\[data-phone-chrome="panel"\]\{transition:transform \$\{SCENE_COLLAPSE_MS\}ms \$\{SCENE_COLLAPSE_EASE\}!important\}/);
  /* The other tabs dim while one is lifted — a scene stays on its page. */
  assert.match(tools, /\[data-scene-slide="away"\]\) \[data-stage-guest-tab\]:not\(\[aria-current="page"\]\)\{opacity:\.35\}/);
  /* 🕊 Reduce Motion: a short fade, and the room is given up only after it. */
  const calm = tools.slice(tools.indexOf('@media (prefers-reduced-motion:reduce)'));
  assert.match(calm, /`\[data-stage-tools\]\{transition:opacity \$\{SCENE_COLLAPSE_CALM_MS\}ms linear!important\}\[data-stage-tools\]\[data-scene-slide="away"\]\{opacity:0\}`/);
  assert.match(calm, /\[data-scene-slide="away"\]\)\{transition:height 0s linear \$\{SCENE_COLLAPSE_CALM_MS\}ms!important\}/);
  /* The bin comes and goes with the same motion, in the thumb zone. */
  const side = raw(`${L}/scene-drag.tsx`);
  assert.match(side, /bottom: 'calc\(var\(--maker-lt-h\) \+ env\(safe-area-inset-bottom\) \+ var\(--scene-bin-over, 30px\)\)'/);
  assert.match(side, /transition: `transform \$\{SCENE_COLLAPSE_MS\}ms \$\{SCENE_COLLAPSE_EASE\}, opacity /);
});

test('(7) the drag rides no first load and no guest’s page: it is reached only through the lazy Stages panel', () => {
  const DRAG = ['scene-drag', 'scene-canvas-drag', 'maker-scene-drag'];
  const importsDrag = new RegExp(`(?:from|import\\()\\s*['"][^'"]*/(?:${DRAG.join('|')})['"]`);
  /* Every source file of the app — who loads a file of the drag? */
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
    }
  };
  for (const root of ['app', 'lib', 'components']) if (existsSync(join(WEB, root))) walk(join(WEB, root));
  assert.ok(files.length > 2000, `anti-vacuity: only ${files.length} files walked`);
  const loaders = files.filter((f) => importsDrag.test(stripComments(readFileSync(f, 'utf8')))).map((f) => relative(WEB, f)).sort();
  assert.deepEqual(loaders, [`${L}/add-part-sheet.tsx`, `${L}/scene-canvas-drag.ts`, `${L}/scene-drag.tsx`, `${L}/stage-tools.tsx`], 'a file outside the lazy Stages panel loads the drag');
  /* …and those are reached only through the panel's own `import()` (`details-lazy.tsx`): the Maker's first load
     holds a stand-in, never the panel. */
  const loadsPanel = files.filter((f) => /(?:from|import\()\s*['"][^'"]*\/(?:stage-tools|add-part-sheet)['"]/.test(stripComments(readFileSync(f, 'utf8')))).map((f) => relative(WEB, f)).sort();
  assert.deepEqual(loadsPanel, [`${L}/details-lazy.tsx`, `${L}/stage-tools.tsx`]);
  assert.match(raw(`${L}/details-lazy.tsx`), /export const StageTools = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/stage-tools'\)\.then\(\(m\) => m\.StageTools\)/);
  /* The rules import no engine and nothing of the browser — they can be loaded anywhere, and are loaded only here. */
  assert.deepEqual([...src('lib/maker-scene-drag.ts').matchAll(/from '([^']+)'/g)].map((m) => m[1]).sort(), ['./maker-scene-list', './stage-scenes']);
  assert.doesNotMatch(src('lib/maker-scene-drag.ts'), /\b(?:window|document)\./);
  /* No guest-page file was touched to make this: the canvas is driven from the Maker (same origin). */
  for (const f of files.filter((p) => relative(WEB, p).startsWith('app/[slug]/'))) assert.doesNotMatch(readFileSync(f, 'utf8'), /scene-drag|data-scene-drag|attachSceneDrag/, `${relative(WEB, f)} knows the drag`);
});
