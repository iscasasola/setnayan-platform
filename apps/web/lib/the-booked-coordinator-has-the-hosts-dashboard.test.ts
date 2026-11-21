/**
 * 🧭 THE BOOKED COORDINATOR — THE HOSTS' DASHBOARD MINUS MEMORIES AND PAYING (owner 2026-11-21; DECISION_LOG rows "A
 * BOOKED COORDINATOR OPENS EVERYTHING EXCEPT MEDIA FILES AND PAYMENTS" · "BOOKED COORDINATOR — WHAT THEY MAY EDIT VS
 * ONLY VIEW" · "BOOKED COORDINATOR ON BUILD: FIND + RECOMMEND + SHORTLIST, NO BOOKING, NO PAYING" · "COORDINATOR: DUE
 * PAYMENTS VIEWABLE + 'REMIND THE HOSTS', NOT LOGGABLE; ACCESS IS AUTOMATIC"; drawing
 * `prototypes/their_event_door_2026-11-21/their_event_door_fable.html`).
 *
 *   1 · the grant IS the ruling: eight parts at Edit, Budget + Payments at View, Memories shut — and the migration
 *       writes exactly the TS maps (On and Off), so the database and the screen agree;
 *   2 · the hosts can never raise Memories, nor Budget / Payments past View, on the coordinator's seat (server);
 *   3 · Memories is SHUT on the server: the page returns "The hosts keep this" before any frame is read, and the
 *       Memories actions no longer admit a coordinator;
 *   4 · Limited · Full is retired: the door answers in words and writes nothing; Home no longer asks;
 *   5 · access is automatic on booking: the shop's owner gets an ACCEPTED seat with the ruled grant, and a seat that
 *       already exists is never rewritten (the hosts' switch stays theirs);
 *   6 · Suppliers: the coordinator's cards draw no Book / Pay / Cancel and the page says "The hosts keep this";
 *   7 · "Events you run" rows carry Dashboard · Chats · Hub.
 * (Book / pay refusals: `only-a-host-books-or-pays.test.ts`. Remind the hosts: `tests/db/the-coordinator-reminds-and-
 * never-pays.db.test.ts`.)
 *
 * SABOTAGE (each turns this file red): COORDINATOR_AREAS.photos → 'view' · drop `coordinatorSeatRefusal` from
 * `setDelegateArea` · move the Memories page's `HostsKeepThis` return below `readEventMemories` · put
 * `return setCoordinatorAccessLevel(` back · write the auto seat without `accepted_at`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COORDINATOR_AREAS, COORDINATOR_OFF_AREAS, DELEGATE_AREAS, areaChoices } from './delegate-areas';
import { coordinatorSeatRefusal } from './coordinator-access-level';
import { memoriesKeptFromViewer, memoriesManagerRoleOf } from './memories-rules';
import { stripComments } from './strip-comments';
import { eventYouRunOf, type CoordinatorSeatRow } from './events-you-run';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '../..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MIGRATION = readFileSync(join(REPO, 'supabase/migrations/20271357113669_the_booked_coordinator_is_automatic.sql'), 'utf8');

test('1 · the grant IS the ruling — eight parts Edit, Budget + Payments View, Memories shut', () => {
  assert.deepEqual(COORDINATOR_AREAS, {
    guest_list: 'edit',
    seat_plan: 'edit',
    schedule: 'edit',
    vendors: 'edit',
    invitations: 'edit',
    mood_board: 'edit',
    budget: 'view',
    payments: 'view',
    photos: null,
  });
  // Every area named, explicitly — an absent key would be inferred, not ruled.
  assert.deepEqual(Object.keys(COORDINATOR_AREAS).sort(), [...DELEGATE_AREAS].sort());
  assert.deepEqual(Object.keys(COORDINATOR_OFF_AREAS).sort(), [...DELEGATE_AREAS].sort());
  for (const a of DELEGATE_AREAS) {
    const off = COORDINATOR_OFF_AREAS[a];
    const choices = areaChoices(a);
    if (choices) assert.equal(off ?? 'off', choices.includes('off') ? 'off' : 'view', `${a}: Off is not the lowest level`);
  }
});

/** The `'areas', jsonb_build_object(…)` literal of the UPDATE whose WHERE names the answer. */
function sqlAreas(answer: 'full' | 'limited'): Record<string, string | null> {
  const where = MIGRATION.indexOf(`->> 'access_level' = '${answer}'`);
  assert.ok(where > 0, `the migration no longer retires "${answer}"`);
  const start = MIGRATION.lastIndexOf("'areas', jsonb_build_object(", where);
  const body = MIGRATION.slice(start, MIGRATION.indexOf(')),', start));
  const out: Record<string, string | null> = {};
  for (const m of body.matchAll(/'([a-z_]+)',\s*(NULL|'([a-z]+)')/g)) if (m[1] !== 'areas') out[m[1]!] = m[2] === 'NULL' ? null : m[3]!;
  return out;
}

test('1b · the migration writes EXACTLY the TS maps — Full → the ruled grant, Limited → the switch Off', () => {
  assert.deepEqual(sqlAreas('full'), { ...COORDINATOR_AREAS }, 'the database and the screen disagree on the ruled grant');
  assert.deepEqual(sqlAreas('limited'), { ...COORDINATOR_OFF_AREAS }, 'a Limited seat is written wider than Off');
  assert.match(MIGRATION, /SET role_subtype = 'wedding_planner_external'[\s\S]{0,80}permissions_json = jsonb_build_object\(\s*'edit_all', true, 'checkout', false/, 'a Full seat stays a co-host (a couple member: Memories, paying)');
  assert.match(MIGRATION, /^SET LOCAL lock_timeout = '5s';/m);
});

test('2 · the hosts can never open Memories, nor Budget / Payments past View, on the coordinator’s seat', () => {
  const role = 'wedding_planner_external';
  assert.ok(coordinatorSeatRefusal(role, 'photos', 'view'));
  assert.ok(coordinatorSeatRefusal(role, 'budget', 'edit'));
  assert.ok(coordinatorSeatRefusal(role, 'payments', 'edit'));
  assert.equal(coordinatorSeatRefusal(role, 'photos', 'off'), null);
  assert.equal(coordinatorSeatRefusal(role, 'budget', 'view'), null);
  assert.equal(coordinatorSeatRefusal(role, 'guest_list', 'edit'), null);
  assert.equal(coordinatorSeatRefusal('viewer', 'photos', 'view'), null, 'a helper’s photos stay the hosts’ to raise');
  const a = code('app/dashboard/[eventId]/hosts/actions.ts');
  const fn = a.slice(a.indexOf('export async function setDelegateArea('));
  const cap = fn.indexOf('coordinatorSeatRefusal(seat.role_subtype, a, picked)');
  assert.ok(cap > 0, 'setDelegateArea no longer caps the coordinator’s seat');
  assert.ok(cap < fn.indexOf('updateJsonColumn'), 'the cap must run BEFORE the write');
});

test('3 · Memories is SHUT on the server for the coordinator — before a single frame is read', () => {
  const coordinator = { isCouple: false, delegatePermissions: { edit_all: true, checkout: false, invite_hosts: true, remove_hosts: false, areas: { ...COORDINATOR_AREAS } } };
  assert.equal(memoriesKeptFromViewer(coordinator), true);
  assert.equal(memoriesKeptFromViewer({ isCouple: true, delegatePermissions: null }), false, 'a host was shut out');
  assert.equal(memoriesKeptFromViewer({ isCouple: false, delegatePermissions: null }), true, 'a delegate past their window sees Memories');
  assert.equal(
    memoriesKeptFromViewer({ ...coordinator, delegatePermissions: { ...coordinator.delegatePermissions, areas: { ...COORDINATOR_AREAS, photos: 'view' } } }),
    false,
    'a helper the hosts gave Photos is shut out',
  );
  const page = code('app/dashboard/[eventId]/memories/page.tsx');
  const shut = page.indexOf('<HostsKeepThis title="Memories"');
  assert.ok(shut > 0, 'the Memories page lost its shut tab');
  assert.ok(shut < page.indexOf('readEventMemories(supabase'), 'the page reads the frames before shutting them');
  assert.ok(shut < page.indexOf('memoriesManagerRole(supabase'), 'the page asks the manager role before shutting');
  for (const [w, memberType, seat] of [['coordinator', 'coordinator', true], ['coordinator past window', 'coordinator', true]] as const) {
    assert.equal(memoriesManagerRoleOf({ memberType, coordinatorSeat: seat, coordinatorWindowClosed: false }), null, `${w} manages Memories`);
  }
  assert.equal(memoriesManagerRoleOf({ memberType: 'couple', coordinatorSeat: false, coordinatorWindowClosed: false }), 'host');
});

test('4 · Limited · Full is retired — the door answers in words and writes nothing; Home no longer asks', () => {
  const a = code('app/dashboard/[eventId]/hosts/actions.ts');
  assert.match(a, /if \(area === ACCESS_LEVEL_AREA\) return \{ ok: false, error: LEVEL_CHOICE_RETIRED \};/);
  assert.doesNotMatch(a, /setCoordinatorAccessLevel|levelWrite|undoWrite/, 'the retired level write is back');
  assert.doesNotMatch(code('app/dashboard/[eventId]/page.tsx'), /CoordinatorLevelCard/, 'Home asks Limited · Full again');
  assert.doesNotMatch(code('app/dashboard/[eventId]/details/_components/people-with-access.tsx'), /CoordinatorLevelPick/);
});

test('5 · access is AUTOMATIC on booking — an accepted seat with the ruled grant; an existing seat is never rewritten', () => {
  const g = code('lib/coordinator-grant.ts');
  const fn = g.slice(g.indexOf('async function openForTheBookedShop('));
  assert.ok(fn.length > 100, 'the automatic door is gone');
  const already = fn.indexOf("return 'already'");
  assert.ok(already > 0 && already < fn.indexOf(".insert("), 'a live seat is rewritten on every re-marked payment');
  assert.match(fn, /\.insert\(\{[\s\S]{0,600}user_id: ownerId,[\s\S]{0,600}accepted_at: now,/, 'the seat is not written accepted, to the shop’s owner');
  assert.match(fn, /areas: \{ \.\.\.COORDINATOR_AREAS \}/, 'the automatic seat does not carry the ruled grant');
  assert.match(fn, /\.update\(\{ user_id: ownerId, accepted_at: now, invitation_token: null/, 'a pending invite is not activated');
  // The booking path hands the booked shop through even with no contact email.
  assert.match(code('app/dashboard/[eventId]/vendors/actions.ts'), /\(prevRow\?\.contact_email \|\| prevRow\?\.marketplace_vendor_id\)/);
  // And the retired checkout opt-in never reaches a coordinator seat.
  assert.match(code('lib/event-moderators.ts'), /wedding_planner_external: \{ edit_all: true, checkout: false,/);
});

test('6 · Suppliers: no Book / Pay / Cancel for the coordinator, and the page says who books', () => {
  assert.match(code('app/dashboard/[eventId]/vendors/_components/viewer-books.tsx'), /new Set\(\['book', 'pay'\]\)/);
  assert.match(code('app/dashboard/[eventId]/vendors/_components/bench-vendor-actions.tsx'), /viewerBooks \|\| !HOST_ONLY_VERBS\.has\(v\.key\)/);
  assert.match(code('app/dashboard/[eventId]/vendors/_components/booked-row.tsx'), /if \(!viewerBooks && \(v\.key === 'pay' \|\| v\.key === 'payments' \|\| v\.key === 'cancel'\)\) return null;/);
  assert.match(code('app/dashboard/[eventId]/vendors/_components/book-this-build.tsx'), /return useViewerBooks\(\) \? <BookThisBuildBody/);
  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /<ViewerBooksProvider books=\{viewer\.isCouple\}>/);
  assert.match(page, /\{viewer\.isCouple \? null : \([\s\S]{0,120}<HelpTheHostsChoose eventId=\{eventId\} \/>/);
});

test('7 · "Events you run" rows carry Dashboard · Chats · Hub', () => {
  const row: CoordinatorSeatRow = {
    event_id: 'e1',
    role_subtype: 'wedding_planner_external',
    permissions_json: { edit_all: true, checkout: false, invite_hosts: true, remove_hosts: false, areas: { ...COORDINATOR_AREAS } },
    accepted_at: '2026-11-01T00:00:00Z',
    removed_at: null,
    events: { event_id: 'e1', display_name: 'Claire & Indalecio', event_type: 'wedding', event_date: '2026-12-12', event_end_date: null, event_date_precision: 'day', venue_name: null },
  };
  const e = eventYouRunOf(row, '2026-11-21')!;
  assert.equal(e.href, '/dashboard/e1');
  assert.equal(e.chatsHref, '/vendor-dashboard/clients/e1?tab=chat');
  assert.equal(e.hubHref, '/dashboard/e1/launch');
  const rows = code('app/vendor-dashboard/_components/events-you-run-rows.tsx');
  for (const [label, href] of [['Dashboard', 'e.href'], ['Chats', 'e.chatsHref'], ['Hub', 'e.hubHref']]) {
    assert.match(rows, new RegExp(`<RunButton href=\\{${href.replace('.', '\\.')}\\} label="${label}"`), `the row lost its ${label} button`);
  }
});
