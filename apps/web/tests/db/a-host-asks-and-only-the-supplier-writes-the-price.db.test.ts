/**
 * A HOST ASKS · ONLY THE SUPPLIER WRITES THE PRICE · THE PAID QUOTE IS THE FLOOR · THE PLAN PAYS IN FULL
 * Supplier Build 3 · lane C · migration 20271332041210.
 *
 * ⚖ Owner 2026-11-08/09 (DECISION_LOG 🧾 💳): only the supplier edits the quote and its plan; the hosts' side asks
 * for a change, which the supplier revises or declines, and is refused while the item is locked; a later version may
 * never go below the paid quotation; the payment plan always pays the whole quote.
 *
 * Asserted BY BEHAVIOUR against the replayed schema under the real `authenticated` role.
 * Run (from apps/web): tsx --test tests/db/a-host-asks-and-only-the-supplier-writes-the-price.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

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
const uniq = () => `ask-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

type World = { eventId: string; host: string; supplier: string; shop: string; threadId: string; stranger: string; vendorId: string };

async function newWorld(): Promise<World> {
  const host = await newUser();
  const supplier = await newUser();
  const stranger = await newUser();
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
  return { eventId, host, supplier, shop, threadId: t.rows[0]!.thread_id, stranger, vendorId: ev.rows[0]!.vendor_id };
}

/** A quote row written as the database owner (the way the shipped send's DEFINER path lands one). */
async function quote(w: World, status: string, totalCentavos: number, schedule: unknown = null): Promise<string> {
  const r = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals
       (event_id, vendor_profile_id, title, status, total_centavos, sent_at, line_items, merge_snapshot, valid_until, payment_schedule, resolved_at)
     VALUES ($1, $2, 'Full-day coverage', $3, $4, NOW(),
             jsonb_build_array(jsonb_build_object('label','Coverage','detail',NULL,'amount_centavos',$4::bigint)),
             '{}'::jsonb, (NOW() AT TIME ZONE 'Asia/Manila')::date + 7, COALESCE($5::jsonb, '{}'::jsonb),
             CASE WHEN $3 = 'accepted' THEN NOW() ELSE NULL END)
     RETURNING proposal_id`,
    [w.eventId, w.shop, status, totalCentavos, schedule === null ? null : JSON.stringify(schedule)],
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

const ask = (w: World, subject: string, note = 'Can we add a drone?', proposalId: string | null = null) =>
  db.query<{ id: string }>(`SELECT public.ask_for_a_change($1, $2, $3, $4, NULL) AS id`, [w.threadId, subject, note, proposalId]).then((r) => r.rows[0]!.id);

test('💬 the host asks for a change: one ask row, one line in the chat; the shop and the hosts read it, a stranger does not', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent', 6_000_000);
  const r = await as(w.host, () => ask(w, 'quote', 'Can we add a drone?', p));
  assert.equal(r.error, undefined, r.error);
  const line = await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 1`, [w.threadId]);
  assert.match(line.rows[0]!.body, /^Asked for a change · Quotation · /);
  const shopSees = await as(w.supplier, () => db.query(`SELECT 1 FROM public.booking_change_asks WHERE thread_id = $1`, [w.threadId]).then((x) => x.rows.length));
  assert.equal(shopSees.value, 1);
  const strangerSees = await as(w.stranger, () => db.query(`SELECT 1 FROM public.booking_change_asks WHERE thread_id = $1`, [w.threadId]).then((x) => x.rows.length));
  assert.equal(strangerSees.value, 0);
});

test('🛑 the shop cannot ask itself, a stranger cannot ask, and nobody writes the table directly', async () => {
  const w = await newWorld();
  await quote(w, 'sent', 6_000_000);
  assert.match((await as(w.supplier, () => ask(w, 'quote'))).error ?? '', /NOT_THE_HOSTS_SIDE/);
  assert.match((await as(w.stranger, () => ask(w, 'quote'))).error ?? '', /NOT_IN_THIS_CHAT/);
  const direct = await as(w.host, () =>
    db.query(`INSERT INTO public.booking_change_asks (thread_id, vendor_profile_id, subject, note, asked_by) VALUES ($1,$2,'quote','x',$3)`, [w.threadId, w.shop, w.host]),
  );
  assert.match(direct.error ?? '', /permission denied/);
});

test('🔒 a locked quotation or plan cannot be asked about', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent', 6_000_000);
  await db.query(`UPDATE public.vendor_proposals SET changes_locked = TRUE WHERE proposal_id = $1`, [p]);
  assert.match((await as(w.host, () => ask(w, 'quote', 'x', p))).error ?? '', /ITEM_LOCKED/);
  assert.equal((await as(w.host, () => ask(w, 'plan', 'x', p))).error, undefined, 'the plan is not locked');
  await db.query(`UPDATE public.vendor_proposals SET plan_locked = TRUE WHERE proposal_id = $1`, [p]);
  assert.match((await as(w.host, () => ask(w, 'plan', 'x', p))).error ?? '', /ITEM_LOCKED/);
});

test('✅ only the shop answers, once: declined posts its line; a second answer is a no-op', async () => {
  const w = await newWorld();
  const p = await quote(w, 'sent', 6_000_000);
  const asked = await as(w.host, () => ask(w, 'quote', 'Can we add a drone?', p));
  assert.equal(asked.error, undefined, asked.error);
  const id = asked.value!;
  assert.match((await as(w.host, () => db.query(`SELECT public.answer_change_ask($1, 'declined', NULL)`, [id]))).error ?? '', /./, 'the host cannot answer');
  const a = await as(w.supplier, () => db.query<{ r: string }>(`SELECT public.answer_change_ask($1, 'declined', NULL) AS r`, [id]).then((x) => x.rows[0]!.r));
  assert.equal(a.error, undefined, a.error);
  const again = await as(w.supplier, () => db.query<{ r: string }>(`SELECT public.answer_change_ask($1, 'revised', NULL) AS r`, [id]).then((x) => x.rows[0]!.r));
  assert.equal(again.value, 'already');
  const st = await db.query<{ status: string }>(`SELECT status FROM public.booking_change_asks WHERE ask_id = $1`, [id]);
  assert.equal(st.rows[0]!.status, 'declined');
  const line = await db.query<{ body: string }>(`SELECT body FROM public.chat_messages WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 1`, [w.threadId]);
  assert.equal(line.rows[0]!.body, 'Change asked · Quotation · declined by the supplier');
});

test('🧾 the paid quotation is the floor — and only once a payment is confirmed', async () => {
  const w = await newWorld();
  await quote(w, 'accepted', 6_000_000);
  // No confirmed payment yet: a lower version may go.
  const lowBefore = await db.query(`SELECT 1`).then(() => quote(w, 'sent', 5_000_000)).then(() => 'ok', (e: Error) => e.message);
  assert.equal(lowBefore, 'ok');
  await db.query(`UPDATE public.vendor_proposals SET status = 'superseded' WHERE event_id = $1 AND status = 'sent'`, [w.eventId]);
  await db.query(
    `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, vendor_confirmed_at) VALUES ($1, $2, 30000, 'GCash', NOW())`,
    [w.eventId, w.vendorId],
  );
  const low = await quote(w, 'sent', 5_000_000).then(() => 'ok', (e: Error) => e.message);
  assert.match(low, /QUOTE_BELOW_PAID_FLOOR/);
  const atFloor = await quote(w, 'sent', 6_000_000).then(() => 'ok', (e: Error) => e.message);
  assert.equal(atFloor, 'ok');
  // The reader: the event's own people read the floor; a stranger reads nothing.
  const hostReads = await as(w.host, () => db.query<{ f: string | null }>(`SELECT public.paid_quote_floor_centavos($1,$2) AS f`, [w.eventId, w.shop]).then((x) => x.rows[0]!.f));
  assert.equal(Number(hostReads.value), 6_000_000);
  const strangerReads = await as(w.stranger, () => db.query<{ f: string | null }>(`SELECT public.paid_quote_floor_centavos($1,$2) AS f`, [w.eventId, w.shop]).then((x) => x.rows[0]!.f));
  assert.equal(strangerReads.value, null);
  const internal = await as(w.host, () => db.query(`SELECT public.quote_floor_of($1,$2)`, [w.eventId, w.shop]));
  assert.match(internal.error ?? '', /permission denied/);
});

test('💳 a sent plan must pay the whole quote — short or over is refused', async () => {
  const w = await newWorld();
  const plan = (amounts: number[]) => ({ version: 1, over_by_centavos: 0, credit_over_centavos: 0, installments: amounts.map((a, i) => ({ seq: i, label: `P${i}`, amount_centavos: a })) });
  assert.equal(await quote(w, 'sent', 6_000_000, plan([3_000_000, 3_000_000])).then(() => 'ok', (e: Error) => e.message), 'ok');
  assert.match(await quote(w, 'sent', 6_000_000, plan([3_000_000, 2_000_000])).then(() => 'ok', (e: Error) => e.message), /PLAN_DOES_NOT_PAY_IN_FULL/);
  assert.match(await quote(w, 'sent', 6_000_000, { ...plan([3_000_000, 3_000_000]), over_by_centavos: 100 }).then(() => 'ok', (e: Error) => e.message), /PLAN_DOES_NOT_PAY_IN_FULL/);
});
