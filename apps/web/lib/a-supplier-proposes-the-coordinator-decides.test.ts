/**
 * ✋ A SUPPLIER PROPOSES; A HOST OR THE COORDINATOR DECIDES — the TypeScript half (owner rule, 8 Nov 2026: *"only
 * coordinator and hosts has the final say. so any supplier that is not a coordinator still has to request a host or
 * coordinator to accept the change"*). The database half, per part and per person, is
 * tests/db/a-supplier-proposes-the-coordinator-decides.db.test.ts.
 *
 *   1 · the mirrors: `isBookedCoordinator`, `bookedSupplierFacts`, `supplierProposesOnly`, `seatAreaLevel`;
 *   2 · the change model: every op builds a payload the database takes, and refuses what it would refuse — and the TS
 *       whitelist IS the SQL whitelist (read from the migration);
 *   3 · the words: who decides, the answer line by line, the notices and the refusals;
 *   4 · the screens: ONE dropdown for the ask and for every choice of a change; the coordinator answers with the hosts'
 *       own card on their client page; the hosts and the coordinator answer changes beside the schedule requests; the
 *       new notices are in-app only; the change action is ONE server-action export.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { BOOKED_EVENT_VENDOR_STATUSES, bookedSupplierFacts, isBookedCoordinator } from './coordinator-trade';
import { SUPPLIER_SEAT_ROLE, seatAreaLevel, supplierProposesOnly } from './delegate-areas';
import {
  CHANGE_OPS,
  GUEST_EDIT_FIELDS,
  SUPPLIER_EDIT_FIELDS,
  buildChange,
  changeAnswerRefusal,
  changeAnsweredNotice,
  changeRequestedNotice,
  changeStatusWords,
  proposableOps,
} from './change-requests';
import { answerLines, whoDecides } from './access-ask-words';
import { accessAnswerNotice, areaAnswerRefusal } from './access-answer-notice';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const G = '11111111-1111-4111-8111-111111111111';

// ─── 1 · the mirrors ─────────────────────────────────────────────────────

test('1 · the booked coordinator is booked AND the coordinator trade — a seat never makes one', () => {
  assert.equal(isBookedCoordinator({ services: ['planner_coordinator'], booked: true }), true);
  assert.equal(isBookedCoordinator({ services: ['planner_coordinator'], bookingStatuses: ['considering'] }), false, 'not booked');
  assert.equal(isBookedCoordinator({ services: ['photographer'], booked: true }), false, 'not the trade');
  assert.deepEqual([...BOOKED_EVENT_VENDOR_STATUSES], ['contracted', 'deposit_paid', 'delivered', 'complete']);

  const facts = bookedSupplierFacts([
    { status: 'contracted', services: ['photographer'], userIds: ['ben', 'ben-assistant'] },
    { status: 'deposit_paid', services: ['day_of_coordinator'], userIds: ['ana'] },
    { status: 'considering', services: ['florist'], userIds: ['flor'] },
  ]);
  assert.deepEqual(facts.get('ben'), { bookedSupplier: true, bookedCoordinator: false });
  assert.deepEqual(facts.get('ben-assistant'), { bookedSupplier: true, bookedCoordinator: false }, 'a team member acts for the shop');
  assert.deepEqual(facts.get('ana'), { bookedSupplier: true, bookedCoordinator: true });
  assert.equal(facts.get('flor'), undefined, 'a shortlisted supplier is not booked');
});

test('1 · a supplier seat is capped at view — never a host’s own delegate, never the coordinator', () => {
  const perms = { edit_all: false, checkout: false, invite_hosts: false, remove_hosts: false, areas: { guest_list: 'edit' as const } };
  const capped = supplierProposesOnly({ roleSubtype: SUPPLIER_SEAT_ROLE, bookedSupplier: true, bookedCoordinator: false });
  assert.equal(capped, true);
  assert.equal(seatAreaLevel(perms, 'guest_list', capped), 'view');
  assert.equal(supplierProposesOnly({ roleSubtype: SUPPLIER_SEAT_ROLE, bookedSupplier: true, bookedCoordinator: true }), false, 'the coordinator writes');
  assert.equal(supplierProposesOnly({ roleSubtype: SUPPLIER_SEAT_ROLE, bookedSupplier: false, bookedCoordinator: false }), false,
    'the couple’s own planner, invited by email, is the hosts’ delegate');
  assert.equal(supplierProposesOnly({ roleSubtype: 'best_man', bookedSupplier: true, bookedCoordinator: false }), false,
    'a supplier the couple also seated as best man keeps what they gave him');
  assert.equal(supplierProposesOnly({ roleSubtype: SUPPLIER_SEAT_ROLE, bookedSupplier: true, bookedCoordinator: false, isHost: true }), false,
    'a host whose own shop is booked on their own event');
  assert.equal(seatAreaLevel(perms, 'guest_list', false), 'edit');
  assert.equal(seatAreaLevel(perms, 'seat_plan', true), null, 'the cap never grants');
});

// ─── 2 · the change model ────────────────────────────────────────────────

test('2 · every change builds a payload the database takes — and refuses what it refuses', () => {
  const add = buildChange({ op: 'guest_add', firstName: '  Nena ', lastName: 'Santos' });
  assert.ok(add.ok && add.payload.first_name === 'Nena' && add.summary === 'Add Nena Santos to the guest list');
  assert.deepEqual(buildChange({ op: 'guest_add', firstName: '' }), { ok: false, error: 'Type the guest’s first name.' });

  const edit = buildChange({ op: 'guest_edit', targetId: G, targetName: 'Lorna Reyes', changes: { meal_preference: 'fish', total_cost_php: '1' } });
  assert.ok(edit.ok);
  assert.deepEqual(edit.ok && edit.payload, { changes: { meal_preference: 'fish' } }, 'a field off the whitelist reached the payload');
  assert.equal(edit.ok && edit.summary, 'Change Lorna Reyes’s meal');
  assert.equal(buildChange({ op: 'guest_edit', targetId: G, changes: { meal_preference: 'lobster' } }).ok, false);
  assert.equal(buildChange({ op: 'guest_edit', targetId: G, changes: { first_name: '' } }).ok, false, 'a guest without a first name');
  assert.equal(buildChange({ op: 'guest_edit', targetId: 'not-a-uuid', changes: { email: 'a@b.c' } }).ok, false);

  const sup = buildChange({ op: 'supplier_edit', targetId: G, targetName: 'Bloom & Co.', changes: { status: 'cancelled', crew_size: '4' } });
  assert.deepEqual(sup.ok && sup.payload, { changes: { crew_size: '4' } }, 'a status reached the payload');
  assert.equal(buildChange({ op: 'supplier_edit', targetId: G, changes: { crew_size: 'many' } }).ok, false);
  assert.equal(buildChange({ op: 'supplier_edit', targetId: G, changes: { total_cost_php: '1' } }).ok, false, 'a price alone is no change');

  const seat = buildChange({ op: 'seat_move', targetId: G, targetName: 'Mario', tableId: G, tableName: 'Table 4' });
  assert.ok(seat.ok && seat.summary === 'Seat Mario at Table 4' && seat.area === 'seat_plan');
  const unseat = buildChange({ op: 'seat_move', targetId: G, targetName: 'Mario', tableId: null });
  assert.deepEqual(unseat.ok && unseat.payload, { table_id: null });

  const rm = buildChange({ op: 'guest_remove', targetId: G, targetName: 'Mario' });
  assert.deepEqual(rm.ok && rm.payload, {});
});

test('2 · the TS whitelist IS the SQL whitelist (change_request_payload_ok), field for field', () => {
  const file = readdirSync(MIGRATIONS).filter((f) => f.endsWith('_a_supplier_proposes_a_change.sql'));
  assert.equal(file.length, 1, 'the change-request migration moved — re-read this test');
  const sql = readFileSync(join(MIGRATIONS, file[0]!), 'utf8');
  const listAfter = (marker: string) => {
    const at = sql.indexOf(marker);
    assert.ok(at > 0, `${marker} not found in the migration`);
    const inList = sql.slice(at).match(/k IN \(([^)]*)\)/)![1]!;
    return [...inList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]!).sort();
  };
  assert.deepEqual(listAfter("WHEN 'guest_edit' THEN"), [...GUEST_EDIT_FIELDS].sort());
  assert.deepEqual(listAfter("WHEN 'supplier_edit' THEN"), [...SUPPLIER_EDIT_FIELDS].sort());
  for (const op of Object.keys(CHANGE_OPS)) assert.ok(sql.includes(`'${op}'`), `${op} is not in the database's list`);
});

test('2 · a supplier proposes only on the parts they hold', () => {
  assert.deepEqual(proposableOps({ seat_plan: 'view' }), ['seat_move']);
  assert.deepEqual(proposableOps({ guest_list: 'view', vendors: 'view' }), ['guest_add', 'guest_edit', 'guest_remove', 'supplier_edit']);
  assert.deepEqual(proposableOps({ schedule: 'view', mood_board: 'view', budget: 'view' }), [],
    'the schedule and the mood board keep their own request paths');
});

// ─── 3 · the words ───────────────────────────────────────────────────────

test('3 · the words name who decides, and say every answer — never silent, never a fake success', () => {
  assert.equal(whoDecides(true), 'the host');
  assert.equal(whoDecides(false), 'the host or the coordinator');
  assert.equal(
    answerLines({ requestedAreas: ['guest_list', 'budget', 'vendors'], decisions: { guest_list: 'granted', budget: 'declined' } }),
    'Guest list: shared · Budget & payments: declined · Suppliers: no answer',
  );
  const n = accessAnswerNotice({ eventId: G, eventName: 'Ana & Ben', decisions: { guest_list: 'granted', budget: 'declined' }, askerIsCoordinator: false });
  assert.equal(n.title, 'Ana & Ben shared Guest list with you');
  assert.match(n.body, /see it and propose changes/);
  assert.match(n.body, /Not shared: Budget & payments/);
  assert.equal(n.relatedUrl, `/vendor-dashboard/clients/${G}`);
  assert.match(accessAnswerNotice({ eventId: G, eventName: null, decisions: { guest_list: 'granted' }, askerIsCoordinator: true }).body, /can make changes/);

  assert.equal(changeStatusWords('open'), 'Waiting for the host or the coordinator');
  assert.match(changeRequestedNotice({ eventId: G, supplierName: 'Shots by Ben', summary: 'Seat Mario at Table 4' }).title, /Shots by Ben proposed a change/);
  assert.match(changeAnsweredNotice({ eventId: G, accepted: false, summary: 'x', eventName: null }).title, /declined your change/);

  for (const [msg, want] of [
    ['answer_area_access_request: nobody answers their own ask', /cannot answer your own/],
    ['answer_area_access_request: the coordinator cannot share budget, which they do not hold', /only share a part the host shared/],
    ['answer_area_access_request: already answered', /already answered/],
  ] as const) assert.match(areaAnswerRefusal(msg), want);
  assert.match(changeAnswerRefusal('answer_event_change_request: nothing changed — the guest or supplier is gone'), /is gone/);
  assert.match(changeAnswerRefusal('answer_event_change_request: nobody answers their own change'), /your own change/);
});

// ─── 4 · the screens ─────────────────────────────────────────────────────

test('4 · the ask is ONE dropdown with checkmarks — no row of chip toggles', () => {
  const ask = src('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/ask-access.tsx');
  assert.match(ask, /<PickMenu[\s\S]*?picked=\{picked\}/, 'the parts are not one checkmark dropdown');
  assert.doesNotMatch(ask, /aria-pressed/, 'a chip toggle is back');
  assert.match(ask, /GRANT_WORDS\[/, 'what they hold is not said in what it lets them do');
  assert.match(ask, /whoDecides\(/, 'the waiting line does not name who decides');
  assert.match(ask, /answerLines\(/, 'the last answer is not shown');
});

test('4 · a change is picked from dropdowns and drawn with the house field — never a raw box', () => {
  const pc = src('app/vendor-dashboard/clients/[eventId]/_components/propose-change.tsx');
  assert.ok((pc.match(/<PickMenu/g) ?? []).length >= 4, 'what · which · detail · table are dropdowns');
  assert.doesNotMatch(pc, /<input\b/, 'a raw input box');
  assert.match(pc, /<TypedRow/);
  assert.match(pc, /changeStatusWords\(/, 'the supplier is not told where their change stands');
});

test('4 · the coordinator answers with the hosts’ own card, on their client page — and only the booked coordinator', () => {
  const ca = src('app/vendor-dashboard/clients/[eventId]/_components/coordinator-answers.tsx');
  assert.match(ca, /<RequestCard[\s\S]*?answering=\{\{ as: 'coordinator', shareable \}\}/);
  const page = src('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(page, /theBookedCoordinator \? readAsksForCoordinator\(/, 'the asks are read for somebody who is not the coordinator');
  assert.match(page, /theBookedCoordinator \? readOpenChangeRequests\(/);
  assert.match(page, /isBooked && !theBookedCoordinator \? proposableOps\(myGrants\)/, 'the coordinator is offered "propose"');
  assert.match(page, /<CoordinatorAnswers/);
  assert.match(page, /<ProposeChange/);
});

test('4 · the hosts and the coordinator answer changes beside the schedule requests', () => {
  const sched = src('app/dashboard/[eventId]/schedule/page.tsx');
  const at = sched.indexOf('<VendorSuggestionsQueue');
  const q = sched.indexOf('<ChangeRequestsQueue');
  assert.ok(at > 0 && q > at && q - at < 400, 'the change queue is not beside the schedule requests');
});

test('4 · the three new notices are in-app only, and the change action is ONE export', () => {
  const emit = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
  const at = emit.indexOf('EMAIL_ENABLED_TYPES');
  const allow = stripComments(emit.slice(at, emit.indexOf(']);', at)));
  for (const t of ['access_answered', 'change_requested', 'change_answered']) {
    assert.doesNotMatch(allow, new RegExp(`'${t}'`), `${t} is emailed — in-app notices only (owner)`);
  }
  const action = src('app/_actions/change-request-actions.ts');
  assert.equal((action.match(/^export async function/gm) ?? []).length, 1, 'one export: the server-action budget sits at its ceiling');
  assert.match(action, /rpc\('answer_event_change_request'/, 'an Accept that is not applied by the database in one transaction');
  const reads = src('lib/my-area-grants.server.ts');
  assert.match(reads, /^import 'server-only'/m, 'the access reads became a route again');
});
