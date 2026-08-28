/**
 * PR-H · THE VENDOR AGREES — end-to-end (test:db, migrations replayed).
 *
 * The data layer (20271107090000) shipped to production with ZERO callers. This
 * suite locks what 20271143289546 wires on top of it, and every test here is one
 * that can actually fail — each names the mutation that must turn it red.
 *
 * THE HEADLINE: agreeing is what makes the booking. state='agreed' and
 * status='contracted' are written by ONE statement, so they can never disagree.
 * Test 2 is the only proof of that and reddens against the shipped body.
 *
 * ⚠ auth.role() CAN NEVER BE NULL IN THIS REPLAY — the shim returns 'anon' where
 * prod returns NULL — so no test here may branch on it. Ownership is exercised
 * through setAuthUid + the SECDEF gates instead.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

type Row = Record<string, unknown>;

async function newUser(email: string, type = 'customer'): Promise<string> {
  const u = await db.query<{ id: string }>(
    // $2::text — jsonb_build_object cannot infer an untyped parameter (42P18).
    // The shipped db tests pass a literal here, so this trap is fresh.
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type',$2::text)) RETURNING id`,
    [email, type],
  );
  return u.rows[0]!.id;
}

async function newVendor(email: string, name = 'Agree Co'): Promise<{ vpid: string; uid: string }> {
  const uid = await newUser(email);
  const v = await db.query<{ vendor_profile_id: string }>(
    `INSERT INTO public.vendor_profiles
       (user_id, business_name, location_city, services, verification_state, last_verified_at)
     VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW())
     RETURNING vendor_profile_id`,
    [uid, name],
  );
  return { vpid: v.rows[0]!.vendor_profile_id, uid };
}

/** An event with a couple member, optionally date-pinned. */
async function newEvent(label: string, date: string | null = null): Promise<{ eventId: string; coupleUid: string }> {
  const coupleUid = await newUser(`couple-${label}@prh.test`);
  const e = await db.query<{ event_id: string }>(
    // 'birthday', not 'wedding': events_wedding_fields_consistency requires a
    // wedding to carry ceremony_type AND venue_setting, and none of this suite
    // is about those. The shipped db tests seed the same way.
    // event_date_precision is NOT NULL (default 'year') — passing NULL for the
    // undated case violates it, so the CASE returns 'year', never NULL.
    // Both references to $2 carry the cast: an untyped parameter inside a CASE
    // leaves Postgres unable to infer the type at parse time (42P18).
    `INSERT INTO public.events (display_name, event_type, event_date, event_date_precision)
     VALUES ($1, 'birthday', $2::date,
             CASE WHEN $2::date IS NULL THEN 'year' ELSE 'day' END)
     RETURNING event_id`,
    [`Event ${label}`, date],
  );
  const eventId = e.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );
  return { eventId, coupleUid };
}

/** A booking row. Seeded as the migration owner so triggers, not RLS, are under test. */
async function newBooking(
  eventId: string,
  vpid: string | null,
  opts: { status?: string; category?: string; pending?: boolean; requestedDaysAgo?: number } = {},
): Promise<string> {
  const r = await db.query<{ vendor_id: string }>(
    `INSERT INTO public.event_vendors
       (event_id, category, vendor_name, status, marketplace_vendor_id,
        lock_request_state, lock_requested_at)
     VALUES ($1, $2::public.vendor_category, 'Agree Co', $3::public.vendor_status, $4,
             $5, $6)
     RETURNING vendor_id`,
    [
      eventId,
      opts.category ?? 'photographer',
      opts.status ?? 'considering',
      vpid,
      opts.pending ? 'pending' : null,
      opts.pending
        ? new Date(Date.now() - (opts.requestedDaysAgo ?? 0) * 86400_000).toISOString()
        : null,
    ],
  );
  return r.rows[0]!.vendor_id;
}

/**
 * Become a real `authenticated` session for this user.
 *
 * 🔑 setAuthUid ALONE IS NOT ENOUGH and this cost three red tests. It sets the
 * JWT claim, but the replay runs as the migration owner, so `current_user` stays
 * `postgres` — and every guard in this family gates on
 * `current_user IN ('authenticated','anon')`. Without the SET ROLE the couple's
 * forged UPDATE simply succeeds and the denial test is vacuous. The replay DB is
 * more permissive than prod; that gap has to be closed by hand.
 *
 * The current_user assertion is the point: a SET ROLE that silently did not take
 * would make every refusal below pass for the wrong reason.
 */
async function asAuthenticated(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await db.exec('SET ROLE authenticated');
  const who = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(who.rows[0]!.cu, 'authenticated', 'SET ROLE did not take — the test below would be vacuous');
}

async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
}

async function read(vendorId: string): Promise<Row> {
  const r = await db.query<Row>(
    `SELECT status::text AS status, lock_request_state, lock_agreed_at, lock_declined_at,
            lock_request_cancelled_at, lock_request_expires_at, lock_request_nudged_at,
            lock_answered_by_user_id
       FROM public.event_vendors WHERE vendor_id = $1`,
    [vendorId],
  );
  return r.rows[0]!;
}

async function agree(vendorId: string): Promise<Row> {
  const r = await db.query<{ vendor_agree_to_lock: Row }>(
    `SELECT public.vendor_agree_to_lock($1) AS vendor_agree_to_lock`,
    [vendorId],
  );
  return r.rows[0]!.vendor_agree_to_lock;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

/**
 * ⚠ RESET THE ROLE BEFORE EVERY TEST, NOT JUST AFTER THE ONES THAT SWITCH IT.
 * A leaked `SET ROLE authenticated` does not fail loudly — it makes the NEXT
 * test's seeding die with "permission denied for table users", which reads like
 * a broken fixture rather than contamination from three tests ago. Same shape as
 * the transaction-scoped SET that once contaminated a whole file.
 */
beforeEach(async () => {
  await asOwner();
});

after(async () => {
  await setAuthUid(db, null);
  await db?.close();
});

// ── 1 · the ask does not book ───────────────────────────────────────────────
test('a request leaves the status ladder alone and materializes a 7-day deadline', async () => {
  const { eventId } = await newEvent('ask');
  const { vpid } = await newVendor('ask@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  const row = await read(b);
  assert.equal(row.status, 'considering', 'asking must not book — assert by VALUE, not by absence');
  assert.equal(row.lock_request_state, 'pending');
  assert.ok(row.lock_request_expires_at, 'the deadline must be materialized by the trigger');
  // MUTATION: delete the materialization arm in the trigger ⇒ this reddens.
  const days =
    (new Date(String(row.lock_request_expires_at)).getTime() - Date.now()) / 86400_000;
  assert.ok(days > 6.9 && days < 7.1, `deadline must be ~7 days out, got ${days}`);
});

// ── 2 · THE ARCHITECTURE TEST ───────────────────────────────────────────────
test('agreeing writes state AND status in one statement — the booking is made by the yes', async () => {
  const { eventId } = await newEvent('flip');
  const { vpid, uid } = await newVendor('flip@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  await setAuthUid(db, uid);
  const env = await agree(b);
  await setAuthUid(db, null);

  assert.equal(env.status, 'ok');
  assert.equal(env.event_id, eventId, 'the envelope must carry the AUTHORIZED event id');

  const row = await read(b);
  assert.equal(row.lock_request_state, 'agreed');
  // MUTATION: revert to the shipped body (no status write) ⇒ this line reddens.
  assert.equal(row.status, 'contracted', 'the vendor saying yes is what books them');
  assert.equal(row.lock_answered_by_user_id, uid, 'the answer records WHO answered');
});

test('agreeing twice is idempotent and never moves the timestamp', async () => {
  const { eventId } = await newEvent('idem');
  const { vpid, uid } = await newVendor('idem@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  await setAuthUid(db, uid);
  await agree(b);
  const first = await read(b);
  const second = await agree(b);
  await setAuthUid(db, null);

  assert.equal(second.status, 'already');
  const after = await read(b);
  assert.equal(
    String(after.lock_agreed_at),
    String(first.lock_agreed_at),
    'byte-identical, not merely "it did not throw"',
  );
  assert.equal(after.status, 'contracted');
});

// ── 3 · the flip is MONOTONE ────────────────────────────────────────────────
test('agreeing NEVER demotes a booking that is already further up the ladder', async () => {
  // Reachable in prod: vendor_claim_locked_qr promotes a row to deposit_paid
  // without touching any lock_* column, so a stale 'pending' marker survives.
  const { eventId } = await newEvent('monotone');
  const { vpid, uid } = await newVendor('monotone@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });
  await db.query(
    `UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = $1`,
    [b],
  );

  await setAuthUid(db, uid);
  const env = await agree(b);
  await setAuthUid(db, null);

  assert.equal(env.status, 'ok');
  const row = await read(b);
  assert.equal(row.lock_request_state, 'agreed');
  // MUTATION: drop the CASE from the flip ⇒ status becomes 'contracted' ⇒ red.
  assert.equal(row.status, 'deposit_paid', 'a paid booking must never roll backwards');
});

// ── 4 · owner decision 3 — decline the others first ─────────────────────────
test('a vendor cannot take one couple while another is still waiting on the same date', async () => {
  const date = '2027-09-09';
  const a = await newEvent('rival-a', date);
  const c = await newEvent('rival-b', date);
  const { vpid, uid } = await newVendor('rivals@prh.test');
  const b1 = await newBooking(a.eventId, vpid, { pending: true });
  const b2 = await newBooking(c.eventId, vpid, { pending: true });

  await setAuthUid(db, uid);
  const blocked = await agree(b1);
  assert.equal(
    blocked.status,
    'resolve_others_first',
    'no customer may lose a lock silently (2026-06-02 §T1.4)',
  );
  assert.equal(Number(blocked.competing), 1);
  assert.equal((await read(b1)).status, 'considering', 'and nothing was booked');

  // Declining the rival is what clears it — an explicit, acknowledged no.
  await db.query(`SELECT public.vendor_decline_lock($1, 'fully booked')`, [b2]);
  const ok = await agree(b1);
  await setAuthUid(db, null);

  assert.equal(ok.status, 'ok', 'after the other couple is told no, the yes goes through');
  assert.equal((await read(b1)).status, 'contracted');
  // MUTATION: delete the competing-request block ⇒ the first agree returns ok ⇒ red.
});

test('two couples on DIFFERENT dates never compete', async () => {
  const a = await newEvent('nodate-a', '2027-10-01');
  const c = await newEvent('nodate-b', '2027-11-01');
  const { vpid, uid } = await newVendor('twodates@prh.test');
  const b1 = await newBooking(a.eventId, vpid, { pending: true });
  await newBooking(c.eventId, vpid, { pending: true });

  await setAuthUid(db, uid);
  const env = await agree(b1);
  await setAuthUid(db, null);
  assert.equal(env.status, 'ok', 'the rule is per-date — a different date is not competition');
});

// ── 5 · the couple's own category ───────────────────────────────────────────
test('a confirmed rival in the same hard-single category closes the request, stamping who answered', async () => {
  const { eventId } = await newEvent('group');
  const winner = await newVendor('winner@prh.test');
  const loser = await newVendor('loser@prh.test');
  await newBooking(eventId, winner.vpid, { status: 'contracted', category: 'venue' });
  const b = await newBooking(eventId, loser.vpid, { pending: true, category: 'venue' });

  await setAuthUid(db, loser.uid);
  const env = await agree(b);
  await setAuthUid(db, null);

  assert.equal(env.status, 'group_taken');
  const row = await read(b);
  assert.equal(row.lock_request_state, 'cancelled');
  assert.equal(row.status, 'considering', 'a lost race must not book anybody');
  // MUTATION: drop the actor stamp ⇒ red. The record must not lose the fact
  // that the vendor was here and answered.
  assert.equal(row.lock_answered_by_user_id, loser.uid);
});

// ── 6 · one pending request per category ────────────────────────────────────
test('a couple cannot have two live requests in one hard-single category', async () => {
  const { eventId } = await newEvent('twovenues');
  const v1 = await newVendor('venue1@prh.test');
  const v2 = await newVendor('venue2@prh.test');
  await newBooking(eventId, v1.vpid, { pending: true, category: 'venue' });

  let err: string | null = null;
  try {
    await newBooking(eventId, v2.vpid, { pending: true, category: 'venue' });
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  // MUTATION: drop the per-group index ⇒ the second insert succeeds ⇒ red.
  assert.ok(err, 'the second venue request must be refused by the database');
  assert.match(String(err), /one_pending_lock_request_per_group/);
});

test('a MULTI-pick category is untouched by that index', async () => {
  const { eventId } = await newEvent('multi');
  const v1 = await newVendor('band1@prh.test');
  const v2 = await newVendor('band2@prh.test');
  await newBooking(eventId, v1.vpid, { pending: true, category: 'band_dj' });
  await newBooking(eventId, v2.vpid, { pending: true, category: 'band_dj' });
  const n = await db.query<{ c: string }>(
    `SELECT count(*) AS c FROM public.event_vendors
      WHERE event_id = $1 AND lock_request_state = 'pending'`,
    [eventId],
  );
  // MUTATION: drop the hard_single_group IS NOT NULL term ⇒ this reddens.
  assert.equal(Number(n.rows[0]!.c), 2, 'two bands may both be asked');
});

// ── 7 · the nudge fires once PER ROUND, not once per row ────────────────────
test('the day-5 nudge fires once — and a RE-ASK is nudgeable again', async () => {
  const { eventId } = await newEvent('nudge');
  const { vpid, uid: vendorUid } = await newVendor('nudge@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true, requestedDaysAgo: 6 });
  // The trigger stamps expires_at from lock_requested_at, so a 6-day-old ask
  // still has a live deadline.

  const first = await db.query<Row>(`SELECT * FROM public.nudge_stale_lock_requests(5, 200)`);
  assert.equal(first.rows.length, 1, 'a 6-day-old request is due a nudge');
  const stamp = (await read(b)).lock_request_nudged_at;
  assert.ok(stamp);

  const second = await db.query<Row>(`SELECT * FROM public.nudge_stale_lock_requests(5, 200)`);
  assert.equal(second.rows.length, 0, 'it must not re-nudge daily from day 5 to day 7');
  assert.equal(String((await read(b)).lock_request_nudged_at), String(stamp));

  // THE RE-ASK. Decline, then ask again — the stamp must clear or every later
  // round on this booking is permanently un-nudgeable.
  // The decline runs AS THE VENDOR: the RPC's ownership gate is real, and the
  // migration owner is neither the vendor nor an admin.
  await asAuthenticated(vendorUid);
  await db.query(`SELECT public.vendor_decline_lock($1, 'busy')`, [b]);
  await asOwner();
  await db.query(
    `UPDATE public.event_vendors
        SET lock_request_state = 'pending',
            lock_requested_at = NOW() - INTERVAL '6 days'
      WHERE vendor_id = $1`,
    [b],
  );
  assert.equal(
    (await read(b)).lock_request_nudged_at,
    null,
    'MUTATION: remove the reset beside the deadline ⇒ this reddens',
  );
  const third = await db.query<Row>(`SELECT * FROM public.nudge_stale_lock_requests(5, 200)`);
  assert.equal(third.rows.length, 1, 'the second round is nudgeable too');
});

// ── 8 · expiry actually fires, and only on the right rows ───────────────────
test('the sweep expires a lapsed request and leaves a live one alone', async () => {
  const stale = await newEvent('stale');
  const fresh = await newEvent('fresh');
  const { vpid } = await newVendor('sweep@prh.test');
  const b1 = await newBooking(stale.eventId, vpid, { pending: true });
  const b2 = await newBooking(fresh.eventId, vpid, { pending: true });
  await db.query(
    `UPDATE public.event_vendors SET lock_request_expires_at = NOW() - INTERVAL '1 day'
      WHERE vendor_id = $1`,
    [b1],
  );

  const out = await db.query<Row>(`SELECT * FROM public.expire_stale_lock_requests(200)`);
  assert.equal(out.rows.length, 1);
  assert.equal((await read(b1)).lock_request_state, 'expired');
  assert.equal((await read(b2)).lock_request_state, 'pending', 'a live request is untouched');
});

test('neither sweep ever touches a booking that is already confirmed', async () => {
  // The Locked-QR shape: vendor_claim_locked_qr promotes a row to deposit_paid
  // without touching any lock_* column, so a stale 'pending' marker survives.
  //
  // 🔑 TWO ROWS, NOT ONE, AND THAT IS THE WHOLE POINT. A single row with an
  // EXPIRED window is excluded from the nudge by the window clause, not by the
  // status floor — so the first version of this test passed with the floor
  // deleted. Each row below leaves exactly ONE mechanism able to exclude it.
  // Two EVENTS, not two rows on one: event_vendors_unique_marketplace_pick_per_event
  // permits a marketplace vendor only one pick per event.
  const liveEvt = await newEvent('qr-live');
  const deadEvt = await newEvent('qr-dead');
  const { vpid } = await newVendor('qr@prh.test');

  // (a) window still LIVE (requested 6d ago ⇒ expires in ~1d) ⇒ only the status
  //     floor can keep the nudge off it.
  const paidLiveWindow = await newBooking(liveEvt.eventId, vpid, {
    pending: true,
    requestedDaysAgo: 6,
  });
  // (b) window LAPSED ⇒ only the status floor can keep the expiry off it.
  const paidDeadWindow = await newBooking(deadEvt.eventId, vpid, {
    pending: true,
    requestedDaysAgo: 30,
  });
  await db.query(
    `UPDATE public.event_vendors SET status = 'deposit_paid' WHERE vendor_id = ANY($1::uuid[])`,
    [[paidLiveWindow, paidDeadWindow]],
  );
  await db.query(
    `UPDATE public.event_vendors SET lock_request_expires_at = NOW() - INTERVAL '10 days'
      WHERE vendor_id = $1`,
    [paidDeadWindow],
  );

  const nudged = await db.query<Row>(`SELECT * FROM public.nudge_stale_lock_requests(5, 200)`);
  const expired = await db.query<Row>(`SELECT * FROM public.expire_stale_lock_requests(200)`);

  // MUTATION: drop the status floor from nudge_stale_lock_requests ⇒ the
  // live-window row is nudged ⇒ red. (Verified: without this second row the
  // mutation left the whole suite green.)
  assert.equal(nudged.rows.length, 0, 'never nag a vendor about a booking already paid for');
  // MUTATION: drop the status floor from expire_stale_lock_requests ⇒ red.
  assert.equal(expired.rows.length, 0, 'and never expire it');

  assert.equal((await read(paidLiveWindow)).status, 'deposit_paid');
  assert.equal((await read(paidLiveWindow)).lock_request_nudged_at, null);
  assert.equal((await read(paidDeadWindow)).lock_request_state, 'pending');
});

// ── 9 · the request has an inverse, and the round trip works ────────────────
test('the couple can withdraw, and a withdrawn request can be re-asked and agreed', async () => {
  const { eventId, coupleUid } = await newEvent('undo');
  const { vpid, uid } = await newVendor('undo@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  await asAuthenticated(coupleUid);
  const env = await db.query<{ cancel_vendor_lock_request: Row }>(
    `SELECT public.cancel_vendor_lock_request($1) AS cancel_vendor_lock_request`,
    [b],
  );
  await asOwner();
  assert.equal(env.rows[0]!.cancel_vendor_lock_request.status, 'ok');
  assert.equal((await read(b)).lock_request_state, 'cancelled');

  // Ask again — a fresh deadline, then a yes.
  await db.query(
    `UPDATE public.event_vendors
        SET lock_request_state = 'pending', lock_requested_at = NOW()
      WHERE vendor_id = $1`,
    [b],
  );
  await setAuthUid(db, uid);
  const ok = await agree(b);
  await setAuthUid(db, null);
  assert.equal(ok.status, 'ok', 'a withdrawn request must not strand the booking forever');
  assert.equal((await read(b)).status, 'contracted');
});

// ── 10 · the couple cannot answer for the vendor ────────────────────────────
test('the couple cannot forge the vendor answer — and the value is still safe afterwards', async () => {
  const { eventId, coupleUid } = await newEvent('forge');
  const { vpid } = await newVendor('forge@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  await asAuthenticated(coupleUid);
  for (const sql of [
    `UPDATE public.event_vendors SET lock_agreed_at = NOW() WHERE vendor_id = $1`,
    `UPDATE public.event_vendors SET lock_request_state = 'agreed' WHERE vendor_id = $1`,
    `UPDATE public.event_vendors SET lock_request_nudged_at = NOW() WHERE vendor_id = $1`,
  ]) {
    let threw = false;
    try {
      await db.query(sql, [b]);
    } catch {
      threw = true;
    }
    assert.ok(threw, `must be refused: ${sql}`);
  }
  await asOwner();

  // POST-CONDITION, not merely "it threw" — a rejected query is not a thrown error.
  const row = await read(b);
  assert.equal(row.lock_agreed_at, null);
  assert.equal(row.lock_request_state, 'pending');
  assert.equal(row.lock_request_nudged_at, null);
});

test('an insert naming no lock column reads back the SAFE values', async () => {
  // Read the default before trusting a refusal: a column whose default is the
  // privileged value makes "the forgery is refused" prove nothing.
  const { eventId } = await newEvent('defaults');
  const b = await newBooking(eventId, null);
  const row = await read(b);
  assert.equal(row.lock_request_state, null, 'a fresh booking has asked nobody');
  assert.equal(row.lock_agreed_at, null);
  assert.equal(row.lock_request_expires_at, null);
  assert.equal(row.status, 'considering');
});

// ── 11 · ownership ──────────────────────────────────────────────────────────
test('a vendor cannot agree to somebody else’s booking', async () => {
  const { eventId } = await newEvent('other');
  const mine = await newVendor('mine@prh.test');
  const theirs = await newVendor('theirs@prh.test');
  const b = await newBooking(eventId, mine.vpid, { pending: true });

  await setAuthUid(db, theirs.uid);
  let threw = false;
  try {
    await agree(b);
  } catch (e) {
    threw = /not_your_booking/.test(e instanceof Error ? e.message : String(e));
  }
  await setAuthUid(db, null);
  assert.ok(threw, 'authorization RAISES — it is the one thing that is never a returned status');
  assert.equal((await read(b)).status, 'considering');
});

test('a vendor cannot reach a booking by owning the service it points at', async () => {
  // event_vendors.service_id is COUPLE-WRITABLE and the shipped gate accepted it
  // via agent_assigned_service_ids(). Harmless while this RPC wrote an inert
  // marker; not harmless now that it is the only thing that creates a booking.
  const { eventId } = await newEvent('deputy');
  const asked = await newVendor('asked@prh.test');
  const outsider = await newVendor('outsider@prh.test');

  const svc = await db.query<{ vendor_service_id: string }>(
    `INSERT INTO public.vendor_services (vendor_profile_id, category, starting_price_php, exclusive_perk_text)
     VALUES ($1, 'photography', 40000, 'Free extra hour') RETURNING vendor_service_id`,
    [outsider.vpid],
  );
  const tm = await db.query<{ vendor_team_member_id: string }>(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role)
     VALUES ($1, $2, 'agent') RETURNING vendor_team_member_id`,
    [outsider.vpid, outsider.uid],
  );
  await db.query(
    `INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id)
     VALUES ($1, $2)`,
    [svc.rows[0]!.vendor_service_id, tm.rows[0]!.vendor_team_member_id],
  );

  const b = await newBooking(eventId, asked.vpid, { pending: true });
  await db.query(`UPDATE public.event_vendors SET service_id = $2 WHERE vendor_id = $1`, [
    b,
    svc.rows[0]!.vendor_service_id,
  ]);

  await setAuthUid(db, outsider.uid);
  let threw = false;
  try {
    await agree(b);
  } catch (e) {
    threw = /not_your_booking/.test(e instanceof Error ? e.message : String(e));
  }
  await setAuthUid(db, null);
  // MUTATION: restore the bare agent arm (drop the vendor_profile_id tie) ⇒ red.
  assert.ok(threw, 'the agent arm must be anchored to the org that was ASKED');
  assert.equal((await read(b)).status, 'considering');
});

// ── 12 · the coherence rule, and the bypass it does NOT close ───────────────
test('a couple cannot self-book while their own request is live', async () => {
  const { eventId, coupleUid } = await newEvent('coherence');
  const { vpid } = await newVendor('coherence@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  await asAuthenticated(coupleUid);
  let threw = false;
  try {
    await db.query(
      `UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`,
      [b],
    );
  } catch {
    threw = true;
  }
  await asOwner();
  assert.ok(threw, 'the vendor answer books it, or the couple withdraws first');
  assert.equal((await read(b)).status, 'considering');
});

test('KNOWN RESIDUAL — cancel-then-book still succeeds, and that is asserted, not hidden', async () => {
  // The shipped trigger deliberately lets a couple write 'cancelled' ("a couple
  // may open (pending) or withdraw (cancelled) their own request"), so the
  // coherence rule above is NOT a forgery guard and must never be described as
  // one. Forgery on status stays OPEN while the flag-OFF path needs the couple
  // to write 'contracted' directly; it closes when that path is retired.
  // This test exists so the day somebody closes it, the failure is a REMINDER to
  // delete this test — not a surprise.
  const { eventId, coupleUid } = await newEvent('residual');
  const { vpid } = await newVendor('residual@prh.test');
  const b = await newBooking(eventId, vpid, { pending: true });

  await asAuthenticated(coupleUid);
  await db.query(
    `UPDATE public.event_vendors SET lock_request_state = 'cancelled',
            lock_request_cancelled_at = NOW() WHERE vendor_id = $1`,
    [b],
  );
  await db.query(
    `UPDATE public.event_vendors SET status = 'contracted' WHERE vendor_id = $1`,
    [b],
  );
  await asOwner();
  assert.equal(
    (await read(b)).status,
    'contracted',
    'if this now FAILS, forgery was closed — delete this test and say so in the PR',
  );
});

// ── 13 · the sweeps are not reachable from a browser ────────────────────────
test('the sweep RPCs are service-role only', async () => {
  for (const fn of ['nudge_stale_lock_requests', 'expire_stale_lock_requests']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ok
         FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = $1`,
      [fn],
    );
    assert.equal(r.rows[0]!.ok, false, `${fn} must not be callable by authenticated`);
  }
});
