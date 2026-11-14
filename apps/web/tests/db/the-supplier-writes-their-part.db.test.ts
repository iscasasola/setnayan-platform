/**
 * THE SUPPLIER WRITES THEIR PART OF THE SCHEDULE — asserted against the DATABASE, through real sessions
 * (migration 20271300619930; owner 2026-11-01, DECISION_LOG "SUPPLIERS GIVE THEIR PART FROM THEIR SCHEDULE VIEW";
 * corpus SCHEDULE_CHAPTERS_BUILD_PLAN_2026-11-01.md §3).
 *
 *   1 · + My moment goes ONLY into a chapter the supplier is linked to (Where), on this event — never into somebody
 *       else's chapter, never under a moment. Crew rides only an add or an edit of their OWN moment; on anybody
 *       else's moment a supplier still has words only. (The add/edit/delete own-items rule itself is held by
 *       a-supplier-asks-only-about-its-own-items.db.test.ts.)
 *   2 · Take back: only the org that asked, only while it waits, and it changes the status and nothing else.
 *   3 · Seen and Confirm my times are RECORDED — written by the booked supplier through supplier_mark_schedule, read
 *       back by the couple; Confirm only in the final week; nobody writes the table directly.
 *   4 · Auto-agree starts Off (ruled 1 Nov) for every event.
 *
 * Every refusal asserts the row is NOT there afterwards — a refusal that still wrote is not a refusal.
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
  soonEventId: '',
  couple: '',
  supA: '',
  supB: '',
  outsider: '',
  vpA: '',
  vpB: '',
  vpOut: '',
  evA: '',
  evB: '',
  chapterA: '',
  chapterB: '',
  momentA: '',
  momentB: '',
};

type Ask = {
  block_id?: string | null;
  kind: string;
  parent?: string | null;
  crew?: string[] | null;
  proposed_label?: string | null;
  proposed_start_at?: string | null;
  note?: string;
};

async function askAs(uid: string, vp: string, a: Ask): Promise<string> {
  await asUser(uid);
  const r = await db.query<{ suggestion_id: string }>(
    `INSERT INTO public.event_schedule_suggestions
       (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, proposed_parent_block_id, proposed_crew,
        proposed_label, proposed_start_at, note, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,'open') RETURNING suggestion_id`,
    [
      F.eventId,
      a.block_id ?? null,
      vp,
      uid,
      a.kind,
      a.parent ?? null,
      a.crew ?? null,
      a.proposed_label ?? null,
      a.proposed_start_at ?? null,
      a.note ?? 'please',
    ],
  );
  return r.rows[0]!.suggestion_id;
}

async function countAsks(): Promise<number> {
  await asOwner();
  return (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.event_schedule_suggestions`)).rows[0]!.n;
}

async function assertRefused(uid: string, vp: string, a: Ask, why: string): Promise<void> {
  const before = await countAsks();
  await assert.rejects(() => askAs(uid, vp, a), /row-level security|violates/i, why);
  assert.equal(await countAsks(), before, `${why} — refused, but a row was written anyway`);
}

async function statusOf(id: string): Promise<string> {
  await asOwner();
  return (
    await db.query<{ status: string }>(`SELECT status FROM public.event_schedule_suggestions WHERE suggestion_id=$1`, [id])
  ).rows[0]!.status;
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
  const mkEvent = async (name: string, dateSql: string): Promise<string> =>
    (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting, event_date, event_date_precision)
         VALUES ($1,'wedding','catholic','banquet_hall', ${dateSql}, 'day') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;

  F.couple = await mkUser('couple@part.test');
  F.eventId = await mkEvent('Far Off', `DATE '2099-12-12'`);
  // Three days from today on the Manila calendar — inside the final week.
  F.soonEventId = await mkEvent('Soon', `((NOW() AT TIME ZONE 'Asia/Manila')::date + 3)`);
  for (const ev of [F.eventId, F.soonEventId]) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [ev, F.couple]);
  }

  const mkSupplier = async (key: string, events: string[]): Promise<{ uid: string; vp: string; ev: string }> => {
    const uid = await mkUser(`sup${key}@part.test`);
    const vp = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles
           (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1,$2,'Manila',ARRAY['catering']::text[],'verified', NOW(), 'verified') RETURNING vendor_profile_id`,
        [uid, `Supplier ${key}`],
      )
    ).rows[0]!.vendor_profile_id;
    let mine = '';
    for (const ev of events) {
      const row = await db.query<{ vendor_id: string }>(
        `INSERT INTO public.event_vendors
           (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
         VALUES ($1,'catering',$2,'contracted',100000,$3) RETURNING vendor_id`,
        [ev, `Supplier ${key}`, vp],
      );
      if (ev === F.eventId) mine = row.rows[0]!.vendor_id;
    }
    return { uid, vp, ev: mine };
  };
  const a = await mkSupplier('A', [F.eventId, F.soonEventId]);
  const b = await mkSupplier('B', [F.eventId]);
  const out = await mkSupplier('Out', []);
  F.supA = a.uid;
  F.vpA = a.vp;
  F.evA = a.ev;
  F.supB = b.uid;
  F.vpB = b.vp;
  F.evB = b.ev;
  F.outsider = out.uid;
  F.vpOut = out.vp;

  const mkBlock = async (label: string, tags: string[], parent: string | null): Promise<string> =>
    (
      await db.query<{ block_id: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, responsible_vendor_ids, parent_block_id)
         VALUES ($1,$2, TIMESTAMPTZ '2099-12-12 15:00:00+00', $3::uuid[], $4) RETURNING block_id`,
        [F.eventId, label, tags, parent],
      )
    ).rows[0]!.block_id;
  // Where = chapters (#7156): A is linked to the Ceremony, B to the Reception.
  F.chapterA = await mkBlock('Ceremony', [F.evA], null);
  F.chapterB = await mkBlock('Reception', [F.evB], null);
  F.momentA = await mkBlock('Lights up', [F.evA], F.chapterA);
  F.momentB = await mkBlock('First dance', [F.evB], F.chapterB);
});

after(async () => {
  await db?.close?.();
});

// ─── 1 · + My moment, into their own chapter only ────────────────────────────────────────────────────────────────

test('+ My moment lands as a request inside a chapter the supplier is linked to, with its crew', async () => {
  const id = await askAs(F.supA, F.vpA, {
    kind: 'new',
    parent: F.chapterA,
    crew: ['Team A', 'Second shooter'],
    proposed_label: 'Bride prep coverage',
  });
  await asOwner();
  const r = await db.query<{ status: string; proposed_parent_block_id: string; proposed_crew: string[]; auto_agreed: boolean }>(
    `SELECT status, proposed_parent_block_id, proposed_crew, auto_agreed FROM public.event_schedule_suggestions WHERE suggestion_id=$1`,
    [id],
  );
  assert.deepEqual(r.rows[0], {
    status: 'open',
    proposed_parent_block_id: F.chapterA,
    proposed_crew: ['Team A', 'Second shooter'],
    auto_agreed: false,
  });
});

test("a supplier cannot add a moment into a chapter that isn't theirs, or under a moment", async () => {
  await assertRefused(F.supA, F.vpA, { kind: 'new', parent: F.chapterB, proposed_label: 'Sneak in' }, "an add into B's chapter");
  await assertRefused(F.supA, F.vpA, { kind: 'new', parent: F.momentA, proposed_label: 'Nested' }, 'an add under a moment');
  // A supplier not booked at all cannot ask anything.
  await assertRefused(F.outsider, F.vpOut, { kind: 'new', parent: F.chapterA, proposed_label: 'Hello' }, 'a supplier not booked');
});

test("a supplier cannot edit a moment that isn't theirs — crew is an edit, and an add says it is one", async () => {
  // Words only on somebody else's moment: crew is a change, so it is refused there…
  await assertRefused(F.supA, F.vpA, { block_id: F.momentB, kind: 'adjust', crew: ['Team A'] }, "crew on B's moment");
  // …and a plain suggestion in words still goes.
  await askAs(F.supA, F.vpA, { block_id: F.momentB, kind: 'adjust', note: 'Could the first dance wait 5 minutes?' });
  // On their own moment, crew rides the edit.
  await askAs(F.supA, F.vpA, { block_id: F.momentA, kind: 'adjust', crew: ['Team B'] });
  // A request may not pose as an auto-agreed one.
  await asUser(F.supA);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_schedule_suggestions
           (event_id, vendor_profile_id, suggested_by_user_id, kind, proposed_label, note, status, auto_agreed)
         VALUES ($1,$2,$3,'new','x','x','open',true)`,
        [F.eventId, F.vpA, F.supA],
      ),
    /row-level security/i,
  );
});

test('only an add names a chapter, and a crew name is a real name', async () => {
  await asOwner();
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_schedule_suggestions
           (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, proposed_parent_block_id, note)
         VALUES ($1,$2,$3,$4,'adjust',$5,'x')`,
        [F.eventId, F.momentA, F.vpA, F.supA, F.chapterA],
      ),
    /check constraint/i,
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_schedule_suggestions
           (event_id, vendor_profile_id, suggested_by_user_id, kind, proposed_crew, note)
         VALUES ($1,$2,$3,'new',ARRAY['  ']::text[],'x')`,
        [F.eventId, F.vpA, F.supA],
      ),
    /check constraint/i,
  );
});

// ─── 2 · Take back ───────────────────────────────────────────────────────────────────────────────────────────────

test('Take back withdraws the supplier’s own waiting request — and only that', async () => {
  const mine = await askAs(F.supA, F.vpA, { kind: 'new', parent: F.chapterA, proposed_label: 'Detail shots' });
  const theirs = await askAs(F.supB, F.vpB, { kind: 'new', parent: F.chapterB, proposed_label: 'Band check' });

  // A cannot take back B's request.
  await asUser(F.supA);
  const refused = await db.query<{ ok: boolean }>(`SELECT public.withdraw_schedule_request($1) AS ok`, [theirs]);
  assert.equal(refused.rows[0]!.ok, false);
  assert.equal(await statusOf(theirs), 'open', "A took back B's request");

  await asUser(F.supA);
  const ok = await db.query<{ ok: boolean }>(`SELECT public.withdraw_schedule_request($1) AS ok`, [mine]);
  assert.equal(ok.rows[0]!.ok, true);
  assert.equal(await statusOf(mine), 'withdrawn');

  // A decided request cannot be taken back.
  await asUser(F.couple);
  await db.query(`UPDATE public.event_schedule_suggestions SET status='accepted' WHERE suggestion_id=$1`, [theirs]);
  await asUser(F.supB);
  const late = await db.query<{ ok: boolean }>(`SELECT public.withdraw_schedule_request($1) AS ok`, [theirs]);
  assert.equal(late.rows[0]!.ok, false);
  assert.equal(await statusOf(theirs), 'accepted');

  // A supplier still has no UPDATE door of its own on the table.
  await asUser(F.supA);
  const direct = await db.query(
    `UPDATE public.event_schedule_suggestions SET status='accepted' WHERE suggestion_id=$1 RETURNING suggestion_id`,
    [mine],
  );
  assert.equal(direct.rows.length, 0, 'a supplier approved its own request');
});

// ─── 3 · Seen and Confirm my times are recorded ──────────────────────────────────────────────────────────────────

test('Seen is recorded for the booked supplier and the couple reads it', async () => {
  await asUser(F.supA);
  const at = await db.query<{ t: string }>(`SELECT public.supplier_mark_schedule($1,'seen')::text AS t`, [F.eventId]);
  assert.ok(at.rows[0]!.t);

  await asUser(F.couple);
  const seen = await db.query<{ vendor_profile_id: string; seen: boolean; confirmed: boolean }>(
    `SELECT vendor_profile_id, seen_at IS NOT NULL AS seen, confirmed_at IS NOT NULL AS confirmed
       FROM public.event_supplier_schedule_marks WHERE event_id=$1`,
    [F.eventId],
  );
  assert.deepEqual(seen.rows, [{ vendor_profile_id: F.vpA, seen: true, confirmed: false }]);

  // B sees nothing of A's marks.
  await asUser(F.supB);
  const other = await db.query(`SELECT 1 FROM public.event_supplier_schedule_marks WHERE vendor_profile_id=$1`, [F.vpA]);
  assert.equal(other.rows.length, 0);
});

test('Confirm my times is refused outside the final week, recorded inside it', async () => {
  await asUser(F.supA);
  await assert.rejects(
    () => db.query(`SELECT public.supplier_mark_schedule($1,'confirm')`, [F.eventId]),
    /one week before/i,
    'a confirm months before the day',
  );
  await asOwner();
  const none = await db.query(
    `SELECT 1 FROM public.event_supplier_schedule_marks WHERE event_id=$1 AND confirmed_at IS NOT NULL`,
    [F.eventId],
  );
  assert.equal(none.rows.length, 0, 'a refused confirm still wrote');

  await asUser(F.supA);
  await db.query(`SELECT public.supplier_mark_schedule($1,'confirm')`, [F.soonEventId]);
  await asUser(F.couple);
  const conf = await db.query<{ vendor_profile_id: string; confirmed: boolean; seen: boolean }>(
    `SELECT vendor_profile_id, confirmed_at IS NOT NULL AS confirmed, seen_at IS NOT NULL AS seen
       FROM public.event_supplier_schedule_marks WHERE event_id=$1`,
    [F.soonEventId],
  );
  assert.deepEqual(conf.rows, [{ vendor_profile_id: F.vpA, confirmed: true, seen: true }]);
});

test('only a booked supplier marks, and nobody writes the marks table directly', async () => {
  await asUser(F.outsider);
  await assert.rejects(() => db.query(`SELECT public.supplier_mark_schedule($1,'seen')`, [F.eventId]), /booked/i);
  // B is booked on the far event only — not on the soon one.
  await asUser(F.supB);
  await assert.rejects(() => db.query(`SELECT public.supplier_mark_schedule($1,'confirm')`, [F.soonEventId]), /booked/i);
  await asUser(F.supA);
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.event_supplier_schedule_marks (event_id, vendor_profile_id, confirmed_at) VALUES ($1,$2,NOW())`,
        [F.eventId, F.vpA],
      ),
    /permission denied/i,
  );
  await asOwner();
  const g = await db.query<{ ok: boolean }>(`SELECT has_table_privilege('anon','public.event_supplier_schedule_marks','SELECT') AS ok`);
  assert.equal(g.rows[0]!.ok, false);
});

// ─── 4 · Auto-agree starts Off ───────────────────────────────────────────────────────────────────────────────────

test('Auto-agree starts Off for every event (ruled 1 Nov)', async () => {
  await asOwner();
  const r = await db.query<{ on: boolean }>(
    `SELECT bool_or(supplier_requests_auto_agree) AS on FROM public.events WHERE event_id IN ($1,$2)`,
    [F.eventId, F.soonEventId],
  );
  assert.equal(r.rows[0]!.on, false);
});
