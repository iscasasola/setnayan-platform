/**
 * 🧑‍💼 ONE CLIENT, ONE ACCOUNT MANAGER · A PAUSED SEAT IS OUT OF THE SHOP (supplier roles d–h, the #8013 drawing;
 * migration `supplier_roles_one_client_one_account_manager`), proved against the replayed schema:
 *   · a paused seat (deactivated_at set — a smaller plan, owner 21 Nov, overturning ruling 5683) leaves
 *     current_vendor_ids() AND agent_assigned_service_ids(); clearing it brings the seat straight back;
 *   · who handles a client is NOT readable by the couple or anyone signed in — the server writes and reads it;
 *   · the adjusted split: a shop's members read their own shop's cuts, never another shop's, and nobody signed in
 *     writes one directly; a cut must be two capital letters and end after it starts.
 * Every case asserts a VALUE, never only a row count.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;
const F = {} as Record<'am' | 'amSeat' | 'card' | 'other' | 'otherShop' | 'owner' | 'shop', string>;

async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function as<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  try {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
    await db.exec('SET ROLE authenticated');
    return await fn();
  } finally {
    await reset();
  }
}
async function mkUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}
async function shopOf(user: string, name: string): Promise<string> {
  return (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [user, name],
    )
  ).rows[0]!.v;
}
const myShops = async (uid: string) =>
  as(uid, async () => (await db.query<{ v: string }>(`SELECT public.current_vendor_ids('viewer') AS v`)).rows.map((r) => r.v));
const myCards = async (uid: string) =>
  as(uid, async () => (await db.query<{ s: string }>(`SELECT public.agent_assigned_service_ids() AS s`)).rows.map((r) => r.s));

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  for (const k of ['owner', 'am', 'other'] as const) F[k] = await mkUser(`${k}@one-client.test`);
  F.shop = await shopOf(F.owner, 'Blooms & Co.');
  F.otherShop = await shopOf(F.other, 'Elsewhere');
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
    [F.shop, F.owner],
  );
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
    [F.otherShop, F.other],
  );
  F.amSeat = (
    await db.query<{ m: string }>(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role, duty)
       VALUES ($1, $2, 'viewer', 'account_manager') RETURNING vendor_team_member_id AS m`,
      [F.shop, F.am],
    )
  ).rows[0]!.m;
  F.card = await insertLiveCard(db, { vendor_profile_id: F.shop, category: 'photographer', title: 'Wedding Styling', starting_price_php: 30000 });
  await db.query(`INSERT INTO public.vendor_service_agents (vendor_team_member_id, vendor_service_id) VALUES ($1, $2)`, [F.amSeat, F.card]);
});
after(async () => {
  await db?.close();
});

test('an active Account Manager is in the shop and holds their card', async () => {
  assert.ok((await myShops(F.am)).includes(F.shop), 'the Account Manager is not in the shop');
  assert.deepEqual(await myCards(F.am), [F.card]);
});

test('a paused seat is out of the shop and holds no card; nothing is deleted', async () => {
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now() WHERE vendor_team_member_id = $1`, [F.amSeat]);
  // (The vendor sign-up gives every vendor account its OWN shop too — that one is untouched.)
  assert.equal((await myShops(F.am)).includes(F.shop), false, 'a paused seat still reaches the shop');
  assert.deepEqual(await myCards(F.am), []);
  const kept = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.vendor_service_agents WHERE vendor_team_member_id = $1`,
    [F.amSeat],
  );
  assert.equal(kept.rows[0]!.n, 1, 'the card assignment is kept for the day the seat returns');
});

test('clearing the pause brings the seat straight back', async () => {
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NULL WHERE vendor_team_member_id = $1`, [F.amSeat]);
  assert.ok((await myShops(F.am)).includes(F.shop), 'the returned seat is not back in the shop');
  assert.deepEqual(await myCards(F.am), [F.card]);
});

test('who handles a client is not readable by anyone signed in', async () => {
  for (const col of ['handled_by_member_id', 'handled_by_set_at', 'hand_over_member_id', 'covering_member_id']) {
    for (const role of ['anon', 'authenticated']) {
      const r = await db.query<{ ok: boolean }>(`SELECT has_column_privilege($1, 'public.chat_threads', $2, 'SELECT') AS ok`, [role, col]);
      assert.equal(r.rows[0]!.ok, false, `${role} can read chat_threads.${col}`);
    }
  }
});

test('the adjusted split: own shop reads its cuts, another shop reads none, nobody signed in writes one', async () => {
  await db.query(
    `INSERT INTO public.vendor_inquiry_split_cuts (vendor_profile_id, vendor_service_id, event_type, vendor_team_member_id, from_prefix, to_prefix)
     VALUES ($1, $2, 'wedding', $3, 'AA', 'MF')`,
    [F.shop, F.card, F.amSeat],
  );
  const own = await as(F.am, async () =>
    (await db.query<{ f: string; t: string }>(`SELECT from_prefix AS f, to_prefix AS t FROM public.vendor_inquiry_split_cuts`)).rows,
  );
  assert.deepEqual(own, [{ f: 'AA', t: 'MF' }]);
  const theirs = await as(F.other, async () =>
    (await db.query(`SELECT 1 FROM public.vendor_inquiry_split_cuts`)).rows.length,
  );
  assert.equal(theirs, 0);
  let err = '';
  await as(F.owner, async () => {
    try {
      await db.query(
        `INSERT INTO public.vendor_inquiry_split_cuts (vendor_profile_id, vendor_service_id, vendor_team_member_id, from_prefix)
         VALUES ($1, $2, $3, 'AA')`,
        [F.shop, F.card, F.amSeat],
      );
    } catch (e) {
      err = String(e);
    }
  });
  assert.match(err, /permission denied/);
});

test('a cut is two capital letters and ends after it starts', async () => {
  for (const [from, to] of [['A', null], ['ma', null], ['MF', 'AA'], ['MF', 'MF']] as const) {
    let err = '';
    try {
      await db.query(
        `INSERT INTO public.vendor_inquiry_split_cuts (vendor_profile_id, vendor_service_id, event_type, vendor_team_member_id, from_prefix, to_prefix)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [F.shop, F.card, `t-${from}-${to}`, F.amSeat, from, to],
      );
    } catch (e) {
      err = String(e);
    }
    assert.match(err, /check constraint/, `${from}→${to} was accepted`);
  }
});

test('only Setnayan sets who handles a client — the shop itself cannot write it from a browser; the server can', async () => {
  const eventId = (
    await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Reyes & Santos', 'birthday') RETURNING event_id AS e`)
  ).rows[0]!.e;
  const thread = (
    await db.query<{ t: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_status) VALUES ($1, $2, 'accepted') RETURNING thread_id AS t`,
      [eventId, F.shop],
    )
  ).rows[0]!.t;
  let err = '';
  await as(F.owner, async () => {
    try {
      await db.query(`UPDATE public.chat_threads SET handled_by_member_id = $1 WHERE thread_id = $2`, [F.amSeat, thread]);
    } catch (e) {
      err = String(e);
    }
  });
  assert.match(err, /CHAT_THREAD_SIDE_REFUSED: who handles a client/);
  // The server (service role / direct) sets it.
  await db.query(`UPDATE public.chat_threads SET handled_by_member_id = $1, handled_by_set_at = now() WHERE thread_id = $2`, [F.amSeat, thread]);
  const r = await db.query<{ m: string }>(`SELECT handled_by_member_id AS m FROM public.chat_threads WHERE thread_id = $1`, [thread]);
  assert.equal(r.rows[0]!.m, F.amSeat);
});

test('the fair-split counts: Setnayan only, names folded as written, one per client', async () => {
  const mk = async (last: string, type: string) => {
    const u = await mkUser(`${last.replace(/\W/g, '').toLowerCase()}-${type}@counts.test`);
    await db.query(`UPDATE public.users SET last_name = $1 WHERE user_id = $2`, [last, u]);
    const e = (await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('x', $1) RETURNING event_id AS e`, [type])).rows[0]!.e;
    await db.query(`INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3)`, [e, F.otherShop, u]);
  };
  await mk('Ñañez', 'birthday');
  await mk('Dela Cruz', 'birthday');
  await mk('O', 'birthday');
  await mk('Santos', 'celebration');
  const counts = async (type: string | null) =>
    Object.fromEntries(
      (await db.query<{ prefix: string; n: number }>(`SELECT prefix, n FROM public.inquiry_last_name_prefix_counts(NULL, $1)`, [type])).rows.map(
        (r) => [r.prefix, Number(r.n)],
      ),
    );
  const bday = await counts('birthday');
  assert.equal(bday.NA, 1); // Ñañez → NA (accent folded)
  assert.equal(bday.DE, 1); // Dela Cruz filed as written, under D (controller row 5)
  assert.equal(bday.OA, 1); // a one-letter name pads
  assert.equal(bday.SA, undefined); // another event type is not counted
  let err = '';
  await as(F.owner, async () => {
    try {
      await db.query(`SELECT * FROM public.inquiry_last_name_prefix_counts(NULL, 'birthday')`);
    } catch (e) {
      err = String(e);
    }
  });
  assert.match(err, /permission denied/);
});

test('a seat the plan paused: a browser cannot set the mark or bring the seat back; the server can', async () => {
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = now(), paused_by_plan_at = now() WHERE vendor_team_member_id = $1`, [F.amSeat]);
  const refused = async (sql: string) => {
    let err = '';
    await as(F.owner, async () => {
      try {
        await db.query(sql, [F.amSeat]);
      } catch (e) {
        err = String(e);
      }
    });
    return err;
  };
  assert.match(await refused(`UPDATE public.vendor_team_members SET deactivated_at = NULL WHERE vendor_team_member_id = $1`), /TEAM_SEAT_PAUSE_REFUSED: this seat comes back/);
  assert.match(await refused(`UPDATE public.vendor_team_members SET paused_by_plan_at = NULL WHERE vendor_team_member_id = $1`), /TEAM_SEAT_PAUSE_REFUSED: a plan pause/);
  const still = await db.query<{ d: string | null }>(`SELECT deactivated_at AS d FROM public.vendor_team_members WHERE vendor_team_member_id = $1`, [F.amSeat]);
  assert.notEqual(still.rows[0]!.d, null);
  await db.query(`UPDATE public.vendor_team_members SET deactivated_at = NULL, paused_by_plan_at = NULL WHERE vendor_team_member_id = $1`, [F.amSeat]);
  assert.deepEqual(await myShops(F.am).then((s) => s.includes(F.shop)), true);
});
