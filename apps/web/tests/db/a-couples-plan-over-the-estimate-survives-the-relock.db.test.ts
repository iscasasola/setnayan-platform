/**
 * A PLAN THE COUPLE TYPES OVER THE LOCK'S ESTIMATE IS THEIRS — the next lock
 * keeps it, and emptying it really empties it. (owner 2026-10-29: "the payment
 * scheme there should properly update and save")
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Locking a priced supplier the couple added seeds Setnayan's 50/50 ESTIMATE
 * (`freezePaymentPlanAtBooking`, `is_default_seeded = true`). The record sheet's
 * save then upserted ONLY `instances_json`, so the flag survived the couple's
 * own plan — and `lockMayOverwritePlan` lets a re-lock replace a default-seeded
 * plan. Their typed plan was thrown away for another generic 50/50, and each
 * half passed its own tests.
 *
 * ── WHY A DB TEST ──────────────────────────────────────────────────────────
 * The fix is one column in the couple's write (`couplePlanUpsert`). Whether
 * that write is ALLOWED for the couple's session is a schema fact — the plan
 * table carries a column guard (`guard_payment_plan_clear`) and RLS — and
 * whether the re-lock then keeps it is the real `freezePaymentPlanAtBooking`.
 * So: the real lock, the couple's real row under their own role, the real
 * re-lock.
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';
import { buildCouplePaymentPlan, couplePlanUpsert } from '../../lib/self-added-payment-plan';

type PlanModule = typeof import('../../lib/booking-payment-plan.server');
let freezePaymentPlanAtBooking: PlanModule['freezePaymentPlanAtBooking'];

let replay: ReplayResult;
let db: PGlite;
let admin: SupabaseClient;
const deps = { emit: (async () => {}) as never };

async function seed(tag: string): Promise<{ couple: string; eventId: string; vendorId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [`plan-relock-${tag}@example.com`],
  );
  const couple = u.rows[0]!.id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', '2026-12-18'::date, 'day') RETURNING event_id`,
    [`Relock ${tag}`],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
    [eventId, couple],
  );
  // A supplier the couple added themselves — no marketplace shop — priced ₱395,000.
  const v = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php)
     VALUES ($1, 'reception_decor', 'Sample Styling Co', 'considering', 395000) RETURNING vendor_id`,
    [eventId],
  );
  return { couple, eventId, vendorId: v.rows[0]!.vendor_id };
}

const lock = (eventId: string, vendorId: string) =>
  freezePaymentPlanAtBooking(
    admin,
    {
      eventId,
      vendorId,
      booking: { vendor_name: 'Sample Styling Co', marketplace_vendor_id: null, service_id: null },
      tellUserId: null,
      tag: 'relock-test',
    },
    deps,
  );

/** The couple's save, written exactly as `saveSelfAddedPaymentPlan` writes it — under THEIR role. */
async function coupleSaves(couple: string, row: ReturnType<typeof couplePlanUpsert>): Promise<string> {
  await setAuthUid(db, couple);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('SET ROLE authenticated');
  const out = await db
    .query(
      `INSERT INTO public.event_vendor_payment_plan (event_id, event_vendor_id, instances_json, is_default_seeded, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       ON CONFLICT (event_id, event_vendor_id) DO UPDATE
         SET instances_json = EXCLUDED.instances_json,
             is_default_seeded = EXCLUDED.is_default_seeded,
             updated_at = EXCLUDED.updated_at`,
      [row.event_id, row.event_vendor_id, JSON.stringify(row.instances_json), row.is_default_seeded, row.updated_at],
    )
    .then(() => 'ok')
    .catch((e: Error) => e.message);
  await db.exec('RESET ROLE');
  await setAuthUid(db, null);
  return out;
}

async function plan(vendorId: string) {
  const r = await db.query<{ instances_json: Array<{ label: string; amount_php: number }>; is_default_seeded: boolean }>(
    `SELECT instances_json, is_default_seeded FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [vendorId],
  );
  return r.rows;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db);
  ({ freezePaymentPlanAtBooking } = await import('../../lib/booking-payment-plan.server'));
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});
after(async () => {
  await replay?.db.close();
});

test('the lock seeds the 50/50 estimate this whole defect starts from', async () => {
  const { eventId, vendorId } = await seed('premise');
  const r = await lock(eventId, vendorId);
  assert.equal(r.status, 'written');
  const [p] = await plan(vendorId);
  assert.ok(p, 'the lock wrote no plan — the premise of this test is gone');
  assert.equal(p.is_default_seeded, true);
  assert.deepEqual(p.instances_json.map((i) => Number(i.amount_php)), [197500, 197500]);
});

test('the couple types their own plan over the estimate — a re-lock keeps it', async () => {
  const { couple, eventId, vendorId } = await seed('relock');
  assert.equal((await lock(eventId, vendorId)).status, 'written');

  const built = buildCouplePaymentPlan({
    rows: [
      { label: 'Reservation', amount_kind: 'fixed', value: '100,000', due_anchor: 'on_lock', due_offset_days: '0' },
      { label: 'Balance', amount_kind: 'fixed', value: '295,000', due_anchor: 'before_event', due_offset_days: '7' },
    ],
    totalPhp: 395000,
    lockDateIso: '2026-10-29',
    eventDateIso: '2026-12-18',
  });
  assert.ok(built.ok, built.ok === false ? built.message : '');
  const said = await coupleSaves(
    couple,
    couplePlanUpsert({ eventId, vendorId, instances: built.instances, nowIso: new Date().toISOString() }),
  );
  assert.equal(said, 'ok', `the couple's own save was refused: ${said}`);

  const [mine] = await plan(vendorId);
  assert.equal(mine!.is_default_seeded, false, 'the couple’s plan is still flagged as Setnayan’s estimate');

  // Lock again (an unlock + re-lock, or a second lock press).
  const again = await lock(eventId, vendorId);
  assert.equal(again.status, 'kept_couple_plan', 'the re-lock replaced the plan the couple typed');
  const [kept] = await plan(vendorId);
  assert.deepEqual(
    kept!.instances_json.map((i) => [i.label, Number(i.amount_php)]),
    [
      ['Reservation', 100000],
      ['Balance', 295000],
    ],
  );
});

test('removing every payment is written as no payments, by the couple’s own session', async () => {
  const { couple, eventId, vendorId } = await seed('clear');
  assert.equal((await lock(eventId, vendorId)).status, 'written');
  const said = await coupleSaves(
    couple,
    couplePlanUpsert({ eventId, vendorId, instances: [], nowIso: new Date().toISOString() }),
  );
  assert.equal(said, 'ok', `clearing the plan was refused: ${said}`);
  const [p] = await plan(vendorId);
  assert.deepEqual(p!.instances_json, []);
  assert.equal(p!.is_default_seeded, false);
});
