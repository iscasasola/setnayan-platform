/**
 * The day-of requests stream — decision-logic tests.
 *
 * The claims worth pinning: a one-tap status ping is never open work, a vendor
 * can never triage (because RLS gives them no UPDATE), and every viewer writes
 * only the lane RLS would accept from them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COORDINATOR_TILE,
  DAY_REQUEST_BODY_MAX,
  DAY_REQUEST_ORIGINS,
  VENDOR_STATUS_PRESETS,
  vendorInboxSide,
  buildVendorStatusDraft,
  canTriage,
  countsAsOpenWork,
  laneLabel,
  nextStatus,
  normalizeRequestBody,
  originForViewer,
  presetByKey,
  sortInbox,
  statusLabel,
  summarizeInbox,
  type DayRequestOrigin,
  type DayRequestRow,
  type InboxViewer,
} from './day-requests';
import { resolveDayOfConsoleKind } from './vendor-day-of';

// ─── fixtures ──────────────────────────────────────────────────────────────

let seq = 0;
function row(over: Partial<DayRequestRow> = {}): DayRequestRow {
  seq += 1;
  return {
    request_id: `r${seq}`,
    origin: 'coordinator',
    kind: 'issue',
    status: 'open',
    body: 'Something needs doing',
    preset_key: null,
    author_user_id: 'u1',
    author_vendor_profile_id: null,
    created_at: `2026-07-27T10:00:${String(seq).padStart(2, '0')}Z`,
    ...over,
  };
}

const COUPLE: InboxViewer = { side: 'event', userId: 'u-couple', role: 'couple', canEdit: true };
const HOST: InboxViewer = { side: 'event', userId: 'u-host', role: 'host', canEdit: true };
const COORD: InboxViewer = { side: 'event', userId: 'u-coord', role: 'coordinator', canEdit: true };
const COORD_RO: InboxViewer = { side: 'event', userId: 'u-ro', role: 'coordinator', canEdit: false };
/** The booked coordinator VENDOR — the person the inbox is for. */
const COORD_VENDOR: InboxViewer = { side: 'coordinator', userId: 'u-cv', vendorProfileId: 'vp-c' };
const VENDOR: InboxViewer = { side: 'vendor', userId: 'u-v', vendorProfileId: 'vp1' };

// ─── 1. A status ping is not work ──────────────────────────────────────────

test('a one-tap status update never counts as open work, in any status', () => {
  for (const status of ['open', 'acknowledged', 'resolved'] as const) {
    assert.equal(
      countsAsOpenWork({ kind: 'status_update', status }),
      false,
      `status_update/${status} must not count — suppliers checking in would otherwise flood the coordinator's open badge`,
    );
  }
});

test('an unresolved issue or request is open work; a resolved one is not', () => {
  assert.equal(countsAsOpenWork({ kind: 'issue', status: 'open' }), true);
  assert.equal(countsAsOpenWork({ kind: 'issue', status: 'acknowledged' }), true);
  assert.equal(countsAsOpenWork({ kind: 'issue', status: 'resolved' }), false);
  assert.equal(countsAsOpenWork({ kind: 'request', status: 'open' }), true);
  assert.equal(countsAsOpenWork({ kind: 'request', status: 'resolved' }), false);
});

test('acknowledging does not clear the badge — only resolving does', () => {
  const before = summarizeInbox([row({ kind: 'issue', status: 'open' })]).openWork;
  const after = summarizeInbox([row({ kind: 'issue', status: 'acknowledged' })]).openWork;
  assert.equal(before, 1);
  assert.equal(after, 1, '"Seen" is not "done" — the work is still outstanding');
});

// ─── 2. The summary ────────────────────────────────────────────────────────

test('summarizeInbox separates open work from status pings and tallies each lane', () => {
  const s = summarizeInbox([
    row({ origin: 'couple', kind: 'issue', status: 'open' }),
    row({ origin: 'vendor', kind: 'status_update', status: 'open', author_vendor_profile_id: 'vp1' }),
    row({ origin: 'vendor', kind: 'issue', status: 'resolved', author_vendor_profile_id: 'vp1' }),
    row({ origin: 'host', kind: 'request', status: 'acknowledged' }),
    row({ origin: 'coordinator', kind: 'issue', status: 'open' }),
  ]);

  assert.equal(s.total, 5);
  assert.equal(s.openWork, 3, 'couple issue + host request + coordinator issue');
  assert.equal(s.statusUpdates, 1);
  assert.equal(s.resolved, 1);
  assert.deepEqual(s.byLane, { couple: 1, vendor: 2, host: 1, coordinator: 1 });
});

test('an empty inbox summarizes to all-zero rather than throwing', () => {
  const s = summarizeInbox([]);
  assert.equal(s.total, 0);
  assert.equal(s.openWork, 0);
  assert.deepEqual(s.byLane, { couple: 0, vendor: 0, host: 0, coordinator: 0 });
});

test('an origin from a future ALTER TYPE still counts in total and does not crash', () => {
  // An older bundle reading a row written after a new lane is added.
  const future = row({ origin: 'sponsor' as DayRequestOrigin, kind: 'issue', status: 'open' });
  const s = summarizeInbox([future]);
  assert.equal(s.total, 1, 'the row is not silently dropped');
  assert.equal(s.openWork, 1, 'it is still open work regardless of lane');
  assert.equal(s.byLane.couple, 0, 'and it does not land in the wrong lane');
});

// ─── 3. Triage matches RLS ─────────────────────────────────────────────────

test('the helper never offers what RLS refuses — no vendor can triage', () => {
  // The migration gives the vendor lane SELECT + INSERT and NO update policy.
  // Offering a resolve button to a vendor would 403 at the DB.
  assert.equal(canTriage(VENDOR, row()), false);
  assert.equal(canTriage(VENDOR, row({ origin: 'vendor', author_vendor_profile_id: 'vp1' })), false,
    'not even on the row they authored themselves');
});

test('the event side triages only with edit rights', () => {
  assert.equal(canTriage(COUPLE, row()), true);
  assert.equal(canTriage(HOST, row()), true);
  assert.equal(canTriage(COORD, row()), true);
  assert.equal(canTriage(COORD_RO, row()), false, 'a view-only delegate has no UPDATE policy either');
});

test('the booked coordinator triages — the inbox is theirs to run', () => {
  // They are a VENDOR, not an event member, so this only holds because the
  // migration reaches them via current_coordinator_booked_event_ids(). If that
  // helper is ever dropped from the UPDATE policy, this test must fail.
  assert.equal(canTriage(COORD_VENDOR, row()), true);
  assert.equal(canTriage(COORD_VENDOR, row({ origin: 'vendor', author_vendor_profile_id: 'vp1' })), true,
    'including a supplier report — that is the whole job');
});

// ─── 4. Lanes ──────────────────────────────────────────────────────────────

test('every viewer writes exactly the lane RLS would accept from them', () => {
  assert.equal(originForViewer(COUPLE), 'couple');
  assert.equal(originForViewer(HOST), 'host');
  assert.equal(originForViewer(COORD), 'coordinator');
  assert.equal(originForViewer(COORD_VENDOR), 'coordinator');
  assert.equal(originForViewer(VENDOR), 'vendor');
});

test('nobody but a plain booked supplier can write the vendor lane', () => {
  // event_day_requests_vendor_insert is the only policy accepting origin=vendor,
  // and it requires current_vendor_booked_event_ids(). A forged supplier report
  // is the misattribution this guard exists to prevent.
  for (const v of [COUPLE, HOST, COORD, COORD_RO, COORD_VENDOR]) {
    assert.notEqual(originForViewer(v), 'vendor');
  }
});

test('all four lanes are covered and labelled', () => {
  assert.deepEqual([...DAY_REQUEST_ORIGINS], ['couple', 'vendor', 'host', 'coordinator']);
  for (const o of DAY_REQUEST_ORIGINS) {
    assert.ok(laneLabel(o).length > 0, `${o} needs a label`);
  }
  assert.equal(laneLabel('sponsor'), 'sponsor', 'an unknown lane renders its raw value, not blank');
  assert.equal(statusLabel('open'), 'Open');
  assert.equal(statusLabel('weird'), 'weird');
});

test('a booked vendor carrying the coordinator tile runs the inbox; others report in', () => {
  assert.equal(vendorInboxSide(['coordinator']), 'coordinator');
  assert.equal(vendorInboxSide(['photography', 'coordinator']), 'coordinator');
  assert.equal(vendorInboxSide(['photography']), 'vendor');
  assert.equal(vendorInboxSide([]), 'vendor');
  assert.equal(vendorInboxSide(null), 'vendor', 'fail to the narrower side');
  assert.equal(vendorInboxSide(undefined), 'vendor');
});

test('the coordinator tile string matches the one the SQL helper filters on', () => {
  // current_coordinator_booked_event_ids() filters `'coordinator' = ANY(services)`.
  // If this constant drifts, the UI renders triage controls the DB refuses.
  assert.equal(COORDINATOR_TILE, 'coordinator');
});

test('inbox side agrees with the day-of console kind on every service set', () => {
  // A THREE-WAY coupling on one string: the console decides whether to mount
  // the inbox at all (kind === 'coordinator'), this file decides whether to
  // render triage controls, and the SQL helper decides whether the write
  // lands. Disagreement means the console mounts the inbox for someone it then
  // renders read-only — or worse, offers triage the DB refuses.
  const sets: readonly string[][] = [
    ['coordinator'],
    ['coordinator', 'photography'],
    ['photography'],
    ['catering'],
    ['live_band'],
    ['host_mc'],
    [],
  ];
  for (const services of sets) {
    const consoleIsCoordinator = resolveDayOfConsoleKind(services) === 'coordinator';
    const inboxIsCoordinator = vendorInboxSide(services) === 'coordinator';
    assert.equal(inboxIsCoordinator, consoleIsCoordinator,
      `disagreement on [${services.join(',')}]`);
  }
});

// ─── 5. The one-tap presets (§10 #2) ───────────────────────────────────────

test('a preset builds a vendor-lane draft carrying its own kind', () => {
  const late = buildVendorStatusDraft('running_late');
  assert.ok(late);
  assert.equal(late.origin, 'vendor');
  assert.equal(late.kind, 'issue', 'running late is work for the coordinator');
  assert.equal(late.preset_key, 'running_late');
  assert.ok(late.body.length > 0);

  const onSite = buildVendorStatusDraft('on_site');
  assert.ok(onSite);
  assert.equal(onSite.kind, 'status_update', 'arriving is not work');
});

test('an unknown preset key returns null rather than guessing a body', () => {
  assert.equal(buildVendorStatusDraft('nope'), null);
  assert.equal(buildVendorStatusDraft(''), null);
  assert.equal(buildVendorStatusDraft(null), null);
  assert.equal(buildVendorStatusDraft(undefined), null);
  assert.equal(presetByKey('nope'), null);
});

test('every preset is well-formed and fits the column', () => {
  const keys = new Set<string>();
  for (const p of VENDOR_STATUS_PRESETS) {
    assert.ok(!keys.has(p.key), `duplicate preset key ${p.key}`);
    keys.add(p.key);
    assert.ok(p.key.length <= 40, `${p.key} exceeds the preset_key CHECK`);
    assert.ok(p.label.length > 0, `${p.key} needs button copy`);
    assert.ok(p.body.length > 0 && p.body.length <= DAY_REQUEST_BODY_MAX,
      `${p.key} body must fit the 240-char CHECK`);
    assert.notEqual(p.kind, 'request', 'presets are either a ping or an issue');
  }
});

test('the presets that need action are issues, the rest are pings', () => {
  const issues = VENDOR_STATUS_PRESETS.filter((p) => p.kind === 'issue').map((p) => p.key);
  assert.deepEqual(issues.sort(), ['need_help', 'running_late']);
});

// ─── 6. Body normalization ─────────────────────────────────────────────────

test('normalizeRequestBody trims, collapses whitespace, and caps at the CHECK', () => {
  assert.equal(normalizeRequestBody('  the cake  is   late \n'), 'the cake is late');
  assert.equal(normalizeRequestBody('x'.repeat(500))?.length, DAY_REQUEST_BODY_MAX);
});

test('normalizeRequestBody rejects empty input instead of hitting the constraint', () => {
  assert.equal(normalizeRequestBody('   '), null);
  assert.equal(normalizeRequestBody('\n\t '), null);
  assert.equal(normalizeRequestBody(''), null);
  assert.equal(normalizeRequestBody(null), null);
  assert.equal(normalizeRequestBody(undefined), null);
  assert.equal(normalizeRequestBody(42 as unknown as string), null);
});

// ─── 7. The status machine ─────────────────────────────────────────────────

test('one button cycles open → seen → done → open', () => {
  assert.equal(nextStatus('open'), 'acknowledged');
  assert.equal(nextStatus('acknowledged'), 'resolved');
  assert.equal(nextStatus('resolved'), 'open', 'a mistakenly-closed item can be reopened');
});

// ─── 8. Ordering ───────────────────────────────────────────────────────────

test('sortInbox floats open work above done, newest first inside a band', () => {
  const a = row({ status: 'resolved', created_at: '2026-07-27T12:00:00Z' });
  const b = row({ status: 'open', created_at: '2026-07-27T10:00:00Z' });
  const c = row({ status: 'open', created_at: '2026-07-27T11:00:00Z' });
  const d = row({ status: 'acknowledged', created_at: '2026-07-27T09:00:00Z' });

  const out = sortInbox([a, b, c, d]).map((r) => r.request_id);
  assert.deepEqual(out, [c.request_id, b.request_id, d.request_id, a.request_id]);
});

test('sortInbox does not mutate its input', () => {
  const rows = [row({ status: 'resolved' }), row({ status: 'open' })];
  const snapshot = rows.map((r) => r.request_id);
  sortInbox(rows);
  assert.deepEqual(rows.map((r) => r.request_id), snapshot,
    'a server component hands the same array to two views');
});
