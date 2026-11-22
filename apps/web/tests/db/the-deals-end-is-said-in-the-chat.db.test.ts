/**
 * THE DEAL'S END IS SAID IN THE CHAT (Unichat part H2, 20 Nov 2026) · migration `the_deals_end_is_said_in_the_chat`.
 *
 * The database writes the lines; the app reads them back by their EXACT words (`lib/chat-card-lines.ts`). This file
 * holds the two ends together, against the real replayed schema:
 *   1 · a delivery posts "Handover · <kind>[ · label]", and the app's parser reads the kind back;
 *   2 · the hosts' confirmation posts "Handover received · <kind>" and — once per chat — the review ask;
 *   3 · a review already posted means no review ask;
 *   4 · the first crew named on the schedule posts "Crew named for the day", once; nothing else does;
 *   5 · a confirmed payment's own line (20271329937802) finds its payment ROW through `receiptFor` — amount, paid on
 *       and what is left come from the rows, at the row's real timestamps;
 *   6 · no line can be posted → the delivery, the confirmation and the schedule edit still land;
 *   7 · the trigger functions are doors for nobody.
 *
 * Run (from apps/web): tsx --test tests/db/the-deals-end-is-said-in-the-chat.db.test.ts
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { DAY_CREW_LINE, REVIEW_ASK_LINE, dayCrewFromLine, handoverFromLine, receiptFromLine, reviewAskFromLine, streamLineKind } from '../../lib/chat-card-lines';
import { dayCrew, handoverFor, receiptFor, type HandoverRow, type PaymentRow } from '../../lib/deal-end';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

let seq = 0;
const uniq = () => `de-${++seq}`;

type World = { eventId: string; host: string; shop: string; threadId: string | null; booking: string };

async function newWorld(opts: { thread?: boolean } = {}): Promise<World> {
  const mk = async () =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [`${uniq()}@test.local`],
      )
    ).rows[0]!.id;
  const host = await mk();
  const supplier = await mk();
  const shop = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW(), 'verified')
       RETURNING vendor_profile_id`,
      [supplier, `Shop ${uniq()}`],
    )
  ).rows[0]!.vendor_profile_id;
  const eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
       VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, host]);
  let threadId: string | null = null;
  if (opts.thread !== false) {
    threadId = (
      await db.query<{ thread_id: string }>(
        `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
         VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
        [eventId, shop, host],
      )
    ).rows[0]!.thread_id;
  }
  const booking = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1,'catering','Lumina','contracted',51000,$2) RETURNING vendor_id`,
      [eventId, shop],
    )
  ).rows[0]!.vendor_id;
  return { eventId, host, shop, threadId, booking };
}

type Line = { body: string; created_at: string };
async function systemLines(w: World): Promise<Line[]> {
  if (!w.threadId) return [];
  return (
    await db.query<Line>(
      `SELECT body, created_at::text AS created_at FROM public.chat_messages
        WHERE thread_id = $1 AND sender_role = 'system' ORDER BY created_at, message_id`,
      [w.threadId],
    )
  ).rows;
}
const bodies = async (w: World) => (await systemLines(w)).map((l) => l.body);

async function deliver(w: World, kind: string, label: string | null): Promise<string> {
  return (
    await db.query<{ handover_id: string }>(
      `INSERT INTO public.booking_handovers (event_vendor_id, event_id, vendor_profile_id, kind, label, payload)
       VALUES ($1,$2,$3,$4,$5,'https://example.com/album') RETURNING handover_id`,
      [w.booking, w.eventId, w.shop, kind, label],
    )
  ).rows[0]!.handover_id;
}
async function confirm(handoverId: string): Promise<void> {
  await db.query(`UPDATE public.booking_handovers SET status = 'acknowledged', couple_acknowledged_at = NOW() WHERE handover_id = $1`, [handoverId]);
}

test('1 · a delivery posts its line, and the app reads the kind back', async () => {
  const w = await newWorld();
  await deliver(w, 'gallery_link', 'Lighting photos');
  await deliver(w, 'signoff', null);
  const lines = await systemLines(w);
  const handovers = lines.filter((l) => streamLineKind(l.body) === 'handover');
  assert.deepEqual(
    handovers.map((l) => l.body),
    ['Handover · Album link · Lighting photos', 'Handover · All delivered'],
  );
  assert.deepEqual(handoverFromLine(handovers[0]!.body), { kind: 'gallery_link', received: false });
  assert.deepEqual(handoverFromLine(handovers[1]!.body), { kind: 'signoff', received: false });

  // The card finds the ROW from the line's own time — the two are written in one transaction.
  const rows = (
    await db.query<HandoverRow>(
      `SELECT handover_id, event_vendor_id, kind, label, payload, status, created_at::text AS created_at,
              couple_acknowledged_at::text AS couple_acknowledged_at
         FROM public.booking_handovers WHERE event_id = $1`,
      [w.eventId],
    )
  ).rows;
  assert.equal(handoverFor(rows, 'gallery_link', handovers[0]!.created_at)?.label, 'Lighting photos');
  assert.equal(handoverFor(rows, 'note', handovers[0]!.created_at), null, 'a kind nobody delivered finds nothing');
});

test('2 · the confirmation posts "received" and asks for the review once per chat', async () => {
  const w = await newWorld();
  const a = await deliver(w, 'gallery_link', null);
  const b = await deliver(w, 'file', null);
  assert.equal((await bodies(w)).filter(reviewAskFromLine).length, 0, 'nothing is asked before a handover is confirmed');
  await confirm(a);
  await confirm(b);
  // A second write of the same status says nothing new.
  await confirm(a);
  const all = await bodies(w);
  assert.deepEqual(
    all.filter((x) => x.startsWith('Handover received')),
    ['Handover received · Album link', 'Handover received · Sample / proof'],
  );
  assert.deepEqual(handoverFromLine('Handover received · Album link'), { kind: 'gallery_link', received: true });
  assert.equal(all.filter((x) => x === REVIEW_ASK_LINE).length, 1, 'the review is asked once, not once per handover');
  assert.equal(streamLineKind(REVIEW_ASK_LINE), 'review');
});

test('3 · a review already posted is never asked for again', async () => {
  const w = await newWorld();
  await db.query(
    `INSERT INTO public.vendor_reviews
       (vendor_profile_id, event_id, couple_user_id, rating_overall, rating_communication, rating_quality, rating_value, rating_on_time, body)
     VALUES ($1,$2,$3,5,5,5,5,5,'They were wonderful on the day.')`,
    [w.shop, w.eventId, w.host],
  );
  await confirm(await deliver(w, 'signoff', null));
  const all = await bodies(w);
  assert.ok(all.includes('Handover received · All delivered'));
  assert.equal(all.filter(reviewAskFromLine).length, 0);
});

test('4 · the first crew named posts one line; an unnamed task and a hand-added supplier post none', async () => {
  const w = await newWorld();
  const chapter = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1,'Reception','2026-12-12T18:00:00Z') RETURNING block_id`,
      [w.eventId],
    )
  ).rows[0]!.block_id;
  const moment = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, parent_block_id)
       VALUES ($1,'Setup','2026-12-12T13:00:00Z','2026-12-12T15:00:00Z',$2) RETURNING block_id`,
      [w.eventId, chapter],
    )
  ).rows[0]!.block_id;
  const task = async (row: Record<string, unknown>) => {
    const cols = Object.keys(row);
    await db.query(`INSERT INTO public.event_schedule_tasks (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(row));
  };

  // The supplier itself, no crew named: nothing to say.
  await task({ block_id: moment, vendor_id: w.booking, what: 'Sets up the lights' });
  assert.equal((await bodies(w)).filter(dayCrewFromLine).length, 0);

  // A supplier the hosts typed in by hand has no shop, so no conversation to say it in.
  const byHand = (
    await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php) VALUES ($1,'catering','Tita Bing','contracted',10000) RETURNING vendor_id`,
      [w.eventId],
    )
  ).rows[0]!.vendor_id;
  await task({ block_id: moment, vendor_id: byHand, crew: 'Kitchen', what: 'Cooks' });
  assert.equal((await bodies(w)).filter(dayCrewFromLine).length, 0);

  await task({ block_id: moment, vendor_id: w.booking, crew: 'Jun Reyes', what: 'Lights tech', call_at: '2026-12-12T12:00:00Z' });
  await task({ block_id: moment, vendor_id: w.booking, crew: 'Paolo Cruz', what: 'Sound engineer' });
  await task({ block_id: moment, vendor_id: w.booking, crew: 'jun reyes', what: 'Rigger', call_at: '2026-12-12T12:30:00Z' });
  const all = await bodies(w);
  assert.equal(all.filter((x) => x === DAY_CREW_LINE).length, 1, 'said once, however many crews are named');
  assert.equal(streamLineKind(DAY_CREW_LINE), 'crew');

  // What the card shows, from the rows as stored: one row per person, roles joined, the earliest call first.
  const rows = (
    await db.query<{ crew: string | null; what: string; call_at: string | null; moment_start: string | null; sort_order: number }>(
      `SELECT t.crew, t.what, t.call_at::text AS call_at, b.start_at::text AS moment_start, t.sort_order
         FROM public.event_schedule_tasks t JOIN public.event_schedule_blocks b ON b.block_id = t.block_id
        WHERE t.vendor_id = $1 AND t.crew IS NOT NULL ORDER BY t.created_at, t.task_id`,
      [w.booking],
    )
  ).rows;
  const crew = dayCrew(rows);
  assert.deepEqual(
    crew.members.map((m) => [m.name, m.roles]),
    [
      ['Jun Reyes', ['Lights tech', 'Rigger']],
      ['Paolo Cruz', ['Sound engineer']],
    ],
  );
  assert.equal(Date.parse(crew.firstArrival!), Date.parse('2026-12-12T12:00:00Z'));
  assert.equal(Date.parse(crew.members[1]!.arriveAt!), Date.parse('2026-12-12T13:00:00Z'), 'no call time of their own → they arrive with the moment');
});

test('5 · a confirmed payment’s line finds its own row — the receipt’s figures are the rows’', async () => {
  const w = await newWorld();
  await db.query(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, sent_at, resolved_at, valid_until)
     VALUES ($1,$2,'Lights & sound',5100000,'accepted',NOW(),NOW(),DATE '2026-12-01')`,
    [w.shop, w.eventId],
  );
  const pay = async (amount: number) =>
    (
      await db.query<{ payment_id: string }>(
        `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, paid_at) VALUES ($1,$2,$3,'GCash',DATE '2026-11-20') RETURNING payment_id`,
        [w.eventId, w.booking, amount],
      )
    ).rows[0]!.payment_id;
  const first = await pay(15300);
  const second = await pay(15300.5);
  await db.query(`UPDATE public.event_vendor_payments SET vendor_confirmed_at = NOW() WHERE payment_id = $1`, [first]);
  await db.query(`UPDATE public.event_vendor_payments SET vendor_confirmed_at = NOW() + INTERVAL '2 hours' WHERE payment_id = $1`, [second]);

  const receipts = (await systemLines(w)).filter((l) => streamLineKind(l.body) === 'receipt');
  assert.deepEqual(
    receipts.map((l) => l.body),
    ['Payment confirmed · ₱15,300', 'Payment confirmed · ₱15,300.50'],
  );
  const rows = (
    await db.query<PaymentRow>(
      `SELECT payment_id, amount_php, paid_at::text AS paid_at, method, reference, is_deposit_record,
              vendor_confirmed_at::text AS vendor_confirmed_at, payment_refused_at::text AS payment_refused_at
         FROM public.event_vendor_payments WHERE vendor_id = $1`,
      [w.booking],
    )
  ).rows;
  const agreed = Number((await db.query<{ t: string }>(`SELECT total_centavos::text AS t FROM public.vendor_proposals WHERE event_id = $1`, [w.eventId])).rows[0]!.t);
  const line = receipts[0]!;
  const parsed = receiptFromLine(line.body)!;
  const r = receiptFor({ payments: rows, lineAt: line.created_at, ...parsed, agreedCentavos: agreed });
  assert.ok(r, 'the line found its payment');
  assert.equal(r.paymentId, first);
  assert.equal(r.amountCentavos, 1530000);
  assert.equal(r.whatFor, 'Payment');
  assert.equal(r.method, 'GCash');
  assert.match(r.paidOn ?? '', /^2026-11-20/);
  // What is left as it stood at THIS confirmation: the later ₱15,300.50 is not yet counted against it.
  assert.equal(r.paidCentavos, 1530000);
  assert.equal(r.leftCentavos, 5100000 - 1530000);
  // A line whose amount no confirmed payment carries finds nothing — never the nearest other payment.
  assert.equal(receiptFor({ payments: rows, lineAt: line.created_at, amountWords: '₱1', first: false, agreedCentavos: agreed }), null);
});

test('6 · with no conversation to say it in, the delivery, the confirmation and the schedule still land', async () => {
  const w = await newWorld({ thread: false });
  const h = await deliver(w, 'note', 'Thank you');
  await confirm(h);
  const status = (await db.query<{ status: string }>(`SELECT status FROM public.booking_handovers WHERE handover_id = $1`, [h])).rows[0]!.status;
  assert.equal(status, 'acknowledged');
  const block = (
    await db.query<{ block_id: string }>(`INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1,'Day','2026-12-12T10:00:00Z') RETURNING block_id`, [w.eventId])
  ).rows[0]!.block_id;
  await db.query(`INSERT INTO public.event_schedule_tasks (block_id, vendor_id, crew, what) VALUES ($1,$2,'Team A','Setup')`, [block, w.booking]);
  const n = (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM public.event_schedule_tasks WHERE vendor_id = $1`, [w.booking])).rows[0]!.n;
  assert.equal(n, 1);
});

test('7 · the trigger functions are doors for nobody', async () => {
  for (const fn of [
    'public.tg_booking_handovers_chat_record()',
    'public.tg_schedule_tasks_day_crew_chat_record()',
    'public.chat_record_line_exists(uuid, uuid, text)',
    'public.handover_kind_words(text)',
  ]) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok`, [role, fn]);
      assert.equal(r.rows[0]!.ok, false, `${role} may execute ${fn}`);
    }
  }
});
