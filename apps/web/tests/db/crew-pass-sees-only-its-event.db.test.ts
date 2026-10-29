/**
 * A CREW PASS SEES ONLY ITS EVENT — measured as REAL `authenticated` sessions (SET ROLE + JWT claims), never the
 * replay's superuser. Migration `…_crew_join_the_suppliers_event_hub_by_qr.sql`; owner 2026-10-29, DECISION_LOG
 * "CREW JOIN THE SUPPLIER'S EVENT HUB BY QR — AND SEE ONLY THE EVENT HUB":
 *
 *   1. the shop's admin makes ONE crew QR for an event the shop is booked on — never a stranger's, never an event with
 *      no date — and its end is DERIVED (the midnight after the event's last day, Manila), whatever the client sends;
 *   2. a phone that scans it WAITS: it holds a pass that opens nothing until the admin Allows it, and it cannot Allow
 *      itself, write a pass directly, or read the crew QR;
 *   3. 🔒 AN ALLOWED CREW MEMBER READS NOTHING ELSE — not the event, its schedule, its guests, the shop's grants, other
 *      passes, another event's pass or scanner; no day-of grant, booking or membership appears for them;
 *   4. the pass ENDS after the event, and a removed phone stays removed;
 *   5. a pass cannot be moved to another shop, event or person;
 *   6. another shop's admin cannot see or decide this shop's crew;
 *   7. `moderator_area_level_of` (the crew scanner's question, asked of the QR's issuer) agrees with the shipped
 *      `moderator_area_level` on every branch;
 *   8. signed out (anon) reaches neither table.
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
  admin: '',
  crew: '',
  otherShopOwner: '',
  shop: '',
  otherShop: '',
  event: '',
  stranger: '',
  undated: '',
  token: '',
  passId: '',
};

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T | { err: string }> {
  try {
    await setAuthUid(db, uid);
    await setRole('authenticated');
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
async function mkUser(email: string, accountType: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
    [email, accountType],
  );
  return r.rows[0]!.id;
}
async function mkShop(owner: string, name: string): Promise<string> {
  const v = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [owner, name],
    )
  ).rows[0]!.v;
  // A booked card needs a verified shop (enforce_booking_requires_verified_vendor).
  await db.query(
    `UPDATE public.vendor_profiles SET verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at = NOW(), public_visibility = 'verified'::public.vendor_public_visibility,
            services = ARRAY['coordinator']::text[]
      WHERE vendor_profile_id = $1`,
    [v],
  );
  return v;
}
async function mkEvent(name: string, date: string | null): Promise<string> {
  return (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', $2::date) RETURNING event_id AS e`,
      [name, date],
    )
  ).rows[0]!.e;
}
async function book(event: string, shop: string): Promise<void> {
  await db.query(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
     VALUES ($1, 'misc', 'Crew Test Shop', 'contracted', $2)`,
    [event, shop],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.owner = await mkUser('crew-owner@crew.test', 'vendor');
  F.admin = await mkUser('crew-admin@crew.test', 'vendor');
  F.crew = await mkUser('crew-phone@crew.test', 'couple');
  F.otherShopOwner = await mkUser('crew-other@crew.test', 'vendor');
  F.shop = await mkShop(F.owner, 'Crew Test Shop');
  F.otherShop = await mkShop(F.otherShopOwner, 'Another Shop');
  await db.query(`INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin')`, [F.shop, F.admin]);

  // The event the shop works — a date well ahead, so the pass is live.
  F.event = await mkEvent('Indalecio & Claire', '2099-12-18');
  await book(F.event, F.shop);
  // A stranger's event, with its own schedule and guests — what a crew phone must never reach.
  F.stranger = await mkEvent('Somebody else', '2099-12-19');
  await book(F.stranger, F.otherShop);
  F.undated = await mkEvent('No date yet', null);
  await book(F.undated, F.shop);
  for (const e of [F.event, F.stranger]) {
    await db.query(`INSERT INTO public.event_schedule_blocks (event_id, label, start_at) VALUES ($1, 'Dinner', TIMESTAMPTZ '2099-12-18 19:00+08')`, [e]);
    await db.query(`INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1, 'Lorna', 'Buanhog', 'both', 'friends')`, [e]);
  }
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('META: the probing role is authenticated — not the owner, no BYPASSRLS', async () => {
  const r = ok(
    await asUser(F.crew, () =>
      db.query<{ me: string; bypass: boolean; uid: string }>(
        `SELECT current_user AS me, (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass, auth.uid()::text AS uid`,
      ),
    ),
  );
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.equal(r.rows[0]!.bypass, false);
  assert.equal(r.rows[0]!.uid, F.crew);
});

test('1 · the admin makes ONE crew QR for a booked event; its end is derived, never written', async () => {
  const r = ok(
    await asUser(F.admin, () =>
      db.query<{ token: string; ends: string }>(
        // A client that sends its own far-off end is overruled by the trigger.
        `INSERT INTO public.vendor_crew_codes (vendor_profile_id, event_id, ends_at)
         VALUES ($1, $2, NOW() + interval '300 days') RETURNING token, ends_at::text AS ends`,
        [F.shop, F.event],
      ),
    ),
  );
  F.token = r.rows[0]!.token;
  assert.match(F.token, /^[0-9a-f]{32}$/);
  const end = await db.query<{ ok: boolean }>(
    `SELECT ends_at = (DATE '2099-12-19')::timestamp AT TIME ZONE 'Asia/Manila' AS ok FROM public.vendor_crew_codes WHERE token = $1`,
    [F.token],
  );
  assert.equal(end.rows[0]!.ok, true, 'the pass does not end at the midnight after the event (Manila)');
  // A second QR for the same (shop, event) is refused — ONE per event per shop.
  const again = await asUser(F.admin, () => db.query(`INSERT INTO public.vendor_crew_codes (vendor_profile_id, event_id) VALUES ($1, $2)`, [F.shop, F.event]));
  assert.ok('err' in again, 'a second crew QR was made for the same event');
  // Never for an event the shop is not booked on, never for an event with no date.
  const stranger = await asUser(F.admin, () => db.query(`INSERT INTO public.vendor_crew_codes (vendor_profile_id, event_id) VALUES ($1, $2)`, [F.shop, F.stranger]));
  assert.ok('err' in stranger, 'a crew QR was made for a stranger’s event');
  const undated = await asUser(F.admin, () => db.query(`INSERT INTO public.vendor_crew_codes (vendor_profile_id, event_id) VALUES ($1, $2)`, [F.shop, F.undated]));
  assert.ok('err' in undated, 'a crew QR was made for an event with no day to end on');
});

test('2 · a scanned phone WAITS — it cannot Allow itself, write a pass, or read the QR', async () => {
  const noName = ok(await asUser(F.crew, () => db.query<{ r: { status: string } }>(`SELECT public.crew_pass_request($1, '') AS r`, [F.token])));
  assert.equal(noName.rows[0]!.r.status, 'needs_name', 'a pass was written without a name');
  const asked = ok(await asUser(F.crew, () => db.query<{ r: { status: string } }>(`SELECT public.crew_pass_request($1, 'Kuya Ben') AS r`, [F.token])));
  assert.equal(asked.rows[0]!.r.status, 'waiting');
  const mine = ok(await asUser(F.crew, () => db.query<{ pass_id: string; status: string; crew_role: string }>(`SELECT pass_id, status, crew_role FROM public.vendor_crew_passes`)));
  assert.equal(mine.rows.length, 1);
  F.passId = mine.rows[0]!.pass_id;
  assert.equal(mine.rows[0]!.crew_role, 'helper', 'a new phone is not a Helper (scanner only) by default');
  const pass = ok(await asUser(F.crew, () => db.query<{ effective: boolean }>(`SELECT effective FROM public.current_vendor_crew_pass($1)`, [F.event])));
  assert.equal(pass.rows[0]!.effective, false, 'a waiting phone already opens the Event Hub');

  const selfAllow = await asUser(F.crew, () => db.query(`UPDATE public.vendor_crew_passes SET status = 'allowed' WHERE pass_id = $1`, [F.passId]));
  const after1 = await db.query<{ status: string }>(`SELECT status FROM public.vendor_crew_passes WHERE pass_id = $1`, [F.passId]);
  assert.equal(after1.rows[0]!.status, 'waiting', `a phone allowed itself (${JSON.stringify(selfAllow)})`);
  const forged = await asUser(F.crew, () =>
    db.query(`INSERT INTO public.vendor_crew_passes (vendor_profile_id, event_id, crew_user_id, display_name, status) VALUES ($1, $2, $3, 'x', 'allowed')`, [F.shop, F.event, F.crew]),
  );
  assert.ok('err' in forged, 'a browser wrote a pass directly');
  const codes = ok(await asUser(F.crew, () => db.query(`SELECT * FROM public.vendor_crew_codes`)));
  assert.equal(codes.rows.length, 0, 'a crew phone can read the crew QR');
  // A forwarded QR cannot be used by the shop's own team to make passes for themselves.
  const team = ok(await asUser(F.admin, () => db.query<{ r: { status: string } }>(`SELECT public.crew_pass_request($1, 'Me') AS r`, [F.token])));
  assert.equal(team.rows[0]!.r.status, 'team');
});

test('2b · the admin Allows and sets the role; who decided is recorded', async () => {
  ok(await asUser(F.admin, () => db.query(`UPDATE public.vendor_crew_passes SET status = 'allowed', crew_role = 'member' WHERE pass_id = $1`, [F.passId])));
  const row = await db.query<{ status: string; crew_role: string; decided_by: string }>(`SELECT status, crew_role, decided_by FROM public.vendor_crew_passes WHERE pass_id = $1`, [F.passId]);
  assert.deepEqual({ ...row.rows[0] }, { status: 'allowed', crew_role: 'member', decided_by: F.admin });
  const pass = ok(await asUser(F.crew, () => db.query<{ effective: boolean; crew_role: string; vendor_profile_id: string }>(`SELECT * FROM public.current_vendor_crew_pass($1)`, [F.event])));
  assert.equal(pass.rows[0]!.effective, true);
  assert.equal(pass.rows[0]!.vendor_profile_id, F.shop);
});

test('3 · 🔒 an ALLOWED crew member reads nothing else — not the event, its schedule, its guests, nor anything of a stranger', async () => {
  for (const [what, sql] of [
    ['events', `SELECT 1 FROM public.events WHERE event_id = ANY($1::uuid[])`],
    ['the schedule', `SELECT 1 FROM public.event_schedule_blocks WHERE event_id = ANY($1::uuid[])`],
    ['guests', `SELECT 1 FROM public.guests WHERE event_id = ANY($1::uuid[])`],
    ['the shop’s day-of grants', `SELECT 1 FROM public.vendor_event_access_grants WHERE event_id = ANY($1::uuid[])`],
    ['event bookings', `SELECT 1 FROM public.event_vendors WHERE event_id = ANY($1::uuid[])`],
  ] as const) {
    const r = await asUser(F.crew, () => db.query(sql, [[F.event, F.stranger]]));
    if ('err' in r) continue; // refused outright is also nothing
    assert.equal(r.rows.length, 0, `a crew phone reads ${what}`);
  }
  const helpers = ok(
    await asUser(F.crew, () =>
      db.query<{ grants: number; booked: number; vendors: number }>(
        `SELECT (SELECT count(*) FROM public.current_vendor_dayof_grant_event_ids())::int AS grants,
                (SELECT count(*) FROM public.current_vendor_booked_event_ids())::int AS booked,
                (SELECT count(*) FROM public.current_vendor_ids('viewer'))::int AS vendors`,
      ),
    ),
  );
  assert.deepEqual({ ...helpers.rows[0] }, { grants: 0, booked: 0, vendors: 0 }, 'a crew pass reads as a grant, a booking or a shop seat');
  const otherPass = ok(await asUser(F.crew, () => db.query(`SELECT * FROM public.current_vendor_crew_pass($1)`, [F.stranger])));
  assert.equal(otherPass.rows.length, 0, 'a crew phone holds a pass on a stranger’s event');
  const scan = await asUser(F.crew, () => db.query(`SELECT public.crew_seat_by_guest_qr($1, $2)`, [F.stranger, 'a'.repeat(32)]));
  assert.ok('err' in scan && /no_crew_pass/.test(scan.err), `the crew scanner answered for a stranger’s event: ${JSON.stringify(scan)}`);
  // On its own event the scanner still asks the shop's gates — the host never shared the seat plan here.
  const own = await asUser(F.crew, () => db.query(`SELECT public.crew_seat_by_guest_qr($1, $2)`, [F.event, 'a'.repeat(32)]));
  assert.ok('err' in own && /seat_plan_not_shared/.test(own.err), `the crew scanner skipped the hosts' seat-plan gate: ${JSON.stringify(own)}`);
});

test('5 · a pass cannot be moved — not to another event, shop or person', async () => {
  for (const [col, val] of [['event_id', F.stranger], ['vendor_profile_id', F.otherShop], ['crew_user_id', F.admin]] as const) {
    const r = await asUser(F.admin, () => db.query(`UPDATE public.vendor_crew_passes SET ${col} = $2 WHERE pass_id = $1`, [F.passId, val]));
    assert.ok('err' in r, `the admin moved a pass's ${col}`);
  }
  const row = await db.query<{ event_id: string; vendor_profile_id: string; crew_user_id: string }>(`SELECT event_id, vendor_profile_id, crew_user_id FROM public.vendor_crew_passes WHERE pass_id = $1`, [F.passId]);
  assert.deepEqual({ ...row.rows[0] }, { event_id: F.event, vendor_profile_id: F.shop, crew_user_id: F.crew });
  const moveQr = await asUser(F.admin, () => db.query(`UPDATE public.vendor_crew_codes SET event_id = $2 WHERE token = $1`, [F.token, F.undated]));
  assert.ok('err' in moveQr, 'the crew QR was moved to another event');
});

test('6 · another shop’s admin cannot see or decide this shop’s crew', async () => {
  const seen = ok(await asUser(F.otherShopOwner, () => db.query(`SELECT 1 FROM public.vendor_crew_passes UNION ALL SELECT 1 FROM public.vendor_crew_codes`)));
  assert.equal(seen.rows.length, 0);
  await asUser(F.otherShopOwner, () => db.query(`UPDATE public.vendor_crew_passes SET status = 'removed' WHERE pass_id = $1`, [F.passId]));
  const row = await db.query<{ status: string }>(`SELECT status FROM public.vendor_crew_passes WHERE pass_id = $1`, [F.passId]);
  assert.equal(row.rows[0]!.status, 'allowed', 'another shop removed this shop’s crew');
});

test('7 · the scanner’s question for the issuer agrees with moderator_area_level on every branch', async () => {
  const cases: [string, Record<string, unknown>][] = [
    ['areas named', { areas: { seat_plan: 'view', guest_list: 'edit' } }],
    ['areas, empty value', { areas: { seat_plan: '' } }],
    ['areas, area absent', { areas: { guest_list: 'edit' } }],
    ['legacy edit_all', { edit_all: true }],
    ['legacy, no edit_all', { edit_all: false }],
    ['legacy checkout', { checkout: true }],
  ];
  for (const [name, perms] of cases) {
    const ev = await mkEvent(`Mod ${name}`, '2099-01-01');
    await db.query(
      `INSERT INTO public.event_moderators (event_id, user_id, role_subtype, permissions_json, accepted_at) VALUES ($1, $2, 'wedding_planner_external', $3::jsonb, NOW())`,
      [ev, F.owner, JSON.stringify(perms)],
    );
    for (const area of ['seat_plan', 'guest_list', 'budget', 'mood_board', 'schedule', 'nonsense']) {
      const mine = ok(await asUser(F.owner, () => db.query<{ l: string | null }>(`SELECT public.moderator_area_level($1, $2) AS l`, [ev, area])));
      const of = await db.query<{ l: string | null }>(`SELECT public.moderator_area_level_of($1, $2, $3) AS l`, [ev, F.owner, area]);
      assert.equal(of.rows[0]!.l, mine.rows[0]!.l, `${name} · ${area}: the crew scanner and the shipped rule disagree`);
    }
  }
  const called = await asUser(F.crew, () => db.query(`SELECT public.moderator_area_level_of($1, $2, 'seat_plan')`, [F.event, F.owner]));
  assert.ok('err' in called, 'a browser can ask the hosts’ answer for somebody else');
});

test('4 · the pass ENDS after the event, and a removed phone stays removed', async () => {
  // The event moves into the past; re-saving the QR re-derives its end from the event.
  await db.query(`UPDATE public.events SET event_date = DATE '2001-01-01' WHERE event_id = $1`, [F.event]);
  ok(await asUser(F.admin, () => db.query(`UPDATE public.vendor_crew_codes SET token = token WHERE token = $1`, [F.token])));
  const pass = ok(await asUser(F.crew, () => db.query<{ effective: boolean }>(`SELECT effective FROM public.current_vendor_crew_pass($1)`, [F.event])));
  assert.equal(pass.rows[0]!.effective, false, 'the pass still opens the Event Hub after the event');
  const late = ok(await asUser(F.crew, () => db.query<{ r: { status: string } }>(`SELECT public.crew_pass_request($1, 'Kuya Ben') AS r`, [F.token])));
  assert.equal(late.rows[0]!.r.status, 'ended');
  // Back to the future: a removed phone does not come back by scanning again.
  await db.query(`UPDATE public.events SET event_date = DATE '2099-12-18' WHERE event_id = $1`, [F.event]);
  ok(await asUser(F.admin, () => db.query(`UPDATE public.vendor_crew_codes SET token = token WHERE token = $1`, [F.token])));
  ok(await asUser(F.admin, () => db.query(`UPDATE public.vendor_crew_passes SET status = 'removed' WHERE pass_id = $1`, [F.passId])));
  const again = ok(await asUser(F.crew, () => db.query<{ r: { status: string } }>(`SELECT public.crew_pass_request($1, 'Kuya Ben') AS r`, [F.token])));
  assert.equal(again.rows[0]!.r.status, 'removed');
  const off = ok(await asUser(F.crew, () => db.query<{ effective: boolean }>(`SELECT effective FROM public.current_vendor_crew_pass($1)`, [F.event])));
  assert.equal(off.rows[0]!.effective, false);
});

test('8 · signed out reaches neither table nor the doors', async () => {
  const r = await db.query<{ a: boolean; b: boolean; c: boolean }>(
    `SELECT has_table_privilege('anon', 'public.vendor_crew_codes', 'SELECT') AS a,
            has_table_privilege('anon', 'public.vendor_crew_passes', 'SELECT') AS b,
            has_function_privilege('anon', 'public.crew_pass_request(text, text)', 'EXECUTE') AS c`,
  );
  assert.deepEqual({ ...r.rows[0] }, { a: false, b: false, c: false });
});

test('9 · erasing the issuer, the decider and the crew member is never blocked by the stamps’ guards', async () => {
  // The admin issued the QR and decided the pass: deleting that account nulls both stamps (the FK's own action) —
  // the triggers must let a stamp go to NULL, or the account could never be erased.
  // Run as the erasure runs (its seat flag), so the deletion measured is the stamps', not the last-admin rule's.
  await db.query(`SELECT set_config('app.vendor_seat_erasure', 'true', false)`);
  await db.query(`DELETE FROM auth.users WHERE id = $1`, [F.admin]);
  await db.query(`SELECT set_config('app.vendor_seat_erasure', '', false)`);
  const code = await db.query<{ created_by: string | null }>(`SELECT created_by FROM public.vendor_crew_codes WHERE token = $1`, [F.token]);
  assert.equal(code.rows[0]!.created_by, null);
  const pass = await db.query<{ decided_by: string | null }>(`SELECT decided_by FROM public.vendor_crew_passes WHERE pass_id = $1`, [F.passId]);
  assert.equal(pass.rows[0]!.decided_by, null);
  // A NULL issuer fails the crew scanner's seat-plan gate CLOSED — it never opens.
  await db.query(`DELETE FROM auth.users WHERE id = $1`, [F.crew]);
  const gone = await db.query(`SELECT 1 FROM public.vendor_crew_passes WHERE pass_id = $1`, [F.passId]);
  assert.equal(gone.rows.length, 0, 'the crew member’s pass outlived their account');
});
