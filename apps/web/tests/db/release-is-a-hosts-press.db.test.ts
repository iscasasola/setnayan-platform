/**
 * 📣 RELEASE — against the DATABASE, migrations replayed, through real sessions (owner 2026-11-01, DECISION_LOG "FULL
 * SCHEDULE: A HOST OR COORDINATOR PRESSES RELEASE, NOTIFICATIONS ONLY"; migrations 20271301956127 + 20271302139506).
 *
 *   · a stranger, a guest, and a helper with only View on the Schedule are REFUSED — and nothing is stamped;
 *   · a coordinator with Edit on the Schedule may release: `events.schedule_released_at` is stamped, and every account
 *     holding a guest seat gets ONE in-app `schedule_released` notice — a removed guest's account and the presser get
 *     none;
 *   · a second press (by the host) is a no-op: the first time is kept, nobody is told twice;
 *   · nobody may write the column by hand (no UPDATE grant), and the host reads it on their own session.
 * Every test names the mutation that turns it red.
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

const F = { couple: '', coord: '', viewer: '', stranger: '', pam: '', ben: '', gone: '', eventId: '' };

async function release(uid: string) {
  await asUser(uid);
  const r = await db.query<{ r: { released_at: string; told: number; already: boolean } }>(`SELECT public.release_full_schedule($1) AS r`, [F.eventId]);
  return r.rows[0]!.r;
}
async function releasedAt(): Promise<string | null> {
  await asOwner();
  const r = await db.query<{ t: string | null }>(`SELECT schedule_released_at::text AS t FROM public.events WHERE event_id = $1`, [F.eventId]);
  return r.rows[0]!.t;
}
async function noticesFor(uid: string): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.notifications WHERE user_id = $1 AND type = 'schedule_released' AND event_id = $2`,
    [uid, F.eventId],
  );
  return r.rows[0]!.n;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();
  const mkUser = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('couple@release.test');
  F.coord = await mkUser('coord@release.test');
  F.viewer = await mkUser('viewer@release.test');
  F.stranger = await mkUser('stranger@release.test');
  F.pam = await mkUser('pam@release.test');
  F.ben = await mkUser('ben@release.test');
  F.gone = await mkUser('gone@release.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Sample Wedding','wedding','catholic','banquet_hall', DATE '2099-12-18', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  for (const [uid, level] of [
    [F.coord, 'edit'],
    [F.viewer, 'view'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1,$2,'wedding_planner_external', jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,'remove_hosts',false,
                                            'areas', jsonb_build_object('schedule',$3::text)), NOW())`,
      [F.eventId, uid, level],
    );
  }
  // Three guest seats held by accounts — one of them removed from the list.
  for (const [uid, name, removed] of [
    [F.pam, 'Pam', false],
    [F.ben, 'Ben', false],
    [F.gone, 'Gone', true],
  ] as const) {
    const g = (
      await db.query<{ guest_id: string }>(
        `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,$2,'Sample','both','friends') RETURNING guest_id`,
        [F.eventId, name],
      )
    ).rows[0]!.guest_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES ($1,$2,'guest',$3)`, [F.eventId, uid, g]);
    if (removed) await db.query(`UPDATE public.guests SET deleted_at = NOW() WHERE guest_id = $1`, [g]);
  }
});

after(async () => {
  await replay?.db.close();
});

test('a stranger, a guest, and a View-only helper cannot release — nothing is stamped', async () => {
  // Red if: the authority check in release_full_schedule is dropped, or widened to any moderator level.
  for (const uid of [F.stranger, F.pam, F.viewer]) {
    await assert.rejects(release(uid), /only a host or a coordinator/);
  }
  assert.equal(await releasedAt(), null);
  assert.equal(await noticesFor(F.pam), 0);
});

test('nobody writes the column by hand', async () => {
  // Red if: an UPDATE grant on schedule_released_at is added (the one writer is the function).
  await asUser(F.couple);
  await assert.rejects(db.query(`UPDATE public.events SET schedule_released_at = NOW() WHERE event_id = $1`, [F.eventId]));
  assert.equal(await releasedAt(), null);
});

test('a coordinator with Edit releases: stamped once, every guest account told once in-app, the removed guest not', async () => {
  // Red if: the stamp or the notice INSERT is dropped, or the deleted_at / presser filters are.
  const r = await release(F.coord);
  assert.equal(r.already, false);
  assert.equal(r.told, 2);
  assert.equal((r as { notice?: string }).notice, 'schedule_released');
  assert.ok(await releasedAt());
  assert.equal(await noticesFor(F.pam), 1);
  assert.equal(await noticesFor(F.ben), 1);
  assert.equal(await noticesFor(F.gone), 0, 'a removed guest was told');
  assert.equal(await noticesFor(F.coord), 0, 'the presser was told');
  // The host reads it on their own session (the SELECT grant).
  await asUser(F.couple);
  const own = await db.query<{ t: string | null }>(`SELECT schedule_released_at::text AS t FROM public.events WHERE event_id = $1`, [F.eventId]);
  assert.ok(own.rows[0]?.t, 'the host cannot read the release on their own session');
});

test('a second press keeps the first time and tells nobody again', async () => {
  // Red if: the "already released" early return is dropped.
  const first = await releasedAt();
  const r = await release(F.couple);
  assert.equal(r.already, true);
  assert.equal(r.told, 0);
  assert.equal(await releasedAt(), first);
  assert.equal(await noticesFor(F.pam), 1);
});
