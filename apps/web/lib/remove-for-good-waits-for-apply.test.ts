/**
 * 🗑 "REMOVE FOR GOOD" WAITS FOR APPLY — and ＋ a scene of their own lands
 * where it was asked (owner 2026-10-07, *"remove for good"*, the final fixes'
 * item 6 as its own step).
 *
 *   · In the Maker the delete is DRAFTED (`HubDraftWidget.removed`): the canvas
 *     and the navigator stop drawing the scene (`overlayHubDraftWidgets`), Undo
 *     brings it back, Apply deletes it through the one delete (`deleteOwnScene`);
 *     its slot stays taken until then (the slot is counted on LIVE rows).
 *   · ＋ "Add above / below <part>" → "A scene of your own" lands at that edge.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  classifyHubDraft,
  draftRemoves,
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftWidgets,
  sanitizeHubDraft,
  undoHubDraft,
  type HubLiveState,
} from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import type { InvitationWidgetRow } from './invitation-widgets';
import { deleteOwnScene } from './own-scene-delete';
import { NEW_SCENE_TOKEN, ownScenePlaceOrder, readOwnScenePlace } from './own-scene-place';
import { stageOrderPatch } from './maker-reorder';
import { addedSceneDraft } from './scene-writes';

const row = (id: string, type: string, order: number): InvitationWidgetRow =>
  ({
    widget_id: id, event_id: 'e', widget_type: type, display_order: order, is_visible: true, is_always_on: false,
    tier: 'basic', config_json: type.startsWith('custom_') ? { custom: { title: 'Our song', body: 'The first dance' } } : {},
    created_at: '', updated_at: '', mode: 'auto',
  }) as InvitationWidgetRow;
const ROWS = [row('w-sched', 'schedule', 1), row('w-c1', 'custom_1', 2), row('w-c2', 'custom_2', 3)];
const live: HubLiveState = { events: {}, widgets: ROWS };
const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

test('🔴 a drafted Remove for good hides the scene on the canvas and in the navigator — and only own scenes can be', () => {
  const d = mergeHubDraft(emptyHubDraft(), { widgets: { custom_1: { removed: true }, schedule: { removed: true } } as never });
  assert.equal(d.widgets.custom_1?.removed, true);
  assert.equal(d.widgets.schedule, undefined, 'a SHIPPED section can be drafted away');
  const drawn = overlayHubDraftWidgets(ROWS, d).map((r) => r.widget_type);
  assert.deepEqual(drawn, ['schedule', 'custom_2'], 'the drafted-removed scene is still drawn');
  assert.ok(draftRemoves(d, 'custom_1'));
  assert.deepEqual(sanitizeHubDraft(JSON.parse(JSON.stringify(d))).widgets.custom_1, { removed: true }, 'the stored draft forgot it');
});

test('🔴 Undo brings the scene back', () => {
  const d = mergeHubDraft(emptyHubDraft(), { widgets: { custom_1: { removed: true } } as never });
  const back = undoHubDraft(d);
  assert.deepEqual(overlayHubDraftWidgets(ROWS, back).map((r) => r.widget_type), ['schedule', 'custom_1', 'custom_2']);
});

test('🔴 Apply has ONE item for it — the delete, free, nothing else written to the row', () => {
  const d = mergeHubDraft(emptyHubDraft(), {
    widgets: { custom_1: { removed: true, custom: { title: 'New words', body: 'x' }, is_visible: false } } as never,
  });
  const { items } = classifyHubDraft(d, live);
  const mine = items.filter((i) => i.kind === 'widget' && i.widgetType === 'custom_1');
  assert.equal(mine.length, 1, `expected only the delete, got ${JSON.stringify(mine)}`);
  assert.deepEqual(
    mine.map((i) => i.kind === 'widget' && { field: i.field, change: i.change, pro: i.pro }),
    [{ field: 'removed', change: 'remove', pro: false }],
  );
  const lines = hubDraftChangeLines(d, live, false);
  assert.ok(lines.some((l) => /deleted for good/i.test(l.what)), `the Apply sheet does not name it: ${JSON.stringify(lines)}`);
});

test('the one delete counts its rows and never deletes a shipped section', async () => {
  const calls: string[] = [];
  const client = (rows: unknown[] | null) => ({
    from: () => ({ delete: () => ({ eq: (_c: string, v: string) => ({ eq: (_d: string, e: string) => ({ select: async () => (calls.push(`${v}@${e}`), { data: rows, error: null }) }) }) }) }),
  });
  assert.deepEqual(await deleteOwnScene(client([{ widget_id: 'w-c1' }]), 'e', { widget_id: 'w-c1', widget_type: 'custom_1' }), { ok: true });
  assert.equal((await deleteOwnScene(client([]), 'e', { widget_id: 'w-c1', widget_type: 'custom_1' })).ok, false, 'a refused delete (0 rows) read as done');
  const before = calls.length;
  assert.equal((await deleteOwnScene(client([{}]), 'e', { widget_id: 'w-sched', widget_type: 'schedule' })).ok, false);
  assert.equal(calls.length, before, 'a shipped section reached the delete');
});

test('wired: the Maker form drafts, the action drafts on draft=1, Apply deletes, the slot is counted live', () => {
  const panel = read('app/dashboard/[eventId]/website/editor/_components/sections-panel.tsx');
  const form = panel.slice(panel.indexOf('const removeForm = ('), panel.indexOf("if (makerPart === 'remove') return removeForm;"));
  assert.match(form, /\{makerPart \? <HubDraftField \/> : <HubSavesImmediately \/>\}/, 'the Maker’s Remove for good is not drafted');
  const act = read('app/dashboard/[eventId]/website/widgets/actions.ts');
  const del = act.slice(act.indexOf("if (intent === 'delete') {"), act.indexOf("if (intent === 'delete') {") + 1800);
  assert.match(del, /if \(draftingHere\) \{[\s\S]*?removed: true/, 'the delete does not wait for Apply in the Maker');
  // The live delete and Apply's are the SAME query: delete one row of this event, rows counted.
  const one = read('lib/own-scene-delete.ts');
  for (const src of [del, one]) assert.match(src, /\.delete\(\)\s*\.eq\('widget_id', [\w.]+\)\s*\.eq\('event_id', eventId\)\s*\.select\('widget_id'\)/);
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /i\.field === 'removed'\)\) \{\s*const gone = await deleteOwnScene\(supabase, eventId, row\);/, 'Apply does not delete a drafted removal');
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(page, /!nextFreeCustomSlot\(liveWidgets\.map/, 'the slot is freed before Apply deletes the row');
});

test('🔴 ＋ a scene of their own lands above / below the picked scene', () => {
  const full = ['w-a', 'w-b', 'w-c'];
  assert.deepEqual(ownScenePlaceOrder(full, 'w-b', 'above'), ['w-a', NEW_SCENE_TOKEN, 'w-b', 'w-c']);
  assert.deepEqual(ownScenePlaceOrder(full, 'w-b', 'below'), ['w-a', 'w-b', NEW_SCENE_TOKEN, 'w-c']);
  assert.equal(ownScenePlaceOrder(full, 'w-x', 'below'), null);
  // The server's check, then the grip drag's own patch.
  const ids = new Set(full);
  const place = readOwnScenePlace('rsvp', `w-a,w-b,${NEW_SCENE_TOKEN},w-c`, ids);
  assert.ok(place);
  const types: Record<string, string> = { 'w-a': 'schedule', 'w-b': 'venue_map', 'w-c': 'dress_code', 'w-new': 'custom_3' };
  const patch = stageOrderPatch(place.order.map((x) => (x === NEW_SCENE_TOKEN ? 'w-new' : x)), (id) => types[id], place.stage);
  assert.deepEqual((patch?.widgets as Record<string, { stage_order: Record<string, number> }>).custom_3, { stage_order: { rsvp: 2 } });
  assert.deepEqual(addedSceneDraft({ displayOrder: 9, canvas: null, stageOrder: { rsvp: 2 } }).stage_order, { rsvp: 2 }, 'the new scene forgets its place');
  assert.equal('stage_order' in addedSceneDraft({ displayOrder: 9, canvas: null }), false);
  // Anything that does not check out lands at the end, as before.
  assert.equal(readOwnScenePlace('rsvp', 'w-a,w-b', ids), null, 'no token');
  assert.equal(readOwnScenePlace('rsvp', `w-a,${NEW_SCENE_TOKEN},w-zz`, ids), null, 'a row of another event');
  assert.equal(readOwnScenePlace('nope', `w-a,${NEW_SCENE_TOKEN}`, ids), null, 'not a stage');
  assert.equal(readOwnScenePlace('rsvp', `w-a,w-a,${NEW_SCENE_TOKEN}`, ids), null, 'a repeat');
});

test('wired: the ＋ sheet sends the place, the action drafts it', () => {
  const sheet = read('app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx');
  assert.match(sheet, /hidden=\{\{ event_id: ops\.eventId, return_to: ops\.addOwn\.returnTo, \.\.\.ownPlaceFields\(ops, mv, ownWhere\) \}\}/);
  assert.match(sheet, /setOwnWhere\(adding\);/);
  const act = read('app/dashboard/[eventId]/website/widgets/actions.ts');
  assert.match(act, /readOwnScenePlace\(formData\.get\(PLACE_STAGE_FIELD\), formData\.get\(PLACE_ORDER_FIELD\)/);
  assert.match(act, /stageOrderPatch\(/);
  assert.match(act, /addedSceneDraft\(\{ displayOrder: end, canvas, stageOrder: slotPlace\?\.stage_order \}\)/, 'the new scene’s own place is not drafted');
});
