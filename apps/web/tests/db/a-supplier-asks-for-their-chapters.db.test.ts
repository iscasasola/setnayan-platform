/**
 * 📍 A BOOKED SUPPLIER PICKS THEIR CHAPTERS — asserted against the DATABASE, through real sessions (migration
 * 20271308641275; owner 2026-11-04, DECISION_LOG "CHAPTERS: THE SUPPLIER PICKS, AND THE HOST CAN ALSO PICK FOR THEM").
 *
 *   1 · only the booked shop asks (`supplier_ask_where`); it is refused what `set_supplier_where` refuses, and an ask
 *       that changes nothing; a raw INSERT of a Where request is refused outright;
 *   2 · the pick is a REQUEST: nothing moves until the host OKs it; a re-pick replaces the one waiting;
 *   3 · the host's OK (`apply_supplier_where`) puts the booking on exactly those chapters; a stranger cannot, and the
 *       supplier cannot approve their own request;
 *   4 · the host's direct `set_supplier_where` still applies at once;
 *   5 · LOCKED: the host's direct change is refused; the host ASKS (`host_ask_supplier_where`); only the supplier's
 *       Accept applies it, through the lock; a supplier's own request, OK'd by the host, passes the lock too;
 *   6 · a Where request's facts cannot be rewritten (so a host cannot rewrite one and approve it past the lock);
 *   7 · the lock's pass is the request, not the flag: the flag with a bogus id, or a write that is not what the request
 *       proposed, is still refused.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

async function asUser(uid: string): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function asOwner(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

const F = {
  eventId: '',
  couple: '',
  stranger: '',
  photoUid: '',
  photoVp: '',
  photoEv: '',
  coordUid: '',
  coordEv: '',
  prep: '',
  ceremony: '',
  reception: '',
  otherEventChapter: '',
};
const LOCKED = /Lumen Studio isn't taking changes\. Send them a request instead\./;

/** The chapters the photographer's booking is on, by name, in time order. */
async function whereOf(ev = F.photoEv): Promise<string[]> {
  await asOwner();
  const r = await db.query<{ label: string }>(
    `SELECT label FROM public.event_schedule_blocks
      WHERE event_id = $1 AND parent_block_id IS NULL AND $2 = ANY (responsible_vendor_ids) ORDER BY start_at`,
    [F.eventId, ev],
  );
  return r.rows.map((x) => x.label);
}

async function supplierAsks(blocks: string[], uid = F.photoUid, ev = F.photoEv): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ j: { suggestion_id: string } }>(`SELECT public.supplier_ask_where($1, $2::uuid[]) AS j`, [ev, blocks]);
  await asOwner();
  return r.rows[0]!.j.suggestion_id;
}

async function statusOf(id: string): Promise<string> {
  await asOwner();
  return (await db.query<{ status: string }>(`SELECT status FROM public.event_schedule_suggestions WHERE suggestion_id = $1`, [id])).rows[0]!.status;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('couple@where.test');
  F.stranger = await mkUser('stranger@where.test');
  const mkEvent = async (name: string): Promise<string> =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-11-07', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
  F.eventId = await mkEvent('Where Day');
  const other = await mkEvent('Another Day');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  const mkSupplier = async (key: string, name: string, category: string): Promise<{ uid: string; vp: string; ev: string }> => {
    const uid = await mkUser(`${key}@where.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY['photography']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, name],
      )
    ).rows[0]!.vendor_profile_id;
    const ev = (
      await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
         VALUES ($1,$2,$3,'contracted',100000,$4) RETURNING vendor_id`,
        [F.eventId, category, name, vp],
      )
    ).rows[0]!.vendor_id;
    return { uid, vp, ev };
  };
  const photo = await mkSupplier('photo', 'Lumen Studio', 'photographer');
  const coord = await mkSupplier('coord', 'Pin Coordination', 'planner_coordinator');
  Object.assign(F, { photoUid: photo.uid, photoVp: photo.vp, photoEv: photo.ev, coordUid: coord.uid, coordEv: coord.ev });
  const mkChapter = async (event: string, label: string, hour: number, tags: string[] = []): Promise<string> =>
    (
      await db.query<{ block_id: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, responsible_vendor_ids)
         VALUES ($1,$2, TIMESTAMPTZ '2099-11-07 00:00:00+00' + make_interval(hours => $3::int),
                        TIMESTAMPTZ '2099-11-07 00:00:00+00' + make_interval(hours => $3::int + 2), $4::uuid[]) RETURNING block_id`,
        [event, label, hour, tags],
      )
    ).rows[0]!.block_id;
  F.prep = await mkChapter(F.eventId, 'Preparation', 6, [F.photoEv]);
  F.ceremony = await mkChapter(F.eventId, 'Ceremony', 10);
  F.reception = await mkChapter(F.eventId, 'Reception', 17);
  F.otherEventChapter = await mkChapter(other, 'Elsewhere', 9);
});

after(async () => {
  await db?.close?.();
});

test('1 · only the booked shop asks, and it is refused what set_supplier_where refuses', async () => {
  await assert.rejects(() => supplierAsks([F.reception], F.stranger), /whereask:not_yours/, 'a stranger asked for a supplier’s chapters');
  await assert.rejects(() => supplierAsks([F.otherEventChapter]), /whereask:not_a_chapter/, 'another event’s chapter was asked for');
  await assert.rejects(() => supplierAsks([]), /whereask:keep_one/, 'a booked supplier asked for no chapter');
  await assert.rejects(() => supplierAsks([F.prep]), /whereask:unchanged/, 'an ask that changes nothing was written');
  await assert.rejects(() => supplierAsks([F.reception], F.coordUid, F.coordEv), /whereask:everywhere/, 'a coordinator asked for a Where');
  // A raw INSERT of a Where request — the doors are the only writers.
  await asUser(F.photoUid);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_schedule_suggestions (event_id, vendor_profile_id, suggested_by_user_id, kind, where_vendor_id, proposed_block_ids, note)
         VALUES ($1,$2,$3,'where',$4,$5::uuid[],'raw')`,
        [F.eventId, F.photoVp, F.photoUid, F.photoEv, [F.reception]],
      ),
    /row-level security/,
    'a raw INSERT wrote a Where request',
  );
  await asOwner();
});

test('2 · the pick waits for the host; a re-pick replaces the one waiting', async () => {
  const first = await supplierAsks([F.prep, F.ceremony]);
  assert.deepEqual(await whereOf(), ['Preparation'], 'the pick moved the schedule before the host OK’d it');
  const second = await supplierAsks([F.prep, F.reception]);
  assert.equal(await statusOf(first), 'withdrawn', 'the re-pick left two requests waiting');
  assert.equal(await statusOf(second), 'open');
});

test('3 · the host OKs it: exactly those chapters; nobody else can apply it', async () => {
  await asOwner();
  const id = (
    await db.query<{ suggestion_id: string }>(
      `SELECT suggestion_id FROM public.event_schedule_suggestions WHERE kind = 'where' AND status = 'open' AND where_vendor_id = $1`,
      [F.photoEv],
    )
  ).rows[0]!.suggestion_id;
  await asUser(F.stranger);
  await assert.rejects(() => db.query(`SELECT public.apply_supplier_where($1)`, [id]), /whereask:not_allowed/, 'a stranger applied it');
  await asUser(F.photoUid);
  await assert.rejects(() => db.query(`SELECT public.apply_supplier_where($1)`, [id]), /whereask:not_allowed/, 'the supplier approved their own request');
  await asUser(F.couple);
  await db.query(`SELECT public.apply_supplier_where($1)`, [id]);
  assert.deepEqual(await whereOf(), ['Preparation', 'Reception']);
});

test('4 · the host’s direct set_supplier_where still applies at once', async () => {
  await asUser(F.couple);
  await db.query(`SELECT public.set_supplier_where($1, $2::uuid[])`, [F.photoEv, [F.ceremony, F.reception]]);
  assert.deepEqual(await whereOf(), ['Ceremony', 'Reception']);
});

test('5 · locked: the host can only ask; the supplier’s Accept passes the lock', async () => {
  await asUser(F.photoUid);
  await db.query(`SELECT public.supplier_mark_schedule($1, 'lock')`, [F.eventId]);
  await asUser(F.couple);
  await assert.rejects(
    () => db.query(`SELECT public.set_supplier_where($1, $2::uuid[])`, [F.photoEv, [F.reception]]),
    LOCKED,
    'the host changed a locked supplier’s chapters directly',
  );
  assert.deepEqual(await whereOf(), ['Ceremony', 'Reception'], 'refused, but the chapters changed anyway');

  await asUser(F.couple);
  const ask = (
    await db.query<{ j: { suggestion_id: string } }>(`SELECT public.host_ask_supplier_where($1, $2::uuid[], NULL, 'Ana') AS j`, [
      F.photoEv,
      [F.reception],
    ])
  ).rows[0]!.j.suggestion_id;
  // The supplier hears it in the app, written by the same statement (never email).
  await asOwner();
  const told = await db.query<{ title: string; related_url: string }>(
    `SELECT title, related_url FROM public.notifications WHERE user_id = $1 AND type = 'schedule_ask'`,
    [F.photoUid],
  );
  assert.equal(told.rows.length, 1, 'the asked supplier was not told in the app');
  assert.match(told.rows[0]!.title, /Where Day asks you to change your chapters/);
  assert.match(told.rows[0]!.related_url, new RegExp(`/vendor-dashboard/clients/${F.eventId}`));
  await asUser(F.couple);
  await assert.rejects(() => db.query(`SELECT public.apply_supplier_where($1)`, [ask]), /whereask:not_allowed/, 'the host answered their own ask');
  await asUser(F.stranger);
  await assert.rejects(() => db.query(`SELECT public.host_ask_supplier_where($1, $2::uuid[])`, [F.photoEv, [F.prep]]), /whereask:not_yours/);
  await asUser(F.photoUid);
  await db.query(`SELECT public.apply_supplier_where($1)`, [ask]);
  assert.deepEqual(await whereOf(), ['Reception'], 'the supplier’s Accept did not pass the lock');

  // Their own request, OK'd by the host, passes the lock too.
  const own = await supplierAsks([F.prep, F.reception]);
  await asUser(F.couple);
  await db.query(`SELECT public.apply_supplier_where($1)`, [own]);
  assert.deepEqual(await whereOf(), ['Preparation', 'Reception']);
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status = 'accepted' WHERE suggestion_id = ANY ($1::uuid[])`, [[ask, own]]);
});

test('6 · a Where request’s facts cannot be rewritten', async () => {
  const id = await supplierAsks([F.ceremony]);
  await asUser(F.couple);
  await assert.rejects(
    () => db.query(`UPDATE public.event_schedule_suggestions SET proposed_block_ids = $2::uuid[] WHERE suggestion_id = $1`, [id, [F.prep]]),
    /whereask:fixed/,
    'the host rewrote what the supplier asked',
  );
  // Flipping the status (a Decline) still works.
  await db.query(`UPDATE public.event_schedule_suggestions SET status = 'declined', resolved_at = now() WHERE suggestion_id = $1`, [id]);
  assert.equal(await statusOf(id), 'declined');
});

test('7 · the lock’s pass is the request, not the flag', async () => {
  // Still locked (test 5). The flag with an id that is no open request → refused.
  await asOwner();
  await db.exec(`BEGIN`);
  await db.query(`SELECT set_config('app.supplier_where_apply', gen_random_uuid()::text, true)`);
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_schedule_blocks SET responsible_vendor_ids = array_remove(responsible_vendor_ids, $2) WHERE block_id = $1`, [
        F.prep,
        F.photoEv,
      ]),
    LOCKED,
    'a bogus flag passed the lock',
  );
  await db.exec(`ROLLBACK`);
  // The flag naming a real open request, but a write that is NOT what it proposed (Ceremony was not asked) → refused.
  const id = await supplierAsks([F.reception]);
  await asOwner();
  await db.exec(`BEGIN`);
  await db.query(`SELECT set_config('app.supplier_where_apply', $1, true)`, [id]);
  await assert.rejects(
    () =>
      db.query(`UPDATE public.event_schedule_blocks SET responsible_vendor_ids = array_append(responsible_vendor_ids, $2) WHERE block_id = $1`, [
        F.ceremony,
        F.photoEv,
      ]),
    LOCKED,
    'a write the request did not propose passed the lock',
  );
  await db.exec(`ROLLBACK`);
  assert.deepEqual(await whereOf(), ['Preparation', 'Reception']);
});

test('8 · the host picks for them: the waiting request is ANSWERED BY THE HOST, never declined, with one notice', async () => {
  await asUser(F.photoUid);
  await db.query(`SELECT public.supplier_mark_schedule($1, 'unlock')`, [F.eventId]);
  // A fresh request, waiting.
  const waiting = await supplierAsks([F.ceremony, F.reception]);
  await asOwner();
  const before = Number(
    (await db.query<{ n: string }>(`SELECT count(*) AS n FROM public.notifications WHERE user_id = $1 AND type = 'supplier_where_changed'`, [F.photoUid]))
      .rows[0]!.n,
  );
  await asUser(F.couple);
  const r = await db.query<{ j: { answered_request: boolean } }>(`SELECT public.set_supplier_where($1, $2::uuid[]) AS j`, [F.photoEv, [F.ceremony]]);
  assert.equal(r.rows[0]!.j.answered_request, true);
  assert.equal(await statusOf(waiting), 'answered_by_host', 'the host’s own pick left the supplier’s request waiting, or called it a refusal');
  assert.deepEqual(await whereOf(), ['Ceremony']);
  await asOwner();
  const notices = await db.query<{ title: string; body: string }>(
    `SELECT title, body FROM public.notifications WHERE user_id = $1 AND type = 'supplier_where_changed' ORDER BY created_at DESC`,
    [F.photoUid],
  );
  assert.equal(notices.rows.length, before + 1, 'the supplier got no notice, or two');
  assert.match(notices.rows[0]!.title, /Where Day picked your chapters for you/);
  assert.match(notices.rows[0]!.body, /answered by the host: you are on Ceremony/);
});

test('9 · the host’s optional note reaches the supplier with their ask', async () => {
  await asUser(F.couple);
  await db.query(`SELECT public.host_ask_supplier_where($1, $2::uuid[], 'The church moved the blessing', 'Ana')`, [F.photoEv, [F.prep]]);
  await asOwner();
  const told = await db.query<{ body: string }>(
    `SELECT body FROM public.notifications WHERE user_id = $1 AND type = 'schedule_ask' ORDER BY created_at DESC LIMIT 1`,
    [F.photoUid],
  );
  assert.match(told.rows[0]!.body, /They ask you to work Preparation\. “The church moved the blessing”/);
  const note = await db.query<{ note: string }>(
    `SELECT note FROM public.event_schedule_suggestions WHERE kind = 'where' AND direction = 'to_supplier' AND status = 'open' AND where_vendor_id = $1`,
    [F.photoEv],
  );
  assert.equal(note.rows[0]!.note, 'The church moved the blessing');
});
