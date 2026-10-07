/**
 * event-access-is-its-own-fold.test.ts — EVENT ACCESS is its own top-level
 * fold on Event Details, mounted once, between Guests & money and Put this
 * away, grouped Hosts · Coordinator · Helpers · Booked suppliers; a helper's
 * area is ONE three-way toggle (Edit · Off · View), the coordinator ONE switch.
 *
 * ⚖ Owner 2026-10-07, on his phone: *"the Event Access is not here: Host:
 * Helper: Vendors: and toggles on what they can access?"* — and, seeing it
 * under the last supplier row: *"you placed people with access under Host/MC …
 * they are different"*. People with access had been drawn INSIDE Guests &
 * money, right after Your suppliers, so it read as part of a supplier. Then:
 * *"3 way toggle Edit - OFF - View"* · *"Coordinator Access is Same as User
 * Host of the event. so toggle is just yes or no. Always auto YES"* · *"Booked
 * Vendor Access? is defined depending on the category they provide"*.
 *
 * No DOM in this runner: the pure half (`accessFoldSummary`, `ACCESS_GROUPS`)
 * runs for real; the placement is pinned against the source, comments stripped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { RECORD_GROUPS } from '@/lib/event-details-record';
import {
  ACCESS_GROUPS,
  ACCESS_SUMMARY_FAILED,
  AREA_TOGGLE_ORDER,
  COORDINATOR_ON_AREAS,
  SUPPLIERS_BY_CATEGORY,
  accessFoldSummary,
  accessGroupOf,
  areaCells,
  coordinatorHasHostAccess,
  coordinatorSwitchWrites,
  type PersonRow,
} from '@/lib/people-with-access';
import { COORDINATOR_AREAS } from '@/lib/delegate-areas';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAGE = read('app/dashboard/[eventId]/details/page.tsx');
const SECTION = read('app/dashboard/[eventId]/details/_components/people-with-access.tsx');

test('Event access is a top-level group of its own, named for access', () => {
  const g = RECORD_GROUPS.find((x) => x.key === 'access');
  assert.ok(g, 'there is no Event access group');
  assert.equal(g.title, 'Event access');
  assert.equal(RECORD_GROUPS[RECORD_GROUPS.length - 1]!.key, 'access', 'Event access is not the last fold');
});

test('mounted once, in its own fold, between Guests & money and Put this away', () => {
  const folds = [...PAGE.matchAll(/<RecordFold group="access"/g)];
  assert.equal(folds.length, 1, 'the Event access fold is not drawn exactly once');
  assert.equal((PAGE.match(/<PeopleWithAccess\b/g) ?? []).length, 1, 'People with access is not mounted exactly once');

  const money = PAGE.indexOf('<RecordFold group="guests-money"');
  const access = folds[0]!.index!;
  const mount = PAGE.indexOf('<PeopleWithAccess');
  const putAway = PAGE.indexOf('data-section="put-away"');
  assert.ok(money > 0 && money < access, 'Event access is not after Guests & money');
  assert.ok(access < mount && mount < putAway, 'People with access is not inside the Event access fold, before Put this away');

  // Nothing of it is left inside Guests & money (where it read as a supplier).
  const moneyBody = PAGE.slice(money, access);
  assert.ok(!moneyBody.includes('<PeopleWithAccess'), 'People with access is still inside Guests & money');
  assert.ok(!/sectionTitle\('access'\)/.test(moneyBody), 'the old People with access heading is still inside Guests & money');

  // The fold carries a one-line summary counted from the real rows.
  assert.match(PAGE, /<RecordFold group="access" title=\{groupTitle\('access'\)\} summary=\{summary\.access\}/);
  assert.match(PAGE, /access: people \? accessFoldSummary\(people\.measured \? people\.rows : null\)/, 'the summary is not counted from the rows, or a failed read is not passed as a failure');
});

test('four plain groups — Hosts · Coordinator · Helpers · Booked suppliers — and no box of its own', () => {
  assert.deepEqual(
    ACCESS_GROUPS.map((g) => g.title),
    ['Hosts', 'Coordinator', 'Helpers', 'Booked suppliers'],
  );
  assert.match(SECTION, /ACCESS_GROUPS\.map\(/, 'the section does not draw the groups');
  assert.match(SECTION, /<h3[^>]*>\{g\.title\}<\/h3>/, 'a group has no heading');
  assert.doesNotMatch(SECTION, /\bsn-tile\b/, 'the section draws its own box inside the fold');
  assert.match(SECTION, /g\.key === 'helpers' && !readOnly \? <AddPerson /, 'the Add-from-guest-list picker left the Helpers group');
  // A booked supplier: name + category, one line that their category sets it — nothing to switch.
  assert.match(SECTION, /\{SUPPLIERS_BY_CATEGORY\}/);
  assert.doesNotMatch(SUPPLIERS_BY_CATEGORY, /vendor/i);
});

test('a helper’s area is ONE three-way toggle — Edit · Off · View, Off in the middle — with an ⓘ', () => {
  assert.deepEqual([...AREA_TOGGLE_ORDER], ['edit', 'off', 'view']);
  const fn = SECTION.slice(SECTION.indexOf('function AreaPicks('), SECTION.indexOf('function CoordinatorSwitch('));
  assert.match(fn, /<AreaToggle\b/, 'an area is not drawn as the three-way toggle');
  assert.match(fn, /<InfoTip\b[\s\S]*?DELEGATE_AREA_DOES\[cell\.area\]/, 'an area has no ⓘ saying what it lets them do');
  assert.doesNotMatch(fn, /<PickMenu\b/, 'an area is still a dropdown');
  assert.match(fn, /setDelegateArea\(eventId, moderatorId, cell\.area, next\)/, 'the toggle does not save through the one action');
  const toggle = SECTION.slice(SECTION.indexOf('function AreaToggle('), SECTION.indexOf('function AreaPicks('));
  assert.match(toggle, /role="radiogroup"/);
  assert.match(toggle, /AREA_TOGGLE_ORDER\.map\(/, 'the toggle does not draw the owner’s order');
});

test('the coordinator is ONE switch on the same per-area grant — YES by default', () => {
  // ON = the areas the coordinator's default grant puts at Edit, a host can set.
  assert.deepEqual([...COORDINATOR_ON_AREAS], ['guest_list', 'seat_plan', 'schedule', 'vendors']);
  const fresh = areaCells({ edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { ...COORDINATOR_AREAS } });
  assert.equal(coordinatorHasHostAccess(fresh), true, 'a new coordinator seat does not start with the switch ON');
  assert.deepEqual(coordinatorSwitchWrites(fresh, true), [], 'turning ON a default seat writes something');
  // OFF: every settable area to Off, the fixed ones untouched; Budget/Photos never raised by ON.
  const off = coordinatorSwitchWrites(fresh, false);
  assert.deepEqual(off.map((w) => w.area), ['guest_list', 'seat_plan', 'schedule', 'vendors']);
  assert.ok(off.every((w) => w.choice === 'off'));
  const allOff = fresh.map((c) => (c.choices ? { ...c, choice: 'off' as const } : c));
  assert.equal(coordinatorHasHostAccess(allOff), false);
  assert.deepEqual(coordinatorSwitchWrites(allOff, true).map((w) => `${w.area}:${w.choice}`), ['guest_list:edit', 'seat_plan:edit', 'schedule:edit', 'vendors:edit']);
  // The row draws the switch, not per-area toggles, and saves through the one action.
  assert.match(SECTION, /row\.kind === 'coordinator' && !row\.isViewer \? \(\s*<CoordinatorSwitch /);
  const sw = SECTION.slice(SECTION.indexOf('function CoordinatorSwitch('), SECTION.indexOf('function AccessPick('));
  assert.match(sw, /role="switch"/);
  assert.match(sw, /setDelegateArea\(eventId, moderatorId, w\.area, w\.choice\)/);
});

test('who goes in which group', () => {
  assert.equal(accessGroupOf('co_host'), 'hosts');
  assert.equal(accessGroupOf('coordinator'), 'coordinator');
  assert.equal(accessGroupOf('helper'), 'helpers');
  assert.equal(accessGroupOf('supplier'), 'suppliers');
});

test('the closed line counts the real rows; a failed read never reads as zero', () => {
  const row = (kind: PersonRow['kind'], i: number) => ({ key: `${kind}${i}`, kind }) as PersonRow;
  const rows = [row('co_host', 1), row('co_host', 2), row('coordinator', 1), row('helper', 1), ...Array.from({ length: 12 }, (_, i) => row('supplier', i))];
  assert.equal(accessFoldSummary(rows), '2 hosts · 1 coordinator · 1 helper · 12 suppliers');
  assert.equal(accessFoldSummary([row('co_host', 1), row('helper', 1), row('helper', 2)]), '1 host · 2 helpers');
  assert.equal(accessFoldSummary(null), ACCESS_SUMMARY_FAILED);
  assert.doesNotMatch(accessFoldSummary(null), /\b0\b/);
});
