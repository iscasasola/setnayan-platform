import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, type HubDraft, type HubDraftPatch } from './hub-draft';
import { widgetInPhase, type InvitationWidgetRow, type WidgetType } from './invitation-widgets';
import { makerPartStepHeldWhy } from './maker-parts';
import { heldByEntourage, sceneFollowsEntourage, splitAroundEntourage, stagePlacesAfterMove, stageRowOrder, stepChangesThePage } from './stage-scenes';
import { stripComments } from './strip-comments';
import { sceneOnStage } from './what-guests-see';

/**
 * ↑ ↓ A STEP THE MAKER OFFERS ALWAYS CHANGES THE PAGE.
 *
 * Owner, 2026-10-11, on the preview, about Earlier · Later · Remove on his real event (Invitation › Details): "the
 * do not work" — and, asked whether the page changes if he waits: "no it is not showing".
 *
 * What production held: ONE move saved — `stage_order.rsvp` venue_map 6 → 7 and what_to_bring 7 → 6 — and the canvas
 * fetched again, four times. The page did not change because it could not: on the Invitation the page draws What to
 * bring AFTER the entourage whatever its place says (`splitAroundEntourage`, owner 2026-10-07), and every other scene
 * before it. Swapping What to bring with the Venue changes the stored order and draws the same page. The Maker
 * offered the step because it took its neighbours from the scenes the page draws, across the entourage.
 *
 * Held here with his two draft states exactly, and as a property over every pair of neighbours.
 */

const TYPES: Array<[WidgetType, boolean]> = [
  ['hero', true], ['greeting', true], ['qr_card', true], ['event_details', false], ['countdown', false], ['schedule', false], ['rsvp', true],
  ['venue_map', false], ['dress_code', false], ['photo_moments', false], ['your_photos', false], ['tier_comparison', false],
  ['special_message', false], ['what_to_bring', false], ['our_photos', false], ['our_love_story', false],
];
const rows = (config: Partial<Record<WidgetType, Record<string, unknown>>> = {}): InvitationWidgetRow[] =>
  TYPES.map(([type, alwaysOn], i) => ({
    widget_id: `w-${type}`, event_id: 'e', widget_type: type, display_order: i + 1, is_visible: true, is_always_on: alwaysOn, tier: 'basic',
    config_json: config[type] ?? {}, created_at: '', updated_at: '', mode: 'auto',
  })) as InvitationWidgetRow[];
const inStage = (t: string, s: Parameters<typeof widgetInPhase>[1]) => widgetInPhase(t as WidgetType, s);

/** PUBLISHED on his event: the Venue hidden on the Invitation. */
const PUBLISHED = rows({ venue_map: { stage_show: { rsvp: false } } });
const place = (order: Record<string, number>, extra: HubDraftPatch['widgets'] = {}): HubDraftPatch => ({
  widgets: { ...Object.fromEntries(Object.entries(order).map(([type, n]) => [type, { stage_order: { rsvp: n } }])), ...extra } as HubDraftPatch['widgets'],
});
/** HIS DRAFT BEFORE THE PRESS (10:38:34Z): the Dress code hidden in the draft; the Venue's published hide taken back. */
const BEFORE = (): HubDraft => {
  let d = mergeHubDraft(emptyHubDraft(), place({ special_message: 0, countdown: 1, our_love_story: 2, event_details: 3, schedule: 4, dress_code: 5, venue_map: 6, what_to_bring: 7 }));
  d = mergeHubDraft(d, { widgets: { dress_code: { stage_show: { rsvp: false } }, venue_map: { stage_show: { rsvp: null } } } } as HubDraftPatch);
  return d;
};
/** …AND AFTER IT (10:40:22Z): venue_map 7 · what_to_bring 6 — everything else the same. */
const AFTER = (): HubDraft => mergeHubDraft(BEFORE(), place({ special_message: 0, countdown: 1, our_love_story: 2, event_details: 3, schedule: 4, dress_code: 5, venue_map: 7, what_to_bring: 6 }));

/** The scenes the Invitation draws, in the order the PAGE draws them: the stage's order, split around the entourage. */
function drawn(published: InvitationWidgetRow[], draft: HubDraft | null): string[] {
  const now = overlayHubDraftWidgets(published, draft);
  const shown = stageRowOrder(now, 'rsvp', inStage).filter((r) => sceneOnStage({ widgets: now, stage: 'rsvp' }, r.widget_type as WidgetType)?.drawn);
  const around = splitAroundEntourage('rsvp', shown);
  return [...around.before.map((r) => r.widget_type), '— entourage —', ...around.after.map((r) => r.widget_type)];
}
const stored = (published: InvitationWidgetRow[], draft: HubDraft) => stageRowOrder(overlayHubDraftWidgets(published, draft), 'rsvp', inStage).map((r) => r.widget_type);

test('HIS PRESS: the move is saved, the draft’s order is applied — and the page it draws is the same page', () => {
  /* The draft IS applied on the canvas's path (`overlayHubDraftWidgets` → the stage's order): the stored order moved. */
  const a = stored(PUBLISHED, BEFORE());
  const b = stored(PUBLISHED, AFTER());
  assert.deepEqual(a.slice(-2), ['venue_map', 'what_to_bring']);
  assert.deepEqual(b.slice(-2), ['what_to_bring', 'venue_map'], 'the draft’s order is not read on the canvas’s path');
  /* What is drawn: the Venue (its published hide taken back by the draft’s null), not the Dress code (hidden in the draft). */
  const before = drawn(PUBLISHED, BEFORE());
  assert.ok(before.includes('venue_map') && !before.includes('dress_code'), JSON.stringify(before));
  /* THE CAUSE: What to bring is drawn after the entourage either way — the two pages are one page. */
  assert.deepEqual(drawn(PUBLISHED, AFTER()), before);
  assert.deepEqual(before.slice(-3), ['venue_map', '— entourage —', 'what_to_bring']);
});

test('THE RULE: that step is not offered — and it says why, by name', () => {
  assert.equal(sceneFollowsEntourage('rsvp', 'what_to_bring'), true);
  assert.equal(stepChangesThePage('rsvp', 'what_to_bring', 'venue_map'), false);
  assert.equal(stepChangesThePage('rsvp', 'venue_map', 'what_to_bring'), false);
  assert.equal(stepChangesThePage('rsvp', 'venue_map', 'schedule'), true);
  /* Only the Invitation draws a scene after its entourage: no other stage loses a step. */
  for (const stage of ['save_the_date', 'event', 'editorial', 'rsvp_screens']) {
    for (const [a] of TYPES) for (const [b] of TYPES) assert.equal(stepChangesThePage(stage, a, b), true, `${stage}: ${a} past ${b}`);
  }
  assert.equal(heldByEntourage('rsvp', 'what_to_bring', ['schedule', 'venue_map']), 'after');
  assert.equal(heldByEntourage('rsvp', 'venue_map', ['schedule', 'what_to_bring']), 'before');
  assert.equal(heldByEntourage('rsvp', 'venue_map', ['schedule']), null, 'nothing follows the entourage on this page: "already last" is true');
  assert.equal(heldByEntourage('rsvp', 'what_to_bring', []), null);
  assert.equal(makerPartStepHeldWhy('What to bring', 'after', 'Wedding March'), 'What to bring stays after the Wedding March.');
  assert.equal(makerPartStepHeldWhy('Venue', 'before', 'Wedding March'), 'Venue stays before the Wedding March.');
});

test('THE PROPERTY: every step the rule allows changes the drawn page; every step it refuses would not', () => {
  const STATES: Array<[string, InvitationWidgetRow[], HubDraft | null]> = [
    ['nothing drafted', rows(), null],
    ['his draft before the press', PUBLISHED, BEFORE()],
    ['his draft after it', PUBLISHED, AFTER()],
    ['a hidden part between the two', rows({ dress_code: { stage_show: { rsvp: false } } }), null],
    ['What to bring hidden', rows({ what_to_bring: { stage_show: { rsvp: false } } }), null],
  ];
  let allowed = 0;
  let refused = 0;
  for (const [name, published, draft] of STATES) {
    const now = overlayHubDraftWidgets(published, draft);
    const page = drawn(published, draft);
    const scenes = page.filter((t) => t !== '— entourage —');
    /* Each drawn scene, one step earlier and one later — past the neighbour the PAGE draws next to it (never the entourage). */
    for (const [i, type] of scenes.entries()) {
      for (const dir of [-1, 1] as const) {
        const past = scenes[i + dir];
        if (!past) continue;
        /* The Maker's move: the scene lands on the other side of that neighbour in the stage's whole order. */
        let order = stageRowOrder(now, 'rsvp', inStage);
        const at = () => order.findIndex((r) => r.widget_type === type);
        const target = () => order.findIndex((r) => r.widget_type === past);
        let guard = 0;
        while ((dir < 0 ? at() > target() : at() < target()) && guard++ < 20) {
          const next = stagePlacesAfterMove(order, order[at()]!.widget_id, dir < 0 ? 'up' : 'down');
          assert.ok(next, `${name}: ${type} could not step`);
          order = next.map((p) => p.row);
        }
        const patch = place(Object.fromEntries(order.map((r, n) => [r.widget_type, n])));
        const after = drawn(published, mergeHubDraft(draft ?? emptyHubDraft(), patch));
        const where = `${name}: ${type} ${dir < 0 ? 'earlier' : 'later'}, past ${past}`;
        if (stepChangesThePage('rsvp', type, past)) {
          assert.notDeepEqual(after, page, `an offered step shows nothing — ${where}`);
          allowed += 1;
        } else {
          assert.deepEqual(after, page, `a refused step WOULD have shown — ${where}`);
          refused += 1;
        }
      }
    }
  }
  assert.ok(allowed > 20 && refused >= 6, `anti-vacuity: ${allowed} allowed, ${refused} refused`);
});

test('the toolbar’s steps take their neighbours through the rule', () => {
  const sheet = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'add-part-sheet.tsx'), 'utf8'));
  const targets = sheet.slice(sheet.indexOf('const moveTargets = '), sheet.indexOf('const dropOn = '));
  /* 🔁 Re-aimed 2026-10-11 (the drag — DECISION_LOG "IN THE MAKER, A SCENE IS MOVED BY DRAGGING IT ON THE PAGE"): the
     rule moved out of this hook into the one list the DRAG reads too (`lib/maker-scene-drag.ts` `sceneMovesAmong`),
     so a step and a drop cannot disagree about where a scene may go. Read here; EXECUTED, over every stage and every
     pair, by `lib/a-scene-is-dragged-on-the-page.test.ts`. */
  assert.match(targets, /for \(const n of sceneMovesAmong\(stage, o\.list\.shown, heldOf\(at\.mv\), at\.canvas\)\) \{/);
  assert.doesNotMatch(targets, /o\.list\.shown\.(?:filter|map|forEach)|for \(const t of o\.list\.shown\)/, 'the targets are read off the list again, past the rule');
  const rule = stripComments(readFileSync(join(process.cwd(), 'lib', 'maker-scene-drag.ts'), 'utf8'));
  assert.match(rule, /if \(t\.kind !== 'scene' \|\| !stepChangesThePage\(stage, held\.type, t\.type\)\) continue;/);
  /* Move up · Move down (and a drag, which lands on the same targets) all read `moveTargets`. */
  assert.match(sheet, /const neighbour = [\s\S]{0,400}?const targets = moveTargets\(o\);/);
  assert.match(sheet, /const t = o \? moveTargets\(o, at\)\.find\(\(x\) => x\.key === target\) : null;/, 'a drop lands on something other than a step’s targets');
  /* The grey step says the entourage's own name — only where the page draws one. */
  assert.match(sheet, /const held = heldByEntourage\(stage, mv\.type, others\);/);
  assert.match(sheet, /const drawsIt = ops\.list\.shown\.some\(\(t\) => t\.kind === 'fixed' && t\.fixed === 'entourage'\);\s*if \(!held \|\| !drawsIt\) return \{\};\s*const words = makerPartStepHeldWhy\(label \|\| 'This part', held, makerPartLabelOn\(stage, 'march'\)\);/);
  assert.match(sheet, /\.\.\.makerPartStepWhy\(label \|\| 'This part', canMove, canRemove\), \.\.\.heldWhy\(\)/);
});
