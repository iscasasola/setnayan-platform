/**
 * 🗓 CHANGE THE SCHEDULE, ON THE DAY — asserted against the DATABASE through real `authenticated` sessions (migration
 * 20271308380805; owner 2026-11-04, SUPPLIER_PLANS_GIFTS_QUOTES_BUILD_NOTES · Hub + Couple lines).
 *
 *   1 · ONE answer to "may this phone ask to change the schedule" (`crew_schedule_door`): a Member of the coordinator's
 *       crew — 'ok'; a Helper, a phone with no pass — each its own word, and the request refuses with the same word. A
 *       request needs no edit right (the hosts decide), so an issuer with View only does not shut it.
 *   2 · A CREW CHANGE IS A REQUEST (owner 2026-11-05, DECISION_LOG "WHO CHANGES THE SCHEDULE…" (D)):
 *       `crew_request_schedule_move` files one open request per part with the shifted times and moves NOTHING; all or
 *       nothing; a part that has run is never asked about.
 *   3 · ON THE FLOOR (A)(C) — the coordinator holding The Day = Edit: a MOVE (the running-late shift) passes a
 *       supplier's change lock; a SKIP of a locked supplier's part is refused with the lock's calm line, un-skip puts a
 *       part back, and the couple's own UPDATE meets the same lock. A delegate with View only changes nothing.
 *   4 · "Done · next" passes over a skipped part.
 *   5 · Guests are told in the app — one notice per guest account, never the person who pressed, never a removed
 *       guest — and only the service role may tell them.
 *   6 · A CREW MEMBER MAY ASK TO SKIP (owner 2026-11-05, *"yes they can request"*; migration 20271331290778):
 *       `crew_request_schedule_skip` files one open 'skip' ask and skips NOTHING; asking again files nothing; a part that
 *       has started, or that a LOCKED supplier is on (the lock's own line), is never asked about; no other insert path
 *       writes a skip ask; a coordinator without The Day = Edit cannot answer the row on their own session (the floor
 *       answers on the service role after checking it is their crew's) while their own skip passes; the couple may.
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
  viewer: '',
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
const ask = (ids: string[], minutes: number) =>
  db.query<{ n: number }>(`SELECT public.crew_request_schedule_move($1, $2::uuid[], $3) AS n`, [F.event, ids, minutes]);
const shift = (ids: string[], minutes: number) =>
  db.query<{ n: number }>(`SELECT public.running_late_shift_schedule($1, $2::uuid[], $3) AS n`, [F.event, ids, minutes]);
const setRun = (id: string, state: string) =>
  db.query<{ block_id: string }>(`UPDATE public.event_schedule_blocks SET run_state = $2::public.schedule_run_state WHERE block_id = $1 RETURNING block_id`, [id, state]);
async function requests(): Promise<{ block_id: string; at: string; status: string; kind: string }[]> {
  const r = await db.query<{ block_id: string; at: string; status: string; kind: string }>(
    `SELECT block_id, to_char(proposed_start_at AT TIME ZONE 'UTC', 'HH24:MI') AS at, status, kind
       FROM public.event_schedule_suggestions WHERE event_id = $1 ORDER BY proposed_start_at`,
    [F.event],
  );
  return r.rows.map((x) => ({ ...x }));
}
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
  F.viewer = await mkUser('emcee-view@change.test');

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
        `INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services, verification_state, last_verified_at, public_visibility)
         VALUES ($1, $2, 'Manila', ARRAY[$3]::text[], 'verified', NOW(), 'verified')
         -- A vendor sign-up already made the shop row (on_auth_user_created): fill it in.
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name, location_city = EXCLUDED.location_city,
           services = EXCLUDED.services, verification_state = EXCLUDED.verification_state, last_verified_at = EXCLUDED.last_verified_at, public_visibility = EXCLUDED.public_visibility
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
  // An emcee the hosts lent The Day to as View only — may see, not change (owner 2026-11-05 (C)).
  await db.query(
    `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at)
     VALUES ($1, $2, 'wedding_planner_external', '{"areas":{"schedule":"view"}}'::jsonb, NOW())`,
    [F.event, F.viewer],
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

test('1 · one answer to "may this phone ask to change the schedule" — and the request refuses with the same word', async () => {
  assert.equal(ok(await asUser(F.crew, door)).rows[0]!.d, 'ok');
  assert.equal(ok(await asUser(F.helper, door)).rows[0]!.d, 'not_a_member');
  assert.equal(ok(await asUser(F.stranger, door)).rows[0]!.d, 'no_crew_pass');
  const was = await day();
  refused(await asUser(F.helper, () => ask([F.b], 10)), /not_a_member/, 'a Helper asked');
  refused(await asUser(F.stranger, () => ask([F.b], 10)), /no_crew_pass/, 'a phone with no pass asked');
  // A request needs no edit right — the hosts decide — so the issuer's View does not shut the door.
  await db.query(`UPDATE public.event_moderators SET permissions_json = '{"areas":{"schedule":"view"}}'::jsonb WHERE user_id = $1`, [F.owner]);
  assert.equal(ok(await asUser(F.crew, door)).rows[0]!.d, 'ok');
  await db.query(`UPDATE public.event_moderators SET permissions_json = '{"areas":{"schedule":"edit"}}'::jsonb WHERE user_id = $1`, [F.owner]);
  assert.deepEqual(await day(), was, 'a refused request moved the day');
  assert.deepEqual(await requests(), [], 'a refused request was filed');
  const anon = await db.query<{ a: boolean; b: boolean; old: boolean }>(
    `SELECT has_function_privilege('anon', 'public.crew_request_schedule_move(uuid, uuid[], integer)', 'EXECUTE') AS a,
            has_function_privilege('anon', 'public.crew_schedule_door(uuid)', 'EXECUTE') AS b,
            to_regprocedure('public.crew_change_schedule(uuid, text, uuid[], integer)') IS NOT NULL AS old`,
  );
  assert.deepEqual({ ...anon.rows[0] }, { a: false, b: false, old: false }, 'signed out reaches the crew door, or the crew can still write');
});

test('2 · a crew change is a REQUEST — one per part, the shifted times, nothing moves — all or nothing', async () => {
  const was = await day();
  const n = ok(await asUser(F.crew, () => ask([F.b, F.c, F.d], 10))).rows[0]!.n;
  assert.equal(n, 3);
  assert.deepEqual(await day(), was, 'a crew request moved the schedule');
  assert.deepEqual(
    (await requests()).map((r) => [r.block_id, r.at, r.status, r.kind]),
    [
      [F.b, '16:10', 'open', 'adjust'],
      [F.c, '18:10', 'open', 'adjust'],
      [F.d, '20:10', 'open', 'adjust'],
    ],
    'the request did not carry exactly the parts asked, at the shifted times, waiting for the hosts',
  );
  const who = await db.query<{ v: string; by: string; dir: string }>(
    `SELECT DISTINCT vendor_profile_id AS v, suggested_by_user_id AS by, direction AS dir FROM public.event_schedule_suggestions WHERE event_id = $1`,
    [F.event],
  );
  assert.deepEqual(who.rows.map((r) => ({ ...r })), [{ v: F.shop, by: F.crew, dir: 'to_host' }], 'filed as the wrong shop, person or side');
  // One part that is not on this event → nothing is asked, never half the move.
  refused(await asUser(F.crew, () => ask([F.b, '00000000-0000-0000-0000-000000000000'], 10)), /nothing_changed/, 'a request with a stranger part');
  refused(await asUser(F.crew, () => ask([F.b], 0)), /whole number of minutes/, 'a request of 0 minutes');
  // A part that has run is never asked about.
  await setRun(F.a, 'done');
  refused(await asUser(F.crew, () => ask([F.a], 10)), /nothing_changed/, 'a request to move a part that already ran');
  await setRun(F.a, 'upcoming');
  assert.equal((await requests()).length, 3, 'a refused request was filed anyway');
  await db.query(`DELETE FROM public.event_schedule_suggestions WHERE event_id = $1`, [F.event]);
});

test('3 · on the floor: a move passes a locked supplier, a skip meets the lock, and View changes nothing', async () => {
  ok(await asUser(F.supB, () => db.query(`SELECT public.supplier_mark_schedule($1, 'lock')`, [F.event])));
  // MOVE — the coordinator holding The Day = Edit, the shipped running-late shift (owner 2026-11-03 (2) · 2026-11-05 (A)).
  assert.equal(ok(await asUser(F.owner, () => shift([F.b, F.c, F.d], 10))).rows[0]!.n, 3);
  const moved = await day();
  assert.deepEqual([moved[F.b]!.at, moved[F.c]!.at, moved[F.d]!.at], ['16:10', '18:10', '20:10'], 'the locked Dinner did not move with the day');
  // A delegate lent The Day as View only (C): may see, not change — the shift and the skip both change nothing.
  refused(await asUser(F.viewer, () => shift([F.b], 10)), /nothing_changed/, 'a View-only delegate moved the schedule');
  const viewSkip = ok(await asUser(F.viewer, () => setRun(F.b, 'skipped')));
  assert.equal(viewSkip.rows.length, 0, 'a View-only delegate skipped a part');
  ok(await asUser(F.owner, () => shift([F.b, F.c, F.d], -10)));

  // SKIP — a locked supplier's part is refused with the lock's calm line, for the coordinator and the couple alike.
  const was = await day();
  refused(await asUser(F.owner, () => setRun(F.c, 'skipped')), /Supplier B isn't taking changes\. Send them a request instead\./, 'the coordinator skipped a locked supplier’s part');
  refused(await asUser(F.couple, () => setRun(F.c, 'skipped')), /Supplier B isn't taking changes/, 'the couple skipped a locked supplier’s part');
  assert.deepEqual(await day(), was, 'a refused skip skipped it anyway');
  assert.equal(ok(await asUser(F.owner, () => setRun(F.b, 'skipped'))).rows.length, 1);
  assert.equal((await day())[F.b]!.state, 'skipped');
  assert.equal(ok(await asUser(F.owner, () => setRun(F.b, 'upcoming'))).rows.length, 1);
  assert.equal((await day())[F.b]!.state, 'upcoming');
  ok(await asUser(F.supB, () => db.query(`SELECT public.supplier_mark_schedule($1, 'unlock')`, [F.event])));
});

test('4 · "Done · next" passes over a skipped part', async () => {
  ok(await asUser(F.owner, () => setRun(F.b, 'skipped')));
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

test('6 · a crew Member asks to skip — one ask, nothing skipped; never a started or locked part; only the crew door', async () => {
  const skipAsk = (id: string) => db.query<{ n: number }>(`SELECT public.crew_request_schedule_skip($1, $2) AS n`, [F.event, id]);
  const asks = async () =>
    (
      await db.query<{ block_id: string; status: string; v: string; by: string; dir: string }>(
        `SELECT block_id, status, vendor_profile_id AS v, suggested_by_user_id AS by, direction AS dir
           FROM public.event_schedule_suggestions WHERE event_id = $1 AND kind = 'skip' ORDER BY created_at`,
        [F.event],
      )
    ).rows.map((r) => ({ ...r }));
  // After test 4: Dance (F.d) has not started; Dinner (F.c) is live.
  const was = await day();
  assert.equal(ok(await asUser(F.crew, () => skipAsk(F.d))).rows[0]!.n, 1);
  assert.deepEqual(await day(), was, 'asking to skip skipped the part');
  assert.deepEqual(await asks(), [{ block_id: F.d, status: 'open', v: F.shop, by: F.crew, dir: 'to_host' }], 'the ask was filed wrong');
  assert.equal(ok(await asUser(F.crew, () => skipAsk(F.d))).rows[0]!.n, 0, 'asking again filed a second ask');
  assert.equal((await asks()).length, 1);

  refused(await asUser(F.helper, () => skipAsk(F.d)), /not_a_member/, 'a Helper asked to skip');
  refused(await asUser(F.stranger, () => skipAsk(F.d)), /no_crew_pass/, 'a phone with no pass asked to skip');
  refused(await asUser(F.crew, () => skipAsk(F.c)), /nothing_changed/, 'an ask to skip a part that has started');

  // A locked supplier's part: the lock's own line, and no ask.
  const toast = (
    await db.query<{ b: string }>(
      `INSERT INTO public.event_schedule_blocks (event_id, label, start_at, end_at, responsible_vendor_ids, is_public)
       VALUES ($1, 'Toast', '2099-12-18 21:00:00+00', '2099-12-18 21:30:00+00', ARRAY[$2]::uuid[], true) RETURNING block_id AS b`,
      [F.event, F.evB],
    )
  ).rows[0]!.b;
  ok(await asUser(F.supB, () => db.query(`SELECT public.supplier_mark_schedule($1, 'lock')`, [F.event])));
  refused(await asUser(F.crew, () => skipAsk(toast)), /Supplier B isn't taking changes\. Send them a request instead\./, 'an ask to skip a locked part');
  ok(await asUser(F.supB, () => db.query(`SELECT public.supplier_mark_schedule($1, 'unlock')`, [F.event])));
  assert.equal((await asks()).length, 1, 'a refused ask was filed anyway');

  // Only the crew door writes a skip ask — not the shop's own insert, not the couple's.
  for (const uid of [F.owner, F.couple]) {
    refused(
      await asUser(uid, () =>
        db.query(
          `INSERT INTO public.event_schedule_suggestions (event_id, block_id, vendor_profile_id, suggested_by_user_id, kind, note, status)
           VALUES ($1, $2, $3, $4, 'skip', 'skip it', 'open')`,
          [F.event, toast, F.shop, uid],
        ),
      ),
      /row-level security|violates/,
      'a skip ask was written outside the crew door',
    );
  }
  const anon = await db.query<{ a: boolean }>(
    `SELECT has_function_privilege('anon', 'public.crew_request_schedule_skip(uuid, uuid)', 'EXECUTE') AS a`,
  );
  assert.equal(anon.rows[0]!.a, false, 'signed out may ask to skip');

  // The answer: the coordinator's own session holds no UPDATE on the ask (the floor answers it on the service role, after
  // checking it is their crew's) — while the skip itself passes on their own session, exactly as the floor's Skip.
  const flip = () =>
    db.query<{ s: string }>(
      `UPDATE public.event_schedule_suggestions SET status = 'accepted', resolved_at = NOW() WHERE event_id = $1 AND kind = 'skip' RETURNING suggestion_id AS s`,
      [F.event],
    );
  // (A coordinator the hosts lent The Day = Edit may answer it like any Edit seat; one with View cannot.)
  await db.query(`UPDATE public.event_moderators SET permissions_json = '{"areas":{"schedule":"view"}}'::jsonb WHERE user_id = $1`, [F.owner]);
  assert.equal(ok(await asUser(F.owner, flip)).rows.length, 0, 'a coordinator with View answered the ask on their own session');
  await db.query(`UPDATE public.event_moderators SET permissions_json = '{"areas":{"schedule":"edit"}}'::jsonb WHERE user_id = $1`, [F.owner]);
  assert.equal(ok(await asUser(F.owner, () => setRun(F.d, 'skipped'))).rows.length, 1, 'the coordinator could not skip the part');
  assert.equal(ok(await asUser(F.couple, flip)).rows.length, 1, 'the couple could not answer the ask');
  assert.equal((await day())[F.d]!.state, 'skipped');
});
