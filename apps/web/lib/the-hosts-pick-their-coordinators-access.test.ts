/**
 * 🔑 THE HOSTS PICK THEIR COORDINATOR'S ACCESS ON HOME — LIMITED OR FULL (owner, verbatim, 2026-10-29: *"Once the
 * coordinator accepts, and connected to the event. The event should show to pick what kind of access do we want to
 * give the coordinator. On the home."* · *"only TWO levels"* · *"Since our coordinator is already booked and they
 * connected already, that command should initiate"*).
 *
 * Properties:
 *   1 · "not chosen yet" is a RECORDED answer (`permissions_json.access_level`), never inferred from the areas — a
 *       connected seat with the old narrow grant `{"areas":{"seat_plan":"view"}}` and no answer asks; a waiting seat,
 *       a removed seat and an answered seat do not;
 *   2 · each level IS a shipped seat: Full = the co-host seat (co-host template); Limited = the coordinator's seat with
 *       view on every part, editing nothing; the seat-as-it-was is kept for Undo, and answering again keeps the FIRST
 *       snapshot;
 *   3 · ONE door, no new server action: `setDelegateArea` branches on `area = 'access_level'`, host-only, never one's
 *       own seat, a refused write is not success;
 *   4 · Home draws the card for the owners only, self-hiding, a refused read said; Event details › Access keeps the
 *       choice changeable; the door into the event follows the answer (Full → co-host seat, Limited → still opens).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  LIMITED_AREAS,
  levelCardTitle,
  levelOf,
  levelWrite,
  seatAsksForLevel,
  undoWrite,
  type LevelSeat,
  type LevelTemplates,
  type LevelledPermissions,
} from './coordinator-access-level';
import { DELEGATE_AREAS, resolveAreaLevel } from './delegate-areas';
import { seatIsFullCohost } from './guest-access';
import { eventsYouRun, seatRunsTheEvent, type CoordinatorSeatRow } from './events-you-run';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The shipped templates, as `lib/event-moderators.ts` PERMISSION_TEMPLATES holds them (checked below by source). */
const T: LevelTemplates = {
  co_host: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false },
  wedding_planner_external: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false },
};

const NARROW = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { seat_plan: 'view' } } as LevelledPermissions;
const seat = (over: Partial<LevelSeat> = {}): LevelSeat => ({
  role_subtype: 'wedding_planner_external',
  user_id: 'coord-uid',
  accepted_at: '2026-10-20T00:00:00Z',
  removed_at: null,
  permissions_json: NARROW,
  ...over,
});

test('1 · 🔑 the live coordinator with the old seat_plan-only grant and no answer IS asked', () => {
  assert.equal(levelOf(seat()), null);
  assert.equal(seatAsksForLevel(seat()), true, 'an already-connected coordinator is never asked');
  assert.equal(seatAsksForLevel(seat({ permissions_json: null })), true);
  // Not asked: waiting for her · removed · answered · not the coordinator's seat.
  assert.equal(seatAsksForLevel(seat({ user_id: null })), false);
  assert.equal(seatAsksForLevel(seat({ accepted_at: null })), false);
  assert.equal(seatAsksForLevel(seat({ removed_at: '2026-10-21T00:00:00Z' })), false);
  assert.equal(seatAsksForLevel(seat({ permissions_json: { ...NARROW, access_level: 'limited' } })), false);
  assert.equal(seatAsksForLevel(seat({ role_subtype: 'viewer' })), false);
  assert.equal(seatAsksForLevel(seat({ role_subtype: 'co_host' })), false);
  assert.equal(levelCardTitle('Glam by Ana'), 'Glam by Ana is your coordinator — what can they do?');
  assert.equal(levelCardTitle('  '), 'Your coordinator has joined — what can they do?', 'a blank name');
});

test('2 · Full = the co-host seat; Limited = view every part, edit nothing; the seat-as-it-was is kept', () => {
  const now = { role_subtype: 'wedding_planner_external', permissions_json: NARROW };
  const full = levelWrite('full', now, T);
  assert.equal(full.role_subtype, 'co_host');
  assert.ok(seatIsFullCohost(full.role_subtype), 'Full is not a full co-host seat — no Event Hub Apply');
  assert.equal(levelOf(full), 'full');
  assert.deepEqual((full.permissions_json as LevelledPermissions).prior, now);

  const limited = levelWrite('limited', now, T);
  assert.equal(limited.role_subtype, 'wedding_planner_external');
  assert.equal(levelOf(limited), 'limited');
  for (const a of DELEGATE_AREAS) assert.equal(resolveAreaLevel(limited.permissions_json, a), 'view', `${a} is not view`);
  assert.equal(limited.permissions_json?.edit_all, false, 'Limited edits everything');
  assert.deepEqual(Object.keys(LIMITED_AREAS).sort(), [...DELEGATE_AREAS].sort());

  // Changing the answer keeps the FIRST snapshot; Undo restores exactly it.
  const changed = levelWrite('limited', full, T);
  assert.deepEqual((changed.permissions_json as LevelledPermissions).prior, now);
  assert.deepEqual(undoWrite(changed), now);
  assert.equal(undoWrite(now), null, 'Undo invents something to go back to');
});

test('3 · ONE door: setDelegateArea branches on access_level — host-only, not one’s own, a refused write is not ok', () => {
  const actions = src('app/dashboard/[eventId]/hosts/actions.ts');
  assert.match(actions, /if \(area === ACCESS_LEVEL_AREA\) return setCoordinatorAccessLevel\(eventId, moderatorId, choice\);/);
  assert.doesNotMatch(actions, /export async function setCoordinatorAccessLevel/, 'a new server action (the route budget is at its ceiling)');
  const fn = actions.slice(actions.indexOf('async function setCoordinatorAccessLevel'));
  assert.match(fn, /\.eq\('member_type', 'couple'\)/, 'not host-only');
  assert.match(fn, /if \(seat\.user_id === user\.id\) return \{ ok: false/);
  assert.match(fn, /const wasCoordinator = seat\.role_subtype === COORDINATOR_ROLE \|\| levelOf\(seat\) !== null;/, 'a guest-list co-host or a helper could be re-levelled');
  assert.match(fn, /if \(!changed \|\| changed\.length === 0\) \{/, 'zero rows changed reads as success');
  assert.match(fn, /co_host: PERMISSION_TEMPLATES\.co_host,\s*wedding_planner_external: PERMISSION_TEMPLATES\.wedding_planner_external,/);
  // The templates this test uses are the shipped ones.
  const tmpl = src('lib/event-moderators.ts');
  assert.match(tmpl, /co_host: \{ edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false \}/);
});

test('4 · Home: owners only, self-hiding, a refused read said; Access keeps it changeable', () => {
  const card = src('app/dashboard/[eventId]/_components/coordinator-level-card.tsx');
  assert.match(card, /if \(\(me as \{ member_type\?: string \| null \} \| null\)\?\.member_type !== 'couple'\) return null;/, 'shown to someone who is not an owner');
  assert.match(card, /\(s\) => seatAsksForLevel\(s\) && s\.user_id !== userId/);
  assert.match(card, /if \(seats\.length === 0\) return null;/);
  assert.match(card, /unread accessHref=/, 'a refused read is silent');
  assert.match(src('app/dashboard/[eventId]/page.tsx'), /<CoordinatorLevelCard eventId=\{eventId\} userId=\{user\.id\} \/>/);
  const ask = src('app/dashboard/[eventId]/_components/coordinator-level-ask.tsx');
  assert.match(ask, /setDelegateArea\(eventId, ask\.moderatorId, ACCESS_LEVEL_AREA, level\)/);
  assert.match(ask, /setDelegateArea\(eventId, ask\.moderatorId, ACCESS_LEVEL_AREA, ACCESS_LEVEL_UNDO\)/);
  assert.match(ask, /action=\{said\.undo \? \{ label: 'Undo'/, 'no Undo in the toast');
  const access = src('app/dashboard/[eventId]/details/_components/people-with-access.tsx');
  assert.match(access, /setDelegateArea\(eventId, moderatorId, ACCESS_LEVEL_AREA, next\)/, 'the answer is not changeable in Event details › Access');
  assert.match(access, /row\.coordinatorLevel !== undefined && !row\.isViewer && !readOnly \? <CoordinatorLevelPick/);
});

test('4 · the door into the event follows the answer', () => {
  const ev = { event_id: 'e-1', display_name: 'Claire & Indalecio', event_type: 'wedding', event_date: '2026-12-12', event_end_date: null, event_date_precision: 'day', venue_name: 'Seda' };
  const now = new Date('2026-10-29T00:00:00Z');
  const asRow = (s: { role_subtype: string; permissions_json: unknown }): CoordinatorSeatRow => ({
    event_id: 'e-1',
    role_subtype: s.role_subtype,
    permissions_json: s.permissions_json as CoordinatorSeatRow['permissions_json'],
    accepted_at: '2026-10-20T00:00:00Z',
    removed_at: null,
    events: ev,
  });
  const before = { role_subtype: 'wedding_planner_external', permissions_json: NARROW };
  const full = asRow(levelWrite('full', before, T));
  assert.equal(seatRunsTheEvent(full, now), true, 'Full access lost the door');
  assert.equal(eventsYouRun([full], now, '2026-10-29')[0]!.seatWord, 'Coordinator', 'a Full coordinator is called a co-host');
  const limited = asRow(levelWrite('limited', before, T));
  assert.equal(seatRunsTheEvent(limited, now), true, 'Limited lost the door into the event she may view');
});
