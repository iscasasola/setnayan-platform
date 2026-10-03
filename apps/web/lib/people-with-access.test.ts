/**
 * people-with-access.test.ts — Event Details › People with access (owner
 * 2026-10-03): one row per person, Edit · View · Off per area, and ONE home.
 *
 * What it holds:
 *   1. Every area offers ONLY the levels something enforces (`areaChoices`):
 *      four areas Edit · View · Off, Budget & payments and Photos View · Off,
 *      Event Hub and Mood Board not settable (no reader asks for them).
 *   2. The rows: co-hosts first (every area, Edit, no dropdowns), then
 *      coordinators and helpers (a cell per area, read from their own grant
 *      through `resolveAreaLevel`), then each booked supplier.
 *   3. The coordinator's defaults read back exactly as the owner set them.
 *   4. A delegate's access ends 7 days after the event; the hosts' never does.
 *   5. ONE home: nothing outside the section sets access (render-level reach
 *      is held by `event-details-shows-the-map.test.ts` and
 *      `a-mounted-action-keeps-its-control.test.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  COORDINATOR_AREAS,
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  areaChoices,
  type ModeratorPermissions,
} from './delegate-areas';
import { delegateAccessLastDay } from './delegate-access-window';
import { areaCells, buildPeopleWithAccess, peopleWithAccessHref, type SeatInput } from './people-with-access';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

const NOW = new Date('2027-01-10T00:00:00Z');
const WINDOW = { eventDate: '2027-03-03', eventEndDate: null, precision: 'day' };

const seat = (over: Partial<SeatInput>): SeatInput => ({
  moderatorId: 'm',
  userId: 'u',
  guestId: null,
  roleSubtype: 'viewer',
  displayLabel: null,
  invitationEmail: null,
  invitationToken: null,
  invitationExpiresAt: null,
  permissions: null,
  ...over,
});

test('the owner’s area names, in the owner’s order', () => {
  assert.deepEqual(
    DELEGATE_AREAS.map((a) => DELEGATE_AREA_LABEL[a]),
    ['Guest list', 'Seat plan', 'The Day', 'Suppliers', 'Event Hub', 'Mood Board', 'Budget & payments', 'Photos'],
  );
});

test('each area offers only the levels something enforces', () => {
  for (const a of ['guest_list', 'seat_plan', 'schedule', 'vendors'] as const) {
    assert.deepEqual(areaChoices(a), ['edit', 'view', 'off'], a);
  }
  assert.deepEqual(areaChoices('budget'), ['view', 'off'], 'Budget & payments is never Edit (locked D1)');
  assert.deepEqual(areaChoices('photos'), ['view', 'off'], 'Photos is never Edit');
  assert.equal(areaChoices('invitations'), null, 'Event Hub offers a dropdown nothing enforces');
  assert.equal(areaChoices('mood_board'), null, 'Mood Board offers a dropdown nothing enforces');
});

test('a coordinator’s defaults read back as the owner set them', () => {
  const perms: ModeratorPermissions = {
    edit_all: true,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: { ...COORDINATOR_AREAS },
  };
  const byArea = Object.fromEntries(areaCells(perms).map((c) => [c.area, c.choice]));
  assert.deepEqual(byArea, {
    guest_list: 'edit',
    seat_plan: 'edit',
    schedule: 'edit',
    vendors: 'edit',
    invitations: 'view', // not settable yet — every delegate can open it, no one but a host edits it
    mood_board: 'view',
    budget: 'off',
    photos: 'off',
  });
});

test('Off is what an `areas` map that does not name an area resolves to — never a gap', () => {
  const byArea = Object.fromEntries(
    areaCells({ edit_all: true, checkout: true, invite_hosts: false, remove_hosts: false, areas: { seat_plan: 'view' } }).map(
      (c) => [c.area, c.choice],
    ),
  );
  assert.equal(byArea.seat_plan, 'view');
  for (const a of ['guest_list', 'schedule', 'vendors', 'budget', 'photos']) assert.equal(byArea[a], 'off', a);
});

test('the rows: co-hosts, then coordinators, then helpers, then booked suppliers', () => {
  const rows = buildPeopleWithAccess({
    hosts: [
      { userId: 'creator', name: 'Maria', isCreator: true },
      { userId: 'jose', name: 'Jose', isCreator: false },
    ],
    seats: [
      seat({ moderatorId: 'jose-seat', userId: 'jose', guestId: 'g-jose', roleSubtype: 'groom' }),
      seat({ moderatorId: 'helper', userId: 'h', guestId: 'g-tita', roleSubtype: 'viewer', permissions: { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { guest_list: 'view' } } }),
      seat({ moderatorId: 'planner', userId: 'p', roleSubtype: 'wedding_planner_external', displayLabel: 'Ate Planner', permissions: { edit_all: true, checkout: false, invite_hosts: false, remove_hosts: false, areas: { ...COORDINATOR_AREAS } } }),
      seat({ moderatorId: 'stale-invite', userId: null, roleSubtype: 'wedding_planner_external', invitationToken: 't', invitationExpiresAt: '2027-01-01T00:00:00Z' }),
      seat({ moderatorId: 'waiting-cohost', userId: null, guestId: 'g-ana', roleSubtype: 'co_host' }),
    ],
    seatGuests: new Map([
      ['g-jose', { guestId: 'g-jose', name: 'Jose Cruz', firstName: 'Jose', role: 'groom' }],
      ['g-tita', { guestId: 'g-tita', name: 'Tita Lory', firstName: 'Tita', role: 'ninang' }],
      ['g-ana', { guestId: 'g-ana', name: 'Ana Reyes', firstName: 'Ana', role: 'guest' }],
    ]),
    userNames: new Map(),
    suppliers: [{ vendorId: 'v', name: 'Lights Co', categoryLabel: 'Lights & sound', isPlanner: false }],
    window: WINDOW,
    viewerUserId: 'creator',
    now: NOW,
  });
  assert.deepEqual(
    rows.map((r) => [r.kind, r.name]),
    [
      ['co_host', 'Maria'],
      ['co_host', 'Jose'],
      ['co_host', 'Ana Reyes'],
      ['coordinator', 'Ate Planner'],
      ['helper', 'Tita Lory'],
      ['supplier', 'Lights Co'],
    ],
    'an expired planner invite is dropped; every other person appears once',
  );
  const [maria, jose, ana, planner, tita, lights] = rows;
  assert.equal(maria!.access?.lock, 'creator');
  assert.equal(maria!.isViewer, true);
  assert.equal(jose!.access?.lock, 'celebrant', 'the groom is a celebrant co-host — fixed');
  assert.equal(ana!.live, false, 'a co-host who has not joined is waiting');
  for (const r of [maria, jose, ana]) assert.equal(r!.areas, null, 'a co-host has every area, Edit — no dropdowns');
  assert.equal(planner!.areas?.length, DELEGATE_AREAS.length);
  assert.equal(tita!.areas?.find((c) => c.area === 'guest_list')?.choice, 'view');
  assert.equal(tita!.access?.level, 'limited_helper');
  assert.equal(lights!.areas, null, 'a supplier’s access is their booking’s — not set here yet');
  assert.equal(planner!.lastDay, '2027-03-10', 'a delegate’s access ends 7 days after the event');
  assert.equal(maria!.lastDay, null, 'a host’s access never ends');
});

test('a booked planner nobody invited carries the invite door; one already seated does not', () => {
  const build = (seats: SeatInput[]) =>
    buildPeopleWithAccess({
      hosts: [],
      seats,
      seatGuests: new Map(),
      userNames: new Map(),
      suppliers: [{ vendorId: 'pl', name: 'Plan Co', categoryLabel: 'Planning', isPlanner: true }],
      window: WINDOW,
      viewerUserId: 'x',
      now: NOW,
    }).find((r) => r.kind === 'supplier')!;
  assert.equal(build([]).canInviteAsCoordinator, true);
  assert.equal(build([seat({ roleSubtype: 'wedding_planner_external' })]).canInviteAsCoordinator, false);
});

test('the window: closed after the seventh day, never for a host, never on a guess', () => {
  assert.equal(delegateAccessLastDay({ isCouple: false, eventDate: '2027-03-03', precision: 'day' }), '2027-03-10');
  assert.equal(delegateAccessLastDay({ isCouple: true, eventDate: '2027-03-03', precision: 'day' }), null);
  assert.equal(delegateAccessLastDay({ isCouple: false, eventDate: null }), null);
  assert.equal(delegateAccessLastDay({ isCouple: false, eventDate: '2027-03-03', precision: 'year' }), null);
  const ended = buildPeopleWithAccess({
    hosts: [],
    seats: [seat({ roleSubtype: 'viewer' })],
    seatGuests: new Map(),
    userNames: new Map(),
    suppliers: [],
    window: WINDOW,
    viewerUserId: 'x',
    now: new Date('2027-03-11T00:00:00Z'),
  })[0]!;
  assert.equal(ended.ended, true);
});

test('ONE home: outside People with access, no screen sets access', () => {
  // The four setters of a seat's access, and the files allowed to CALL them.
  const SETTERS = ['setDelegateArea', 'setGuestAccess', 'setDelegateBudget', 'setDelegatePhotos', 'revokeArea'];
  const ALLOWED = new Set([
    'app/dashboard/[eventId]/details/_components/people-with-access.tsx',
    'app/dashboard/[eventId]/hosts/actions.ts',
    'app/dashboard/[eventId]/guests/[guestId]/access-actions.ts',
  ]);
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) {
        if (n === 'node_modules' || n === '.next') continue;
        walk(p);
      } else if (/\.(tsx?|mjs)$/.test(n) && !/\.test\.ts$/.test(n)) {
        const rel = p.slice(WEB.length + 1);
        if (ALLOWED.has(rel)) continue;
        const src = stripComments(readFileSync(p, 'utf8'));
        for (const s of SETTERS) if (new RegExp(`\\b${s}\\b`).test(src)) offenders.push(`${rel} → ${s}`);
      }
    }
  };
  walk(join(WEB, 'app'));
  walk(join(WEB, 'lib'));
  assert.deepEqual(offenders, [], 'a second place sets access — People with access is its one home (replace means remove)');
  assert.equal(peopleWithAccessHref('E'), '/dashboard/E/details#people-with-access');
});
