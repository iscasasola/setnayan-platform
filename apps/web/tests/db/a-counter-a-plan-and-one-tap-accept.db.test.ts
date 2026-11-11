/**
 * A COUNTER · A PLAN · ONE-TAP ACCEPT — Piece 1 · PR-3 · migration 20271340018194.
 *
 * ⚖ Owner 12 Nov (DECISION_LOG "QUOTE MONEY — THREE ANSWERS", "FIVE GUARDS"): either side counters with a price or
 * proposes a payment plan; the OTHER side accepts, counters or declines. Accept writes exactly ONE new quote version,
 * landing ACCEPTED (the couple's counter is their yes); the plan re-splits; paid rows never change; no row below zero —
 * a drop under what was paid is money owed back, never a negative row. An expired counter cannot be accepted; a locked
 * plan refuses a plan proposal.
 *
 * What would silently undo it (each SABOTAGED red, then restored — see the PR):
 *   1. accept writes zero or two versions, or a paid row moves;            sabotage: drop the paid-seq filter in resplit
 *   2. an expired counter can be accepted;                                 sabotage: drop the COUNTER_EXPIRED check
 *   3. plan_locked lets a plan proposal through;                           sabotage: lock read as changes_locked
 *   4. SQL and TS disagree, or a row goes negative instead of owed back;   sabotage: GREATEST(0, …) dropped in resplit
 *
 * Run (from apps/web): npx tsx --test tests/db/a-counter-a-plan-and-one-tap-accept.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { resplitAfterCounter, type StoredPlanRow } from '../../lib/chat-cards';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
});

let seq = 0;
const uniq = () => `ctr-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

type World = { eventId: string; host: string; supplier: string; shop: string; threadId: string; vendorId: string };

async function newWorld(): Promise<World> {
  const host = await newUser();
  const supplier = await newUser();
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
    [supplier, `Shop ${uniq()}`],
  );
  const shop = v.rows[0]!.vendor_profile_id;
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, estimated_pax)
     VALUES ('A celebration', 'birthday', DATE '2027-12-12', 'day', 100) RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status) VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, host],
  );
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'photographer'::public.vendor_category, 'The Shop', 'considering', $2) RETURNING vendor_id`,
    [eventId, shop],
  );
  return { eventId, host, supplier, shop, threadId: t.rows[0]!.thread_id, vendorId: ev.rows[0]!.vendor_id };
}

const row = (s: number, amount: number, auto = false) => ({
  seq: s, label: auto ? 'Final balance' : `Payment ${s + 1}`, kind: auto ? 'auto' : 'fixed', amount_centavos: amount, raw_centavos: amount,
  percent_bps: null, due: 'on_lock', offset_days: 0, is_downpayment: s === 0, is_auto_balance: auto, credit_applied_centavos: 0,
});
const plan = (rows: ReturnType<typeof row>[]) => ({
  version: 1, base_centavos: rows.reduce((a, r) => a + r.amount_centavos, 0), credit_centavos: 0,
  total_centavos: rows.reduce((a, r) => a + r.amount_centavos, 0), balances: true, over_by_centavos: 0, credit_over_centavos: 0, installments: rows,
});

/** A quote written as the database owner, with two lines and a plan (First payment ₱20,000 · Final balance ₱40,000). */
async function quote(w: World, status = 'sent', total = 6_000_000): Promise<string> {
  const first = 2_000_000;
  const r = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals
       (event_id, vendor_profile_id, title, status, total_centavos, sent_at, line_items, merge_snapshot, valid_until, payment_schedule, resolved_at)
     VALUES ($1, $2, 'Full-day coverage', $3, $4, NOW(),
             jsonb_build_array(jsonb_build_object('label','Coverage','detail',NULL,'amount_centavos',$4::bigint - 900000),
                               jsonb_build_object('label','Second shooter','detail',NULL,'amount_centavos',900000)),
             '{}'::jsonb, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7, $5::jsonb,
             CASE WHEN $3 = 'accepted' THEN NOW() ELSE NULL END)
     RETURNING proposal_id`,
    [w.eventId, w.shop, status, total, JSON.stringify(plan([row(0, first), row(1, total - first, true)]))],
  );
  return r.rows[0]!.proposal_id;
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<{ value?: T; error?: string }> {
  await setAuthUid(db, uid);
  await db.exec(`BEGIN`);
  try {
    await db.exec(`SET LOCAL ROLE authenticated`);
    const value = await fn();
    await db.exec(`COMMIT`);
    return { value };
  } catch (e) {
    await db.exec(`ROLLBACK`);
    return { error: (e as Error).message };
  } finally {
    await setAuthUid(db, null);
  }
}

const counter = (w: World, p: string, amount: number, opts: { scope?: string | null; until?: string | null; counters?: string | null } = {}) =>
  db
    .query<{ id: string }>(
      `SELECT public.ask_for_a_change($1, 'quote', '', $2, NULL, $3::bigint, $4, NULL, $5::date, $6::uuid) AS id`,
      [w.threadId, p, amount, opts.scope ?? null, opts.until ?? null, opts.counters ?? null],
    )
    .then((r) => r.rows[0]!.id);
const answer = (id: string, a: string) => db.query<{ r: string }>(`SELECT public.answer_change_ask($1, $2, NULL) AS r`, [id, a]).then((r) => r.rows[0]!.r);
const versions = (w: World) =>
  db.query<{ proposal_id: string; status: string; total_centavos: string; payment_schedule: { installments: StoredPlanRow[] }; line_items: { label: string; amount_centavos: number }[] }>(
    `SELECT proposal_id, status, total_centavos, payment_schedule, line_items FROM public.vendor_proposals WHERE event_id = $1 ORDER BY created_at`,
    [w.eventId],
  ).then((r) => r.rows);
async function payFirst(w: World) {
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, vendor_confirmed_at, schedule_instance_seq) VALUES ($1, $2, 20000, 'GCash', NOW(), 0)`,
    [w.eventId, w.vendorId],
  );
}

test('1 · the supplier accepts the couple’s counter: exactly ONE new version, ACCEPTED; the paid row stays; the balance takes the change', async () => {
  const w = await newWorld();
  const p = await quote(w, 'accepted', 6_000_000);
  await payFirst(w); // the paid quotation (₱60,000) is now the floor; a counter UP still goes
  const c = await as(w.host, () => counter(w, p, 6_500_000, { until: null }));
  assert.equal(c.error, undefined, c.error);
  const before = (await versions(w)).length;
  const a = await as(w.supplier, () => answer(c.value!, 'accepted'));
  assert.equal(a.error, undefined, a.error);
  assert.equal(a.value, 'accepted');
  const all = await versions(w);
  assert.equal(all.length, before + 1, 'accept must write exactly one version');
  const live = all.filter((v) => ['sent', 'viewed', 'accepted'].includes(v.status));
  assert.equal(live.length, 1, 'one live version');
  const v = live[0]!;
  assert.equal(v.status, 'accepted', 'the couple’s counter is their yes — the version lands ACCEPTED');
  assert.equal(Number(v.total_centavos), 6_500_000);
  const rows = v.payment_schedule.installments;
  assert.deepEqual(rows.map((r) => r.amount_centavos), [2_000_000, 4_500_000], 'the paid first payment never moves; the Final balance takes the rise');
  assert.equal(all.find((x) => x.proposal_id === p)!.status, 'superseded');
  const ev = await db.query<{ total_cost_php: string }>(`SELECT total_cost_php FROM public.event_vendors WHERE vendor_id = $1`, [w.vendorId]);
  assert.equal(Number(ev.rows[0]!.total_cost_php), 65_000);
  const st = await db.query<{ status: string; answer_proposal_id: string }>(`SELECT status, answer_proposal_id FROM public.booking_change_asks WHERE ask_id = $1`, [c.value]);
  assert.equal(st.rows[0]!.status, 'accepted');
  assert.equal(st.rows[0]!.answer_proposal_id, v.proposal_id);
  // A second tap writes nothing.
  const again = await as(w.supplier, () => answer(c.value!, 'accepted'));
  assert.equal(again.value, 'already');
  assert.equal((await versions(w)).length, before + 1);
  // The new version's card is in the chat.
  const card = await db.query(`SELECT 1 FROM public.chat_messages WHERE thread_id = $1 AND proposal_id = $2`, [w.threadId, v.proposal_id]);
  assert.equal(card.rows.length, 1);
});

test('1b · the hosts accept a supplier’s counter on ONE line (countering theirs): one version, accepted, the line replaced', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent', 6_000_000);
  const mine = await as(w.host, () => counter(w, p, 5_500_000));
  assert.equal(mine.error, undefined, mine.error);
  // The shop counters back on the Second shooter line only.
  const back = await as(w.supplier, () => counter(w, p, 700_000, { scope: 'Second shooter', counters: mine.value }));
  assert.equal(back.error, undefined, back.error);
  const first = await db.query<{ status: string }>(`SELECT status FROM public.booking_change_asks WHERE ask_id = $1`, [mine.value]);
  assert.equal(first.rows[0]!.status, 'countered');
  // The shop cannot accept its own counter; the hosts can.
  assert.match((await as(w.supplier, () => answer(back.value!, 'accepted'))).error ?? '', /NOT_THE_HOSTS_SIDE/);
  const a = await as(w.host, () => answer(back.value!, 'accepted'));
  assert.equal(a.error, undefined, a.error);
  const live = (await versions(w)).filter((v) => v.status === 'accepted');
  assert.equal(live.length, 1);
  assert.equal(Number(live[0]!.total_centavos), 5_800_000);
  assert.equal(live[0]!.line_items.find((l) => l.label === 'Second shooter')!.amount_centavos, 700_000);
  assert.deepEqual(live[0]!.payment_schedule.installments.map((r) => r.amount_centavos), [2_000_000, 3_800_000]);
});

test('2 · an expired counter can never be accepted ("Expired · ask again"), and a past Good until is refused', async () => {
  const w = await newWorld();
  const p = await quote(w);
  const yesterday = (await db.query<{ d: string }>(`SELECT ((NOW() AT TIME ZONE 'Asia/Manila')::date - 1)::text AS d`)).rows[0]!.d;
  assert.match((await as(w.host, () => counter(w, p, 5_500_000, { until: yesterday }))).error ?? '', /GOOD_UNTIL_PAST/);
  const today = (await db.query<{ d: string }>(`SELECT ((NOW() AT TIME ZONE 'Asia/Manila')::date)::text AS d`)).rows[0]!.d;
  const c = await as(w.host, () => counter(w, p, 5_500_000, { until: today }));
  assert.equal(c.error, undefined, c.error);
  // The day passes.
  await db.query(`UPDATE public.booking_change_asks SET good_until = $2::date WHERE ask_id = $1`, [c.value, yesterday]);
  const before = (await versions(w)).length;
  assert.match((await as(w.supplier, () => answer(c.value!, 'accepted'))).error ?? '', /COUNTER_EXPIRED/);
  assert.equal((await versions(w)).length, before, 'an expired counter wrote a version');
  // Countering an expired one is refused too; declining it is still allowed.
  assert.match((await as(w.supplier, () => counter(w, p, 5_800_000, { counters: c.value }))).error ?? '', /COUNTER_EXPIRED/);
});

test('3 · plan_locked refuses a plan proposal (and its accept)', async () => {
  const w = await newWorld();
  const p = await quote(w);
  const proposed = JSON.stringify({ installments: [row(0, 3_000_000), row(1, 3_000_000, true)] });
  const propose = (uid: string) => as(uid, () => db.query<{ id: string }>(`SELECT public.ask_for_a_change($1, 'plan', '', $2, NULL, NULL, NULL, $3::jsonb, NULL, NULL) AS id`, [w.threadId, p, proposed]).then((r) => r.rows[0]!.id));
  const ok = await propose(w.supplier);
  assert.equal(ok.error, undefined, ok.error);
  await db.query(`UPDATE public.vendor_proposals SET plan_locked = TRUE WHERE proposal_id = $1`, [p]);
  assert.match((await propose(w.host)).error ?? '', /ITEM_LOCKED/);
  assert.match((await as(w.host, () => answer(ok.value!, 'accepted'))).error ?? '', /ITEM_LOCKED/);
  // A plan that does not pay in full is refused before the lock matters.
  await db.query(`UPDATE public.vendor_proposals SET plan_locked = FALSE WHERE proposal_id = $1`, [p]);
  const short = await as(w.host, () => db.query(`SELECT public.ask_for_a_change($1, 'plan', '', $2, NULL, NULL, NULL, $3::jsonb)`, [w.threadId, p, JSON.stringify({ installments: [row(0, 3_000_000)] })]));
  assert.match(short.error ?? '', /PLAN_DOES_NOT_PAY_IN_FULL/);
  // Unlocked, the hosts accept the supplier's plan: one version, the proposed rows.
  const a = await as(w.host, () => answer(ok.value!, 'accepted'));
  assert.equal(a.error, undefined, a.error);
  const live = (await versions(w)).filter((v) => v.status === 'accepted');
  assert.deepEqual(live[0]!.payment_schedule.installments.map((r) => r.amount_centavos), [3_000_000, 3_000_000]);
});

test('4 · the re-split: SQL = TS, paid rows fixed, never a negative row — a drop under what was paid is OWED BACK', async () => {
  const cases: { rows: StoredPlanRow[]; total: number; paid: number[] }[] = [
    { rows: [row(0, 2_000_000), row(1, 4_000_000, true)], total: 6_500_000, paid: [0] },
    { rows: [row(0, 2_000_000), row(1, 4_000_000, true)], total: 5_000_000, paid: [0] },
    { rows: [row(0, 2_000_000), row(1, 1_000_000), row(2, 3_000_000, true)], total: 2_500_000, paid: [0] },
    // Owed back: ₱30,000 paid, the total drops to ₱25,000 — the unpaid rows go to zero, ₱5,000 is owed back.
    { rows: [row(0, 3_000_000), row(1, 3_000_000, true)], total: 2_500_000, paid: [0] },
    { rows: [row(0, 3_000_000), row(1, 3_000_000)], total: 7_000_000, paid: [0, 1] },
  ];
  for (const c of cases) {
    const sql = (await db.query<{ r: { installments: StoredPlanRow[]; owed_back_centavos: number } }>(
      `SELECT public.change_ask_resplit($1::jsonb, $2::bigint, $3::int[]) AS r`,
      [JSON.stringify(c.rows), c.total, `{${c.paid.join(',')}}`],
    )).rows[0]!.r;
    const ts = resplitAfterCounter(c.rows, c.total, new Set(c.paid));
    assert.deepEqual(sql.installments.map((r) => [r.seq, Number(r.amount_centavos)]), ts.rows.map((r) => [r.seq, r.amount_centavos]), `SQL ≠ TS for ${JSON.stringify(c)}`);
    assert.equal(Number(sql.owed_back_centavos), ts.owedBackCentavos);
    for (const r of sql.installments) assert.ok(Number(r.amount_centavos) >= 0, 'a row went below zero');
    for (const s of c.paid) assert.equal(Number(sql.installments.find((r) => r.seq === s)!.amount_centavos), c.rows.find((r) => r.seq === s)!.amount_centavos, 'a paid row moved');
    const sum = sql.installments.reduce((a, r) => a + Number(r.amount_centavos), 0);
    assert.equal(sum - Number(sql.owed_back_centavos), c.total, 'rows − owed back must equal the new total');
  }
  assert.equal(resplitAfterCounter([row(0, 3_000_000), row(1, 3_000_000, true)], 2_500_000, new Set([0])).owedBackCentavos, 500_000);
});
