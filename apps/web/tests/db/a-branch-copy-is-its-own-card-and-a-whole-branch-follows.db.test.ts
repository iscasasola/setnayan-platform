/**
 * SIMPLER SUPPLIER PLANS (owner-approved 2026-11-14) — items (8) · (9) · (10), proved against the replayed schema.
 *
 *   (10) copy_vendor_service_to_branch — the copy lands at the other branch with ITS OWN price, ITS OWN calendar
 *        (a new schedule pool, never the original's), no team (no agent rows), the SAME photo references, the
 *        authored children (what's included, add-ons), and `branch_copy_of` pointing at the original — the marker
 *        the create gate reads to not count it as a card. A stranger cannot call it.
 *   (9)  whole_branch_keys — a card filed later at a branch someone holds whole gets that person's agent row; a
 *        card at another branch does not.
 *   (8)  vendor_event_story_notes — one note per shop per celebration.
 *
 * Every case asserts a VALUE, never only a row count.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard, FIXTURE_COVER } from './live-card-fixture';

let replay: ReplayResult;
let db: PGlite;
const F = {} as Record<'owner' | 'agent' | 'stranger' | 'vendor' | 'member' | 'cebu' | 'card' | 'copy', string>;

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec('RESET ROLE').catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}
async function mkUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'vendor')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  F.owner = await mkUser('copy-owner@branch.test');
  F.agent = await mkUser('copy-agent@branch.test');
  F.stranger = await mkUser('copy-stranger@branch.test');
  F.vendor = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, 'Lumen Studio')
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id AS v`,
      [F.owner],
    )
  ).rows[0]!.v;
  await db.query(
    `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'admin') ON CONFLICT DO NOTHING`,
    [F.vendor, F.owner],
  );
  F.member = (
    await db.query<{ m: string }>(
      `INSERT INTO public.vendor_team_members (vendor_profile_id, user_id, role) VALUES ($1, $2, 'agent')
       RETURNING vendor_team_member_id AS m`,
      [F.vendor, F.agent],
    )
  ).rows[0]!.m;
  F.cebu = (
    await db.query<{ b: string }>(
      `INSERT INTO public.vendor_branches (parent_vendor_profile_id, branch_label, branch_city, branch_radius_km)
       VALUES ($1, 'Cebu', 'Cebu City', 30) RETURNING branch_id AS b`,
      [F.vendor],
    )
  ).rows[0]!.b;
  F.card = await insertLiveCard(db, {
    vendor_profile_id: F.vendor,
    category: 'photographer',
    title: 'Wedding Day',
    starting_price_php: 45000,
    showcase_photo_r2_keys: ['r2://media/a.webp', 'r2://media/b.webp'],
  });
  await db.query(
    `INSERT INTO public.vendor_service_addons (vendor_service_id, vendor_profile_id, label, from_price_php) VALUES ($1, $2, 'Drone', 5000)`,
    [F.card, F.vendor],
  );
  await db.query(
    `INSERT INTO public.vendor_service_agents (vendor_service_id, vendor_team_member_id) VALUES ($1, $2)`,
    [F.card, F.member],
  );
});
after(async () => {
  await db?.close();
});

test('(10) a stranger cannot copy a shop’s card', async () => {
  let err = '';
  try {
    await setAuthUid(db, F.stranger);
    await setRole('authenticated');
    await db.query(`SELECT public.copy_vendor_service_to_branch($1, $2, $3, 38000)`, [F.vendor, F.card, F.cebu]);
  } catch (e) {
    err = (e as Error).message;
  } finally {
    await reset();
  }
  assert.match(err, /Only an admin of this shop can copy its cards/);
});

test('(10) the copy is the same service at Cebu — own price, own calendar, no team, same photos, uses no card', async () => {
  await setRole('service_role');
  const r = await db.query<{ id: string }>(
    `SELECT public.copy_vendor_service_to_branch($1, $2, $3, 38000) AS id`,
    [F.vendor, F.card, F.cebu],
  );
  await reset();
  F.copy = r.rows[0]!.id;
  const row = (
    await db.query<Record<string, unknown>>(
      `SELECT title, branch_id, branch_copy_of, starting_price_php, primary_photo_r2_key, showcase_photo_r2_keys, is_active, public_id
         FROM public.vendor_services WHERE vendor_service_id = $1`,
      [F.copy],
    )
  ).rows[0]!;
  assert.equal(row.title, 'Wedding Day');
  assert.equal(row.branch_id, F.cebu);
  assert.equal(row.branch_copy_of, F.card, 'the copy must name its original — the create gate reads this');
  assert.equal(row.starting_price_php, 38000, 'the copy carries the price THERE, not Makati’s');
  assert.equal(row.primary_photo_r2_key, FIXTURE_COVER, 'photos are referenced, never re-uploaded');
  assert.deepEqual(row.showcase_photo_r2_keys, ['r2://media/a.webp', 'r2://media/b.webp']);
  assert.equal(row.is_active, true);

  const original = (await db.query<{ p: number; pid: string }>(`SELECT starting_price_php AS p, public_id AS pid FROM public.vendor_services WHERE vendor_service_id = $1`, [F.card])).rows[0]!;
  assert.equal(original.p, 45000, 'the original keeps its own price');
  assert.notEqual(row.public_id, original.pid, 'the copy has its own public id');

  const kids = (
    await db.query<{ inc: string; addon: string }>(
      `SELECT (SELECT string_agg(label, ',') FROM public.vendor_service_inclusions WHERE vendor_service_id = $1) AS inc,
              (SELECT string_agg(label, ',') FROM public.vendor_service_addons WHERE vendor_service_id = $1) AS addon`,
      [F.copy],
    )
  ).rows[0]!;
  assert.equal(kids.inc, 'Everything in the package');
  assert.equal(kids.addon, 'Drone');

  const team = await db.query(`SELECT 1 FROM public.vendor_service_agents WHERE vendor_service_id = $1`, [F.copy]);
  assert.equal(team.rows.length, 0, 'the copy’s team is its own — no agent row comes across');

  const pool = (
    await db.query<{ pool_id: string; calendar_name: string }>(
      `SELECT c.pool_id, p.calendar_name FROM public.vendor_schedule_calendar_services c
         JOIN public.vendor_schedule_pools p ON p.pool_id = c.pool_id WHERE c.vendor_service_id = $1`,
      [F.copy],
    )
  ).rows;
  assert.equal(pool.length, 1, 'the copy has exactly one calendar');
  assert.equal(pool[0]!.calendar_name, 'Wedding Day · Cebu');
  const shared = await db.query(
    `SELECT 1 FROM public.vendor_schedule_calendar_services WHERE vendor_service_id = $1 AND pool_id = $2`,
    [F.card, pool[0]!.pool_id],
  );
  assert.equal(shared.rows.length, 0, 'a Cebu booking must never take a Makati date');
});

test('(10) a card cannot be copied to the branch it is already at', async () => {
  await setRole('service_role');
  let err = '';
  try {
    await db.query(`SELECT public.copy_vendor_service_to_branch($1, $2, NULL, 40000)`, [F.vendor, F.card]);
  } catch (e) {
    err = (e as Error).message;
  } finally {
    await reset();
  }
  assert.match(err, /already at this branch/);
});

test('(9) whole branch: a card filed at Cebu later gets the person; a card at Main does not', async () => {
  await db.query(`UPDATE public.vendor_team_members SET whole_branch_keys = ARRAY[$1::text] WHERE vendor_team_member_id = $2`, [
    F.cebu,
    F.member,
  ]);
  const later = await insertLiveCard(db, {
    vendor_profile_id: F.vendor,
    category: 'photographer',
    title: 'Christening',
    starting_price_php: 15000,
    branch_id: F.cebu,
  });
  const main = await insertLiveCard(db, {
    vendor_profile_id: F.vendor,
    category: 'photographer',
    title: 'Same-Day Edit',
    starting_price_php: 15000,
  });
  const rows = await db.query<{ vendor_service_id: string }>(
    `SELECT vendor_service_id FROM public.vendor_service_agents WHERE vendor_team_member_id = $1 AND vendor_service_id IN ($2, $3)`,
    [F.member, later, main],
  );
  assert.deepEqual(rows.rows.map((r) => r.vendor_service_id), [later]);
});

test('(8) one "In our words" note per shop per celebration, never blank', async () => {
  const ev = (
    await db.query<{ e: string }>(`INSERT INTO public.events (display_name, event_type) VALUES ('Bea''s debut', 'birthday') RETURNING event_id AS e`)
  ).rows[0]!.e;
  await db.query(`INSERT INTO public.vendor_event_story_notes (vendor_profile_id, event_id, body) VALUES ($1, $2, 'Rain cleared at three.')`, [
    F.vendor,
    ev,
  ]);
  let dup = '';
  try {
    await db.query(`INSERT INTO public.vendor_event_story_notes (vendor_profile_id, event_id, body) VALUES ($1, $2, 'Again')`, [F.vendor, ev]);
  } catch (e) {
    dup = (e as Error).message;
  }
  assert.match(dup, /duplicate key|unique/i);
  let blank = '';
  try {
    await db.query(`INSERT INTO public.vendor_event_story_notes (vendor_profile_id, event_id, body) VALUES ($1, gen_random_uuid(), '   ')`, [F.vendor]);
  } catch (e) {
    blank = (e as Error).message;
  }
  assert.ok(blank.length > 0, 'a blank note must be refused');
  const body = (await db.query<{ body: string }>(`SELECT body FROM public.vendor_event_story_notes WHERE event_id = $1`, [ev])).rows[0]!.body;
  assert.equal(body, 'Rain cleared at three.');
});
