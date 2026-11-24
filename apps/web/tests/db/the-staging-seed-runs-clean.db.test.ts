/**
 * THE STAGING SEED RUNS CLEAN ON THE SCHEMA AS SHIPPED — the final-check kit's proof, on every pull request.
 *
 * The controller runs `scripts/staging/seed.ts` against a paid Supabase preview branch exactly once, on the day.
 * A seed that broke because a migration added a NOT NULL column, a CHECK or a trigger would be found THAT day, with
 * eight checkers waiting. So the same SQL runs here, against every migration replayed into PGlite, built from the
 * same settings preamble (`seedSettingsSql`) — the only difference is the transport (PGlite instead of psql).
 *
 * What it holds:
 *   · the seal (scripts/staging/seal.sql) and the seed apply with no error, on a replay whose bookings switch is AS
 *     MIGRATED (closed) — so the seed's open-then-restore path is the one a real branch takes;
 *   · every count is at or above its floor (`SEED_FLOOR`), and each of the 8 areas has something to press;
 *   · the two messy accounts really are big and messy;
 *   · the tagging rule: nobody is internal, the demo pair only meets itself, every seeded event is `stg-`, and every
 *     minted id is version-4 shaped;
 *   · both belts refuse: a database that holds real people, and a second run;
 *   · the catalogue copy (scripts/staging/copy-catalog-core.ts): every table it copies still exists, has a primary
 *     key and points at no person, shop or event — and its one upsert lands production-shaped rows: a changed
 *     price is overwritten, an admin's audit stamp lands as NULL, a `keep` column keeps the copy's value.
 *
 * The numbers it prints (`# staging seed:` lines) are the ones quoted in the kit's pull request.
 *
 * SABOTAGE (each seen red, restored): book a demo shop on the plan wedding (the demo cross-booking trigger refuses
 * it) · seat guests with placed_by 'host' (the CHECK refuses it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { STAGING_ACCOUNTS, accountEmail, accountEmails } from '../../../../scripts/staging/accounts';
import { SEED_FLOOR, SEED_SUMMARY_SQL, seedSettingsSql } from '../../../../scripts/staging/seed-core';
import { COPY_TABLES, buildUpsertSql, metaSql, refusalFor, type TableMeta } from '../../../../scripts/staging/copy-catalog-core';

const KIT = path.resolve(import.meta.dirname, '../../../../scripts/staging');
const SEAL = fs.readFileSync(path.join(KIT, 'seal.sql'), 'utf8');
const SEED = fs.readFileSync(path.join(KIT, 'seed.sql'), 'utf8');
const ACCOUNTS = accountEmails((k) => accountEmail(k));
const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Summary = { counts: Record<keyof typeof SEED_FLOOR | 'cards', number>; events: Array<{ slug: string; event_id: string }>; guest_links: unknown[] };

let replay: ReplayResult;
let summary: Summary;
let seedMs = 0;

const one = async <T>(sql: string, params: unknown[] = []): Promise<T> => (await replay.db.query(sql, params)).rows[0] as T;
const uid = async (key: string): Promise<string> =>
  (await one<{ id: string }>('SELECT id FROM auth.users WHERE email = $1', [ACCOUNTS[key as keyof typeof ACCOUNTS]])).id;

test.before(async () => {
  const t0 = Date.now();
  replay = await createReplayedDb({ bookingsAsMigrated: true });
  console.log(`staging seed: replayed ${replay.applied}/${replay.total} migrations in ${Date.now() - t0} ms`);
  // seed.ts creates these through the admin API; here the stub auth.users row fires the same on_auth_user_created.
  for (const a of STAGING_ACCOUNTS) await replay.db.query('INSERT INTO auth.users (email) VALUES ($1)', [ACCOUNTS[a.key]]);
  const t1 = Date.now();
  await replay.db.exec(SEAL);
  await replay.db.exec(seedSettingsSql({ accounts: ACCOUNTS }));
  await replay.db.exec(SEED);
  seedMs = Date.now() - t1;
  summary = (await one<{ summary: Summary }>(SEED_SUMMARY_SQL)).summary;
  console.log(`staging seed: sealed + seeded in ${seedMs} ms`);
  console.log(`staging seed: ${JSON.stringify(summary.counts)}`);
});

test.after(async () => {
  await replay?.db.close();
});

test('every count is at or above its floor', () => {
  for (const [k, floor] of Object.entries(SEED_FLOOR)) {
    assert.ok(summary.counts[k as keyof typeof SEED_FLOOR] >= floor, `${k}: ${summary.counts[k as keyof typeof SEED_FLOOR]} < ${floor}`);
  }
  assert.equal(summary.events.length, summary.counts.events);
  assert.ok(summary.guest_links.length >= 6, 'the guest checker gets a link per reply state');
});

test('bookings are put back exactly as migrated (closed), and no seeded account is internal', async () => {
  const s = await one<{ bookings_open: boolean | null }>('SELECT bookings_open FROM public.platform_settings WHERE id = 1');
  assert.notEqual(s.bookings_open, true, 'the seed opened bookings and left them open');
  const internal = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.users WHERE is_internal AND email = ANY($1)`,
    [Object.values(ACCOUNTS)],
  );
  assert.equal(internal.n, 0, 'an internal account passes every paid gate — no checker may be one');
  const admin = await one<{ account_type: string }>('SELECT account_type FROM public.users WHERE email = $1', [ACCOUNTS.admin]);
  assert.equal(admin.account_type, 'admin');
});

test('area 2 · the planning couple owns several event types, with every reply state and a seat plan', async () => {
  const owner = await uid('couple_plan');
  const ev = await one<{ types: string[] }>(
    `SELECT array_agg(DISTINCT e.event_type ORDER BY e.event_type) AS types FROM public.events e
       JOIN public.event_members m USING (event_id) WHERE m.user_id = $1 AND m.member_type = 'couple'`,
    [owner],
  );
  assert.deepEqual(ev.types, ['birthday', 'debut', 'wedding']);
  const rsvp = await one<{ states: string[]; set_by: string[] }>(
    `SELECT array_agg(DISTINCT rsvp_status::text ORDER BY rsvp_status::text) AS states,
            array_agg(DISTINCT rsvp_set_by ORDER BY rsvp_set_by) FILTER (WHERE rsvp_set_by IS NOT NULL) AS set_by
       FROM public.guests g JOIN public.events e USING (event_id) WHERE e.slug = 'stg-bea-paolo'`,
  );
  assert.deepEqual(rsvp.states, ['attending', 'declined', 'maybe', 'pending']);
  assert.deepEqual(rsvp.set_by, ['guest', 'host']);
  const seats = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_seat_assignments a JOIN public.events e USING (event_id) WHERE e.slug = 'stg-bea-paolo'`,
  );
  assert.ok(seats.n >= 30, `only ${seats.n} seated on the plan wedding`);
});

test('area 3 · the Maker couple has a paid upgrade, a public Event Hub and a past event for Memories', async () => {
  const r = await one<{ paid: number; public_hubs: number; past: number }>(
    `SELECT (SELECT count(*)::int FROM public.orders o WHERE o.user_id = $1 AND o.status = 'paid') AS paid,
            (SELECT count(*)::int FROM public.events e JOIN public.event_members m USING (event_id)
              WHERE m.user_id = $1 AND e.landing_page_visibility = 'public') AS public_hubs,
            (SELECT count(*)::int FROM public.events e JOIN public.event_members m USING (event_id)
              WHERE m.user_id = $1 AND e.event_date < current_date) AS past`,
    [await uid('couple_maker')],
  );
  assert.ok(r.paid >= 1 && r.public_hubs >= 2 && r.past >= 1, JSON.stringify(r));
});

test('area 4 · the guest sign-in is a guest of the plan wedding', async () => {
  const r = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_members m JOIN public.events e USING (event_id)
      WHERE m.user_id = $1 AND m.member_type = 'guest' AND m.guest_id IS NOT NULL AND e.slug = 'stg-bea-paolo'`,
    [await uid('guest')],
  );
  assert.equal(r.n, 1);
});

test('area 5 · the shop supplier owns a published, verified Pro shop with a card for every pricing basis', async () => {
  const r = await one<{ tier: string; published: boolean; state: string; bases: string[]; live: number }>(
    `SELECT vp.tier_state::text AS tier, vp.is_published AS published, vp.verification_state::text AS state,
            array_agg(DISTINCT vs.pricing_basis ORDER BY vs.pricing_basis) AS bases,
            count(*) FILTER (WHERE vs.is_active)::int AS live
       FROM public.vendor_profiles vp JOIN public.vendor_services vs USING (vendor_profile_id)
      WHERE vp.user_id = $1 GROUP BY 1, 2, 3`,
    [await uid('supplier_shop')],
  );
  assert.deepEqual(r, { tier: 'pro', published: true, state: 'verified', bases: ['fixed', 'per_hour', 'per_pax', 'per_unit'], live: 4 });
});

test('area 6 · the bookings supplier is booked in every funnel state, with chats and recorded payments', async () => {
  const owner = await uid('supplier_bookings');
  const r = await one<{ states: string[]; threads: number; payments: number }>(
    `SELECT array_agg(DISTINCT v.status::text ORDER BY v.status::text) AS states,
            (SELECT count(*)::int FROM public.chat_threads t JOIN public.vendor_profiles p ON p.vendor_profile_id = t.vendor_profile_id WHERE p.user_id = $1) AS threads,
            (SELECT count(*)::int FROM public.event_vendor_payments pm JOIN public.event_vendors ev ON ev.vendor_id = pm.vendor_id
               JOIN public.vendor_profiles p ON p.vendor_profile_id = ev.marketplace_vendor_id WHERE p.user_id = $1) AS payments
       FROM public.event_vendors v JOIN public.vendor_profiles vp ON vp.vendor_profile_id = v.marketplace_vendor_id
      WHERE vp.user_id = $1`,
    [owner],
  );
  assert.deepEqual(r.states, ['complete', 'considering', 'contracted', 'delivered', 'deposit_paid', 'shortlisted']);
  assert.ok(r.threads >= 6 && r.payments >= 3, JSON.stringify(r));
});

test('area 7 · the coordinator is booked on two weddings and seated on the venue shop, which has a map pin and a hall', async () => {
  const owner = await uid('coordinator');
  const r = await one<{ booked_weddings: number; venue_seat: number; pinned: number }>(
    `SELECT (SELECT count(DISTINCT v.event_id)::int FROM public.event_vendors v
               JOIN public.vendor_profiles p ON p.vendor_profile_id = v.marketplace_vendor_id
               JOIN public.events e ON e.event_id = v.event_id
              WHERE p.user_id = $1 AND p.services @> ARRAY['planner_coordinator'] AND e.event_type = 'wedding'
                AND v.status IN ('contracted', 'deposit_paid', 'delivered', 'complete')) AS booked_weddings,
            (SELECT count(*)::int FROM public.vendor_team_members t JOIN public.vendor_profiles p USING (vendor_profile_id)
              WHERE t.user_id = $1 AND p.services @> ARRAY['venue']) AS venue_seat,
            (SELECT count(*)::int FROM public.vendor_profiles p
              WHERE p.services @> ARRAY['venue'] AND p.hq_latitude IS NOT NULL AND p.venue_width_m IS NOT NULL
                AND p.tagline LIKE 'Staging sample shop%' AND NOT p.is_demo) AS pinned`,
    [owner],
  );
  assert.deepEqual(r, { booked_weddings: 2, venue_seat: 1, pinned: 1 });
});

test('the two messy accounts are big (300+ guests) and messy (long, accented names; old shapes)', async () => {
  for (const key of ['messy_one', 'messy_two']) {
    const r = await one<{ guests: number; longest: number; accented: number; undated: number; uninvited_old: number }>(
      `SELECT count(*)::int AS guests,
              max(length(g.first_name || ' ' || g.last_name))::int AS longest,
              count(*) FILTER (WHERE g.first_name || g.last_name ~ '[ÑñáéíóúÁÉÍÓÚ''’]')::int AS accented,
              (SELECT count(*)::int FROM public.events e2 JOIN public.event_members m2 USING (event_id) WHERE m2.user_id = $1 AND e2.event_date IS NULL) AS undated,
              count(*) FILTER (WHERE g.invitation_sent_at < now() - interval '1 year' AND g.rsvp_status = 'pending')::int AS uninvited_old
         FROM public.guests g JOIN public.event_members m ON m.event_id = g.event_id AND m.member_type = 'couple'
        WHERE m.user_id = $1`,
      [await uid(key)],
    );
    assert.ok(r.guests >= 300, `${key}: ${r.guests} guests`);
    assert.ok(r.longest >= 45 && r.accented >= 50 && r.uninvited_old >= 10, `${key}: ${JSON.stringify(r)}`);
    if (key === 'messy_two') assert.ok(r.undated >= 1, 'messy_two keeps an undated old event');
  }
});

test('the demo pair meets only itself; every seeded event is stg-; every minted id is version-4 shaped', async () => {
  const cross = await one<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.event_vendors v JOIN public.events e USING (event_id)
       JOIN public.vendor_profiles p ON p.vendor_profile_id = v.marketplace_vendor_id
      WHERE e.slug LIKE 'stg-%' AND coalesce(e.is_sample, false) <> p.is_demo`,
  );
  assert.equal(cross.n, 0, 'a real event met a demo shop (or the reverse)');
  const demo = await one<{ n: number }>(`SELECT count(*)::int AS n FROM public.events WHERE slug LIKE 'stg-%' AND is_sample`);
  assert.equal(demo.n, 1, 'exactly one demo event');
  for (const e of summary.events) {
    assert.match(e.slug, /^stg-/);
    assert.match(e.event_id, V4, `${e.slug} id is not version-4 shaped`);
  }
});

test('belt: a second run is refused, and so is a database that holds real people', async () => {
  await assert.rejects(replay.db.exec(SEED), /already seeded/);
  await replay.db.exec('BEGIN');
  try {
    await replay.db.exec(`INSERT INTO auth.users (email) SELECT 'person' || i || '@gmail.com' FROM generate_series(1, 26) AS i`);
    await assert.rejects(replay.db.exec(SEED), /holds \d+ sign-ins that are not staging accounts — it is not a fresh staging copy/);
  } finally {
    await replay.db.exec('ROLLBACK');
  }
});

test('the catalogue copy: every listed table is still copyable, and its upsert lands production-shaped rows', async () => {
  const metaRow = await one<{ meta: TableMeta[] }>(metaSql(COPY_TABLES.map((t) => t.table)));
  const metas = new Map(metaRow.meta.map((m) => [m.table, m]));
  for (const spec of COPY_TABLES) assert.equal(refusalFor(metas.get(spec.table), spec), null, spec.table);

  // "Production": today's catalogue rows with one price changed and an admin's stamp that the copy has no account for.
  const spec = COPY_TABLES.find((t) => t.table === 'platform_retail_catalog_v2')!;
  const rows = (await replay.db.query<Record<string, unknown>>('SELECT * FROM public.platform_retail_catalog_v2 ORDER BY service_code')).rows;
  const target = rows.find((r) => Number(r.retail_price_php) > 0)!;
  const prodPrice = Number(target.retail_price_php) + 1;
  const prodRows = rows.map((r) =>
    r.service_code === target.service_code
      ? { ...r, retail_price_php: prodPrice, updated_by_admin_id: '9f9f9f9f-0000-4000-8000-000000000001' }
      : r,
  );
  const before = await one<{ n: number }>('SELECT count(*)::int AS n FROM public.platform_retail_catalog_v2');
  await replay.db.exec(buildUpsertSql(spec, metas.get(spec.table)!, JSON.parse(JSON.stringify(prodRows)))!);
  const after = await one<{ n: number; price: string; stamp: string | null }>(
    `SELECT (SELECT count(*)::int FROM public.platform_retail_catalog_v2) AS n, retail_price_php::text AS price, updated_by_admin_id::text AS stamp
       FROM public.platform_retail_catalog_v2 WHERE service_code = $1`,
    [target.service_code],
  );
  assert.equal(after.n, before.n, 'an upsert, never a second copy of a row');
  assert.equal(Number(after.price), prodPrice, "production's price lands");
  assert.equal(after.stamp, null, "an admin's audit stamp is copied as NULL (that account does not exist here)");

  // A `keep` column keeps the copy's own value: platform_settings keeps its (sandbox) Maya endpoint.
  const ps = COPY_TABLES.find((t) => t.table === 'platform_settings')!;
  const settings = (await replay.db.query<Record<string, unknown>>('SELECT * FROM public.platform_settings')).rows;
  const live = settings.map((r) => ({ ...r, maya_checkout_endpoint: 'https://pg.maya.ph/checkout/v1/checkouts' }));
  await replay.db.exec(buildUpsertSql(ps, metas.get('platform_settings')!, JSON.parse(JSON.stringify(live)))!);
  const kept = await one<{ e: string | null }>('SELECT maya_checkout_endpoint AS e FROM public.platform_settings WHERE id = 1');
  assert.notEqual(kept.e, 'https://pg.maya.ph/checkout/v1/checkouts');
});
