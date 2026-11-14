/**
 * THE HOST — OR THE COORDINATOR — ASKS A BOOKED SUPPLIER TO CHANGE THEIR TIMES; THE SUPPLIER ANSWERS.
 * Asserted against the DATABASE through a real session, by writing rows the way PostgREST would.
 *
 * Owner, 2026-11-02 (DECISION_LOG "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK", item 2): *"receive requests for
 * schedules from hosts of the event and coordinator?"* Migration 20271303655108 — `event_schedule_suggestions` in
 * reverse (`direction = 'to_supplier'`), never a second table.
 *
 * What it holds:
 *   1. an ask is CREATED — by the couple (as host) and by a seat with The Day = Edit (as coordinator);
 *   2. a coordinator cannot ask AS the host, a View seat cannot ask at all, a stranger cannot ask, and a SUPPLIER
 *      cannot ask itself (the restrictive policy) — every refusal leaves no row;
 *   3. only the asked supplier may answer (`may_answer_schedule_ask`): not a stranger, not another supplier, not the
 *      host; the host cannot flip their own ask's status (the resolve policy is 'to_host' only);
 *   4. a stranger cannot even READ the ask.
 * The accept path itself (the moment moves, then the status flips) is the shipped `decideSuggestion`; its reverse
 * branch is held by `lib/the-supplier-answers-the-hosts-ask.test.ts`.
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
  coordEdit: '',
  coordView: '',
  stranger: '',
  supA: '',
  supB: '',
  vpA: '',
  vpB: '',
  vpUnbooked: '',
  blockA: '',
  blockA2: '',
};

const WHEN = '2099-12-12T09:30:00Z';

type AskRow = { block_id: string; vendor_profile_id: string; asked_as: string | null; direction?: string };

async function askAs(uid: string, a: AskRow): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, suggested_by_name, kind,
        proposed_start_at, proposed_end_at, note, status, direction, asked_as)
     VALUES ($1,$2,$3,$4,'Asker','adjust',$5,$6,'Could you come 30 minutes earlier?','open',$7,$8)
     RETURNING suggestion_id`,
    [F.eventId, a.block_id, a.vendor_profile_id, uid, WHEN, '2099-12-12T10:00:00Z', a.direction ?? 'to_supplier', a.asked_as],
  );
  return r.rows[0]!.suggestion_id;
}

async function countAsks(): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_schedule_suggestions WHERE direction = 'to_supplier'`,
  );
  return r.rows[0]!.n;
}

async function assertRefused(uid: string, a: AskRow, why: string): Promise<void> {
  const before = await countAsks();
  await assert.rejects(() => askAs(uid, a), /row-level security|violates/i, why);
  assert.equal(await countAsks(), before, `${why} — refused, but a row was written anyway`);
}

async function mayAnswer(uid: string, id: string): Promise<boolean> {
  await asUser(uid);
  const r = await db.query<{ v: boolean }>(`SELECT public.may_answer_schedule_ask($1) AS v`, [id]);
  return r.rows[0]!.v;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  const mkUser = async (email: string): Promise<string> =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data)
         VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;

  F.eventId = (
    await db.query<{ event_id: string }>(
      `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
       VALUES ('Ask Lab','wedding','catholic','banquet_hall', DATE '2099-12-12', 'day') RETURNING event_id`,
    )
  ).rows[0]!.event_id;

  F.couple = await mkUser('couple@ask.test');
  F.coordEdit = await mkUser('coord@ask.test');
  F.coordView = await mkUser('view@ask.test');
  F.stranger = await mkUser('stranger@ask.test');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [F.eventId, F.couple]);
  for (const [uid, level] of [
    [F.coordEdit, 'edit'],
    [F.coordView, 'view'],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1,$2,'wedding_planner_external',
               jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,'remove_hosts',false,
                                  'areas', jsonb_build_object('schedule',$3::text)),
               NOW())`,
      [F.eventId, uid, level],
    );
  }

  const bookings: string[] = [];
  for (const key of ['A', 'B'] as const) {
    const uid = await mkUser(`sup${key}@ask.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1,$2,'Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
        [uid, `Supplier ${key}`],
      )
    ).rows[0]!.vendor_profile_id;
    bookings.push(
      (
        await db.query<{ vendor_id: string }>(
          `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
           VALUES ($1,'catering',$2,'contracted',100000,$3) RETURNING vendor_id`,
          [F.eventId, `Supplier ${key}`, vp],
        )
      ).rows[0]!.vendor_id,
    );
    if (key === 'A') {
      F.supA = uid;
      F.vpA = vp;
    } else {
      F.supB = uid;
      F.vpB = vp;
    }
  }

  // A shop on Setnayan that is NOT booked on this event.
  const unbookedUser = await mkUser('unbooked@ask.test');
  F.vpUnbooked = (
    await db.query<{ vendor_profile_id: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
       VALUES ($1,'Not Booked','Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
      [unbookedUser],
    )
  ).rows[0]!.vendor_profile_id;

  const mkBlock = async (label: string): Promise<string> =>
    (
      await db.query<{ block_id: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, responsible_vendor_ids)
         VALUES ($1,$2, TIMESTAMPTZ '2099-12-12T10:00:00Z', TIMESTAMPTZ '2099-12-12T10:30:00Z', $3::uuid[]) RETURNING block_id`,
        [F.eventId, label, [bookings[0]]],
      )
    ).rows[0]!.block_id;
  F.blockA = await mkBlock('Detail shots');
  F.blockA2 = await mkBlock('Family photos');
});

after(async () => {
  await db?.close?.();
});

// ─── 1 · a request is created ─────────────────────────────────────────────────

let hostAsk = '';
let coordAsk = '';

test('the couple asks a booked supplier, as the host', async () => {
  hostAsk = await askAs(F.couple, { block_id: F.blockA, vendor_profile_id: F.vpA, asked_as: 'host' });
  await asOwner();
  const r = await db.query<{ direction: string; asked_as: string; status: string }>(
    `SELECT direction, asked_as, status FROM public.event_schedule_suggestions WHERE suggestion_id = $1`,
    [hostAsk],
  );
  assert.deepEqual(r.rows[0], { direction: 'to_supplier', asked_as: 'host', status: 'open' });
});

test('a coordinator holding The Day = Edit asks, as the coordinator', async () => {
  coordAsk = await askAs(F.coordEdit, { block_id: F.blockA2, vendor_profile_id: F.vpA, asked_as: 'coordinator' });
  assert.ok(coordAsk);
});

test('one open ask per moment per supplier', async () => {
  await assert.rejects(
    () => askAs(F.couple, { block_id: F.blockA, vendor_profile_id: F.vpA, asked_as: 'host' }),
    /duplicate key|unique/i,
  );
});

// ─── 2 · who may NOT ask ───────────────────────────────────────────────────────

test('a coordinator cannot ask AS the host, nor a host claim to be the coordinator', async () => {
  await assertRefused(F.coordEdit, { block_id: F.blockA, vendor_profile_id: F.vpB, asked_as: 'host' }, 'a coordinator asking as host');
  await assertRefused(F.couple, { block_id: F.blockA, vendor_profile_id: F.vpB, asked_as: 'coordinator' }, 'a host asking as coordinator');
});

test('a View seat and a stranger cannot ask', async () => {
  await assertRefused(F.coordView, { block_id: F.blockA, vendor_profile_id: F.vpB, asked_as: 'coordinator' }, 'a View seat');
  await assertRefused(F.stranger, { block_id: F.blockA, vendor_profile_id: F.vpB, asked_as: 'host' }, 'a stranger as host');
  await assertRefused(F.stranger, { block_id: F.blockA, vendor_profile_id: F.vpB, asked_as: 'coordinator' }, 'a stranger as coordinator');
});

test('a host cannot ask a shop that is not booked on the event', async () => {
  await assertRefused(F.couple, { block_id: F.blockA, vendor_profile_id: F.vpUnbooked, asked_as: 'host' }, 'an unbooked shop');
});

test('a SUPPLIER cannot write an ask to itself (it could then answer Yes and move the host’s day)', async () => {
  await assertRefused(F.supA, { block_id: F.blockA2, vendor_profile_id: F.vpA, asked_as: null }, 'a supplier, no asked_as');
  await assertRefused(F.supA, { block_id: F.blockA2, vendor_profile_id: F.vpA, asked_as: 'host' }, 'a supplier claiming host');
});

// ─── 3 · only the asked supplier answers ───────────────────────────────────────

test('only the asked supplier may answer — not a stranger, another supplier or the host', async () => {
  assert.equal(await mayAnswer(F.supA, hostAsk), true, 'the asked supplier');
  assert.equal(await mayAnswer(F.supB, hostAsk), false, 'another supplier');
  assert.equal(await mayAnswer(F.stranger, hostAsk), false, 'a stranger');
  assert.equal(await mayAnswer(F.couple, hostAsk), false, 'the host who asked');
});

test('the host cannot flip their own ask — the resolve policy is for a supplier’s requests only', async () => {
  await asUser(F.couple);
  const r = await db.query(
    `UPDATE public.event_schedule_suggestions SET status = 'accepted' WHERE suggestion_id = $1 RETURNING suggestion_id`,
    [hostAsk],
  );
  assert.equal(r.rows.length, 0, 'the host flipped their own ask');
  await asUser(F.coordEdit);
  const c = await db.query(
    `UPDATE public.event_schedule_suggestions SET status = 'accepted' WHERE suggestion_id = $1 RETURNING suggestion_id`,
    [coordAsk],
  );
  assert.equal(c.rows.length, 0, 'the coordinator flipped their own ask');
});

test('a closed ask can no longer be answered', async () => {
  await asOwner();
  await db.query(`UPDATE public.event_schedule_suggestions SET status = 'declined', answer_note = 'Booked elsewhere' WHERE suggestion_id = $1`, [coordAsk]);
  assert.equal(await mayAnswer(F.supA, coordAsk), false);
});

// ─── 4 · reads ─────────────────────────────────────────────────────────────────

test('the asked supplier and the hosts read the ask; a stranger and another supplier do not', async () => {
  const seen = async (uid: string) => {
    await asUser(uid);
    const r = await db.query(`SELECT 1 FROM public.event_schedule_suggestions WHERE suggestion_id = $1`, [hostAsk]);
    return r.rows.length === 1;
  };
  assert.equal(await seen(F.supA), true, 'the asked supplier');
  assert.equal(await seen(F.couple), true, 'the couple');
  assert.equal(await seen(F.coordEdit), true, 'the coordinator');
  assert.equal(await seen(F.stranger), false, 'a stranger');
  assert.equal(await seen(F.supB), false, 'another supplier');
});

test('a supplier’s own request still runs to the host, and the host still answers it', async () => {
  await asUser(F.supA);
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, proposed_start_at, note, status)
     VALUES ($1,$2,$3,$4,'adjust',$5,'Earlier please','open') RETURNING suggestion_id`,
    [F.eventId, F.blockA, F.vpA, F.supA, WHEN],
  );
  const id = r.rows[0]!.suggestion_id;
  await asUser(F.couple);
  const u = await db.query(
    `UPDATE public.event_schedule_suggestions SET status = 'declined' WHERE suggestion_id = $1 RETURNING direction`,
    [id],
  );
  assert.deepEqual(u.rows, [{ direction: 'to_host' }]);
});
