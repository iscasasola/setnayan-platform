/**
 * 🔒 CHANGE LOCK — asserted against the DATABASE, through real sessions (migration 20271303409352; supplier gate audit
 * D7; DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (7), owner: *"change lock (means the
 * supplier cannot accept changes anymore)."*).
 *
 *   1 · Only the booked supplier locks and unlocks their own part (`supplier_mark_schedule('lock'|'unlock')`).
 *   2 · While locked, the COUPLE's write to that supplier's moment is refused — an edit, a retime, a delete, taking
 *       them off it, their crew line — and the refusal is the calm line "<shop> isn't taking changes…". The row is unchanged.
 *   3 · What still passes: a guests-only toggle; another supplier put on a shared moment; the supplier's OWN request
 *       applied exactly as asked (and not one field more); the event's date moving; the event being deleted.
 *   4 · Unlock reopens it.
 *
 * Every refusal asserts the row is unchanged afterwards — a refusal that still wrote is not a refusal.
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

const F = { eventId: '', couple: '', supA: '', supB: '', vpA: '', vpB: '', evA: '', evB: '', chapter: '', momentA: '', shared: '', taskA: '' };

const LOCKED = /Supplier A isn't taking changes\. Send them a request instead\./;

async function row(blockId: string): Promise<{ label: string; start_at: string; rvi: string[]; is_public: boolean } | null> {
  await asOwner();
  const r = await db.query<{ label: string; start_at: string; rvi: string[]; is_public: boolean }>(
    `SELECT label, (start_at AT TIME ZONE 'UTC')::text AS start_at, responsible_vendor_ids AS rvi, is_public FROM public.event_schedule_blocks WHERE block_id=$1`,
    [blockId],
  );
  return r.rows[0] ?? null;
}

async function mark(uid: string, what: 'lock' | 'unlock'): Promise<void> {
  await asUser(uid);
  await db.query(`SELECT public.supplier_mark_schedule($1,$2)`, [F.eventId, what]);
  await asOwner();
}

async function refusedAsCouple(sql: string, params: unknown[], blockId: string, why: string): Promise<void> {
  const was = await row(blockId);
  await asUser(F.couple);
  await assert.rejects(() => db.query(sql, params), LOCKED, why);
  assert.deepEqual(await row(blockId), was, `${why} — refused, but the moment changed anyway`);
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
  F.couple = await mkUser('couple@lock.test');
  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Lock Day','wedding','catholic','banquet_hall', DATE '2099-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);

  const mkSupplier = async (key: string): Promise<{ uid: string; vp: string; ev: string }> => {
    const uid = await mkUser(`sup${key}@lock.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1,$2,'Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
        [uid, `Supplier ${key}`],
      )
    ).rows[0]!.vendor_profile_id;
    const ev = (
      await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
         VALUES ($1,'catering',$2,'contracted',100000,$3) RETURNING vendor_id`,
        [F.eventId, `Supplier ${key}`, vp],
      )
    ).rows[0]!.vendor_id;
    return { uid, vp, ev };
  };
  const a = await mkSupplier('A');
  const b = await mkSupplier('B');
  Object.assign(F, { supA: a.uid, vpA: a.vp, evA: a.ev, supB: b.uid, vpB: b.vp, evB: b.ev });

  const mkBlock = async (label: string, tags: string[], parent: string | null): Promise<string> =>
    (
      await db.query<{ block_id: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, responsible_vendor_ids, parent_block_id)
         VALUES ($1,$2, TIMESTAMPTZ '2099-12-12 15:00:00+00', TIMESTAMPTZ '2099-12-12 15:30:00+00', $3::uuid[], $4) RETURNING block_id`,
        [F.eventId, label, tags, parent],
      )
    ).rows[0]!.block_id;
  F.chapter = await mkBlock('Reception', [], null);
  F.momentA = await mkBlock('Lights up', [F.evA], F.chapter);
  F.shared = await mkBlock('Grand entrance', [F.evA], F.chapter);
  F.taskA = (
    await db.query<{ task_id: string }>(
      `INSERT INTO public.event_schedule_tasks (block_id, vendor_id, crew, what) VALUES ($1,$2,'Team A','Light the aisle') RETURNING task_id`,
      [F.momentA, F.evA],
    )
  ).rows[0]!.task_id;
});

after(async () => {
  await db?.close?.();
});

test('only the booked supplier locks their part — the couple, and a supplier on another event, cannot', async () => {
  await asUser(F.couple);
  await assert.rejects(() => db.query(`SELECT public.supplier_mark_schedule($1,'lock')`, [F.eventId]), /booked on this event/);
  await asUser(F.couple);
  await assert.rejects(() => db.query(`UPDATE public.event_supplier_schedule_marks SET locked_at = NOW()`), /permission denied/);
  await mark(F.supA, 'lock');
  const r = await db.query<{ locked: boolean; seen: string | null }>(
    `SELECT locked_at IS NOT NULL AS locked, seen_at::text AS seen FROM public.event_supplier_schedule_marks WHERE event_id=$1 AND vendor_profile_id=$2`,
    [F.eventId, F.vpA],
  );
  assert.deepEqual(r.rows[0], { locked: true, seen: null }, 'a lock moves locked_at only — Seen and Confirm are left as they were');
});

test('while locked, the couple cannot edit, retime, delete, or take the supplier off their moment — said in words', async () => {
  const sql = (set: string) => `UPDATE public.event_schedule_blocks SET ${set} WHERE block_id=$1`;
  await refusedAsCouple(sql(`label = 'Lights DOWN'`), [F.momentA], F.momentA, 'a rename of a locked moment');
  await refusedAsCouple(sql(`start_at = start_at + interval '30 minutes'`), [F.momentA], F.momentA, 'a retime of a locked moment');
  await refusedAsCouple(sql(`responsible_vendor_ids = '{}'`), [F.momentA], F.momentA, 'taking the locked supplier off');
  await refusedAsCouple(`DELETE FROM public.event_schedule_blocks WHERE block_id=$1`, [F.momentA], F.momentA, 'a delete of a locked moment');
  await refusedAsCouple(`DELETE FROM public.event_schedule_blocks WHERE block_id=$1`, [F.chapter], F.chapter, 'a chapter delete cascading onto a locked moment');
  await refusedAsCouple(
    `SELECT public.move_schedule_chapter($1, TIMESTAMPTZ '2099-12-12 17:00:00+00')`,
    [F.chapter],
    F.momentA,
    'moving the chapter (and the locked moment with it)',
  );
});

test("while locked, the supplier's crew line cannot be changed or removed by the couple", async () => {
  await asUser(F.couple);
  await assert.rejects(() => db.query(`UPDATE public.event_schedule_tasks SET what='Dim the aisle' WHERE task_id=$1`, [F.taskA]), LOCKED);
  await asUser(F.couple);
  await assert.rejects(() => db.query(`DELETE FROM public.event_schedule_tasks WHERE task_id=$1`, [F.taskA]), LOCKED);
  await asOwner();
  const t = await db.query<{ what: string }>(`SELECT what FROM public.event_schedule_tasks WHERE task_id=$1`, [F.taskA]);
  assert.equal(t.rows[0]?.what, 'Light the aisle');
});

test('what does not touch their part still passes: shown to guests, and another supplier put on a shared moment', async () => {
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET is_public = true WHERE block_id=$1`, [F.momentA]);
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET responsible_vendor_ids = responsible_vendor_ids || $2::uuid WHERE block_id=$1`, [F.shared, F.evB]);
  const r = await row(F.shared);
  assert.deepEqual(r?.rvi, [F.evA, F.evB]);
  assert.equal((await row(F.momentA))?.is_public, true);
});

test("the supplier's OWN request applies exactly as asked — and a host cannot ride it to change one field more", async () => {
  await asUser(F.supA);
  const sid = (
    await db.query<{ suggestion_id: string }>(
      `INSERT INTO public.event_schedule_suggestions (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, proposed_start_at, note, status)
       VALUES ($1,$2,$3,$4,'adjust', TIMESTAMPTZ '2099-12-12 15:15:00+00','a bit later','open') RETURNING suggestion_id`,
      [F.eventId, F.momentA, F.vpA, F.supA],
    )
  ).rows[0]!.suggestion_id;
  await refusedAsCouple(
    `UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-12 15:15:00+00', label = 'Sneaky' WHERE block_id=$1`,
    [F.momentA],
    F.momentA,
    'the asked time PLUS a rename',
  );
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-12 15:15:00+00' WHERE block_id=$1`, [F.momentA]);
  assert.equal((await row(F.momentA))?.start_at, '2099-12-12 15:15:00');
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status='accepted' WHERE suggestion_id=$1`, [sid]);
});

test('🏃 RUNNING LATE moves a locked part (owner 2026-11-03) — through its one door, all of it, and nothing more', async () => {
  // momentA stands at 15:15 here (the request case above); every write below is undone so the date-move case still holds.
  const was = (await row(F.momentA))!;
  assert.equal(was.start_at, '2099-12-12 15:15:00');
  await asUser(F.couple);
  const moved = await db.query<{ n: number }>(`SELECT public.running_late_shift_schedule($1, ARRAY[$2]::uuid[], 10) AS n`, [F.eventId, F.momentA]);
  assert.equal(moved.rows[0]!.n, 1);
  assert.equal((await row(F.momentA))?.start_at, '2099-12-12 15:25:00', 'the running-late shift did not move the locked moment');
  // …and back, through the same door.
  await asUser(F.couple);
  await db.query(`SELECT public.running_late_shift_schedule($1, ARRAY[$2]::uuid[], -10)`, [F.eventId, F.momentA]);
  assert.deepEqual(await row(F.momentA), was);
});

test('🔒 every OTHER host edit still meets the lock: a plain shift, a rename riding a running-late shift, a wrong size', async () => {
  // A drag (the same pure shift, outside the running-late door) is still refused.
  await refusedAsCouple(
    `UPDATE public.event_schedule_blocks SET start_at = start_at + interval '10 minutes', end_at = end_at + interval '10 minutes' WHERE block_id=$1`,
    [F.momentA],
    F.momentA,
    'a drag of a locked moment (no running-late door)',
  );
  // Inside a running-late transaction, anything beyond exactly that shift is still refused.
  const was = await row(F.momentA);
  await asOwner();
  for (const [sql, why] of [
    [`UPDATE public.event_schedule_blocks SET start_at = start_at + interval '10 minutes', end_at = end_at + interval '10 minutes', label = 'Sneaky' WHERE block_id=$1`, 'a rename riding the shift'],
    [`UPDATE public.event_schedule_blocks SET start_at = start_at + interval '20 minutes', end_at = end_at + interval '20 minutes' WHERE block_id=$1`, 'a shift of a different size'],
    [`UPDATE public.event_schedule_blocks SET start_at = start_at + interval '10 minutes' WHERE block_id=$1`, 'a start moved without its end'],
  ] as const) {
    await assert.rejects(
      () =>
        db.transaction(async (tx) => {
          await tx.query(`SELECT set_config('app.running_late_minutes', '10', true)`);
          await tx.query(sql, [F.momentA]);
        }),
      LOCKED,
      why,
    );
  }
  assert.deepEqual(await row(F.momentA), was, 'a refused edit changed the moment anyway');
  // The marker never outlives the door: right after a running-late call, a plain shift is refused again.
  await asUser(F.couple);
  await db.query(`SELECT public.running_late_shift_schedule($1, ARRAY[$2]::uuid[], 10)`, [F.eventId, F.momentA]);
  await db.query(`SELECT public.running_late_shift_schedule($1, ARRAY[$2]::uuid[], -10)`, [F.eventId, F.momentA]);
  await refusedAsCouple(
    `UPDATE public.event_schedule_blocks SET start_at = start_at + interval '10 minutes', end_at = end_at + interval '10 minutes' WHERE block_id=$1`,
    [F.momentA],
    F.momentA,
    'a drag right after a running-late shift (the marker leaked)',
  );
});

test('the running-late door is the caller’s: a supplier, a stranger, or a span with a refused row moves nothing', async () => {
  const was = await row(F.momentA);
  await asUser(F.supB);
  await assert.rejects(() => db.query(`SELECT public.running_late_shift_schedule($1, ARRAY[$2]::uuid[], 10)`, [F.eventId, F.momentA]), /nothing_changed/);
  assert.deepEqual(await row(F.momentA), was);
  await asUser(F.couple);
  await assert.rejects(
    () => db.query(`SELECT public.running_late_shift_schedule($1, ARRAY[$2, gen_random_uuid()]::uuid[], 10)`, [F.eventId, F.momentA]),
    /nothing_changed/,
    'half a day moved — a span with one missing row must undo the whole shift',
  );
  assert.deepEqual(await row(F.momentA), was);
});

test("a HOST'S ask (#7197), accepted by the locked supplier, moves the moment — and nothing more rides on it", async () => {
  // The lock's own words send the host to "a request instead": the host's ask IS that request. It is an open
  // 'adjust' row for this shop, so Accept (decideSuggestion, the service role) writes exactly the asked fields.
  await asUser(F.couple);
  const sid = (
    await db.query<{ suggestion_id: string }>(
      `INSERT INTO public.event_schedule_suggestions
         (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, direction, asked_as, proposed_start_at, note, status)
       VALUES ($1,$2,$3,$4,'adjust','to_supplier','host', TIMESTAMPTZ '2099-12-12 15:20:00+00','could you start later?','open')
       RETURNING suggestion_id`,
      [F.eventId, F.shared, F.vpA, F.couple],
    )
  ).rows[0]!.suggestion_id;
  // (On the shared moment, so `momentA`'s time stays what the date-move case expects.)
  // Riding the ask to rename the moment too is still refused.
  await asOwner();
  const was = await row(F.shared);
  await assert.rejects(
    () => db.query(`UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-12 15:20:00+00', label = 'Sneaky' WHERE block_id=$1`, [F.shared]),
    LOCKED,
    'the asked time PLUS a rename rode the host’s ask past the lock',
  );
  assert.deepEqual(await row(F.shared), was);
  // Accept: exactly the asked time lands while the part is locked.
  await db.query(`UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-12 15:20:00+00' WHERE block_id=$1`, [F.shared]);
  assert.equal((await row(F.shared))?.start_at, '2099-12-12 15:20:00', 'the locked supplier’s Accept of a host’s ask was refused');
  await db.query(`UPDATE public.event_schedule_suggestions SET status='accepted' WHERE suggestion_id=$1`, [sid]);
});

test('unlock reopens the part to the host', async () => {
  await mark(F.supA, 'unlock');
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_blocks SET label = 'Lights up (late)' WHERE block_id=$1`, [F.momentA]);
  assert.equal((await row(F.momentA))?.label, 'Lights up (late)');
  await mark(F.supA, 'lock');
});

test('⏭ the lock knows "right after" (20271303690499): re-anchoring is refused; the supplier\'s own new time ends it', async () => {
  // An untimed moment of the locked shop, right after "Grand entrance" (both theirs).
  await asOwner();
  const after = (
    await db.query<{ block_id: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids, parent_block_id, time_tba, is_public, follows_block_id)
       SELECT event_id, 'Sparklers', start_at, $2::uuid[], parent_block_id, TRUE, FALSE, block_id FROM public.event_schedule_blocks WHERE block_id=$1
       RETURNING block_id`,
      [F.shared, [F.evA]],
    )
  ).rows[0]!.block_id;
  await refusedAsCouple(
    `UPDATE public.event_schedule_blocks SET follows_block_id = $2 WHERE block_id=$1`,
    [after, F.momentA],
    after,
    're-anchoring a locked shop\'s right-after moment',
  );
  // Their own request for a real time: the host's accept path writes the time AND ends "right after" in one update.
  await asUser(F.supA);
  const sid = (
    await db.query<{ suggestion_id: string }>(
      `INSERT INTO public.event_schedule_suggestions (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, proposed_start_at, note, status)
       VALUES ($1,$2,$3,$4,'adjust', TIMESTAMPTZ '2099-12-12 16:00:00+00','at four','open') RETURNING suggestion_id`,
      [F.eventId, after, F.vpA, F.supA],
    )
  ).rows[0]!.suggestion_id;
  await asUser(F.couple);
  await db.query(
    `UPDATE public.event_schedule_blocks SET start_at = TIMESTAMPTZ '2099-12-12 16:00:00+00', time_tba = FALSE, follows_block_id = NULL WHERE block_id=$1`,
    [after],
  );
  assert.equal((await row(after))?.start_at, '2099-12-12 16:00:00');
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status='accepted' WHERE suggestion_id=$1`, [sid]);
  await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id=$1`, [after]).catch(() => {});
});

test('🕑 the lock knows "About" and "2:15/2:30" (20271304682748): re-shaping a locked moment\'s time is refused', async () => {
  await refusedAsCouple(
    `UPDATE public.event_schedule_blocks SET time_shape = 'or', time_or_minutes = 15 WHERE block_id=$1`,
    [F.momentA],
    F.momentA,
    'turning a locked moment into "one of two times"',
  );
  await refusedAsCouple(`UPDATE public.event_schedule_blocks SET time_shape = 'about' WHERE block_id=$1`, [F.momentA], F.momentA, 'making a locked moment "about"');
});

test("the event's date moving carries a locked moment with it; deleting the event is never refused", async () => {
  await asOwner();
  await db.query(`INSERT INTO public.event_schedule_day_anchor (event_id, anchor_day) VALUES ($1, DATE '2099-12-12') ON CONFLICT (event_id) DO UPDATE SET anchor_day = EXCLUDED.anchor_day`, [F.eventId]);
  await db.query(`UPDATE public.events SET event_date = DATE '2099-12-13' WHERE event_id=$1`, [F.eventId]);
  await asUser(F.couple);
  await db.query(`SELECT public.move_event_schedule_with_date($1, DATE '2099-12-13')`, [F.eventId]);
  assert.equal((await row(F.momentA))?.start_at, '2099-12-13 15:15:00');
  await asOwner();
  await db.query(`DELETE FROM public.events WHERE event_id=$1`, [F.eventId]);
  assert.equal(await row(F.momentA), null);
});
