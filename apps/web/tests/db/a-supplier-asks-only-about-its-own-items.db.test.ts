/**
 * A SUPPLIER ASKS ONLY ABOUT ITS OWN ITEMS — asserted against the DATABASE,
 * through a real session, by INSERTing the request row the way PostgREST would.
 *
 * Owner, 2026-10-03 (DECISION_LOG "SUPPLIERS WRITE THEIR OWN PART OF THE
 * SCHEDULE"): a booked supplier may ask to ADD, EDIT or DELETE its OWN schedule
 * items; on anybody else's it may only SUGGEST. Migration 20271263061583.
 *
 * Why the INSERT and not the server action: `suggestScheduleChange` is a public
 * HTTP endpoint and the table is served over PostgREST. A rule that lived in the
 * action (or the screen) would pass every test here that drove the action and
 * still let a hand-made request through. The boundary is the policy.
 *
 * "Own" = the block's `responsible_vendor_ids` carries one of this supplier's
 * `event_vendors.vendor_id` booking rows on the event — the column the "Your
 * slot" lens already reads, and the one the couple's Accept on a 'new' request
 * now writes.
 *
 * Every refusal asserts the ROW IS NOT THERE afterwards, not only that an error
 * came back — a refusal that still wrote is not a refusal.
 *
 * The last section is the DB half of "the coordinator is told": the enum value
 * exists (a TS-only type is refused in silence) and the exact columns the
 * notifier reads, fed to the picker it uses, name the coordinator.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { scheduleRequestRecipients, type ScheduleRequestSeat } from '../../lib/schedule-request-recipients';

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
  otherEventId: '',
  couple: '',
  coordEdit: '',
  delegateView: '',
  delegateOff: '',
  supA: '',
  supB: '',
  vpA: '',
  vpB: '',
  evA: '',
  evB: '',
  blockA: '',
  blockB: '',
  blockCouple: '',
  blockOtherEvent: '',
};

type Ask = {
  block_id?: string | null;
  kind: 'new' | 'adjust' | 'remove' | string;
  proposed_label?: string | null;
  proposed_start_at?: string | null;
  note?: string;
  event_id?: string;
};

/** INSERT a request AS supplier A (or B). Returns the new id, or throws. */
async function askAs(uid: string, vp: string, a: Ask): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind,
        proposed_label, proposed_start_at, note, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'open') RETURNING suggestion_id`,
    [
      a.event_id ?? F.eventId,
      a.block_id ?? null,
      vp,
      uid,
      a.kind,
      a.proposed_label ?? null,
      a.proposed_start_at ?? null,
      a.note ?? 'please',
    ],
  );
  return r.rows[0]!.suggestion_id;
}

async function countAsks(): Promise<number> {
  await asOwner();
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_schedule_suggestions`,
  );
  return r.rows[0]!.n;
}

/** Refused BY THE DATABASE, and nothing written. */
async function assertRefused(uid: string, vp: string, a: Ask, why: string): Promise<void> {
  const before = await countAsks();
  await assert.rejects(() => askAs(uid, vp, a), /row-level security|violates/i, why);
  assert.equal(await countAsks(), before, `${why} — refused, but a row was written anyway`);
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
  const mkEvent = async (name: string): Promise<string> =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', DATE '2099-12-12', 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;

  F.couple = await mkUser('couple@own.test');
  F.coordEdit = await mkUser('coord@own.test');
  F.delegateView = await mkUser('view@own.test');
  F.delegateOff = await mkUser('off@own.test');
  F.eventId = await mkEvent('Own Items');
  F.otherEventId = await mkEvent('Someone Else');

  for (const ev of [F.eventId, F.otherEventId]) {
    await db.query(
      `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
      [ev, F.couple],
    );
  }

  // Delegates: The Day = Edit · View · Off (an areas map that names schedule null).
  for (const [uid, level] of [
    [F.coordEdit, 'edit'],
    [F.delegateView, 'view'],
    [F.delegateOff, null],
  ] as const) {
    await db.query(
      `INSERT INTO public.event_moderators
         (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1,$2,'wedding_planner_external',
               jsonb_build_object('edit_all',false,'checkout',false,'invite_hosts',false,
                                  'remove_hosts',false,
                                  'areas', jsonb_build_object('schedule',$3::text)),
               NOW())
       ON CONFLICT (event_id,user_id) DO UPDATE
         SET permissions_json = EXCLUDED.permissions_json, removed_at = NULL`,
      [F.eventId, uid, level],
    );
  }

  // Two booked suppliers, both on BOTH events.
  for (const key of ['A', 'B'] as const) {
    const uid = await mkUser(`sup${key}@own.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1,$2,'Manila',ARRAY['catering']::text[],'verified', NOW()) RETURNING vendor_profile_id`,
        [uid, `Supplier ${key}`],
      )
    ).rows[0]!.vendor_profile_id;
    let mine = '';
    for (const ev of [F.eventId, F.otherEventId]) {
      const row = await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors
           (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
         VALUES ($1,'catering',$2,'contracted',100000,$3) RETURNING vendor_id`,
        [ev, `Supplier ${key}`, vp],
      );
      if (ev === F.eventId) mine = row.rows[0]!.vendor_id;
    }
    if (key === 'A') {
      F.supA = uid;
      F.vpA = vp;
      F.evA = mine;
    } else {
      F.supB = uid;
      F.vpB = vp;
      F.evB = mine;
    }
  }

  const mkBlock = async (ev: string, label: string, tags: string[]): Promise<string> =>
    (
      await db.query<{ block_id: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids)
         VALUES ($1,$2, NOW() + interval '30 days', $3::uuid[]) RETURNING block_id`,
        [ev, label, tags],
      )
    ).rows[0]!.block_id;
  F.blockA = await mkBlock(F.eventId, 'Lights up', [F.evA]);
  F.blockB = await mkBlock(F.eventId, 'Dinner service', [F.evB]);
  F.blockCouple = await mkBlock(F.eventId, 'Vows', []);
  F.blockOtherEvent = await mkBlock(F.otherEventId, 'Elsewhere', [F.evA]);
});

after(async () => {
  await db?.close?.();
});

// ─── 0 · the fixture says what the tests below rely on ─────────────────────

test('fixture: supplier A is booked on the event and its block is tagged to it', async () => {
  await asUser(F.supA);
  const booked = await db.query<{ e: string }>(`SELECT public.current_vendor_booked_event_ids() AS e`);
  assert.ok(booked.rows.some((r) => r.e === F.eventId), 'A must be booked, or every refusal below is the booked gate');
  const own = await db.query<{ a: boolean; b: boolean; c: boolean }>(
    `SELECT public.current_vendor_owns_schedule_block($1,$4) AS a,
            public.current_vendor_owns_schedule_block($2,$4) AS b,
            public.current_vendor_owns_schedule_block($3,$4) AS c`,
    [F.blockA, F.blockB, F.blockCouple, F.vpA],
  );
  assert.deepEqual(own.rows[0], { a: true, b: false, c: false });
});

test('the own-item question answers only about a profile the caller owns', async () => {
  // A asking "is B's block B's?" must get false — it is not an oracle.
  await asUser(F.supA);
  const r = await db.query<{ v: boolean }>(
    `SELECT public.current_vendor_owns_schedule_block($1,$2) AS v`,
    [F.blockB, F.vpB],
  );
  assert.equal(r.rows[0]!.v, false);

  await asOwner();
  const g = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.role_routine_grants
      WHERE routine_schema='public' AND routine_name='current_vendor_owns_schedule_block'`,
  );
  const grantees = g.rows.map((x) => x.grantee);
  assert.ok(grantees.includes('authenticated'));
  assert.ok(!grantees.includes('anon') && !grantees.includes('PUBLIC'));
});

// ─── 1 · DELETE: own item only ─────────────────────────────────────────────

test("'remove' works on the supplier's OWN item", async () => {
  const id = await askAs(F.supA, F.vpA, { block_id: F.blockA, kind: 'remove', proposed_label: 'Lights up' });
  await asOwner();
  const r = await db.query<{ kind: string; status: string }>(
    `SELECT kind, status FROM public.event_schedule_suggestions WHERE suggestion_id = $1`,
    [id],
  );
  assert.deepEqual(r.rows[0], { kind: 'remove', status: 'open' });
});

test("'remove' is refused on ANOTHER supplier's item and on the couple's", async () => {
  await assertRefused(F.supA, F.vpA, { block_id: F.blockB, kind: 'remove' }, "a delete of supplier B's item");
  await assertRefused(F.supA, F.vpA, { block_id: F.blockCouple, kind: 'remove' }, "a delete of the couple's item");
});

// ─── 2 · EDIT: own item only; elsewhere, words only ────────────────────────

test('an edit (proposed fields) is refused on anybody else’s item', async () => {
  const when = '2099-12-12T10:00:00Z';
  await assertRefused(F.supA, F.vpA, { block_id: F.blockB, kind: 'adjust', proposed_start_at: when }, "a new time on B's item");
  await assertRefused(F.supA, F.vpA, { block_id: F.blockCouple, kind: 'adjust', proposed_label: 'Shorter vows' }, "a rename of the couple's item");
});

test('an edit is allowed on the own item, and a suggestion in words on anybody’s', async () => {
  await askAs(F.supA, F.vpA, { block_id: F.blockA, kind: 'adjust', proposed_start_at: '2099-12-12T09:00:00Z' });
  await askAs(F.supA, F.vpA, { block_id: F.blockB, kind: 'adjust', note: 'Could dinner wait 10 minutes?' });
  await askAs(F.supA, F.vpA, { block_id: F.blockCouple, kind: 'adjust', note: 'We need light for the vows' });
});

// ─── 3 · shape ─────────────────────────────────────────────────────────────

test("an add names no block, a change or removal names one — on this event", async () => {
  await askAs(F.supA, F.vpA, { kind: 'new', proposed_label: 'Lights check' });
  await assertRefused(F.supA, F.vpA, { block_id: F.blockA, kind: 'new' }, "a 'new' that names a block");
  await assertRefused(F.supA, F.vpA, { kind: 'remove' }, "a 'remove' with no block");
  await assertRefused(F.supA, F.vpA, { kind: 'adjust' }, "an 'adjust' with no block");
  // A's OWN block — but on another event than the request says.
  await assertRefused(
    F.supA,
    F.vpA,
    { block_id: F.blockOtherEvent, kind: 'remove' },
    'a request pointing at a block on a different event',
  );
});

test('the vocabulary is exactly adjust · new · remove', async () => {
  await asOwner();
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_schedule_suggestions
           (event_id, vendor_profile_id, suggested_by_user_id, kind, note)
         VALUES ($1,$2,$3,'swap','x')`,
        [F.eventId, F.vpA, F.supA],
      ),
    /check constraint/i,
  );
});

// ─── 4 · the request outlives its block ────────────────────────────────────

test('accepting a removal deletes the block and the request still says accepted', async () => {
  const id = await askAs(F.supA, F.vpA, { block_id: F.blockA, kind: 'remove', proposed_label: 'Lights up' });
  // The couple answers the way resolveScheduleSuggestion does: delete, then flip.
  await asUser(F.couple);
  const del = await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id = $1 RETURNING block_id`, [F.blockA]);
  assert.equal(del.rows.length, 1, 'the couple must be able to delete the block');
  const flip = await db.query(
    `UPDATE public.event_schedule_suggestions SET status='accepted', resolved_by_user_id=$2, resolved_at=NOW()
      WHERE suggestion_id=$1 AND status='open' RETURNING suggestion_id`,
    [id, F.couple],
  );
  assert.equal(flip.rows.length, 1, 'the request vanished with its block — the CASCADE is back');

  await asUser(F.supA);
  const mine = await db.query<{ status: string; block_id: string | null; proposed_label: string }>(
    `SELECT status, block_id, proposed_label FROM public.event_schedule_suggestions WHERE suggestion_id=$1`,
    [id],
  );
  assert.deepEqual(mine.rows[0], { status: 'accepted', block_id: null, proposed_label: 'Lights up' });
});

test('the couple can still delete a moment that has open requests on it', async () => {
  // SET NULL onto a CHECK that demanded a block would make this DELETE fail.
  await askAs(F.supB, F.vpB, { block_id: F.blockB, kind: 'adjust', proposed_start_at: '2099-12-12T18:00:00Z' });
  await asUser(F.couple);
  const del = await db.query(`DELETE FROM public.event_schedule_blocks WHERE block_id=$1 RETURNING block_id`, [F.blockB]);
  assert.equal(del.rows.length, 1);
});

// ─── 5 · who answers, and who is told ──────────────────────────────────────

test('a coordinator holding The Day = Edit can answer a request; View cannot', async () => {
  const id = await askAs(F.supA, F.vpA, { kind: 'new', proposed_label: 'Uplights' });
  await asUser(F.delegateView);
  const refused = await db.query(
    `UPDATE public.event_schedule_suggestions SET status='declined' WHERE suggestion_id=$1 RETURNING suggestion_id`,
    [id],
  );
  assert.equal(refused.rows.length, 0, 'a View delegate answered a request');
  await asUser(F.coordEdit);
  const ok = await db.query(
    `UPDATE public.event_schedule_suggestions SET status='accepted' WHERE suggestion_id=$1 RETURNING suggestion_id`,
    [id],
  );
  assert.equal(ok.rows.length, 1, 'the coordinator could not answer the request they are told about');
});

test('the coordinator is told: the notifier’s own read names them, and the enum takes the type', async () => {
  // The exact reads `notifyScheduleRequest` makes (admin client), here as owner.
  await asOwner();
  const members = await db.query<{ user_id: string }>(
    `SELECT user_id FROM public.event_members WHERE event_id=$1 AND member_type='couple'`,
    [F.eventId],
  );
  const seats = await db.query<ScheduleRequestSeat>(
    `SELECT user_id, accepted_at::text AS accepted_at, removed_at::text AS removed_at, permissions_json
       FROM public.event_moderators
      WHERE event_id=$1 AND accepted_at IS NOT NULL AND removed_at IS NULL`,
    [F.eventId],
  );
  const ev = await db.query<{ event_date: string; event_end_date: string | null; event_date_precision: string }>(
    `SELECT event_date::text AS event_date, event_end_date::text AS event_end_date, event_date_precision
       FROM public.events WHERE event_id=$1`,
    [F.eventId],
  );
  const recipients = scheduleRequestRecipients({
    coupleUserIds: members.rows.map((m) => m.user_id),
    seats: seats.rows,
    window: {
      eventDate: ev.rows[0]!.event_date,
      eventEndDate: ev.rows[0]!.event_end_date,
      precision: ev.rows[0]!.event_date_precision,
    },
    now: new Date(),
  });
  assert.ok(recipients.includes(F.couple), 'the couple');
  assert.ok(recipients.includes(F.coordEdit), 'the coordinator with The Day = Edit');
  assert.ok(!recipients.includes(F.delegateView), 'not a View delegate');
  assert.ok(!recipients.includes(F.delegateOff), 'not an Off delegate');

  // 🔑 A type the database has never heard of is REFUSED, and emitNotification
  // only console.errors it — so prove the row lands for the coordinator.
  for (const uid of recipients) {
    await db.query(
      `INSERT INTO public.notifications (user_id, type, title, body, related_url)
       VALUES ($1,'schedule_change_requested','Supplier A asked to remove “Lights up” from the schedule','x',$2)`,
      [uid, `/dashboard/${F.eventId}/schedule`],
    );
  }
  const landed = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.notifications WHERE user_id=$1 AND type='schedule_change_requested'`,
    [F.coordEdit],
  );
  assert.equal(landed.rows[0]!.n, 1);
});
