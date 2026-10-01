/**
 * GUARD — A CLASHING DATE GOES TO THE SUPPLIER IN CONFLICT, WHO DECIDES.
 *
 * Owner 2026-10-01 (DECISION_LOG "AMENDS THE ROW ABOVE — A CLASHING DATE GOES
 * TO THE SUPPLIER IN CONFLICT…" and "THE CLASHING-DATE FLOW — APPROVED WITH THE
 * CONTROLLER'S THREE SAFEGUARDS"); 2026-10-02 Q8 ("A FITTING DATE APPLIES WITH
 * A NOTICE"); "BUDGET IS FOR TRACKING, NEVER FOR LIMITING".
 *
 * Every test speaks as a REAL person RLS would otherwise admit (a couple member,
 * the supplier's owner, a guest) — a role with no `auth.uid()` makes an RLS
 * test pass for the wrong reason (`supplier-agrees-to-deletion.db.test.ts`).
 *
 *   1. a request reaches ONLY the conflicting suppliers — and guests see nothing
 *   2. Move by every supplier → ready; 'applied' only once the date really went
 *      live; the supplier's held day follows the date
 *   3. Unlock releases per the booking's OWN terms — never a refund amount
 *   4. withdraw: the date never moved, the supplier can no longer answer
 *   5. deadline: keep waiting / drop are refused before 3 days; drop releases
 *   6. a fitting date needs no supplier decision (Q8)
 *   7. budget never filters
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { dateMoveClearance } from '../../lib/date-change';

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
const uidOf = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function user(email: string): Promise<string> {
  seq += 1;
  const id = uidOf(7700 + seq);
  await db.query(`INSERT INTO auth.users (id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  await db.query(`INSERT INTO public.users (user_id, email) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [id, email]);
  return id;
}

async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    const who = await db.query<{ u: string; uid: string | null }>(`SELECT current_user AS u, auth.uid()::text AS uid`);
    assert.equal(who.rows[0]!.u, 'authenticated', 'the role switch did not take');
    assert.equal(who.rows[0]!.uid, uid, 'auth.uid() is not the person this step speaks as');
    return await fn();
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null).catch(() => {});
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
  }
}

type World = {
  eventId: string;
  couple: string;
  guest: string;
  supplierA: string;
  supplierB: string;
  vpA: string;
  vpB: string;
  bookingA: string;
  bookingB: string;
};

/** An event on 2030-06-01 with TWO booked marketplace suppliers, a couple and a guest. */
async function world(tag: string, statusA = 'contracted', statusB = 'contracted'): Promise<World> {
  const couple = await user(`couple-${tag}@dc.test`);
  const guest = await user(`guest-${tag}@dc.test`);
  const supplierA = await user(`a-${tag}@dc.test`);
  const supplierB = await user(`b-${tag}@dc.test`);
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (slug, event_type, display_name, event_date, event_date_precision)
     VALUES ($1, 'birthday', 'Date Change ' || $1, '2030-06-01', 'day') RETURNING event_id`,
    [`dc-${tag}`],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, couple]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'guest')`, [eventId, guest]);
  const vp = async (uid: string, name: string) =>
    (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1, $2, 'Manila', ARRAY['photography']::text[], 'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
  const vpA = await vp(supplierA, `Studio A ${tag}`);
  const vpB = await vp(supplierB, `Studio B ${tag}`);
  const book = async (vpid: string, name: string, status: string) =>
    (
      await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
         VALUES ($1, 'photographer', $2, $3::public.vendor_status, $4) RETURNING vendor_id`,
        [eventId, name, status, vpid],
      )
    ).rows[0]!.vendor_id;
  const bookingA = await book(vpA, `Studio A ${tag}`, statusA);
  const bookingB = await book(vpB, `Studio B ${tag}`, statusB);
  return { eventId, couple, guest, supplierA, supplierB, vpA, vpB, bookingA, bookingB };
}

async function ask(w: World, ids: string[], date = '2030-07-06') {
  return as(w.couple, async () => {
    const r = await db.query<{ r: Record<string, unknown> }>(
      `SELECT public.ask_event_date_change($1, $2::date, 'day', $3::uuid[]) AS r`,
      [w.eventId, date, `{${ids.join(',')}}`],
    );
    return r.rows[0]!.r;
  });
}

async function answer(uid: string, booking: string, a: 'moved' | 'unlocked') {
  return as(uid, async () => {
    const r = await db.query<{ r: Record<string, unknown> }>(`SELECT public.answer_event_date_change($1, $2) AS r`, [booking, a]);
    return r.rows[0]!.r;
  });
}

async function settle(w: World, requestId: string, action: string, booking: string | null = null) {
  return as(w.couple, async () => {
    const r = await db.query<{ r: Record<string, unknown> }>(`SELECT public.settle_event_date_change($1, $2, $3) AS r`, [
      requestId,
      action,
      booking,
    ]);
    return r.rows[0]!.r;
  });
}

test('1 · a request reaches ONLY the conflicting suppliers; guests and the other supplier see nothing', async () => {
  const w = await world('reach');
  // SABOTAGE: ask_event_date_change inserting an answer row for EVERY booked
  // supplier of the event (not just p_event_vendor_ids) → RED.
  const asked = await ask(w, [w.bookingA]);
  assert.equal(asked.ok, true, `the ask was refused: ${JSON.stringify(asked)}`);

  const rows = await db.query<{ event_vendor_id: string }>(
    `SELECT event_vendor_id FROM public.event_date_change_answers WHERE event_id = $1`,
    [w.eventId],
  );
  assert.deepEqual(rows.rows.map((r) => r.event_vendor_id), [w.bookingA], 'only the clashing supplier is asked');

  const seenByA = await as(w.supplierA, () =>
    db.query(`SELECT 1 FROM public.event_date_change_answers WHERE event_id = $1`, [w.eventId]),
  );
  assert.equal(seenByA.rows.length, 1, 'the asked supplier must see its own request');
  const reqSeenByA = await as(w.supplierA, () =>
    db.query(`SELECT proposed_date::text AS d FROM public.event_date_change_requests WHERE event_id = $1`, [w.eventId]),
  );
  assert.equal(reqSeenByA.rows.length, 1, 'the asked supplier must see the new date it is asked about');

  // SABOTAGE: the read policy using current_event_ids() (which returns GUESTS) → RED.
  for (const [who, uid] of [
    ['the other booked supplier', w.supplierB],
    ['a guest of the event', w.guest],
  ] as const) {
    const a = await as(uid, () => db.query(`SELECT 1 FROM public.event_date_change_answers WHERE event_id = $1`, [w.eventId]));
    const q = await as(uid, () => db.query(`SELECT 1 FROM public.event_date_change_requests WHERE event_id = $1`, [w.eventId]));
    assert.equal(a.rows.length + q.rows.length, 0, `${who} can read the date-change request — guests see nothing`);
  }

  // The event keeps its date while pending.
  const live = await db.query<{ d: string }>(`SELECT event_date::text AS d FROM public.events WHERE event_id = $1`, [w.eventId]);
  assert.equal(live.rows[0]!.d, '2030-06-01');

  // A forged list asks nobody extra: a considering pick, another event's booking.
  const other = await world('reach-other');
  // (as the database owner — clears the one-open slot for the next ask)
  await db.query(`UPDATE public.event_date_change_requests SET state = 'withdrawn' WHERE event_id = $1`, [w.eventId]);
  const forgedAsk = await ask(w, [w.bookingA, other.bookingA]);
  assert.equal(forgedAsk.ok, false, 'a booking of ANOTHER event was accepted into this request');
  assert.equal(forgedAsk.reason, 'not_booked');

  // Sessions cannot write the tables at all — every write is a function.
  const wrote = await as(w.couple, () =>
    db
      .query(`UPDATE public.event_date_change_answers SET answer = 'moved' WHERE event_id = $1`, [w.eventId])
      .then(() => 'wrote')
      .catch(() => 'refused'),
  );
  assert.equal(wrote, 'refused', 'a couple session could write the supplier’s answer');
});

test('2 · Move by every conflicting supplier → ready; applied only once the date is really live; the held day follows', async () => {
  const w = await world('move', 'deposit_paid', 'contracted');
  // Supplier A's held day (deposit_paid auto-blocks the event date).
  const heldBefore = await db.query<{ d: string }>(
    `SELECT (blocked_at AT TIME ZONE 'Asia/Manila')::date::text AS d FROM public.vendor_calendar_blocks
      WHERE vendor_profile_id = $1 AND block_source = 'setnayan_booking'`,
    [w.vpA],
  );
  assert.deepEqual(heldBefore.rows.map((r) => r.d), ['2030-06-01'], 'precondition: the deposit holds the old day');

  const asked = await ask(w, [w.bookingA, w.bookingB]);
  const requestId = asked.request_id as string;
  const a1 = await answer(w.supplierA, w.bookingA, 'moved');
  assert.equal(a1.ok, true);
  assert.equal(a1.ready, false, 'ready with a supplier still deciding');
  // A supplier cannot answer for the OTHER supplier's booking.
  const forged = await as(w.supplierA, () =>
    db
      .query(`SELECT public.answer_event_date_change($1, 'moved')`, [w.bookingB])
      .then(() => 'answered')
      .catch(() => 'refused'),
  );
  assert.equal(forged, 'refused', 'supplier A answered on supplier B’s behalf');

  // Not live yet → 'applied' is refused (the date did not move).
  const early = await settle(w, requestId, 'applied');
  assert.equal(early.ok, false, 'the request closed as applied before every supplier answered');

  const a2 = await answer(w.supplierB, w.bookingB, 'moved');
  assert.equal(a2.ready, true, 'every supplier moved, but the request is not ready');
  const again = await answer(w.supplierB, w.bookingB, 'moved');
  assert.equal(again.ok, false, 'a second press answered again (and would notify twice)');

  // Both moved → the Apply clearance says yes (the server's rule, fed from the DB).
  const moved = await db.query<{ event_vendor_id: string }>(
    `SELECT event_vendor_id FROM public.event_date_change_answers WHERE request_id = $1 AND answer = 'moved'`,
    [requestId],
  );
  const clearance = dateMoveClearance({
    clashing: [w.bookingA, w.bookingB],
    moved: moved.rows.map((r) => r.event_vendor_id),
  });
  assert.equal(clearance.cleared, true, 'both suppliers moved but Apply would still hold the date');

  // Still not live → 'applied' refused until Apply really writes the date.
  assert.equal((await settle(w, requestId, 'applied')).ok, false);
  await as(w.couple, () => db.query(`UPDATE public.events SET event_date = '2030-07-06' WHERE event_id = $1`, [w.eventId]));
  const applied = await settle(w, requestId, 'applied');
  assert.equal(applied.ok, true, `applied refused after the date went live: ${JSON.stringify(applied)}`);

  // SABOTAGE: drop the events_booked_dates_follow_the_event trigger → RED.
  const heldAfter = await db.query<{ d: string }>(
    `SELECT (blocked_at AT TIME ZONE 'Asia/Manila')::date::text AS d FROM public.vendor_calendar_blocks
      WHERE vendor_profile_id = $1 AND block_source = 'setnayan_booking' ORDER BY 1`,
    [w.vpA],
  );
  assert.deepEqual(
    heldAfter.rows.map((r) => r.d),
    ['2030-07-06'],
    'the supplier’s held day did not follow the date — the old day stays shut and the new one open to a second couple',
  );
});

test('3 · Unlock releases the booking under its OWN terms — an admin case carries them, no refund is computed', async () => {
  const w = await world('unlock', 'deposit_paid', 'contracted');
  await db.query(
    `INSERT INTO public.event_vendor_policy_acknowledgements (event_id, event_vendor_id, vendor_profile_id, policy_snapshot_json)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      w.eventId,
      w.bookingA,
      w.vpA,
      JSON.stringify({ cancellation_terms: 'Half of the deposit is returned if cancelled 60+ days out.', downpayment_non_refundable: false, refund_window_days: 14 }),
    ],
  );
  const asked = await ask(w, [w.bookingA, w.bookingB]);
  const requestId = asked.request_id as string;

  const ua = await answer(w.supplierA, w.bookingA, 'unlocked');
  assert.equal(ua.ok, true, `unlock refused: ${JSON.stringify(ua)}`);
  const ub = await answer(w.supplierB, w.bookingB, 'unlocked');
  assert.equal(ub.ready, true);

  const st = await db.query<{ vendor_id: string; status: string }>(
    `SELECT vendor_id, status::text AS status FROM public.event_vendors WHERE event_id = $1 ORDER BY vendor_name`,
    [w.eventId],
  );
  for (const r of st.rows) assert.equal(r.status, 'considering', 'an unlocked supplier is still booked');

  // SABOTAGE: date_change_release_booking never opening the admin case → RED.
  const flags = await db.query<{ event_vendor_id: string; flag_type: string; description: string }>(
    `SELECT event_vendor_id, flag_type, description FROM public.force_majeure_flags WHERE event_id = $1`,
    [w.eventId],
  );
  assert.equal(flags.rows.length, 1, 'exactly the booking with money logged goes to the manual path');
  const f = flags.rows[0]!;
  assert.equal(f.event_vendor_id, w.bookingA);
  assert.equal(f.flag_type, 'other', 'vendor_cancellation would count against a supplier who did what the couple asked');
  assert.match(f.description, /Half of the deposit is returned/, 'the booking’s own terms are not on the case');
  assert.match(f.description, /Refundable within 14 days/);
  assert.doesNotMatch(f.description, /₱|\bPHP\b|refund of/i, 'the case states an amount — Setnayan never invents a refund');

  const link = await db.query<{ money_flag_id: string | null }>(
    `SELECT money_flag_id FROM public.event_date_change_answers WHERE request_id = $1 AND event_vendor_id = $2`,
    [requestId, w.bookingA],
  );
  assert.ok(link.rows[0]!.money_flag_id, 'the answer does not point at the case its money went to');

  // The deposit-held day reopened (the shipped status trigger).
  const held = await db.query(
    `SELECT 1 FROM public.vendor_calendar_blocks WHERE vendor_profile_id = $1 AND block_source = 'setnayan_booking'`,
    [w.vpA],
  );
  assert.equal(held.rows.length, 0, 'the released supplier’s day is still shut');
});

test('4 · withdraw: the date never moved, the asked supplier can no longer answer, a new ask is possible', async () => {
  const w = await world('withdraw');
  const asked = await ask(w, [w.bookingA]);
  const requestId = asked.request_id as string;
  // One open request per event.
  const second = await ask(w, [w.bookingB], '2030-08-03');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'already_open');

  // A guest cannot withdraw (or do anything) — SABOTAGE: settle gate dropped → RED.
  const byGuest = await as(w.guest, () =>
    db
      .query(`SELECT public.settle_event_date_change($1, 'withdraw')`, [requestId])
      .then(() => 'done')
      .catch(() => 'refused'),
  );
  assert.equal(byGuest, 'refused', 'a guest withdrew the couple’s request');

  const wd = await settle(w, requestId, 'withdraw');
  assert.equal(wd.ok, true);
  const late = await answer(w.supplierA, w.bookingA, 'unlocked');
  assert.equal(late.ok, false, 'a supplier answered (and could unlock) a withdrawn request');
  const st = await db.query<{ status: string }>(`SELECT status::text AS status FROM public.event_vendors WHERE vendor_id = $1`, [
    w.bookingA,
  ]);
  assert.equal(st.rows[0]!.status, 'contracted', 'the withdrawn request still released the booking');
  const live = await db.query<{ d: string }>(`SELECT event_date::text AS d FROM public.events WHERE event_id = $1`, [w.eventId]);
  assert.equal(live.rows[0]!.d, '2030-06-01', 'the event did not keep its date');
  const fresh = await ask(w, [w.bookingB], '2030-08-03');
  assert.equal(fresh.ok, true, 'after a withdraw the couple cannot ask again');
});

test('5 · after 3 days the couple chooses: keep waiting · drop that supplier (the same release) · cancel', async () => {
  const w = await world('deadline', 'contracted', 'deposit_paid');
  const asked = await ask(w, [w.bookingA, w.bookingB]);
  const requestId = asked.request_id as string;

  // SABOTAGE: remove the `due_at <= now()` condition → RED.
  const tooSoon = await settle(w, requestId, 'drop', w.bookingB);
  assert.equal(tooSoon.ok, false, 'a supplier was dropped before their 3 days were up');
  assert.equal(tooSoon.reason, 'not_due');
  assert.equal((await settle(w, requestId, 'wait', w.bookingA)).reason, 'not_due');

  await db.query(`UPDATE public.event_date_change_answers SET due_at = now() - interval '1 minute' WHERE request_id = $1`, [requestId]);

  const wait = await settle(w, requestId, 'wait', w.bookingA);
  assert.equal(wait.ok, true);
  const due = await db.query<{ later: boolean }>(
    `SELECT due_at > now() + interval '2 days' AS later FROM public.event_date_change_answers WHERE event_vendor_id = $1`,
    [w.bookingA],
  );
  assert.equal(due.rows[0]!.later, true, 'keep waiting did not give them 3 more days');

  const drop = await settle(w, requestId, 'drop', w.bookingB);
  assert.equal(drop.ok, true, `drop refused: ${JSON.stringify(drop)}`);
  assert.equal(drop.ready, false, 'supplier A is still deciding');
  const st = await db.query<{ status: string }>(`SELECT status::text AS status FROM public.event_vendors WHERE vendor_id = $1`, [
    w.bookingB,
  ]);
  assert.equal(st.rows[0]!.status, 'considering', 'drop did not release the booking');
  const flag = await db.query(`SELECT 1 FROM public.force_majeure_flags WHERE event_vendor_id = $1 AND flag_type = 'other'`, [w.bookingB]);
  assert.equal(flag.rows.length, 1, 'the dropped supplier’s deposit did not go to the manual path (the same release as Unlock)');

  // The dropped supplier can no longer answer.
  assert.equal((await answer(w.supplierB, w.bookingB, 'moved')).ok, false);

  // Cancel the change = withdraw.
  assert.equal((await settle(w, requestId, 'withdraw')).ok, true);
});

test('6 · a date every booked supplier can do needs no supplier decision (Q8)', async () => {
  // SABOTAGE: dateMoveClearance requiring a 'moved' answer for every BOOKED
  // supplier (not only the clashing ones) → RED.
  const fits = dateMoveClearance({ clashing: [], moved: [] });
  assert.equal(fits.cleared, true, 'a date nobody clashes with still waits on a supplier');
  assert.deepEqual(fits.waitingOn, []);
  const clash = dateMoveClearance({ clashing: ['a', 'b'], moved: ['a'] });
  assert.equal(clash.cleared, false);
  assert.deepEqual(clash.waitingOn, ['b']);

  // And the database itself never needs a request to move a fitting date: the
  // couple's own write goes through, and the held day follows it.
  const w = await world('fits', 'deposit_paid', 'contracted');
  await as(w.couple, () => db.query(`UPDATE public.events SET event_date = '2030-09-07' WHERE event_id = $1`, [w.eventId]));
  const live = await db.query<{ d: string }>(`SELECT event_date::text AS d FROM public.events WHERE event_id = $1`, [w.eventId]);
  assert.equal(live.rows[0]!.d, '2030-09-07');
  const req = await db.query(`SELECT 1 FROM public.event_date_change_requests WHERE event_id = $1`, [w.eventId]);
  assert.equal(req.rows.length, 0);
  const held = await db.query<{ d: string }>(
    `SELECT (blocked_at AT TIME ZONE 'Asia/Manila')::date::text AS d FROM public.vendor_calendar_blocks
      WHERE vendor_profile_id = $1 AND block_source = 'setnayan_booking'`,
    [w.vpA],
  );
  assert.deepEqual(held.rows.map((r) => r.d), ['2030-09-07']);
});

test('7 · budget never filters: a booked supplier far over the plan is asked and released like any other', async () => {
  const w = await world('budget');
  // A budget far under what the suppliers cost.
  await db.query(`UPDATE public.event_vendors SET total_cost_php = 900000 WHERE event_id = $1`, [w.eventId]);
  await db
    .query(`UPDATE public.events SET budget_php = 1000 WHERE event_id = $1`, [w.eventId])
    .catch(() => undefined); // the column name may differ; the point is the functions never read it
  const asked = await ask(w, [w.bookingA, w.bookingB]);
  assert.equal(asked.ok, true);
  assert.equal(asked.suppliers, 2, 'a supplier over budget was left out of the request');
  // SABOTAGE: any of the four functions reading a budget/price column → RED.
  const src = await db.query<{ proname: string; src: string }>(
    `SELECT proname, prosrc AS src FROM pg_proc
      WHERE proname IN ('ask_event_date_change','answer_event_date_change','settle_event_date_change','date_change_release_booking')`,
  );
  assert.equal(src.rows.length, 4);
  for (const r of src.rows) {
    assert.doesNotMatch(r.src, /budget|total_cost|price|agreed_total/i, `${r.proname} reads money to decide a date`);
  }
});
