/**
 * the-eye-is-per-stage.test.ts — "WHAT GUESTS SEE", step 2 (DECISION_LOG 2026-10-10): THE MAKER'S OWN EYE / REMOVE
 * WRITES THE SAME VALUE AS THE TABLE. On a stage, hiding a scene takes it off THAT stage
 * (`config_json.stage_show[stage]`), and putting it back puts it back there — never the event-wide `is_visible` /
 * `mode`, which used to take it off every stage at once.
 *
 *   1. what the eye stores (`stageEyeValue` over `buildStageEyes`): hide our pick → `false`; hide a scene the couple
 *      added → `null`; show one they hid here → `null`; show one hidden for the whole event → `true`, for this stage;
 *   2. through the real draft: an eye on one stage never changes another stage's list — a scene hidden for the whole
 *      event comes back on the stage the couple pressed, and stays hidden on the rest;
 *   3. a love story hidden by the event-wide eye is still told as prose — and "show" brings the SCENE (the eye asks
 *      the stage's LIST, never a place off it);
 *   4. the eye in the Maker (`editor-shell.tsx` `eyeWrite`) posts exactly `{ stage_show: { [stage]: value } }` through
 *      the work area's draft door — no `is_visible`, no `mode`; a hide is drawn at the tap and held, a show reloads;
 *   5. THE TWO STUCK STATES: a scene hidden on one stage is folded WITH the eye; a scene shown on a stage over the
 *      event-wide eye is drawn as showing, and its eye hides it there;
 *   6. an event-wide write (Auto · Shown · Hidden) changes nothing the canvas draws on a stage with its own choice
 *      (`sceneDrawEffect`).
 *
 * SABOTAGES RUN (each seen red, then put back and re-checked by hash):
 *   A · `stageEyeValue` made to store the wanted state always          → 1, 2, 5 red;
 *   B · `buildStageEyes` made to ask "drawn" instead of the list       → 3 red;
 *   C · the eye made to post `is_visible` again                        → 4 red;
 *   D · the listed tile made to read the event-wide eye again          → 5 red;
 *   E · `sceneDrawEffect` made deaf to the stage's choice              → 6 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { STAGE_SHOW_KEY } from './stage-scenes';
import { WIDGET_CATALOG_BY_TYPE, type InvitationWidgetRow, type LifecyclePhase, type WidgetType } from './invitation-widgets';
import { buildStageEyes } from './guests-see-build';
import { stageEyeValue } from './stage-eye';
import { makerStageList } from './maker-scene-list';
import { sceneOnStage } from './what-guests-see';
import { emptyHubDraft, mergeHubDraft, overlayHubDraftWidgets } from './hub-draft';
import { sceneDrawEffect } from '../app/dashboard/[eventId]/website/editor/_components/element-preview';
import { stripComments } from './strip-comments';

const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
const ORDER: readonly WidgetType[] = ['hero', 'greeting', 'qr_card', 'rsvp', 'countdown', 'schedule', 'special_message', 'dress_code', 'venue_map', 'what_to_bring', 'our_love_story', 'our_photos', 'photo_moments'];
type Patch = { is_visible?: boolean; show?: Partial<Record<LifecyclePhase, boolean>> };
const rows = (patch: Partial<Record<WidgetType, Patch>> = {}): InvitationWidgetRow[] =>
  ORDER.map((t, i) => ({
    widget_id: `id-${t}`, event_id: 'e', widget_type: t, display_order: i, is_visible: patch[t]?.is_visible ?? true,
    is_always_on: WIDGET_CATALOG_BY_TYPE[t].is_always_on, tier: 'basic', created_at: '', updated_at: '', mode: 'auto', audience: 'public',
    config_json: patch[t]?.show ? { [STAGE_SHOW_KEY]: patch[t]!.show } : {},
  }));
const eyes = (w: readonly InvitationWidgetRow[]) => buildStageEyes({ widgets: w, hasEntourage: true, giftsOff: false });
const listed = (w: readonly InvitationWidgetRow[], stage: LifecyclePhase) =>
  makerStageList({ stage, widgets: w, openBrowse: false, content: {}, solemn: false, hasHeroMedia: false, hasEntourage: true, storyRenders: true });
const scenes = (w: readonly InvitationWidgetRow[], stage: LifecyclePhase) => listed(w, stage).shown.flatMap((t) => (t.kind === 'scene' ? [t.type] : []));
/** One press of the eye on `type`, on `stage`, as the Maker sends it — returned as the rows the next render reads. */
function press(w: InvitationWidgetRow[], type: WidgetType, stage: LifecyclePhase): InvitationWidgetRow[] {
  const want = !scenes(w, stage).includes(type);
  const value = stageEyeValue(eyes(w)[stage][type], want);
  const draft = mergeHubDraft(emptyHubDraft(), { widgets: { [type]: { stage_show: { [stage]: value } } } });
  return overlayHubDraftWidgets(w, draft);
}
const stored = (w: readonly InvitationWidgetRow[], type: WidgetType) => (w.find((r) => r.widget_type === type)!.config_json as Record<string, unknown>)[STAGE_SHOW_KEY];

test('1 · what the eye stores: false for our pick, null where the stage has it that way, true for a scene hidden everywhere', () => {
  const plain = eyes(rows());
  assert.deepEqual(plain.rsvp.special_message, { base: true, choice: null });
  assert.equal(stageEyeValue(plain.rsvp.special_message, false), false, 'hiding our pick');
  assert.deepEqual(plain.event.special_message, { base: false, choice: null });
  assert.equal(stageEyeValue(plain.event.special_message, true), true, 'adding');
  const added = eyes(rows({ special_message: { show: { event: true } } }));
  assert.deepEqual(added.event.special_message, { base: false, choice: true });
  assert.equal(stageEyeValue(added.event.special_message, false), null, 'hiding a scene the couple added takes the choice back');
  const hiddenHere = eyes(rows({ special_message: { show: { rsvp: false } } }));
  assert.equal(stageEyeValue(hiddenHere.rsvp.special_message, true), null, 'showing a scene hidden here takes the choice back');
  const everywhere = eyes(rows({ special_message: { is_visible: false } }));
  assert.deepEqual(everywhere.rsvp.special_message, { base: false, choice: null });
  assert.equal(stageEyeValue(everywhere.rsvp.special_message, true), true);
  assert.equal(stageEyeValue(undefined, false), false);
  assert.equal(eyes(rows()).rsvp.rsvp, undefined, 'an always-on row has no eye');
});

test('2 · through the real draft: one stage’s eye never changes another stage’s list', () => {
  for (const type of ['special_message', 'schedule', 'our_love_story', 'countdown'] as const) {
    const start = rows();
    const on = STAGES.filter((s) => scenes(start, s).includes(type));
    const here = on[0]!;
    const hidden = press(start, type, here);
    for (const s of STAGES) assert.deepEqual(scenes(hidden, s), s === here ? scenes(start, s).filter((t) => t !== type) : scenes(start, s), `${type} hidden on ${here} — ${s}`);
    assert.deepEqual(stored(hidden, type), { [here]: false });
    const back = press(hidden, type, here);
    assert.equal(stored(back, type), undefined, 'put back: the choice is taken off, not stored twice');
    for (const s of STAGES) assert.deepEqual(scenes(back, s), scenes(start, s));
  }
  // Hidden for the whole event BEFORE this change: one press shows it on THAT stage, and nowhere else.
  const old = rows({ special_message: { is_visible: false } });
  assert.ok(STAGES.every((s) => !scenes(old, s).includes('special_message')), 'anti-vacuity');
  const shown = press(old, 'special_message', 'rsvp');
  assert.ok(scenes(shown, 'rsvp').includes('special_message'));
  assert.ok(!scenes(shown, 'editorial').includes('special_message'), 'the eye on the Invitation un-hid Post Event');
  assert.equal(shown.find((r) => r.widget_type === 'special_message')!.is_visible, false, 'the event-wide switch was written');
  assert.deepEqual(stored(shown, 'special_message'), { rsvp: true });
});

test('3 · a love story hidden by the event-wide eye is still told as prose — and "show" brings the scene', () => {
  const off = rows({ our_love_story: { is_visible: false } });
  const told = sceneOnStage({ widgets: off, stage: 'rsvp' }, 'our_love_story')!;
  assert.deepEqual([told.drawn, told.inList, told.offList], [true, false, 'prose'], 'anti-vacuity: the prose stands in');
  assert.deepEqual(eyes(off).rsvp.our_love_story, { base: false, choice: null }, 'the eye asks the LIST');
  const shown = press(off, 'our_love_story', 'rsvp');
  assert.deepEqual(stored(shown, 'our_love_story'), { rsvp: true });
  assert.ok(scenes(shown, 'rsvp').includes('our_love_story'));
});

const SHELL = stripComments(readFileSync(join(__dirname, '..', 'app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx'), 'utf8'));

test('4 · the Maker’s eye posts exactly the stage’s entry through the draft door — never is_visible, never mode', () => {
  const eye = SHELL.slice(SHELL.indexOf('const eyeWrite = '), SHELL.indexOf('const eyeWriteEverywhere = '));
  assert.ok(eye.length > 600, 'anti-vacuity: the eye was not found');
  assert.match(eye, /if \(!elementEditing\) return eyeWriteEverywhere\(scene\);/, 'only the editor outside the Maker keeps the event-wide switch');
  assert.match(eye, /const want = !shownHere\(scene\);/);
  assert.match(eye, /const value = stageEyeValue\(navigator\.stageEye\?\.\[stage\]\?\.\[scene\.type as WidgetType\], want\);/);
  assert.match(eye, /fd\.set\('patch', JSON\.stringify\(\{ widgets: \{ \[scene\.type\]: \{ stage_show: \{ \[stage\]: value \} \} \} \}\)\);/);
  assert.doesNotMatch(eye, /is_visible|isVisible|\bmode\b/, 'the eye writes the event-wide switch');
  assert.match(eye, /const draftAction = elementEditing\.draftAction;/, 'not the work area’s draft door');
  /* (2026-10-13: a hide the page drew is noted for its ↺ at the press — `undo: 'noted'`, `lib/maker-drawn-undo.ts`.) */
  assert.match(eye, /makerSave\(\(\) => draftAction\(eventId, fd\), requestMakerRefresh, \{ held, undo: 'noted' \}\)/);
  // Hide: drawn at the tap and held. Show: the canvas reloads.
  assert.match(eye, /if \(want\) releaseCanvas\(\);\s*else hideOnCanvas\(scene\);\s*const held = !want;/);
  // Refused: put back, on the canvas too.
  assert.match(eye, /if \(!want\) broadcastToCanvas\(\{ source: 'setnayan-editor', t: 'sceneShow', key: `w:\$\{scene\.type\}`, shown: true \}\);/);
  // Every eye in the Maker goes through it (the tile, the scene menu, the fold, the arrange tab, the parts' Remove).
  assert.ok((SHELL.match(/eyeWrite\(scene\)|eyeWrite\(selectedScene\)/g) ?? []).length >= 4);
  assert.match(SHELL, /partOps\.current = \{[^}]*\beyeWrite\b/);
});

test('5 · the two stuck states: hidden on one stage is folded WITH the eye; shown over the event-wide eye is drawn as showing', () => {
  // (a) Hidden here: the fold offers the eye, and one press brings it back here.
  const hiddenHere = rows({ schedule: { show: { rsvp: false } } });
  const fold = listed(hiddenHere, 'rsvp').folded.find((f) => f.type === 'schedule')!;
  assert.deepEqual([fold.hiddenByCouple, fold.hiddenHere, fold.reason], [true, true, 'Hidden on Invitation.']);
  assert.match(SHELL, /\{f\.hiddenByCouple \? \(\s*<button[\s\S]{0,200}?onClick=\{\(\) => eyeWrite\(scene\)\}/, 'the fold’s eye is gone');
  assert.ok(scenes(press(hiddenHere, 'schedule', 'rsvp'), 'rsvp').includes('schedule'));
  // (b) Shown on a stage over the event-wide eye: listed there — and drawn as SHOWING (the tile reads the stage's
  //     list, not the event-wide switch), so its eye hides it there.
  const over = rows({ schedule: { is_visible: false, show: { rsvp: true } } });
  assert.ok(scenes(over, 'rsvp').includes('schedule'));
  assert.match(SHELL, /const showing = scene \? \(elementEditing \? !hereOff\[`\$\{stage\}:\$\{scene\.id\}`\] : sceneShowing\(scene\)\) :/);
  assert.match(SHELL, /isVisible=\{elementEditing \? shownHere\(selectedScene\) : selectedScene\.isVisible\}/);
  const off = press(over, 'schedule', 'rsvp');
  assert.ok(!scenes(off, 'rsvp').includes('schedule'));
  assert.equal(stored(off, 'schedule'), undefined, 'hiding it again takes the choice back — the event-wide eye hides it');
});

test('6 · an event-wide write changes nothing the canvas draws on a stage with its own choice', () => {
  const on = { mode: 'auto' as const, isVisible: true };
  const off = { mode: 'auto' as const, isVisible: false };
  assert.equal(sceneDrawEffect(on, off, false), 'hide', 'anti-vacuity');
  assert.equal(sceneDrawEffect(on, off, false, null), 'hide');
  assert.equal(sceneDrawEffect(on, off, false, true), 'none');
  assert.equal(sceneDrawEffect(off, on, true, false), 'none');
  assert.match(SHELL, /sceneFormat\?\.openBrowse,\s*navigator\.stageEye\?\.\[stage\]\?\.\[scene\.type as WidgetType\]\?\.choice,/);
});
