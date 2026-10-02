/**
 * create-forms-round-trip.test.ts — create → read back every field, for the
 * create forms the Root map can follow end to end (owner, DECISION_LOG
 * 2026-10-02 "…'FILLED IN BUT NOT SAVED'": "every create form gets a
 * round-trip test").
 *
 * Each case walks one form through the Fields map (scanned fresh) — input → the action's
 * field → its home column → the screen that shows the new thing — via
 * `roundTrip()` (lib/ugat/round-trip.ts). Every input must be accounted for,
 * and the two failure lists are pinned EXACTLY: a field that starts being
 * dropped, or a column the reader stops selecting, turns this red; fixing a
 * known gap turns it red too, so the fix updates the expectation in the same
 * pull request. The create forms NOT listed here are named in the Root map
 * report (ROOT_MAP_PART2_FIRST_RUN) — `createForms()` finds them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createForms, roundTrip, type RoundTripInput } from './round-trip';
import { scanFields } from './scan-fields';
import type { UgatFieldsMap } from './fields';

const HERE = dirname(fileURLToPath(import.meta.url));
// The Fields map, scanned fresh (it is not committed — see .gitignore).
const MAP = scanFields({
  webRoot: resolve(HERE, '..', '..'),
  screens: JSON.parse(readFileSync(join(HERE, 'screens.generated.json'), 'utf8')),
});

const D = 'app/dashboard/[eventId]';
export const ROUND_TRIP_CASES: Array<RoundTripInput & { name: string; notSaved: string[]; notReadBack: string[] }> = [
  { name: 'Guest list › Add a guest', form: `${D}/guests/new/page.tsx`, action: `${D}/guests/new/actions.ts#createGuest`, reader: '/dashboard/[eventId]/guests/[guestId]', notSaved: [], notReadBack: [] },
  // `prep` is saved as a CHOICE: `if (prep) insertRow.visibility = 'coordinator_only'`.
  { name: 'Schedule › Add a moment', form: `${D}/schedule/page.tsx`, action: `${D}/schedule/actions.ts#createScheduleBlock`, reader: '/dashboard/[eventId]/schedule', notSaved: [], notReadBack: [] },
  { name: 'Sponsors › Add a sponsor', form: `${D}/sponsors/_components/add-sponsor-modal.tsx`, action: `${D}/sponsors/actions.ts#addSponsor`, reader: '/dashboard/[eventId]/sponsors', notSaved: [], notReadBack: [] },
  { name: 'Seating › Add a table', form: `${D}/seating/_components/seating-editor.tsx`, action: `${D}/seating/actions.ts#createTable`, reader: '/dashboard/[eventId]/seating', notSaved: [], notReadBack: [] },
  { name: 'Budget › Add a line item', form: `${D}/_components/vendor-itemization-card.tsx`, action: `${D}/budget/actions.ts#addLineItem`, reader: '/dashboard/[eventId]/budget', notSaved: [], notReadBack: [] },
  { name: 'Manpower › Post a gig', form: `${D}/manpower/_components/post-gig-drawer.tsx`, action: 'app/vendor-dashboard/manpower/actions.ts#postManpowerGig', reader: '/dashboard/[eventId]/manpower', notSaved: [], notReadBack: [] },
  { name: 'My shop › Add a service', form: 'app/vendor-dashboard/services/_components/services-manager.tsx', action: 'app/vendor-dashboard/services/actions.ts#createVendorService', reader: '/vendor-dashboard/services', notSaved: [], notReadBack: [] },
  { name: 'My shop › Add a payment method', form: 'app/vendor-dashboard/payment-options/_components/add-payment-method.tsx', action: 'app/vendor-dashboard/payment-options/actions.ts#addPaymentMethod', reader: '/vendor-dashboard/shop', notSaved: [], notReadBack: [] },
  { name: 'Samahan › Start a community', form: 'app/dashboard/(account)/samahan/new/page.tsx', action: 'app/dashboard/(account)/samahan/actions.ts#createCommunity', reader: '/dashboard/samahan/[communityId]', notSaved: [], notReadBack: [] },
];

for (const c of ROUND_TRIP_CASES) {
  test(`round trip — ${c.name}`, () => {
    const r = roundTrip(MAP, c);
    assert.ok(r.inputs.length > 0, 'the form has inputs the map can see');
    const accounted = new Set([...Object.keys(r.saved), ...r.notSaved, ...r.passedOn]);
    assert.deepEqual([...accounted].sort(), [...r.inputs].sort(), 'every input is saved, dropped or passed on — none vanishes');
    assert.deepEqual(r.notSaved, c.notSaved, 'filled in but not saved');
    assert.deepEqual(r.notReadBack, c.notReadBack, 'saved but not read back by the screen that shows it');
  });
}

test('the helper itself: a dropped input and an unread column are named', () => {
  const map: UgatFieldsMap = {
    version: 1,
    screens: [{ id: '/r', reads: ['t.a'], writes: [], actions: [], calcs: [] }],
    actions: [{ ref: 'a.ts#make', fields: ['a', 'b', 'c'], readsAll: false, writes: ['t.a', 't.b'], saves: { a: ['t.a'], b: ['t.b'] }, dropped: ['c'] }],
    forms: [{ from: 'f.tsx', actions: ['a.ts#make'], inputs: ['a', 'b', 'c', 'd'], notRead: ['d'] }],
    writers: [],
    stores: [],
  };
  const r = roundTrip(map, { form: 'f.tsx', action: 'a.ts#make', reader: '/r' });
  assert.deepEqual(r.notSaved, ['c', 'd']);
  assert.deepEqual(r.notReadBack, ['t.b']);
});

test('the create forms are found — the list the report names the untested ones from', () => {
  const all = createForms(MAP);
  assert.ok(all.length >= 40, `only ${all.length} create forms found`);
  for (const c of ROUND_TRIP_CASES) {
    assert.ok(all.some((x) => x.form === c.form && x.action === c.action), `${c.name} is a create form`);
  }
});
