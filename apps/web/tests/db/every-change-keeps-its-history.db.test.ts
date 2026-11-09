/**
 * EVERY CHANGE KEEPS ITS HISTORY · THE CHAT IS THE OVERALL RECORD
 * Supplier Build 3 · lane B · migration 20271329937802.
 *
 * ⚖ Owner 2026-11-08/09: Details shows what is agreed NOW, each row "Changed
 * N×" opening to the earlier values; and every booking ask / answer /
 * withdrawal, payment logged / confirmed / refused, refund, schedule and
 * guest-count change posts a line in that client's chat.
 *
 * Asserted BY BEHAVIOUR against the replayed schema — the real triggers, the
 * real lock and payment RPCs, the real `authenticated` role.
 *
 * Run (from apps/web): tsx --test tests/db/every-change-keeps-its-history.db.test.ts
 */
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271329937802_every_change_keeps_its_history_and_the_chat_is_the_record.sql';

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
const uniq = () => `bc-${++seq}`;

async function newUser(): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`${uniq()}@test.local`],
  );
  return r.rows[0]!.id;
}

async function newShop(owner: string): Promise<string> {
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [owner, `Shop ${uniq()}`],
  );
  return v.rows[0]!.vendor_profile_id;
}

type World = {
  eventId: string;
  host: string;
  supplier: string;
  shop: string;
  threadId: string;
  otherSupplier: string;
  otherShop: string;
  stranger: string;
};

/** An event, one host, one supplier WITH a conversation, one supplier without. */
async function newWorld(): Promise<World> {
  const host = await newUser();
  const supplier = await newUser();
  const otherSupplier = await newUser();
  const stranger = await newUser();
  const shop = await newShop(supplier);
  const otherShop = await newShop(otherSupplier);
  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision, estimated_pax)
     VALUES ('A celebration', 'birthday', DATE '2026-12-12', 'day', 100) RETURNING event_id`,
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, host],
  );
  const t = await db.query<{ thread_id: string }>(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
     VALUES ($1,$2,$3,'accepted') RETURNING thread_id`,
    [eventId, shop, host],
  );
  return { eventId, host, supplier, shop, threadId: t.rows[0]!.thread_id, otherSupplier, otherShop, stranger };
}

async function newBooking(w: World, category = 'photographer'): Promise<string> {
  const ev = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, $2::public.vendor_category, 'The Shop', 'considering', $3) RETURNING vendor_id`,
    [w.eventId, category, w.shop],
  );
  return ev.rows[0]!.vendor_id;
}

/** Run `fn` as a signed-in user under the real `authenticated` role. */
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

/** The host's ask, written the way the app's lock action writes it (signed in as the host). */
async function askAs(host: string, vendorId: string): Promise<{ error?: string }> {
  await setAuthUid(db, host);
  try {
    await db.query(
      `UPDATE public.event_vendors SET lock_request_state = 'pending', lock_requested_at = NOW() WHERE vendor_id = $1`,
      [vendorId],
    );
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  } finally {
    await setAuthUid(db, null);
  }
}

type Change = { field: string; vendor_profile_id: string | null; subject_id: string | null; from_value: string | null; to_value: string | null; changed_by: string | null };
async function changes(eventId: string): Promise<Change[]> {
  const r = await db.query<Change>(
    `SELECT field, vendor_profile_id, subject_id, from_value, to_value, changed_by
       FROM public.booking_changes WHERE event_id = $1 ORDER BY change_id`,
    [eventId],
  );
  return r.rows;
}

/** The system lines in one conversation, oldest first. */
async function lines(threadId: string): Promise<string[]> {
  const r = await db.query<{ body: string }>(
    `SELECT body FROM public.chat_messages
      WHERE thread_id = $1 AND sender_role = 'system' AND sender_user_id IS NULL
      ORDER BY created_at, message_id`,
    [threadId],
  );
  return r.rows.map((x) => x.body);
}

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(
    !replay.skipped.some((s) => s.file === MIGRATION_FILE),
    `${MIGRATION_FILE} was skipped during replay: ${JSON.stringify(replay.skipped)}`,
  );
});

// ── the change log ──────────────────────────────────────────────────────────

test('the event date: one row from → to, at its precision, and one event-wide chat line', async () => {
  const w = await newWorld();
  const r = await as(w.host, () =>
    db.query(`UPDATE public.events SET event_date = DATE '2027-01-09' WHERE event_id = $1`, [w.eventId]),
  );
  assert.equal(r.error, undefined, r.error);
  const rows = (await changes(w.eventId)).filter((c) => c.field === 'event_date');
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { from: rows[0]!.from_value, to: rows[0]!.to_value, by: rows[0]!.changed_by, shop: rows[0]!.vendor_profile_id },
    { from: '2026-12-12', to: '2027-01-09', by: w.host, shop: null },
  );
  assert.deepEqual(await lines(w.threadId), ['Event date changed · Dec 12, 2026 → Jan 9, 2027']);
});

test('a no-op update writes nothing — no row, no line', async () => {
  const w = await newWorld();
  await as(w.host, () =>
    db.query(
      `UPDATE public.events SET event_date = event_date, estimated_pax = estimated_pax, display_name = 'Renamed'
        WHERE event_id = $1`,
      [w.eventId],
    ),
  );
  assert.equal((await changes(w.eventId)).length, 0);
  assert.deepEqual(await lines(w.threadId), []);
});

test('the guest estimate: logged and said; the finalized count: logged and said', async () => {
  const w = await newWorld();
  await as(w.host, () => db.query(`UPDATE public.events SET estimated_pax = 150 WHERE event_id = $1`, [w.eventId]));
  // Finalize the way lib/pax.ts does: the service role, past guard_pax_finalize_columns.
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  await db.query(`UPDATE public.events SET final_pax = 160, guest_count_locked_at = NOW() WHERE event_id = $1`, [w.eventId]);
  await db.query(`UPDATE public.events SET final_pax = NULL, guest_count_locked_at = NULL WHERE event_id = $1`, [w.eventId]);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);

  const rows = await changes(w.eventId);
  assert.deepEqual(
    rows.map((c) => [c.field, c.from_value, c.to_value]),
    [
      ['guest_estimate', '100', '150'],
      ['guest_count_final', null, '160'],
      ['guest_count_final', '160', null],
    ],
  );
  assert.deepEqual(await lines(w.threadId), [
    'Guest count changed · 100 → 150 guests',
    'Guest list finalized · 160 guests',
    'Guest list reopened · the guest count is live again',
  ]);
});

test("a tagged block's time: one row per tagged shop; a clock change is said, a whole-day follow is not", async () => {
  const w = await newWorld();
  const booking = await newBooking(w);
  const b = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids)
     VALUES ($1, 'Prep', TIMESTAMPTZ '2026-12-12 06:00:00+00', ARRAY[$2]::uuid[]) RETURNING block_id`,
    [w.eventId, booking],
  );
  const blockId = b.rows[0]!.block_id;
  const r = await as(w.host, () =>
    db.query(`UPDATE public.event_schedule_blocks SET start_at = start_at + INTERVAL '90 minutes' WHERE block_id = $1`, [blockId]),
  );
  assert.equal(r.error, undefined, r.error);
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = start_at + INTERVAL '1 day' WHERE block_id = $1`, [blockId]);

  const rows = (await changes(w.eventId)).filter((c) => c.field === 'schedule_time');
  assert.deepEqual(
    rows.map((c) => [c.vendor_profile_id, c.subject_id, c.from_value, c.to_value]),
    [
      [w.shop, blockId, '2026-12-12T06:00:00Z', '2026-12-12T07:30:00Z'],
      [w.shop, blockId, '2026-12-12T07:30:00Z', '2026-12-13T07:30:00Z'],
    ],
  );
  // 06:00Z = 2:00 PM Manila.
  assert.deepEqual(await lines(w.threadId), ['Schedule change · Prep · 2:00 PM → 3:30 PM']);

  // An untagged block is nobody's call time: nothing.
  const u = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at)
     VALUES ($1, 'Untagged', TIMESTAMPTZ '2026-12-12 08:00:00+00') RETURNING block_id`,
    [w.eventId],
  );
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = start_at + INTERVAL '1 hour' WHERE block_id = $1`, [u.rows[0]!.block_id]);
  assert.equal((await changes(w.eventId)).filter((c) => c.subject_id === u.rows[0]!.block_id).length, 0);
});

test("a meeting's time keeps every earlier value (the card already posts — no system line)", async () => {
  const w = await newWorld();
  const a = await db.query<{ appointment_id: string }>(
    `INSERT INTO public.event_appointments (event_id, vendor_profile_id, kind, type, status, initiated_by, scheduled_at)
     VALUES ($1,$2,'video','consultation','proposed','vendor', TIMESTAMPTZ '2026-11-20 02:00:00+00') RETURNING appointment_id`,
    [w.eventId, w.shop],
  );
  const id = a.rows[0]!.appointment_id;
  await db.query(`UPDATE public.event_appointments SET scheduled_at = TIMESTAMPTZ '2026-11-21 02:00:00+00' WHERE appointment_id = $1`, [id]);
  await db.query(`UPDATE public.event_appointments SET scheduled_at = TIMESTAMPTZ '2026-11-22 03:00:00+00' WHERE appointment_id = $1`, [id]);
  const rows = (await changes(w.eventId)).filter((c) => c.field === 'meeting_time');
  assert.deepEqual(
    rows.map((c) => [c.vendor_profile_id, c.subject_id, c.from_value, c.to_value]),
    [
      [w.shop, id, '2026-11-20T02:00:00Z', '2026-11-21T02:00:00Z'],
      [w.shop, id, '2026-11-21T02:00:00Z', '2026-11-22T03:00:00Z'],
    ],
  );
  assert.deepEqual(await lines(w.threadId), []);
});

test('no client can write the log — insert, update and delete are all refused', async () => {
  const w = await newWorld();
  await as(w.host, () => db.query(`UPDATE public.events SET estimated_pax = 120 WHERE event_id = $1`, [w.eventId]));
  for (const uid of [w.host, w.supplier]) {
    const ins = await as(uid, () =>
      db.query(
        `INSERT INTO public.booking_changes (event_id, field, from_value, to_value) VALUES ($1,'event_date','a','b')`,
        [w.eventId],
      ),
    );
    assert.match(ins.error ?? '', /permission denied/i, `insert must be refused: ${ins.error}`);
    const upd = await as(uid, () => db.query(`UPDATE public.booking_changes SET to_value = 'forged' WHERE event_id = $1`, [w.eventId]));
    assert.match(upd.error ?? '', /permission denied/i, `update must be refused: ${upd.error}`);
    const del = await as(uid, () => db.query(`DELETE FROM public.booking_changes WHERE event_id = $1`, [w.eventId]));
    assert.match(del.error ?? '', /permission denied/i, `delete must be refused: ${del.error}`);
  }
  assert.equal((await changes(w.eventId)).length, 1);
});

test('who reads it: the host all, the supplier its own + event-wide, a stranger and an unrelated shop nothing', async () => {
  const w = await newWorld();
  const booking = await newBooking(w);
  await as(w.host, () => db.query(`UPDATE public.events SET estimated_pax = 130 WHERE event_id = $1`, [w.eventId]));
  const b = await db.query<{ block_id: string }>(
    `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids)
     VALUES ($1, 'Shoot', TIMESTAMPTZ '2026-12-12 06:00:00+00', ARRAY[$2]::uuid[]) RETURNING block_id`,
    [w.eventId, booking],
  );
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = start_at + INTERVAL '30 minutes' WHERE block_id = $1`, [b.rows[0]!.block_id]);
  // A row for ANOTHER shop on this event, which this supplier must not see.
  await db.query(
    `INSERT INTO public.booking_changes (event_id, vendor_profile_id, field, from_value, to_value) VALUES ($1,$2,'schedule_time','x','y')`,
    [w.eventId, w.otherShop],
  );

  const count = async (uid: string) =>
    (await as(uid, async () => (await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.booking_changes WHERE event_id = $1`, [w.eventId])).rows[0]!.n)).value;
  assert.equal(await count(w.host), 3, 'the host reads every row of their event');
  assert.equal(await count(w.supplier), 2, 'the supplier reads its own row and the event-wide one');
  assert.equal(await count(w.otherSupplier), 1, 'a shop with no conversation here reads only its own row');
  assert.equal(await count(w.stranger), 0, 'a stranger reads nothing');
});

test('a failing log write does not fail the parent write', async () => {
  const w = await newWorld();
  await db.exec(`BEGIN`);
  try {
    await db.exec(`ALTER TABLE public.booking_changes ADD CONSTRAINT bc_test_refuse_all CHECK (false) NOT VALID`);
    await db.query(`UPDATE public.events SET event_date = DATE '2027-02-02' WHERE event_id = $1`, [w.eventId]);
    const ev = await db.query<{ d: string }>(`SELECT event_date::text AS d FROM public.events WHERE event_id = $1`, [w.eventId]);
    assert.equal(ev.rows[0]!.d, '2027-02-02', 'the date still moved');
    assert.equal((await changes(w.eventId)).length, 0);
  } finally {
    await db.exec(`ROLLBACK`);
  }
});

// ── the chat's system lines ─────────────────────────────────────────────────

test('a booking ask, its answer and a withdrawn ask each post one line into the right thread', async () => {
  const w = await newWorld();
  const elsewhere = await newWorld(); // another event's thread must stay silent
  // One booking per shop per event (event_vendors_unique_marketplace_pick_per_event):
  // three shops (one per supplier account), each with its own conversation.
  const owners = [w.supplier, await newUser(), await newUser()];
  const shops = [w.shop, await newShop(owners[1]!), await newShop(owners[2]!)];
  const threads = [w.threadId];
  for (const s of shops.slice(1)) {
    threads.push((await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id, inquiry_status)
       VALUES ($1,$2,$3,'accepted') RETURNING thread_id`, [w.eventId, s, w.host])).rows[0]!.thread_id);
  }
  const bookings: string[] = [];
  for (const [i, s] of shops.entries()) {
    bookings.push((await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
       VALUES ($1, $2::public.vendor_category, 'The Shop', 'considering', $3) RETURNING vendor_id`,
      [w.eventId, ['photographer', 'videographer', 'florist'][i], s])).rows[0]!.vendor_id);
  }
  for (const id of bookings) {
    const r = await askAs(w.host, id);
    assert.equal(r.error, undefined, r.error);
  }
  const agreed = await as(owners[0]!, () => db.query(`SELECT public.vendor_agree_to_lock($1) AS r`, [bookings[0]]));
  assert.equal(agreed.error, undefined, agreed.error);
  const declined = await as(owners[1]!, () => db.query(`SELECT public.vendor_decline_lock($1, 'fully booked that day') AS r`, [bookings[1]]));
  assert.equal(declined.error, undefined, declined.error);
  const withdrawn = await as(w.host, () => db.query(`SELECT public.cancel_vendor_lock_request($1) AS r`, [bookings[2]]));
  assert.equal(withdrawn.error, undefined, withdrawn.error);

  const ASK = "Booking ask sent by the hosts · waiting for the supplier's answer";
  assert.deepEqual(await lines(threads[0]!), [ASK, 'Booked ✓']);
  assert.deepEqual(await lines(threads[1]!), [ASK, 'Not available · fully booked that day']);
  assert.deepEqual(await lines(threads[2]!), [ASK, 'Booking ask withdrawn by the hosts']);
  assert.deepEqual(await lines(elsewhere.threadId), []);

  // A system line moved none of the vendor-reply machinery.
  const t = await db.query<{ vendor_first_reply_at: string | null }>(
    `SELECT vendor_first_reply_at FROM public.chat_threads WHERE thread_id = $1`, [w.threadId]);
  assert.equal(t.rows[0]!.vendor_first_reply_at, null);
});

test('a refusal reason that the chat screen would refuse falls back to the plain line', async () => {
  const w = await newWorld();
  const id = await newBooking(w);
  await askAs(w.host, id);
  const r = await as(w.supplier, () => db.query(`SELECT public.vendor_decline_lock($1, 'call me 09171234567') AS r`, [id]));
  assert.equal(r.error, undefined, r.error);
  const said = await lines(w.threadId);
  assert.ok(said.includes('Not available'), `the plain line was posted: ${JSON.stringify(said)}`);
  assert.ok(!said.some((l) => l.includes('0917')), 'the number never reached the chat');
});

test('a payment logged and confirmed each post a line; no thread → nothing, and the write still lands', async () => {
  const w = await newWorld();
  const id = await newBooking(w);
  await db.query(`UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`, [id]);
  const logged = await as(w.host, async () =>
    (await db.query<{ payment_id: string }>(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, reference, notes)
       VALUES ($1,$2,10000,'GCash','REF-ABCD','Second installment') RETURNING payment_id`,
      [w.eventId, id],
    )).rows[0]!.payment_id,
  );
  assert.equal(logged.error, undefined, logged.error);
  const confirmed = await as(w.supplier, () => db.query(`SELECT public.confirm_vendor_payment($1)`, [logged.value]));
  assert.equal(confirmed.error, undefined, confirmed.error);

  const said = await lines(w.threadId);
  assert.ok(
    said.some((l) => /^(First payment|Payment) logged · ₱10,000 · GCash · ref REF-ABCD · waiting for the supplier to confirm$/.test(l)),
    JSON.stringify(said),
  );
  assert.ok(said.some((l) => /^(First payment|Payment) confirmed · ₱10,000$/.test(l)), JSON.stringify(said));

  // A booking whose shop has NO conversation on this event: the payment lands, nothing is posted.
  const lone = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1,'florist','Other','contracted',$2) RETURNING vendor_id`,
    [w.eventId, w.otherShop],
  );
  const before = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages`)).rows[0]!.n;
  const p = await as(w.host, () =>
    db.query(`INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method) VALUES ($1,$2,500,'Cash')`, [w.eventId, lone.rows[0]!.vendor_id]),
  );
  assert.equal(p.error, undefined, p.error);
  const afterN = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.chat_messages`)).rows[0]!.n;
  assert.equal(afterN, before);
});

// ── the three supplier locks ────────────────────────────────────────────────

/** An event far enough ahead that a Valid until "after today, on or before the event" exists. */
async function futureWorld(): Promise<World & { eventDate: string; validUntil: string; skip: number }> {
  const w = await newWorld();
  const d = await db.query<{ e: string; v: string }>(
    `UPDATE public.events SET event_date = ((NOW() AT TIME ZONE 'Asia/Manila')::date + 90), event_date_precision = 'day'
      WHERE event_id = $1
      RETURNING event_date::text AS e, ((NOW() AT TIME ZONE 'Asia/Manila')::date + 14)::text AS v`, [w.eventId]);
  // The date move above posted its own line; the lock tests read what comes after it.
  const skip = (await lines(w.threadId)).length;
  return { ...w, eventDate: d.rows[0]!.e, validUntil: d.rows[0]!.v, skip };
}
async function newQuote(w: World, status: 'draft' | 'sent', validUntil: string | null): Promise<string> {
  const p = await db.query<{ proposal_id: string }>(
    `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, total_centavos, status, valid_until, sent_at)
     VALUES ($1,$2,'Full day coverage',9900000,$3,$4::date, CASE WHEN $3 = 'draft' THEN NULL ELSE NOW() END)
     RETURNING proposal_id`,
    [w.shop, w.eventId, status, validUntil]);
  return p.rows[0]!.proposal_id;
}
const reached = (r: { value?: unknown; error?: string }) =>
  r.error === undefined && typeof r.value === 'number' && r.value > 0;
async function updateAs(uid: string, sql: string, params: unknown[]) {
  return as(uid, async () => (await db.query(sql, params)).affectedRows ?? 0);
}
async function rpcAs(uid: string, sql: string, params: unknown[]): Promise<string | undefined> {
  const r = await as(uid, async () => (await db.query<{ r: string }>(sql, params)).rows[0]!.r);
  assert.equal(r.error, undefined, r.error);
  return r.value;
}

test('the quotation and payment-plan locks: the shop flips them (draft by UPDATE, sent by the RPC); a host never can', async () => {
  const w = await futureWorld();
  const draft = await newQuote(w, 'draft', null);
  const col = async (id: string, c: string) =>
    (await db.query<{ v: boolean }>(`SELECT ${c} AS v FROM public.vendor_proposals WHERE proposal_id = $1`, [id])).rows[0]!.v;
  for (const c of ['changes_locked', 'plan_locked']) {
    assert.equal(await col(draft, c), false, `${c} defaults to false`);
    for (const uid of [w.host, w.otherSupplier, w.stranger]) {
      const r = await updateAs(uid, `UPDATE public.vendor_proposals SET ${c} = true WHERE proposal_id = $1`, [draft]);
      assert.ok(!reached(r), `${c}: ${uid} flipped a draft: ${JSON.stringify(r)}`);
    }
    const mine = await updateAs(w.supplier, `UPDATE public.vendor_proposals SET ${c} = true WHERE proposal_id = $1`, [draft]);
    assert.ok(reached(mine), `${c}: the shop could not flip its own draft: ${JSON.stringify(mine)}`);
    assert.equal(await col(draft, c), true);
  }
  assert.deepEqual((await lines(w.threadId)).slice(w.skip), [], 'a draft\'s lock says nothing in the chat');

  const sent = await newQuote(w, 'sent', w.validUntil);
  for (const [lock, c] of [['changes', 'changes_locked'], ['plan', 'plan_locked']] as const) {
    // A plain UPDATE of a sent quote stays closed to everyone, the shop included.
    for (const uid of [w.host, w.supplier]) {
      const r = await updateAs(uid, `UPDATE public.vendor_proposals SET ${c} = true WHERE proposal_id = $1`, [sent]);
      assert.ok(!reached(r), `${c}: ${uid} UPDATEd a sent quote`);
    }
    for (const uid of [w.host, w.otherSupplier, w.stranger]) {
      assert.equal(await rpcAs(uid, `SELECT public.vendor_set_proposal_lock($1,$2,true) AS r`, [sent, lock]), 'not_allowed');
    }
    assert.equal((await rpcAs(w.supplier, `SELECT public.vendor_set_proposal_lock($1,$2,true) AS r`, [sent, lock])), 'ok');
    assert.equal(await col(sent, c), true);
    assert.equal((await rpcAs(w.supplier, `SELECT public.vendor_set_proposal_lock($1,$2,false) AS r`, [sent, lock])), 'ok');
    assert.equal(await col(sent, c), false);
  }
  assert.equal(await rpcAs(w.supplier, `SELECT public.vendor_set_proposal_lock($1,'price',true) AS r`, [sent]), 'unknown_lock');
  assert.deepEqual((await lines(w.threadId)).slice(w.skip), [
    'Quotation locked · Full day coverage · the price is final',
    'Quotation unlocked · Full day coverage · changes can be asked for again',
    'Payment plan locked · Full day coverage · the plan is final',
    'Payment plan unlocked · Full day coverage · changes can be asked for again',
  ]);
  // The RPC moved nothing but the lock.
  const t = await db.query<{ total: string; status: string }>(
    `SELECT total_centavos::text AS total, status FROM public.vendor_proposals WHERE proposal_id = $1`, [sent]);
  assert.deepEqual(t.rows[0], { total: '9900000', status: 'sent' });
});

test('a sent form\'s lock (library form and the Questions set): the shop\'s team flips it, a host cannot', async () => {
  const w = await futureWorld();
  // The shipped form policies read current_vendor_ids() — the shop's team roster.
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1,$2,'admin') ON CONFLICT DO NOTHING`,
    [w.shop, w.supplier]);
  const f = await db.query<{ form_id: string }>(
    `INSERT INTO public.vendor_forms (vendor_profile_id, title) VALUES ($1,'Wedding day details') RETURNING form_id`, [w.shop]);
  await db.query(
    `INSERT INTO public.event_form_sends (event_id, form_id, vendor_profile_id, thread_id, sent_by) VALUES ($1,$2,$3,$4,'supplier')`,
    [w.eventId, f.rows[0]!.form_id, w.shop, w.threadId]);
  await db.query(
    `INSERT INTO public.event_question_requests (event_id, vendor_profile_id, thread_id) VALUES ($1,$2,$3)`,
    [w.eventId, w.shop, w.threadId]);
  for (const table of ['event_form_sends', 'event_question_requests']) {
    for (const uid of [w.host, w.otherSupplier, w.stranger]) {
      const r = await updateAs(uid, `UPDATE public.${table} SET locked = true WHERE event_id = $1`, [w.eventId]);
      assert.ok(!reached(r), `${table}: ${uid} flipped the lock: ${JSON.stringify(r)}`);
    }
    const mine = await updateAs(w.supplier, `UPDATE public.${table} SET locked = true WHERE event_id = $1`, [w.eventId]);
    assert.ok(reached(mine), `${table}: the shop could not lock its own sent form: ${JSON.stringify(mine)}`);
    const v = await db.query<{ v: boolean }>(`SELECT bool_and(locked) AS v FROM public.${table} WHERE event_id = $1`, [w.eventId]);
    assert.equal(v.rows[0]!.v, true);
  }
  assert.deepEqual((await lines(w.threadId)).slice(w.skip), [
    'Form locked · Wedding day details · no more changes',
    'Form locked · Questions for the couple · no more changes',
  ]);
});

test('Valid until: required to send, after today, on or before the event; accepted / legacy rows are not refused', async () => {
  const w = await futureWorld();
  await assert.rejects(newQuote(w, 'sent', null), /vendor_proposals_sent_has_valid_until/);
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, valid_until)
              VALUES ($1,$2,'Q','sent',(NOW() AT TIME ZONE 'Asia/Manila')::date)`, [w.shop, w.eventId]),
    /VALID_UNTIL_NOT_AFTER_TODAY/);
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, valid_until)
              VALUES ($1,$2,'Q','sent',$3::date + 1)`, [w.shop, w.eventId, w.eventDate]),
    /VALID_UNTIL_AFTER_THE_EVENT/);
  // The send the app makes: a draft flipped to sent — refused without a date, accepted with one.
  const d = await newQuote(w, 'draft', null);
  await assert.rejects(
    db.query(`UPDATE public.vendor_proposals SET status = 'sent', sent_at = NOW() WHERE proposal_id = $1`, [d]),
    /vendor_proposals_sent_has_valid_until/);
  await db.query(`UPDATE public.vendor_proposals SET status = 'sent', sent_at = NOW(), valid_until = $2::date WHERE proposal_id = $1`,
    [d, w.eventDate]);
  // An accepted quote needs none (it never expires), and the legacy flag cannot be set by a write.
  await db.query(`INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status) VALUES ($1,$2,'Q','accepted')`,
    [w.shop, w.eventId]);
  await assert.rejects(
    db.query(`INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, valid_until_legacy)
              VALUES ($1,$2,'Q','sent',true)`, [w.shop, w.eventId]),
    /vendor_proposals_sent_has_valid_until/);
  // A legacy row (marked by the backfill) still moves sent → viewed without a date.
  await db.exec(`ALTER TABLE public.vendor_proposals DISABLE TRIGGER vendor_proposals_valid_until`);
  let legacy: string;
  try {
    legacy = (await db.query<{ proposal_id: string }>(
      `INSERT INTO public.vendor_proposals (vendor_profile_id, event_id, title, status, valid_until_legacy)
       VALUES ($1,$2,'Old quote','sent',true) RETURNING proposal_id`, [w.shop, w.eventId])).rows[0]!.proposal_id;
  } finally {
    await db.exec(`ALTER TABLE public.vendor_proposals ENABLE TRIGGER vendor_proposals_valid_until`);
  }
  await db.query(`UPDATE public.vendor_proposals SET status = 'viewed', valid_until_legacy = false WHERE proposal_id = $1`, [legacy]);
  const l = await db.query<{ legacy: boolean }>(`SELECT valid_until_legacy AS legacy FROM public.vendor_proposals WHERE proposal_id = $1`, [legacy]);
  assert.equal(l.rows[0]!.legacy, true, 'the legacy flag is pinned');
});
