/**
 * EVERY FAILURE IS RECORDED — the database half (migration 20271260713505,
 * DECISION_LOG 2026-10-02 "SPOT PROBLEMS BEFORE USERS REPORT THEM").
 *
 * For EACH source — thrown · returned · zero-row · button timeout · dead end ·
 * dead tap · rage tap · drop-off — the REAL detector produces its record, the
 * REAL shaping (`shapeFaultArgs`, the ingest's `wireToRecord`) turns it into
 * the call production makes, and `record_app_fault` runs against the replayed
 * schema. Asserted: a trace row AND one grouped issue appear, identical
 * failures group, nothing personal lands, a success writes no row, an issue
 * closes once a newer build is live and it is quiet for 48 h and REOPENS when
 * it recurs, and only the service role can write.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import './supabase-over-pglite'; // installs the `server-only` shim before fault-log loads

import type { RecordFaultInput } from '@/lib/telemetry/fault-log';
import { classifyPostgrest, readActionResult } from '@/lib/telemetry/fault-normalize';
import { shapeRequestError } from '@/lib/telemetry/request-error-shape';
import { createRageCounter, isDeadTap, judgeLanding, wire, type WireFault } from '@/lib/telemetry/fault-observer';
import { wireToRecord, countsFromWire } from '@/lib/telemetry/ingest-shape';
import { FLOWS, funnelOf, reachStep, type FlowRuns } from '@/lib/telemetry/flows';

let replay: ReplayResult;
let db: PGlite;
let shapeFaultArgs: typeof import('@/lib/telemetry/fault-log').shapeFaultArgs;
let adminUser = '';

const SHA_OLD = 'aaaaaaa1111111111111111111111111111111aa';
const SHA_NEW = 'bbbbbbb2222222222222222222222222222222bb';

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await setRole('service_role');
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

type Recorded = { issue_id: string; log_id: string | null; is_new: boolean; reopened: boolean };

/** Exactly what recordFault sends, run as the service role. */
async function record(rec: RecordFaultInput, sha = SHA_OLD): Promise<Recorded> {
  const a = shapeFaultArgs(rec, sha);
  return asService(async () => {
    const r = await db.query<Recorded>(
      `SELECT * FROM public.record_app_fault($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [a.p_kind, a.p_action, a.p_message, a.p_detail, a.p_element, a.p_file_path, a.p_build_sha, JSON.stringify(a.p_trace)],
    );
    return r.rows[0]!;
  });
}

/** A browser's wire body, through the ingest's own shaping, then recorded. */
async function recordWire(w: WireFault): Promise<Recorded> {
  const shaped = wireToRecord(w as unknown as Record<string, unknown>, (id) => `app/x/actions.ts#${id}`);
  assert.ok(shaped.ok);
  return record(shaped.ok ? shaped.record : (null as never));
}

async function issue(id: string) {
  return (
    await db.query<{ kind: string; action: string; message: string; label: string | null; page: string | null; hit_count: string; status: string; day_count: number; reopened_count: number }>(
      `SELECT kind, action, message, label, page, hit_count::text, status, day_count, reopened_count FROM public.app_fault_issues WHERE id = $1`,
      [id],
    )
  ).rows[0]!;
}

async function logRow(id: string | null) {
  assert.ok(id, 'a trace row was written');
  return (
    await db.query<{ event_type: string; fingerprint: string; error_message: string; build_sha: string; payload_snapshot: Record<string, unknown> }>(
      `SELECT event_type, fingerprint, error_message, build_sha, payload_snapshot FROM public.app_telemetry_logs WHERE id = $1`,
      [id],
    )
  ).rows[0]!;
}

/** The core claim, said once: a trace row AND an issue, of this kind. */
async function assertRecorded(r: Recorded, kind: string) {
  assert.equal(r.is_new, true, 'a first occurrence opens a NEW issue');
  const i = await issue(r.issue_id);
  assert.equal(i.kind, kind);
  assert.equal(i.status, 'open');
  assert.equal(i.hit_count, '1');
  const row = await logRow(r.log_id);
  assert.equal(row.event_type, kind);
  assert.ok(row.fingerprint, 'the trace row carries its issue fingerprint');
  assert.equal(row.build_sha, SHA_OLD);
  return { i, row };
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  ({ shapeFaultArgs } = await import('@/lib/telemetry/fault-log'));
  adminUser = (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('problems-admin@faults.test', '{}'::jsonb) RETURNING id`,
    )
  ).rows[0]!.id;
  await db.query(`UPDATE public.users SET is_internal = TRUE WHERE user_id = $1`, [adminUser]);
});

after(async () => {
  await db?.close();
});

test('THROWN → a trace row and one issue; the same throw again is the SAME issue, counted', async () => {
  const err = Object.assign(new Error('boom while inviting maria@example.com'), { digest: '42' });
  const rec = shapeRequestError(
    err,
    { headers: { 'next-action': 'f'.repeat(40) } },
    { routePath: '/dashboard/[eventId]/guests', routeType: 'action' },
    () => 'app/dashboard/[eventId]/guests/actions.ts#addGuest',
  )!;
  const first = await record(rec);
  const { i, row } = await assertRecorded(first, 'SERVER_THROWN');
  assert.equal(i.action, 'app/dashboard/[eventId]/guests/actions.ts#addGuest');
  assert.ok(!row.error_message.includes('maria@example.com'), 'the email never lands');
  assert.ok(!i.message.includes('maria@example.com'));
  const again = await record(rec);
  assert.equal(again.issue_id, first.issue_id, 'identical failures group');
  assert.equal(again.is_new, false);
  assert.equal((await issue(first.issue_id)).hit_count, '2');
  assert.equal(again.log_id, null, 'the trace is sampled — a repeat within 10 min writes no second row');
});

test('RETURNED → a trace row and one issue, named by the button pressed', async () => {
  const reply = readActionResult('0:{"a":"$@1","f":"","b":"b"}\n1:{"ok":false,"error":"Ana Reyes is already on the list"}\n');
  assert.equal(reply.failed, true);
  const r = await recordWire(wire('ACTION_RETURNED_ERROR', { actionId: 'submitRsvp', element: 'Send my reply', page: '/maria-juan/invite/reply', message: reply.message }));
  const { i } = await assertRecorded(r, 'ACTION_RETURNED_ERROR');
  assert.equal(i.action, 'app/x/actions.ts#submitRsvp');
  assert.equal(i.label, 'Send my reply');
  assert.equal(i.page, '/[slug]/invite/reply', "the couple's address never lands");
  assert.ok(!i.message.includes('Ana Reyes'), i.message);
});

test('ZERO-ROW → a trace row and one issue', async () => {
  const v = classifyPostgrest({ method: 'PATCH', url: 'https://x.supabase.co/rest/v1/vendor_services?vendor_service_id=eq.7', status: 204, contentRange: '*/*' })!;
  const r = await record({ kind: v.kind, action: v.action, message: v.message, trace: { db_target: v.action } });
  const { i } = await assertRecorded(r, 'DB_ZERO_ROW');
  assert.equal(i.action, 'PATCH vendor_services');
});

test('BUTTON TIMEOUT → a trace row and one issue', async () => {
  const r = await recordWire(wire('BUTTON_TIMEOUT', { actionId: 'saveBudget', element: 'Save', page: '/dashboard/4f9c2a10-1b2c-4d3e-8f90-123456789abc/budget', message: 'no answer after 15s' }));
  const { i } = await assertRecorded(r, 'BUTTON_TIMEOUT');
  assert.equal(i.page, '/dashboard/[id]/budget');
});

test('DEAD END → a trace row and one issue per door, with the page it came from', async () => {
  const v = judgeLanding({ tappedPath: '/vendor-dashboard/old-thing', tappedHash: '', fromPath: '/vendor-dashboard', landedPath: '/vendor-dashboard/old-thing', notFoundShown: true, sectionFound: null })!;
  const r = await recordWire(wire('DEAD_END', { action: `${v.reason} ${v.to} ← /vendor-dashboard`, page: '/vendor-dashboard/old-thing', from: '/vendor-dashboard', to: v.to, message: v.reason }));
  const { row } = await assertRecorded(r, 'DEAD_END');
  assert.equal(row.payload_snapshot.from, '/vendor-dashboard');
});

test('DEAD TAP → a trace row and one issue', async () => {
  assert.equal(isDeadTap({ navigated: false, requested: false, dialogOpened: false, mutatedNearby: false, scrolled: false, focusMoved: false, leftPage: false }), true);
  const r = await recordWire(wire('DEAD_TAP', { action: '/dashboard/[id]/guests · Export', element: 'Export', page: '/dashboard/[id]/guests', message: 'nothing happened within 2s' }));
  await assertRecorded(r, 'DEAD_TAP');
});

test('RAGE TAP → a trace row and one issue', async () => {
  const rage = createRageCounter();
  assert.equal([0, 300, 600].map((t) => rage('el', t)).at(-1), true);
  const r = await recordWire(wire('RAGE_TAP', { action: '/[slug]/invite/reply · Send my reply', element: 'Send my reply', page: '/x/invite/reply', message: 'tapped 3+ times in 2s' }));
  await assertRecorded(r, 'RAGE_TAP');
});

test('A SUCCESS writes NO row — it only increments a counter', async () => {
  const before = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.app_telemetry_logs`)).rows[0]!.n;
  const counts = countsFromWire([{ a: 'id:submitRsvp', ok: 3 }, { a: 'id:submitRsvp', ok: 2 }, { a: 'nonsense', ok: 99 }], (id) => `app/x/actions.ts#${id}`);
  assert.deepEqual(counts, [{ a: 'app/x/actions.ts#submitRsvp', ok: 5, fail: 0 }]);
  await asService(() => db.query(`SELECT public.bump_app_action_counts($1::jsonb)`, [JSON.stringify(counts)]));
  const after = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.app_telemetry_logs`)).rows[0]!.n;
  assert.equal(after, before, 'no trace row for a success');
  const c = (await db.query<{ ok_count: string; fail_count: string }>(`SELECT ok_count::text, fail_count::text FROM public.app_action_daily_counts WHERE action = 'app/x/actions.ts#submitRsvp'`)).rows[0]!;
  assert.equal(c.ok_count, '5');
  assert.equal(c.fail_count, '1', 'the RETURNED failure above counted against the same action — so a rate exists');
});

test('DROP-OFF → step counts, and the step where most people stop', async () => {
  const flow = FLOWS.find((f) => f.flow === 'guest_reply')!;
  const steps: string[] = [];
  for (let p = 0; p < 10; p++) {
    const runs: FlowRuns = {};
    const path = p < 3 ? ['open'] : p < 8 ? ['open', 'choose'] : ['open', 'choose', 'send', 'ticket'];
    for (const s of path) {
      const c = reachStep(runs, flow, s, p * 1000);
      if (c) steps.push(`flow:guest_reply:${c}`);
    }
  }
  const counts = countsFromWire(steps.map((a) => ({ a, ok: 1 })), () => null);
  await asService(() => db.query(`SELECT public.bump_app_action_counts($1::jsonb)`, [JSON.stringify(counts)]));
  const rows = (await db.query<{ action: string; ok_count: string }>(`SELECT action, ok_count::text FROM public.app_action_daily_counts WHERE action LIKE 'flow:guest_reply:%'`)).rows;
  const reached = Object.fromEntries(rows.map((r) => [r.action.split(':')[2]!, Number(r.ok_count)]));
  assert.deepEqual(reached, { open: 10, choose: 7, send: 2, ticket: 2 });
  const { worst } = funnelOf(flow, reached);
  assert.equal(worst?.step, 'choose', '5 of 10 stopped after choosing');
  assert.equal(worst?.stoppedHere, 5);
});

test('SELF-CLOSING: closes only once a NEWER build is live AND 48 h quiet; REOPENS on recurrence', async () => {
  const r = await record({ kind: 'SERVER_THROWN', action: 'render /closing', message: 'x' }, SHA_OLD);
  // Same build live → never closes, however quiet.
  await db.query(`UPDATE public.app_fault_issues SET last_seen = NOW() - INTERVAL '3 days' WHERE id = $1`, [r.issue_id]);
  await asService(() => db.query(`SELECT public.close_quiet_fault_issues($1)`, [SHA_OLD]));
  assert.equal((await issue(r.issue_id)).status, 'open', 'no newer build → it cannot have been fixed');
  // Newer build, but it happened 1 h ago → stays open.
  await db.query(`UPDATE public.app_fault_issues SET last_seen = NOW() - INTERVAL '1 hour' WHERE id = $1`, [r.issue_id]);
  await asService(() => db.query(`SELECT public.close_quiet_fault_issues($1)`, [SHA_NEW]));
  assert.equal((await issue(r.issue_id)).status, 'open', 'not quiet for 48 h yet');
  // Newer build + 48 h quiet → closed.
  await db.query(`UPDATE public.app_fault_issues SET last_seen = NOW() - INTERVAL '49 hours' WHERE id = $1`, [r.issue_id]);
  await asService(() => db.query(`SELECT public.close_quiet_fault_issues($1)`, [SHA_NEW]));
  assert.equal((await issue(r.issue_id)).status, 'closed');
  // It happens again → reopened, counted, and a fresh trace row.
  const again = await record({ kind: 'SERVER_THROWN', action: 'render /closing', message: 'x' }, SHA_NEW);
  assert.equal(again.issue_id, r.issue_id);
  assert.equal(again.reopened, true);
  assert.ok(again.log_id, 'a reopen always writes a trace');
  const i = await issue(r.issue_id);
  assert.equal(i.status, 'open');
  assert.equal(i.reopened_count, 1);
});

test('ONLY the service role writes; an admin READS; nobody else sees a thing', async () => {
  for (const role of ['anon', 'authenticated']) {
    await setRole(role);
    await db.exec(`SET ROLE ${role}`);
    await assert.rejects(
      db.query(`SELECT * FROM public.record_app_fault('OTHER','x','y',NULL,NULL,NULL,NULL,'{}'::jsonb)`),
      /permission denied/,
      `${role} must not execute record_app_fault`,
    );
    await assert.rejects(db.query(`SELECT public.bump_app_action_counts('[]'::jsonb)`), /permission denied/);
    await assert.rejects(db.query(`INSERT INTO public.app_fault_issues (fingerprint, kind, action) VALUES ('f','OTHER','x')`), /permission denied|row-level security/);
    await reset();
  }
  // A signed-in non-admin sees no issue.
  const stranger = (await db.query<{ id: string }>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('stranger@faults.test','{}'::jsonb) RETURNING id`)).rows[0]!.id;
  await setAuthUid(db, stranger);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  assert.equal((await db.query(`SELECT 1 FROM public.app_fault_issues`)).rows.length, 0);
  await reset();
  // The admin set sees them.
  await setAuthUid(db, adminUser);
  await setRole('authenticated');
  await db.exec('SET ROLE authenticated');
  assert.ok((await db.query(`SELECT 1 FROM public.app_fault_issues`)).rows.length > 0, 'an admin reads the list');
  assert.ok((await db.query(`SELECT 1 FROM public.app_action_daily_counts`)).rows.length > 0);
  await reset();
});
