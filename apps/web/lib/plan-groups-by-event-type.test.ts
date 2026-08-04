/**
 * The per-event-type category ladder.
 *
 * A birthday was told "21 categories still open" and handed "Lock your
 * reception venue" as its top decision, because every counter iterated the
 * hardcoded WEDDING `PLAN_GROUPS` for all 16 event types.
 *
 * The most important assertion in this file is the FIRST one: weddings must not
 * shrink. Everything else here narrows a ladder, and a narrowing bug that ate a
 * wedding category would mean a couple never being reminded to book their
 * venue — strictly worse than the defect being fixed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PLAN_GROUPS } from './wedding-plan-groups';
import {
  planGroupsForEventType,
  PLAN_GROUP_SCOPE_UNKNOWN,
  type PlanGroupScope,
} from './plan-groups-by-event-type';

/** A scope shaped like prod: tiles carry allow-lists, and wedding is in each. */
const scope: PlanGroupScope = new Map<string, readonly string[] | null>([
  ['ceremony_venue', ['wedding', 'christening']],
  ['bridal_car', ['wedding']],
  ['jewelleries_accessories', ['wedding', 'debut', 'anniversary', 'graduation']],
  ['choreographer', ['wedding', 'debut']],
  ['crew_meals', ['wedding', 'debut', 'corporate', 'tournament', 'gala_night']],
  ['led_wall', ['wedding', 'debut', 'corporate', 'gala_night']],
  ['cake', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['reception', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['catering', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['photo_video', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['coordinator', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['hmua', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['florist', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['stylist_decorator', ['wedding', 'debut', 'birthday', 'christening']],
  ['live_band', ['wedding', 'debut', 'birthday', 'celebration']],
  ['dj', ['wedding', 'debut', 'birthday', 'celebration']],
  ['host_mc', ['wedding', 'debut', 'birthday', 'christening', 'celebration']],
  ['lights_sound', ['wedding', 'debut', 'birthday', 'celebration']],
  ['mobile_bar', ['wedding', 'debut', 'birthday', 'celebration']],
  ['photo_booth', ['wedding', 'debut', 'birthday', 'celebration']],
  ['guest_shuttle', ['wedding', 'debut', 'birthday', 'christening']],
  ['printing', ['wedding', 'debut', 'birthday', 'christening']],
]);

test('🔒 a wedding keeps EVERY plan group', () => {
  const wedding = planGroupsForEventType('wedding', scope);
  assert.equal(
    wedding.length,
    PLAN_GROUPS.length,
    'narrowing a wedding is worse than the bug this fixes — every prod tile ' +
      'allow-list contains "wedding", so the wedding ladder must be untouched',
  );
});

test('a birthday drops the wedding-only categories', () => {
  const birthday = planGroupsForEventType('birthday', scope);
  const ids = new Set<string>(birthday.map((g) => g.id));

  // Scoped AWAY from birthday in prod.
  assert.equal(ids.has('ceremony_venue'), false, 'a birthday has no ceremony venue');
  assert.equal(ids.has('bridal_car'), false, 'a birthday has no bridal car');
  assert.equal(ids.has('rings'), false, 'rings ⇒ jewelleries_accessories, wedding/debut/anniversary/graduation');
  assert.equal(ids.has('crew_meals'), false);

  // Genuinely shared — must survive.
  for (const kept of ['reception_venue', 'catering', 'cake', 'photography', 'coordinator']) {
    assert.equal(ids.has(kept), true, `${kept} applies to a birthday`);
  }
  assert.ok(birthday.length < PLAN_GROUPS.length, 'the ladder must actually narrow');
});

test('christening keeps the ceremony but not the bridal car', () => {
  const ids = new Set<string>(planGroupsForEventType('christening', scope).map((g) => g.id));
  assert.equal(ids.has('ceremony_venue'), true, 'christening IS in ceremony_venue’s list');
  assert.equal(ids.has('bridal_car'), false);
});

test('FAIL-OPEN: an unreadable scope keeps the whole ladder', () => {
  // A DB hiccup must never silently shorten anyone's checklist.
  assert.deepEqual(
    planGroupsForEventType('birthday', PLAN_GROUP_SCOPE_UNKNOWN).map((g) => g.id),
    PLAN_GROUPS.map((g) => g.id),
  );
});

test('FAIL-OPEN: a NULL or empty allow-list means universal', () => {
  // The admin toggle writes [] when the last type is switched off, and the
  // marketplace reads that as "serves everything". Reading it as "serves
  // nothing" here would empty a ladder an admin thought they were widening.
  for (const list of [null, [] as string[]]) {
    const s: PlanGroupScope = new Map([['bridal_car', list]]);
    const ids = new Set<string>(planGroupsForEventType('birthday', s).map((g) => g.id));
    assert.equal(ids.has('bridal_car'), true, `list=${JSON.stringify(list)}`);
  }
});

test('a plan group with no catalogTile is universal', () => {
  // attire / music_entertainment / logistics carry no tile today — nothing to
  // scope on, so they must survive for every type.
  const untiled = PLAN_GROUPS.filter((g) => !g.catalogTile).map((g) => g.id);
  assert.ok(untiled.length > 0, 'fixture assumption: some groups carry no tile');
  const ids = new Set<string>(planGroupsForEventType('birthday', scope).map((g) => g.id));
  for (const id of untiled) assert.equal(ids.has(id), true, `${id} must survive`);
});

test('a null event type is treated as a wedding', () => {
  assert.equal(
    planGroupsForEventType(null, scope).length,
    planGroupsForEventType('wedding', scope).length,
  );
});

test('an unknown event type gets only the universally-scoped groups', () => {
  // Fail-open is per-TILE, not per-type: a brand-new type is absent from every
  // allow-list, so it keeps exactly the untiled + unlisted groups. That is the
  // honest answer — nobody has said which categories it books yet.
  const ids = new Set<string>(planGroupsForEventType('pet_adoption_party', scope).map((g) => g.id));
  assert.equal(ids.has('bridal_car'), false);
  for (const id of PLAN_GROUPS.filter((g) => !g.catalogTile).map((g) => g.id)) {
    assert.equal(ids.has(id), true);
  }
});
