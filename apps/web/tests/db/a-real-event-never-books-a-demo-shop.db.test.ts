/**
 * A REAL EVENT NEVER BOOKS, PAYS OR MESSAGES A DEMO SHOP — and a demo event never books a real one.
 *
 * Owner, DECISION_LOG 2026-11-06 "DEMO SHOPS + DEMO EVENTS": demo shops and demo events show publicly, marked
 * "(DEMO ONLY)", and *"a couple can never book or pay a demo shop"*; "DEMO CATALOGUE — scope": *"the demo events can only
 * see demo suppliers"*. The database half is `public.refuse_demo_cross_booking()` (migration
 * `20271316355263_a_real_event_never_books_a_demo_shop`), a BEFORE INSERT OR UPDATE trigger on every table that pairs
 * an event with a shop. This replays every migration into PGlite and writes the four pairings into each table:
 *
 *   real event + demo shop  → refused, "demo_cross_booking: demo shop on a real event"
 *   demo event + real shop  → refused, "demo_cross_booking: real shop on a demo event"
 *   real + real · demo + demo → NOT refused by this trigger (a table's own other rules may still apply — the assertion
 *                              is about this trigger, and event_vendors + chat_threads are additionally read back)
 *
 * plus: a legacy cross row (written before the rule) keeps its lifecycle — an UPDATE that does not change the pairing
 * goes through, an UPDATE that re-points it at another demo shop does not; and a COUPLE's own insert (authenticated,
 * RLS on, unable to read the shop's `is_demo`) is refused all the same, because the function is SECURITY DEFINER.
 *
 * The app half (`lib/demo-scope.ts`, every write action) is pinned by `lib/a-real-event-never-books-a-demo-shop.test.ts`.
 *
 * 🔢 PART 2 — *"demo numbers never count in real totals"*: the same migration re-creates the four SQL aggregates with a
 * demo filter. Market price bands, the demand radar and the admin market analytics are RUN here with a demo shop / a
 * demo event in the data and must not count it; the funnel bands (which need a stats row per peer) are pinned by body.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { insertLiveCard } from './live-card-fixture';

let replay: ReplayResult;
let db: ReplayResult['db'];

const F = {
  couple: '',
  realEvent: '',
  demoEvent: '',
  realShop: '',
  demoShop: '',
  otherDemoShop: '',
  shopUser: {} as Record<string, string>,
};

type Pair = { event: string; shop: string };

/** One insert per table, the table's NOT NULL columns filled, the event and shop ids from the pair. */
const TABLES: ReadonlyArray<{ table: string; insert: (p: Pair) => { sql: string; params: unknown[] } }> = [
  {
    table: 'event_vendors',
    insert: (p) => ({
      sql: `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
            VALUES ($1, 'photographer', 'Demo pairing test', 'considering', $2) RETURNING vendor_id::text AS id`,
      params: [p.event, p.shop],
    }),
  },
  {
    table: 'chat_threads',
    insert: (p) => ({
      sql: `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id)
            VALUES ($1, $2, $3) RETURNING thread_id::text AS id`,
      params: [p.event, p.shop, F.couple],
    }),
  },
  {
    table: 'vendor_proposals',
    insert: (p) => ({
      sql: `INSERT INTO public.vendor_proposals (event_id, vendor_profile_id, title, status)
            VALUES ($1, $2, 'Demo pairing quote', 'draft') RETURNING proposal_id::text AS id`,
      params: [p.event, p.shop],
    }),
  },
  {
    table: 'orders',
    insert: (p) => ({
      sql: `INSERT INTO public.orders (event_id, vendor_profile_id, user_id, description, reference_code, requested_total_php)
            VALUES ($1, $2, $3, 'Demo pairing order', 'DEMO-' || substr(md5(random()::text), 1, 10), 0)
            RETURNING order_id::text AS id`,
      params: [p.event, p.shop, F.couple],
    }),
  },
  {
    table: 'booking_fee_charges',
    insert: (p) => ({
      sql: `INSERT INTO public.booking_fee_charges (event_id, vendor_profile_id, ledger_id, proposal_amount_centavos,
                                                     computed_fee_centavos, amount_charged_centavos, schedule_version)
            VALUES ($1, $2, gen_random_uuid(), 0, 0, 0, 'demo-pairing-test') RETURNING 'x' AS id`,
      params: [p.event, p.shop],
    }),
  },
  {
    table: 'vendor_contracts',
    insert: (p) => ({
      sql: `INSERT INTO public.vendor_contracts (event_id, vendor_profile_id, title, file_url, file_name, file_size_bytes)
            VALUES ($1, $2, 'Demo pairing contract', 'r2://test/contract.pdf', 'contract.pdf', 1) RETURNING 'x' AS id`,
      params: [p.event, p.shop],
    }),
  },
  {
    table: 'vendor_payment_asks',
    insert: (p) => ({
      sql: `INSERT INTO public.vendor_payment_asks (event_id, vendor_profile_id, event_vendor_id, amount_php)
            VALUES ($1, $2, gen_random_uuid(), 1) RETURNING 'x' AS id`,
      params: [p.event, p.shop],
    }),
  },
];

/** Run one write inside a savepoint; answer the error's message (or null) and never leave a row behind. */
async function attempt(sql: string, params: unknown[]): Promise<{ error: string | null; id: string | null }> {
  await db.exec('BEGIN');
  try {
    const r = await db.query<{ id: string }>(sql, params);
    return { error: null, id: r.rows[0]?.id ?? null };
  } catch (err) {
    return { error: (err as Error).message, id: null };
  } finally {
    await db.exec('ROLLBACK');
  }
}

async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`).catch(() => {});
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('demo-pair-couple@demo-pairing.test', 'customer');

  const mkEvent = async (name: string, isSample: boolean) => {
    const id = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id`,
        [name],
      )
    ).rows[0]!.event_id;
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [id, F.couple]);
    // The flag is SEEDED with every trigger off: this sets a state, it does not exercise the path that reaches it.
    await db.exec('SET session_replication_role = replica');
    await db.query(`UPDATE public.events SET is_sample = $2 WHERE event_id = $1`, [id, isSample]);
    await db.exec('SET session_replication_role = origin');
    return id;
  };
  F.realEvent = await mkEvent('A real birthday', false);
  F.demoEvent = await mkEvent('A demo birthday', true);

  const mkShop = async (key: string, isDemo: boolean) => {
    const uid = await mkUser(`demo-pair-shop-${key}@demo-pairing.test`, 'vendor');
    F.shopUser[key] = uid;
    const id = (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name RETURNING vendor_profile_id`,
        [uid, `Pairing ${key}`],
      )
    ).rows[0]!.vendor_profile_id;
    await db.exec('SET session_replication_role = replica');
    await db.query(
      `UPDATE public.vendor_profiles SET is_demo = $2 WHERE vendor_profile_id = $1`,
      [id, isDemo],
    );
    await db.exec('SET session_replication_role = origin');
    return id;
  };
  F.realShop = await mkShop('real', false);
  F.demoShop = await mkShop('demo', true);
  F.otherDemoShop = await mkShop('demo2', true);
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the seed is what it says (read back, so a silent no-op cannot pass)', async () => {
  const ev = await db.query<{ event_id: string; is_sample: boolean }>(
    `SELECT event_id, is_sample FROM public.events WHERE event_id = ANY($1::uuid[])`,
    [[F.realEvent, F.demoEvent]],
  );
  assert.deepEqual(
    Object.fromEntries(ev.rows.map((r) => [r.event_id, r.is_sample])),
    { [F.realEvent]: false, [F.demoEvent]: true },
  );
  const vp = await db.query<{ vendor_profile_id: string; is_demo: boolean }>(
    `SELECT vendor_profile_id, is_demo FROM public.vendor_profiles WHERE vendor_profile_id = ANY($1::uuid[])`,
    [[F.realShop, F.demoShop, F.otherDemoShop]],
  );
  assert.deepEqual(
    Object.fromEntries(vp.rows.map((r) => [r.vendor_profile_id, r.is_demo])),
    { [F.realShop]: false, [F.demoShop]: true, [F.otherDemoShop]: true },
  );
});

test('every pairing table carries the trigger, with the right columns', async () => {
  const r = await db.query<{ rel: string; args: string }>(
    `SELECT t.tgrelid::regclass::text AS rel,
            encode(t.tgargs, 'escape') AS args
       FROM pg_trigger t
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE p.proname = 'refuse_demo_cross_booking' AND NOT t.tgisinternal`,
  );
  const byTable = new Map(r.rows.map((row) => [row.rel, row.args.split('\\000').filter(Boolean)]));
  console.log(`refuse_demo_cross_booking is on ${byTable.size} tables: ${[...byTable.keys()].sort().join(', ')}`);
  for (const { table } of TABLES) {
    assert.ok(byTable.has(table), `${table} has no refuse_demo_cross_booking trigger`);
    assert.equal(byTable.get(table)![0], 'event_id', `${table}: the first argument must be the event column`);
  }
  assert.deepEqual(byTable.get('event_vendors'), ['event_id', 'marketplace_vendor_id', 'linked_vendor_profile_id']);
});

for (const { table, insert } of TABLES) {
  test(`${table}: a real event + a demo shop is refused`, async () => {
    const { sql, params } = insert({ event: F.realEvent, shop: F.demoShop });
    const r = await attempt(sql, params);
    assert.match(r.error ?? '(no error — the row was written)', /demo_cross_booking: demo shop on a real event/);
  });

  test(`${table}: a demo event + a real shop is refused`, async () => {
    const { sql, params } = insert({ event: F.demoEvent, shop: F.realShop });
    const r = await attempt(sql, params);
    assert.match(r.error ?? '(no error — the row was written)', /demo_cross_booking: real shop on a demo event/);
  });

  test(`${table}: real + real and demo + demo are not refused by this rule`, async () => {
    for (const pair of [
      { event: F.realEvent, shop: F.realShop },
      { event: F.demoEvent, shop: F.demoShop },
    ]) {
      const { sql, params } = insert(pair);
      const r = await attempt(sql, params);
      assert.doesNotMatch(r.error ?? '', /demo_cross_booking/, `${table}: a matching pair was refused as a cross-booking`);
      if (table === 'event_vendors' || table === 'chat_threads') {
        assert.equal(r.error, null, `${table}: a matching pair must be written (got: ${r.error})`);
        assert.ok(r.id, `${table}: no row came back`);
      }
    }
  });
}

test('event_vendors: locking a saved demo shop onto a real event (linked_vendor_profile_id) is refused', async () => {
  await db.exec('BEGIN');
  try {
    // A pick saved with no shop on it yet (nothing to pair), then pointed at the demo shop on lock.
    const row = await db.query<{ vendor_id: string }>(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status)
       VALUES ($1, 'photographer', 'Legacy pick', 'considering') RETURNING vendor_id`,
      [F.realEvent],
    );
    await assert.rejects(
      db.query(`UPDATE public.event_vendors SET linked_vendor_profile_id = $2 WHERE vendor_id = $1`, [
        row.rows[0]!.vendor_id,
        F.demoShop,
      ]),
      /demo_cross_booking: demo shop on a real event/,
    );
  } finally {
    await db.exec('ROLLBACK');
  }
});

test('a legacy cross row keeps its lifecycle, but cannot be re-pointed at another demo shop', async () => {
  await db.exec('BEGIN');
  try {
    // Written as it was before the rule existed: the trigger off for this one insert.
    await db.exec('ALTER TABLE public.chat_threads DISABLE TRIGGER chat_threads_refuse_demo_cross_booking');
    const t = await db.query<{ thread_id: string }>(
      `INSERT INTO public.chat_threads (event_id, vendor_profile_id, created_by_user_id) VALUES ($1, $2, $3) RETURNING thread_id`,
      [F.realEvent, F.demoShop, F.couple],
    );
    await db.exec('ALTER TABLE public.chat_threads ENABLE TRIGGER chat_threads_refuse_demo_cross_booking');
    const threadId = t.rows[0]!.thread_id;

    // An update that leaves the pairing alone — archive it — goes through, even naming the same ids.
    await db.query(
      `UPDATE public.chat_threads SET archived_at = now(), event_id = event_id, vendor_profile_id = vendor_profile_id WHERE thread_id = $1`,
      [threadId],
    );
    const back = await db.query<{ archived: boolean }>(
      `SELECT archived_at IS NOT NULL AS archived FROM public.chat_threads WHERE thread_id = $1`,
      [threadId],
    );
    assert.equal(back.rows[0]?.archived, true, 'the legacy thread could not be archived');

    // Re-pointing it at another demo shop is a NEW pairing, and is refused.
    await assert.rejects(
      db.query(`UPDATE public.chat_threads SET vendor_profile_id = $2 WHERE thread_id = $1`, [threadId, F.otherDemoShop]),
      /demo_cross_booking: demo shop on a real event/,
    );
  } finally {
    await db.exec('ROLLBACK');
  }
});

test("a couple's OWN insert is refused too, though their RLS cannot read the shop's is_demo", async () => {
  await setAuthUid(db, F.couple);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec('BEGIN');
  try {
    await db.exec('SET LOCAL ROLE authenticated');
    await assert.rejects(
      db.query(
        `INSERT INTO public.event_vendors (event_id, category, vendor_name, status, marketplace_vendor_id)
         VALUES ($1, 'photographer', 'Couple pick', 'considering', $2)`,
        [F.realEvent, F.demoShop],
      ),
      /demo_cross_booking: demo shop on a real event/,
    );
  } finally {
    await db.exec('ROLLBACK');
    await reset();
  }
});

test('nobody may call the trigger function directly', async () => {
  const r = await db.query<{ anon: boolean; authed: boolean }>(
    `SELECT has_function_privilege('anon', 'public.refuse_demo_cross_booking()', 'EXECUTE') AS anon,
            has_function_privilege('authenticated', 'public.refuse_demo_cross_booking()', 'EXECUTE') AS authed`,
  );
  assert.deepEqual(r.rows[0], { anon: false, authed: false });
});

// ── PART 2 · demo numbers never count in real totals ──────────────────────────────────────────────────────────────

async function asService<T>(fn: () => Promise<T>): Promise<T> {
  await db.query(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
  await db.exec('SET ROLE service_role');
  try {
    return await fn();
  } finally {
    await reset();
  }
}

test("recompute_market_price_bands: a demo shop's price is not a market price", async () => {
  const region = 'demo-pair-region';
  const prices: number[] = [];
  const shops: string[] = [];
  // As many real peers as the band's floor asks for (admin-managed radar_min_n_floor, never below 3).
  const floor =
    (await db.query<{ floor: number }>(
      `SELECT GREATEST(COALESCE(radar_min_n_floor, 3), 3)::int AS floor FROM public.platform_settings WHERE id = 1`,
    )).rows[0]?.floor ?? 3;
  for (let i = 0; i < floor; i += 1) shops.push(await (async () => {
    const uid = (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, '{"account_type":"vendor"}'::jsonb) RETURNING id`,
        [`demo-pair-band-${i}@demo-pairing.test`],
      )
    ).rows[0]!.id;
    return (
      await db.query<{ vendor_profile_id: string }>(
        `INSERT INTO public.vendor_profiles (user_id, business_name, hq_region) VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE SET hq_region = EXCLUDED.hq_region RETURNING vendor_profile_id`,
        [uid, `Band peer ${i}`, region],
      )
    ).rows[0]!.vendor_profile_id;
  })());
  for (const [i, shop] of shops.entries()) {
    prices.push(20000 + 1000 * i);
    await insertLiveCard(db, { vendor_profile_id: shop, category: 'photographer', title: `Band peer ${i}`, starting_price_php: prices[i] });
  }
  // The demo shop sits in the same region and category at a price no real peer charges.
  await db.query(`UPDATE public.vendor_profiles SET hq_region = $2 WHERE vendor_profile_id = $1`, [F.demoShop, region]);
  await insertLiveCard(db, { vendor_profile_id: F.demoShop, category: 'photographer', title: 'Demo band card', starting_price_php: 999999 });

  await asService(() => db.query(`SELECT public.recompute_market_price_bands()`));
  const band = (
    await db.query<{ high_php: string; sample_n: number }>(
      `SELECT high_php::text, sample_n FROM public.market_price_bands WHERE region_slug = $1 AND category = 'photographer'`,
      [region],
    )
  ).rows[0];
  assert.ok(band, `the ${floor} real peers produced no band — the fixture measures nothing`);
  assert.equal(band.sample_n, floor, 'the demo shop was counted as a peer');
  assert.equal(Number(band.high_php), Math.max(...prices), "the demo shop's price set the band's high");
});

test('refresh_demand_radar_rollups: a demo event is not demand', async () => {
  for (const [name, region, sample] of [
    ['Radar real', 'demo-pair-radar-real', false],
    ['Radar demo', 'demo-pair-radar-demo', true],
  ] as const) {
    const id = (
      await db.query<{ event_id: string }>(
        `INSERT INTO public.events (display_name, event_type, region, event_date) VALUES ($1, 'birthday', $2, '2027-12-12') RETURNING event_id`,
        [name, region],
      )
    ).rows[0]!.event_id;
    await db.exec('SET session_replication_role = replica');
    await db.query(`UPDATE public.events SET is_sample = $2 WHERE event_id = $1`, [id, sample]);
    await db.exec('SET session_replication_role = origin');
    await db.query(
      `INSERT INTO public.event_vendors (event_id, category, vendor_name, status) VALUES ($1, 'misc', 'Radar booking', 'contracted')`,
      [id],
    );
  }
  await asService(() => db.query(`SELECT public.refresh_demand_radar_rollups()`));
  const rows = await db.query<{ region: string }>(
    `SELECT region FROM public.demand_radar_rollups WHERE region LIKE 'demo-pair-radar-%' ORDER BY region`,
  );
  assert.deepEqual(rows.rows.map((r) => r.region), ['demo-pair-radar-real'], 'the demo event counted as demand');
});

test('admin_market_analytics: a demo event is not counted', async () => {
  const out = await asService(() => db.query<{ r: { budget: { events_total: number } } }>(`SELECT public.admin_market_analytics() AS r`));
  const counted = Number(out.rows[0]!.r.budget.events_total);
  const truth = await db.query<{ real: number; sample: number }>(
    `SELECT count(*) FILTER (WHERE NOT is_sample)::int AS real, count(*) FILTER (WHERE is_sample)::int AS sample
       FROM public.events WHERE archived = FALSE`,
  );
  assert.ok(truth.rows[0]!.sample > 0, 'no demo event in the data — this measures nothing');
  assert.equal(counted, truth.rows[0]!.real, 'the admin market analytics counted a demo event');
});

test('recompute_market_funnel_bands: its peers are real shops only (pinned by body)', async () => {
  const r = await db.query<{ src: string }>(`SELECT prosrc AS src FROM pg_proc WHERE proname = 'recompute_market_funnel_bands'`);
  assert.match(r.rows[0]!.src, /JOIN public\.vendor_activity_stats vas[\s\S]*WHERE vs\.is_active = TRUE\s+AND vp\.is_demo = FALSE/);
});
