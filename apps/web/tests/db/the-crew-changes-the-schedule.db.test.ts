/**
 * 🗓 CHANGE THE SCHEDULE, ON THE DAY — asserted against the DATABASE through real `authenticated` sessions (migration
 * 20271308380805; owner 2026-11-04, SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES · Hub + Couple lines).
 *
 *   1 · ONE answer to "may this phone change the schedule" (`crew_schedule_door`): a Member of the coordinator's crew
 *       whose QR issuer holds The Day = Edit — 'ok'; a Helper, a phone with no pass, an issuer with View only — each its
 *       own word. The write (`crew_change_schedule`) refuses with the same word.
 *   2 · MOVE — a pure shift of exactly the parts asked, all or nothing; it passes a supplier's change lock (the owner's
 *       running-late ruling, DECISION_LOG 2026-11-03 (2)).
 *   3 · SKIP — one part that has not started; a locked supplier's part is refused with the lock's calm line and the row
 *       is unchanged; un-skip puts it back. The couple's own UPDATE meets the same lock.
 *   4 · "Done · next" passes over a skipped part.
 *   5 · Guests are told in the app — one notice per guest account, never the person who pressed, never a removed
 *       guest — and only the service role may tell them.
 *
 * Every refusal asserts the rows are unchanged afterwards — a refusal that still wrote is not a refusal.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const F = {
  owner: '',
  crew: '',
  helper: '',
  stranger: '',
  couple: '',
  guest: '',
  gone: '',
  supB: '',
  shop: '',
  event: '',
  token: '',
  evB: '',
  a: '',
  b: '',
  c: '',
  d: '',
};

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T | { err: string }> {
  try {
    await setAuthUid(db, uid);
    await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
    await db.exec('SET ROLE authenticated');
    return await fn();
  } catch (e) {
    return { err: (e as Error).message };
  } finally {
    await reset();
  }
}
const ok = <T,>(r: T | { err: string }): T => {
  assert.ok(!(r && typeof r === 'object' && 'err' in (r as object)), JSON.stringify(r));
  return r as T;
};
const refused = (r: unknown, re: RegExp, why: string): void => {
  assert.ok(r && typeof r === 'object' && 'err' in (r as object), `${why} — it was allowed`);
  assert.match((r as { err: string }).err, re, why);
};
async function mkUser(email: string, accountType = 'customer'): Promise<string> {
  return (
    await db.query<{ id: string }>(
      `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
      [email, accountType],
    )
  ).rows[0]!.id;
}
async function day(): Promise<Record<string, { at: string; state: string }>> {
  const r = await db.query<{ block_id: string; at: string; state: string }>(
    `SELECT block_id, to_char(start_at AT TIME ZONE 'UTC', 'HH24:MI') AS at, run_state::text AS state
       FROM public.event_schedule_blocks WHERE event_id = $1`,
    [F.event],
  );
  return Object.fromEntries(r.rows.map((x) => [x.block_id, { at: x.at, state: x.state }]));
}
const change = (op: string, ids: string[], minutes: number | null = null) =>
  db.query<{ n: number }>(`SELECT public.crew_change_schedule($1, $2, $3::uuid[], $4) AS n`, [F.event, op, ids, minutes]);
const door = () => db.query<{ d: string }>(`SELECT public.crew_schedule_door($1) AS d`, [F.event]);

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.owner = await mkUser('coord-owner@change.test', 'vendor');
  F.crew = await mkUser('crew-member@change.test');
  F.helper = await mkUser('crew-helper@change.test');
  F.stranger = await mkUser('stranger@change.test');
  F.couple = await mkUser('couple@change.test');
  F.guest = await mkUser('guest@change.test');
  F.gone = await mkUser('removed-guest@change.test');
  F.supB = await mkUser('caterer@change.test', 'vendor');

  F.event = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date, slug) VALUES ('Ana and Ben', 'birthday', DATE '2099-12-18', 'ana-and-ben-change')
       RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.event, F.couple]);

  // The coordinator's shop, booked; its owner is the hosts' coordinator with The Day = Edit — and issues the crew QR.
  const mkShop = async (uid: string, name: string, services: string): Promise<string> =>
    (
      await db.query<{ v: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at)
         VALUES ($1, $2, 'Manila', ARRAY[$3]::text[], 'verified', NOW())
         -- A vendor sign-up already made the shop row (on_auth_user_created): fill it in.
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name, location_city = EXCLUDED.location_city,
           services = EXCLUDED.services, verification_state = EXCLUDED.verification_state, last_verified_at = EXCLUDED.last_verified_at
         RETURNING vendor_profile_id AS v`,
        [uid, name, services],
      )
    ).rows[0]!.v;
  F.shop = await mkShop(F.owner, 'Coord Co', 'coordinator');
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id) VALUES ($1, 'misc', 'Coord Co', 'contracted', $2)`,
    [F.event, F.shop],
  );
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external', '{"areas":{"schedule":"edit"}}'::jsonb, NOW())`,
    [F.event, F.owner],
  );
  // A caterer, booked, who will lock their part.
  const vpB = await mkShop(F.supB, 'Supplier B', 'catering');
  F.evB = (
    await db.query<{ v: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, total_cost_php, marketplace_vendor_id)
       VALUES ($1, 'catering', 'Supplier B', 'contracted', 100000, $2) RETURNING vendor_id AS v`,
      [F.event, vpB],
    )
  ).rows[0]!.v;

  const mkBlock = async (label: string, hhmm: string, tags: string[] = []): Promise<string> =>
    (
      await db.query<{ b: string }>(
        `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, responsible_vendor_ids, is_public)
         VALUES ($1, $2, ('2099-12-18 ' || $3 || ':00+00')::timestamptz, ('2099-12-18 ' || $3 || ':00+00')::timestamptz + interval '30 minutes', $4::uuid[], true)
         RETURNING block_id AS b`,
        [F.event, label, hhmm, tags],
      )
    ).rows[0]!.b;
  F.a = await mkBlock('Ceremony', '15:00');
  F.b = await mkBlock('Photos', '16:00');
  F.c = await mkBlock('Dinner', '18:00', [F.evB]);
  F.d = await mkBlock('Dance', '20:00');

  // The crew QR, a Member and a Helper, both allowed by the shop.
  F.token = ok(
    await asUser(F.owner, () =>
      db.query<{ token: string }>(`INSERT INTO public.vendor_crew_codes (vendor_profile_id, event_id) VALUES ($1, $2) RETURNING token`, [F.shop, F.event]),
    ),
  ).rows[0]!.token;
  for (const [uid, name, role] of [
    [F.crew, 'Kuya Ben', 'member'],
    [F.helper, 'Ate Lorna', 'helper'],
  ] as const) {
    ok(await asUser(uid, () => db.query(`SELECT public.crew_pass_request($1, $2)`, [F.token, name])));
    await db.query(`UPDATE public.vendor_crew_passes SET status = 'allowed', crew_role = $2 WHERE crew_user_id = $1`, [uid, role]);
  }

  // Two guest accounts: one on the list, one removed from it.
  for (const [uid, removed] of [
    [F.guest, false],
    [F.gone, true],
  ] as const) {
    const g = (
      await db.query<{ g: string }>(
        `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, deleted_at)
         VALUES ($1, 'Lorna', 'Buanhog', 'both', 'friends', CASE WHEN $2 THEN NOW() ELSE NULL END) RETURNING guest_id AS g`,
        [F.event, removed],
      )
    ).rows[0]!.g;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, guest_id) VALUES ($1, $2, 'guest', $3)`, [F.event, uid, g]);
  }
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('1 · one answer to "may this phone change the schedule" — and the write refuses with the same word', async () => {
  assert.equal(ok(await asUser(F.crew, door)).rows[0]!.d, 'ok');
  assert.equal(ok(await asUser(F.helper, door)).rows[0]!.d, 'not_a_member');
  assert.equal(ok(await asUser(F.stranger, door)).rows[0]!.d, 'no_crew_pass');
  const was = await day();
  refused(await asUser(F.helper, () => change('move', [F.b], 10)), /not_a_member/, 'a Helper moved the schedule');
  refused(await asUser(F.stranger, () => change('skip', [F.b])), /no_crew_pass/, 'a phone with no pass skipped a part');
  // The issuer holds View only → the crew holds nothing more than the issuer.
  await db.query(`UPDATE public.event_moderators SET permissions_json = '{"areas":{"schedule":"view"}}'::jsonb WHERE event_id = $1`, [F.event]);
  assert.equal(ok(await asUser(F.crew, door)).rows[0]!.d, 'schedule_not_shared');
  refused(await asUser(F.crew, () => change('move', [F.b], 10)), /schedule_not_shared/, 'the crew outran the issuer');
  await db.query(`UPDATE public.event_moderators SET permissions_json = '{"areas":{"schedule":"edit"}}'::jsonb WHERE event_id = $1`, [F.event]);
  assert.deepEqual(await day(), was, 'a refused change moved the day anyway');
  const anon = await db.query<{ a: boolean; b: boolean }>(
    `SELECT has_function_privilege('anon', 'public.crew_change_schedule(uuid, text, uuid[], integer)', 'EXECUTE') AS a,
            has_function_privilege('anon', 'public.crew_schedule_door(uuid)', 'EXECUTE') AS b`,
  );
  assert.deepEqual({ ...anon.rows[0] }, { a: false, b: false }, 'signed out reaches the crew door');
});

test('2 · a move shifts exactly the parts asked — all or nothing — and passes a locked supplier', async () => {
  ok(await asUser(F.supB, () => db.query(`SELECT public.supplier_mark_schedule($1, 'lock')`, [F.event])));
  const n = ok(await asUser(F.crew, () => change('move', [F.b, F.c, F.d], 10))).rows[0]!.n;
  assert.equal(n, 3);
  const after1 = await day();
  assert.deepEqual(
    [after1[F.a]!.at, after1[F.b]!.at, after1[F.c]!.at, after1[F.d]!.at],
    ['15:00', '16:10', '18:10', '20:10'],
    'the move did not carry exactly the parts after it (the locked Dinner moves too — the running-late ruling)',
  );
  // One part that is not on this event → nothing moves, never half the day.
  refused(
    await asUser(F.crew, () => change('move', [F.b, '00000000-0000-0000-0000-000000000000'], 10)),
    /nothing_changed/,
    'a move with a stranger part',
  );
  assert.deepEqual(await day(), after1, 'a refused move moved half the day');
  refused(await asUser(F.crew, () => change('move', [F.b], 0)), /whole number of minutes/, 'a move of 0 minutes');
  // Undo — the same rows back.
  ok(await asUser(F.crew, () => change('move', [F.b, F.c, F.d], -10)));
  assert.equal((await day())[F.c]!.at, '18:00');
});

test('3 · a skip meets the change lock — the crew and the couple alike — and un-skip puts a part back', async () => {
  const was = await day();
  refused(
    await asUser(F.crew, () => change('skip', [F.c])),
    /Supplier B isn't taking changes\. Send them a request instead\./,
    'the crew skipped a locked supplier’s part',
  );
  refused(
    await asUser(F.couple, () => db.query(`UPDATE public.event_schedule_blocks SET run_state = 'skipped' WHERE block_id = $1`, [F.c])),
    /Supplier B isn't taking changes/,
    'the couple skipped a locked supplier’s part',
  );
  assert.deepEqual(await day(), was, 'a refused skip skipped it anyway');

  assert.equal(ok(await asUser(F.crew, () => change('skip', [F.b]))).rows[0]!.n, 1);
  assert.equal((await day())[F.b]!.state, 'skipped');
  refused(await asUser(F.crew, () => change('skip', [F.b])), /nothing_changed/, 'a part skipped twice');
  refused(await asUser(F.crew, () => change('skip', [F.a, F.d])), /one part at a time/, 'two parts skipped at once');
  ok(await asUser(F.crew, () => change('unskip', [F.b])));
  assert.equal((await day())[F.b]!.state, 'upcoming');
  ok(await asUser(F.supB, () => db.query(`SELECT public.supplier_mark_schedule($1, 'unlock')`, [F.event])));
});

test('4 · "Done · next" passes over a skipped part', async () => {
  ok(await asUser(F.crew, () => change('skip', [F.b])));
  await db.query(`UPDATE public.event_schedule_blocks SET run_state = 'live', actual_start_at = NOW() WHERE block_id = $1`, [F.a]);
  ok(await asUser(F.couple, () => db.query(`SELECT public.advance_schedule_block($1)`, [F.a])));
  const now = await day();
  assert.equal(now[F.a]!.state, 'done');
  assert.equal(now[F.b]!.state, 'skipped', 'advancing woke a skipped part');
  assert.equal(now[F.c]!.state, 'live', 'advancing did not pass over the skipped part');
});

test('5 · guests are told in the app — once each, never the presser or a removed guest — by the service role only', async () => {
  refused(
    await asUser(F.crew, () => db.query(`SELECT public.tell_guests_the_schedule_changed($1, 'x', 'y', NULL)`, [F.event])),
    /permission denied/,
    'a browser told every guest',
  );
  const told = await db.query<{ n: number }>(
    `SELECT public.tell_guests_the_schedule_changed($1, 'Dinner is now at 6:30 PM', 'Open Details for the new times.', $2) AS n`,
    [F.event, F.crew],
  );
  assert.equal(told.rows[0]!.n, 1);
  const rows = await db.query<{ user_id: string; type: string; related_url: string | null }>(
    `SELECT user_id, type::text, related_url FROM public.notifications WHERE event_id = $1 AND title = 'Dinner is now at 6:30 PM'`,
    [F.event],
  );
  assert.deepEqual(
    rows.rows.map((r) => ({ ...r })),
    [{ user_id: F.guest, type: 'schedule_shifted', related_url: '/ana-and-ben-change?tab=details' }],
    'the wrong people were told, or told to the wrong place',
  );
});
