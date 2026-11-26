/**
 * A6-57 (final check 25 Nov, area 6) — THE SUPPLIER'S BOOKING GROUP COUNTS BY THE ONE GUEST RULE
 * (migration supplier_group_counts_who_counts).
 *
 * `supplier_booking_group` used to hand every member row: a guest the hosts deleted, a pending request, a guest who
 * passed away and a represented role holder were "in your group", and a decline still counted. Now the group lists
 * only guests who count (`countsTowardEvent`, lib/guests.ts, plus not deleted), and `counted` is that number without
 * the declined — who stay listed with their reply.
 *
 *   · a group of 5 with 1 declined and 1 deleted counts 3 (the plan's case), and lists 4 (the declined keeps a row);
 *   · a passed-away guest, a pending request and a represented role holder are neither listed nor counted.
 *
 * 🛡 Sabotage: drop `AND gu.deleted_at IS NULL` → the list holds the deleted guest; drop the declined filter on
 *    `counted` → 4, not 3.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;
let eventId = '';
let caterer = '';
let groupId = '';

async function one<T>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ v: T }>(sql, params)).rows[0]!.v;
}
async function guest(first: string, rsvp: string): Promise<string> {
  return one<string>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category, rsvp_status)
     VALUES ($1, $2, 'Test', 'both', 'friends', $3) RETURNING guest_id AS v`,
    [eventId, first, rsvp],
  );
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  const host = await one<string>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('sgc-host@t.test', '{"account_type":"customer"}') RETURNING id AS v`);
  caterer = await one<string>(`INSERT INTO auth.users (email, raw_user_meta_data) VALUES ('sgc-cater@t.test', '{"account_type":"vendor"}') RETURNING id AS v`);
  const shop =
    (await db.query<{ v: string }>(`SELECT vendor_profile_id AS v FROM public.vendor_profiles WHERE user_id = $1`, [caterer])).rows[0]?.v ??
    (await one<string>(`INSERT INTO public.vendor_profiles (user_id, business_name, location_city, services) VALUES ($1, 'Kusina', 'Manila', ARRAY['catering']) RETURNING vendor_profile_id AS v`, [caterer]));
  await db.query(
    `UPDATE public.vendor_profiles SET business_name = 'Kusina', services = ARRAY['catering']::text[], verification_state = 'verified', last_verified_at = NOW(), public_visibility = 'verified' WHERE vendor_profile_id = $1`,
    [shop],
  );
  eventId = await one<string>(`INSERT INTO public.events (display_name, event_type) VALUES ('Group Count', 'birthday') RETURNING event_id AS v`);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type, joined_via) VALUES ($1, $2, 'couple', 'created_event')`, [eventId, host]);
  const row = await one<string>(
    `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id, total_cost_php, pricing_basis, pax_quote_base)
     VALUES ($1, 'catering', 'Kusina', 'contracted', $2, 150000, 'per_pax', 5) RETURNING vendor_id AS v`,
    [eventId, shop],
  );
  groupId = await one<string>(`SELECT group_id AS v FROM public.guest_groups WHERE event_vendor_id = $1`, [row]);

  const ana = await guest('Ana', 'attending');
  const ben = await guest('Ben', 'declined');
  const carla = await guest('Carla', 'attending');
  const dino = await guest('Dino', 'pending');
  const eva = await guest('Eva', 'maybe');
  await db.query(`UPDATE public.guests SET deleted_at = NOW() WHERE guest_id = $1`, [carla]);
  // Three more that never count: passed away, a pending request, a role holder represented by a proxy (Dino).
  const lola = await guest('Lola', 'attending');
  await db.query(`UPDATE public.guests SET passed_away = TRUE WHERE guest_id = $1`, [lola]);
  const asker = await guest('Asker', 'attending');
  await db.query(`UPDATE public.guests SET entry_source = 'self_added_unlisted' WHERE guest_id = $1`, [asker]);
  const holder = await guest('Holder', 'attending');
  await db.query(`UPDATE public.guests SET role = 'principal_sponsor_ninang'::public.guest_role WHERE guest_id = $1`, [holder]);
  await db.query(`UPDATE public.guests SET represented_by_guest_id = $2 WHERE guest_id = $1`, [holder, dino]);
  for (const g of [ana, ben, carla, dino, eva, lola, asker, holder]) {
    await db.query(`INSERT INTO public.guest_group_memberships (group_id, guest_id) VALUES ($1, $2)`, [groupId, g]);
  }
});

after(async () => {
  await replay?.db.close();
});

type GroupRead = { status: string; counted?: number; guests?: Array<{ name: string; rsvp: string | null }> };

async function readAsCaterer(): Promise<GroupRead> {
  await setAuthUid(db, caterer);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
  try {
    return (await db.query<{ v: GroupRead }>(`SELECT public.supplier_booking_group($1) AS v`, [eventId])).rows[0]!.v;
  } finally {
    await db.exec(`RESET ROLE`).catch(() => {});
    await setAuthUid(db, null);
    await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
  }
}

test('a group of 5 with 1 declined and 1 deleted counts 3 — the declined stays listed with their reply', async () => {
  const r = await readAsCaterer();
  assert.equal(r.status, 'ok', JSON.stringify(r));
  assert.equal(r.counted, 3, 'counted must be Ana + Dino + Eva');
  const names = (r.guests ?? []).map((g) => g.name).sort();
  assert.deepEqual(names, ['Ana Test', 'Ben Test', 'Dino Test', 'Eva Test'], 'the deleted guest is not listed; the declined is');
  assert.equal(r.guests!.find((g) => g.name === 'Ben Test')!.rsvp, 'declined');
});

test('a passed-away guest, a pending request and a represented role holder are neither listed nor counted', async () => {
  const r = await readAsCaterer();
  const all = JSON.stringify(r);
  for (const who of ['Lola', 'Asker', 'Holder', 'Carla']) assert.ok(!all.includes(who), `${who} is in the supplier's group`);
});
