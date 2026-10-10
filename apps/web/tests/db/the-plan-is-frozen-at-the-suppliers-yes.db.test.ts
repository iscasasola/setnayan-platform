/**
 * THE PAYMENT PLAN IS FROZEN AT THE SUPPLIER'S YES — the money step of the
 * couple ↔ supplier connection, run against the replayed schema.
 *
 * ── WHY THIS FILE EXISTS (2026-10-10) ───────────────────────────────────────
 * With the lock handshake on, the couple's press only ASKS and `finalizeVendor`
 * returns; the booking is made by the supplier's yes. The payment-plan snapshot
 * and its "your payment info is ready" notice lived below that return, so a
 * booking made the normal way had NO row in `event_vendor_payment_plan` and
 * `payment_info_sent` never fired. Both now go through ONE function
 * (`lib/booking-payment-plan.server.ts`) that the direct path and the yes call.
 *
 * ── WHAT IS EXECUTED HERE ───────────────────────────────────────────────────
 * The REAL `freezePaymentPlanAtBooking` and `freezePaymentPlanAfterSupplierAgreed`
 * (not a re-statement of them), against the REAL `vendor_agree_to_lock` and
 * `expire_stale_lock_requests`, through the supabase-js-shaped adapter in
 * `./supabase-over-pglite` — including the named change-lines embed and the
 * jsonb upsert. Every assertion is a row with a value.
 *
 * ── WHAT IS NOT, said plainly ───────────────────────────────────────────────
 * `vendorAgreeToLock` itself is a Next.js server action (cookies, redirect) and
 * cannot run headless. Its one rule — "call the freeze when the function
 * answers `ok`, and only then" — is restated by `pressYes` below and PINNED on
 * the action's source by `lib/the-plan-is-frozen-at-the-suppliers-yes.test.ts`.
 * The notice is counted through the injected emitter, which also writes the
 * `notifications` row so the enum label is proven insertable; the real emitter
 * (email, push) is not run.
 *
 * MUTATIONS (each seen red, restored):
 *   · skip the freeze at the yes                       → test 1 (0 plan rows)
 *   · make the yes path tell every couple member       → test 1 (2 notices)
 *   · anchor the yes path on the request day           → test 2 (due dates differ)
 *   · seed 50/50 for a package row                     → test 5
 *   · address the notice to a guess when nobody asked  → test 4
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { makeAdminClient } from './supabase-over-pglite';

type PlanModule = typeof import('../../lib/booking-payment-plan.server');
let freezePaymentPlanAtBooking: PlanModule['freezePaymentPlanAtBooking'];
let freezePaymentPlanAfterSupplierAgreed: PlanModule['freezePaymentPlanAfterSupplierAgreed'];

let replay: ReplayResult;
let db: PGlite;
let admin: SupabaseClient;

type Row = Record<string, unknown>;
type Notice = { userId: string; type: string; title: string; body?: string | null; relatedUrl?: string | null };

/** Every notice the functions under test sent, in order — and a real row each. */
let sent: Notice[] = [];
const emit = async (n: Notice): Promise<void> => {
  sent.push(n);
  await db.query(
    `INSERT INTO public.notifications (user_id, type, title, body, related_url)
     VALUES ($1, $2::public.notification_type, $3, $4, $5)`,
    [n.userId, n.type, n.title, n.body ?? null, n.relatedUrl ?? null],
  );
};
const deps = { emit: emit as never };

/* ── Fixtures (same shapes as lock-handshake-wiring.db.test.ts) ──────────────*/

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer'::text)) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

async function newVendor(email: string): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, 'Lente Studio', 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

/** A dated event with TWO couple members — the asker and their partner. */
async function newEvent(label: string): Promise<{ eventId: string; asker: string; partner: string }> {
  const asker = await newUser(`asker-${label}@plan.test`);
  const partner = await newUser(`partner-${label}@plan.test`);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', '2027-03-06'::date, 'day') RETURNING event_id`,
    [`Event ${label}`],
  );
  const eventId = e.rows[0]!.event_id;
  for (const uid of [asker, partner]) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`,
      [eventId, uid],
    );
  }
  return { eventId, asker, partner };
}

/** The row `finalizeVendor` leaves behind at the ASK: pending, priced, asker recorded. */
async function newAsk(
  eventId: string,
  vpid: string,
  opts: { askedBy: string | null; totalPhp?: number | null; serviceId?: string | null } = { askedBy: null },
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, service_id,
        lock_request_state, lock_requested_at, lock_requested_by_user_id)
     VALUES ($1, 'photographer', 'Lente Studio', 'considering', $2, $3, $4, 'pending', NOW(), $5)
     RETURNING vendor_id`,
    [eventId, vpid, opts.totalPhp === undefined ? 100000 : opts.totalPhp, opts.serviceId ?? null, opts.askedBy],
  );
  return r.rows[0]!.vendor_id;
}

async function agree(uid: string, vendorId: string): Promise<Row> {
  await setAuthUid(db, uid);
  const r = await db.query<{ r: Row }>(`SELECT public.vendor_agree_to_lock($1) AS r`, [vendorId]);
  await setAuthUid(db, null);
  return r.rows[0]!.r;
}

/**
 * `vendorAgreeToLock`'s rule, and nothing else of it: the freeze runs when the
 * function answers `ok`. The action's own source is pinned to exactly this
 * condition by lib/the-plan-is-frozen-at-the-suppliers-yes.test.ts.
 */
async function pressYes(uid: string, eventId: string, vendorId: string): Promise<Row> {
  const env = await agree(uid, vendorId);
  if (env.status === 'ok') {
    await freezePaymentPlanAfterSupplierAgreed(admin, { eventId, eventVendorId: vendorId }, deps);
  }
  return env;
}

type PlanRow = { instances_json: Array<Record<string, unknown>>; is_default_seeded: boolean; cleared_at: string | null };
async function plans(vendorId: string): Promise<PlanRow[]> {
  const r = await db.query<PlanRow>(
    `SELECT instances_json, is_default_seeded, cleared_at
       FROM public.event_vendor_payment_plan WHERE event_vendor_id = $1`,
    [vendorId],
  );
  return r.rows;
}
async function noticeRows(eventId: string): Promise<Array<{ user_id: string; type: string; related_url: string }>> {
  const r = await db.query<{ user_id: string; type: string; related_url: string }>(
    `SELECT user_id, type::text AS type, related_url FROM public.notifications
      WHERE related_url LIKE $1 ORDER BY created_at`,
    [`/dashboard/${eventId}/%`],
  );
  return r.rows;
}
const amounts = (p: PlanRow) => p.instances_json.map((i) => Number(i.amount_php));

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  admin = makeAdminClient(db);
  ({ freezePaymentPlanAtBooking, freezePaymentPlanAfterSupplierAgreed } = await import(
    '../../lib/booking-payment-plan.server'
  ));
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  sent = [];
});
after(async () => {
  await replay?.db.close();
});

/* ═══ 1 · ask → yes → ONE plan row, ONE notice; nothing after adds another ═══ */

test('ask → yes writes exactly one plan row and tells the asker once; a second yes and the sweep add nothing', async () => {
  const { eventId, asker, partner } = await newEvent('one');
  const { vpid, uid } = await newVendor('one@plan.test');
  const b = await newAsk(eventId, vpid, { askedBy: asker });

  // The ask alone freezes nothing — a plan dated from a request is the bug the
  // handshake return exists to prevent.
  assert.equal((await plans(b)).length, 0, 'a plan exists before anybody agreed');

  const first = await pressYes(uid, eventId, b);
  assert.equal(first.status, 'ok');

  const after1 = await plans(b);
  assert.equal(after1.length, 1, 'the yes did not freeze a payment plan — the money step is missing again');
  // No schedule on the service → the flagged 50/50 estimate of the agreed total.
  assert.equal(after1[0]!.is_default_seeded, true);
  assert.deepEqual(amounts(after1[0]!), [50000, 50000], 'the instalments are not shares of the agreed total');
  assert.equal(after1[0]!.cleared_at, null);

  assert.equal(sent.length, 1, `expected ONE "payment info is ready", sent ${sent.length}`);
  assert.equal(sent[0]!.type, 'payment_info_sent');
  assert.equal(sent[0]!.userId, asker, 'the notice must go to the host who pressed the ask');
  assert.notEqual(sent[0]!.userId, partner);
  assert.equal(sent[0]!.relatedUrl, `/dashboard/${eventId}/vendors/${b}/workspace#payments`);
  assert.match(sent[0]!.body ?? '', /Lente Studio/);
  assert.deepEqual(
    (await noticeRows(eventId)).map((n) => [n.user_id, n.type]),
    [[asker, 'payment_info_sent']],
    'the notifications table does not hold exactly the one row',
  );

  // A second press: `already`, so the action never reaches the freeze.
  const second = await pressYes(uid, eventId, b);
  assert.equal(second.status, 'already');
  // The expiry sweep afterwards: this row is booked, not pending.
  const swept = await db.query<{ event_vendor_id: string }>(`SELECT * FROM public.expire_stale_lock_requests(200)`);
  assert.ok(!swept.rows.some((r) => r.event_vendor_id === b));

  assert.equal((await plans(b)).length, 1, 'a second yes or the sweep wrote a second plan row');
  assert.equal(sent.length, 1, 'a second yes or the sweep sent a second notice');
  assert.equal((await noticeRows(eventId)).length, 1);
});

/* ═══ 2 · the yes freezes the SAME plan the direct lock does ════════════════ */

test('the plan frozen at the yes is the plan the direct lock freezes — same amounts, same dates, same words', async () => {
  const { vpid, uid } = await newVendor('same@plan.test');

  // DIRECT: the couple's press books (status → contracted) and finalizeVendor
  // calls the freeze with the acting host.
  const direct = await newEvent('direct');
  const d = await newAsk(direct.eventId, vpid, { askedBy: null });
  await db.query(
    `UPDATE public.event_vendors SET status = 'contracted', lock_request_state = NULL, lock_requested_at = NULL
      WHERE vendor_id = $1`,
    [d],
  );
  const directResult = await freezePaymentPlanAtBooking(
    admin,
    {
      eventId: direct.eventId,
      vendorId: d,
      booking: { vendor_name: 'Lente Studio', marketplace_vendor_id: vpid, service_id: null },
      tellUserId: direct.asker,
      tag: 'finalizeVendor',
    },
    deps,
  );

  // HANDSHAKE: ask, then the supplier's yes.
  const asked = await newEvent('asked');
  const a = await newAsk(asked.eventId, vpid, { askedBy: asked.asker });
  // The request is two days old — the plan must NOT inherit that day.
  await db.query(
    `UPDATE public.event_vendors SET lock_requested_at = NOW() - INTERVAL '40 hours' WHERE vendor_id = $1`,
    [a],
  );
  const env = await pressYes(uid, asked.eventId, a);
  assert.equal(env.status, 'ok');

  const [dp] = await plans(d);
  const [ap] = await plans(a);
  assert.ok(dp && ap, 'one of the two paths wrote no plan');
  assert.equal(directResult.status, 'written');
  // Same computation, same day (both ran now): the two snapshots are identical.
  assert.deepEqual(ap.instances_json, dp.instances_json, 'the yes froze a different plan from the direct lock');
  assert.equal(ap.is_default_seeded, dp.is_default_seeded);
  // The "on lock" instalment counts from TODAY (the yes), not from the request.
  const today = new Date().toISOString().slice(0, 10);
  const onLock = ap.instances_json.find((i) => i.due_anchor === 'on_lock') ?? ap.instances_json[0]!;
  assert.equal(onLock.due_date, today, 'the plan is dated from the request, not from the yes');

  assert.equal(sent.length, 2);
  assert.equal(sent[0]!.title, sent[1]!.title);
  assert.equal(sent[0]!.body, sent[1]!.body, 'the two paths tell the couple in different words');
  assert.deepEqual([sent[0]!.userId, sent[1]!.userId], [direct.asker, asked.asker]);
});

/* ═══ 3 · a service with its own schedule is frozen from that schedule ══════ */

test("the supplier's own schedule is what gets frozen at the yes — seq-ordered, never the 50/50 estimate", async () => {
  const { eventId, asker } = await newEvent('sched');
  const { vpid, uid } = await newVendor('sched@plan.test');
  const svc = (
    await db.query<{ s: string }>(
      `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, is_active, primary_photo_r2_key)
       VALUES ($1, 'photo_booth', 40000, FALSE, 'vendor-media/plan/cover.jpg') RETURNING vendor_service_id AS s`,
      [vpid],
    )
  ).rows[0]!.s;
  // Inserted OUT of order on purpose: the freeze must read them by seq.
  await db.query(
    `INSERT INTO public.vendor_service_payment_schedules
       (vendor_service_id, vendor_profile_id, seq, label, amount_kind, percent_bps, due_anchor, due_offset_days)
     VALUES ($1, $2, 1, 'Balance', 'percent', 7000, 'before_event', 14),
            ($1, $2, 0, 'Downpayment', 'percent', 3000, 'on_lock', 0)`,
    [svc, vpid],
  );
  const b = await newAsk(eventId, vpid, { askedBy: asker, serviceId: svc, totalPhp: 80000 });

  assert.equal((await pressYes(uid, eventId, b)).status, 'ok');

  const [p] = await plans(b);
  assert.ok(p, 'no plan was frozen');
  assert.equal(p.is_default_seeded, false, 'a real schedule was replaced by the estimate');
  assert.deepEqual(p.instances_json.map((i) => i.label), ['Downpayment', 'Balance']);
  assert.deepEqual(amounts(p), [24000, 56000]);
  // 14 days before 2027-03-06.
  assert.equal(p.instances_json[1]!.due_date, '2027-02-20');
  assert.equal(sent.length, 1);
  assert.match(sent[0]!.body ?? '', /payment plan for Lente Studio/);
});

/* ═══ 4 · nobody recorded as asking: the plan, and no notice to a guess ═════ */

test('an ask with no recorded asker still gets its plan at the yes — and the notice goes to nobody', async () => {
  // The chat door writes the ask without lock_requested_by_user_id.
  const { eventId, asker, partner } = await newEvent('nobody');
  const { vpid, uid } = await newVendor('nobody@plan.test');
  const b = await newAsk(eventId, vpid, { askedBy: null });

  assert.equal((await pressYes(uid, eventId, b)).status, 'ok');

  assert.equal((await plans(b)).length, 1, 'a booking with no recorded asker was left with no plan');
  assert.equal(sent.length, 0, `the notice was addressed to somebody nobody recorded: ${JSON.stringify(sent)}`);
  const told = (await noticeRows(eventId)).map((n) => n.user_id);
  assert.ok(!told.includes(asker) && !told.includes(partner));
});

/* ═══ 5 · a package booking is left alone — its direct path writes no plan ══ */

test('a package booking gets no invented plan at the yes', async () => {
  const { eventId, asker } = await newEvent('pkg');
  const { vpid, uid } = await newVendor('pkg@plan.test');
  const tmpl = await db.query<{ package_id: string }>(
    `INSERT INTO public.vendor_packages
       (vendor_profile_id, package_name, primary_canonical_service, is_active, total_price_centavos)
     VALUES ($1, 'Full Day', 'photography', TRUE, 15000000) RETURNING package_id`,
    [vpid],
  );
  const booking = await db.query<{ booking_id: string }>(
    `INSERT INTO public.event_vendor_packages (event_id, package_id, status)
     VALUES ($1, $2, 'considering') RETURNING booking_id`,
    [eventId, tmpl.rows[0]!.package_id],
  );
  const anchor = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php,
        event_vendor_package_id, package_role, lock_request_state, lock_requested_at, lock_requested_by_user_id)
     VALUES ($1,'photographer','Lente Studio','considering',$2,150000,$3,'anchor','pending',NOW(),$4)
     RETURNING vendor_id`,
    [eventId, vpid, booking.rows[0]!.booking_id, asker],
  );
  const b = anchor.rows[0]!.vendor_id;

  assert.equal((await agree(uid, b)).status, 'ok');
  const result = await freezePaymentPlanAfterSupplierAgreed(admin, { eventId, eventVendorId: b }, deps);

  assert.deepEqual(result, { status: 'skipped', reason: 'package_booking' });
  assert.equal((await plans(b)).length, 0, 'a package row was given a plan its own direct path never writes');
  assert.equal(sent.length, 0);
});

/* ═══ 6 · the adapter's embed is real — a wrong hint is an error, not [] ════ */

test('the change-lines embed resolves through the NAMED foreign key, and an accepted change moves the plan', async () => {
  const { eventId, asker } = await newEvent('change');
  const { vpid, uid } = await newVendor('change@plan.test');
  const b = await newAsk(eventId, vpid, { askedBy: asker, totalPhp: 100000 });
  // An accepted change of +20,000 on the agreed total, as accept_change_order leaves it.
  await db.query(
    `INSERT INTO public.event_vendor_line_items (vendor_id, event_id, label, amount_php, is_change_delta)
     VALUES ($1, $2, 'Extra hour', 20000, TRUE)`,
    [b, eventId],
  );

  assert.equal((await pressYes(uid, eventId, b)).status, 'ok');
  const [p] = await plans(b);
  assert.deepEqual(amounts(p!), [60000, 60000], 'the plan ignored an accepted change — it is not a share of the agreed total NOW');

  // Vacuity check on the adapter: a hint that names no foreign key is an ERROR.
  const bad = await admin
    .from('event_vendors')
    .select('total_cost_php, change_lines:event_vendor_line_items!no_such_fkey(amount_php)')
    .eq('vendor_id', b)
    .maybeSingle();
  assert.ok(bad.error, 'the adapter answered a bogus embed with data — the embed is not being resolved');
});
