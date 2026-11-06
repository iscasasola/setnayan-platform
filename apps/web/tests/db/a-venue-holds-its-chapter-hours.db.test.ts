/**
 * 🏛 VENUE HOURS — asserted against the DATABASE, through real sessions (migration 20271307658341; owner 2026-11-04,
 * prototype "Event chapters — 4 Nov 2026", frames 2, 7b).
 *
 *   1 · Only a VENUE booked to a top-level chapter may file `hours` for it — a caterer may not, nor on a moment;
 *   2 · the host's approval (`apply_venue_hours`) writes start, end, setup and pack-up and the chapter is HELD;
 *   3 · while held, the host's own change to those hours is refused with "<venue> holds this chapter's hours. Ask them
 *       to change." and the row is unchanged; a change to anything else (its name, guests) still passes;
 *   4 · the host's ask, ACCEPTED by the venue, passes through the same door;
 *   5 · the event's date moving and Running late still move a held chapter;
 *   6 · taking the venue off the chapter lifts the hold — the host sets the hours again;
 *   7 · nobody but `apply_venue_hours` can put a venue on a chapter's hours; a stranger cannot call it.
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

const F = { eventId: '', couple: '', stranger: '', venueUid: '', venueVp: '', venueEv: '', catUid: '', catVp: '', catEv: '', chapter: '', moment: '' };
const HELD = /Blue Leaf holds this chapter's hours\. Ask them to change\./;

async function hours(): Promise<{ s: string; e: string | null; i: number | null; g: number | null; held: string | null }> {
  await asOwner();
  const r = await db.query<{ s: string; e: string | null; i: number | null; g: number | null; held: string | null }>(
    `SELECT to_char(start_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS s, to_char(end_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI') AS e,
            ingress_minutes_before AS i, egress_minutes_after AS g, hours_vendor_id::text AS held
       FROM public.event_schedule_blocks WHERE block_id = $1`,
    [F.chapter],
  );
  return r.rows[0]!;
}

async function fileHours(uid: string, vp: string, block: string, start: string, end: string, ingress: number, egress: number): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, proposed_start_at, proposed_end_at,
        proposed_ingress_minutes, proposed_egress_minutes, note)
     VALUES ($1,$2,$3,$4,'Blue Leaf','hours',$5,$6,$7,$8,'Our hours') RETURNING suggestion_id`,
    [F.eventId, block, vp, uid, start, end, ingress, egress],
  );
  await asOwner();
  return r.rows[0]!.suggestion_id;
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
  F.couple = await mkUser('couple@hours.test');
  F.stranger = await mkUser('stranger@hours.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Hours Day','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  const mkSupplier = async (key: string, name: string, category: string): Promise<{ uid: string; vp: string; ev: string }> => {
    const uid = await mkUser(`${key}@hours.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY['catering']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
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
  const venue = await mkSupplier('venue', 'Blue Leaf', 'venue');
  const cat = await mkSupplier('cater', 'Bituin Catering', 'catering');
  Object.assign(F, { venueUid: venue.uid, venueVp: venue.vp, venueEv: venue.ev, catUid: cat.uid, catVp: cat.vp, catEv: cat.ev });
  F.chapter = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, responsible_vendor_ids)
       VALUES ($1,'Cocktail + Reception', TIMESTAMPTZ '2099-12-18 17:00:00+00', TIMESTAMPTZ '2099-12-18 22:00:00+00', $2::uuid[]) RETURNING block_id`,
      [F.eventId, [F.venueEv, F.catEv]],
    )
  ).rows[0]!.block_id;
  F.moment = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, parent_block_id, label, start_at, responsible_vendor_ids)
       VALUES ($1,$2,'Dinner', TIMESTAMPTZ '2099-12-18 18:00:00+00', $3::uuid[]) RETURNING block_id`,
      [F.eventId, F.chapter, [F.venueEv]],
    )
  ).rows[0]!.block_id;
});

after(async () => {
  await db?.close?.();
});

test('1 · only the venue files hours, and only on a chapter it is booked to', async () => {
  await assert.rejects(
    () => fileHours(F.catUid, F.catVp, F.chapter, '2099-12-18T17:00:00Z', '2099-12-18T22:00:00Z', 240, 90),
    /row-level security/,
    'a caterer filed the chapter’s hours',
  );
  await assert.rejects(
    () => fileHours(F.venueUid, F.venueVp, F.moment, '2099-12-18T18:00:00Z', '2099-12-18T19:00:00Z', 30, 30),
    /row-level security/,
    'hours were filed on a moment',
  );
});

test('2 · the host approves: the hours land and the chapter is held', async () => {
  const id = await fileHours(F.venueUid, F.venueVp, F.chapter, '2099-12-18T17:00:00Z', '2099-12-18T22:00:00Z', 240, 90);
  await asUser(F.stranger);
  await assert.rejects(() => db.query(`SELECT public.apply_venue_hours($1)`, [id]), /schedulehours:not_allowed/, 'a stranger applied the hours');
  await asUser(F.couple);
  await db.query(`SELECT public.apply_venue_hours($1)`, [id]);
  const h = await hours();
  assert.deepEqual({ s: h.s, e: h.e, i: h.i, g: h.g }, { s: '2099-12-18 17:00', e: '2099-12-18 22:00', i: 240, g: 90 });
  assert.equal(h.held, F.venueEv, 'the chapter is not held by the venue');
});

test('3 · held: the host’s own change to the hours is refused; anything else passes', async () => {
  const was = await hours();
  for (const [sql, why] of [
    [`UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-18 16:00:00+00' WHERE block_id = $1`, 'a retime'],
    [`UPDATE public.event_schedule_blocks SET ingress_minutes_before = 30 WHERE block_id = $1`, 'the setup window'],
    [`UPDATE public.event_schedule_blocks SET egress_minutes_after = NULL WHERE block_id = $1`, 'the pack-up window'],
  ] as const) {
    await asUser(F.couple);
    await assert.rejects(() => db.query(sql, [F.chapter]), HELD, why);
    assert.deepEqual(await hours(), was, `${why} — refused, but the chapter changed anyway`);
  }
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET label = 'Reception', is_public = true WHERE block_id = $1`, [F.chapter]);
});

test('4 · "Ask Blue Leaf to change", accepted by the venue, passes through the same door', async () => {
  await asUser(F.couple);
  const ask = (
    await db.query<{ suggestion_id: string }>(
      `INSERT INTO public.event_schedule_suggestions
         (event_id, block_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind, proposed_start_at, proposed_end_at, note, direction, asked_as)
       VALUES ($1,$2,$3,$4,'The couple','adjust', TIMESTAMPTZ '2099-12-18 17:30:00+00', TIMESTAMPTZ '2099-12-18 22:30:00+00','Half an hour later?','to_supplier','host')
       RETURNING suggestion_id`,
      [F.eventId, F.chapter, F.venueVp, F.couple],
    )
  ).rows[0]!.suggestion_id;
  // The host cannot answer their own ask through the door.
  await assert.rejects(() => db.query(`SELECT public.apply_venue_hours($1)`, [ask]), /schedulehours:not_allowed/);
  await asUser(F.venueUid);
  await db.query(`SELECT public.apply_venue_hours($1)`, [ask]);
  const h = await hours();
  assert.deepEqual({ s: h.s, e: h.e, i: h.i, g: h.g }, { s: '2099-12-18 17:30', e: '2099-12-18 22:30', i: 240, g: 90 });
});

test('5 · Running late still moves a held chapter', async () => {
  await asOwner();
  await db.exec(`BEGIN`);
  await db.query(`SELECT set_config('app.running_late_minutes', '15', true)`);
  await db.query(
    `UPDATE public.event_schedule_blocks SET start_at = start_at + interval '15 minutes', end_at = end_at + interval '15 minutes' WHERE block_id = $1`,
    [F.chapter],
  );
  await db.exec(`COMMIT`);
  assert.equal((await hours()).s, '2099-12-18 17:45');
});

test('5b · the event’s date moving still moves a held chapter', async () => {
  await asUser(F.couple);
  await db.query(`UPDATE public.events SET event_date = DATE '2099-12-19' WHERE event_id = $1`, [F.eventId]);
  await db.query(`SELECT public.move_event_schedule_with_date($1, DATE '2099-12-19')`, [F.eventId]);
  const h = await hours();
  assert.equal(h.s, '2099-12-19 17:45', 'the held chapter stayed behind when the date moved');
  assert.equal(h.held, F.venueEv, 'the move dropped the hold');
});

test('6 · taking the venue off the chapter lifts the hold', async () => {
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET responsible_vendor_ids = $2::uuid[] WHERE block_id = $1`, [F.chapter, [F.catEv]]);
  assert.equal((await hours()).held, null, 'the hold stayed after the venue left the chapter');
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-18 16:00:00+00' WHERE block_id = $1`, [F.chapter]);
  assert.equal((await hours()).s, '2099-12-18 16:00');
});

test('7 · nobody but apply_venue_hours puts a venue on a chapter’s hours', async () => {
  await asUser(F.couple);
  await assert.rejects(
    () => db.query(`UPDATE public.event_schedule_blocks SET hours_vendor_id = $2 WHERE block_id = $1`, [F.chapter, F.catEv]),
    /Only the venue's own hours/,
  );
});
