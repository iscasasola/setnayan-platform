import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets, planHubDraftApply, summarizeHubDraft, undoHubDraft, type HubDraft, type HubDraftPatch, type HubLiveState } from './hub-draft';
import { hubDraftChangeLines } from './hub-draft-change-lines';
import { movedOrder, stageAddPatch, stageOrderPatch } from './maker-reorder';
import { stageEyeValue } from './stage-eye';
import { stageRowOrder, stageShown } from './stage-scenes';
import { widgetInPhase, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { sceneOnStage } from './what-guests-see';
import { guestsSeePatch } from './guests-see-table';
import { makerPartOffers } from './maker-part-groups';
import { makerStagesPageOf, makerStagesPages } from './maker-stage-filing';
import { stripComments } from './strip-comments';

/**
 * ↺ ONE PRESS BY A PERSON IS EXACTLY ONE UNDO STEP — AND ＋ PUTS THE PART ON THE PAGE IT WAS ADDED FROM
 * (owner, 2026-10-11, on his real test event in the new Maker — F1 · F2).
 *
 * "pressed undo twice before it reversed that edit. not once." His draft proved the class: ＋ below Message → Venue,
 * ONE action, and `event_site_drafts.draft_json.history` grew by TWO — first `venue_map.stage_order.rsvp = 1` (the
 * placing), then the same with `venue_map.stage_show = { rsvp: null }` (the showing). ＋ ran the move and then the eye.
 *
 * "it did say venue added but i do not see it." The hide was already PUBLISHED (`config_json.stage_show.rsvp = false`).
 * The draft's `null` over it IS read as shown (held below) — the Venue was drawn, on DETAILS, where the canvas files
 * it; he was on Welcome, where ＋ had offered it.
 *
 * Every lab walk before this had nothing published under the draft. The fixtures here do.
 */

const TYPES: Array<[WidgetType, boolean]> = [
  ['hero', true], ['greeting', true], ['qr_card', true], ['event_details', false], ['countdown', false], ['schedule', false], ['rsvp', true],
  ['venue_map', false], ['dress_code', false], ['photo_moments', false], ['your_photos', false], ['tier_comparison', false],
  ['special_message', false], ['what_to_bring', false], ['our_photos', false], ['our_love_story', false],
];
/** The event's PUBLISHED rows — `config` is what Apply already wrote for a type. */
const rows = (config: Partial<Record<WidgetType, Record<string, unknown>>> = {}): InvitationWidgetRow[] =>
  TYPES.map(([type, alwaysOn], i) => ({
    widget_id: `w-${type}`, event_id: 'e', widget_type: type, display_order: i + 1, is_visible: true, is_always_on: alwaysOn, tier: 'basic',
    config_json: config[type] ?? {}, created_at: '', updated_at: '', mode: 'auto',
  })) as InvitationWidgetRow[];
const live = (r: InvitationWidgetRow[]): HubLiveState => ({ events: {}, widgets: r });
const typeOf = (id: string) => id.slice(2);
const fullOrder = (r: readonly InvitationWidgetRow[], stage: LifecyclePhase) => stageRowOrder(r, stage, (t, s) => widgetInPhase(t as WidgetType, s)).map((x) => x.widget_id);
const save = (d: HubDraft, patch: HubDraftPatch | null) => mergeHubDraft(d, patch!);

/** THE OWNER'S EVENT: the Venue hidden on the Invitation, and that hide PUBLISHED. */
const PUBLISHED_HIDE = rows({ venue_map: { stage_show: { rsvp: false } } });

/** ＋ below Message → Venue, as the Maker now writes it: ONE patch. */
function addVenueBelowMessage(published: InvitationWidgetRow[]): HubDraftPatch {
  const order = fullOrder(published, 'rsvp');
  const at = order.indexOf('w-venue_map');
  const moved = movedOrder(order, 'w-venue_map', order.indexOf('w-special_message') + 1 - at);
  /* What the eye stores to SHOW a scene the stage's own list has: the choice taken back (`stageEyeValue`). */
  const show = stageEyeValue({ base: true }, true);
  assert.equal(show, null);
  return stageAddPatch(moved, typeOf, 'rsvp', 'venue_map', show)!;
}

test('F1 · ＋ is ONE undo step: the place and the showing ride one save, and one ↺ takes both back', () => {
  const patch = addVenueBelowMessage(PUBLISHED_HIDE);
  const d = save(emptyHubDraft(), patch);
  assert.equal(d.history.length, 1, 'one press pushed more than one Undo step');
  assert.ok(typeof d.widgets.venue_map?.stage_order?.rsvp === 'number', 'the place is not in the save');
  assert.deepEqual(d.widgets.venue_map?.stage_show, { rsvp: null }, 'the showing is not in the same save');
  assert.deepEqual(undoHubDraft(d), emptyHubDraft(), 'one ↺ did not take the whole press back');
  /* With nowhere to move (it already stands there): still one save, the showing alone. */
  assert.deepEqual(stageAddPatch(null, typeOf, 'rsvp', 'venue_map', null), { widgets: { venue_map: { stage_show: { rsvp: null } } } });
  /* A row whose type is unknown here: no patch — the caller falls back, never half a write. */
  assert.equal(stageAddPatch(['w-countdown', 'x'], (id) => (id === 'x' ? undefined : typeOf(id)), 'rsvp', 'venue_map', null), null);
});

test('F1 · EVERY intent is one patch, so one Undo step — and each undoes to exactly the draft before it', () => {
  const published = PUBLISHED_HIDE;
  const order = fullOrder(published, 'rsvp');
  const intents: Record<string, HubDraftPatch> = {
    'Names typed + Done': { events: { display_name: 'TEsting Event' } },
    '＋ a part brought back': addVenueBelowMessage(published),
    'Remove (the eye, this stage)': { widgets: { special_message: { stage_show: { rsvp: stageEyeValue({ base: true }, false) } } } },
    'Earlier / Later': stageOrderPatch(movedOrder(order, 'w-special_message', -1)!, typeOf, 'rsvp')!,
    'What guests see › Apply (two ticks)': guestsSeePatch({ 'countdown:event': true, 'dress_code:save_the_date': true } as never)!,
    'a part’s Style': { fixedStyles: { hero_eyebrow: 'serif' } },
    'a scene’s look': { widgets: { countdown: { canvas: { in: 'fade' } } } },
  };
  let d = emptyHubDraft();
  for (const [name, patch] of Object.entries(intents)) {
    assert.ok(patch && typeof patch === 'object', `${name}: no patch`);
    const next = save(d, patch);
    assert.equal(next.history.length, d.history.length + 1, `${name}: the Undo history did not grow by exactly one`);
    const { history: _h, ...before } = d;
    const { history: _u, ...undone } = undoHubDraft(next);
    assert.deepEqual(undone, before, `${name}: one ↺ does not give back the draft before it`);
    d = next;
  }
  assert.equal(d.history.length, Object.keys(intents).length);
});

test('F1 · the Maker’s ＋ really sends that one patch — no move followed by an eye', () => {
  const read = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));
  const sheet = read('app', 'dashboard', '[eventId]', 'launch', '_components', 'add-part-sheet.tsx');
  const add = sheet.slice(sheet.indexOf('const add = '), sheet.indexOf('const removeYes = '));
  assert.ok(add.length > 200);
  const scenePath = add.slice(0, add.indexOf('makerPostEventSceneOf('));
  assert.doesNotMatch(scenePath, /o\.move\(|o\.eye\(/, '＋ writes its place and its showing as two saves again');
  assert.equal((scenePath.match(/o\.add\(/g) ?? []).length, 1);
  const shell = read('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'editor-shell.tsx');
  const addHere = shell.slice(shell.indexOf('const addHere = '), shell.indexOf('const runChain = '));
  /* One door call on the draft's path; the two shipped writes only where there is no draft door at all. */
  assert.equal((addHere.match(/draftAction\(eventId, fd\)/g) ?? []).length, 1);
  assert.match(addHere, /stageAddPatch\(order, [\s\S]{0,60}?stage, scene\.type, value\)/);
});

test('F2 · a draft’s `null` over a PUBLISHED hide is read as shown — by the overlay, the list and the count', () => {
  const d = save(emptyHubDraft(), addVenueBelowMessage(PUBLISHED_HIDE));
  /* Published: hidden on the Invitation. */
  assert.equal(stageShown(PUBLISHED_HIDE.find((r) => r.widget_type === 'venue_map')!.config_json, 'rsvp'), false);
  assert.equal(sceneOnStage({ widgets: PUBLISHED_HIDE, stage: 'rsvp' }, 'venue_map')!.drawn, false);
  /* The canvas's reading — the published rows with the draft laid over them. */
  const drawn = overlayHubDraftWidgets(PUBLISHED_HIDE, d);
  const venue = drawn.find((r) => r.widget_type === 'venue_map')!;
  assert.equal(stageShown(venue.config_json, 'rsvp'), null, 'the published `false` outlived the draft’s `null`');
  const now = sceneOnStage({ widgets: drawn, stage: 'rsvp' }, 'venue_map')!;
  assert.equal(now.drawn, true, 'the Venue is still off the Invitation under the draft');
  assert.equal(now.hiddenByCouple, false);
  /* …in the place it was added: right after the Message, in the stage's own order. */
  const order = fullOrder(drawn, 'rsvp');
  assert.equal(order[order.indexOf('w-special_message') + 1], 'w-venue_map');
  /* The other stages are untouched. */
  for (const stage of ['save_the_date', 'event', 'editorial'] as const) assert.equal(stageShown(venue.config_json, stage), null);
  /* It is a change waiting (the hide is published; the draft takes it back), and Apply writes the key AWAY. */
  assert.ok(summarizeHubDraft(d, live(PUBLISHED_HIDE), false).changeCount >= 1);
  const item = planHubDraftApply(d, live(PUBLISHED_HIDE), false).apply.find((i) => i.kind === 'widget' && i.widgetType === 'venue_map' && i.field === 'stage_show');
  assert.ok(item, 'Apply would leave the published hide in place');
  assert.equal(item.value, null, 'Apply would write a choice where the couple took theirs back');
  assert.ok(hubDraftChangeLines(d, live(PUBLISHED_HIDE), false).length >= 1);
  /* And with NOTHING published the same press is no hide to take back — it still shows (the lab's old case). */
  const fresh = rows();
  assert.equal(sceneOnStage({ widgets: overlayHubDraftWidgets(fresh, save(emptyHubDraft(), addVenueBelowMessage(fresh))), stage: 'rsvp' }, 'venue_map')!.drawn, true);
});

test('F2 · ＋ offers a part only on the page that will draw it — "added" is never said over a page that shows nothing new', () => {
  const pages = makerStagesPages('rsvp').map((p) => p.key);
  assert.equal(makerStagesPageOf('rsvp', 'w:venue_map', pages), 'details', 'the canvas files the Venue elsewhere now — re-read this test');
  assert.equal(makerStagesPageOf('rsvp', 'w:special_message', pages), 'home');
  /* The Venue and the Message are both hidden; nothing of either is drawn. */
  const offers = (shown: string | null) =>
    makerPartOffers({
      stage: 'rsvp',
      present: new Set<string>(),
      pathOf: (_key, canvas) => (canvas === 'w:venue_map' || canvas === 'w:special_message' ? { kind: 'add' } : null),
      onThisPage: shown ? (canvas) => makerStagesPageOf('rsvp', canvas, pages) === shown : undefined,
    }).flatMap((g) => g.parts.map((p) => p.key));
  assert.deepEqual(offers('home'), ['message'], 'Welcome offers a part it cannot draw');
  assert.deepEqual(offers('details'), ['venue']);
  assert.deepEqual(offers('me'), []);
  /* A stage drawn as one page offers everything it could before. */
  assert.deepEqual([...offers(null)].sort(), ['message', 'venue']);
  /* The sheet asks the canvas which page is on show, and files by the canvas's own rule. */
  const sheet = stripComments(readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'add-part-sheet.tsx'), 'utf8'));
  assert.match(sheet, /onThisPage: here \? \(canvasKey\) => makerStagesPageOf\(here\.stage, canvasKey, here\.pages\) === here\.shown : undefined,/);
});
