/**
 * THE GUEST LIST IS GRANTED, NEVER INHERITED — owner ruling 2026-08-24.
 *
 * Asked directly who may see an event's guest list, the owner said: "no. only
 * the owner of the event and coordinator (by request)." The host already sees
 * it. This file proves the second half in the only place that can hold it.
 *
 * ── THE TWO DEFECTS, BOTH MEASURED IN PRODUCTION FIRST ─────────────────────
 * 1 · `guests_moderator_read` admitted ANY accepted delegate and never asked
 *     which areas the host had granted — while its write twin has always asked
 *     exactly that. So declining the guest list line-by-line closed the SCREEN
 *     and not the DOOR: `public.guests` is served over PostgREST to a public
 *     anon key.
 * 2 · `moderator_area_level` fell back to the legacy `edit_all`/`checkout`
 *     flags for any area an `areas` map did not name. The one external planner
 *     live in prod was granted `{"areas":{"seat_plan":"view"}}` and resolved to
 *     view on guest_list · seat_plan · schedule · vendors · invitations ·
 *     mood_board — five areas nobody granted.
 *
 * 🚨 AND CLOSING ONE OF TWO DOORS CLOSES NOTHING. `guests` carries a SECOND
 * read policy, `event_member_can_read_guest`, and a trigger mints a
 * 'coordinator' member row for every accepted delegate. Policies are OR-ed.
 * The test named "the second door" below is the one that would have caught a
 * fix that looked complete and changed nothing.
 *
 * ⚖ WHAT MUST STILL WORK, asserted in the same file so a narrowing cannot be
 * mistaken for a blanket no: the couple always read their own list, a delegate
 * the host DID grant reads it, and a legacy row carrying no `areas` map at all
 * keeps the fallback it has always had — that is the couple's own host row.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: ReplayResult['db'];

let eventId: string;
let coupleUid: string;
let seatOnlyUid: string;
let guestListUid: string;
let legacyHostUid: string;

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}

async function asUser(uid: string): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec('SET ROLE authenticated');
}

/** The replay's owning role: no RLS, full rights. Used only to seed and to
 *  read back the ground truth a refused session must be measured against. */
async function asOwner(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function newUser(email: string): Promise<string> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email) VALUES ($1) RETURNING id`,
    [email],
  );
  return u.rows[0]!.id;
}

/** How many guest rows this session can actually read. */
async function guestRowsVisible(): Promise<number> {
  const r = await db.query(`SELECT guest_id FROM public.guests WHERE event_id = $1`, [eventId]);
  return r.rows.length;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await asOwner();

  coupleUid = await newUser('couple@guestlist.test');
  seatOnlyUid = await newUser('seatonly@guestlist.test');
  guestListUid = await newUser('granted@guestlist.test');
  legacyHostUid = await newUser('legacyhost@guestlist.test');

  const e = await db.query<{ event_id: string }>(
    `INSERT INTO public.events
       (display_name, event_type, event_date, event_date_precision, region)
     VALUES ('Guest list grant', 'birthday', '2027-03-03'::date, 'day', 'NCR')
     RETURNING event_id`,
  );
  eventId = e.rows[0]!.event_id;

  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type)
     VALUES ($1, $2, 'couple')`,
    [eventId, coupleUid],
  );

  // Three guests, so "refused" and "empty" can never be the same number.
  for (const name of ['Ana', 'Ben', 'Cely']) {
    await db.query(
      `INSERT INTO public.guests
         (event_id, first_name, last_name, display_name, side, group_category)
       VALUES ($1, $2, 'Reyes', $3, 'bride', 'family')`,
      [eventId, name, `${name} Reyes`],
    );
  }

  const seedDelegate = async (uid: string, perms: object): Promise<void> => {
    await db.query(
      `INSERT INTO public.event_moderators
         (event_id, user_id, role_subtype, permissions_json, accepted_at)
       VALUES ($1, $2, 'wedding_planner_external', $3::jsonb, now())`,
      [eventId, uid, JSON.stringify(perms)],
    );
  };

  // The shape live in production: one line granted, nothing else.
  await seedDelegate(seatOnlyUid, {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: { seat_plan: 'view' },
  });
  // The host said yes to this one.
  await seedDelegate(guestListUid, {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: { guest_list: 'view' },
  });
  // The legacy shape — no `areas` map at all. This is a couple's own host row.
  await seedDelegate(legacyHostUid, {
    edit_all: true,
    checkout: true,
    invite_hosts: true,
    remove_hosts: true,
  });
});

after(async () => {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null);
  await db?.close();
});

test('META: the impersonated session is really `authenticated`', async () => {
  await asUser(seatOnlyUid);
  const r = await db.query<{ cu: string }>(`SELECT current_user AS cu`);
  assert.equal(
    r.rows[0]!.cu,
    'authenticated',
    'SET ROLE did not take — every refusal below would be vacuous',
  );
});

test('META: the seeded guests are really there', async () => {
  await asOwner();
  assert.equal(await guestRowsVisible(), 3, 'without three rows, zero proves nothing');
});

test('a delegate granted only the seat plan cannot read the guest list', async () => {
  await asUser(seatOnlyUid);
  assert.equal(await guestRowsVisible(), 0);
});

test('the second door: being a coordinator MEMBER is not a grant either', async () => {
  // The trigger from 20271161203067 mints this row for every accepted
  // delegate, and `event_member_can_read_guest` used to admit it outright.
  await asOwner();
  const r = await db.query<{ member_type: string }>(
    `SELECT member_type::text AS member_type FROM public.event_members
      WHERE event_id = $1 AND user_id = $2`,
    [eventId, seatOnlyUid],
  );
  assert.equal(
    r.rows[0]?.member_type,
    'coordinator',
    'if this is not a coordinator member the test above proves less than it looks',
  );
  await asUser(seatOnlyUid);
  assert.equal(await guestRowsVisible(), 0, 'the member door must ask the same question');
});

test('a delegate the host DID grant reads the guest list', async () => {
  await asUser(guestListUid);
  assert.equal(await guestRowsVisible(), 3, 'the narrowing must not be a blanket no');
});

test('the couple always read their own guest list', async () => {
  await asUser(coupleUid);
  assert.equal(await guestRowsVisible(), 3);
});

test('the couple do not depend on the member door at all — FOUR policies, not two', async () => {
  // 🪤 FOUND BY A MUTATION THAT STAYED GREEN. Rewriting the couple branch of
  // `event_member_can_read_guest` to FALSE changed nothing: `couple_writes_guest`
  // is `FOR ALL` on `current_couple_event_ids()`, so it already carries the
  // couple's SELECT. The mutation landed (1 → 0 occurrences) and every test
  // passed — not because the suite was decorative, but because the couple's
  // access was never in that policy. Pinned here so the next reader does not
  // spend the same hour: `guests` has FOUR authenticated read paths, and a
  // change to one of them says nothing about the other two.
  const r = await db.query<{ policyname: string }>(
    `SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'guests'
        AND (cmd = 'SELECT' OR cmd = 'ALL')
      ORDER BY policyname`,
  );
  const names = r.rows.map((x) => x.policyname);
  // FOUR, not three — this assertion was written expecting three and failed,
  // which is the whole reason it is worth having. `guests_moderator_write` is
  // `FOR ALL`, so it confers SELECT as well as the writes it is named for. It
  // is gated on guest_list = 'edit', so it grants read only to a delegate the
  // host granted MORE than read — no hole, but a fourth door nobody would find
  // by reading the policy names.
  assert.deepEqual(names, [
    'couple_writes_guest',
    'event_member_can_read_guest',
    'guest_reads_own_row',
    'guests_moderator_read',
    'guests_moderator_write',
  ], 'a new read path on this table must be answered for, not discovered later');
});

test('a legacy row with no areas map keeps the fallback it has always had', async () => {
  // Removing this would lock a groom out of his own wedding — the couple's own
  // host rows carry no `areas` key.
  await asUser(legacyHostUid);
  assert.equal(await guestRowsVisible(), 3);
});

test('the resolver hands out only what the areas map names', async () => {
  await asUser(seatOnlyUid);
  const r = await db.query<{ area: string; level: string | null }>(
    `SELECT a AS area, public.moderator_area_level($1, a) AS level
       FROM unnest(ARRAY['guest_list','seat_plan','schedule','vendors',
                         'invitations','mood_board','budget','photos']) a`,
    [eventId],
  );
  const levels = Object.fromEntries(r.rows.map((x) => [x.area, x.level]));
  assert.equal(levels.seat_plan, 'view', 'the one line the host granted');
  for (const area of ['guest_list', 'schedule', 'vendors', 'invitations', 'mood_board', 'budget', 'photos']) {
    assert.equal(levels[area], null, `${area} was never granted and must resolve to nothing`);
  }
});

test('the TS mirror and the SQL resolver agree on the live shape', async () => {
  const { resolveAreaLevel } = await import('../../lib/delegate-areas');
  await asUser(seatOnlyUid);
  const perms = {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: { seat_plan: 'view' as const },
  };
  for (const area of ['guest_list', 'seat_plan', 'schedule', 'vendors', 'invitations', 'budget', 'photos'] as const) {
    const sql = await db.query<{ level: string | null }>(
      `SELECT public.moderator_area_level($1, $2) AS level`,
      [eventId, area],
    );
    assert.equal(
      resolveAreaLevel(perms, area),
      sql.rows[0]!.level,
      `${area}: the screen would tell this delegate something the database refuses`,
    );
  }
});
