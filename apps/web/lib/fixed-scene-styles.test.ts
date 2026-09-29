/**
 * THE FIVE FIXED PARTS' STYLE PICKS — stored in `events.style_preferences
 * .scene_styles`, drafted, and written only at Apply (controller ruling
 * 2026-09-29, "no migration"). This holds the whole path on its pure halves:
 *
 *   1. the stored shape is sanitised and MERGED — a pick for one part never
 *      forgets another's, and never touches the blob's other keys (the QR look);
 *   2. no pick = style A, so an event that never picked draws what it drew;
 *   3. the draft carries the pick, Undo takes it back, the host's canvas wears
 *      it, Apply classifies it against live — free, never held, and written to
 *      `events` (the shared read-merge-write), never before Apply;
 *   4. the action stays ONE exported server action, and writes the pick only
 *      in its Apply branch, through the one writer the QR look uses.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fixedSceneStyleOf } from './fixed-scene-style-of';
import {
  fixedSceneStylesAfter,
  fixedSceneStylesFromPreferences,
  sanitizeFixedSceneStylesDraft,
  sceneStylesValueAfter,
  stylePreferencesWithDraftedStyles,
} from './fixed-scene-styles';
import {
  emptyHubDraft,
  hubDraftHasChanges,
  hubDraftItemLabel,
  hubDraftWriteTables,
  mergeHubDraft,
  overlayHubDraftEvent,
  planHubDraftApply,
  sanitizeHubDraft,
  undoHubDraft,
  type HubLiveState,
} from './hub-draft';
import { stripComments } from './strip-comments';

const PREFS = { qr: { shape: 'circle' }, interested_categories: ['florist'], scene_styles: { entourage: 'march' } };

test('1 · stored picks are sanitised, and a new pick MERGES — other parts and other keys are kept', () => {
  assert.deepEqual(fixedSceneStylesFromPreferences(PREFS), { entourage: 'march' });
  assert.deepEqual(fixedSceneStylesFromPreferences({ scene_styles: { entourage: 'Bad Id', nope: 'march', live_hub: 7 } }), {});
  assert.deepEqual(fixedSceneStylesFromPreferences(null), {});

  assert.deepEqual(sceneStylesValueAfter({ entourage: 'march' }, { find_your_seat: 'place-card' }), {
    entourage: 'march',
    find_your_seat: 'place-card',
  });
  assert.equal(sceneStylesValueAfter({ entourage: 'march' }, { entourage: null }), undefined, 'back to the default takes the key off');

  const worn = stylePreferencesWithDraftedStyles(PREFS, { live_hub: 'theatre' }) as Record<string, unknown>;
  assert.deepEqual(worn.qr, PREFS.qr, 'the QR look is untouched');
  assert.deepEqual(worn.interested_categories, PREFS.interested_categories, 'onboarding picks are untouched');
  assert.deepEqual(worn.scene_styles, { entourage: 'march', live_hub: 'theatre' });
  assert.deepEqual(PREFS.scene_styles, { entourage: 'march' }, 'the live row is never mutated');
  assert.equal(stylePreferencesWithDraftedStyles(PREFS, null), PREFS, 'no draft → the same object');

  assert.deepEqual(sanitizeFixedSceneStylesDraft({ entourage: null, live_hub: 'theatre', x: 'y', photos_of_you: '<b>' }), {
    entourage: null,
    live_hub: 'theatre',
  });
  assert.equal(sanitizeFixedSceneStylesDraft({ nope: 'x' }), null);
  assert.deepEqual(fixedSceneStylesAfter({ entourage: 'march' }, { entourage: null, find_your_seat: 'map' }), { find_your_seat: 'map' });
});

test('2 · no pick is style A — and a pick is drawn only on a stage that draws it', () => {
  for (const [scene, stage, id] of [
    ['entourage', 'rsvp', 'roll-call'],
    ['entourage', 'event', 'roll-call'],
    ['find_your_seat', 'event', 'map'],
    ['photos_of_you', 'event', 'grid'],
    ['announcements', 'rsvp', 'banner'],
    ['announcements', 'event', 'banner'],
    ['live_hub', 'event', 'player-and-wall'],
  ] as const) {
    assert.equal(fixedSceneStyleOf({}, scene, stage, 'wedding'), id, `${scene} on ${stage}`);
    assert.equal(fixedSceneStyleOf({ scene_styles: { [scene]: 'no-such' } }, scene, stage, 'wedding'), id, `${scene}: a stale pick falls back`);
  }
  assert.equal(fixedSceneStyleOf(PREFS, 'entourage', 'event', 'wedding'), 'march');
  assert.equal(fixedSceneStyleOf({ scene_styles: { find_your_seat: 'place-card' } }, 'find_your_seat', 'rsvp'), null, 'no seat styles before the day');
  assert.equal(fixedSceneStyleOf({ scene_styles: { entourage: 'two-sides' } }, 'entourage', 'event', 'birthday'), 'roll-call', 'two sides is a wedding style');
  assert.equal(fixedSceneStyleOf(PREFS, 'entourage', null), null, 'no stage → the component’s own look');
});

const LIVE: HubLiveState = { events: {}, widgets: [], fixedStyles: { entourage: 'march' } };

test('3 · drafted, undone, worn by the host’s canvas, classified free at Apply, written to events', () => {
  const d1 = mergeHubDraft(emptyHubDraft(), { fixedStyles: { find_your_seat: 'place-card' } });
  const d2 = mergeHubDraft(d1, { fixedStyles: { live_hub: 'theatre' } });
  assert.deepEqual(d2.fixedStyles, { find_your_seat: 'place-card', live_hub: 'theatre' }, 'one pick never forgets another');
  assert.ok(hubDraftHasChanges(d2));
  assert.deepEqual(undoHubDraft(d2).fixedStyles, { find_your_seat: 'place-card' }, 'Undo takes the last pick back');
  assert.deepEqual(sanitizeHubDraft(JSON.parse(JSON.stringify(d2))).fixedStyles, d2.fixedStyles, 'survives a round trip');
  assert.equal(sanitizeHubDraft({ fixedStyles: { find_your_seat: 'Nope!' } }).fixedStyles, undefined);

  const row = overlayHubDraftEvent({ event_id: 'e', style_preferences: PREFS } as Record<string, unknown>, d2);
  assert.deepEqual(fixedSceneStylesFromPreferences(row.style_preferences), { entourage: 'march', find_your_seat: 'place-card', live_hub: 'theatre' });

  // A free couple: a style pick is never Pro, never held.
  const d3 = mergeHubDraft(d2, { fixedStyles: { entourage: 'march' } });
  const plan = planHubDraftApply(d3, LIVE, false);
  assert.equal(plan.refused.length, 0, 'a style pick is free');
  const picks = plan.apply.filter((i) => i.kind === 'fixed-style');
  assert.deepEqual(
    picks.map((i) => (i.kind === 'fixed-style' ? [i.scene, i.value] : null)),
    [['find_your_seat', 'place-card'], ['live_hub', 'theatre']],
    'a pick equal to live is not written',
  );
  assert.deepEqual(hubDraftWriteTables(picks), ['events']);
  assert.equal(hubDraftItemLabel(picks[0]!, () => ''), 'Find your seat · its style');
  const back = planHubDraftApply(mergeHubDraft(emptyHubDraft(), { fixedStyles: { entourage: null } }), LIVE, false);
  assert.deepEqual(back.apply.map((i) => (i.kind === 'fixed-style' ? i.value : 'x')), [null], 'back to the default is written as a removal');
});

test('4 · ONE exported server action, and the pick is written only by Apply, through the shared writer', () => {
  const WEB = join(__dirname, '..');
  const raw = readFileSync(join(WEB, 'app/dashboard/[eventId]/website/hub-draft-actions.ts'), 'utf8');
  const src = stripComments(raw);
  assert.match(raw, /^'use server';/);
  assert.equal((src.match(/^export /gm) ?? []).length, 1, 'still exactly one export');
  const applyAt = src.indexOf('const live = await readHubLiveState(');
  const writeAt = src.indexOf('writeStylePreferenceKey(');
  assert.ok(applyAt > 0 && writeAt > applyAt, 'the pick is written after Apply starts — never in save');
  assert.ok(src.indexOf('requireHostMembershipOrThrow(') < writeAt, 'the host check runs first');
  assert.match(src, /writeStylePreferenceKey\(createAdminClient\(\), eventId, SCENE_STYLES_PREF_KEY,/);
  const qr = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/launch/qr-look-actions.ts'), 'utf8'));
  /* The QR look is DRAFTED on main (2026-09-29): its pick goes to the draft and
     Apply merges it into the blob — so it never writes the column live. */
  assert.match(qr, /saveHubDraftPatch\(eventId, \{ events: \{ style_preferences: \{ \[QR_STYLE_PREF_KEY\]: merged \} \} \}\)/, 'the QR look is drafted');
  assert.ok(!/\.update\(/.test(qr), 'the QR look never writes style_preferences live');
});
